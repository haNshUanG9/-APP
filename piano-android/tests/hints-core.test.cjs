const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx=vm.createContext({console,Date,Math});for(const name of ['core','rhythm-core','learning-core','hint-core','study-core'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/'+name+'.js'),'utf8'),ctx);
const C=ctx.PianoCore,L=ctx.LearningCore,H=ctx.HintCore;
const t=(pitch,clef='treble')=>({clef,note:C.parse(pitch)});
const m=H.model(t('B4'),{reference:'G4'});assert.equal(m.steps,2);assert.match(m.relation,/跳过一个音/);assert(!H.text(m,1).includes('B4'));assert(!H.text(m,2).includes('B4'));assert(H.text(m,2).includes('G4 → A4 → ？'));assert(H.text(m,3).includes('B4'));
assert.match(H.model(t('G5'),{previous:t('G4')}).relation,/八度/);
assert.equal(H.model(t('E4'),{previous:t('G4')}).delta,-2);
assert.equal(H.model(t('G4'),{previous:t('G4')}).steps,0);
assert.equal(H.model(t('D4','bass'),{reference:'C4'}).reference.note.midi,60);
let cases=0;for(const clef of ['treble','bass'])for(const n of C.pool('extended',clef))for(let level=1;level<=3;level++){const v=H.model({clef,note:n});assert.equal(v.path.length,v.steps+1);assert.equal(v.path.at(-1).midi,n.midi);assert(H.text(v,level).length>10);cases++;}
const d=L.defaults(),session=L.start(d,'anchors','treble','touch',20);L.next(session);session.current.hintLevel=2;const restored=L.normalize(JSON.parse(JSON.stringify(d)));assert.equal(restored.sessions['anchors|treble|touch'].current.hintLevel,2);
L.observe(d,t('G4'),{task:'keyboard',input:'touch',firstCorrect:true,hint:true,hintLevel:2});assert(d.memory['keyboard|touch|treble:G4'].relearning);assert.equal(d.memory['keyboard|touch|treble:G4'].samples[0].hintLevel,2);
L.record(session,{correct:true,hint:true});assert.equal(session.stats['treble:G4'].clean,0);assert(session.retries.length);
const records=[{status:'assisted',targets:[t('G4'),t('A4')],slots:[{reached:true,firstCorrect:true,firstMs:120,completed:true,hint:true,hintLevel:3},{reached:true,firstCorrect:true,firstMs:500,completed:true,hint:false}]}];
const report=C.report(records,{},true);assert.equal(report.assistedNotes,1);assert.equal(report.unaidedNotes,1);assert.equal(report.correctNotes,1);assert.equal(report.noteAccuracy,1);assert.equal(report.medianMs,500);assert.equal(report.completion,1);assert.equal(report.accuracy,0);
const profiles={};for(let i=0;i<6;i++)C.observe(profiles,t('G4'),{reached:true,firstCorrect:true,firstMs:1,hint:true,hintLevel:3});assert(C.weakness(profiles['treble:G4'],2000).score>0);assert.equal(profiles['treble:G4'].samples[0].firstMs,null);
console.log('Hint core:',cases,'pitch/level cases, no premature answer, diatonic intervals, persisted cues, assisted scoring and weakness passed.');
