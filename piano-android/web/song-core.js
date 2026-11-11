/* Local score model: SMF, MusicXML, notation export and performance evidence. */
'use strict';
const SongCore=(()=>{
  const EPS=1e-6,MAX_NOTES=20000,MAX_BARS=2000;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const pitchName=p=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','B♭','B'][p%12]+(Math.floor(p/12)-1);
  function check(song){
    if(!song.notes.length)throw Error('文件中没有可练习的有音高音符。');
    if(song.notes.length>MAX_NOTES||song.measures.length>MAX_BARS)throw Error('曲谱过大：本版最多 20000 个音、2000 小节，请先导出选段。');
    if(song.notes.some(n=>!Number.isFinite(n.start)||!Number.isFinite(n.duration)||n.start<0||n.duration<=0||!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127))throw Error('文件包含无效的音符或时间。');
    if(song.notes.some(n=>n.spelling&&(!/^[CDEFGAB]$/.test(n.spelling.step)||!Number.isInteger(n.spelling.octave)||!Number.isInteger(n.spelling.alter)||Math.abs(n.spelling.alter)>3||((n.spelling.octave+1)*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[n.spelling.step]+n.spelling.alter+(n.transpose||0)!==n.pitch))))throw Error('音符的谱面拼写与实际音高不一致。');
    if(!song.measures.length||song.measures.some((m,i)=>!Number.isFinite(m.start)||!Number.isFinite(m.end)||m.end<=m.start||m.beats<=0||m.unit<=0||i&&Math.abs(m.start-song.measures[i-1].end)>.01))throw Error('曲谱小节时间不连续。');
    if(song.tempos.some(t=>!Number.isFinite(t.beat)||t.beat<0||!Number.isFinite(t.bpm)||t.bpm<=0||t.bpm>1000))throw Error('速度数据无效。');
    song.notes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
    song.duration=song.measures.at(-1)?.end||Math.max(...song.notes.map(n=>n.start+n.duration));
    song.tempos=(song.tempos.length?song.tempos:[{beat:0,bpm:120}]).sort((a,b)=>a.beat-b.beat);
    if(song.tempos[0].beat>0)song.tempos.unshift({beat:0,bpm:120});
    song.baseTempo=song.tempos[0].bpm;
    song.warnings=song.warnings||[];
    const outside=song.notes.filter(n=>n.pitch<21||n.pitch>108).length;
    if(outside)song.warnings.push(outside+' 个音在 88 键范围以外，请选择其他声部或先在制谱软件中调整。');
    return song;
  }
  function makeMeasures(duration,meters){
    const out=[];let at=0,mi=0;
    while(at<duration-EPS){
      if(out.length>=MAX_BARS)throw Error('超过 2000 小节，请导出较短片段。');
      while(mi+1<meters.length&&meters[mi+1].beat<=at+EPS)mi++;
      const m=meters[mi],span=m.beats*4/m.unit;
      const next=meters[mi+1]?.beat;
      const end=next>at+EPS&&next<at+span-EPS?next:at+span;
      out.push({index:out.length+1,label:String(out.length+1),start:at,end,beats:m.beats,unit:m.unit});at=end;
    }
    return out;
  }
  function parseMidi(input,name='导入 MIDI'){
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let p=0;
    const need=n=>{if(p+n>bytes.length)throw Error('MIDI 文件截断，无法完整读取。');};
    const u8=()=>{need(1);return bytes[p++];},u16=()=>{need(2);const x=v.getUint16(p);p+=2;return x;},u32=()=>{need(4);const x=v.getUint32(p);p+=4;return x;};
    const str=n=>{need(n);let s='';for(let i=0;i<n;i++)s+=String.fromCharCode(bytes[p++]);return s;};
    const vlq=()=>{let x=0;for(let i=0;i<4;i++){const b=u8();x=x*128+(b&127);if(!(b&128))return x;}throw Error('MIDI 可变长度字段错误。');};
    if(str(4)!=='MThd')throw Error('这不是标准 MIDI 文件。');
    const header=u32();if(header<6)throw Error('MIDI 头不完整。');
    const format=u16(),nt=u16(),ppq=u16();
    if(format>1)throw Error('暂不支持 MIDI 格式 2，请在制谱软件中导出格式 0 或 1。');
    if(!ppq||(ppq&0x8000))throw Error('暂不支持 SMPTE 时间码 MIDI，请导出按节拍计时的 MIDI。');
    p+=header-6;const notes=[],tempos=[],meters=[],tracks=[],warnings=[];let endTick=0,id=0;
    for(let ti=0;ti<nt;ti++){
      if(str(4)!=='MTrk')throw Error('MIDI 音轨数据不完整。');
      const len=u32(),end=p+len;need(len);let tick=0,running=0,trackName='声部 '+(ti+1),drums=0;const active=new Map();
      while(p<end){
        tick+=vlq();let status=u8();
        if(status<128){if(!running)throw Error('MIDI 缺少运行状态。');p--;status=running;}
        if(status===255){
          const type=u8(),n=vlq();need(n);if(p+n>end)throw Error('MIDI 音轨长度错误。');const b=bytes.subarray(p,p+n);
          if(type===3){try{trackName=new TextDecoder('utf-8').decode(b).replace(/\u0000/g,'').slice(0,120)||trackName;}catch(e){}}
          if(type===81&&n===3){const us=b[0]*65536+b[1]*256+b[2];if(us>0)tempos.push({beat:tick/ppq,bpm:60000000/us});}
          if(type===88&&n>=2&&b[0]>0&&b[1]<=6)meters.push({beat:tick/ppq,beats:b[0],unit:2**b[1]});
          p+=n;if(type===47){p=end;break;}continue;
        }
        if(status===240||status===247){running=0;const n=vlq();need(n);p+=n;continue;}
        if(status>=240)throw Error('MIDI 含有不支持的系统事件，请重新导出标准 MIDI。');
        running=status;const cmd=status>>4,ch=status&15,a=u8(),b=(cmd===12||cmd===13)?0:u8();
        if(a>127||b>127)throw Error('MIDI 音符数据错误。');
        if(cmd===11&&a===64&&!warnings.includes('MIDI 踏板信息不纳入本版播放与评分，以按键起止为准。'))warnings.push('MIDI 踏板信息不纳入本版播放与评分，以按键起止为准。');
        if(cmd===14&&!warnings.includes('MIDI 弯音不纳入钢琴成谱与评分。'))warnings.push('MIDI 弯音不纳入钢琴成谱与评分。');
        const key=ch+':'+a;
        if(cmd===9&&b>0){if(ch===9){drums++;continue;}if(!active.has(key))active.set(key,[]);active.get(key).push({tick,velocity:b});}
        if(cmd===8||(cmd===9&&b===0)){
          const q=active.get(key);if(!q?.length)continue;const on=q.shift();
          if(tick>on.tick)notes.push({id:'m'+id++,pitch:a,start:on.tick/ppq,duration:(tick-on.tick)/ppq,velocity:on.velocity,track:String(ti),staff:a<60?2:1});
        }
        if(notes.length>MAX_NOTES)throw Error('音符超过 20000 个，请先导出选段。');
      }
        if(p!==end)throw Error('MIDI 音轨边界错误。');endTick=Math.max(endTick,tick);
      const open=[...active.values()].reduce((n,q)=>n+q.length,0);if(open)throw Error('MIDI 有 '+open+' 个音缺少松键事件，请先重新导出文件。');
      if(notes.some(n=>n.track===String(ti)))tracks.push({id:String(ti),name:trackName});
      if(drums)warnings.push('已排除声部「'+trackName+'」中的打击乐通道。');
    }
    const unique=list=>[...new Map(list.sort((a,b)=>a.beat-b.beat).map(x=>[x.beat,x])).values()];
    const ms=unique(meters);if(!ms.length||ms[0].beat!==0)ms.unshift({beat:0,beats:4,unit:4});
    const duration=notes.reduce((a,n)=>Math.max(a,n.start+n.duration),0);
    warnings.unshift('MIDI 的左右手按中央 C 分配，可调整分界。谱面会按所选网格整理节奏；欣赏仍保留原始时间。');
    return check({version:1,title:name.replace(/\.(midi?|kar)$/i,''),format:'midi',notes,tracks,tempos:unique(tempos),meters:ms,measures:makeMeasures(duration,ms),warnings,ppq});
  }
  function parseXML(text,name='导入曲谱'){
    if(/<!ENTITY/i.test(text))throw Error('不支持含自定义实体的 XML。');
    const doc=new DOMParser().parseFromString(text,'application/xml');
    if(doc.querySelector('parsererror'))throw Error('MusicXML 语法不完整，无法读取。');
    const root=doc.documentElement;if(root.localName!=='score-partwise')throw Error('请导入 score-partwise 格式的 MusicXML。');
    if(root.querySelector('repeat,ending,segno,coda')||[...root.querySelectorAll('sound')].some(e=>['dacapo','dalsegno','tocoda','fine'].some(k=>e.hasAttribute(k))))throw Error('此谱包含反复或跳转。本版请先在 MuseScore 展开反复后导出 MusicXML，以免练习顺序不一致。');
    const txt=(e,s,f='')=>e.querySelector(s)?.textContent?.trim()||f;
    const children=(e,n)=>[...e.children].filter(c=>c.localName===n);
    const partNames=new Map([...root.querySelectorAll('part-list > score-part')].map(p=>[p.id,txt(p,'part-name','钢琴')]));
    const notes=[],tracks=[],tempos=[],measures=[],meters=[],warnings=[];let id=0;
    for(const part of children(root,'part')){
      const track=part.getAttribute('id');tracks.push({id:track,name:partNames.get(track)||track});
      let div=1,beats=4,unit=4,start=0,transpose=0;const ties=new Map(),clefs={1:'G',2:'F'};
      const partIndex=children(root,'part').indexOf(part),partCount=children(root,'part').length;
      const staffCount=Math.max(1,...[...part.querySelectorAll('staves')].map(e=>Number(e.textContent)||1),...[...part.querySelectorAll('note > staff')].map(e=>Number(e.textContent)||1));
      for(const [mi,m]of children(part,'measure').entries()){
        let cursor=0,latest=0,lastOnset=0,seen=false;
        for(const e of m.children){
          if(e.localName==='attributes'){
            div=Number(txt(e,'divisions',String(div)));if(!(div>0))throw Error('MusicXML divisions 必须大于零。');
            const t=e.querySelector('time');if(t){const b=txt(t,'beats');if(!/^\d+(\+\d+)*$/.test(b))throw Error('不支持此拍号，请先整理拍号。');beats=b.split('+').reduce((a,b)=>a+Number(b),0);unit=Number(txt(t,'beat-type','4'));if(!beats||![1,2,4,8,16,32,64].includes(unit))throw Error('拍号无效。');}
            const tr=e.querySelector('transpose');if(tr)transpose=Number(txt(tr,'chromatic','0'))+12*Number(txt(tr,'octave-change','0'));
            for(const c of children(e,'clef'))clefs[Number(c.getAttribute('number')||1)]=txt(c,'sign','G');
          }else if(e.localName==='backup'||e.localName==='forward'){
            const d=Number(txt(e,'duration','0'))/div;cursor+=e.localName==='backup'?-d:d;if(cursor< -EPS)throw Error('小节声部时间超出左边界，请先在 MuseScore 整理文件。');
          }else if(e.localName==='direction'){
            const s=e.querySelector('sound[tempo]'),mm=e.querySelector('metronome');let bpm=s?Number(s.getAttribute('tempo')):mm?parseFloat(txt(mm,'per-minute')):0;
            if(!s&&mm){const units={whole:4,half:2,quarter:1,eighth:.5,'16th':.25};bpm*=units[txt(mm,'beat-unit')]||1;if(mm.querySelector('beat-unit-dot'))bpm*=1.5;}
            if(bpm>0&&bpm<=1000)tempos.push({beat:start+cursor+Number(txt(e,'offset','0'))/div,bpm});
          }else if(e.localName==='note'){
            if(e.querySelector('grace')){warnings.push('装饰音仅显示，不作为必须弹奏的评分目标。');continue;}
            const dur=Number(txt(e,'duration','0'))/div;if(!(dur>0))continue;
            const chord=!!e.querySelector('chord'),at=chord?lastOnset:cursor;if(!chord){lastOnset=at;cursor+=dur;}latest=Math.max(latest,at+dur);seen=true;
            const pit=e.querySelector('pitch');if(!pit)continue;
            const step=txt(pit,'step'),alter=Number(txt(pit,'alter','0')),octave=Number(txt(pit,'octave'));
            if(!/^[CDEFGAB]$/.test(step)||!Number.isInteger(octave)||!Number.isInteger(alter))throw Error('音高无效或包含微分音，请先导出十二平均律曲谱。');
            const pitch=(octave+1)*12+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[step])+alter+transpose;
            const staff=Number(txt(e,'staff','1')),hand=staffCount>1?(staff>1?2:1):partCount===2?(partIndex===0?1:2):clefs[staff]==='F'?2:1,voice=txt(e,'voice','1');
            const finger=[...e.querySelectorAll('notations > technical > fingering')].map(f=>f.textContent.trim()).find(f=>/^[1-5](?:[-–/][1-5])?$/.test(f))||'';
            const ts=children(e,'tie').map(x=>x.getAttribute('type')),key=track+':'+staff+':'+voice+':'+pitch;
        const existing=ties.get(key);
            if(ts.includes('stop')&&existing&&Math.abs(existing.start+existing.duration-start-at)<.01){existing.duration+=dur;if(!ts.includes('start'))ties.delete(key);}
            else {const n={id:'x'+id++,pitch,start:start+at,duration:dur,velocity:80,track,staff:hand,sourceStaff:staff,sourceClef:clefs[staff]||'G',voice,finger,fingerSource:finger?'score':'',measure:mi+1,spelling:{step,alter,octave},transpose};notes.push(n);if(ts.includes('start'))ties.set(key,n);}
          }
        }
        const nominal=beats*4/unit;
        const span=m.getAttribute('implicit')==='yes'&&seen?latest:Math.max(nominal,latest);
        if(latest>nominal+.01&&m.getAttribute('implicit')!=='yes')warnings.push('小节 '+m.getAttribute('number')+' 超过拍号时值，请检查原文件。');
        if(part===children(root,'part')[0]){
          measures.push({index:mi+1,label:m.getAttribute('number')||String(mi+1),start,end:start+span,beats,unit});
          if(!meters.length||meters.at(-1).beats!==beats||meters.at(-1).unit!==unit)meters.push({beat:start,beats,unit});
        }else if(!measures[mi]||Math.abs(measures[mi].start-start)>.01||Math.abs(measures[mi].end-start-span)>.01)throw Error('不同声部的小节时长不一致，请先在 MuseScore 修复后导入。');
        start+=span;if(measures.length>MAX_BARS||notes.length>MAX_NOTES)throw Error('曲谱过大，请先导出选段。');
      }
    }
    const title=txt(root,'work-title',txt(root,'movement-title',name.replace(/\.(musicxml|xml|mxl)$/i,'')));
    return check({version:1,title,format:'musicxml',xml:text,notes,tracks,measures,meters,tempos:[...new Map(tempos.map(t=>[t.beat,t])).values()],warnings:[...new Set(warnings)]});
  }
  function settings(song,raw={}){
    const allowed=song.tracks.map(t=>t.id),track=allowed.includes(raw.track)?raw.track:'all';
    const value={mode:['beginner','advanced','exam','listen'].includes(raw.mode)?raw.mode:'beginner',examKind:raw.examKind==='notes'?'notes':'timed',track,hand:['both','right','left'].includes(raw.hand)?raw.hand:'both',split:clamp(Math.round(Number(raw.split)||60),21,108),grid:[.25,.5,1/3].includes(Number(raw.grid))?Number(raw.grid):.25,tempo:clamp(Number(raw.tempo)||song.baseTempo,20,240),from:clamp(Math.floor(Number(raw.from)||1),1,song.measures.length),to:clamp(Math.floor(Number(raw.to)||Math.min(2,song.measures.length)),1,song.measures.length),offset:clamp(Number(raw.offset)||0,-400,400),tolerance:raw.tolerance==='strict'?'strict':'normal',loop:!!raw.loop,metronome:raw.metronome!==false,accompany:!!raw.accompany,zoom:clamp(Number(raw.zoom)||1,.65,1.6),drill:raw.drill==='rhythm'?'rhythm':''};
    value.handMap=['swap','right','left'].includes(raw.handMap)?raw.handMap:'score';
    if(value.to<value.from)[value.from,value.to]=[value.to,value.from];return value;
  }
  function handOf(song,n,s){const base=song.format==='midi'&&!song.study?.original?(n.pitch<s.split?2:1):n.staff;return s.handMap==='swap'?(base===1?2:1):s.handMap==='right'?1:s.handMap==='left'?2:base;}
  function physical(notes){const map=new Map();for(const note of notes){const key=Math.round(note.start*1000000)+':'+note.pitch,ids=note.sourceIds||[note.id],sources=note.logicalSources||[{id:note.id,staff:note.staff,sourceStaff:note.sourceStaff,voice:note.voice,sourceIds:[...ids]}];if(map.has(key)){const n=map.get(key);n.sourceIds=[...new Set([...n.sourceIds,...ids])];n.logicalSources.push(...sources);n.duration=Math.max(n.duration,note.duration);n.velocity=Math.max(n.velocity||0,note.velocity||0);}else map.set(key,{...note,sourceIds:[...ids],logicalSources:[...sources]});}return[...map.values()];}
  function prepared(song,raw){
    const s=settings(song,raw);if(s.to<s.from)[s.from,s.to]=[s.to,s.from];const from=song.measures[s.from-1].start,to=song.measures[s.to-1].end;
    const selected=song.notes.filter(n=>s.track==='all'||n.track===s.track).map(n=>{
      const staff=handOf(song,n,s);
      const start=song.format==='midi'?Math.round(n.start/s.grid)*s.grid:n.start;
      const end=song.format==='midi'?Math.max(start+s.grid,Math.round((n.start+n.duration)/s.grid)*s.grid):n.start+n.duration;
      return {...n,start,duration:end-start,staff};
    });
    const all=selected.filter(n=>n.start>=from-EPS&&n.start<to-EPS).map(n=>({...n,beat:n.start-from,measure:song.measures.findIndex(m=>n.start<m.end-EPS)+1}));
    const filtered=all.filter(n=>n.pitch>=21&&n.pitch<=108&&(s.hand==='both'||n.staff===(s.hand==='right'?1:2))),notes=song.format==='mscz'?physical(filtered):filtered;
    const groups=[];
    const grouped=new Map();
    for(const n of notes){const key=Math.round(n.beat*10000);let g=grouped.get(key);if(!g){g={beat:n.beat,sourceBeat:n.start,measure:n.measure,notes:[]};groups.push(g);grouped.set(key,g);}if(!g.notes.some(x=>x.pitch===n.pitch))g.notes.push(n);}
    groups.sort((a,b)=>a.beat-b.beat);
    return {settings:s,from,to,total:to-from,notes,all,groups};
  }
  function secondsAt(song,beat,tempo=song.baseTempo){
    let sum=0,at=0,bpm=song.tempos[0]?.bpm||120;
    for(const t of song.tempos){if(t.beat>beat)break;if(t.beat>at)sum+=(t.beat-at)*60/bpm;at=t.beat;bpm=t.bpm;}
    return (sum+Math.max(0,beat-at)*60/bpm)*song.baseTempo/tempo;
  }
  function beatAt(song,seconds,tempo=song.baseTempo){let lo=0,hi=song.duration;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(secondsAt(song,mid,tempo)<seconds)lo=mid;else hi=mid;}return (lo+hi)/2;}
  function evaluate(song,ex,presses,limit=Infinity){
    const s=ex.settings,origin=secondsAt(song,ex.from,s.tempo)*1000,expected=ex.groups.flatMap((g,gi)=>g.notes.map(n=>({...n,group:gi,time:secondsAt(song,n.start,s.tempo)*1000-origin}))).filter(n=>n.time<limit);
    const used=new Set(),answers=[],rows=[];
    for(const n of expected){
      const g=ex.groups[n.group],next=ex.groups[n.group+1],prev=ex.groups[n.group-1];
      const gap=Math.min(next?(secondsAt(song,next.sourceBeat,s.tempo)-secondsAt(song,g.sourceBeat,s.tempo))*1000:Infinity,prev?(secondsAt(song,g.sourceBeat,s.tempo)-secondsAt(song,prev.sourceBeat,s.tempo))*1000:Infinity);
      const quarter=(secondsAt(song,n.start+1,s.tempo)-secondsAt(song,n.start,s.tempo))*1000;
      const win=Math.min(quarter*.35,gap*.44),tight=Math.min(win,quarter*(s.tolerance==='strict'?.12:.22));
      rows.push({n,win,tight,c:null});
    }
    // Reserve correct pitches across the complete chord before assigning wrong notes.
    for(const exact of [true,false])for(const row of rows){
      if(row.c)continue;const {n,win}=row;
      const candidates=presses.map((p,i)=>({p,i,delta:p.ms-s.offset-n.time})).filter(x=>!used.has(x.i)&&Math.abs(x.delta)<=win&&(!exact||x.p.pitch===n.pitch)).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta));
      if(candidates[0]){row.c=candidates[0];used.add(row.c.i);}
    }
    for(const {n,c,win,tight}of rows)answers.push({id:n.id,pitch:n.pitch,actual:c?.p.pitch??null,correct:c?.p.pitch===n.pitch,timing:!!c&&Math.abs(c.delta)<=tight,delta:c?.delta??null,measure:n.measure,beat:n.beat,sourceBeat:n.start,staff:n.staff,window:win,hint:false});
    const extras=presses.filter((p,i)=>!used.has(i)&&p.ms-s.offset>=0&&p.ms-s.offset<limit),total=answers.length,correct=answers.filter(a=>a.correct).length,onTime=answers.filter(a=>a.correct&&a.timing).length;
    return {answers,extras,total,correct,onTime,missed:answers.filter(a=>a.actual===null).length,wrong:answers.filter(a=>a.actual!==null&&!a.correct).length,medianOffset:median(answers.filter(a=>a.delta!==null).map(a=>a.delta)),score:total?Math.round(clamp((correct*.6+onTime*.4-extras.length*.3)/total,0,1)*100):0};
  }
  function median(v){if(!v.length)return null;v=[...v].sort((a,b)=>a-b);const i=Math.floor(v.length/2);return v.length%2?v[i]:(v[i-1]+v[i])/2;}
  const values=[[4,'whole',0],[3,'half',1],[2,'half',0],[1.5,'quarter',1],[4/3,'half',0,3],[1,'quarter',0],[.75,'eighth',1],[2/3,'quarter',0,3],[.5,'eighth',0],[1/3,'eighth',0,3],[.25,'16th',0],[.125,'32nd',0]];
  function durations(duration){
    let ticks=Math.round(duration*96);const out=[];let guard=0;
    while(ticks>0){if(++guard>150)throw Error('音符时值过长，请先整理 MIDI。');const v=values.find(v=>Math.round(v[0]*96)<=ticks)||[ticks/96,'32nd',0];out.push(v);ticks-=Math.round(v[0]*96);}
    return out;
  }
  function toXML(song,raw={}){
    if(song.format==='mscz')return song.xml;
    const s=settings(song,raw),ex=prepared(song,{...s,from:1,to:song.measures.length});
    const notes=ex.all,sharps=[['C',0],['C',1],['D',0],['D',1],['E',0],['F',0],['F',1],['G',0],['G',1],['A',0],['B',-1],['B',0]];
    let out='<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><work><work-title>'+esc(song.title)+'</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name><score-instrument id="I1"><instrument-name>Piano</instrument-name></score-instrument><midi-instrument id="I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument></score-part></part-list><part id="P1">';
    const voices={1:[],2:[]};
    for(const n of notes){const staff=n.staff===2?2:1;let v=voices[staff].find(v=>v.end<=n.start+EPS||Math.abs(v.last.start-n.start)<EPS&&Math.abs(v.last.duration-n.duration)<EPS);if(!v){v={end:0,notes:[],last:null};voices[staff].push(v);}v.notes.push(n);v.last=n;v.end=Math.max(v.end,n.start+n.duration);}
    if(voices[1].length>8||voices[2].length>8)throw Error('此 MIDI 重叠声部过多，无法生成清晰钢琴谱。请选择单一音轨，或先在 MuseScore 整理。');
    for(const m of song.measures){
      out+='<measure number="'+m.index+'"><attributes><divisions>96</divisions>';
      if(m.index===1||song.measures[m.index-2].beats!==m.beats||song.measures[m.index-2].unit!==m.unit)out+='<time><beats>'+m.beats+'</beats><beat-type>'+m.unit+'</beat-type></time>';
      if(m.index===1)out+='<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>';
      out+='</attributes>';let first=true;
      for(const st of [1,2]){
        const vs=voices[st].length?voices[st]:[{notes:[]}];
        for(const [vi,v]of vs.entries()){
          if(!first)out+='<backup><duration>'+Math.round((m.end-m.start)*96)+'</duration></backup>';first=false;let at=m.start;
          const segments=v.notes.filter(n=>n.start<m.end-EPS&&n.start+n.duration>m.start+EPS),groups=[];
          for(const n of segments){const a=Math.max(m.start,n.start),b=Math.min(m.end,n.start+n.duration);let g=groups.find(x=>Math.abs(x.a-a)<EPS&&Math.abs(x.b-b)<EPS);if(!g){g={a,b,notes:[]};groups.push(g);}g.notes.push(n);}
          groups.sort((a,b)=>a.a-b.a);
          const emit=(ns,start,end)=>{
            const ds=durations(end-start);let t=start;
            for(const [di,d]of ds.entries()){
              for(const [ni,n]of (ns.length?ns:[null]).entries()){
                const tieStop=!!n&&(n.start<t-EPS),tieStart=!!n&&(n.start+n.duration>t+d[0]+EPS);
                out+='<note>'+(ni?'<chord/>':'');
                if(n){const [letter,alter]=n.spelling?[n.spelling.step,n.spelling.alter]:sharps[n.pitch%12],octave=n.spelling?.octave??(Math.floor(n.pitch/12)-1);out+='<pitch><step>'+letter+'</step>'+(alter?'<alter>'+alter+'</alter>':'')+'<octave>'+octave+'</octave></pitch>';}else out+='<rest/>';
                out+='<duration>'+Math.round(d[0]*96)+'</duration>'+(tieStop?'<tie type="stop"/>':'')+(tieStart?'<tie type="start"/>':'')+'<voice>'+(st*10+vi)+'</voice><type>'+d[1]+'</type>'+(d[2]?'<dot/>':'');
                if(d[3])out+='<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>';
                out+='<staff>'+st+'</staff>';
          const finger=n&&!tieStop&&/^[1-5](?:[-–/][1-5])?$/.test(n.finger||'')?'<technical><fingering>'+esc(n.finger)+'</fingering></technical>':'';
          if(tieStop||tieStart||finger)out+='<notations>'+(tieStop?'<tied type="stop"/>':'')+(tieStart?'<tied type="start"/>':'')+finger+'</notations>';
                out+='</note>';
              }t+=d[0];
            }
          };
          for(const g of groups){if(g.a>at+EPS)emit([],at,g.a);emit(g.notes,g.a,g.b);at=g.b;}
          if(at<m.end-EPS)emit([],at,m.end);
        }
      }
      out+='</measure>';
    }
    return out+'</part></score-partwise>';
  }
  function demo(){
    const notes=[],patterns=[[60,62,64,60],[64,65,67,67],[67,69,67,65],[64,62,60,60]];
    patterns.forEach((bar,i)=>{bar.forEach((pitch,j)=>notes.push({id:'d'+i+'-'+j,pitch,start:i*4+j,duration:1,velocity:80,track:'piano',staff:1}));notes.push({id:'b'+i,pitch:[48,53,55,48][i],start:i*4,duration:4,velocity:65,track:'piano',staff:2});});
    return check({version:1,title:'第一段音乐 · 四小节练习',format:'midi',notes,tracks:[{id:'piano',name:'钢琴'}],tempos:[{beat:0,bpm:60}],meters:[{beat:0,beats:4,unit:4}],measures:makeMeasures(16,[{beat:0,beats:4,unit:4}]),warnings:[],id:'builtin-first-piece'});
  }
  function fromStored(value){
    if(value?.format==='mscz')return window.MSCAppCore.fromStored(value);
    if(!value||typeof value.title!=='string'||!Array.isArray(value.notes)||!Array.isArray(value.measures)||!Array.isArray(value.tracks)||!Array.isArray(value.tempos)||!Array.isArray(value.meters))throw Error('曲谱备份结构不完整。');
    if(value.format==='musicxml')return {...parseXML(value.xml,value.title),id:value.id};
    if(value.format!=='midi')throw Error('曲谱格式不受支持。');
    const song=check(JSON.parse(JSON.stringify(value)));if(song.tracks.some(t=>typeof t.id!=='string'||typeof t.name!=='string')||song.notes.some(n=>!song.tracks.some(t=>t.id===n.track)))throw Error('曲谱声部数据无效。');return song;
  }
  return Object.freeze({parseMidi,parseXML,settings,prepared,physical,handOf,secondsAt,beatAt,evaluate,toXML,demo,median,pitchName,esc,fromStored});
})();
if(typeof globalThis!=='undefined')globalThis.SongCore=SongCore;
if(typeof module!=='undefined')module.exports=SongCore;
