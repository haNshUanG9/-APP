/* Run unchanged behavior regressions through the new visible navigation/settings entrances. */
const {chromium}=require('playwright');
const launch=chromium.launch.bind(chromium);
function bindPage(page){
 if(process.env.PIANO_TRACE_ERRORS)page.on('pageerror',e=>console.error(e.stack));
 const locate=page.locator.bind(page);
 page.locator=function(selector,...rest){const loc=locate(selector,...rest);
  async function reveal(){
   const sheet=locate('#songPanel');
   if(await sheet.isVisible().catch(()=>false)&&(/^\.nav /.test(selector)||selector.startsWith('[data-song-mode')||/^#song(Start|Pause|Stop|Hint|KeysToggle)$/.test(selector)))await locate('#songPanelClose').click();
   if(await loc.first().isVisible().catch(()=>false))return false;
   if(/^\.nav /.test(selector)){await page.evaluate(()=>window.PianoTablet?.openNavigation());return false;}
   if(selector==='#midiConnection'){await locate('#workspaceInput').click();return true;}
   if(selector==='#midiKeysToggle'){await page.evaluate(()=>document.getElementById('midiKeysToggle').click());return true;}
   const library=selector.startsWith('[data-song-mode')||/^#song(Setup|From|To|Tempo|Hand|Track|Exam|Zoom|File|Backup|Free|Route|Due|NextTask|Learning)/.test(selector)||selector==='#songImport';
   if(library&&await page.evaluate(()=>document.body.classList.contains('tablet-song'))&&!(await sheet.isVisible())){await locate('#songReaderToggle').click();await page.waitForFunction(()=>!document.getElementById('songStart').disabled);}
   return false;
  }
  for(const method of ['click','fill','selectOption','setInputFiles','check','uncheck']){const original=loc[method].bind(loc);loc[method]=async(...args)=>{const handled=await reveal();if(!handled)return original(...args);};}
  return loc;
 };return page;
}
chromium.launch=async(...args)=>{const browser=await launch(...args),newPage=browser.newPage.bind(browser),newContext=browser.newContext.bind(browser);browser.newPage=async(...a)=>bindPage(await newPage(...a));browser.newContext=async(...a)=>{const ctx=await newContext(...a),create=ctx.newPage.bind(ctx);ctx.newPage=async(...x)=>bindPage(await create(...x));return ctx;};return browser;};
