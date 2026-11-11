(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ChordInput=api})(typeof window==='object'?window:globalThis,function(){
'use strict';
class Input {
 constructor({onChange=()=>{},onStable=()=>{},onSound=()=>{},onRelease=()=>{},delay=200}={}){Object.assign(this,{onChange,onStable,onSound,onRelease,delay});this.held=new Map();this.sustained=new Map();this.pedals=new Set();this.latch=new Set();this.active='touch';this.mode='latch';this.frozen=false;this.timer=null;this.serial=0;this.displayed=[];this.lastOn=[];}
 valid(n){return Number.isInteger(n)&&n>=21&&n<=108}
 group(port,ch){return port+':'+ch}
 key(port,ch,n){return this.group(port,ch)+':'+n}
 pitches(){return [...new Set([...this.held.values()].filter(x=>this.active==='midi'?x.port.startsWith('midi/'):x.port.startsWith('touch/')).map(x=>x.note).concat(this.active==='touch'&&this.mode==='latch'?[...this.latch]:[]))].sort((a,b)=>a-b)}
 snapshot(){return {held:[...this.held.values()].map(x=>({...x})),sustained:[...this.sustained.values()].map(x=>({...x})),pedals:[...this.pedals],latch:[...this.latch],active:this.active,mode:this.mode,frozen:this.frozen,displayed:[...this.displayed],pitches:this.pitches()}}
 cancel(){clearTimeout(this.timer);this.timer=null;this.serial++}
 update(schedule=true){this.onChange(this.snapshot());if(schedule)this.schedule()}
 schedule(){this.cancel();const pitches=this.pitches();if(!pitches.length||this.frozen)return;const serial=this.serial;this.timer=setTimeout(()=>{if(serial!==this.serial||this.frozen)return;this.displayed=[...pitches];this.onStable([...pitches]);this.onChange(this.snapshot())},this.delay)}
 on(port,ch,n,velocity=90){if(!this.valid(n)||ch<0||ch>15)return;const key=this.key(port,ch,n);this.onRelease(key,true);this.sustained.delete(key);const entry={port,ch,note:n,velocity};this.held.set(key,entry);this.onSound(key,n,velocity);this.lastOn=this.pitches();this.firstReleaseAt=0;this.update()}
 off(port,ch,n){const key=this.key(port,ch,n),entry=this.held.get(key);if(!entry)return;this.held.delete(key);if(this.pedals.has(this.group(port,ch)))this.sustained.set(key,entry);else this.onRelease(key);if(!this.firstReleaseAt)this.firstReleaseAt=Date.now();if(!this.pitches().length){const short=this.timer&&!this.frozen&&Date.now()-this.firstReleaseAt<=50?[...this.lastOn]:[];this.cancel();if(short.length){this.displayed=short;this.onStable(short)}this.lastOn=[];this.firstReleaseAt=0;this.update(false)}else this.update(true)}
 toggle(n){if(this.frozen||!this.valid(n))return false;const key='latch:'+n;if(this.latch.has(n)){this.latch.delete(n);this.onRelease(key)}else{this.latch.add(n);this.onSound(key,n,90)}if(!this.latch.size){this.cancel();this.displayed=[];this.onStable([]);this.update(false)}else this.update();return true}
 pedal(port,ch,value){const group=this.group(port,ch);if(value>=64)this.pedals.add(group);else{this.pedals.delete(group);for(const [k,e]of this.sustained)if(this.group(e.port,e.ch)===group){this.onRelease(k);this.sustained.delete(k)}}this.update(false)}
 reset(port=null,clearDisplay=false){this.cancel();this.lastOn=[];for(const [k,e]of this.held)if(!port||e.port===port){this.onRelease(k,true);this.held.delete(k)}for(const [k,e]of this.sustained)if(!port||e.port===port){this.onRelease(k,true);this.sustained.delete(k)}for(const p of [...this.pedals])if(!port||p.startsWith(port+':'))this.pedals.delete(p);if(!port){for(const n of this.latch)this.onRelease('latch:'+n,true);this.latch.clear()}if(clearDisplay){this.displayed=[];this.onStable([])}if(port&&this.pitches().length){this.lastOn=this.pitches();this.update(true)}else this.update(false)}
 setMode(mode){this.reset();this.mode=mode;this.update(false)}
 setActive(active){this.reset();this.active=active;this.update(false)}
 freeze(value){this.cancel();this.frozen=value;if(!value)this.schedule();this.update(false)}
 setDisplayed(notes){this.cancel();this.displayed=[...notes];if(this.active==='touch'&&this.mode==='latch')this.latch=new Set(notes);this.onStable([...notes]);this.update(false)}
 message(port,data){const status=data[0]&240,ch=data[0]&15,n=data[1],value=data[2]||0;if(status===144&&value>0)this.on(port,ch,n,value);else if(status===128||(status===144&&!value))this.off(port,ch,n);else if(status===176){if(n===64)this.pedal(port,ch,value);else if(n===120||n===123){for(const [k,e]of [...this.held])if(e.port===port&&e.ch===ch){this.onRelease(k,true);this.held.delete(k)}for(const [k,e]of [...this.sustained])if(e.port===port&&e.ch===ch){this.onRelease(k,true);this.sustained.delete(k)}this.pedals.delete(this.group(port,ch));this.cancel();this.update(false)}else if(n===121)this.pedal(port,ch,0)}}
}
return {Input};
});
