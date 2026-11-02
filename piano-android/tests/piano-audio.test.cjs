/* Real local MP3 decode and playback: octave edges, shifted keys, chords, cancellation and shared consumers. */
const assert=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[],network=[];
 const out=path.resolve(__dirname,'../../deliverables/1.5.4_验证');fs.mkdirSync(out,{recursive:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1280,height:800}});
  await ctx.addInitScript(()=>{
   window.__sound={contexts:0,starts:[],oscillators:0};const Original=window.AudioContext;
   window.AudioContext=class extends Original{constructor(...args){super(...args);window.__sound.contexts++;}};
   const p=BaseAudioContext.prototype,start=p.createBufferSource,gain=p.createGain,osc=p.createOscillator;
   p.createGain=function(...args){const n=gain.apply(this,args);window.__master??=n;return n;};
   p.createBufferSource=function(...args){const n=start.apply(this,args),play=n.start;n.start=function(...a){window.__sound.starts.push({time:this.context.currentTime,at:a[0],offset:a[1],rate:this.playbackRate.value,duration:this.buffer?.duration,channels:this.buffer?.numberOfChannels});return play.apply(this,a);};return n;};
   p.createOscillator=function(...args){window.__sound.oscillators++;return osc.apply(this,args);};
  });
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../native/assets/index.html')).href);await p.waitForFunction(()=>window.PianoReady&&window.PianoAudio);
  await p.mouse.click(600,25);
  const initial=await p.evaluate(async()=>{await PianoAudio.prepare([21,60,108]);return PianoAudio.status();});assert.equal(initial.sampleCount,30);assert.equal(initial.state,'running');assert.equal(initial.error,'');
  await p.evaluate(async()=>{window.__meter=PianoAudio.context().createAnalyser();__meter.fftSize=2048;__master.connect(__meter);const a=PianoAudio.note(60,{duration:2,volume:.65});window.__firstReady=await a.ready;});
  await p.waitForFunction(()=>{const d=new Float32Array(__meter.fftSize);__meter.getFloatTimeDomainData(d);return d.some(n=>Math.abs(n)>.0001);},{},{timeout:1500}).catch(async e=>{throw Error('No audio: '+JSON.stringify(await p.evaluate(()=>({ready:__firstReady,status:PianoAudio.status(),starts:__sound.starts,now:PianoAudio.context().currentTime}))))});
  const amplitude=await p.evaluate(()=>{const data=new Float32Array(__meter.fftSize);__meter.getFloatTimeDomainData(data);return{rms:Math.sqrt(data.reduce((s,n)=>s+n*n,0)/data.length),peak:Math.max(...data.map(Math.abs))};});assert(amplitude.rms>.0001,JSON.stringify(amplitude));
  const shifted=await p.evaluate(async()=>{PianoAudio.silence();const a=PianoAudio.note(61,{duration:.3});await a.ready;return __sound.starts.at(-1);});assert(Math.abs(shifted.rate-2**(1/12))<.0001);assert.equal(shifted.channels,2);
  const edges=await p.evaluate(async()=>{const a=PianoAudio.note(21,{duration:.1}),b=PianoAudio.note(108,{duration:.1});return await Promise.all([a.ready,b.ready]);});assert.deepEqual(edges,[true,true]);
  const cancellation=await p.evaluate(async()=>{PianoAudio.silence();const before=__sound.starts.length,v=PianoAudio.note(85,{duration:2});v.stop();const ready=await v.ready;return{before,after:__sound.starts.length,ready,voices:PianoAudio.status().voices};});assert.equal(cancellation.after,cancellation.before);assert.equal(cancellation.ready,false);assert.equal(cancellation.voices,0);
  await p.evaluate(async()=>{await PianoAudio.prepare([48,60,64,67,72]);window.__chord=[48,60,64,67,72].map(n=>PianoAudio.note(n,{duration:null,volume:.5}));await Promise.all(__chord.map(v=>v.ready));});assert.equal(await p.evaluate(()=>PianoAudio.status().voices),5);
  await p.evaluate(()=>__chord.forEach(v=>v.release()));await p.waitForTimeout(450);assert.equal(await p.evaluate(()=>PianoAudio.status().voices),0);
  await p.evaluate(async()=>{const c=PianoAudio.context();window.__future=PianoAudio.note(60,{at:c.currentTime+1,duration:1});await __future.ready;PianoPause();});assert.equal(await p.evaluate(()=>PianoAudio.status().voices),0);await p.waitForTimeout(1100);assert.equal(await p.evaluate(()=>PianoAudio.status().voices),0);
  const host=await p.evaluate(async()=>{PianoHost.getDB().sound=true;const before=__sound.starts.length,osc=__sound.oscillators;PianoHost.play(60);await new Promise(r=>setTimeout(r,80));PianoHost.getDB().sound=false;PianoHost.play(64);return{newStarts:__sound.starts.length-before,oscillators:__sound.oscillators-osc};});assert.equal(host.newStarts,1);assert.equal(host.oscillators,0);
  await p.evaluate(()=>{PianoAudio.silence();PianoHost.getDB().sound=true;PianoFoundation.open();});await p.locator('#foundationPage [data-do="preview-play"]').click();await p.waitForTimeout(250);assert(await p.evaluate(()=>PianoAudio.status().voices)>0);await p.evaluate(()=>PianoFoundation.pause());assert.equal(await p.evaluate(()=>PianoAudio.status().voices),0);
  await p.evaluate(()=>PianoHost.showPage('songsPage'));await p.waitForFunction(()=>document.querySelector('#songScore svg')&&!document.getElementById('songStart').disabled);await p.locator('[data-song-mode="listen"]').click();await p.waitForFunction(()=>!document.getElementById('songStart').disabled);const before=await p.evaluate(()=>__sound.starts.length);await p.locator('#songStart').click();await p.waitForTimeout(250);assert(await p.evaluate(()=>__sound.starts.length)>before);await p.locator('#songPause').click();assert.equal(await p.evaluate(()=>PianoAudio.status().voices),0);await p.locator('#songStop').click();
  const cache=await p.evaluate(async()=>{await PianoAudio.prepare(Array.from({length:30},(_,i)=>21+i*3));return PianoAudio.status();});assert(cache.cacheBytes<=cache.cacheLimit);assert.equal(cache.loading,0);assert.equal(await p.evaluate(()=>__sound.contexts),1);
  await p.evaluate(()=>PianoHost.showPage('help'));assert.match(await p.locator('#help').innerText(),/Alexander Holm/);assert.match(await p.locator('#help').innerText(),/CC BY 3.0/);
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);fs.writeFileSync(path.join(out,'piano-audio.json'),JSON.stringify({initial,amplitude,shifted,cancellation,host,cache,errors,network},null,2));
  console.log('PASS: local MP3 playback has nonzero audio; A0/C8, black-key pitch, chords, release, pending/future cancel, sound off, course and song consumers; one context, bounded cache, visible credits, zero network.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
