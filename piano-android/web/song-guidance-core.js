/* Hand-specific visual targets share musical positions; they never infer actual fingers from MIDI. */
'use strict';
const SongGuidanceCore=(()=>{
 const EPS=.0001;
 function frame(notes,beat,{group=null,next=true,loop=false,from=0,to=Infinity}={}){
  const current=group?group.notes:notes.filter(n=>n.start<=beat+EPS&&n.start+n.duration>beat+EPS);
  const future=[];
  if(next)for(const hand of [1,2]){
   let candidates=notes.filter(n=>n.staff===hand&&n.start>beat+EPS&&n.start<to-EPS);
   if(!candidates.length&&loop)candidates=notes.filter(n=>n.staff===hand&&n.start>=from-EPS&&n.start<to-EPS);
   const first=candidates.length?Math.min(...candidates.map(n=>n.start)):null;
   if(first!==null)future.push(...candidates.filter(n=>Math.abs(n.start-first)<EPS));
  }
  return{current,next:future};
 }
 function keyStates(frame){
  const map=new Map();for(const type of ['current','next'])for(const n of frame[type]){
   let v=map.get(n.pitch);if(!v){v={current:[],next:[]};map.set(n.pitch,v);}const a=v[type];
   const finger=/^[1-5](?:[-–/][1-5])?$/.test(n.finger||'')?n.finger:'';
   if(!a.some(x=>x.hand===n.staff&&x.finger===finger))a.push({hand:n.staff,finger,id:n.id});
  }return map;
 }
 return Object.freeze({frame,keyStates});
})();
if(typeof globalThis!=='undefined')globalThis.SongGuidanceCore=SongGuidanceCore;
if(typeof module!=='undefined')module.exports=SongGuidanceCore;
