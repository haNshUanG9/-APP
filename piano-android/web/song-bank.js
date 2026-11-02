/* Original graded studies: complete phrases with one declared focus per piece. */
'use strict';
const SongBank=(()=>{
  const C=typeof SongCore==='undefined'?require('./song-core.js'):SongCore;
  function make(id,title,level,goal,prerequisite,right,left='',tempo=60,beats=4){
    const notes=[],bars=right.split('|').length;
    const line=(text,staff)=>{if(!text)return;if(text.split('|').length!==bars)throw Error('左右手小节不齐：'+id);text.split('|').forEach((bar,i)=>{let at=0;for(const token of bar.trim().split(/\s+/)){const [name,d='1']=token.split(':'),duration=Number(d);if(!(duration>0))throw Error('时值错误');if(name!=='-')for(const raw of name.split('+')){const m=/^([A-G])([#b]?)([0-8])$/.exec(raw);if(!m)throw Error('音名错误：'+raw);const alter=m[2]==='#'?1:m[2]==='b'?-1:0,pitch=(+m[3]+1)*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+alter;notes.push({id:id+'-'+staff+'-'+notes.length,pitch,start:i*beats+at,duration,velocity:staff===1?78:58,staff,track:'piano',spelling:{step:m[1],alter,octave:+m[3]}});}at+=duration;}if(Math.abs(at-beats)>.001)throw Error('小节不平衡：'+id+' 第'+(i+1)+'小节');});};
    line(right,1);line(left,2);notes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
    return C.fromStored({version:1,id,title,format:'midi',notes,tracks:[{id:'piano',name:'钢琴'}],tempos:[{beat:0,bpm:tempo}],meters:[{beat:0,beats,unit:4}],measures:Array.from({length:bars},(_,i)=>({index:i+1,label:String(i+1),start:i*beats,end:(i+1)*beats,beats,unit:4})),warnings:[],study:{level,goal,prerequisite,original:true}});
  }
  function all(){
    const demo=C.demo();demo.study={level:1,goal:'右手逐拍旋律与左手长音，先分手再连接四小节。',prerequisite:'认识 C4—A4 与低音 C3/F3/G3，能保持四拍。',original:true};
    const songs=[demo,
      make('builtin-path-4','纸上小路 · 四小节',1,'用已学自然音连接四小节，不增加双手负担。','认得 C4—G4，理解四分与二分。','C4 D4 E4 G4 | G4 E4 D4:2 | F4 E4 D4 - | E4 D4 C4:2'),
      make('builtin-evening-8','晚风问答 · 八小节',2,'保持原音组与四拍，练句尾等待和前后句连接。','能独立读准四小节，认识一拍休止。','C4 E4 G4:2 | A4 G4 E4 - | F4 E4 D4:2 | E4 D4 C4 - | E4 G4 A4:2 | G4 E4 F4 - | D4 E4 D4:2 | C4:2 -:2'),
      make('builtin-bass-8','低音回声 · 八小节',2,'沿低音参照音读出完整两句，右手休息。','认得低音 C3/E3/F3/G3，理解二分。','-:4 | -:4 | -:4 | -:4 | -:4 | -:4 | -:4 | -:4','C3 E3 F3 G3 | G3 F3 E3:2 | F3 E3 C3:2 | G3:2 -:2 | C3 F3 G3:2 | E3 F3 E3 C3 | F3 E3 G3:2 | C3:2 -:2'),
      make('builtin-hands-8','双手小舟 · 八小节',3,'右手保持四分与二分，左手每小节一个长音。','两只手分别读准；低音长音期间右手继续。','E4 G4 A4 G4 | F4 E4 D4:2 | E4 F4 G4 E4 | D4:2 C4:2 | G4 A4 G4 E4 | F4 G4 E4:2 | D4 E4 F4 D4 | E4 D4 C4:2','C3:4 | F3:4 | C3:4 | G3:4 | C3:4 | F3:4 | G3:4 | C3:4',60),
      make('builtin-breeze-16','半拍微风 · 十六小节',4,'固定单手音域，只增加成对八分；连接四个四小节乐句。','能连接八小节，先在节奏课练稳半拍细分。','C4 D4 E4 G4 | A4:2 G4:2 | F4:0.5 E4:0.5 D4 E4 F4 | E4 D4 C4:2 | E4 F4 G4 A4 | G4:2 E4 - | F4 E4:0.5 D4:0.5 E4 D4 | C4:2 -:2 | G4 E4 F4 G4 | A4 G4 E4:2 | D4:0.5 E4:0.5 F4 E4 D4 | E4:2 G4:2 | A4 G4 F4 E4 | F4:2 D4 - | E4:0.5 F4:0.5 G4 E4 D4 | C4:2 -:2','',60),
      make('builtin-black-16','窗边新色 · 十六小节',5,'保持单手与原有时值，只加入 F♯；听自然 F 与升 F 的区别。','熟悉 C4—C5、两小节拆练和十六小节连接。','G4 A4 B4 A4 | G4:2 F#4:2 | E4 G4 A4 F#4 | G4:2 -:2 | B4 A4 G4 E4 | F#4:2 A4:2 | G4 E4 F#4 A4 | G4:2 -:2 | G4 B4 C5 B4 | A4 G4 F#4:2 | E4 F#4 G4 A4 | B4:2 G4:2 | C5 B4 A4 G4 | F#4 A4 G4 E4 | A4 F#4 D4:2 | G4:2 -:2','',60),
      make('builtin-chord-8','和音灯火 · 八小节',5,'右手只弹二音和声，先找齐位置，再检查同时起音。','认得 C4—A4；同组找音熟悉后再进入跟拍。','C4+E4:2 E4+G4:2 | D4+F4:2 C4+E4:2 | F4+A4:2 E4+G4:2 | D4+F4:2 -:2 | E4+G4:2 F4+A4:2 | D4+F4:2 E4+G4:2 | F4+A4:2 D4+F4:2 | C4+E4:2 -:2','',50)
    ];
    // Authored for these exact phrases; no pitch-to-finger guessing for imported scores.
    const fingerBars={
      'builtin-path-4':['1 2 3 5','5 3 2','4 3 2','3 2 1'],
      'builtin-hands-8':['1 3 5 3','4 3 2','3 4 5 3','2 1','3 5 3 1','2 3 1','2 3 4 2','3 2 1']
    };
    for(const song of songs){const bars=fingerBars[song.id];if(!bars)continue;
      bars.forEach((line,i)=>{song.notes.filter(n=>n.staff===1&&n.start>=i*4&&n.start<(i+1)*4).forEach((n,j)=>{n.finger=line.split(' ')[j]||'';n.fingerSource='authored';});});
      if(song.id==='builtin-hands-8')song.notes.filter(n=>n.staff===2).forEach(n=>{n.finger='5';n.fingerSource='authored';});
    }
    return songs;
  }
  return Object.freeze({all});
})();
if(typeof globalThis!=='undefined')globalThis.SongBank=SongBank;
if(typeof module!=='undefined')module.exports=SongBank;
