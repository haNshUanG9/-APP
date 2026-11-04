/* Learning records, constrained phrase generation and beat-aligned evaluation. */
'use strict';
const StudyCore = (() => {
  const C = PianoCore;
  const DAY = 86400000;
  const natural = n => Number.isInteger(n) && n >= 21 && n <= 108 && C.SEMITONES.includes(n % 12);
  const keyValid = k => /^(treble|bass):[A-G][2-6]$/.test(k);
  const RC=typeof RhythmCore==='undefined'?null:RhythmCore;
  const defaults = () => ({version:3,ear:typeof EarCore==='undefined'?{}:EarCore.defaults(),foundation:typeof FoundationCore==='undefined'?{}:FoundationCore.defaults(),learning:typeof LearningCore==='undefined'?{}:LearningCore.defaults(),rhythm:RC?RC.defaults():{},notes:{},confusions:{},reports:[],settings:{clef:'treble',input:'touch',course:'progressive',difficulty:'basic',notes:6,count:20,pattern:'steps',rhythm:1,tempo:60,flow:'guided',dual:'alternate',hints:true,metronome:true}});
  function validStoredExercise(ex){
    if(!ex||!Array.isArray(ex.events)||ex.events.length>60||!Number.isFinite(ex.totalBeats)||ex.totalBeats<=0||ex.totalBeats>64)return null;
    for(const e of ex.events){if(!e||!Number.isFinite(e.beat)||e.beat<0||![.5,1,2,4].includes(e.duration)||!Array.isArray(e.targets)||e.targets.length>2||!e.targets.every(t=>t&&['treble','bass'].includes(t.clef)&&t.note&&Number.isInteger(t.note.index)&&t.note.index>=14&&t.note.index<=48))return null;}
    const events=ex.events.map(e=>{const targets=e.targets.map(t=>({clef:t.clef,note:C.fromIndex(t.note.index)}));const voices=(Array.isArray(e.voices)?e.voices:[]).filter(v=>v&&[.5,1,2,4].includes(v.duration)&&Array.isArray(v.targets)&&v.targets.length<=2&&v.targets.every(t=>t&&['treble','bass'].includes(t.clef)&&Number.isInteger(t.note?.index))).map(v=>({duration:v.duration,targets:v.targets.map(t=>({clef:t.clef,note:C.fromIndex(t.note.index)}))}));return {beat:e.beat,duration:e.duration,rest:e.rest===true,targets,voices:voices.length?voices:targets.length?[{targets,duration:e.duration}]:[]};});
    return {events,totalBeats:ex.totalBeats,clefs:[...new Set(events.flatMap(e=>e.targets.map(t=>t.clef)))]};
  }
  function normalize(raw) {
    const out = defaults();
    if (!raw || typeof raw !== 'object') return out;
    out.ear=typeof EarCore==='undefined'?{}:EarCore.normalize(raw.ear);
    out.foundation=typeof FoundationCore==='undefined'?{}:FoundationCore.normalize(raw.foundation);
    out.rhythm=RC?RC.normalize(raw.rhythm):{};
    out.learning=typeof LearningCore==='undefined'?{}:LearningCore.normalize(raw.learning);
    const s = raw.settings || {};
    out.settings.input=s.input==='midi'?'midi':'touch';out.settings.course=s.course==='free'?'free':'progressive';
    out.settings.foundationAttempt=typeof FoundationCore==='undefined'?null:FoundationCore.normalizeAttempt(s.foundationAttempt);
    out.settings.focusKeys=(Array.isArray(s.focusKeys)?s.focusKeys:[]).filter(keyValid).slice(0,3);out.settings.focusReason=typeof s.focusReason==='string'?s.focusReason.slice(0,300):'';
    ['clef','difficulty','pattern','flow','dual'].forEach(k => {
      const allowed = {difficulty:['beginner','basic','extended'],clef:['treble','bass','mixed','dual'],pattern:['steps','repeat','thirds','mixed'],flow:['guided','continuous','assessment'],dual:['alternate','sustain','together']}[k];
      if (allowed.includes(s[k])) out.settings[k] = s[k];
    });
    if (Number.isInteger(s.notes) && s.notes >= 1 && s.notes <= 15) out.settings.notes = s.notes;
    if ([10,20,40,60].includes(s.count)) out.settings.count=s.count;
    if ([1,2].includes(s.rhythm)) out.settings.rhythm = s.rhythm;
    if ([40,50,60,70,80].includes(s.tempo)) out.settings.tempo = s.tempo;
    out.settings.hints = s.hints !== false; out.settings.metronome = s.metronome !== false;
    Object.keys(raw.notes || {}).slice(0,100).forEach(k => {
      const n = raw.notes[k];
      if (!keyValid(k) || !n || !Number.isInteger(n.seen) || n.seen < 0) return;
      out.notes[k] = {seen:Math.min(n.seen,1000000),correct:Math.min(n.seen,Math.max(0,Number(n.correct)||0)),stage:Math.max(0,Math.min(4,Number(n.stage)||0)),due:Number.isFinite(n.due)?n.due:0,last:Number.isFinite(n.last)?n.last:0,stageAt:Number.isFinite(n.stageAt)?n.stageAt:0,samples:[]};
      out.notes[k].samples = (Array.isArray(n.samples)?n.samples:[]).filter(x => x && typeof x.correct==='boolean' && ['keyboard','staff','phrase'].includes(x.task) && typeof x.hint==='boolean' && (x.ms===null || Number.isFinite(x.ms) && x.ms>=0)).slice(-40).map(x=>({...x,context:typeof x.context==='string'&&x.context.length<80?x.context:null}));
    });
    if(!raw.learning&&typeof LearningCore!=='undefined'){
      for(const [key,n]of Object.entries(out.notes)){
        const groups=new Map();for(const sample of n.samples){const source=sample.context?.includes('midi')?'midi':'touch',id=sample.task+'|'+source;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(sample);}
        for(const [id,samples]of groups){const mk=id+'|'+key;out.learning.memory[mk]={stage:0,due:n.due>0?Math.min(n.due,Date.now()+86400000):0,successes:0,relearning:n.due>0,reviewFails:0,last:n.last,samples:samples.slice(-24).map(s=>({ok:s.correct&&!s.hint,hint:s.hint,at:Number.isFinite(s.at)?s.at:n.last,session:'legacy',position:0,retest:false}))};}
      }
    }
    Object.keys(raw.confusions || {}).slice(0,100).forEach(k => {
      if (!keyValid(k) || !Array.isArray(raw.confusions[k])) return;
      out.confusions[k] = raw.confusions[k].filter(x=>x && Number.isInteger(x.midi) && x.midi>=21 && x.midi<=108 && Number.isFinite(x.at)).slice(-30);
    });
    out.reports = (Array.isArray(raw.reports)?raw.reports:[]).filter(r => r && typeof r.id==='string' && Number.isFinite(r.at) && ['anchors','contrast','ledger','reverse','review','phrase','rhythm'].includes(r.kind) && ['guided','continuous','assessment'].includes(r.flow) && ['treble','bass','mixed','dual'].includes(r.clef) && Array.isArray(r.answers) && r.answers.length<=120 && r.answers.every(a=>a && Number.isInteger(a.expected) && a.expected>=21 && a.expected<=108 && ['treble','bass'].includes(a.clef) && typeof a.correct==='boolean' && typeof a.hint==='boolean' && (a.ms===null || Number.isFinite(a.ms)&&a.ms>=0) && (a.delta===null || Number.isFinite(a.delta)) && (a.actual===null || Number.isInteger(a.actual)&&a.actual>=21&&a.actual<=108))).slice(-60);
    out.reports=out.reports.map(r=>({...r,courseResult:r.courseResult&&Array.isArray(r.courseResult.focus)&&r.courseResult.focus.length<=20&&r.courseResult.focus.every(v=>v&&keyValid(v.key)&&Number.isInteger(v.clean)&&v.clean>=0&&v.clean<=200)?{passed:r.courseResult.passed===true,planned:Math.min(60,Math.max(0,Number(r.courseResult.planned)||0)),completed:Math.min(120,Math.max(0,Number(r.courseResult.completed)||0)),extra:Math.min(12,Math.max(0,Number(r.courseResult.extra)||0)),focus:r.courseResult.focus.map(v=>({key:v.key,clean:v.clean,needs:v.needs===true}))}:null,phraseCourseKey:typeof r.phraseCourseKey==='string'&&/^(treble|bass)\|(touch|midi)$/.test(r.phraseCourseKey)?r.phraseCourseKey:null,phraseResult:r.phraseResult?{passed:r.phraseResult.passed===true}:null,exercise:validStoredExercise(r.exercise),settings:{...normalize({settings:r.settings}).settings,keyboardFull:r.settings?.keyboardFull===true,keyboardChanged:r.settings?.keyboardChanged===true},extras:(Array.isArray(r.extras)?r.extras:[]).filter(p=>p&&Number.isInteger(p.midi)&&p.midi>=21&&p.midi<=108&&Number.isFinite(p.ms)&&p.ms>=0).slice(0,200)}));
    return out;
  }
  function observeNote(study,target,result,now=Date.now()) {
    if (!result.reached) return;
    const k=C.profileKey(target),n=study.notes[k] || (study.notes[k]={seen:0,correct:0,stage:0,due:0,last:0,stageAt:0,samples:[]});
    n.seen++; if (result.firstCorrect) n.correct++;
    const task=result.task || 'keyboard';
    n.samples.push({correct:!!result.firstCorrect,ms:result.paused||result.hint||!result.firstCorrect?null:Number.isFinite(result.firstMs)?result.firstMs:null,task,context:typeof result.context==='string'?result.context:null,hint:!!result.hint,hintLevel:typeof HintCore==='undefined'?0:HintCore.clampLevel(result.hintLevel),input:result.input==='midi'?'midi':'touch',at:now}); n.samples=n.samples.slice(-40); n.last=now;
    const learning=study.learning||(study.learning=typeof LearningCore==='undefined'?{}:LearningCore.defaults());
    if(typeof LearningCore!=='undefined'){
      const m=LearningCore.observe(learning,target,{...result,task,input:result.input||'touch'},now);
      n.stage=m.stage;n.due=m.due;n.stageAt=m.last;
    }
    if (!result.firstCorrect && Number.isInteger(result.firstMidi) && result.firstMidi !== target.note.midi) {
      const a=study.confusions[k] || (study.confusions[k]=[]); a.push({midi:result.firstMidi,at:now});study.confusions[k]=a.slice(-30);
    }
  }
  function targetFromKey(k) {const [clef,n]=k.split(':');return {clef,note:C.parse(n)};}
  function due(study,now=Date.now()) {if(typeof LearningCore!=='undefined'){const keys=new Set(LearningCore.due(study.learning||LearningCore.defaults(),'touch',now).concat(LearningCore.due(study.learning||LearningCore.defaults(),'midi',now)).map(x=>C.profileKey(x.target)));return [...keys].map(targetFromKey);}return Object.keys(study.notes).filter(k=>study.notes[k].due>0&&study.notes[k].due<=now).sort((a,b)=>study.notes[a].due-study.notes[b].due).map(targetFromKey);}
  function commonConfusion(study,target) {
    const xs=(study.confusions[C.profileKey(target)]||[]).slice(-20),counts={};
    xs.forEach(x=>counts[x.midi]=(counts[x.midi]||0)+1);
    const best=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
    return best?{midi:Number(best),count:counts[best],confirmed:counts[best]>=3}:null;
  }
  function weakNotes(study,task=null,context=null) {
    const output=[];
    for(const [key,n]of Object.entries(study.notes)){
      const t=targetFromKey(key),groups=new Map();
      for(const sample of n.samples){if(task&&sample.task!==task||context&&sample.context!==context)continue;const group=sample.task+'|'+(sample.input||(sample.context?.includes('midi')?'midi':'touch'));if(!groups.has(group))groups.set(group,[]);groups.get(group).push(sample);}
      let worst=null;
      for(const [group,samples]of groups){
        const recent=samples.slice(-12),stable=recent.length>=5&&recent.slice(-5).every(s=>s.correct&&!s.hint),errors=recent.filter(s=>!s.correct||s.hint).length,error=!stable&&errors>0;
        const good=recent.filter(s=>s.correct&&!s.hint&&s.ms!==null),time=C.median(good.map(s=>s.ms));
        const peers=Object.entries(study.notes).filter(([k])=>k.startsWith(t.clef+':')).map(([,v])=>C.median(v.samples.filter(s=>s.task+'|'+(s.input||(s.context?.includes('midi')?'midi':'touch'))===group&&s.correct&&!s.hint&&s.ms!==null).slice(-8).map(s=>s.ms))).filter(v=>v!==null);
        const threshold=Math.max(2000,(C.median(peers)||2000)*1.5),slow=good.length>=3&&time>threshold,score=(error?errors/recent.length*4:0)+(slow?2:0);
        if(score>0&&(!worst||score>worst.score))worst={...t,score,error,slow,time,samples:recent.length,task:group.split('|')[0],input:group.split('|')[1]};
      }
      if(worst)output.push(worst);
    }
    return output;
  }
  function pick(a,r=Math.random) {return a[Math.floor(r()*a.length)];}
  function anchors(c) {return (c==='treble'?['C4','G4','C5']:['C3','F3','C4']).map(C.parse);}
  function topicTargets(kind,clef,study,random=Math.random,count=10,difficulty='basic') {
    const cs=C.clefsFor(clef==='dual'?'mixed':clef),level=['beginner','basic','extended'].includes(difficulty)?difficulty:'basic';
    const weak=new Set(weakNotes(study).map(C.profileKey));
    if(kind==='contrast') {
      let pairs=[];
      cs.forEach(c=>{
        const notes=C.pool(level,c),seen=new Set();
        const add=(a,b)=>{if(!a||!b||a.midi===b.midi)return;const id=[a.midi,b.midi].sort((x,y)=>x-y).join(':');if(seen.has(id))return;seen.add(id);pairs.push([{clef:c,note:a},{clef:c,note:b}]);};
        Object.keys(study.confusions||{}).filter(k=>k.startsWith(c+':')).forEach(k=>{
          const t=targetFromKey(k),x=commonConfusion(study,t);if(x&&natural(x.midi))add(notes.find(n=>n.midi===t.note.midi),notes.find(n=>n.midi===x.midi));
        });
        if(!seen.size)for(let i=0;i<notes.length;i++){
          add(notes[i],notes[i+1]);
          if(level!=='beginner')add(notes[i],notes[i+2]);
          if(level==='extended')add(notes[i],notes[i+7]);
        }
      });
      const out=[];let bag=[],last=null;
      while(out.length<count&&pairs.length){
        if(!bag.length)bag=C.shuffle(pairs,random);
        let pair=bag.pop();if(C.profileKey(pair[0])===last)pair=[pair[1],pair[0]];
        for(const t of pair){if(out.length===count)break;out.push({...t});last=C.profileKey(t);}
      }
      return out;
    }
    let pool=[];
    if(kind==='review')pool=due(study).filter(t=>cs.includes(t.clef));
    else cs.forEach(c=>{
      let notes;
      if(kind==='anchors'){
        const radius=level==='beginner'?1:level==='basic'?2:3,allowed=C.pool('extended',c),indices=new Set();
        anchors(c).forEach(n=>{for(let d=-radius;d<=radius;d++)indices.add(n.index+d);});
        notes=allowed.filter(n=>indices.has(n.index));
      }else if(kind==='ledger'){
        const bottom=C.parse(c==='treble'?'E4':'G2').index,depth=level==='beginner'?2:level==='basic'?4:8;
        notes=C.pool('extended',c).filter(n=>{const d=n.index-bottom;return d<0&&-d<=depth||d>8&&d-8<=depth;});
      }else notes=C.pool(level,c);
      pool.push(...notes.map(note=>({clef:c,note})));
    });
    if(!pool.length)return [];
    const out=[];let bag=[],last=null;
    for(let i=0;i<count;i++){
      if(!bag.length)bag=C.shuffle(kind==='review'?pool:[...pool,...pool.filter(t=>weak.has(C.profileKey(t)))],random);
      if(bag.length>1&&C.profileKey(bag[bag.length-1])===last){const other=bag.findIndex(t=>C.profileKey(t)!==last);if(other>=0)[bag[other],bag[bag.length-1]]=[bag[bag.length-1],bag[other]];}
      const t=bag.pop();out.push({...t});last=C.profileKey(t);
    }
    return out;
  }
  const RHYTHMS = {
    1:[[1,1,-1,1],[2,1,1],[1,2,1],[1,-1,2],[-1,1,1,1]],
    2:[[.5,.5,1,-1,1],[1,.5,.5,2],[.5,.5,-1,1,1],[2,.5,.5,1]]
  };
  function rhythmEvents(level=1,bars=2,random=Math.random) {
    let events=[],beat=0;
    for(let b=0;b<bars;b++)pick(RHYTHMS[level]||RHYTHMS[1],random).forEach(d=>{events.push({beat,duration:Math.abs(d),rest:d<0,targets:[]});beat+=Math.abs(d);});
    return {events,totalBeats:beat};
  }
  function phrase(settings,study={},random=Math.random) {
    const N=settings.notes,dual=settings.clef==='dual';
    const cs=dual?['treble','bass']:[settings.clef==='mixed'?pick(['treble','bass'],random):settings.clef];
    const range=['beginner','basic','extended'].includes(settings.difficulty)?settings.difficulty:'basic';
    const pools={treble:C.pool(range,'treble'),bass:C.pool(range,'bass')};
    function initial(c){const weak=weakNotes(study.notes?study:defaults());const weights=pools[c].map(n=>1+(weak.find(t=>t.clef===c&&t.note.index===n.index)?.score||0)*2);let r=random()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0)return i;}return pools[c].length-1;}
    const ix={treble:initial('treble'),bass:initial('bass')},dirs={treble:1,bass:-1};
    function take(c) {
      let step=settings.pattern==='repeat'?pick([0,0,1,-1],random):settings.pattern==='thirds'?pick([-2,2],random):settings.pattern==='mixed'?pick([-2,-1,0,1,2],random):dirs[c];
      let next=ix[c]+step;if(next<0||next>=pools[c].length){dirs[c]*=-1;next=Math.max(0,Math.min(pools[c].length-1,ix[c]-step));}
      const note=pools[c][ix[c]];ix[c]=next;return {clef:c,note};
    }
    let events=[],beat=0,used=0;
    if(dual && settings.dual==='sustain' && N>=3) {
      /* One lower note sustains while four upper quarter notes occupy the bar. */
      while(used<N){const start=beat;let bass=take('bass');events.push({beat,duration:4,voice:'bass',rest:false,targets:[bass]});used++;
        for(let j=0;j<4 && used<N;j++){events.push({beat:start+j,duration:1,voice:'treble',rest:false,targets:[take('treble')]});used++;}beat+=4;}
    } else {
      while(used<N) {
        const remaining=4-beat%4;
        if(remaining===4 && beat>0 && settings.rhythm>=2 && random()<.2){events.push({beat,duration:1,rest:true,targets:[]});beat++;continue;}
        const ds=settings.rhythm===2?[.5,1,1,2]:[1,1,2];const duration=pick(ds.filter(d=>d<=remaining),random);
        let targets=[];
        if(dual && settings.dual==='together' && N-used>=2)targets=[take('treble'),take('bass')];
        else targets=[take(dual?(used%2?'bass':'treble'):cs[0])];
        events.push({beat,duration,rest:false,targets});used+=targets.length;beat+=duration;
      }
    }
    const totalBeats=Math.ceil(beat/4)*4;
    while(beat<totalBeats){const duration=[2,1,.5].find(d=>d<=totalBeats-beat);events.push({beat,duration,rest:true,targets:[]});beat+=duration;}
    /* Sustain can create coincident events; combine onset targets without losing voice lengths. */
    const groups=[];
    events.sort((a,b)=>a.beat-b.beat).forEach(e=>{
      const last=groups[groups.length-1];if(last && last.beat===e.beat && !e.rest && !last.rest){last.targets.push(...e.targets);last.voices.push({targets:e.targets,duration:e.duration});}
      else groups.push({...e,targets:[...e.targets],voices:e.rest?[]:[{targets:e.targets,duration:e.duration}]});
    });
    return {events:groups,totalBeats,clefs:cs};
  }
  function timingWindow(events,index,beatMs) {
    const e=events[index],prev=events.slice(0,index).reverse().find(x=>!x.rest),next=events.slice(index+1).find(x=>!x.rest);
    const gap=Math.min(prev?(e.beat-prev.beat)*beatMs:Infinity,next?(next.beat-e.beat)*beatMs:Infinity);
    return Math.min(beatMs*.3,gap*.4);
  }
  function evaluate(events,presses,beatMs,kind) {
    const answers=[],taken=new Set(),extras=[];
    events.forEach((e,i)=>{
      if(e.rest)return;
      const window=timingWindow(events,i,beatMs);
      const available=presses.map((p,j)=>({...p,j,delta:p.ms-e.beat*beatMs})).filter(p=>!taken.has(p.j)&&Math.abs(p.delta)<=window).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta));
      const targets=kind==='rhythm'?[{clef:'treble',note:C.parse('C4')}]:e.targets;
      const assignments=targets.map(t=>({t,p:null}));
      assignments.forEach(a=>{a.p=available.find(p=>!taken.has(p.j)&&(kind==='rhythm'||p.midi===a.t.note.midi));if(a.p)taken.add(a.p.j);});
      assignments.forEach(a=>{if(!a.p){a.p=available.find(p=>!taken.has(p.j));if(a.p)taken.add(a.p.j);}});
      assignments.forEach(({t,p})=>answers.push({expected:t.note.midi,clef:t.clef,actual:p?(kind==='rhythm'?60:p.midi):null,correct:!!p&&(kind==='rhythm'||p.midi===t.note.midi),delta:p?p.delta:null,ms:null,hint:false,event:i,window}));
    });
    presses.forEach((p,j)=>{if(!taken.has(j))extras.push(p);});
    return {answers,extras};
  }
  function summary(report) {
    const a=report.answers,unaided=a.filter(x=>!x.hint),times=unaided.filter(x=>x.correct&&x.ms!==null).map(x=>x.ms);
    const timing=a.filter(x=>x.delta!==null),deltas=timing.map(x=>Math.abs(x.delta));
    return {matched:a.filter(x=>x.actual!==null).length,matchedCorrect:a.filter(x=>x.actual!==null&&x.correct).length,seen:a.length,correct:a.filter(x=>x.correct).length,unaided:unaided.length,unaidedCorrect:unaided.filter(x=>x.correct).length,median:C.median(times),speedSamples:times.length,timingSeen:timing.length,medianDelta:C.median(deltas),missed:a.filter(x=>x.actual===null).length,extras:(report.extras||[]).length};
  }
  return Object.freeze({defaults,normalize,observeNote,due,commonConfusion,targetFromKey,topicTargets,phrase,rhythmEvents,timingWindow,evaluate,summary,natural,weakNotes,validStoredExercise});
})();
if(typeof globalThis!=='undefined')globalThis.StudyCore=StudyCore;
