/* Input state shared by native MIDI and all training routes. */
'use strict';
const MidiCore=(()=>{
  function tracker(){
    const held=new Map(),pedals=new Set();
    return {held,pedals,reset(){held.clear();pedals.clear();},accept(e){
      if(!e||!Number.isInteger(e.channel)||e.channel<0||e.channel>15)return false;
      if(e.type==='reset'){if(e.all){held.clear();pedals.clear();}else{for(const [k,v]of held)if(v.channel===e.channel)held.delete(k);pedals.delete(e.channel);}return true;}
      if(e.type==='pedal'){if(e.value>=64)pedals.add(e.channel);else pedals.delete(e.channel);return true;}
      if(!Number.isInteger(e.note)||e.note<0||e.note>127)return false;
      const key=e.channel+':'+e.note;
      if(e.type==='on'){
        if(!Number.isInteger(e.velocity)||e.velocity<1||e.velocity>127||held.has(key))return false;
        const already=[...held.values()].some(x=>x.note===e.note);held.set(key,e);return !already;
      }
      if(e.type==='off'){if(!held.has(key))return false;held.delete(key);return ![...held.values()].some(x=>x.note===e.note);}
      return false;
    }};
  }
  function feedback(expected,actual){
    const delta=actual-expected;
    if(!delta)return '正确';
    if(Math.abs(delta)%12===0)return (delta>0?'高了':'低了')+(Math.abs(delta)/12===1?'一个':Math.abs(delta)/12+'个')+'八度，再试一次。';
    return '音高'+(delta>0?'偏高':'偏低')+'，检查谱号和位置，再试一次。';
  }
  return Object.freeze({tracker,feedback});
})();
if(typeof globalThis!=='undefined')globalThis.MidiCore=MidiCore;
