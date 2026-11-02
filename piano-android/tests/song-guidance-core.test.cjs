const test=require('node:test'),assert=require('node:assert/strict'),G=require('../web/song-guidance-core.js'),C=require('../web/song-core.js'),L=require('../web/song-learning.js'),B=require('../web/song-bank.js');
const n=(id,pitch,start,duration,staff,finger='')=>({id,pitch,start,duration,staff,finger});
test('each hand previews its own next onset while a long bass note is held',()=>{
 const notes=[n('l',48,0,4,2,'5'),n('l2',53,4,4,2,'5'),n('r1',60,0,1,1,'1'),n('r2',62,1,1,1,'2'),n('r3',64,2,1,1,'3')],f=G.frame(notes,1.2);
 assert.deepEqual(f.current.map(x=>x.id),['l','r2']);assert.deepEqual(f.next.map(x=>x.id),['r3','l2']);
});
test('simultaneous hand targets retain both roles and missing fingering stays empty',()=>{
 const notes=[n('r',60,0,1,1,'1'),n('l',60,0,1,2,'5'),n('next',61,1,1,1)],m=G.keyStates(G.frame(notes,0));assert.equal(m.get(60).current.length,2);assert.equal(m.get(61).next[0].finger,'');
});
test('loop preview wraps each hand without leaking beyond the selected segment',()=>{
 const notes=[n('first',60,4,1,1),n('last',64,7,1,1),n('outside',67,8,1,1)];assert.deepEqual(G.frame(notes,7,{loop:true,from:4,to:8}).next.map(n=>n.id),['first']);assert.deepEqual(G.frame(notes,7,{loop:false,from:4,to:8}).next,[]);
});
test('hand override changes prepared targets without changing source data',()=>{
 const s=B.all().find(s=>s.id==='builtin-hands-8'),original=JSON.stringify(s.notes),r=C.prepared(s,{hand:'right'}),sw=C.prepared(s,{hand:'right',handMap:'swap'});assert(r.notes.every(n=>n.pitch>=60));assert(sw.notes.every(n=>n.pitch<60));assert.equal(JSON.stringify(s.notes),original);assert(r.notes.some(n=>n.finger));
});
test('a perfect but assisted round never grants independent evidence',()=>{
 const r={complete:true,interrupted:false,assisted:true,settings:{},result:{total:1,correct:1,onTime:null,wrong:0,hinted:0,extras:[],answers:[{correct:true,hint:false}]}};assert.equal(L.clean(r),false);r.assisted=false;assert.equal(L.clean(r),true);
});
