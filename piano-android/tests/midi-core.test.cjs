const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx=vm.createContext({console});for(const f of ['core.js','midi-core.js','rhythm-core.js','study-core.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../web',f),'utf8'),ctx);
const M=ctx.MidiCore,C=ctx.PianoCore,S=ctx.StudyCore,R=ctx.RhythmCore,t=M.tracker();
const event=(type,note=60,channel=0,velocity=80)=>({type,note,channel,velocity});
assert(t.accept(event('on')));assert(!t.accept(event('on')));assert(!t.accept(event('on',60,1)));assert.equal(t.held.size,2);assert(!t.accept(event('off')));assert(t.accept(event('off',60,1)));assert.equal(t.held.size,0);
assert(!t.accept(event('on',60,0,0)));assert(!t.accept(event('on',128)));assert(!t.accept(event('on',60,16)));
assert(t.accept({type:'pedal',channel:0,value:127}));assert.equal(t.pedals.size,1);assert(t.accept(event('on')));assert(t.accept({type:'reset',channel:0}));assert.equal(t.held.size,0);assert.equal(t.pedals.size,0);
assert.match(M.feedback(60,72),/八度/);assert.match(M.feedback(60,48),/低了/);
let seed=99;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const pools={};
for(const difficulty of ['beginner','basic','extended'])for(const clef of ['treble','bass','mixed'])for(const kind of ['anchors','contrast','ledger','reverse']){
 const targets=S.topicTargets(kind,clef,S.defaults(),random,600,difficulty);assert.equal(targets.length,600);assert(targets.every(t=>t.note.midi>=21&&t.note.midi<=108));
 if(kind!=='contrast')for(let i=1;i<targets.length;i++)assert.notEqual(C.profileKey(targets[i]),C.profileKey(targets[i-1]));
 pools[kind+':'+difficulty+':'+clef]=new Set(targets.map(C.profileKey)).size;
}
assert(pools['anchors:basic:treble']>3);assert(pools['contrast:basic:treble']>4);assert(pools['ledger:extended:treble']>7);assert(pools['reverse:extended:treble']>13);
const phraseNotes=new Set();let phrases=0;
for(const difficulty of ['beginner','basic','extended'])for(const clef of ['treble','bass','mixed','dual'])for(const pattern of ['steps','repeat','thirds','mixed'])for(const notes of [2,6,15])for(const dual of ['alternate','sustain','together']){
 const s={...S.defaults().settings,difficulty,clef,pattern,notes,dual};const p=S.phrase(s,S.defaults(),random),ts=p.events.flatMap(e=>e.targets);
 assert.equal(ts.length,notes);assert(p.totalBeats%4===0);ts.forEach(t=>{assert(C.pool(difficulty,t.clef).some(n=>n.midi===t.note.midi));phraseNotes.add(C.profileKey(t));});phrases++;
}
assert(phraseNotes.size>10);assert.equal(S.normalize({settings:{count:60,difficulty:'extended'}}).settings.count,60);
const templates={};for(const beats of [2,3,4])templates[beats+'/4']=[1,2,3].map(level=>R.templates(beats,level).length);
console.log(JSON.stringify({midiTracker:'pass',duplicateChannels:'pass',pedalAndReset:'pass',phrases,phraseCoverage:phraseNotes.size,templates,pools}));
