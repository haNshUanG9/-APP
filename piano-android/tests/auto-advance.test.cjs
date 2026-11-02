/* Actual input events exercise quiet time, release guards and lesson boundaries. */
const assert=require('node:assert/strict'),{chromium}=require('playwright'),{pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[],url=pathToFileURL(path.resolve(__dirname,'../native/assets/index.html')).href;
 try{
  for(const midi of [false,true]){
   const ctx=await b.newContext({viewport:{width:1280,height:800},hasTouch:!midi});if(midi)await ctx.addInitScript(()=>{window.PianoAndroid={midiClock:()=>performance.now(),midiStatus(){PianoInput?.status({state:'connected',detail:'Test piano',devices:[{id:7,port:0,name:'Test piano'}],deviceId:7,port:0,generation:0});}};});
   const p=await ctx.newPage(),cdp=await ctx.newCDPSession(p);p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.PianoReady);await p.evaluate(()=>PianoHost.getDB().sound=false);
   const token=()=>p.evaluate(()=>PianoStudy.midiToken()),note=()=>p.locator('#lessonStage [data-target]').first().getAttribute('data-target').then(Number);
   const send=async(type,n)=>{if(midi)await p.evaluate(({type,n})=>PianoInput.receive([{type,note:n,velocity:type==='on'?80:0,channel:0,timeMs:performance.now()}]),{type,n});else{const box=await p.locator(`#lessonKeys [data-midi="${n}"]`).boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:type==='on'?'touchStart':'touchEnd',touchPoints:type==='on'?[{x:box.x+box.width/2,y:box.y+box.height*.8,id:1}]:[]});}};
   const tap=async n=>{await send('on',n);await send('off',n);};
   await p.evaluate(()=>PianoHost.showPage('topics'));await p.locator('#topicCourse').selectOption('free');await p.locator('#topicCount').selectOption('10');await p.locator('[data-topic=anchors]').click();await p.waitForTimeout(1300);assert.equal(await token(),0,'new question must wait for input');
   const n=await note(),wrong=n===60?62:60;await tap(wrong);await p.waitForTimeout(1200);assert.equal(await token(),0,'wrong note must not advance');
   await send('on',n);await p.waitForTimeout(1200);assert.equal(await token(),0,'hold must not advance');await send('off',n);await p.waitForTimeout(650);assert.equal(await token(),0,'release needs a full second');
   await tap(n);await p.waitForTimeout(650);assert.equal(await token(),0,'repeat during feedback restarts the quiet window');await p.waitForFunction(()=>PianoStudy.midiToken()===1);await p.waitForTimeout(1250);assert.equal(await token(),1,'new question has no inherited quiet timer');
   await tap(await note());await p.locator('#lessonPause').click();await p.waitForTimeout(1250);assert.equal(await token(),1,'pause cancels pending transition');await p.locator('#coverResume').click();await p.waitForFunction(()=>PianoStudy.midiToken()===2);
   await p.locator('#lessonFinish').click();await p.locator('#modalConfirm').click();assert.equal(await p.evaluate(()=>PianoHost.getDB().study.reports.at(-1).answers[0].correct),false,'correction must preserve first mistake');
   await p.evaluate(()=>{const t=n=>({clef:'treble',note:PianoCore.parse(PianoCore.midiName(n))}),targets=[t(60),t(64)];PianoStudy.practiceExercise({events:[{targets,beat:0,duration:1,rest:false,voices:[{targets,duration:1}]}],totalBeats:1,clefs:['treble']},{clef:'treble',flow:'guided',course:'free',metronome:false,notes:2});});
   await tap(60);await p.waitForTimeout(1250);assert.equal(await p.locator('#reportAgain').count(),0,'partial chord must not complete');await tap(64);await p.waitForSelector('#reportAgain');assert.equal(await p.evaluate(()=>PianoHost.getDB().study.reports.at(-1).answers.length),2,'last group opens report automatically');
   await p.evaluate(()=>PianoHost.showPage('topics'));await p.locator('#topicCourse').selectOption('progressive');await p.locator('[data-topic=anchors]').click();await tap(await note());assert.equal(await p.locator('#lessonNext').innerText(),'立即继续','progressive current group is not the end of the round');await p.waitForFunction(()=>PianoStudy.midiToken()===1);
   if(midi){await tap(await note());await p.evaluate(()=>PianoInput.status({state:'disconnected',detail:'Test disconnect',devices:[],deviceId:-1,port:-1,generation:1}));await p.waitForTimeout(1200);assert.equal(await token(),1);assert(await p.locator('#lessonPauseCover').isVisible());}
   else{await p.locator('#workspaceMenu').click();await p.locator('.nav [data-page=today]').click();await p.waitForTimeout(1200);assert.equal(await p.evaluate(()=>document.body.dataset.screen),'today','navigation must cancel previous timers');}
   await ctx.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS: touch/MIDI release + 1s quiet, repeated input resets quiet, new questions wait, wrong/partial groups stay, pause/disconnect/navigation cancel, final result automatic, first-error evidence and progressive label preserved.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
