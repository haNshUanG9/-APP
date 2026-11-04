/* Complete-bar rhythm exercises and separate onset / duration records. */
'use strict';
const RhythmCore = (() => {
  const MODES=['pulse','subdivision','hold','pattern','echo','dual'];
  const LABELS={pulse:'稳拍训练',subdivision:'八分细分',hold:'时值与休止',pattern:'节奏型专项',echo:'听后模仿',dual:'双手节奏'};
  const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),n=b.length;return n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2;};
  const defaults=()=>({version:3,settings:{course:'progressive',lessonUnit:0,lessonPhase:0,input:'touch',mode:'hold',meter:'4/4',level:1,tempo:60,bars:2,counting:true,metronome:true,metroMeter:'4/4',metroBpm:60,metroSubdivision:1,metroAccent:true,fade:false,adaptive:true,offset:0},profiles:{},reports:[]});
  function settings(raw={}) {
    if(!raw||typeof raw!=='object')raw={};
    const s={...defaults().settings};
    s.input=raw.input==='midi'?'midi':'touch';s.course=raw.course==='free'?'free':'progressive';s.lessonUnit=Number.isInteger(raw.lessonUnit)&&raw.lessonUnit>=0&&raw.lessonUnit<=6?raw.lessonUnit:0;s.lessonPhase=Number.isInteger(raw.lessonPhase)&&raw.lessonPhase>=0&&raw.lessonPhase<=3?raw.lessonPhase:0;
    s.lessonPattern=Number.isInteger(raw.lessonPattern)&&raw.lessonPattern>=0?raw.lessonPattern:0;s.courseRevision=Number.isInteger(raw.courseRevision)&&raw.courseRevision>=0?raw.courseRevision:0;
    if(MODES.includes(raw.mode))s.mode=raw.mode;
    if(['2/4','3/4','4/4'].includes(raw.meter))s.meter=raw.meter;
    if([1,2,3].includes(raw.level))s.level=raw.level;
    if(Number.isInteger(raw.tempo)&&raw.tempo>=30&&raw.tempo<=240)s.tempo=raw.tempo;
    if([1,2,4].includes(raw.bars))s.bars=raw.bars;
    for(const k of ['counting','metronome','fade','adaptive'])if(typeof raw[k]==='boolean')s[k]=raw[k];
    if(['2/4','3/4','4/4'].includes(raw.metroMeter))s.metroMeter=raw.metroMeter;
    if(Number.isInteger(raw.metroBpm)&&raw.metroBpm>=30&&raw.metroBpm<=240)s.metroBpm=raw.metroBpm;else s.metroBpm=s.tempo;
    if([1,2,4].includes(raw.metroSubdivision))s.metroSubdivision=raw.metroSubdivision;
    if(typeof raw.metroAccent==='boolean')s.metroAccent=raw.metroAccent;
    if(Number.isFinite(raw.offset))s.offset=Math.max(-250,Math.min(250,Math.round(raw.offset)));
    if(s.mode==='pulse')s.level=1;
    if(s.mode==='subdivision')s.level=2;
    return s;
  }
  const barBeats=s=>Number(s.meter[0]);
  const context=s=>[s.mode,s.meter,s.level,s.tempo,s.counting?'count':'hidden',s.metronome?'metro':'silent',s.fade?'fade':'full',s.offset].join('|')+(s.input==='midi'?'|midi':'');
  const profileKey=(s,id)=>context(s)+'|'+id;
  function templates(beats,level) {
    const fill=n=>Array.from({length:n},()=>1);
    const list=[fill(beats),[2,...fill(beats-2)],[...fill(beats-2),2],[-1,...fill(beats-1)],[1,-1,...fill(beats-2)]];
    if(beats===4)list.push([4],[2,-2],[-2,2],[1,2,1]);
    if(beats===3)list.push([1,2],[2,-1]);
    if(level>=2)list.push([.5,.5,...fill(beats-1)],[1,.5,.5,...fill(beats-2)],[.5,-.5,...fill(beats-1)],[-.5,.5,...fill(beats-1)],[...fill(beats-1),.5,.5],Array.from({length:beats*2},()=>.5));
    if(level>=3)list.push([1.5,.5,...fill(beats-2)],[.5,1.5,...fill(beats-2)],[1.5,-.5,...fill(beats-2)]);
    /* Combine beat-sized motifs, then sample the larger grammar evenly. */
    const cells=[[1],[-1],[2],[-2]];
    if(beats===4)cells.push([4]);
    if(level>=2)cells.push([.5,.5],[.5,-.5],[-.5,.5]);
    if(level>=3)cells.push([1.5,.5],[.5,1.5],[1.5,-.5]);
    const variants=[];
    function compose(left,a){
      if(left===0){if(a.some(v=>v>0))variants.push(a);return;}
      for(const cell of cells){const length=cell.reduce((n,v)=>n+Math.abs(v),0);if(length>left||a.length+cell.length>8||a.length&&a[a.length-1]<0&&cell[0]<0)continue;compose(left-length,[...a,...cell]);}
    }
    compose(beats,[]);
    const slots=Math.min(80,variants.length);for(let i=0;i<slots;i++)list.push(variants[Math.floor(i*variants.length/slots)]);
    if(level>1)list.push(...templates(beats,level-1).map(t=>t.values));
    const seen=new Set();return list.filter(a=>{const k=a.join(',');if(seen.has(k))return false;seen.add(k);return true;}).map(a=>({id:a.join('_'),values:a}));
  }
  function weighted(pool,s,d,random) {
    const ws=pool.map(p=>{const xs=d.profiles?.[profileKey(s,p.id)]?.samples||[],bad=xs.slice(-6).filter(x=>!x.ok).length;return 1+(s.adaptive&&xs.length>=3?Math.min(4,bad):0);});
    let n=random()*ws.reduce((a,b)=>a+b,0);for(let i=0;i<ws.length;i++){n-=ws[i];if(n<0)return pool[i];}return pool[pool.length-1];
  }
  const COURSE_LABELS=['稳定四分起点','四分与二分','小节末等待','中间休止再进入','八分细分','半拍休止','附点与八分'];
  const PHASE_LABELS=['固定型连续重复','同型无数拍','加入已学节奏','交替巩固检查'];
  const BANK={
    '2/4':{
      0:[[1,1]],
      1:[[2]],
      2:[[1,-1]],
      3:[[-1,1]],
      4:[[1,.5,.5],[.5,.5,1],[.5,.5,.5,.5]],
      5:[[1,-.5,.5],[.5,-.5,1]],
      6:[[1.5,.5],[.5,1.5]]
    },
    '3/4':{
      0:[[1,1,1]],
      1:[[2,1],[1,2]],
      2:[[1,1,-1],[2,-1]],
      3:[[1,-1,1],[-1,1,1]],
      4:[[1,.5,.5,1],[.5,.5,1,1],[.5,.5,.5,.5,.5,.5]],
      5:[[1,-.5,.5,1],[.5,-.5,1,1]],
      6:[[1.5,.5,1],[1,1.5,.5],[.5,1.5,1]]
    },
    '4/4':{
      0:[[1,1,1,1]],
      1:[[2,1,1],[1,2,1],[1,1,2],[2,2],[4]],
      2:[[1,1,1,-1],[2,1,-1],[1,2,-1]],
      3:[[1,-1,1,1],[1,1,-1,1],[2,-1,1],[1,-1,2]],
      4:[[1,.5,.5,1,1],[1,1,.5,.5,1],[.5,.5,1,.5,.5,1],[.5,.5,.5,.5,.5,.5,.5,.5]],
      5:[[1,-.5,.5,1,1],[1,1,-.5,.5,1],[2,-.5,.5,1],[1,.5,-.5,1,1]],
      6:[[1.5,.5,1,1],[1,1.5,.5,1],[1.5,.5,2]]
    }
  };
  const patternSignature=values=>values.join(',');
  function pattern(meter,unit,index,values){
    const oldEighth={'2/4':[1,2,0],'3/4':[1,2,0],'4/4':[1,3,2,0]};
    const oldIndex=unit===4?oldEighth[meter][index]:meter==='2/4'&&unit===3?1:index;
    return {id:`${meter.replace('/','_')}-u${unit}-${oldIndex}`,signature:patternSignature(values),values:[...values],unit,meter};
  }
  function bankPatterns(meter,unit){return (BANK[meter]?.[unit]||[]).map((v,i)=>pattern(meter,unit,i,v));}
  function courseCatalog(s){
    const meter=s.meter||'4/4';
    return COURSE_LABELS.map((title,unit)=>({unit,title,patterns:bankPatterns(meter,unit)}));
  }
  function courseValues(beats,unit){
    const meter=beats===2?'2/4':beats===3?'3/4':'4/4';
    return bankPatterns(meter,unit)[0]?.values||Array.from({length:beats},()=>1);
  }
  function coursePool(s){
    const unit=s.mode==='pulse'?0:s.mode==='subdivision'?4:Math.min(6,s.lessonUnit),catalog=courseCatalog(s),focus=catalog[unit]?.patterns||[],index=Math.min(s.lessonPattern||0,focus.length-1),first=focus[index],old=catalog.slice(s.mode==='subdivision'?4:0,unit).flatMap(x=>x.patterns).concat(focus.slice(0,index)),previous=old[old.length-1]||first;
    const shifted=first?.values.slice(1).concat(first.values[0]),variant=shifted&&JSON.stringify(shifted)!==JSON.stringify(first.values)?{id:'transfer-'+patternSignature(shifted),values:shifted}:previous;
    return {first,old:previous,variant,focus,oldPool:old,catalog,unit};
  }
  const courseProgressKey=s=>[s.mode,s.meter,s.input||'touch'].join('|');
  const courseProgressEvidenceKey=s=>[s.tempo,s.metronome?'metro':'silent',s.fade?'fade':'full',s.offset].join('|');
  function courseProgressState(db,s){
    const key=courseProgressKey(s);if(db[key])return {...db[key],evidence:{...db[key].evidence}};
    const legacy=Object.entries(db).filter(([k])=>{const a=k.split('|');return a.length===6&&a[0]===s.mode&&a[1]===s.meter&&a[5]===(s.input||'touch');}).sort((a,b)=>b[1].unit-a[1].unit||b[1].phase-a[1].phase);
    const p=legacy[0]?.[1],evidence={};for(const [k,v] of legacy){const a=k.split('|'),ek=[a[2],a[3],'full',a[4]].join('|');evidence[ek]=Math.max(evidence[ek]||0,v.clean||0);}
    return {unit:p?.unit??(s.mode==='subdivision'?4:0),pattern:0,phase:p?.phase||0,clean:p?.clean||0,revision:1,evidence,completed:false};
  }
  function courseProgressAdvance(state,s,exercise,passed){
    const current=exercise?.settings,match=current&&current.lessonUnit===state.unit&&current.lessonPattern===state.pattern&&current.lessonPhase===state.phase&&current.courseRevision===state.revision&&!state.completed;
    if(!passed||!match)return null;
    state={...state,evidence:{...state.evidence}};
    const key=courseProgressEvidenceKey(s);state.evidence[key]=(state.evidence[key]||0)+1;state.clean=(state.clean||0)+1;state.revision++;
    if(state.phase<3)state.phase++;else{state.phase=0;const count=bankPatterns(s.meter,state.unit).length;if(state.pattern+1<count)state.pattern++;else if(!['pulse','subdivision'].includes(s.mode)&&state.unit<6){state.unit++;state.pattern=0;}else{state.completed=true;state.pattern=Math.max(0,count-1);state.phase=3;}}
    return state;
  }
  function generate(raw,d=defaults(),random=Math.random) {
    const s=settings(raw),beats=barBeats(s),events=[],bars=[];if(s.course==='progressive'){s.bars=4;s.level=s.lessonUnit>=6?3:s.lessonUnit>=4?2:1;s.counting=s.lessonPhase===0;}const course=coursePool(s);
    for(let b=0;b<s.bars;b++) {
      let pool=templates(beats,s.level);
      if(s.mode==='pulse')pool=[{id:'pulse',values:Array.from({length:beats},()=>1)}];
      if(s.mode==='subdivision')pool=[{id:'eighths',values:Array.from({length:beats*2},()=>.5)}];
      if(pool.length>1&&bars.length)pool=pool.filter(p=>p.id!==bars[bars.length-1].id);
      let p;if(s.course==='progressive'){
        if(s.lessonPhase<2)p=course.first;
        else if(s.lessonPhase===2)p=b%2?course.old:course.first;
        else p=b===2?course.variant:course.first;
      }else p=weighted(pool,s,d,random);
      p=p||course.first;const start=b*beats;
      bars.push({index:b,id:p.id,unit:course.unit,phase:s.lessonPhase,title:COURSE_LABELS[course.unit]});let at=start;
      p.values.forEach(v=>{events.push({beat:at,duration:Math.abs(v),rest:v<0,lane:s.mode==='dual'?'right':'main',bar:b,pattern:p.id});at+=Math.abs(v);});
      if(s.mode==='dual'){
        const span=beats===4?4:2;events.push({beat:start,duration:span,rest:false,lane:'left',bar:b,pattern:p.id});
        if(beats>span)events.push({beat:start+span,duration:beats-span,rest:true,lane:'left',bar:b,pattern:p.id});
      }
    }
    events.sort((a,b)=>a.beat-b.beat||a.lane.localeCompare(b.lane));
    return {settings:s,events,bars,totalBeats:beats*s.bars};
  }
  const isHold=s=>['hold','dual','echo'].includes(s.mode);
  function evaluate(ex,inputs,complete=true,visitedMs=Infinity) {
    const s=ex.settings,beatMs=60000/s.tempo,used=new Set(),answers=[];
    const events=ex.events.filter(e=>!e.rest && (complete||e.beat*beatMs<visitedMs));
    events.forEach(e=>{
      const gaps=events.filter(x=>x.lane===e.lane&&x.beat!==e.beat).map(x=>Math.abs(x.beat-e.beat)*beatMs),window=Math.min(beatMs*.32,...gaps.map(g=>g*.42));
      const candidates=inputs.map((p,i)=>({p,i,delta:p.down-s.offset-e.beat*beatMs})).filter(x=>!used.has(x.i)&&x.p.lane===e.lane&&Math.abs(x.delta)<=window).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta));
      const match=candidates[0];if(match)used.add(match.i);
      const p=match?.p,interrupted=!!p?.cancelled;
      const durationDelta=isHold(s)&&p&&!interrupted&&p.up!==null?p.up-p.down-e.duration*beatMs:null;
      const tolerance=Math.max(90,Math.min(beatMs*.25,e.duration*beatMs*.22));
      answers.push({beat:e.beat,duration:e.duration,lane:e.lane,bar:e.bar,pattern:e.pattern,input:match?match.i:null,delta:match?match.delta:null,durationDelta,interrupted,hit:!!match&&!interrupted,hold:isHold(s)?!interrupted&&durationDelta!==null&&Math.abs(durationDelta)<=tolerance:null,window,tolerance});
    });
    const extras=inputs.map((p,i)=>({...p,input:i})).filter(p=>!used.has(p.input)&&!p.cancelled&&p.down-s.offset>=-beatMs*.32&&p.down-s.offset<Math.min(ex.totalBeats*beatMs,visitedMs));
    const a=answers.filter(x=>!x.interrupted),matched=a.filter(x=>x.hit),deltas=matched.map(x=>x.delta),center=median(deltas),holds=a.filter(x=>x.durationDelta!==null);
    let drift=null;if(matched.length>=6){const meanX=matched.reduce((n,x)=>n+x.beat,0)/matched.length,meanY=deltas.reduce((n,x)=>n+x,0)/deltas.length;const den=matched.reduce((n,x)=>n+(x.beat-meanX)**2,0);if(den>0)drift=matched.reduce((n,x)=>n+(x.beat-meanX)*(x.delta-meanY),0)/den;}
    const restExtras=extras.filter(p=>ex.events.some(e=>e.rest&&e.lane===p.lane&&p.down-s.offset>=(e.beat+.15)*beatMs&&p.down-s.offset<(e.beat+e.duration-.1)*beatMs)).length;
    return {answers,extras,metrics:{seen:a.length,hit:matched.length,onTime:matched.filter(x=>Math.abs(x.delta)<=beatMs*.18).length,missed:a.filter(x=>!x.hit).length,interrupted:answers.length-a.length,extras:extras.length,restExtras,medianOffset:center,medianAbs:median(deltas.map(Math.abs)),jitter:center===null?null:median(deltas.map(x=>Math.abs(x-center))),drift,holds:holds.length,holdCorrect:holds.filter(x=>x.hold).length,short:holds.filter(x=>x.durationDelta < -x.tolerance).length,long:holds.filter(x=>x.durationDelta>x.tolerance).length,durationAbs:median(holds.map(x=>Math.abs(x.durationDelta)))}};
  }
  function observe(d,report) {
    if(report.paused||report.hint||!report.result.metrics.seen)return;
    const beatMs=60000/report.settings.tempo,visited=report.complete?Infinity:report.visitedMs;
    report.exercise.bars.filter(b=>(b.index+1)*barBeats(report.settings)*beatMs<=visited).forEach(b=>{
      const all=report.result.answers.filter(x=>x.bar===b.index);if(all.some(x=>x.interrupted))return;const a=all.filter(x=>!x.interrupted);if(!a.length)return;
      const extra=report.result.extras.some(p=>Math.floor(Math.max(0,p.down-report.settings.offset)/beatMs/barBeats(report.settings))===b.index);
      const ok=!extra&&a.every(x=>x.hit&&Math.abs(x.delta)<=beatMs*.18&&(x.hold===null||x.hold));
      const key=profileKey(report.settings,b.id),p=d.profiles[key]||(d.profiles[key]={mode:report.settings.mode,meter:report.settings.meter,id:b.id,samples:[]});
      p.samples.push({ok,at:report.at});p.samples=p.samples.slice(-12);
    });
    const keys=Object.keys(d.profiles);if(keys.length>500)keys.sort((a,b)=>(d.profiles[a].samples.slice(-1)[0]?.at||0)-(d.profiles[b].samples.slice(-1)[0]?.at||0)).slice(0,keys.length-500).forEach(k=>delete d.profiles[k]);
  }
  function recommendations(report) {
    const m=report.result.metrics,s=report.settings,out=[];
    if(m.restExtras)out.push({label:'休止处出现多按，先练等待后再进入。',mode:'hold',level:1});
    if(m.short)out.push({label:'长音提前松开，练按住到时值结束。',mode:'hold',level:s.level});
    if(m.long)out.push({label:'长音结束后仍在延续，练松键和休止。',mode:'hold',level:s.level});
    if(m.hit>=4&&m.medianOffset!==null&&Math.abs(m.medianOffset)>60000/s.tempo*.12)out.push({label:m.medianOffset<0?'匹配到的起点多偏早，练等拍进入。':'匹配到的起点多偏晚，练跟拍进入。',mode:'pulse',level:1});
    if(m.drift!==null&&Math.abs(m.drift)>15)out.push({label:m.drift>0?'起点逐渐偏晚，练稳拍。':'起点逐渐偏早，练稳拍。',mode:'pulse',level:1});
    if(m.missed||m.extras)out.push({label:s.mode==='dual'?'双声部有漏按或多按，降低速度再合练。':'先放慢速度，检查起点和休止。',mode:s.mode,level:s.level});
    if(s.mode==='subdivision'&&m.jitter!==null&&m.jitter>60000/s.tempo*.1)out.push({label:'八分起点不够均匀，打开数拍再练。',mode:'subdivision',level:2});
    if(!out.length)out.push({label:m.seen>=8?'这一段较稳定，换新题检查。':'这一段样本较少，换新题继续观察。',mode:s.mode,level:s.level});
    return out.slice(0,3);
  }
  function validExercise(ex) {return ex&&Array.isArray(ex.events)&&ex.events.length<=100&&ex.events.every(e=>Number.isFinite(e.beat)&&e.beat>=0&&e.beat<16&&[.5,1,1.5,2,4].includes(e.duration)&&typeof e.rest==='boolean'&&['main','left','right'].includes(e.lane)&&Number.isInteger(e.bar)&&e.bar>=0&&e.bar<4&&typeof e.pattern==='string'&&e.pattern.length<60)&&Array.isArray(ex.bars)&&ex.bars.length<=4&&ex.bars.every(b=>Number.isInteger(b.index)&&typeof b.id==='string'&&b.id.length<60)&&Number.isFinite(ex.totalBeats)&&ex.totalBeats>0&&ex.totalBeats<=16;}
  function normalizePhraseOrigin(raw){
    if(!raw||typeof raw!=='object'||!raw.settings||typeof raw.settings!=='object'||typeof globalThis.StudyCore?.validStoredExercise!=='function')return null;
    const exercise=globalThis.StudyCore.validStoredExercise(raw.exercise);if(!exercise||!exercise.events.length||exercise.events.some(e=>e.beat+e.duration>exercise.totalBeats||e.voices.some(v=>e.beat+v.duration>exercise.totalBeats||v.targets.some(t=>t.note.index<14||t.note.index>48))))return null;
    const source=raw.settings,settings={},enums={clef:['treble','bass','mixed','dual'],input:['touch','midi'],course:['free','progressive'],difficulty:['beginner','basic','extended'],pattern:['steps','repeat','thirds','mixed'],flow:['guided','continuous','assessment'],dual:['alternate','sustain','together']};
    for(const [key,allowed] of Object.entries(enums))if(allowed.includes(source[key]))settings[key]=source[key];
    for(const [key,lo,hi] of [['notes',1,15],['count',1,120],['rhythm',1,2],['tempo',30,240]])if(Number.isInteger(source[key])&&source[key]>=lo&&source[key]<=hi)settings[key]=source[key];
    for(const key of ['hints','metronome','keyboardFull','keyboardChanged'])if(typeof source[key]==='boolean')settings[key]=source[key];
    if(!settings.flow)return null;
    return {exercise,settings};
  }
  function normalize(raw) {
    const d=defaults();if(!raw||typeof raw!=='object')return d;d.settings=settings(raw.settings);
    Object.keys(raw.profiles||{}).slice(0,500).forEach(k=>{const p=raw.profiles[k];if(k.length>160||!k.includes('|')||!/^[a-z0-9|_./-]+$/i.test(k)||!p||!MODES.includes(p.mode)||!['2/4','3/4','4/4'].includes(p.meter)||typeof p.id!=='string'||p.id.length>60)return;d.profiles[k]={mode:p.mode,meter:p.meter,id:p.id,samples:(Array.isArray(p.samples)?p.samples:[]).filter(x=>x&&typeof x.ok==='boolean'&&Number.isFinite(x.at)).slice(-12)};});
    d.reports=(Array.isArray(raw.reports)?raw.reports:[]).filter(r=>r&&typeof r.id==='string'&&r.id.length<60&&Number.isFinite(r.at)&&validExercise(r.exercise)&&Array.isArray(r.inputs)&&r.inputs.length<=400&&r.inputs.every(p=>p&&Number.isFinite(p.down)&&p.down>=-4000&&p.down<30000&&['main','left','right'].includes(p.lane)&&(p.up===null||Number.isFinite(p.up)&&p.up>=p.down&&p.up<40000))&&typeof r.complete==='boolean').slice(-60).map(r=>{const s=settings(r.settings),exercise={...r.exercise,settings:s,phraseOrigin:normalizePhraseOrigin(r.exercise.phraseOrigin)},inputs=r.inputs.map(p=>({...p,cancelled:p.cancelled===true})),visitedMs=Number.isFinite(r.visitedMs)?Math.max(0,r.visitedMs):0;return {id:r.id,at:r.at,settings:s,exercise,inputs,complete:r.complete,paused:r.paused===true,hint:r.hint===true,courseResult:r.courseResult&&typeof r.courseResult.passed==='boolean'?{passed:r.courseResult.passed,unit:r.courseResult.unit,pattern:r.courseResult.pattern,phase:r.courseResult.phase,completed:r.courseResult.completed===true}:undefined,visitedMs,result:evaluate(exercise,inputs,r.complete,visitedMs)};});
    return d;
  }
  return Object.freeze({MODES,LABELS,COURSE_LABELS,PHASE_LABELS,BANK,patternSignature,bankPatterns,courseCatalog,courseValues,coursePool,courseProgressKey,courseProgressEvidenceKey,courseProgressState,courseProgressAdvance,normalizePhraseOrigin,defaults,settings,barBeats,context,profileKey,templates,generate,isHold,evaluate,observe,recommendations,normalize,median});
})();
if(typeof globalThis!=='undefined')globalThis.RhythmCore=RhythmCore;
