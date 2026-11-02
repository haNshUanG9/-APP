/* A single learning model for imported and authored music. No browser dependencies. */
'use strict';
const SongLearning=(()=>{
  const C=typeof SongCore==='undefined'?require('./song-core.js'):SongCore;
  const copy=x=>JSON.parse(JSON.stringify(x)),DAY=86400000,RETRY=600000;
  const STAGES={listen:'听清这一段',right:'右手读准',left:'左手读准',read:'整段独立认准',slow:'原句慢速跟拍',check:'目标速度检查'};
  const source=s=>s==='midi'?'midi':'touch';
  const defaults=()=>({version:1,plans:{},memory:{},current:{},serial:0,seen:[]});
  const boundedObject=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
  function normalize(raw){
    const d=defaults();if(!raw||raw.version!==1)return d;
    d.serial=Math.max(0,Math.min(10000000,Math.floor(Number(raw.serial)||0)));
    d.seen=(Array.isArray(raw.seen)?raw.seen:[]).filter(x=>typeof x==='string').slice(-200);
    for(const [key,p]of Object.entries(boundedObject(raw.plans)).slice(-100)){
      if(!p||typeof p.songId!=='string'||!p.goal||!Array.isArray(p.units)||!p.units.length||p.units.length>2000||!p.units.every(u=>u&&Number.isInteger(u.from)&&Number.isInteger(u.to)&&u.from>=1&&u.to>=u.from)||!Number.isInteger(p.unit)||p.unit<0||p.unit>p.units.length)continue;
      d.plans[key]={...copy(p),stage:Math.max(0,Math.min(6,Math.floor(Number(p.stage)||0))),clean:Math.max(0,Math.min(2,Math.floor(Number(p.clean)||0))),ticket:null,token:Math.max(0,Math.min(10000000,Math.floor(Number(p.token)||0)))};
    }
    for(const [key,m]of Object.entries(boundedObject(raw.memory)).slice(-400)){
      if(!m||typeof m.songId!=='string'||!m.settings||!Number.isFinite(m.due)||!Number.isFinite(m.last)||!['independent','stable','assisted','retained'].includes(m.status))continue;
      d.memory[key]={...copy(m),source:source(m.source),level:Math.max(0,Math.min(3,Math.floor(Number(m.level)||0))),confirm:Math.min(1,Math.max(0,Math.floor(Number(m.confirm)||0))),cleanTotal:Math.max(0,Math.floor(Number(m.cleanTotal)||0))};
    }
    for(const s of ['touch','midi']){const t=raw.current?.[s];if(t&&typeof t.songId==='string'&&t.settings&&['route','review','remedy'].includes(t.kind))d.current[s]={...copy(t),route:null};}
    return d;
  }
  const condition=s=>[s.track,s.hand,s.grid,s.split,s.tempo,s.tolerance,s.offset,s.metronome,s.accompany,...(s.handMap&&s.handMap!=='score'?[s.handMap]:[])];
  const fingerprint=song=>song.notes.reduce((h,n)=>(Math.imul(h,31)+n.pitch*11+Math.round(n.start*96)+Math.round(n.duration*96))|0,17)+':'+song.notes.length+':'+song.measures.length;
  const key=(song,s,src)=>JSON.stringify([song.id,source(src),...condition(s)]);
  const memoryKey=(song,s,src)=>JSON.stringify([song.id,source(src),...condition(s),s.from,s.to,s.mode==='beginner'||s.mode==='exam'&&s.examKind==='notes'?'pitch':'timed']);
  function analyze(song,raw){
    const ex=C.prepared(song,raw),pitches=ex.notes.map(n=>n.pitch),steps=[];
    for(let i=1;i<ex.groups.length;i++){const a=ex.groups[i-1].notes.filter(n=>n.staff===1),b=ex.groups[i].notes.filter(n=>n.staff===1);if(a.length===1&&b.length===1)steps.push(Math.abs(a[0].pitch-b[0].pitch));}
    const span=pitches.length?Math.max(...pitches)-Math.min(...pitches):0,chord=Math.max(0,...ex.groups.map(g=>g.notes.length)),short=ex.notes.filter(n=>n.duration<1-.001).length,black=ex.notes.filter(n=>[1,3,6,8,10].includes(n.pitch%12)).length;
    const tips=[];if(chord>1)tips.push('有 '+chord+' 音同时起音，先分声部再合起来');if(steps.some(x=>x>=7))tips.push('旋律有较大跳进，先定位音区');if(short)tips.push('含半拍或更短时值，先听细分');if(black)tips.push('含变化音，留意调号与临时记号');if(!tips.length)tips.push('音组与节奏较集中，先读准再连接');
    return {notes:ex.notes.length,span,chord,short,black,tips,estimated:song.format==='midi'};
  }
  function stages(song,p){
    const u=p.units[p.unit];if(!u)return [];
    const raw={...p.goal,from:u.from,to:u.to},ex=C.prepared(song,raw),right=ex.notes.some(n=>n.staff===1),left=ex.notes.some(n=>n.staff===2);
    return ['listen',...(p.goal.hand==='both'&&right&&left?['right','left']:[]),'read','slow','check'];
  }
  function plan(data,song,raw,src){
    const goal=C.settings(song,{...raw,mode:'advanced',drill:'',loop:false}),k=key(song,goal,src),fp=fingerprint(song);let p=data.plans[k];
    if(p&&p.fingerprint===fp)return {key:k,plan:p};
    const units=[];for(let from=1;from<=song.measures.length;from+=2){const to=Math.min(from+1,song.measures.length);units.push({from,to,connected:false});
      if(to%4===0||to===song.measures.length&&to>2&&to%4!==0)units.push({from:Math.max(1,to-(to%4||4)+1),to,connected:true});
      if(to%8===0)units.push({from:to-7,to,connected:true});
      if(to%16===0)units.push({from:to-15,to,connected:true});
    }
    const playable=new Set(C.prepared(song,{...goal,from:1,to:song.measures.length}).notes.map(n=>n.measure));
    const material=units.filter(u=>[...playable].some(bar=>bar>=u.from&&bar<=u.to));
    p={songId:song.id,title:song.title,source:source(src),fingerprint:fp,goal,units:material,unit:0,stage:0,clean:0,token:0,ticket:null,last:0};data.plans[k]=p;return {key:k,plan:p};
  }
  function next(data,song,raw,src){
    const {key:k,plan:p}=plan(data,song,raw,src),u=p.units[p.unit];if(!u)return null;
    const list=stages(song,p);p.stage=Math.min(p.stage,list.length-1);const stage=list[p.stage];
    const settings=C.settings(song,{...p.goal,from:u.from,to:u.to,hand:stage==='right'?'right':stage==='left'?'left':p.goal.hand,tempo:stage==='slow'?Math.max(20,Math.min(p.goal.tempo,Math.round(p.goal.tempo*.7))):p.goal.tempo,mode:stage==='listen'?'listen':['right','left','read'].includes(stage)?'beginner':'advanced',loop:false,metronome:true,accompany:false,drill:''});
    const ticket={key:k,token:++p.token,unit:p.unit,stage,settings:JSON.stringify(settings)};p.ticket=copy(ticket);
    const task={kind:'route',songId:song.id,source:source(src),settings,route:ticket,planKey:k,title:STAGES[stage],connected:u.connected};data.current[source(src)]=task;return task;
  }
  function clean(report){const r=report.result;return !!(report.complete&&!report.interrupted&&!report.assisted&&!report.settings.drill&&r&&r.total>0&&r.correct===r.total&&(r.onTime===null||r.onTime===r.total)&&!r.extras?.length&&!r.wrong&&!r.hinted&&r.answers.every(a=>a.correct&&!a.hint));}
  function observe(data,song,report,now=Date.now()){
    if(report.id&&data.seen.includes(report.id))return {duplicate:true,clean:false,route:null,memory:null};
    if(report.id){data.seen.push(report.id);data.seen=data.seen.slice(-200);}
    data.serial++;const passed=clean(report);let routeResult=null;
    const t=report.task?.route,p=t&&data.plans[t.key];
    if(p&&p.ticket&&p.songId===song.id&&p.source===report.source&&t.token===p.ticket.token&&t.unit===p.unit&&t.stage===stages(song,p)[p.stage]&&p.ticket.settings===JSON.stringify(C.settings(song,report.settings))){
      p.ticket=null;const stage=t.stage,ok=stage==='listen'?report.complete&&!report.interrupted:passed,required=['slow','check'].includes(stage)?2:1;
      p.clean=ok?p.clean+1:0;p.last=now;
      if(p.clean>=required){p.clean=0;p.stage++;if(p.stage>=stages(song,p).length){p.stage=0;p.unit++;}}
      routeResult={passed:ok,advanced:ok&&p.clean===0,required,clean:p.clean,done:p.unit>=p.units.length,unit:p.unit};
      if(p.unit>=p.units.length)delete data.current[report.source];else data.current[report.source]={...copy(report.task),route:null};
    }
    if(report.settings.mode==='listen'||report.settings.drill||!report.complete||report.interrupted)return {clean:passed,route:routeResult,memory:null};
    const k=memoryKey(song,report.settings,report.source);let m=data.memory[k];
    if(!m)m=data.memory[k]={songId:song.id,title:song.title,source:report.source,settings:C.settings(song,report.settings),due:now+RETRY,last:now,level:0,confirm:0,status:passed?'independent':'assisted',cleanTotal:0,failures:0};
    if(passed){m.cleanTotal++;if(report.task?.reviewKey===k&&now>=m.due){m.confirm=(m.confirm||0)+1;if(m.confirm>=2){const waited=now-m.last;m.status=waited>=DAY?'retained':'stable';m.level=Math.min(3,m.level+1);m.due=now+[DAY,DAY*3,DAY*7,DAY*14][m.level-1];m.confirm=0;m.last=now;}else {m.due=now+RETRY;delete data.current[report.source];}}else if(m.status==='independent'&&m.cleanTotal>=2)m.status='stable';}
    else {m.failures++;m.status='assisted';m.confirm=0;m.level=0;m.due=Math.min(m.due,now+RETRY);m.last=now;}
    return {clean:passed,route:routeResult,memory:{key:k,...copy(m)}};
  }
  function due(data,src,now=Date.now()){return Object.entries(data.memory).filter(([,m])=>m.source===source(src)&&m.due<=now).sort((a,b)=>a[1].due-b[1].due).map(([key,m])=>({key,...m}));}
  function review(data,m){const task={kind:'review',songId:m.songId,source:m.source,settings:{...m.settings,loop:false,drill:''},reviewKey:m.key,title:'到期回测 · 两次独立确认'};data.current[m.source]=task;return task;}
  function diagnosis(song,report,history=[]){
    const result=report.result,rows=result.answers||[],timed=result.onTime!==null,bars=new Map();
    const add=(bar,weight,type)=>{if(!song.measures[bar-1])return;const r=bars.get(bar)||{measure:bar,weight:0,pitch:0,octave:0,timing:0,miss:0,hint:0,extra:0};r.weight+=weight;r[type]++;bars.set(bar,r);};
    for(const a of rows){if(a.hint)add(a.measure,2,'hint');if(!a.correct){if(a.actual===null)add(a.measure,3,'miss');else add(a.measure,3,Number.isInteger(a.pitch)&&a.actual!==a.pitch&&(a.actual-a.pitch)%12===0?'octave':'pitch');}else if(timed&&!a.timing)add(a.measure,2,'timing');}
    for(const e of [...(result.extras||[]),...(result.extraAttempts||[])]){let bar=e.measure;if(!bar&&Number.isFinite(e.ms)){const b=C.beatAt(song,C.secondsAt(song,song.measures[report.settings.from-1].start,report.settings.tempo)+Math.max(0,e.ms-report.settings.offset)/1000,report.settings.tempo);bar=song.measures.find(m=>b<m.end)?.index;}add(bar||report.settings.from,2,'extra');}
    const same=history.filter(r=>r.id!==report.id&&r.songId===song.id&&r.source===report.source&&!r.interrupted&&r.settings?.mode===report.settings.mode&&JSON.stringify(condition(r.settings))===JSON.stringify(condition(report.settings))).slice(0,3);
    for(const r of same){const repeated=new Set((r.result?.answers||[]).filter(a=>!a.correct||a.hint||r.result.onTime!==null&&!a.timing).map(a=>a.measure));for(const bar of repeated)if(bars.has(bar)){const row=bars.get(bar);row.weight+=3;row.previous=(row.previous||0)+1;}}
    const problems=[...bars.values()].sort((a,b)=>b.weight-a.weight||a.measure-b.measure),focus=problems[0],counts=problems.reduce((s,b)=>{for(const k of ['pitch','octave','timing','miss','hint','extra'])s[k]+=b[k];return s;},{pitch:0,octave:0,timing:0,miss:0,hint:0,extra:0});
    let code='steady',title='这段本次独立完成，稍后再检查',reason='把这一段接回相邻乐句，再检查撤掉帮助后的保持情况。';
    if(report.interrupted){code='interrupted';title='这轮有中断，保留原片段';reason='中断改变了练习条件，本轮不判断主要困难。';}
    else if(rows.length<4){code='observe';title='先完整练一小段，再判断困难';reason='已评估音数较少，先保留原片段继续观察。';}
    else if(counts.octave>=2){code='octave';title='先固定音区，检查八度位置';reason='有 '+counts.octave+' 次实际音与目标相差整八度；先在原小节认准，再返回原句。';}
    else if(counts.pitch+counts.octave>=2||counts.hint){code='pitch';title='先认准问题小节，再回原句';reason='有 '+(counts.pitch+counts.octave)+' 个错音目标、'+counts.hint+' 个提示目标。先撤去跟拍压力。';}
    else if(timed&&counts.timing+counts.extra>=2&&result.correct/Math.max(1,result.total)>=.8){code='timing';title='保持原句，单练起拍与等待';reason='大部分音高正确，起拍或多按仍不稳定；用同一小节练节奏后回原句检查。';}
    else if(counts.miss){code='chunk';title='缩短到问题小节，先读准';reason='未匹配起点可能有多种原因，先降低片段长度，暂不判断是识谱还是配合问题。';}
    else if(problems.length){code='observe';title='保留原片段，再观察一轮';reason='错误尚不足以稳定归因；问题位置已标出，保持条件检查。';}
    else if(report.assisted){code='observe';title='收起帮助，独立检查原片段';reason='本轮使用过键位或指法预读；先关闭提示，再检查能否独立完成。';}
    return {code,title,reason,problems,focus:focus?.measure||report.settings.from,counts};
  }
  function remedy(data,song,report,history=[]){
    const d=diagnosis(song,report,history),settings=C.settings(song,{...report.settings,from:d.focus,to:d.focus,mode:d.code==='timing'?'advanced':'beginner',tempo:d.code==='timing'?Math.max(20,Math.round(report.settings.tempo*.8)):report.settings.tempo,loop:false,drill:d.code==='timing'?'rhythm':''});
    const task={kind:'remedy',songId:song.id,source:report.source,settings,title:d.title,origin:C.settings(song,{...report.settings,loop:false,drill:''}),originTask:report.task?.kind==='route'?report.task:null};data.current[report.source]=task;return task;
  }
  function spelling(n){
    if(n.spelling&&/^[CDEFGAB]$/.test(n.spelling.step))return n.spelling;
    const names=[['C',0],['C',1],['D',0],['D',1],['E',0],['F',0],['F',1],['G',0],['G',1],['A',0],['B',-1],['B',0]],v=names[n.pitch%12];return {step:v[0],alter:v[1],octave:Math.floor(n.pitch/12)-1};
  }
  function hint(n,level=1,previous=null){
    const p=spelling(n),index=p.octave*7+'CDEFGAB'.indexOf(p.step),bass=n.sourceClef?n.sourceClef==='F':n.staff===2,landmarks=bass?[43,48,53,60]:[60,67,72,77];
    let ref=landmarks.map(pitch=>({pitch,index:(Math.floor(pitch/12)-1)*7+[0,2,4,5,7,9,11].indexOf(pitch%12)})).sort((a,b)=>Math.abs(a.index-index)-Math.abs(b.index-index))[0],known=false;
    if(previous&&previous.staff===n.staff&&!spelling(previous).alter){const p=spelling(previous),i=p.octave*7+'CDEFGAB'.indexOf(p.step);if(Math.abs(i-index)<=4&&Math.abs(i-index)<Math.abs(ref.index-index)){ref={pitch:previous.pitch,index:i};known=true;}}
    const delta=index-ref.index,steps=Math.abs(delta),bottom=bass?18:30,acc=p.alter>0?'升'+(p.alter>1?'两':'一')+'个半音':p.alter<0?'降'+(p.alter< -1?'两':'一')+'个半音':'自然音位置',answer=p.step+(p.alter>0?'♯'.repeat(p.alter):p.alter<0?'♭'.repeat(-p.alter):'')+p.octave;
    const offset=index-bottom,pos=offset<0?'谱表下方'+(-offset%2?'间':'加线'):offset>8?'谱表上方'+(offset%2?'间':'加线'):offset%2?'第 '+((offset+1)/2)+' 间':'第 '+(offset/2+1)+' 线';
    const texts=[(bass?'先看低音谱表。':'先看高音谱表。')+(known?'刚才弹对的参照音':'附近参照音')+'是 '+C.pitchName(ref.pitch)+'，先确认音区，再看目标在线上还是间内。',delta?'从参照向'+(delta>0?'上':'下')+'走 '+steps+' 个相邻线间位置；'+(steps===1?'相邻一步':steps===2?'跳过一个位置':steps===7?'相隔一个八度':'逐个经过线和间')+'。'+(p.alter?'再根据记号'+acc+'。':''):'目标与参照在同一个线间位置。'+(p.alter?'根据记号'+acc+'。':''),'答案：'+answer+'，'+pos+'。'+(n.transpose?'移调后实际弹 '+C.pitchName(n.pitch)+'。':'')+'先记位置，稍后收起提示再认。'];
    return {level:Math.min(3,Math.max(1,level)),reference:ref.pitch,referenceOffset:ref.index-bottom,targetOffset:offset,steps,delta,bass,answer,pitch:n.pitch,alter:p.alter,text:texts.slice(0,Math.min(3,level)).join(' ')};
  }
  return Object.freeze({defaults,normalize,analyze,plan,next,stages,observe,due,review,diagnosis,remedy,hint,clean,memoryKey,condition,STAGES});
})();
if(typeof globalThis!=='undefined')globalThis.SongLearning=SongLearning;
if(typeof module!=='undefined')module.exports=SongLearning;
