const assert=require('node:assert/strict');require('../web/rhythm-core.js');const R=global.RhythmCore;
let seed=91;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);let generated=0;
for(const mode of R.MODES)for(const meter of ['2/4','3/4','4/4'])for(const level of [1,2,3])for(const bars of [1,2,4])for(const tempo of [40,60,120])for(let rep=0;rep<3;rep++){
 const ex=R.generate({course:'free',mode,meter,level,bars,tempo},R.defaults(),rnd),beats=R.barBeats(ex.settings),bm=60000/tempo;assert.equal(ex.totalBeats,beats*bars);
 for(let bar=0;bar<bars;bar++)for(const lane of mode==='dual'?['left','right']:['main']){const es=ex.events.filter(e=>e.bar===bar&&e.lane===lane);assert.equal(es.reduce((n,e)=>n+e.duration,0),beats);for(const e of es){assert.equal(Math.floor(e.beat/beats),bar);assert(e.beat+e.duration<=beats*(bar+1));}}
 const inputs=ex.events.filter(e=>!e.rest).map(e=>({lane:e.lane,down:e.beat*bm+20,up:(e.beat+e.duration)*bm+20,cancelled:false}));let q=R.evaluate(ex,inputs);assert.equal(q.metrics.hit,q.metrics.seen);assert.equal(q.metrics.extras,0);assert.equal(q.metrics.missed,0);if(R.isHold(ex.settings))assert.equal(q.metrics.holdCorrect,q.metrics.holds);
 const report={id:'test',at:1000,settings:ex.settings,exercise:ex,inputs,complete:true,visitedMs:ex.totalBeats*bm,paused:false,result:q};const d=R.normalize({reports:[report]});assert.equal(d.reports.length,1);assert.deepEqual(d.reports[0].result,q);generated++;
}
const ex=R.generate({course:'free',mode:'hold',bars:1},R.defaults(),()=>0),input=[{lane:'main',down:0,up:200,cancelled:false},{lane:'main',down:1000,up:2900,cancelled:false},{lane:'main',down:2000,up:3000,cancelled:true}];let out=R.evaluate(ex,input);assert.equal(out.metrics.short,1);assert.equal(out.metrics.long,1);assert.equal(out.metrics.interrupted,1);assert.equal(out.metrics.missed,1);assert.equal(out.metrics.seen,3);
out=R.evaluate(ex,input,false,1100);assert.equal(out.answers.length,2);assert.equal(out.metrics.missed,0);
const bad={id:'bad',at:1,settings:{},exercise:{events:[{beat:Infinity}],bars:[],totalBeats:4},inputs:[],complete:true};assert.equal(R.normalize({reports:[bad]}).reports.length,0);
const dual=R.generate({course:'free',mode:'dual',bars:1},R.defaults(),()=>0);out=R.evaluate(dual,dual.events.filter(e=>!e.rest).map(e=>({lane:e.lane,down:e.beat*1000,up:(e.beat+e.duration)*1000})));assert.equal(out.metrics.hit,5);assert.equal(out.metrics.holdCorrect,5);
const d=R.defaults(),s=R.settings({course:'free',mode:'pattern',bars:1}),pool=R.templates(4,1),chosen=pool[0].id;d.profiles[R.profileKey(s,chosen)]={mode:s.mode,meter:s.meter,id:chosen,samples:[{ok:false,at:1},{ok:false,at:2},{ok:false,at:3}]};let freq=0;for(let i=0;i<4000;i++)if(R.generate(s,d,rnd).bars[0].id===chosen)freq++;assert(freq>4000/pool.length*2&&freq<4000/pool.length*6,freq);assert.notEqual(R.profileKey({...s,tempo:80},chosen),R.profileKey(s,chosen));assert.notEqual(R.profileKey({...s,counting:false},chosen),R.profileKey(s,chosen));
const short={...ex,settings:{...ex.settings,offset:100}};out=R.evaluate(short,ex.events.map(e=>({lane:e.lane,down:e.beat*1000+100,up:(e.beat+e.duration)*1000+100})));assert.equal(out.metrics.medianOffset,0);
for(const meter of ['2/4','3/4','4/4'])for(let unit=0;unit<7;unit++){
 const beats=R.barBeats({meter}),patterns=R.bankPatterns(meter,unit);assert(patterns.length>=1);
 patterns.forEach(p=>{let at=0;assert(p.values.some(v=>v>0));p.values.forEach(v=>{assert([-.5,.5,-1,1,1.5,2,4].includes(v));assert(at<beats);at+=Math.abs(v);assert(at<=beats);});assert.equal(at,beats);});
}
const metro=R.settings({tempo:30,metroMeter:'3/4',metroBpm:240,metroSubdivision:4,metroAccent:false});assert.equal(metro.tempo,30);assert.equal(metro.metroMeter,'3/4');assert.equal(metro.metroBpm,240);assert.equal(metro.metroSubdivision,4);assert.equal(metro.metroAccent,false);
const fixed=R.generate({course:'progressive',mode:'pattern',meter:'3/4',lessonUnit:2,lessonPhase:0},R.defaults(),rnd);assert.equal(new Set(fixed.bars.map(b=>b.id)).size,1);const mixed=R.generate({course:'progressive',mode:'pattern',meter:'3/4',lessonUnit:2,lessonPhase:2},R.defaults(),rnd);assert(new Set(mixed.bars.map(b=>b.id)).size>=1);
require('../web/core.js');require('../web/learning-core.js');const L=global.LearningCore;
for(const meter of ['2/4','3/4','4/4']){
 const base=R.settings({mode:'pattern',meter,tempo:60}),store={};let state=R.courseProgressState(store,base);const seen=new Set(),signatures=new Set();
 for(let unit=0;unit<7;unit++)for(const p of R.bankPatterns(meter,unit)){assert(!signatures.has(p.signature),`${meter}: duplicate ${p.signature}`);signatures.add(p.signature);if(unit===2)assert(p.values.at(-1)<0);if(unit===3)assert(p.values.some((v,i)=>v<0&&p.values.slice(i+1).some(x=>x>0)));}
 for(let unit=0;unit<7;unit++)for(let index=0;index<R.bankPatterns(meter,unit).length;index++)for(let phase=0;phase<4;phase++){
  assert.deepEqual([state.unit,state.pattern,state.phase],[unit,index,phase]);
  const s={...base,lessonUnit:unit,lessonPattern:index,lessonPhase:phase,courseRevision:state.revision},exercise=R.generate(s),id=R.bankPatterns(meter,unit)[index].id;
  assert.equal(exercise.bars[0].id,id);if(phase<2)assert(exercise.bars.every(b=>b.id===id));seen.add(id);
  const before=JSON.stringify(state);assert.equal(R.courseProgressAdvance(state,s,exercise,false),null);assert.equal(JSON.stringify(state),before);assert.deepEqual(R.generate(s).bars,exercise.bars);
  const next=R.courseProgressAdvance(state,s,exercise,true);assert(next);assert.equal(JSON.stringify(state),before);state=next;assert.equal(R.courseProgressAdvance(state,s,exercise,true),null);
 }
 assert.equal(seen.size,signatures.size);assert(state.completed);
}
const legacy={'hold|4/4|60|metro|0|touch':{unit:2,phase:3,clean:4},'hold|4/4|90|silent|0|touch':{unit:3,phase:1,clean:2}},base=R.settings({mode:'hold',meter:'4/4',tempo:60}),progress0=R.courseProgressState(legacy,base);let progress=progress0;
assert.deepEqual([progress.unit,progress.pattern,progress.phase],[3,0,1]);legacy[R.courseProgressKey(base)]=progress;assert.deepEqual(R.courseProgressState(legacy,{...base,tempo:100,fade:true,metronome:false}),progress);
let ps={...base,lessonUnit:progress.unit,lessonPattern:progress.pattern,lessonPhase:progress.phase,courseRevision:progress.revision};let pe=R.generate(ps);progress=R.courseProgressAdvance(progress,ps,pe,true);assert(progress);
ps={...ps,tempo:100,metronome:false,fade:true,lessonPhase:progress.phase,courseRevision:progress.revision};pe=R.generate(ps);progress=R.courseProgressAdvance(progress,ps,pe,true);assert(progress);assert.equal(Object.keys(progress.evidence).length,3);legacy[R.courseProgressKey(base)]=progress;
const round=L.normalize(JSON.parse(JSON.stringify({rhythm:legacy})));assert.deepEqual(round.rhythm[R.courseProgressKey(base)],progress);assert(round.rhythm['hold|4/4|60|metro|0|touch']);
assert.deepEqual(R.bankPatterns('4/4',1).find(p=>p.id==='4_4-u1-3').values,[2,2]);assert.deepEqual(R.bankPatterns('4/4',1).find(p=>p.id==='4_4-u1-4').values,[4]);
// Exercise the public UI entry without a browser or server; inspect the launched run.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../web/rhythm-ui.js'),'utf8').replace('  window.PianoRhythm={','  window.inspectRhythmRun=()=>run;\n  window.PianoRhythm={');
for(const mode of ['pattern','hold','dual'])for(const bars of [1,2,4]){
 const db={study:{rhythm:R.defaults(),learning:{rhythm:{}}}},window={PianoHost:{glyphs:{},getDB:()=>db,save(){},showPage(){},classicActive:()=>false},PianoStudio:{},PianoInput:{isMidi:()=>true,apply(){}},PianoStudy:{stopForRhythm:fn=>fn()},addEventListener(){}};
 const sandbox={window,document:{getElementById:()=>null,addEventListener(){}},RhythmCore:R,cancelAnimationFrame(){},performance:{now:()=>0}};vm.runInNewContext(ui,sandbox);
 const exercise=R.generate({course:'free',mode,bars,input:'touch'}),original=JSON.stringify(exercise.events);window.PianoRhythm.practiceExercise(exercise,{...exercise.settings,mode:'hold',tempo:80});
 const run=window.inspectRhythmRun();assert.equal(run.settings.mode,mode);assert.equal(run.settings.bars,bars);assert.equal(run.settings.input,'midi');assert.equal(run.settings.tempo,80);assert.equal(run.settings.course,'free');assert.equal(JSON.stringify(run.exercise.events),original);assert.equal(exercise.settings.input,'touch');
}
for(const mode of ['pattern','hold']){
 const db={study:{rhythm:R.defaults(),learning:{rhythm:{}}}},window={PianoHost:{glyphs:{},getDB:()=>db,save(){},showPage(){},classicActive:()=>false},PianoStudio:{},PianoInput:{isMidi:()=>false,apply(){}},PianoStudy:{stopForRhythm:fn=>fn()},addEventListener(){}};
 vm.runInNewContext(ui,{window,document:{getElementById:()=>null,addEventListener(){}},RhythmCore:R,cancelAnimationFrame(){},performance:{now:()=>0}});
 const exercise=R.generate({course:'free',mode:'pattern',bars:1});exercise.bars[0].id='coach-focus';exercise.events.forEach(e=>e.pattern='coach-focus');window.PianoRhythm.practiceExercise(exercise,{mode});assert.equal(window.inspectRhythmRun().settings.mode,mode);
}
console.log(JSON.stringify({generated,barBalance:'pass',bankBalance:'pass',metronomeSettings:'pass',progressiveFixed:'pass',perfectOnsetAndDuration:'pass',dual:'pass',partial:'pass',cancel:'pass',roundTrip:'pass',adaptiveFrequency:freq,offset:'pass'}));
