/* Course state owns sequencing, evidence and migration; views never award mastery. */
'use strict';
const FoundationCore=(()=>{
 const B=typeof FoundationBank==='undefined'?require('./foundation-bank.js'):FoundationBank;
 const LESSONS=B.LESSONS,N=LESSONS.length,SOURCES=['touch','midi'],PHASES=['demo','identify','listen','echo','read','perform','transfer','done'];
 const LABELS={demo:'认识新内容',identify:'独立认音',listen:'有参照听辨',echo:'听后跟弹',read:'先读准原句',perform:'同句慢速跟拍',transfer:'变化乐句检查',done:'路线完成'};
 const int=(n,max=100000)=>Number.isInteger(n)&&n>=0?Math.min(n,max):0;
 const copy=x=>JSON.parse(JSON.stringify(x)),key=t=>t.clef+':'+t.midi,validSource=s=>SOURCES.includes(s);
 const track=()=>({unit:0,phase:'demo',learning:Array(N).fill(0),independent:Array(N).fill(0),listening:Array(N).fill(0),listeningOrders:{},echo:Array(N).fill(0),recognition:{},sessions:{},passed:[],chosen:[],serial:0,retries:[],current:null,history:[],failures:0,echoFailures:0,difficulty:'',tempo:60,ticket:null,lastResult:null});
 const defaults=()=>({version:2,tracks:{touch:track(),midi:track()}}),lesson=t=>LESSONS[Math.min(t.unit,N-1)];
 function requirements(t){const l=lesson(t);return Object.fromEntries(l.pool.map(p=>[key(p),l.pool.length===1?2:l.newTarget&&key(p)===key(l.newTarget)?4:2]));}
 const learned=t=>t.recognition[lesson(t).id]||(t.recognition[lesson(t).id]={});
 const echoGoal=t=>lesson(t).pool.length===1?2:6;
 function validQuestion(q,t){
  const l=lesson(t);if(!q||q.unit!==t.unit||!['identify','listen','echo'].includes(q.kind)||!['treble','bass'].includes(q.clef))return false;
  if(q.kind==='identify')return l.pool.some(p=>p.midi===q.target&&p.clef===q.clef);
  if(q.kind==='listen')return l.listening.some(p=>p.reference===q.reference&&p.second===q.second&&p.clef===q.clef&&p.answer===q.answer);
  const valid=a=>Array.isArray(a)&&a.length>=1&&a.length<=5&&a.every(n=>l.pool.some(p=>p.midi===n&&p.clef===q.clef));
  return valid(q.sequence)&&(!q.fullSequence||valid(q.fullSequence));
 }
 function cleanQuestion(q,t,interrupted=false){
  if(!validQuestion(q,t))return null;const out={kind:q.kind,unit:t.unit,clef:q.clef,target:q.target,hinted:q.hinted===true||int(q.hintLevel)>0,failed:q.failed===true,interrupted:interrupted||q.interrupted===true,remedial:q.remedial===true,filler:q.filler===true,hintLevel:int(q.hintLevel,3),played:false,index:0};
  if(q.kind==='listen')Object.assign(out,{reference:q.reference,second:q.second,answer:q.answer});
  if(q.kind==='echo'){out.sequence=q.sequence.slice();if(q.fullSequence)out.fullSequence=q.fullSequence.slice();}
  if(Number.isInteger(q.firstMidi)&&q.firstMidi>=21&&q.firstMidi<=108)out.firstMidi=q.firstMidi;
  return out;
 }
 function normalize(raw){
  const d=defaults();if(!raw||typeof raw!=='object')return d;
  for(const source of SOURCES){const r=raw.tracks?.[source];if(!r||typeof r!=='object')continue;const t=d.tracks[source],legacy=raw.version!==2;
   t.unit=int(r.unit,N);t.phase=PHASES.includes(r.phase)?r.phase:'demo';if(legacy&&t.unit>=3){t.unit=2;t.phase='read';}if(t.unit===N)t.phase='done';else if(t.phase==='done')t.phase='demo';
   for(const field of ['learning','independent','listening','echo'])t[field]=Array.from({length:N},(_,i)=>int(r[field]?.[i],10000));
   for(const l of LESSONS){const order=r.listeningOrders?.[l.id];if(Array.isArray(order)&&order.length===l.listening.length&&new Set(order).size===order.length&&order.every(n=>Number.isInteger(n)&&n>=0&&n<order.length))t.listeningOrders[l.id]=order.slice();}
   for(const l of LESSONS){const row=r.recognition?.[l.id];if(row&&typeof row==='object')t.recognition[l.id]=Object.fromEntries(l.pool.map(p=>[key(p),int(row[key(p)],10000)]));}
   if(legacy){for(let i=0;i<Math.min(3,t.unit+1);i++){const l=LESSONS[i];t.recognition[l.id]=Object.fromEntries(l.pool.map(p=>[key(p),p.midi===l.newTarget?.midi?t.independent[i]:Math.min(t.independent[Math.max(0,i-1)],2)]));}}
   t.passed=(Array.isArray(r.passed)?r.passed:[]).filter(id=>LESSONS.some(l=>l.id===id)).slice(0,N);t.chosen=(Array.isArray(r.chosen)?r.chosen:[]).filter(id=>LESSONS.some(l=>l.id===id)).slice(0,N);
   t.serial=int(r.serial,1000000);t.failures=int(r.failures,99);t.echoFailures=int(r.echoFailures,99);t.tempo=[40,50,60,70,80].includes(r.tempo)?r.tempo:lesson(t).tempo;
   t.history=(Array.isArray(r.history)?r.history:[]).filter(e=>e&&['identify','listen','echo','read','perform','transfer'].includes(e.kind)&&typeof e.clean==='boolean'&&Number.isFinite(e.at)).slice(-120).map(e=>({kind:e.kind,clean:e.clean,reason:['octave','pitch','echo','hearing','timing','hint','interrupted'].includes(e.reason)?e.reason:'',at:e.at,unit:int(e.unit,N-1)}));
   const oldq=r.current&&{...r.current,clef:r.current.clef||'treble'};t.current=t.unit<N&&['identify','listen','echo'].includes(t.phase)?cleanQuestion(oldq,t,true):null;
   const normalizeRetries=(rows,context)=>(Array.isArray(rows)?rows:[]).filter(x=>x&&Number.isInteger(x.due)&&x.due>=0).slice(0,12).map(x=>{let rawq=x.question;if(legacy&&!rawq&&['identify','listen','echo'].includes(x.kind)){const l=lesson(context);rawq={kind:x.kind,unit:context.unit,clef:'treble',target:x.target};if(x.kind==='listen')Object.assign(rawq,l.listening.find(p=>p.reference===x.target)||l.listening[0]);if(x.kind==='echo')rawq.sequence=Array.isArray(x.sequence)?x.sequence:l.echoes[0];}const q=cleanQuestion(rawq,context);return q?{due:Math.min(x.due,t.serial+3),question:q}:null;}).filter(Boolean);
   t.retries=normalizeRetries(r.retries,t);
   for(const l of LESSONS){const s=r.sessions?.[l.id];if(!s||!PHASES.slice(0,7).includes(s.phase))continue;const context={...t,unit:l.index};t.sessions[l.id]={phase:s.phase,current:['identify','listen','echo'].includes(s.phase)?cleanQuestion(s.current,context,true):null,retries:normalizeRetries(s.retries,context),tempo:[40,50,60,70,80].includes(s.tempo)?s.tempo:l.tempo,lastResult:null};}
   t.lastResult=r.lastResult&&['read','perform','transfer'].includes(r.lastResult.stage)?{stage:r.lastResult.stage,passed:r.lastResult.passed===true,reason:String(r.lastResult.reason||'').slice(0,220)}:null;
  }return d;
 }
 function select(t,index){if(!Number.isInteger(index)||index<0||index>=N)return false;if(index===t.unit)return true;if(t.unit<N){if(t.current)t.current.interrupted=true;t.sessions[lesson(t).id]=copy({phase:t.phase,current:t.current,retries:t.retries,tempo:t.tempo,lastResult:t.lastResult});}t.ticket=null;t.unit=index;const saved=t.sessions[lesson(t).id];t.current=saved?.current||null;t.retries=saved?.retries||[];t.phase=saved?.phase||'demo';t.failures=t.echoFailures=0;t.lastResult=saved?.lastResult||null;t.tempo=saved?.tempo||LESSONS[index].tempo;if(!t.chosen.includes(LESSONS[index].id))t.chosen.push(LESSONS[index].id);return true;}
 function demo(t,skip=false){if(t.phase!=='demo'||t.unit>=N)return;t.learning[t.unit]+=skip?0:1;t.phase='identify';t.current=null;}
 function make(t,random=Math.random){
  if(t.current||!['identify','listen','echo'].includes(t.phase))return t.current;
  const l=lesson(t),retry=t.retries.find(x=>x.due<=t.serial),waiting=!!t.retries.length&&!retry;
  if(retry){t.retries.splice(t.retries.indexOf(retry),1);t.current=cleanQuestion({...retry.question,hinted:false,failed:false,interrupted:false,hintLevel:0,remedial:false},t);if(t.current?.fullSequence){t.current.sequence=t.current.fullSequence.slice();delete t.current.fullSequence;}return t.current;}
  const kind=waiting?'identify':t.phase;let q={kind,unit:t.unit,clef:l.pool[0].clef,target:l.pool[0].midi,hinted:false,failed:false,interrupted:false,remedial:false,filler:waiting,hintLevel:0,played:false,index:0};
  if(kind==='identify'){
   const counts=learned(t),req=requirements(t),remaining=l.pool.filter(p=>(counts[key(p)]||0)<req[key(p)]),pool=remaining.length?remaining:l.pool;
   let options=pool;const previous=t.lastTarget;if(pool.length>1)options=pool.filter(p=>key(p)!==previous);const n=Math.min(options.length-1,Math.floor(Math.max(0,Math.min(.99999,Number(random())||0))*options.length)),p=options[n];q.clef=p.clef;q.target=p.midi;t.lastTarget=key(p);
  }else if(kind==='listen'){
   t.listeningOrders=t.listeningOrders||{};let order=t.listeningOrders[l.id];
   if(!order){order=l.listening.map((_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.min(i,Math.floor(Math.max(0,Math.min(.99999,Number(random())||0))*(i+1)));[order[i],order[j]]=[order[j],order[i]];}t.listeningOrders[l.id]=order;}
   const p=l.listening[order[t.listening[t.unit]%order.length]];Object.assign(q,p,{target:p.reference});
  }
  else {const full=l.echoes[t.echo[t.unit]%l.echoes.length].slice();q.clef=l.echoClef;q.target=full[0];if(t.echoFailures>=2){q.sequence=full.slice(0,1);q.fullSequence=full;q.remedial=true;}else q.sequence=full;}
  t.current=q;return q;
 }
 function hint(t,level=1){if(t.current){t.current.hinted=true;t.current.hintLevel=Math.min(3,Math.max(t.current.hintLevel||0,level));}}
 function fail(t,reason='pitch'){const q=t.current;if(!q)return;q.failed=true;hint(t,1);q.reason=reason==='octave'?'octave':q.kind==='listen'?'hearing':q.kind==='echo'?'echo':reason;t.failures=Math.min(99,t.failures+1);if(q.kind==='echo')t.echoFailures=Math.min(99,t.echoFailures+1);}
 function interrupt(t){if(t.current)t.current.interrupted=true;t.ticket=null;}
 function shorten(t){const q=t.current;if(q?.kind!=='echo'||q.sequence.length<2)return;q.fullSequence=q.sequence.slice();q.sequence=q.sequence.slice(0,1);q.remedial=true;q.played=false;q.index=0;}
 function finish(t){
  const q=t.current;if(!q)return false;const clean=!q.hinted&&!q.failed&&!q.interrupted&&!q.remedial;
  if(!q.filler){t.history.push({kind:q.kind,unit:t.unit,clean,reason:q.interrupted?'interrupted':q.reason||(!clean?'hint':''),at:Date.now()});t.history=t.history.slice(-120);}
  if(clean&&!q.filler){if(q.kind==='identify'){const row=learned(t);row[key({clef:q.clef,midi:q.target})]=(row[key({clef:q.clef,midi:q.target})]||0)+1;t.independent[t.unit]++;}else if(q.kind==='listen')t.listening[t.unit]++;else{t.echo[t.unit]++;t.echoFailures=0;}}
  if(!clean&&!q.filler&&!t.retries.some(r=>r.question.kind===q.kind&&r.question.target===q.target)&&t.retries.length<12){const next=cleanQuestion(q,t);next.hinted=next.failed=next.interrupted=false;next.hintLevel=0;t.retries.push({due:t.serial+3,question:next});}
  t.serial++;t.current=null;
  if(!t.retries.length){if(t.phase==='identify'&&Object.entries(requirements(t)).every(([k,n])=>(learned(t)[k]||0)>=n))t.phase='listen';else if(t.phase==='listen'&&t.listening[t.unit]>=lesson(t).listening.length)t.phase='echo';else if(t.phase==='echo'&&t.echo[t.unit]>=echoGoal(t))t.phase='read';}
  return clean;
 }
 function ticket(t,source){if(!['read','perform','transfer'].includes(t.phase))return null;const l=lesson(t),piece=l.pieces[t.phase==='transfer'?1:0];t.ticket={id:l.id,unit:t.unit,stage:t.phase,source:validSource(source)?source:'touch',serial:++t.serial,piece:piece.id};return copy(t.ticket);}
 function normalizeAttempt(a){if(!a||!Number.isInteger(a.unit)||a.unit<0||a.unit>=N||a.id!==LESSONS[a.unit].id||!['read','perform','transfer'].includes(a.stage)||!validSource(a.source)||!Number.isInteger(a.serial)||a.serial<1||a.serial>1000001||a.piece!==LESSONS[a.unit].pieces[a.stage==='transfer'?1:0].id)return null;return {id:a.id,unit:a.unit,stage:a.stage,source:a.source,serial:a.serial,piece:a.piece};}
 function exercise(t,stage=t.phase){return B.exercise(lesson(t).pieces[stage==='transfer'?1:0]);}
 function accept(t,report){
  const attempt=normalizeAttempt(report.settings?.foundationAttempt),expected=t.ticket;if(!attempt||!expected||expected.unit!==t.unit||expected.stage!==t.phase||Object.keys(expected).some(k=>attempt[k]!==expected[k])||report.settings.input!==expected.source)return null;
  t.ticket=null;const wanted=exercise(t,expected.stage),signature=ex=>JSON.stringify((ex?.events||[]).map(e=>[e.beat,e.duration,e.rest,(e.targets||[]).map(p=>[p.clef,p.note.midi])])),a=report.answers||[],timed=expected.stage!=='read',count=wanted.events.reduce((n,e)=>n+e.targets.length,0);
  const passed=report.complete&&!report.paused&&a.length===count&&a.every(v=>v.correct&&!v.hint)&&!(report.extras||[]).length&&signature(report.exercise)===signature(wanted)&&report.flow===(timed?'continuous':'guided')&&[40,50,60,70,80].includes(report.settings.tempo)&&report.settings.tempo===t.tempo&&(!timed||a.every(v=>Number.isFinite(v.delta)&&Math.abs(v.delta)<=60000/report.settings.tempo*.22));
  const wrong=a.filter(v=>Number.isInteger(v.actual)&&!v.correct).length,missed=a.filter(v=>v.actual===null).length,hints=a.some(v=>v.hint),reason=report.paused?'这轮有中断，原句和阶段已保留。':!report.complete?'尚未完整完成，保留这一句。':wrong?'先认准这句的错音，再回到原句。':hints?'这轮有提示；收起提示再独立检查。':missed?'有起点没有按到；放慢速度，先把起拍和等待练稳。':!passed?'音高已经对上，先把这一句的起拍练稳。':'本阶段独立完成。';
  const result={stage:expected.stage,passed,reason};t.lastResult=result;t.history.push({kind:expected.stage,unit:t.unit,clean:passed,reason:report.paused?'interrupted':wrong?'pitch':hints?'hint':passed?'':'timing',at:Date.now()});t.history=t.history.slice(-120);
  if(passed){if(t.phase==='read')t.phase='perform';else if(t.phase==='perform')t.phase='transfer';else {if(!t.passed.includes(lesson(t).id))t.passed.push(lesson(t).id);t.unit++;t.phase=t.unit===N?'done':'demo';t.tempo=lesson(t).tempo;t.current=null;t.retries=[];}}
  return result;
 }
 function recommendation(state,source='touch'){
  const t=state?.tracks?.[validSource(source)?source:'touch']||track(),l=lesson(t),window=t.history.filter(e=>e.unit===t.unit).slice(-8),recent=window.slice(-3).length===3&&window.slice(-3).every(e=>e.clean)?[]:window.filter(e=>!e.clean&&e.reason!=='interrupted'),counts={};recent.forEach(e=>{counts[e.reason]=(counts[e.reason]||0)+1;});const reason=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  if(counts[reason]>=2){const advice={octave:['先定位八度','谱位已看见，先用中央 C 确认目标所在的八度。','查看键位'],pitch:['先对照参照线','看参照音到目标音经过了几次线与间，再独立回测。','展开谱位提示'],hearing:['先听方向，再记音名','哼唱第一个音，再比较第二音；这里判断相对方向。','重听参照'],echo:['先缩短，再还原整组','先跟一个音，回测仍使用完整音组。','缩短为单音'],timing:['音组不变，单练拍子','先数清起点与休止，再回到同一条乐句。','提取这一句节奏'],hint:['把提示逐层收起','提示帮助建立联系，之后需完成无提示检查。','独立回测']}[reason];if(advice)return {title:advice[0],detail:advice[1],action:advice[2]};}
  return {title:t.phase==='done'?'已走完基础路线':t.phase==='identify'?'独立认音检查':LABELS[t.phase],detail:t.phase==='done'?'回到学过的课检查保持情况，或继续已有的专项与短句。':t.phase==='demo'?l.concept:['read','perform','transfer'].includes(t.phase)?(t.phase==='read'?'先不限时读准这条乐句，遇到问题可展开提示。':t.phase==='perform'?'保持原音组和原句，数完四拍后跟拍完成。':'只用本课已学内容，读一条不同的乐句，检查能否应用。'):'看、听、弹分别记录；达到本课的独立目标后继续。',action:LABELS[t.phase]};
 }
 return {LESSONS,CHAPTERS:B.CHAPTERS,PHASES,LABELS,NOTES:LESSONS.map(l=>l.newTarget?.midi||l.pool[0].midi),NAMES:LESSONS.map(l=>l.title),defaults,normalize,validSource,lesson,requirements,learned,echoGoal,validQuestion,select,demo,make,hint,fail,interrupt,shorten,finish,ticket,normalizeAttempt,exercise,accept,recommendation};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=FoundationCore;
