const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx=vm.createContext({console});for(const file of ['core.js','rhythm-core.js','learning-core.js','study-core.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../web',file),'utf8'),ctx);
const C=ctx.PianoCore,L=ctx.LearningCore,S=ctx.StudyCore,R=ctx.RhythmCore,DAY=86400000,now=1800000000000;
const t={clef:'treble',note:C.parse('G4')},good={task:'keyboard',input:'midi',firstCorrect:true,hint:false};
const d=L.defaults();let memory;
for(let i=0;i<3;i++)memory=L.observe(d,t,good,now+i*1000);assert.equal(memory.stage,0);
memory=L.observe(d,t,good,now+4000);assert.equal(memory.stage,1);const due=memory.due;
for(let day=1;day<4;day++)L.observe(d,t,good,now+day*DAY);assert.equal(memory.stage,1);assert.equal(memory.due,due,'ordinary practice cannot defer review');
L.observe(d,t,{...good,review:true,confirmed:false},due+1);assert.equal(memory.stage,1);
L.observe(d,t,{...good,review:true,confirmed:true},due+2);assert.equal(memory.stage,2);assert.equal(memory.due,due+2+3*DAY);
const wrong=L.observe(d,t,{...good,firstCorrect:false},due+5000),wrongDue=wrong.due;
L.observe(d,t,good,due+6000);assert.equal(wrong.due,wrongDue);assert(wrong.relearning);
L.observe(d,t,{...good,review:true,confirmed:true},wrongDue-1);assert(wrong.relearning);L.observe(d,t,{...good,review:true,confirmed:true},wrongDue+1);assert(!wrong.relearning);assert.equal(wrong.stage,1);
const study=S.defaults();S.observeNote(study,t,{reached:true,...good,firstMidi:69,firstMs:900},now);
S.observeNote(study,t,{reached:true,...good,firstCorrect:false,firstMidi:67,firstMs:900},now+1000);
for(let i=0;i<5;i++)S.observeNote(study,t,{reached:true,...good,task:'staff',firstMidi:69,firstMs:900},now+2000+i*1000);
assert(S.weakNotes(study,'keyboard').some(x=>C.profileKey(x)===C.profileKey(t)));assert(L.evidence(study.learning,t,'keyboard','midi').relearning);assert.equal(L.evidence(study.learning,t,'staff','midi').successes,5);
const hintStudy=S.defaults();S.observeNote(hintStudy,t,{reached:true,...good,hint:true,firstMs:900},now);assert.equal(S.weakNotes(hintStudy).length,1);
let courses=0;
for(const kind of ['anchors','contrast','ledger','reverse'])for(const clef of ['treble','bass','mixed']){
 const curriculum=L.defaults();const units=L.units(kind,clef);assert(units.every(u=>u.keys.length>=1&&u.keys.length<=3));
 for(let n=0;n<units.length;n++){
  const s=L.start(curriculum,kind,clef,'midi',20);assert.equal(s.unit,n);const positions={};let count=0;
  while(L.next(s)){
   const item=s.current;
   const first=s.focus.includes(item.key)&&!positions[item.key];positions[item.key]=true;
   L.record(s,{correct:true,hint:first,paused:false});count++;assert(count<=32);
  }
  const result=L.finish(curriculum,s,true);assert(result.passed,kind+' '+clef+' '+n+' '+JSON.stringify(result));assert.equal(curriculum.tracks[s.track].unit,n+1);
 }
 courses++;
}
const failed=L.defaults(),session=L.start(failed,'anchors','treble','midi',20);let item=L.next(session);L.record(session,{correct:false,hint:false});assert.equal(session.retries[0].due,3);
for(let i=0;i<2;i++){assert.equal(L.next(session).type,'plan');L.record(session,{correct:true,hint:false});}
item=L.next(session);assert.equal(item.type,'retest');assert.equal(item.position,3);L.record(session,{correct:true,hint:false});assert.equal(session.retries[0].phase,2);assert.equal(session.retries[0].due,10);
const restored=L.normalize(JSON.parse(JSON.stringify(failed)));assert.deepEqual(JSON.parse(JSON.stringify(restored.sessions)),JSON.parse(JSON.stringify(failed.sessions)));
const bounded=L.start(L.defaults(),'contrast','treble','touch',60);let done=0;while(L.next(bounded)){L.record(bounded,{correct:false,hint:false});assert(++done<=72);}assert(bounded.extra<=12);assert(!L.summary(bounded).passed);
// 10-question rounds can accumulate independent evidence without an endless reset.
const short=L.defaults();short.tracks['anchors|treble|midi']={unit:2,passed:[0,1],last:now};for(let round=0;round<3;round++){
 const s=L.start(short,'anchors','treble','midi',10);while(L.next(s))L.record(s,{correct:true,hint:false});const r=L.finish(short,s,true);if(r.passed)break;
}assert.equal(short.tracks['anchors|treble|midi'].unit,3);
for(const beats of [2,3,4])for(const level of [2,3]){const previous=new Set(R.templates(beats,level-1).map(t=>t.id)),current=new Set(R.templates(beats,level).map(t=>t.id));assert([...previous].every(id=>current.has(id)));}
let rhythms=0;for(const mode of R.MODES)for(const meter of ['2/4','3/4','4/4'])for(let unit=0;unit<7;unit++)for(let phase=0;phase<4;phase++){
 const ex=R.generate({course:'progressive',mode,meter,lessonUnit:unit,lessonPhase:phase},R.defaults(),()=>.5),b=R.barBeats(ex.settings);assert.equal(ex.totalBeats,b*4);
 if(phase<2)assert.equal(new Set(ex.bars.map(x=>x.id)).size,1);
 for(let index=0;index<4;index++)for(const lane of mode==='dual'?['left','right']:['main'])assert.equal(ex.events.filter(e=>e.bar===index&&e.lane===lane).reduce((n,e)=>n+e.duration,0),b);
 rhythms++;
}
const phrase=L.defaults();for(const n of ['G4','F4'])for(let i=0;i<4;i++)L.observe(phrase,{clef:'treble',note:C.parse(n)},good,now+i*1000);
assert(L.phraseInfo(phrase,'treble','midi').unlocked);const first=L.phraseExercise(phrase,'treble','midi');const report={complete:true,flow:'guided',settings:{tempo:50},answers:Array.from({length:6},()=>({correct:true,hint:false,delta:0})),extras:[]};
L.phraseResult(phrase,'treble|midi',report);assert.equal(JSON.stringify(L.phraseExercise(phrase,'treble','midi')),JSON.stringify(first));
L.phraseResult(phrase,'treble|midi',{...report,complete:false});assert.equal(phrase.phrases['treble|midi'].phase,1);
L.phraseResult(phrase,'treble|midi',report);assert.equal(JSON.stringify(L.phraseExercise(phrase,'treble','midi')),JSON.stringify(first));
L.phraseResult(phrase,'treble|midi',{...report,flow:'continuous'});assert.notEqual(JSON.stringify(L.phraseExercise(phrase,'treble','midi')),JSON.stringify(first));
const migration=S.normalize({notes:study.notes,settings:{course:'free'}});assert(Object.keys(migration.learning.memory).length>=2);assert.equal(migration.settings.course,'free');
console.log(JSON.stringify({reviewDueGate:'pass',wrongThenCorrectGate:'pass',taskIsolation:'pass',hintWeakness:'pass',curriculumRoutes:courses,persistentQueue:'pass',retryBound:'pass',shortRounds:'pass',cumulativeTemplates:'pass',rhythmCurriculumCases:rhythms,samePhraseAndVariation:'pass',legacyMigration:'pass'}));
