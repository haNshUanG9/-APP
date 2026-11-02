/* Diatonic reading cues; staff steps are not chromatic semitones. */
const HintCore=(()=>{
  'use strict';
  const C=PianoCore;
  const LEVELS=['独立认出','看参照后完成','看关系后完成','看答案后完成'];
  const clampLevel=n=>Math.max(0,Math.min(3,Math.floor(Number(n)||0)));
  function reference(target,options={}){
    const c=target.clef,index=target.note.index;
    if(options.previous?.clef===c&&Math.abs(options.previous.note.index-index)<=7)return {...options.previous,reason:'刚才已弹对的音'};
    const known=(options.known||[]).filter(t=>t.clef===c&&Math.abs(t.note.index-index)<=7);
    const preferred=options.reference?{clef:c,note:C.parse(options.reference)}:null;
    if(preferred&&Math.abs(preferred.note.index-index)<=4)return {...preferred,reason:'本组参照音'};
    const landmarks=(c==='treble'?['G4','C5','F5','C4']:['F3','C3','G2','C4']).map(n=>({clef:c,note:C.parse(n)}));
    const candidates=known.length?known:landmarks;
    const best=candidates.slice().sort((a,b)=>Math.abs(a.note.index-index)-Math.abs(b.note.index-index))[0];
    return {...best,reason:known.length?'已经练过的附近音':'附近参照音'};
  }
  function model(target,options={}){
    const ref=reference(target,options),delta=target.note.index-ref.note.index,steps=Math.abs(delta),sign=Math.sign(delta);
    const path=Array.from({length:steps+1},(_,i)=>C.fromIndex(ref.note.index+i*sign));
    const relation=steps===0?'同一位置':steps===1?'相邻的线和间，向'+(delta>0?'上':'下')+'一步':steps===2?'线到线，或间到间，向'+(delta>0?'上':'下')+'跳过一个音':steps<7?(delta>0?'上行':'下行')+(steps+1)+'度':steps===7?(delta>0?'向上':'向下')+'一个八度':(delta>0?'向上':'向下')+steps+'个线间位置';
    const staffBottom=C.parse(target.clef==='treble'?'E4':'G2').index;
    return {target,reference:ref,delta,steps,path,relation,staffOffset:target.note.index-staffBottom,direction:delta===0?'就在参照位置':delta>0?'在参照上方':'在参照下方'};
  }
  function text(m,level){
    level=clampLevel(level);if(!level)return '';
    const r=m.reference,t=m.target;
    const base=r.reason+'：'+C.label(r.note)+'，'+C.location(r.clef,r.note)+'。目标'+m.direction+'。';
    if(level===1)return base+' 先比较位置，再自己找音。';
    const middle=m.path.slice(0,-1).map(n=>C.short(n)).join(' → ');
    const relationship=m.steps?'从参照走过 '+m.steps+' 个线间位置：'+m.relation+'。'+middle+' → '+(level===3?C.short(t.note):'？')+'。':'目标与参照在同一位置。';
    return base+' '+relationship+(level===3?' 答案：'+C.label(t.note)+'，'+C.location(t.clef,t.note)+'。中央C统一记作C4。':' 最后一个音请自己说出来。');
  }
  return Object.freeze({LEVELS,clampLevel,reference,model,text});
})();
if(typeof globalThis!=='undefined')globalThis.HintCore=HintCore;
