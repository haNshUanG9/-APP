const assert=require('node:assert/strict'),{chromium}=require('playwright'),path=require('node:path'),fs=require('node:fs');
const output=process.env.PIANO_TEST_SCREENSHOT_DIR||path.resolve(__dirname,'../../deliverables');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PIANO_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:800}});const page=await context.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   window.PianoAndroid={midiClock:()=>performance.now(),midiStatus(){window.PianoInput?.status({state:'connected',detail:'已连接，弹一个音确认输入。',devices:[{id:7,port:0,name:'USB Digital Piano',portName:'Keyboard'}],deviceId:7,port:0,generation:0});},midiRefresh(){this.midiStatus()},midiConnect(){this.midiStatus()},midiDisconnect(){window.PianoInput.status({state:'disconnected',detail:'实体琴已断开',devices:[],deviceId:-1,port:-1,generation:1});}};
 });
 const load=async()=>{await page.goto('http://127.0.0.1:8765/index.html');await page.waitForFunction(()=>window.PianoReady&&window.PianoInput);};
 const send=async(type,note,extras={})=>page.evaluate(({type,note,extras})=>window.PianoInput.receive([{type,note,velocity:type==='on'?80:0,channel:0,timeMs:performance.now(),...extras}]),{type,note,extras});
 const target=()=>page.locator('#lessonStage [data-target]').first().getAttribute('data-target').then(Number);
 const index=()=>page.evaluate(()=>PianoStudy.midiToken());
 await load();assert(await page.locator('body').evaluate(e=>e.classList.contains('midi-layout')));
 await page.locator('[data-page="topics"]').first().click();await page.locator('#topicCourse').selectOption('free');await page.locator('#topicCount').selectOption('10');await page.locator('[data-topic="anchors"]').click();await page.waitForFunction(()=>document.querySelector('#lessonStage [data-target]'));
 assert.equal(await page.locator('.study-keyboard-area').isVisible(),false);
 const first=await target();await send('on',first+12);assert.match(await page.locator('#lessonFeedback').innerText(),/八度/);await send('off',first+12);
 await send('on',first);await page.waitForTimeout(800);assert.equal(await index(),0);await send('on',first);assert.equal(await index(),0);await send('off',first);await page.waitForFunction(()=>PianoStudy.midiToken()===1);
 await page.screenshot({path:path.join(output,'实体琴训练界面.png')});
 // Input settings pause training and retain the notation. Reconnect never resumes by itself.
 await page.locator('#midiConnection').click();assert(await page.locator('#midiPanel').isVisible());await page.locator('#midiKeyboard').check();await page.locator('#midiClose').click();assert(await page.locator('.study-keyboard-area').isVisible());await page.locator('#coverResume').click();
 await page.evaluate(()=>PianoAndroid.midiDisconnect());assert(await page.locator('#lessonPauseCover').isVisible());await page.evaluate(()=>PianoAndroid.midiStatus());assert(await page.locator('#lessonPauseCover').isVisible());await page.locator('#coverResume').click();
 await page.locator('#midiKeysToggle').click();assert.equal(await page.locator('.study-keyboard-area').isVisible(),false);
 for(let i=1;i<10;i++){const note=await target();await send('on',note);await send('off',note);if(i<9)await page.waitForFunction(i=>PianoStudy.midiToken()===i+1,i);else await page.waitForSelector('#reportAgain');}
 assert.equal(await page.evaluate(()=>PianoHost.getDB().study.reports.at(-1).answers.length),10);
 assert.equal(await page.evaluate(()=>PianoHost.getDB().study.reports.at(-1).answers[0].correct),false);
 // Reverse task still exposes the keyboard and requires a staff selection.
 await page.locator('[data-page="topics"]').first().click();await page.locator('[data-topic="reverse"]').click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.study-keyboard-area')).display!=='none');assert(await page.locator('.study-keyboard-area').isVisible());
 const reverseNote=await page.locator('#lessonKeys .target-key').getAttribute('data-midi').then(Number);await send('on',reverseNote);await send('off',reverseNote);assert.equal(await index(),0);await page.locator(`#lessonStage [data-position="${reverseNote}"]`).click();assert(await page.locator('#lessonNext').isVisible());
 // Free practice shares MIDI scoring and automatically advances only after release.
 await page.reload();await page.waitForFunction(()=>window.PianoReady);await page.evaluate(()=>{PianoHost.configureClassic({mode:'treble',noteCount:1,timing:'unlimited',count:5,strategy:'balanced'});PianoHost.startClassic();});await page.waitForFunction(()=>PianoHost.midiToken()?.state==='answering');
 const classicNote=await page.evaluate(()=>PianoCore.fromIndex(Number(document.querySelector('#stage ellipse[data-note-index]').dataset.noteIndex)).midi);
 await send('on',classicNote);await page.waitForTimeout(750);assert.match(await page.locator('#progress').innerText(),/1 \/ 20/);await send('off',classicNote);await page.waitForFunction(()=>document.querySelector('#progress').textContent.includes('2 / 20'));
 // Rhythm input records real key-down and key-up with native timestamps.
 await page.reload();await page.waitForFunction(()=>window.PianoReady);await page.evaluate(()=>{PianoRhythm.open({course:'free',mode:'hold',meter:'2/4',bars:1,tempo:120,level:1,metronome:false});});await page.locator('#rhStart').click();assert.equal(await page.locator('.rh-pads').isVisible(),false);assert.match(await page.locator('#rhythmMidiHelp').innerText(),/C4/);await page.locator('#rhGo').click();
 await page.waitForFunction(()=>document.querySelector('#rhStatus').textContent.includes('第1小节'));await send('on',60);await page.waitForTimeout(140);await send('off',60);await page.waitForSelector('#rhAgain');
 const report=await page.evaluate(()=>PianoHost.getDB().study.rhythm.reports.at(-1));assert.equal(report.inputs.length,1);assert(report.inputs[0].up>report.inputs[0].down);assert(!report.inputs[0].cancelled);
 // Touch-only layout survives reload and has no hidden answer controls.
 await page.locator('#midiConnection').click();await page.locator('#midiMode').selectOption('touch');await page.locator('#midiClose').click();await page.reload();await page.waitForFunction(()=>window.PianoReady);assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('midi-layout')),false);await page.locator('[data-page="topics"]').first().click();await page.locator('[data-topic="anchors"]').click();assert(await page.locator('.study-keyboard-area').isVisible());
 const touch=await target();await page.locator(`#lessonKeys [data-midi="${touch}"]`).click();assert.match(await page.locator('#lessonFeedback').innerText(),/完成/);
 await page.setViewportSize({width:800,height:1280});await page.screenshot({path:path.join(output,'触屏训练界面.png')});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({layout:'pass',octaveFeedback:'pass',heldNoteGuard:'pass',automaticAdvance:'pass',disconnectPause:'pass',reverse:'pass',classic:'pass',rhythmDownUp:'pass',touchFallback:'pass',pageErrors:errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
