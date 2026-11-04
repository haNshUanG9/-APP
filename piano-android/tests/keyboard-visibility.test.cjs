const assert=require('node:assert/strict'),{chromium}=require('playwright'),{pathToFileURL}=require('node:url'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../../deliverables/配色修正_2026-11-02'),url=pathToFileURL(path.resolve(__dirname,'../native/assets/index.html')).href;
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[];
 try{
  for(const midi of [false,true]){
   const context=await b.newContext({viewport:{width:1280,height:800}});
   if(midi)await context.addInitScript(()=>{window.PianoAndroid={midiClock:()=>performance.now(),midiStatus(){window.PianoInput?.status({state:'connected',detail:'模拟实体琴',devices:[{id:7,port:0,name:'Test Piano'}],deviceId:7,port:0,generation:0});}};});
   const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.PianoReady&&window.PianoTablet);
   const nav=async name=>{await p.locator('#workspaceMenu').click();await p.locator(`.nav [data-page="${name}"]`).click();};
   const settle=()=>p.waitForTimeout(180),keys=p.locator('.study-keyboard-area'),toggle=p.locator('#workspaceKeyboard');
   await nav('topics');await p.locator('[data-topic="anchors"]').click();await settle();
   if(midi){assert(await keys.isHidden());assert.equal(await toggle.innerText(),'显示键盘');await toggle.click();await settle();assert(await keys.isVisible());assert(await p.locator('body').evaluate(e=>e.classList.contains('midi-keys-visible')));}
   if(await p.locator('#lessonMemory').isVisible())await p.locator('[data-memory-close]').click();
   for(const [w,h]of [[1280,800],[800,1280]]){
    await p.setViewportSize({width:w,height:h});await settle();const before=await p.evaluate(()=>({token:PianoStudy.midiToken(),status:document.getElementById('lessonStatus').textContent,study:JSON.stringify(PianoHost.getDB().study),target:document.querySelector('#lessonStage [data-target]').getAttribute('data-target')})),height=await p.locator('#lessonStage').evaluate(e=>e.clientHeight);
    assert.equal(await toggle.innerText(),'收起键盘');await toggle.click();await settle();assert(await keys.isHidden());assert.equal(await toggle.innerText(),'显示键盘');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert(await p.locator('#lessonStage').evaluate(e=>e.clientHeight)>height+100);assert(await p.locator('#lessonMemory').isHidden());
    assert.deepEqual(await p.evaluate(()=>({token:PianoStudy.midiToken(),status:document.getElementById('lessonStatus').textContent,study:JSON.stringify(PianoHost.getDB().study),target:document.querySelector('#lessonStage [data-target]').getAttribute('data-target')})),before,'collapse must preserve current question, closed hints and learning evidence');
    if(!midi)await p.screenshot({path:path.join(out,`键盘收起_${w}.png`)});
    await toggle.click();await settle();assert(await keys.isVisible());assert.equal(await toggle.innerText(),'收起键盘');assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.equal(await p.locator('#lessonStage').evaluate(e=>e.clientHeight),height);
   }
   await p.locator('#lessonPause').click();await toggle.click();await settle();assert(await p.locator('#lessonPauseCover').isVisible());assert.equal(await p.locator('#lessonPause').innerText(),'继续');await toggle.click();await p.locator('#coverResume').click();await p.locator('#lessonTools').click();await p.locator('#studyLesson').getByRole('button',{name:'结束本轮',exact:true}).click();await p.locator('#modalConfirm').click();
   await nav('today');await p.locator('#freePractice').click();await settle();if(midi&&!await p.locator('#practice>.keyboard-area').isVisible())await toggle.click();await toggle.click();await settle();assert(await p.locator('#practice>.keyboard-area').isHidden());await toggle.click();assert(await p.locator('#practice>.keyboard-area').isVisible());
   await nav('today');await p.locator('#foundationStart').click();await settle();await toggle.click();assert(await p.locator('.foundation-keyboard').isHidden());await toggle.click();assert(await p.locator('.foundation-keyboard').isVisible());
   await nav('topics');await p.locator('[data-topic="rhythm"]').click();assert(await toggle.isHidden());
   await context.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS: touch and simulated MIDI, two orientations; collapse expands score, show restores keyboard, current target/progress/evidence/closed hint/pause preserved; classic and course controls; hidden for rhythm.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
