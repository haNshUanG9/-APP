/* Shared tablet shell; audio, MIDI, scoring and learning keep their existing owners. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),body=document.body,rail=document.querySelector('.app-rail');
 const names={today:'识谱练习室',topics:'专项练习',reading:'短句读谱',foundationPage:'循序课程',rhythmPage:'节奏训练',songsPage:'曲谱工作区',progressPage:'进步记录',practice:'自由识谱',studyLesson:'正在练习',help:'学习说明',profiles:'音符档案',mistakes:'错题复习',history:'练习记录',result:'练习结果',notePicker:'选择练习音'};
 let queued=false,lastSize='',navFocus=null,previewOwner=null;
 const hiddenKeyboards=new Set(),keyboardButton=document.createElement('button');
 keyboardButton.id='workspaceKeyboard';keyboardButton.type='button';keyboardButton.hidden=true;$('workspaceInput').before(keyboardButton);
 function keyboardContext(){
  const screen=body.dataset.screen,reverse=body.classList.contains('midi-reverse');
  if(screen==='practice')return {panel:document.querySelector('#practice>.keyboard-area'),key:'practice',midi:body.classList.contains('midi-layout')};
  if(screen==='studyLesson'&&!$('studyLesson').classList.contains('show-report'))return {panel:document.querySelector('#studyLesson .study-keyboard-area'),key:reverse?'reverse':'study',midi:body.classList.contains('midi-layout')&&!reverse};
  if(screen==='foundationPage'&&$('foundationPage').dataset.view==='session')return {panel:document.querySelector('#foundationPage .foundation-keyboard'),key:'foundation',midi:false};
  return null;
 }
 function syncKeyboard(){
  const context=keyboardContext(),panel=context?.panel,collapsed=!!panel&&!context.midi&&hiddenKeyboards.has(context.key);
  if(body.classList.contains('tablet-keyboard-hidden')!==collapsed)body.classList.toggle('tablet-keyboard-hidden',collapsed);
  keyboardButton.hidden=!panel;if(!panel)return;
  if(!panel.id)panel.id=context.key+'KeyboardPanel';
  const visible=getComputedStyle(panel).display!=='none'&&!panel.hidden;
  text(keyboardButton,visible?'收起键盘':'显示键盘');keyboardButton.setAttribute('aria-expanded',String(visible));keyboardButton.setAttribute('aria-controls',panel.id);keyboardButton.title=visible?'收起屏幕键盘，扩大谱面':'显示屏幕键盘';
 }
 keyboardButton.onclick=()=>{
  const context=keyboardContext();if(!context?.panel)return;
  if(context.midi)$('midiKeysToggle').click();
  else{hiddenKeyboards.has(context.key)?hiddenKeyboards.delete(context.key):hiddenKeyboards.add(context.key);syncKeyboard();window.dispatchEvent(new Event('pianolayoutchange'));}
 };
 const shade=document.createElement('div');shade.id='tabletMenuBackdrop';shade.className='tablet-menu-backdrop';shade.hidden=true;body.appendChild(shade);
 const done=document.createElement('button');done.className='tablet-menu-close';done.textContent='返回工作区';rail.appendChild(done);
 rail.setAttribute('role','dialog');rail.setAttribute('aria-modal','true');rail.setAttribute('aria-label','主菜单');
 function close(){if(previewOwner){previewOwner.previewNavigation(false);previewOwner=null;}body.classList.remove('tablet-menu-open');shade.hidden=true;$('workspaceMenu').setAttribute('aria-expanded','false');rail.setAttribute('aria-hidden','true');if(navFocus?.isConnected)navFocus.focus({preventScroll:true});}
 function open(){window.PianoSongs?.closePanel?.();navFocus=document.activeElement;previewOwner=[window.PianoFoundation,window.PianoStudy,window.PianoSongs].find(o=>o?.previewNavigation?.(true))||null;if(!previewOwner)window.PianoPause?.();done.textContent=previewOwner?'回到当前题':'返回工作区';let note=rail.querySelector('.menu-pause-note');if(!note){note=document.createElement('p');note.className='menu-pause-note';done.before(note);}note.textContent=previewOwner?'查看菜单时暂存当前题；返回可继续独立作答。':'正在计时或播放的训练会暂停；返回后手动继续，本轮保留中断记录。';body.classList.add('tablet-menu-open');shade.hidden=false;$('workspaceMenu').setAttribute('aria-expanded','true');rail.removeAttribute('aria-hidden');rail.querySelector('.nav button.active,.nav button')?.focus();}
 shade.onclick=close;done.onclick=close;$('workspaceMenu').onclick=()=>body.classList.contains('tablet-menu-open')?close():open();
 $('workspaceBack').onclick=()=>window.PianoBack?.();$('workspaceInput').onclick=()=>window.PianoInput?.open();
 rail.addEventListener('click',e=>{if(e.target.closest('[data-page]'))close();});
 function text(el,value){if(el&&el.textContent!==value)el.textContent=value;}
 function decorate(){
  queued=false;const screen=body.dataset.screen||'today',study=screen==='studyLesson'&&!$('studyLesson').classList.contains('show-report'),task=study||screen==='practice';
  body.classList.toggle('tablet-task',task);body.classList.toggle('tablet-rhythm',study&&$('studyLesson').classList.contains('rhythm-workspace'));body.classList.toggle('tablet-foundation',screen==='foundationPage'&&$('foundationPage').dataset.view==='session');
  text(document.querySelector('.app-header h1'),screen==='songsPage'?(window.PianoSongs?.getState().song?.title||'我的曲谱'):names[screen]||'识谱练习室');$('workspaceBack').hidden=screen==='today';
  const midi=window.PianoInput?.isMidi();text($('workspaceInputLabel'),midi?'实体琴已连接':'触屏练习');$('workspaceInput').classList.toggle('connected',!!midi);$('workspaceInput').title=$('midiNotes')?.textContent||'实体琴与输入设置';
  body.classList.toggle('tablet-study',study&&!$('studyLesson').classList.contains('rhythm-workspace'));if(body.classList.contains('tablet-study')){const footer=$('studyLesson').querySelector('.lesson-footer');if(footer&&keyboardButton.parentElement!==footer)footer.appendChild(keyboardButton);}else{if(keyboardButton.parentElement!==document.querySelector('.app-header'))$('workspaceInput').before(keyboardButton);body.classList.remove('task-tools-open');}syncKeyboard();
  const size=task?[innerWidth,innerHeight,body.classList.contains('midi-layout'),body.classList.contains('midi-keys-visible'),body.classList.contains('midi-reverse'),body.classList.contains('tablet-keyboard-hidden')].join(':'):'';
  if(size!==lastSize){lastSize=size;if(task)requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));}
 }
 new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(decorate);}}).observe(body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-screen','data-view','class']});
 window.addEventListener('pianolayoutchange',()=>window.dispatchEvent(new Event('resize')));
 document.addEventListener('keydown',e=>{
  const menu=body.classList.contains('tablet-menu-open'),song=$('songPanel'),panel=menu?rail:song&&!song.hidden?song:null;if(!panel){if(e.key==='Escape'){const metro=document.querySelector('.metronome-drawer[open]');if(metro){metro.open=false;$('metroDrawerToggle')?.focus();e.preventDefault();}}return;}
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();menu?close():window.PianoSongs.closePanel();}
  if(e.key==='Tab'){const nodes=[...panel.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),summary')].filter(x=>x.getClientRects().length);if(!nodes.length)return;const i=nodes.indexOf(document.activeElement);e.preventDefault();nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length].focus();}
 },true);
 const back=window.PianoBack;window.PianoBack=()=>{if(body.classList.contains('tablet-menu-open')){close();return true;}const metro=document.querySelector('.metronome-drawer[open]');if(metro){metro.open=false;$('metroDrawerToggle')?.focus();return true;}return back?.();};
 window.PianoTablet={openNavigation:open,closeNavigation:close};close();decorate();
})();
