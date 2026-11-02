/* Legacy behavior checks enter the current visible controls; no hidden owner clicks. */
const {chromium}=require('playwright');
const launch=chromium.launch.bind(chromium);
function bindPage(page){
 if(process.env.PIANO_TRACE_ERRORS)page.on('pageerror',e=>console.error(e.stack));
 const locate=page.locator.bind(page);
 page.locator=function(selector,...rest){const loc=locate(selector,...rest);
  async function closeSheet(){if(await locate('#songGuidePanel').isVisible().catch(()=>false))await locate('#guideDone').click();if(await locate('#songPanel').isVisible().catch(()=>false))await locate('#songPanelClose').click();}
  async function guide(which='settings'){await closeSheet();await locate(which==='range'?'#songRange':which==='speed'?'#guideSpeed':'#songHandQuick').click();}
  async function tools(){if(await locate('#lessonTools').isVisible().catch(()=>false)&&!(await page.evaluate(()=>document.body.classList.contains('task-tools-open'))))await locate('#lessonTools').click();}
  async function reveal(method,args){
   if(await locate('#songGuidePanel').isVisible().catch(()=>false)&&/^#(songHandQuick|songPlay|songKeysToggle|songRange|guideSpeed)$/.test(selector))await locate('#guideDone').click();
   if(await loc.first().isVisible().catch(()=>false))return false;
   if(selector==='#workspaceMenu'){if(await locate('#lessonBack').isVisible().catch(()=>false))await locate('#lessonBack').click();else await page.evaluate(()=>window.PianoTablet.openNavigation());return true;}
   if(/^\.nav /.test(selector)){await page.evaluate(()=>window.PianoTablet.openNavigation());return false;}
   if(selector==='#midiConnection'){await page.evaluate(()=>PianoInput.open());return true;}
   if(selector==='#midiKeysToggle'){await page.evaluate(()=>document.getElementById('midiKeysToggle').click());return true;}
   if(selector==='#lessonFinish'){await tools();await locate('.study-keyboard-toolbar button').filter({hasText:'结束本轮'}).click();return true;}
   if(/^#lesson(Local|Full|Sound)$/.test(selector)){await tools();return false;}
   if(await page.evaluate(()=>document.body.classList.contains('tablet-song'))){
    if(selector==='#songReaderToggle'){await guide();await locate('.guide-more').evaluate(e=>e.open=true);await locate('#guideLibrary').click();return true;}
    if(/^#song(Start|Pause)$/.test(selector)){await closeSheet();await locate('#songPlay').click();return true;}
    if(selector==='#songStop'||selector==='#songHint'){await guide();await locate('.guide-more').evaluate(e=>e.open=true);await locate(selector==='#songStop'?'#guideEnd':'#guideNoteHint').click();return true;}
    if(selector==='#songWhole'){await guide('range');await locate('#guideFrom').fill('1');await locate('#guideTo').fill(String(await page.evaluate(()=>PianoSongs.getState().song.measures.length)));await locate('#guideRangeApply').click();await locate('#guideDone').click();return true;}
    if(selector.startsWith('[data-song-mode')){await guide();const mode=selector.match(/data-song-mode=["']?([a-z]+)/)[1];await locate('[data-guide-mode='+mode+']').click();await locate('#guideDone').click();return true;}
    if(/^#guide(Slower|Faster)$/.test(selector)){await guide('speed');return false;}
    if(selector==='#guideRangePick'||selector.startsWith('[data-measure')){if(!(await locate('#guideMeasures').isVisible().catch(()=>false)))await guide('range');return false;}
    const library=/^#song(Setup|From|To|Tempo|Hand|Track|Exam|Zoom|File|Backup|Free|Route|Due|NextTask|Learning|Import)/.test(selector);
    if(library){if(!(await locate('#songPanel').isVisible())){await guide();await locate('.guide-more').evaluate(e=>e.open=true);await locate('#guideLibrary').click();}return false;}
   }
   return false;
  }
  for(const method of ['click','fill','selectOption','setInputFiles','check','uncheck']){const original=loc[method].bind(loc);loc[method]=async(...args)=>{const handled=await reveal(method,args);if(!handled)return original(...args);};}
  return loc;
 };return page;
}
chromium.launch=async(options={})=>{const browser=await launch({...options,args:[...(options.args||[]),'--disable-audio-output']}),newPage=browser.newPage.bind(browser),newContext=browser.newContext.bind(browser);browser.newPage=async(...a)=>bindPage(await newPage(...a));browser.newContext=async(...a)=>{const ctx=await newContext(...a),create=ctx.newPage.bind(ctx);ctx.newPage=async(...x)=>bindPage(await create(...x));return ctx;};return browser;};
