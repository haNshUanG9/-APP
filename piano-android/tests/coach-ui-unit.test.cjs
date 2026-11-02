const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
require('../web/core.js');require('../web/rhythm-core.js');require('../web/study-core.js');require('../web/coach-core.js');
const R=global.RhythmCore,C=global.PianoCore,K=global.CoachCore;
const mkPhrase=(note,flow)=>{const target={clef:'treble',note:C.parse(note)},events=Array.from({length:4},(_,beat)=>({beat,duration:1,rest:false,targets:[target],voices:[{duration:1,targets:[target]}]}));return {exercise:{events,totalBeats:4,clefs:['treble']},flow,settings:{clef:'treble',input:'midi',course:'progressive',difficulty:'basic',notes:4,pattern:'steps',rhythm:1,tempo:70,flow,dual:'alternate',hints:false,metronome:false,unknown:'discard'}};};
const launched=[],returned=[],continued=[],window={RhythmCore:R,CoachCore:K,PianoHost:{getDB:()=>({study:{}})},PianoStudio:{icon:()=>''},PianoRhythm:{practiceExercise:(ex,s)=>launched.push({ex,s})},PianoStudy:{practiceExercise:(ex,s)=>returned.push({ex,s}),continueReport:r=>continued.push(r),practiceFocus(){}}};
const document={createElement:()=>({})};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/coach-ui.js'),'utf8'),{window,document});
const p1=mkPhrase('C4','assessment'),p2=mkPhrase('G4','continuous');
for(const report of [p1,p2])window.PianoCoach.act({kind:'study',report,advice:{action:'rhythm'}});
assert.equal(launched.length,2);assert.equal(launched[0].ex.phraseOrigin.settings.flow,'assessment');assert.equal(launched[0].ex.phraseOrigin.settings.unknown,undefined);
function saved(ex,id){return R.normalize({reports:[{id,at:1,settings:ex.settings,exercise:ex,inputs:[],complete:true}]}).reports[0];}
const saved1=saved(launched[0].ex,'one'),saved2=saved(launched[1].ex,'two');assert(saved1.exercise.phraseOrigin);assert(saved2.exercise.phraseOrigin);
const reloaded=global.StudyCore.normalize(JSON.parse(JSON.stringify({rhythm:{reports:[saved1,saved2]}}))).rhythm.reports;assert.equal(reloaded.length,2);assert.equal(reloaded[0].exercise.phraseOrigin.settings.flow,'assessment');
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/coach-ui.js'),'utf8'),{window,document});
function render(report){const host={children:[],querySelector:()=>({}),appendChild(node){this.children.push(node);}};window.PianoCoach.renderRhythm(report,host);return host;}
const host1=render(reloaded[0]),host2=render(reloaded[1]);assert.equal(host1.children.length,1);assert.equal(host2.children.length,1);host2.children[0].onclick();host1.children[0].onclick();
assert.equal(returned[0].ex.events[0].targets[0].note.midi,C.parse('G4').midi);assert.equal(returned[1].ex.events[0].targets[0].note.midi,C.parse('C4').midi);assert.equal(returned[1].s.flow,'assessment');assert.equal(returned[1].s.tempo,70);assert.equal(returned[1].s.course,'progressive');assert.equal(returned[1].s.metronome,false);
window.PianoCoach.act({kind:'rhythm',report:saved1,advice:{code:'pulse'}});assert.equal(saved(launched.at(-1).ex,'retry').exercise.phraseOrigin.exercise.events[0].targets[0].note.midi,C.parse('C4').midi);
const invalid=JSON.parse(JSON.stringify(launched[0].ex));invalid.phraseOrigin.exercise.events[0].targets[0].note.index=999;assert.equal(saved(invalid,'bad').exercise.phraseOrigin,null);assert.equal(render(saved(invalid,'bad2')).children.length,0);
const other=R.generate({course:'free',mode:'pattern'});assert.equal(render(saved(other,'other')).children.length,0);
const report={kind:'anchors',settings:{clef:'bass'}};window.PianoCoach.act({kind:'study',report,advice:{action:'continue'}});assert.strictEqual(continued[0],report);
console.log('Coach UI: durable independent phrase returns, validation, retry and continue passed.');
