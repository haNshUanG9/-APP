const assert=require('node:assert/strict'),{chromium}=require('playwright'),path=require('node:path'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PIANO_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.PianoAndroid={midiClock:()=>performance.now(),midiStatus(){window.PianoInput?.status({state:'connected',detail:'测试键盘',devices:[{id:7,port:0,name:'Piano'}],deviceId:7,port:0,generation:0});}};});
 await page.goto('http://127.0.0.1:8765/index.html');await page.waitForFunction(()=>window.PianoReady&&window.PianoCoach);
 const notes=[67,65,67,65,67,69,65,67];
 await page.evaluate(notes=>{
  const events=notes.map((n,beat)=>{const targets=[{clef:'treble',note:PianoCore.parse(PianoCore.midiName(n))}];return {beat,duration:1,rest:false,targets,voices:[{targets,duration:1}]};});
  PianoStudy.practiceExercise({events,totalBeats:8,clefs:['treble']},{clef:'treble',flow:'continuous',course:'free',tempo:80,metronome:false,notes:8});
  const send=(type,note)=>PianoInput.receive([{type,note,velocity:type==='on'?80:0,channel:0,timeMs:performance.now()}]);
  notes.forEach((n,i)=>{setTimeout(()=>send('on',n),3000+i*750+10);setTimeout(()=>send('off',n),3000+i*750+110);});
  for(const beat of [4.45,6.45]){setTimeout(()=>send('on',60),3000+beat*750);setTimeout(()=>send('off',60),3000+beat*750+90);}
 },notes);
 await page.waitForSelector('#reportAgain');const original=await page.evaluate(()=>PianoHost.getDB().study.reports.at(-1));assert(original.answers.every(a=>a.correct),JSON.stringify(original.answers));assert.equal(original.extras.length,2);assert.equal(await page.evaluate(()=>CoachCore.worstBar(PianoHost.getDB().study.reports.at(-1))),1);
 assert.match(await page.locator('#studyLesson .coach-card h3').innerText(),/拍子/);const output=process.env.PIANO_TEST_SCREENSHOT_DIR||path.resolve(__dirname,'../build/ui-review');fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'主要困难_节奏建议.png')});
 await page.locator('#studyLesson [data-coach-action]').click();assert.match(await page.locator('.rh-toolbar').innerText(),/70 BPM/);await page.locator('#rhGo').click();await page.waitForSelector('#rhAgain');const rhythm=await page.evaluate(()=>PianoHost.getDB().study.rhythm.reports.at(-1));assert.equal(rhythm.exercise.totalBeats,4);assert.deepEqual(rhythm.exercise.phraseOrigin.exercise,original.exercise);
 await page.reload();await page.waitForFunction(()=>window.PianoReady);await page.locator('.nav [data-page="progressPage"]').click();await page.locator(`[data-rhythm-report="${rhythm.id}"]`).click();const back=page.getByRole('button',{name:'返回原句无提示检查',exact:true});assert(await back.isVisible());await back.click();assert.match(await page.locator('#lessonStatus').innerText(),/预备/);assert.equal(await page.evaluate(()=>PianoHost.getDB().study.settings.tempo),80);assert.equal(await page.evaluate(()=>PianoHost.getDB().study.settings.flow),'continuous');
 const shown=await page.locator('#lessonStage [data-target]').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('data-target'))));assert.deepEqual(shown,notes);
 // Pausing the returned phrase cannot add clean acquisition or review evidence.
 const before=await page.evaluate(()=>Object.fromEntries(Object.entries(PianoHost.getDB().study.learning.memory).filter(([k])=>k.startsWith('phrase|midi|'))));
 await page.locator('#lessonPause').click();await page.locator('#coverResume').click();await page.waitForFunction(()=>document.querySelector('#lessonStatus').textContent.includes('第1小节'));
 await page.evaluate(notes=>{const send=(type,note)=>PianoInput.receive([{type,note,velocity:type==='on'?80:0,channel:0,timeMs:performance.now()}]);notes.forEach((n,i)=>{setTimeout(()=>send('on',n),i*750);setTimeout(()=>send('off',n),i*750+100);});},notes);
 await page.waitForSelector('#reportAgain');const paused=await page.evaluate(()=>PianoHost.getDB().study.reports.at(-1));assert(paused.paused);assert(paused.answers.every(a=>a.correct));const after=await page.evaluate(()=>Object.fromEntries(Object.entries(PianoHost.getDB().study.learning.memory).filter(([k])=>k.startsWith('phrase|midi|'))));assert.deepEqual(after,before);assert.match(await page.locator('#studyLesson .coach-card h3').innerText(),/中断/);
 assert.deepEqual(errors,[]);console.log('Coach integration: actual extras select second bar, extracted rhythm preserves tempo/original, report return survives reload, paused correct performance adds no clean memory evidence passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
