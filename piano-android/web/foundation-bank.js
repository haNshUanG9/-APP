/* Authored lessons. Each bar is checked; a new pitch or rhythm has its own lesson. */
'use strict';
const FoundationBank=(()=>{
 const midi=s=>{const m=/^([A-G])(\d)$/.exec(s);return m?(+m[2]+1)*12+({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[m[1]]:null;};
 const target=(note,clef='treble')=>({midi:midi(note),clef});
 function piece(id,title,notation,clef='treble'){
  const events=[];let beat=0;const bars=notation.split('|');
  for(const bar of bars){let length=0;for(const token of bar.trim().split(/\s+/)){const [raw,d='1']=token.split(':'),duration=Number(d),[staff,pitch]=raw.includes('@')?raw.split('@'):[clef,raw],rest=pitch==='-';if(![.5,1,2,4].includes(duration)||!['treble','bass'].includes(staff)||!rest&&midi(pitch)===null)throw Error('Bad authored note: '+id);events.push({beat,duration,rest,clef:staff,midi:rest?null:midi(pitch)});beat+=duration;length+=duration;}if(length!==4)throw Error('Unbalanced bar: '+id);}
  return {id,title,events,totalBeats:beat,bars:bars.length};
 }
 const CHAPTERS=['三个音，先认准','长短与留白','走向中央 C','向高音延伸','换到低音谱表','把它连成音乐'];
 const specs=[
  ['g4','G4 · 找到参照线',0,'treble','G4','G4','从高音谱表第二线认识 G4。只练一个音的起步课可以快速完成。','四拍的起点','G4 G4 G4 G4','连起两个小节','G4 G4 G4 G4 | G4 G4 G4 G4'],
  ['f4','加入 F4 · 向下一间',0,'treble','F4','F4 G4','G4 向下相邻一间是 F4；交替认，不靠题目顺序猜。','一问一答','G4 F4 G4 F4 | F4 G4 F4 G4','换一个开头','F4 F4 G4 F4 | G4 G4 F4 G4'],
  ['a4','加入 A4 · 向上一间',0,'treble','A4','F4 G4 A4','以 G4 为中间参照，分清上方 A4 与下方 F4。','小小山坡','F4 G4 A4 G4 | A4 G4 F4 G4','山坡回声','G4 A4 G4 F4 | A4 A4 G4 F4'],
  ['long','二分音符 · 声音走两拍',1,'treble',null,'F4 G4 A4','保持三个已学音，只加入二分音符。起点不重复按，声音延续两拍。','拉长的回答','G4:2 A4 G4 | F4:2 G4:2','长短对话','F4 G4 A4:2 | G4:2 F4:2'],
  ['rest','四分休止 · 空白也数拍',1,'treble',null,'F4 G4 A4','只加入一拍休止。休止处保持安静，心里仍然数拍。','留一点空白','G4 - A4 G4 | F4 G4 - G4','等待再回答','F4 G4 - A4 | G4 - F4 G4'],
  ['e4','加入 E4 · 谱表第一线',2,'treble','E4','E4 F4 G4 A4','先找到 G4，向下经过 F4 的间，再落在 E4 的线上。','沿阶梯下来','G4 F4 E4 F4 | G4 A4 G4:2','从低处出发','E4 F4 G4:2 | A4 G4 F4 E4'],
  ['d4','加入 D4 · 谱表下方一间',2,'treble','D4','D4 E4 F4 G4','从 E4 第一线向下相邻一步是 D4，不要把线间数反。','低处的脚步','D4 E4 F4 G4 | G4 F4 E4 D4','回到起点','G4 E4 D4:2 | D4 F4 E4 D4'],
  ['c4','中央 C · 第一条下加线',2,'treble','C4','C4 D4 E4 F4 G4','中央 C 在高音谱表下方第一条加线上；向上经 D4 到 E4。','中央 C 的阶梯','C4 D4 E4 F4 | G4 E4 C4:2','回家的路','E4 D4 C4:2 | C4 E4 D4 C4'],
  ['connect','连接 C4—A4 · 认走向',2,'treble',null,'C4 D4 E4 F4 G4 A4','不加新音。练级进、重复和小跳进，把单音关系放进四小节。','晨光小路','C4 D4 E4 G4 | A4 G4 E4:2 | F4 E4 D4 - | C4:2 C4:2','小路的另一端','G4 E4 C4 D4 | E4 F4 G4:2 | A4 G4 F4 D4 | C4:2 -:2'],
  ['b4','加入 B4 · 谱表中线',3,'treble','B4','F4 G4 A4 B4','B4 在高音谱表第三线。从 G4 经 A4 向上找到它。','抬头的旋律','G4 A4 B4 A4 | B4 G4 F4:2','中线来回','B4 A4 G4:2 | F4 G4 A4 B4'],
  ['c5','加入 C5 · 第三间',3,'treble','C5','G4 A4 B4 C5','C5 与中央 C 同名，高一个八度；用谱位和键位一起确认。','向上的窗','G4 A4 B4 C5 | C5 B4 A4 G4','从窗边回来','C5 A4 B4:2 | A4 G4 C5:2'],
  ['eighth','成对八分 · 一拍分两半',3,'treble',null,'G4 A4 B4 C5','固定已学音，只加入成对八分。先数 1 &，再回到四分拍。','轻快一步','G4:0.5 A4:0.5 B4 G4:2 | A4 B4 C5:2','半拍小回声','B4 A4:0.5 G4:0.5 A4 B4 | C5:2 B4 G4'],
  ['bass-f','低音 F3 · 第四线参照',4,'bass','F3','F3','低音谱号两点夹着第四线 F3。先建立新的谱表参照。','低音的脉搏','F3 F3 F3 F3 | F3 F3 F3 F3','低音长短','F3:2 F3 F3 | F3 F3 F3:2'],
  ['bass-e','加入 E3 · 第三间',4,'bass','E3','E3 F3','从低音 F3 第四线向下相邻一间，就是 E3。','低音对答','F3 E3 F3 E3 | E3 F3 E3:2','换边的回答','E3 E3 F3:2 | F3 E3 F3 E3'],
  ['bass-g','加入 G3 · 第四间',4,'bass','G3','E3 F3 G3','从 F3 第四线向上相邻一间是 G3，和下方 E3 对照。','低音小山坡','E3 F3 G3 F3 | G3 F3 E3:2','山坡另一侧','G3 F3 E3 - | F3 G3 F3 E3'],
  ['bass-c','加入 C3 · 第二间',4,'bass','C3','C3 E3 F3 G3','低音 C3 在第二间；从 F3 向下经过 E3、D3 的位置找到它。D3 只作数位置，不作新答题音。','低音归途','C3 E3 F3 G3 | F3 E3 C3:2','归途变奏','G3 F3 E3 C3 | C3 E3 F3:2'],
  ['switch','高低谱表轮换 · 先看谱号',5,'mixed',null,'treble@F4 treble@G4 treble@A4 bass@E3 bass@F3 bass@G3','一次只弹一个音。先确认谱号，再找各自的参照线；这里练谱表切换，不要求双手同时。','高低音对话','treble@G4 treble@A4 treble@F4:2 | bass@F3 bass@G3 bass@E3:2 | treble@F4 treble@G4 treble@A4 treble@G4 | bass@G3 bass@F3 bass@E3 bass@F3','交换一句话','bass@E3 bass@F3 bass@G3 bass@F3 | treble@A4 treble@G4 treble@F4 treble@G4 | bass@F3:2 bass@E3:2 | treble@G4:2 treble@F4:2'],
  ['music','四小节小练习 · 读、拍、连',5,'treble',null,'C4 D4 E4 F4 G4 A4 B4 C5','不加新知识。用已学音、长短、休止与一组八分，完成四小节，再读一条新编乐句。','窗边的练习曲','C4 E4 G4:2 | A4 G4:0.5 F4:0.5 E4 D4 | F4 A4 G4 - | E4 D4 C4:2','晚风的回答','G4 A4 B4 C5 | B4:2 G4 A4 | F4:0.5 E4:0.5 D4 E4 - | D4:2 C4:2']
 ];
 const LESSONS=specs.map(([id,title,chapter,clef,newName,names,concept,a,base,b,variation],index)=>{
  const pool=names.split(' ').map(s=>s.includes('@')?target(s.split('@')[1],s.split('@')[0]):target(s,clef));
  const reference=clef==='bass'?target('F3','bass'):target('G4');
  const listen=[];for(const staff of [...new Set(pool.map(t=>t.clef))]){const ns=pool.filter(t=>t.clef===staff).map(t=>t.midi),lo=ns[0],hi=ns.at(-1);listen.push({reference:lo,second:lo,clef:staff},{reference:lo,second:ns.length>1?hi:lo+12,clef:staff},{reference:ns.length>1?hi:lo+12,second:lo,clef:staff});}
  // A second pass reverses the order; every direction is heard twice, not just clicked once.
  const listening=[...listen,...listen.slice().reverse()].map(p=>({...p,answer:p.second===p.reference?'same':p.second>p.reference?'higher':'lower'}));
  const ns=pool.filter(t=>t.clef===pool[0].clef).map(t=>t.midi),last=ns.length-1,at=i=>ns[Math.min(last,i)];
  const echoes=[[at(0),at(last)],[at(last),at(0)],[at(0),at(1),at(0)],[at(last),at(Math.max(0,last-1)),at(0)],[at(0),at(1),at(last),at(1)],[at(last),at(1),at(0),at(last)]];
  return {id,index,title,chapter,clef,pool,newTarget:newName?target(newName,clef):null,reference,concept,listening,echoes,echoClef:pool[0].clef,pieces:[piece(id+'-a',a,base,clef==='mixed'?'treble':clef),piece(id+'-b',b,variation,clef==='mixed'?'treble':clef)],tempo:index<3?50:60};
 });
 function exercise(p){return {events:p.events.map(e=>{const targets=e.rest?[]:[{clef:e.clef,note:typeof PianoCore==='undefined'?{midi:e.midi}:PianoCore.fromIndex(Math.floor(e.midi/12-1)*7+[0,2,4,5,7,9,11].indexOf(e.midi%12))}];return {beat:e.beat,duration:e.duration,rest:e.rest,targets,voices:e.rest?[]:[{duration:e.duration,targets}]};}),totalBeats:p.totalBeats,clefs:[...new Set(p.events.filter(e=>!e.rest).map(e=>e.clef))]};}
 return {LESSONS,CHAPTERS,midi,target,piece,exercise};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=FoundationBank;
