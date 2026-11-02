const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../web/song-core.js'),L=require('../web/song-learning.js'),B=require('../web/song-bank.js');
let serial=0;
function result(song,s){const ex=C.prepared(song,s),answers=ex.groups.flatMap(g=>g.notes.map(n=>({id:n.id,pitch:n.pitch,actual:n.pitch,correct:true,timing:true,hint:false,measure:g.measure,sourceBeat:n.start,beat:g.beat,staff:n.staff})));return {total:answers.length,correct:answers.length,onTime:s.mode==='beginner'?null:answers.length,wrong:0,hinted:0,extras:[],answers,score:100,completed:answers.length};}
function report(song,t){return {id:'test-'+(++serial),songId:song.id,source:t.source||'midi',settings:{...t.settings},task:JSON.parse(JSON.stringify(t)),complete:true,interrupted:false,result:t.settings.mode==='listen'?null:result(song,t.settings)};}
test('graded pieces have balanced complete bars, length progression and declared prerequisites',()=>{
 const songs=B.all();assert.equal(songs.length,8);assert(songs.some(s=>s.measures.length===16));assert(songs.some(s=>s.notes.some(n=>n.spelling?.alter)));
 for(const s of songs){assert(s.study.goal&&s.study.prerequisite);assert(s.notes.every(n=>n.start+n.duration<=s.duration));const xml=C.toXML(s,{});assert.equal((xml.match(/<measure /g)||[]).length,s.measures.length);}
 const sharp=songs.find(s=>s.id==='builtin-black-16');assert.match(C.toXML(sharp),/<step>F<\/step><alter>1<\/alter>/);
 const chord=songs.find(s=>s.id==='builtin-chord-8');assert(C.prepared(chord,{from:1,to:8}).groups.some(g=>g.notes.length===2));
});
test('one route connects two-bar segments; listening, hands, slow and target checks use exact tickets',()=>{
 const s=C.demo(),d=L.defaults(),goal={tempo:60,hand:'both'};let t=L.next(d,s,goal,'midi');assert.equal(t.route.stage,'listen');
 L.observe(d,s,report(s,t),1000);t=L.next(d,s,goal,'midi');assert.equal(t.route.stage,'right');assert.equal(t.settings.hand,'right');
 const altered=report(s,t);altered.settings.tempo=70;assert.equal(L.observe(d,s,altered,1100).route,null);
 const good=report(s,t),x=L.observe(d,s,good,1200);assert(x.route.advanced);assert.equal(L.observe(d,s,good,1300).duplicate,true);
 t=L.next(d,s,goal,'midi');assert.equal(t.route.stage,'left');L.observe(d,s,report(s,t),1400);
 t=L.next(d,s,goal,'midi');assert.equal(t.route.stage,'read');const hinted=report(s,t);hinted.result.hinted=1;hinted.result.answers[0].hint=true;assert.equal(L.observe(d,s,hinted,1500).route.passed,false);
 for(let i=0;i<5;i++){t=L.next(d,s,goal,'midi');L.observe(d,s,report(s,t),2000+i);}
 const p=L.plan(d,s,goal,'midi').plan;assert.equal(p.unit,1);assert.equal(p.stage,0);assert(p.units.some(u=>u.from===1&&u.to===4&&u.connected));
 const touch=L.plan(d,s,goal,'touch').plan;assert.equal(touch.unit,0);
});
test('pause, source switch, incomplete and rhythm drills never award clean evidence',()=>{
 const s=C.demo();for(const kind of ['interrupted','incomplete','source','drill']){const d=L.defaults();let t=L.next(d,s,{},'midi');L.observe(d,s,report(s,t));t=L.next(d,s,{},'midi');const r=report(s,t);if(kind==='interrupted')r.interrupted=true;if(kind==='incomplete')r.complete=false;if(kind==='source')r.source='touch';if(kind==='drill')r.settings.drill='rhythm';const x=L.observe(d,s,r);assert(!x.route?.advanced,kind);assert.equal(L.plan(d,s,{},'midi').plan.stage,1);}
});
test('ten-minute due checks survive reload; ordinary repetitions do not postpone review',()=>{
 const s=C.demo(),d=L.defaults(),settings=C.settings(s,{mode:'beginner',hand:'right'}),t={source:'midi',settings};let r=report(s,t);const first=L.observe(d,s,r,1000).memory,initialDue=first.due;
 L.observe(d,s,report(s,t),2000);assert.equal(d.memory[first.key].due,initialDue);assert.equal(L.due(d,'touch',initialDue).length,0);assert.equal(L.due(d,'midi',initialDue).length,1);
 let review=L.review(d,L.due(d,'midi',initialDue)[0]);L.observe(d,s,report(s,review),initialDue);let restored=L.normalize(JSON.parse(JSON.stringify(d)));assert.equal(restored.memory[first.key].confirm,1);assert.equal(L.due(restored,'midi',initialDue+100).length,0);
 const second=restored.memory[first.key].due;review=L.review(restored,L.due(restored,'midi',second)[0]);L.observe(restored,s,report(s,review),second);assert.equal(restored.memory[first.key].status,'stable');assert(restored.memory[first.key].due>=initialDue+86400000);
 for(let i=0;i<2;i++){const nextDue=restored.memory[first.key].due;review=L.review(restored,L.due(restored,'midi',nextDue)[0]);L.observe(restored,s,report(s,review),nextDue);}
 assert.equal(restored.memory[first.key].status,'retained');
});
test('assisted or failed performance schedules retrieval and clean free attempts cannot erase it',()=>{
 const s=C.demo(),d=L.defaults(),settings=C.settings(s,{mode:'beginner'}),t={source:'midi',settings},r=report(s,t);r.result.hinted=1;r.result.answers[0].hint=true;r.result.correct--;
 const m=L.observe(d,s,r,1000).memory;assert.equal(m.status,'assisted');L.observe(d,s,report(s,t),3000);assert.equal(d.memory[m.key].status,'assisted');assert.equal(d.memory[m.key].due,m.due);
});

