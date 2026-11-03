/* Production tablet workspace: views follow the song owner's clock and never change scoring targets implicitly. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),C=SongCore,G=SongGuidanceCore,esc=C.esc;
 const key='piano-song-guidance-v1';let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(e){}
 let api=null,prefs=null,open=false,lastFrame='',liveBeat=0,sheet='settings',focus=false,controls=false;
 const sheetMemory={};
 function rememberSheet(){const root=$('songGuidePanel'),content=root?.querySelector('.guide-sheet-body');if(content)sheetMemory[sheet]={scroll:content.scrollTop,more:!!root.querySelector('.guide-more')?.open};}
 const modes={beginner:'认音',advanced:'跟拍',exam:'考核',listen:'欣赏'};
 const icons={play:'m8 5 12 7-12 7Z',pause:'M7 5h3v14H7Zm7 0h3v14h-3Z',loop:'m17 3 4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3',redo:'M3 10a9 9 0 1 1 2 9M3 4v6h6',piano:'M3 4h18v16H3ZM7 4v9h3V4m4 0v9h3V4M9 13v7m6-7v7',settings:'M5 3v6m0 4v8M12 3v11m0 4v3M19 3v3m0 4v11M2 9h6m1 5h6m1-8h6',down:'m7 10 5 5 5-5'};
 const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[n]}"/></svg>`;
 const hand=s=>s.hand==='both'?'双手':s.hand==='right'?'右手':'左手';
 function save(){saved[api.get().song.id]={...prefs};try{localStorage.setItem(key,JSON.stringify(saved));}catch(e){}}
 function panelHTML(){
  const {settings:s,active,song}=api.get(),exam=s.mode==='exam',locked=active&&s.mode!=='listen';
  const head=title=>`<div class="guide-sheet-head"><h2>${title}</h2><button id="guideClose" aria-label="关闭设置">×</button></div>`;
  if(sheet==='speed')return head('速度')+`<label class="guide-label">每分钟拍数<input id="guideTempoInput" type="number" min="20" max="240" value="${Math.round(s.tempo)}" ${locked||exam?'disabled':''}></label><div class="guide-choice"><button id="guideSlower" ${locked||exam?'disabled':''}>− 5</button><button id="guideFaster" ${locked||exam?'disabled':''}>＋ 5</button></div><p class="guide-note">${locked?'本轮速度已固定，结束后可以调整。':'欣赏时可直接调速，保留播放位置。'}</p><button id="guideDone" class="primary">回到谱面</button>`;
  if(sheet==='range')return head('练习片段')+`<div class="guide-range-fields"><label>起始小节<input id="guideFrom" type="number" min="1" max="${song.measures.length}" value="${s.from}" ${active?'disabled':''}></label><label>结束小节<input id="guideTo" type="number" min="1" max="${song.measures.length}" value="${s.to}" ${active?'disabled':''}></label></div><label class="guide-row"><span>循环选段</span><input id="guideLoop" type="checkbox" ${s.loop?'checked':''} ${exam?'disabled':''}></label><button id="guideRangePick" ${active?'disabled':''}>在小节中选择范围</button><div id="guideMeasures" role="group" aria-label="小节定位">${song.measures.map(m=>`<button data-measure="${m.index}" aria-label="第 ${m.index} 小节">${esc(m.label||m.index)}</button>`).join('')}</div><p class="guide-note" id="guideRangeNote">${active?'结束本轮后可更改片段。':'选择起止小节；点击小节可定位。'}</p><button id="guideRangeApply" ${active?'disabled':''}>应用片段</button><button id="guideDone" class="primary">回到谱面</button>`;
  return head('这一遍，怎么练')+`<p class="guide-label">练习模式${active?' · 本轮已固定':''}</p><div class="guide-choice">${Object.entries(modes).map(([k,n])=>`<button data-guide-mode="${k}" ${active?'disabled':''} aria-pressed="${s.mode===k}">${n}</button>`).join('')}</div><p class="guide-label">练习手别</p><div class="guide-choice">${[['left','左手'],['right','右手'],['both','双手']].map(([k,n])=>`<button data-guide-hand="${k}" ${active?'disabled':''} aria-pressed="${s.hand===k}">${n}</button>`).join('')}</div><label class="guide-row"><span>另一只手伴奏<small>单手跟拍时播放另一声部</small></span><input id="guideAccompany" type="checkbox" ${s.accompany?'checked':''} ${active||s.mode!=='advanced'||s.hand==='both'?'disabled':''}></label><p class="guide-label">键位提示${exam?' · 考核关闭':''}</p><div class="guide-choice">${[['off','关闭'],['current','当前'],['next','当前＋下一组']].map(([k,n])=>`<button data-guide-hint="${k}" ${exam?'disabled':''} aria-pressed="${!exam&&prefs.hint===k}">${n}</button>`).join('')}</div><label class="guide-row"><span>琴键指法<small>仅显示原谱或人工编配的指法</small></span><input id="guideFingers" type="checkbox" ${prefs.fingers?'checked':''} ${exam?'disabled':''}></label><label class="guide-row"><span>节拍器</span><input id="guideMetronome" type="checkbox" ${s.metronome?'checked':''} ${active?'disabled':''}></label><button id="guideInput" class="guide-link">${api.get().input==='midi'?'实体琴已连接':'触屏练习'} · 输入设置 ›</button><details class="guide-more"><summary>声部分配与更多设置</summary><label class="guide-label">演奏分工<select id="guideHandMap" ${active?'disabled':''}><option value="score">${song.format==='midi'&&!song.study?.original?'按 MIDI 分界音':'按原谱 / 内置编配'}</option><option value="swap">交换左右手</option><option value="right">全部由右手练</option><option value="left">全部由左手练</option></select></label><button id="guideLibrary">高级设置与输入校准</button><button id="guideEnd" ${active?'':'disabled'}>结束本轮</button><button id="guideNoteHint" ${s.mode==='beginner'&&active?'':'hidden'}>当前音的记忆提示</button></details><p class="guide-note">使用键位或指法帮助会记为辅助完成；关闭后再独立检查。</p><button id="guideDone" class="primary">回到谱面</button>`;
 }
 function panel(){
  const root=$('songGuidePanel');if(!root||!api)return;rememberSheet();root.innerHTML=panelHTML();root.hidden=!open;$('songGuideShade').hidden=!open;document.body.classList.toggle('song-sheet-open',open);
  const head=root.querySelector('.guide-sheet-head'),done=$('guideDone'),applyButton=$('guideRangeApply'),content=document.createElement('div'),footer=document.createElement('div');
  content.className='guide-sheet-body';footer.className='guide-sheet-footer';
  for(const child of [...root.children])if(child!==head&&child!==done&&child!==applyButton)content.appendChild(child);
  if(applyButton)footer.appendChild(applyButton);footer.appendChild(done);root.append(content,footer);
  const memory=sheetMemory[sheet];if(memory){const more=root.querySelector('.guide-more');if(more)more.open=memory.more;content.scrollTop=memory.scroll;}
  $('guideClose').onclick=$('guideDone').onclick=close;
  const bind=(id,fn,event='onclick')=>{if($(id))$(id)[event]=()=>{rememberSheet();fn();};};
  const s=api.get().settings;
  root.querySelectorAll('[data-guide-mode]').forEach(b=>b.onclick=()=>{rememberSheet();api.change({mode:b.dataset.guideMode});});
  root.querySelectorAll('[data-guide-hand]').forEach(b=>b.onclick=()=>{rememberSheet();api.change({hand:b.dataset.guideHand});});
  if($('guideHandMap'))$('guideHandMap').value=s.handMap||'score';
  bind('guideHandMap',()=>api.change({handMap:$('guideHandMap').value}),'onchange');
  bind('guideAccompany',()=>api.change({accompany:$('guideAccompany').checked}),'onchange');
  bind('guideMetronome',()=>api.change({metronome:$('guideMetronome').checked}),'onchange');
  root.querySelectorAll('[data-guide-hint]').forEach(b=>b.onclick=()=>{prefs.hint=b.dataset.guideHint;save();lastFrame='';panel();update(liveBeat);api.notation();});
  bind('guideFingers',()=>{prefs.fingers=$('guideFingers').checked;save();lastFrame='';panel();update(liveBeat);api.notation();},'onchange');
  bind('guideInput',()=>{close();window.PianoInput?.open();});
  bind('guideLibrary',()=>{close();api.settingsPanel('settings');});bind('guideEnd',()=>{close();$('songStop').click();});bind('guideNoteHint',()=>{close();$('songHint').click();});
  bind('guideTempoInput',()=>api.tempo(Number($('guideTempoInput').value)),'onchange');
  const adjust=delta=>{api.tempo(api.get().settings.tempo+delta);panel();};bind('guideSlower',()=>adjust(-5));bind('guideFaster',()=>adjust(5));
  bind('guideLoop',()=>api.loop($('guideLoop').checked),'onchange');
  const apply=()=>{const from=Number($('guideFrom').value),to=Number($('guideTo').value);api.change({from,to});};bind('guideRangeApply',apply);
  let pick=null;bind('guideRangePick',()=>{pick=pick===null?0:null;$('guideRangeNote').textContent=pick===null?'点击小节可定位。':'先选起点，再选终点。';});
  root.querySelectorAll('[data-measure]').forEach(b=>b.onclick=()=>{const bar=Number(b.dataset.measure);if(pick!==null){if(!pick){pick=bar;b.classList.add('pending');$('guideRangeNote').textContent='再选择终点小节。';}else{const from=Math.min(pick,bar),to=Math.max(pick,bar);pick=null;api.change({from,to,loop:true});}}else api.locate(bar);});
 }
 function show(which='settings'){rememberSheet();sheet=which;open=true;const root=$('songGuidePanel');if(root)root.replaceChildren();panel();$('guideClose')?.focus();}
 function close(){rememberSheet();open=false;document.body.classList.remove('song-sheet-open');if($('songGuidePanel'))$('songGuidePanel').hidden=true;if($('songGuideShade'))$('songGuideShade').hidden=true;lastFrame='';update(liveBeat);$(sheet==='speed'?'guideSpeed':sheet==='range'?'songRange':'songHandQuick')?.focus({preventScroll:true});}
 function setFocus(value){focus=value;controls=false;document.body.classList.toggle('song-focus',focus);document.body.classList.remove('song-focus-controls');$('songFocusToggle').setAttribute('aria-pressed',String(focus));$('songFocusToggle').setAttribute('aria-label',focus?'退出专注看谱':'专注看谱');$('songFocusMore').setAttribute('aria-expanded','false');lastFrame='';api.layout();update(liveBeat);}
 function toggleKeys(){prefs.keys=$('songKeyPane').hidden;save();applyKeys();lastFrame='';update(liveBeat);api.layout();}
 function applyKeys(){const visible=prefs.keys??api.get().input!=='midi';$('songKeys').hidden=!visible;$('songKeyPane').hidden=!visible;document.body.classList.toggle('tablet-song-keys',visible);$('songKeysToggle').innerHTML=icon('piano')+(visible?'收起键盘':'展开键盘');$('songKeysToggle').setAttribute('aria-expanded',String(visible));$('songKeysToggle').setAttribute('aria-controls','songKeyPane');}
 function mount(owner){
  api=owner;const d=api.get();if(!d.song)return;const raw=saved[d.song.id]||{};prefs={hint:['off','current','next'].includes(raw.hint)?raw.hint:'off',fingers:raw.fingers!==false,keys:typeof raw.keys==='boolean'?raw.keys:null};
  liveBeat=d.beat;lastFrame='';const top=$('songsPage').querySelector('.tablet-song-top'),transport=$('songsPage').querySelector('.song-transport');
  const modesNode=$('songsPage').querySelector('.song-mode-tabs');$('songPanel').querySelector('.song-panel-settings').prepend(modesNode);
  const quick=document.createElement('button');quick.id='songHandQuick';quick.innerHTML=modes[d.settings.mode]+' · '+hand(d.settings)+icon('down');top.insertBefore(quick,$('songReaderToggle'));quick.onclick=()=>show();
  const focusButton=document.createElement('button');focusButton.id='songFocusToggle';focusButton.setAttribute('aria-label','专注看谱');focusButton.setAttribute('aria-pressed',String(focus));focusButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';top.appendChild(focusButton);focusButton.onclick=()=>setFocus(!focus);
  document.querySelectorAll('.app-header > .tablet-song-top').forEach(e=>e.remove());document.querySelector('.app-header').appendChild(top);
  const keys=$('songKeys'),keyPane=document.createElement('section');keyPane.id='songKeyPane';keyPane.setAttribute('aria-label','琴键与双手提示');keyPane.innerHTML='<div class="guide-key-legend"><span><i class="left"></i>左手　<i class="right"></i>右手</span><span>轮廓为下一组</span></div><div class="guide-key-scroll"></div>';keys.before(keyPane);keyPane.querySelector('.guide-key-scroll').appendChild(keys);$('songKeysToggle').onclick=toggleKeys;
  const owners=document.createElement('div');owners.className='song-transport-owners';for(const id of ['songStart','songPause','songStop','songHint','songWhole'])owners.appendChild($(id));transport.prepend(owners);
  const play=document.createElement('button');play.id='songPlay';play.className='song-play';transport.prepend(play);play.onclick=()=>{if(api.get().active)$('songPause').click();else $('songStart').click();};
  const restart=document.createElement('button');restart.id='songRestart';restart.setAttribute('aria-label','从片段起点重练');restart.innerHTML=icon('redo');transport.prepend(restart);restart.onclick=()=>api.restart();
  const speed=document.createElement('button');speed.id='guideSpeed';transport.appendChild(speed);speed.onclick=()=>show('speed');
  const range=document.createElement('button');range.id='songRange';transport.appendChild(range);range.onclick=()=>show('range');
  const progress=document.createElement('input');progress.id='songSeek';progress.type='range';progress.min='1';progress.max=d.song.measures.length;progress.step='1';progress.setAttribute('aria-label','定位小节');transport.appendChild(progress);progress.oninput=()=>api.locate(Number(progress.value));
  transport.appendChild($('songPosition'));transport.appendChild($('songKeysToggle'));
  const cue=document.createElement('span');cue.id='guideCue';cue.hidden=true;transport.appendChild(cue);
  const focusBack=document.createElement('button');focusBack.id='songFocusBack';focusBack.setAttribute('aria-label','退出专注看谱');focusBack.textContent='×';$('songsPage').appendChild(focusBack);focusBack.onclick=()=>setFocus(false);
  const more=document.createElement('button');more.id='songFocusMore';more.textContent='•••';more.setAttribute('aria-label','更多演奏控制');more.setAttribute('aria-expanded','false');transport.appendChild(more);more.onclick=()=>{controls=!controls;document.body.classList.toggle('song-focus-controls',controls);more.setAttribute('aria-expanded',String(controls));};
  const panelNode=document.createElement('section');panelNode.id='songGuidePanel';panelNode.setAttribute('role','dialog');panelNode.setAttribute('aria-modal','true');panelNode.setAttribute('aria-label','本轮练习与提示');$('songsPage').appendChild(panelNode);const shade=document.createElement('div');shade.id='songGuideShade';shade.onclick=close;$('songsPage').appendChild(shade);
  document.body.classList.toggle('song-focus',focus);applyKeys();panel();update(liveBeat);
 }
 function update(beat){
  if(!api||!$('guideCue'))return;liveBeat=beat;const d=api.get(),s=d.settings,r=d.run,exam=s.mode==='exam',visible=!open&&!document.hidden;
  const keyVisible=!focus&&!$('songKeyPane').hidden;
  const enabled=!exam&&!s.drill&&prefs.hint!=='off',notes=d.exercise.all.filter(n=>n.pitch>=21&&n.pitch<=108&&(s.hand==='both'||n.staff===(s.hand==='right'?1:2)||s.mode==='advanced'&&s.accompany));
  const group=d.active&&(s.mode==='beginner')?r.exercise.groups[r.index]:null;
  const frame=enabled?G.frame(notes,beat,{group,next:prefs.hint==='next',loop:s.loop,from:d.exercise.from,to:d.exercise.to}):{current:[],next:[]};
  if(enabled&&visible&&keyVisible&&d.active&&!r.paused&&s.mode!=='listen')api.assist([...frame.current,...frame.next].map(n=>n.id));
  const expected=G.keyStates(frame),actual=d.pressed,signature=JSON.stringify([beat.toFixed(2),[...expected],actual,s.mode,prefs.fingers,visible,keyVisible,d.active,r?.paused,d.wrong]);
  lastFrame=signature;
  for(const key of $('songKeys').querySelectorAll('[data-song-key]')){
   const pitch=Number(key.dataset.songKey),state=expected.get(pitch),curr=state?.current||[],next=state?.next||[];
   key.classList.toggle('guide-current-r',curr.some(n=>n.hand===1));key.classList.toggle('guide-current-l',curr.some(n=>n.hand===2));key.classList.toggle('guide-next-r',next.some(n=>n.hand===1));key.classList.toggle('guide-next-l',next.some(n=>n.hand===2));key.classList.toggle('guide-pressed',actual.includes(pitch));key.classList.toggle('guide-wrong',!exam&&d.wrong.includes(pitch));
   const mark=n=>`${n.hand===1?'右':'左'}${prefs.fingers&&n.finger?' '+n.finger:''}`;
   const text=curr.map(mark).join(' / '),upcoming=next.map(mark).join(' / ');
   const c=key.querySelector('.guide-current'),n=key.querySelector('.guide-next');if(c.textContent!==text)c.textContent=text;if(n.textContent!==upcoming)n.textContent=upcoming;n.dataset.hand=next.length&&next.every(x=>x.hand===2)?'left':next.length&&next.every(x=>x.hand===1)?'right':'both';
   key.setAttribute('aria-label',C.pitchName(pitch)+(text?' · 当前 '+text:'')+(upcoming?' · 下一组 '+upcoming:''));
  }
  const relevant=arr=>arr.filter(n=>s.hand==='both'||n.staff===(s.hand==='right'?1:2));const describe=arr=>relevant(arr).slice(0,4).map(n=>C.pitchName(n.pitch)+(prefs.fingers&&n.finger?' · '+n.finger+'指':'')).join('、');
  const cue=enabled?'当前 '+(describe(frame.current)||'等待')+(prefs.hint==='next'?'　→　下一组 '+(describe(frame.next)||'本段结束'):''):exam?'独立考核 · 键位和指法提示关闭':'提示已收起 · 可独立练习';
  if($('guideCue').textContent!==cue)$('guideCue').textContent=cue;
  $('guideSpeed').innerHTML='<b>'+Math.round(s.tempo)+'</b> <small>BPM</small>';
  const locked=d.active&&s.mode!=='listen';$('guideSpeed').disabled=locked||s.mode==='exam';
  const measure=d.song.measures.find(m=>beat<m.end)||d.song.measures.at(-1);
  $('songRange').innerHTML=icon('loop')+s.from+'—'+s.to+' 小节'+icon('down');
  $('songSeek').value=measure.index;$('songSeek').disabled=locked;$('songSeek').setAttribute('aria-valuetext','第 '+measure.index+' 小节');
  const playing=d.active&&!r.paused;const play=$('songPlay');play.innerHTML=icon(playing?'pause':'play');play.setAttribute('aria-label',playing?'暂停':d.active?'继续':s.mode==='listen'?'播放选段':'开始练习');play.disabled=!d.active&&$('songStart').disabled;
  $('songHandQuick').innerHTML=modes[s.mode]+' · '+hand(s)+icon('down');
  if($('guideMeasures'))for(const b of $('guideMeasures').children){const n=Number(b.dataset.measure);b.classList.toggle('selected',n>=s.from&&n<=s.to);b.classList.toggle('now',n===measure.index);b.setAttribute('aria-current',n===measure.index?'true':'false');}
  api.paint(frame.current,frame.next,!exam&&!s.drill);
 }
 const back=window.PianoBack;window.PianoBack=()=>{if(open){close();return true;}if(focus){setFocus(false);return true;}return back?.();};
 document.addEventListener('keydown',e=>{if(!open)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}else if(e.key==='Tab'){const a=[...$('songGuidePanel').querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),summary')].filter(el=>el.getClientRects().length),i=a.indexOf(document.activeElement);e.preventDefault();a[(i+(e.shiftKey?-1:1)+a.length)%a.length]?.focus();}},true);
 window.PianoSongGuide={mount,update,close,show,isFocused:()=>focus,exitFocus:()=>setFocus(false),isOpen:()=>open,scoreFingers:()=>!!prefs&&prefs.fingers&&prefs.hint!=='off',reset:()=>{api=null;open=false;focus=false;controls=false;document.body.classList.remove('song-focus','song-focus-controls','song-sheet-open');lastFrame='';},refresh:()=>{lastFrame='';update(liveBeat);}};
})();
