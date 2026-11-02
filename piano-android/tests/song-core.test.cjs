const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../web/song-core.js');
const vlq=n=>{const b=[n&127];while(n>>=7)b.unshift((n&127)|128);return b;};
function midi(events,{format=0,ppq=480}={}){
 const track=Buffer.from([...events.flatMap(([dt,...e])=>[...vlq(dt),...e]),0,255,47,0]),h=Buffer.alloc(14);
 h.write('MThd');h.writeUInt32BE(6,4);h.writeUInt16BE(format,8);h.writeUInt16BE(1,10);h.writeUInt16BE(ppq,12);
 const th=Buffer.alloc(8);th.write('MTrk');th.writeUInt32BE(track.length,4);return Buffer.concat([h,th,track]);
}
test('SMF running status, note-on zero, tempo map and change of meter',()=>{
 const bytes=midi([[0,255,81,3,7,161,32],[0,255,88,4,3,2,24,8],[0,144,60,90],[480,60,0],[0,255,81,3,15,66,64],[0,144,64,70],[480,128,64,0]]);
 const s=C.parseMidi(bytes,'练习.mid');assert.equal(s.title,'练习');assert.deepEqual(s.notes.map(n=>[n.pitch,n.start,n.duration]),[[60,0,1],[64,1,1]]);assert.equal(s.measures[0].beats,3);assert.equal(C.secondsAt(s,2),1.5);assert(Math.abs(C.beatAt(s,1.5)-2)<1e-5);
});
test('truncated, SMPTE, format 2, and unmatched notes fail explicitly',()=>{
 assert.throws(()=>C.parseMidi(Buffer.from('MThd')),/截断/);assert.throws(()=>C.parseMidi(midi([],{ppq:0x8001})),/SMPTE/);assert.throws(()=>C.parseMidi(midi([],{format:2})),/格式 2/);assert.throws(()=>C.parseMidi(midi([[0,144,60,90]])),/缺少松键/);
});
test('single input event cannot satisfy two targets, exact pitches are reserved first',()=>{
 const song=C.demo(),s={mode:'advanced',from:1,to:1},ex=C.prepared(song,s),r=C.evaluate(song,ex,[{pitch:60,ms:0}]);assert.equal(r.correct,1);assert.equal(r.missed,4);assert.equal(r.total,5);
 const extra=C.evaluate(song,ex,[{pitch:60,ms:0},{pitch:48,ms:10},{pitch:60,ms:20}]);assert.equal(extra.correct,2);assert.equal(extra.extras.length,1);
});
test('tempo scaling, input offset, missed and wrong notes remain separately visible',()=>{
 const song=C.demo(),ex=C.prepared(song,{mode:'advanced',from:1,to:1,hand:'right',tempo:120,offset:100});
 const r=C.evaluate(song,ex,[{pitch:60,ms:100},{pitch:62,ms:600},{pitch:65,ms:1100}]);assert.equal(r.correct,2);assert.equal(r.onTime,2);assert.equal(r.wrong,1);assert.equal(r.missed,1);assert.equal(r.medianOffset,0);
});
test('unfinished future targets are unvisited; selected hand uses its own expected events',()=>{
 const song=C.demo(),ex=C.prepared(song,{from:1,to:2,hand:'right'});assert(ex.notes.every(n=>n.staff===1));const r=C.evaluate(song,ex,[{pitch:60,ms:0}],900);assert.equal(r.total,1);assert.equal(r.correct,1);assert.equal(r.missed,0);
});
test('MIDI engraving retains polyphonic sustained notes with independent voices',()=>{
 const s=C.demo(),xml=C.toXML(s,{from:1,to:4});assert.match(xml,/<backup>/);assert.equal((xml.match(/<measure /g)||[]).length,4);assert.match(xml,/<duration>384<\/duration>/);assert.match(xml,/<staff>2<\/staff>/);assert.match(xml,/<step>C<\/step><octave>4<\/octave>/);
});
test('quantization does not mutate MIDI playback; repeat same pitch remains a new onset',()=>{
 const song=C.demo();song.notes[1].start=.11;const before=JSON.stringify(song.notes);C.prepared(song,{grid:.25});assert.equal(JSON.stringify(song.notes),before);const ex=C.prepared(C.demo(),{hand:'right',from:2,to:2});assert.equal(ex.groups.filter(g=>g.notes.some(n=>n.pitch===67)).length,2);
});
test('invalid library data cannot inject a nonfinite tempo or discontinuous timeline',()=>{
 const s=C.demo();s.tempos[0].bpm=Infinity;assert.throws(()=>C.fromStored(s),/速度/);const d=C.demo();d.measures[1].start=99;assert.throws(()=>C.fromStored(d),/不连续/);
});

test('onset tolerance follows the actual local tempo after an imported tempo change',()=>{
 const song=C.demo();song.baseTempo=120;song.tempos=[{beat:0,bpm:120},{beat:1,bpm:60}];
 const ex=C.prepared(song,{mode:'advanced',hand:'right',from:1,to:1,tempo:120});
 const r=C.evaluate(song,ex,[{pitch:62,ms:700}]);assert.equal(r.correct,1);assert.equal(r.onTime,1);
});