test('a perfect assisted timed round never gets independent-completion advice',()=>{
 const s=C.demo(),t={source:'midi',settings:C.settings(s,{mode:'advanced'})},r=report(s,t);r.assisted=true;
 assert.equal(L.clean(r),false);assert.equal(L.diagnosis(s,r).code,'observe');assert.match(L.diagnosis(s,r).title,/收起帮助/);
});
test('diagnosis prioritizes repeated later bar and isolates timing without changing the source phrase',()=>{
 const s=C.demo(),d=L.defaults(),settings=C.settings(s,{mode:'advanced',from:1,to:4}),t={source:'midi',settings},r=report(s,t);r.result.answers[0].correct=false;r.result.answers[0].actual=61;
 for(const a of r.result.answers.filter(a=>a.measure===3)){a.correct=false;a.actual=a.pitch+1;}r.result.correct=r.result.answers.filter(a=>a.correct).length;
 assert.equal(L.diagnosis(s,r).focus,3);const fix=L.remedy(d,s,r);assert.equal(fix.settings.from,3);assert.equal(fix.settings.to,3);assert.equal(fix.settings.mode,'beginner');assert.deepEqual(fix.origin,settings);
 const timed=report(s,t);for(const a of timed.result.answers.filter(a=>a.measure===2)){a.timing=false;a.delta=250;}timed.result.onTime=timed.result.answers.filter(a=>a.timing).length;
 const rhythm=L.remedy(d,s,timed);assert.equal(rhythm.settings.drill,'rhythm');assert.equal(rhythm.settings.mode,'advanced');assert.equal(rhythm.settings.from,2);assert.equal(rhythm.origin.tempo,settings.tempo);
});
test('hints preserve bass references, diatonic distance, accidentals and only reveal answers last',()=>{
 const low=L.hint({pitch:52,staff:2},1);assert(low.bass);assert.equal(low.reference,53);assert(!low.text.includes('答案'));
 const sharp={pitch:66,staff:1,spelling:{step:'F',alter:1,octave:4}},h2=L.hint(sharp,2),h3=L.hint(sharp,3);assert(h2.text.includes('升一个半音'));assert(!h2.text.includes('答案'));assert(h3.text.includes('答案：F♯4'));
 const upper=L.hint({pitch:89,staff:1},2);assert(upper.targetOffset>8);assert.equal(upper.steps,7);
});
test('restored route resumes a safe step and forged note spelling is rejected',()=>{
 const s=C.demo(),d=L.defaults(),t=L.next(d,s,{},'midi'),restored=L.normalize(JSON.parse(JSON.stringify(d)));assert.equal(restored.plans[t.planKey].ticket,null);assert.equal(restored.current.midi.route,null);assert.equal(restored.current.midi.planKey,t.planKey);
 const bad=C.demo();bad.notes[0].spelling={step:'X',alter:0,octave:4};assert.throws(()=>C.fromStored(bad),/拼写/);
});

test('empty opening segments and absent selected hand cannot strand a route',()=>{
 const s=C.demo();s.notes=s.notes.filter(n=>n.start>=8);let p=L.plan(L.defaults(),s,{hand:'right'},'midi').plan;assert.equal(p.units[0].from,3);
 const single=C.demo();single.notes=single.notes.filter(n=>n.staff===1);assert.equal(L.next(L.defaults(),single,{hand:'left'},'midi'),null);
});

test('a repeatedly troublesome later bar outranks an isolated equal-weight earlier error',()=>{
 const s=C.demo(),t={source:'midi',settings:C.settings(s,{mode:'advanced',from:1,to:4})},r=report(s,t),old=report(s,t);
 for(const [rr,bars]of [[r,[1,3]],[old,[3]]])for(const bar of bars){const a=rr.result.answers.find(a=>a.measure===bar);a.correct=false;a.actual=a.pitch+1;}
 assert.equal(L.diagnosis(s,r,[old]).focus,3);assert.equal(L.remedy(L.defaults(),s,r,[old]).settings.from,3);
 old.source='touch';assert.equal(L.diagnosis(s,r,[old]).focus,1);
});
