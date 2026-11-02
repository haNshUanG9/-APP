const assert=require('node:assert/strict'),{chromium}=require('playwright'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!localStorage.getItem('piano-midi-v1'))localStorage.setItem('piano-midi-v1',JSON.stringify({autoAdvance:false}));window.PianoAndroid={midiClock:()=>performance.now(),midiStatus(){window.PianoInput?.status({state:'connected',detail:'已连接',devices:[{id:7,port:0,name:'Digital Piano'}],deviceId:7,port:0,generation:0});}};});
 const load=async()=>{await page.goto('http://127.0.0.1:8765/index.html');await page.waitForFunction(()=>window.PianoReady);};
 const nav=async(name)=>page.locator(`.nav [data-page="${name}"]`).click();
 const send=async(note)=>page.evaluate(note=>{PianoInput.receive([{type:'on',note,velocity:80,channel:0,timeMs:performance.now()}]);PianoInput.receive([{type:'off',note,velocity:0,channel:0,timeMs:performance.now()}]);},note);
 const target=async()=>Number(await page.locator('#lessonStage [data-target]').first().getAttribute('data-target'));
 const answer=async()=>{const note=await target();await send(note);assert(await page.locator('#lessonNext').isVisible());await page.locator('#lessonNext').click();};
 await load();await nav('topics');await page.locator('#topicCourse').selectOption('progressive');await page.locator('#topicClef').selectOption('treble');await page.locator('#topicCount').selectOption('20');await page.locator('[data-topic="anchors"]').click();assert.equal(await target(),67);assert.match(await page.locator('#lessonStatus').innerText(),/认识本组/);
 await answer();assert.equal(await target(),67);assert.match(await page.locator('#lessonStatus').innerText(),/无提示巩固/);
 await send(79);assert.match(await page.locator('#lessonFeedback').innerText(),/八度/);await send(67);await page.locator('#lessonNext').click();
 const progress=await page.evaluate(()=>{const d=PianoHost.getDB().study.learning,s=d.sessions['anchors|treble|midi'];return {done:s.done,cursor:s.cursor,retries:s.retries,current:s.current,stage:d.memory['keyboard|midi|treble:G4'].stage};});assert.equal(progress.stage,0);assert(progress.retries.length>0);
 await page.reload();await page.waitForFunction(()=>window.PianoReady);await nav('topics');assert.match(await page.locator('#unitOverview').innerText(),/未完成计划/);await page.locator('[data-topic="anchors"]').click();assert.equal(await target(),67);
 const restored=await page.evaluate(()=>PianoHost.getDB().study.learning.sessions['anchors|treble|midi']);assert.equal(restored.done,progress.done);assert.equal(restored.current.key,progress.current.key);
 let seenRetest=false,steps=0;while(!(await page.locator('#reportAgain').count())){if((await page.locator('#lessonStatus').innerText()).includes('回测'))seenRetest=true;await answer();assert(++steps<35);}assert(seenRetest);assert.match(await page.locator('.learning-result').innerText(),/本单元通过/);assert.equal(await page.evaluate(()=>PianoHost.getDB().study.learning.tracks['anchors|treble|midi'].unit),1);
 await page.locator('#reportAgain').click();const focus=await page.evaluate(()=>PianoHost.getDB().study.learning.sessions['anchors|treble|midi'].focus);assert.deepEqual(focus,['treble:G4','treble:F4']);
 await answer();assert.equal(await target(),65);assert.match(await page.locator('#lessonStatus').innerText(),/认识本组/);await answer();
 await page.screenshot({path:path.resolve(process.env.PIANO_TEST_SCREENSHOT_DIR||path.resolve(__dirname,'../../deliverables'),'循序专项界面_1.4.0.png')});
 // A new MIDI channel/input task cannot erase another task's pending evidence.
 assert(await page.evaluate(()=>!!PianoHost.getDB().study.learning.memory['keyboard|midi|treble:G4']));
 // Prepare acquired pitches to isolate the four-stage phrase flow.
 await page.reload();await page.waitForFunction(()=>window.PianoReady);await page.evaluate(()=>{const d=PianoHost.getDB().study.learning;for(const pitch of ['G4','F4'])for(let i=0;i<4;i++)LearningCore.observe(d,{clef:'treble',note:PianoCore.parse(pitch)},{task:'keyboard',input:'midi',firstCorrect:true,hint:false});PianoHost.save();});
 await nav('reading');await page.locator('#studyCourse').selectOption('progressive');await page.locator('#studyClef').selectOption('treble');await page.locator('#studyLaunch').click();assert.match(await page.locator('#lessonStatus').innerText(),/认准这一句/);
 const signature=()=>page.evaluate(()=>PianoHost.getDB().study.learning.phrases['treble|midi'].exercise.events.map(e=>e.targets.map(t=>t.note.midi)).flat());
 const original=await signature();
 async function completePhrase(){for(const note of original){await send(note);assert(await page.locator('#lessonNext').isVisible());await page.locator('#lessonNext').click();}if(!(await page.locator('#reportAgain').count()))await page.locator('#lessonNext').click();}
 await completePhrase();assert.equal(await page.evaluate(()=>PianoHost.getDB().study.learning.phrases['treble|midi'].phase),1);await page.locator('#reportAgain').click();assert.deepEqual(await signature(),original);assert.match(await page.locator('#lessonStatus').innerText(),/同句无提示/);
 // MIDI phrase progression is release-driven; manual next remains available when auto-advance is disabled.
 for(let i=0;i<6;i++){await send(original[i]);await page.locator('#lessonNext').click();}if(!(await page.locator('#reportAgain').count()))await page.locator('#lessonNext').click();
 assert.equal(await page.evaluate(()=>PianoHost.getDB().study.learning.phrases['treble|midi'].phase),2);await page.locator('#reportAgain').click();assert.deepEqual(await signature(),original);assert.match(await page.locator('#lessonStatus').innerText(),/同句跟拍/);
 // Ending a timed phrase before playing must record reached missed notes in phrase evidence.
 await page.waitForFunction(()=>document.querySelector('#lessonStatus').textContent.includes('第1小节'));await page.waitForTimeout(300);await page.locator('#lessonFinish').click();await page.locator('#modalConfirm').click();assert(await page.evaluate(()=>Object.entries(PianoHost.getDB().study.learning.memory).some(([k,m])=>k.startsWith('phrase|midi|')&&m.relearning)));
 // Rhythm course repeats exactly, retains failed exercise, and serializes its progress.
 await page.reload();await page.waitForFunction(()=>window.PianoReady);await page.evaluate(()=>PianoRhythm.open({course:'progressive',mode:'hold',meter:'2/4',tempo:120}));await page.locator('#rhStart').click();const bars=()=>page.evaluate(()=>{const ex=RhythmCore.generate(PianoHost.getDB().study.rhythm.settings);return ex.bars.map(b=>b.id);});assert.equal(new Set(await bars()).size,1);assert.match(await page.locator('.rh-toolbar').innerText(),/固定型连续重复/);
 await page.locator('#rhGo').click();await page.waitForFunction(()=>document.querySelector('#rhStatus').textContent.includes('第1小节'));await page.waitForTimeout(160);await page.locator('#rhFinish').click();await page.locator('#modalConfirm').click();assert.match(await page.locator('.learning-result').innerText(),/保留原题/);const failed=await page.evaluate(()=>PianoHost.getDB().study.rhythm.reports.at(-1).exercise);await page.locator('#rhAgain').click();assert.equal(new Set(await bars()).size,1);assert.equal(failed.settings.lessonPhase,0);
 await page.screenshot({path:path.resolve(process.env.PIANO_TEST_SCREENSHOT_DIR||path.resolve(__dirname,'../../deliverables'),'循序节奏界面_1.4.0.png')});
 // A clean real-time MIDI rhythm run advances one phase, without changing its base pattern.
 await page.reload();await page.waitForFunction(()=>window.PianoReady);await page.evaluate(()=>PianoRhythm.open({course:'progressive',mode:'hold',meter:'2/4',tempo:120}));await page.locator('#rhStart').click();
 await page.evaluate(()=>document.querySelector('#rhGo').addEventListener('click',()=>{
  const start=performance.now(),beat=500;
  const event=type=>PianoInput.receive([{type,note:60,velocity:type==='on'?80:0,channel:0,timeMs:performance.now()}]);
  for(let i=0;i<8;i++){setTimeout(()=>event('on'),1000+i*beat);setTimeout(()=>event('off'),1000+(i+1)*beat-5);}
 },{once:true,capture:true}));
 await page.locator('#rhGo').click();await page.waitForSelector('#rhAgain',{timeout:9000});const clean=await page.evaluate(()=>PianoHost.getDB().study.rhythm.reports.at(-1));assert(clean.courseResult.passed,JSON.stringify(clean.result.metrics));assert.equal(clean.courseResult.phase,1);await page.locator('#rhAgain').click();assert.match(await page.locator('.rh-toolbar').innerText(),/同型无数拍/);assert.equal(await page.locator('#rhCount').innerText(),'数拍：关');
 // Due reviews require two confirmations with intervening goals and keep task evidence separate.
 await page.reload();await page.waitForFunction(()=>window.PianoReady);
 await page.evaluate(()=>{const d=PianoHost.getDB().study.learning;d.memory={};LearningCore.observe(d,{clef:'treble',note:PianoCore.parse('F4')},{task:'keyboard',input:'midi',firstCorrect:false,hint:false},Date.now()-600001);PianoHost.save();PianoHost.showPage('today');});
 await page.locator('#dailyStart').click();assert.equal(await target(),65);await answer();assert.equal(await page.evaluate(()=>PianoHost.getDB().study.learning.memory['keyboard|midi|treble:F4'].stage),0);assert.match(await page.locator('#lessonStatus').innerText(),/间隔/);
 for(let i=0;i<3;i++)await answer();assert.equal(await target(),65);await answer();assert.equal(await page.evaluate(()=>PianoHost.getDB().study.learning.memory['keyboard|midi|treble:F4'].stage),1);
 const report=await page.evaluate(()=>PianoHost.getDB().study.reports.at(-1));assert.equal(report.kind,'review');assert.equal(report.answers.length,5);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({firstSmallUnit:'pass',explicitRetest:'pass',resumeAfterReload:'pass',unitGate:'pass',samePhraseStages:'pass',missedNotesLearning:'pass',fixedRhythm:'pass',failedRhythmRetention:'pass',twoConfirmationsReview:'pass',rhythmPhaseAdvance:'pass',pageErrors:errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
