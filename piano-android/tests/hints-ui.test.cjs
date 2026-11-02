const assert=require('node:assert/strict'),{chromium}=require('playwright'),path=require('node:path');
const output=process.env.PIANO_TEST_SCREENSHOT_DIR||path.resolve(__dirname,'../../deliverables');require('node:fs').mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const load=async()=>{await page.goto('http://127.0.0.1:8765/index.html');await page.waitForFunction(()=>window.PianoReady);};
 const nav=async p=>page.locator(`.nav [data-page="${p}"]`).click();
 const answer=async()=>{const midi=Number(await page.locator('#lessonStage [data-target]').first().getAttribute('data-target'));await page.locator(`#lessonKeys [data-midi="${midi}"]`).click();await page.locator('#lessonNext').click();};
 await load();await nav('topics');await page.locator('[data-topic="anchors"]').click();
 assert.equal(await page.locator('#lessonMemory [data-hint-level]').getAttribute('data-hint-level'),'3');
 await answer();assert(!await page.locator('#lessonMemory').isVisible());assert(!/G4/.test(await page.locator('#lessonCaption').innerText()));
 await page.locator('#lessonHint').click();assert.equal(await page.locator('#lessonMemory [data-hint-level]').getAttribute('data-hint-level'),'1');
 await page.locator('#lessonMemory [data-memory-level="2"]').click();await page.locator('#lessonMemory [data-memory-close]').click();
 await page.reload();await page.waitForFunction(()=>window.PianoReady);await nav('topics');await page.locator('[data-topic="anchors"]').click();await answer();
 const memory=await page.evaluate(()=>PianoHost.getDB().study.learning.memory['keyboard|touch|treble:G4']);assert(memory.samples.at(-1).hint);assert.equal(memory.samples.at(-1).hintLevel,2);
 // Remaining clean repetitions do not inherit the prior target's prompt.
 await answer();assert(!await page.locator('#lessonMemory').isVisible());
 // End before switching exercises.
 await page.locator('#lessonFinish').click();await page.locator('#modalConfirm').click();await nav('topics');await page.locator('[data-topic="reverse"]').click();
 await page.locator('#lessonHint').click();assert(await page.locator('#lessonMemory').isVisible());await page.locator('#lessonMemory [data-memory-level="3"]').click();
 const target=await page.evaluate(()=>PianoHost.getDB().study.learning.sessions['reverse|treble|touch'].current.key);
 const midi=await page.evaluate(k=>LearningCore.target(k).note.midi,target);await page.locator(`#lessonStage [data-position="${midi}"]`).click();await page.locator('#lessonNext').click();
 assert.equal(await page.evaluate(k=>PianoHost.getDB().study.learning.memory['staff|touch|'+k].samples.at(-1).hintLevel,target),3);
 await page.locator('#lessonFinish').click();await page.locator('#modalConfirm').click();
 // Visual relation for a non-reference target (A5 is two staff steps above F5).
 await nav('topics');await page.evaluate(()=>{const d=PianoHost.getDB().study.learning;LearningCore.info(d,'ledger','treble','touch');d.tracks['ledger|treble|touch'].unit=3;for(let i=0;i<4;i++)LearningCore.observe(d,{clef:'treble',note:PianoCore.parse('A5')},{task:'keyboard',input:'touch',firstCorrect:true});PianoHost.save();});await page.locator('[data-topic="ledger"]').click();await page.locator('#lessonHint').click();await page.locator('#lessonMemory [data-memory-level="2"]').click();assert(!/A5/.test(await page.locator('.memory-explanation').innerText()));assert(await page.locator('.memory-diagram polyline').count());
 await page.screenshot({path:path.join(output,'记忆提示_专项界面.png')});
 await page.setViewportSize({width:768,height:1024});assert(await page.locator('#lessonMemory [data-memory-level="3"]').isVisible());await page.screenshot({path:path.join(output,'记忆提示_竖屏界面.png')});await page.setViewportSize({width:1440,height:900});
 await page.locator('#lessonFinish').click();await page.locator('#modalConfirm').click();
 // Free reading: hint removes time pressure, and assisted result cannot count as independent success.
 await page.evaluate(()=>PianoHost.configureClassic({mode:'treble',noteCount:1,strategy:'balanced',timing:'auto',secondsPerNote:10,count:10}));await page.locator('#launch').click();await page.locator('#classicHint').click();await page.locator('#classicMemory [data-memory-level="3"]').click();assert.match(await page.locator('#timerText').innerText(),/不限时/);
 const label=await page.locator('#classicMemory .memory-diagram text').last().textContent();const pitch=label.trim();const key=await page.evaluate(p=>PianoCore.parse(p).midi,pitch);await page.locator(`#keyboard [data-midi="${key}"]`).click();await page.locator('#finish').click();await page.locator('#modalConfirm').click();
 const r=await page.evaluate(()=>PianoHost.getDB().reports.at(-1));assert.equal(r.assistedNotes,1);assert.equal(r.unaidedNotes,0);assert.equal(r.medianMs,null);assert.equal(r.statuses.assisted,1);
 // A short phrase has two simultaneous targets: hint follows the next unfinished one.
 await page.evaluate(()=>{PianoHost.getDB().study.settings={...PianoHost.getDB().study.settings,course:'free',clef:'dual',flow:'guided',notes:6,dual:'together'};PianoHost.save();});await nav('reading');await page.locator('#studyCourse').selectOption('free');await page.locator('#studyClef').selectOption('dual');await page.locator('#studyFlow').selectOption('guided');await page.locator('#studyDual').selectOption('together');await page.locator('#studyLaunch').click();await page.locator('#lessonHint').click();
 const first=await page.locator('#lessonStage [data-target]').first().getAttribute('data-target');await page.locator(`#lessonKeys [data-midi="${first}"]`).click();
 assert.equal(await page.locator('#lessonNext').isVisible(),false);assert.equal(await page.locator('#lessonMemory').isVisible(),false);await page.locator('#lessonHint').click();const text=await page.locator('#lessonMemory .memory-diagram').getAttribute('aria-label');assert.match(text,/低音谱表/);const notes=await page.locator('#lessonStage [data-event="0"] [data-target]').evaluateAll(es=>es.map(e=>Number(e.dataset.target)));assert.equal(notes.length,2);await page.locator(`#lessonKeys [data-midi="${notes[1]}"]`).click();
 await page.locator('#lessonFinish').click();await page.locator('#modalConfirm').click();
 // Timed phrase -> same score assisted learning; the original course does not advance.
 await nav('reading');await page.locator('#studyClef').selectOption('treble');await page.locator('#studyFlow').selectOption('continuous');await page.locator('#studyLaunch').click();const sig=await page.locator('#lessonStage [data-target]').evaluateAll(es=>es.map(e=>e.dataset.target));await page.locator('#lessonHint').click();assert(await page.locator('#lessonMemory').isVisible());assert.deepEqual(await page.locator('#lessonStage [data-target]').evaluateAll(es=>es.map(e=>e.dataset.target)),sig);assert.match(await page.locator('#lessonCaption').innerText(),/辅助短句/);await page.locator('#lessonFinish').click();await page.locator('#modalConfirm').click();assert(await page.getByRole('button',{name:'回到原训练无提示检查'}).isVisible());
 // Rhythm guidance is available while ready, closes before timing and is recorded as assisted.
 await page.evaluate(()=>PianoRhythm.open({mode:'hold',course:'progressive',tempo:80,meter:'4/4'}));await page.locator('#rhStart').click();await page.locator('#rhHint').click();assert.match(await page.locator('#rhScore .memory-card').innerText(),/延续|休止/);await page.locator('[data-rh-hint-next]').click();assert.match(await page.locator('#rhScore .memory-card').innerText(),/第2小节/);await page.screenshot({path:path.join(output,'记忆提示_节奏界面.png')});await page.locator('#rhGo').click();assert.equal(await page.locator('#rhScore .memory-host').count(),0);assert(await page.locator('#rhHint').isDisabled());await page.waitForTimeout(3400);await page.locator('#rhFinish').click();await page.locator('#modalConfirm').click();assert.match(await page.locator('#studyLesson .hint-return').innerText(),/辅助练习/);assert.equal(await page.evaluate(()=>PianoHost.getDB().study.rhythm.reports.at(-1).hint),true);
 await page.getByRole('button',{name:'逐小节看提示'}).click();assert(await page.locator('.rh-report-score .memory-host').isVisible());
 // The hint gate must block a genuinely clean rhythm too (no mistakes or pause).
 await page.evaluate(()=>PianoRhythm.open({mode:'hold',course:'progressive',tempo:120,meter:'2/4'}));await page.locator('#rhStart').click();await page.locator('#rhHint').click();
 await page.evaluate(()=>document.querySelector('#rhGo').addEventListener('click',()=>{
  const s=PianoHost.getDB().study.rhythm.settings,ex=RhythmCore.generate(s),bm=60000/s.tempo,start=performance.now()+RhythmCore.barBeats(s)*bm;
  for(const e of ex.events.filter(e=>!e.rest)){const pad=document.querySelector('.rh-pad');setTimeout(()=>pad.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:123,button:0})),Math.max(0,start+e.beat*bm-performance.now()));setTimeout(()=>pad.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:123,button:0})),Math.max(0,start+(e.beat+e.duration)*bm-8-performance.now()));}
 },{once:true}));await page.locator('#rhGo').click();await page.waitForSelector('#rhAgain',{timeout:9000});
 const cleanAided=await page.evaluate(()=>PianoHost.getDB().study.rhythm.reports.at(-1));assert.equal(cleanAided.result.metrics.hit,cleanAided.result.metrics.seen);assert.equal(cleanAided.result.metrics.extras,0);assert(cleanAided.result.answers.every(a=>a.hold));assert.equal(cleanAided.courseResult.passed,false);assert.equal(cleanAided.courseResult.phase,0);
 // Delivered HTML must also work via file:// without an HTTP server.
 const local=await browser.newPage();local.on('pageerror',e=>errors.push(e.message));await local.goto('file:///'+path.resolve(__dirname,'../native/assets/index.html').replaceAll('\\','/'));await local.waitForFunction(()=>window.PianoReady);assert(await local.locator('#today').isVisible());await local.close();
 assert.deepEqual(errors,[]);console.log('Hint UI: specialty fade/reload, reverse, visual relations, portrait, free scoring, phrase helper, rhythm breakdown, file:// and zero page errors passed.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
