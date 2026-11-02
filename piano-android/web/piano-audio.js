/* Shared offline piano: embedded MP3s, one context, bounded decoded cache and cancellable voices. */
(()=>{
  'use strict';
  const bank=__PIANO_SAMPLES__,anchors=Object.keys(bank).map(Number).sort((a,b)=>a-b);
  const LIMIT=48*1024*1024,cache=new Map(),pending=new Map(),voices=new Set();
  let ctx=null,master=null,bytes=0,lastError='';
  function context(){
    if(ctx)return ctx;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('设备没有可用的音频接口。');
    ctx=new AC({latencyHint:'interactive'});master=ctx.createGain();master.gain.value=.7;
    const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=18;limiter.ratio.value=4;limiter.attack.value=.003;limiter.release.value=.15;
    master.connect(limiter);limiter.connect(ctx.destination);return ctx;
  }
  function anchor(midi){
    if(!Number.isFinite(midi)||midi<21||midi>108)throw Error('琴键超出 A0—C8 音域。');
    return anchors.reduce((best,n)=>Math.abs(n-midi)<Math.abs(best-midi)?n:best,anchors[0]);
  }
  function trim(){
    for(const [key,item]of cache){if(bytes<=LIMIT)break;cache.delete(key);bytes-=item.bytes;}
  }
  function load(key){
    if(cache.has(key)){const entry=cache.get(key);cache.delete(key);cache.set(key,entry);return Promise.resolve(entry.buffer);}
    if(pending.has(key))return pending.get(key);
    const promise=(async()=>{
      const c=context(),raw=atob(bank[key]),data=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)data[i]=raw.charCodeAt(i);
      const buffer=await new Promise((resolve,reject)=>c.decodeAudioData(data.buffer,resolve,reject));
      if(!buffer?.length)throw Error('钢琴采样未能解码。');
      const size=buffer.length*buffer.numberOfChannels*4;cache.set(key,{buffer,bytes:size});bytes+=size;trim();return buffer;
    })();
    pending.set(key,promise);promise.then(()=>pending.delete(key),e=>{pending.delete(key);lastError=String(e.message||e);});return promise;
  }
  async function prepare(pitches=[]){
    const c=context(),resumed=c.state==='running'?Promise.resolve():c.resume();
    // Limit decode concurrency and retain only a bounded working set for long scores.
    const keys=[...new Set(pitches.map(anchor))];let cursor=0;
    await Promise.all([resumed,...Array.from({length:Math.min(2,keys.length)},async()=>{while(cursor<keys.length)await load(keys[cursor++]);})]);
    if(c.state!=='running')throw Error('声音尚未启动，请点击播放重试。');return c;
  }
  function note(midi,{at=null,duration=.4,volume=.45,release=.28,onended=null}={}){
    const c=context(),key=anchor(midi),requested=Number.isFinite(at)?Math.max(0,at):c.currentTime;
    let source=null,gain=null,finished=false,releaseAt=duration===null?null:requested+Math.max(.025,duration),tail=Math.max(.03,Math.min(1.5,release));
    function finish(){if(finished)return;finished=true;voices.delete(v);try{source?.disconnect();gain?.disconnect();}catch(e){}onended?.();}
    function applyRelease(){if(!source||releaseAt===null)return;const now=c.currentTime,t=Math.max(now,releaseAt);gain.gain.cancelScheduledValues(t);gain.gain.setTargetAtTime(.00001,t,tail/5);try{source.stop(releaseAt+tail+.02);}catch(e){finish();}}
    const v={
      stop(){if(finished)return;try{source?.stop();}catch(e){}finish();},
      release(at=c.currentTime,seconds=tail){if(finished)return;const t=Math.max(c.currentTime,Number.isFinite(at)?at:c.currentTime);if(releaseAt!==null&&t>=releaseAt)return;releaseAt=t;tail=Math.max(.03,Math.min(1.5,seconds));applyRelease();},
      ready:null
    };
    // Covers queued demonstrations as well as live chords, while preventing runaway input.
    if(voices.size>=128)voices.values().next().value.stop();voices.add(v);
    const resume=c.state==='running'?Promise.resolve():c.resume();
    v.ready=Promise.all([resume,load(key)]).then(([,buffer])=>{
      if(finished||document.hidden||c.state!=='running'){finish();return false;}
      const now=c.currentTime;if(releaseAt!==null&&now>=releaseAt+tail){finish();return false;}
      const rate=2**((midi-key)/12),start=Math.max(now,requested),offset=Math.max(0,start-requested)*rate;
      if(offset>=buffer.duration){finish();return false;}
      source=c.createBufferSource();gain=c.createGain();source.buffer=buffer;source.playbackRate.value=rate;
      const level=Math.max(.00001,Math.min(1,volume));gain.gain.setValueAtTime(releaseAt!==null&&start>releaseAt?level*Math.exp(-(start-releaseAt)/(tail/5)):level,start);
      source.connect(gain);gain.connect(master);source.onended=finish;source.start(start,offset);applyRelease();return true;
    }).catch(e=>{lastError=String(e.message||e);finish();return false;});
    return v;
  }
  function silence(){for(const v of [...voices])v.stop();}
  function status(){return{source:'Salamander Grand Piano',sampleCount:anchors.length,cachedSamples:cache.size,cacheBytes:bytes,cacheLimit:LIMIT,loading:pending.size,voices:voices.size,state:ctx?.state||'idle',error:lastError};}
  window.PianoAudio=Object.freeze({context,prepare,note,silence,status});
  const warm=()=>{prepare([60,64,67]).catch(()=>{});};
  document.addEventListener('pointerdown',warm,{once:true,capture:true});document.addEventListener('keydown',warm,{once:true,capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();});
})();
