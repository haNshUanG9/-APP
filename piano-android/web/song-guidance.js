/* Production tablet workspace: views follow the song owner's clock and never change scoring targets implicitly. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),C=SongCore,G=SongGuidanceCore,esc=C.esc;
 const key='piano-song-guidance-v1';let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(e){}
 let api=null,prefs=null,open=false,lastFrame='',liveBeat=0;
 const icons={play:'m8 5 12 7-12 7Z',pause:'M7 5h3v14H7Zm7 0h3v14h-3Z',loop:'m17 3 4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3',redo:'M3 10a9 9 0 1 1 2 9M3 4v6h6',piano:'M3 4h18v16H3ZM7 4v9h3V4m4 0v9h3V4M9 13v7m6-7v7',settings:'M5 3v6m0 4v8M12 3v11m0 4v3M19 3v3m0 4v11M2 9h6m1 5h6m1-8h6',down:'m7 10 5 5 5-5'};
 const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[n]}"/></svg>`;
 const hand=s=>s.hand==='both'?'双手':s.hand==='right'?'右手':'左手';
 function save(){saved[api.get().song.id]={...prefs};try{localStorage.setItem(key,JSON.stringify(saved));}catch(e){}}
 function panelHTML(){const {settings:s,active,run,song}=api.get(),exam=s.mode==='exam';return `<div class="guide-sheet-head"><h2>这一遍，怎么练</h2><button id="guideClose" aria-label="关闭本轮设置">×</button></div><p class="guide-label">练习目标${active?' · 本轮已固定':''}</p><div class="guide-choice">${[['left','左手'],['right','右手'],['both','双手']].map(([k,n])=>`<button data-guide-hand="${k}" ${active?'disabled':''} aria-pressed="${s.hand===k}">${n}</button>`).join('')}</div><label class="guide-label">演奏分工<select id="guideHandMap" ${active?'disabled':''}><option value="score">${song.format==='midi'&&!song.study?.original?'按 MIDI 分界音':'按原谱/内置编配'}</option><option value="swap">交换左右手</option><option value="right">全部由右手练</option><option value="left">全部由左手练</option></select></label><label class="guide-row"><span>另一只手伴奏<small>${s.mode==='beginner'?'认音阶段可停下来纠错；伴奏用于跟拍':s.hand==='both'?'单手跟拍时可开启':'跟拍时应用播放另一声部'}</small></span><input id="guideAccompany" type="checkbox" ${s.accompany?'checked':''} ${active||s.mode!=='advanced'||s.hand==='both'?'disabled':''}></label><p class="guide-label">键位预读${exam?' · 考核关闭':''}</p><div class="guide-choice">${[['off','关闭'],['current','当前'],['next','当前＋下一组']].map(([k,n])=>`<button data-guide-hint="${k}" ${exam?'disabled':''} aria-pressed="${!exam&&prefs.hint===k}">${n}</button>`).join('')}</div><label class="guide-row"><span>显示指法<small>原谱或人工编配；缺失时不猜测</small></span><input id="guideFingers" type="checkbox" ${prefs.fingers?'checked':''} ${exam?'disabled':''}></label><p class="guide-note">收起帮助不会改变本轮判定目标。使用键位或指法帮助的练习会记为辅助完成；关闭后再独立检查。</p>${active?'<p class="guide-note">要更改手别、伴奏或片段，请先结束本轮。</p>':''}<button id="guideDone" class="primary">回到谱面</button>`;}
 function panel(){const root=$('songGuidePanel');if(!root||!api)return;root.innerHTML=panelHTML();root.hidden=!open;$('songGuideShade').hidden=!open;
  const s=api.get().settings;$('guideHandMap').value=s.handMap||'score';
  $('guideClose').onclick=$('guideDone').onclick=close;
  root.querySelectorAll('[data-guide-hand]').forEach(b=>b.onclick=()=>api.change({hand:b.dataset.guideHand}));
  $('guideHandMap').onchange=()=>api.change({handMap:$('guideHandMap').value});$('guideAccompany').onchange=()=>api.change({accompany:$('guideAccompany').checked});
  root.querySelectorAll('[data-guide-hint]').forEach(b=>b.onclick=()=>{prefs.hint=b.dataset.guideHint;save();lastFrame='';panel();update(liveBeat);api.notation();});
  $('guideFingers').onchange=()=>{prefs.fingers=$('guideFingers').checked;save();lastFrame='';panel();update(liveBeat);api.notation();};
 }
 function show(){open=true;panel();$('guideClose')?.focus();}
 function close(){open=false;if($('songGuidePanel'))$('songGuidePanel').hidden=true;if($('songGuideShade'))$('songGuideShade').hidden=true;update(liveBeat);$('songHandQuick')?.focus({preventScroll:true});}
 function toggleKeys(){prefs.keys=$('songKeyPane').hidden;save();applyKeys();lastFrame='';update(liveBeat);api.layout();}
 function applyKeys(){const visible=prefs.keys??api.get().input!=='midi';$('songKeys').hidden=!visible;$('songKeyPane').hidden=!visible;document.body.classList.toggle('tablet-song-keys',visible);$('songKeysToggle').innerHTML=icon('piano')+(visible?'收起键盘':'展开键盘');$('songKeysToggle').setAttribute('aria-expanded',String(visible));$('songKeysToggle').setAttribute('aria-controls','songKeyPane');}
 function mount(owner){
  api=owner;const d=api.get();if(!d.song)return;const raw=saved[d.song.id]||{};prefs={hint:['off','current','next'].includes(raw.hint)?raw.hint:'off',fingers:raw.fingers!==false,keys:typeof raw.keys==='boolean'?raw.keys:null};
  liveBeat=d.beat;lastFrame='';const top=document.querySelector('.tablet-song-top'),transport=document.querySelector('.song-transport');
  const modes=document.querySelector('.song-mode-tabs');top.insertBefore(modes,$('songReaderToggle'));
  const quick=document.createElement('button');quick.id='songHandQuick';quick.innerHTML='<i></i>练'+hand(d.settings)+icon('down');top.insertBefore(quick,$('songReaderToggle'));quick.onclick=show;
  const keys=$('songKeys'),keyPane=document.createElement('section');keyPane.id='songKeyPane';keyPane.setAttribute('aria-label','琴键与双手提示');keyPane.innerHTML='<div class="guide-key-legend"><span><i class="left"></i>左手　<i class="right"></i>右手</span><span>实心：当前目标　○ 下一组　描边：实际按键</span></div><div class="guide-key-scroll"></div>';keys.before(keyPane);keyPane.querySelector('.guide-key-scroll').appendChild(keys);$('songKeysToggle').onclick=toggleKeys;
  const pos=document.createElement('div');pos.id='songGuidePosition';pos.innerHTML='<span id="guideCue"></span>';$('songPosition').before(pos);pos.prepend($('songPosition'));document.querySelector('.song-workspace').insertBefore(pos,transport);
  const nav=document.createElement('div');nav.id='songMeasureNav';nav.innerHTML=`<span id="guideRangeLabel">${d.settings.from}—${d.settings.to} 小节</span><div id="guideMeasures" role="group" aria-label="小节定位">${d.song.measures.map(m=>`<button data-measure="${m.index}" aria-label="第 ${m.index} 小节">${esc(m.label||m.index)}</button>`).join('')}</div><button id="guideRangePick" aria-pressed="false">选循环段</button>`;transport.before(nav);
  let pick=null;nav.querySelectorAll('[data-measure]').forEach(b=>b.onclick=()=>{const bar=Number(b.dataset.measure);if(pick!==null){if(pick===0){pick=bar;$('guideRangePick').textContent='再选终点';b.classList.add('pending');}else{const a=pick;pick=null;api.change({from:Math.min(a,bar),to:Math.max(a,bar),loop:true});}}else api.locate(bar);});
  $('guideRangePick').onclick=()=>{if(api.get().active){api.notice('结束本轮后再选择循环范围。');return;}pick=pick===null?0:null;$('guideRangePick').textContent=pick===null?'选循环段':'先选起点';$('guideRangePick').setAttribute('aria-pressed',String(pick!==null));};
  const speed=document.createElement('div');speed.id='songSpeedBar';speed.innerHTML='<button id="guideSlower" aria-label="减慢速度">−</button><button id="guideSpeed" aria-label="输入速度"></button><button id="guideFaster" aria-label="加快速度">＋</button>';transport.insertBefore(speed,$('songHint'));
  const adjust=delta=>api.tempo(api.get().settings.tempo+delta);$('guideSlower').onclick=()=>adjust(-5);$('guideFaster').onclick=()=>adjust(5);$('guideSpeed').onclick=()=>{api.settingsPanel();$('songTempo')?.focus();};
  const loop=document.createElement('button');loop.id='songLoopQuick';loop.innerHTML=icon('loop')+'循环';transport.appendChild(loop);loop.onclick=()=>api.loop(!api.get().settings.loop);
  const hints=document.createElement('button');hints.id='songHintsQuick';hints.innerHTML=icon('settings')+'提示';hints.onclick=show;transport.appendChild(hints);transport.appendChild($('songKeysToggle'));
  $('songWhole').hidden=true;
  const panelNode=document.createElement('section');panelNode.id='songGuidePanel';panelNode.setAttribute('role','dialog');panelNode.setAttribute('aria-modal','true');panelNode.setAttribute('aria-label','本轮练习与提示');$('songsPage').appendChild(panelNode);const shade=document.createElement('div');shade.id='songGuideShade';shade.onclick=close;$('songsPage').appendChild(shade);
  applyKeys();panel();update(liveBeat);
 }
 function update(beat){
  if(!api||!$('guideCue'))return;liveBeat=beat;const d=api.get(),s=d.settings,r=d.run,exam=s.mode==='exam',visible=!open&&!document.hidden;
  const enabled=!exam&&!s.drill&&prefs.hint!=='off',notes=d.exercise.all.filter(n=>n.pitch>=21&&n.pitch<=108&&(s.hand==='both'||n.staff===(s.hand==='right'?1:2)||s.mode==='advanced'&&s.accompany));
  const group=d.active&&(s.mode==='beginner')?r.exercise.groups[r.index]:null;
  const frame=enabled?G.frame(notes,beat,{group,next:prefs.hint==='next',loop:s.loop,from:d.exercise.from,to:d.exercise.to}):{current:[],next:[]};
  if(enabled&&visible&&d.active&&!r.paused&&s.mode!=='listen')api.assist([...frame.current,...frame.next].map(n=>n.id));
  const expected=G.keyStates(frame),actual=d.pressed,signature=JSON.stringify([beat.toFixed(2),[...expected],actual,s.mode,prefs.fingers,visible,d.active,r?.paused,d.wrong]);
  if(signature===lastFrame)return;lastFrame=signature;
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
  $('guideSpeed').innerHTML='<b>'+Math.round(s.tempo)+' BPM</b><small>'+Number(s.tempo/d.song.baseTempo).toFixed(2)+'×</small>';
  const locked=d.active&&s.mode!=='listen';$('guideSlower').disabled=$('guideFaster').disabled=$('guideSpeed').disabled=locked||s.mode==='exam';$('songLoopQuick').disabled=s.mode==='exam';$('songHintsQuick').disabled=exam;$('songLoopQuick').classList.toggle('selected',s.loop);
  const measure=d.song.measures.find(m=>beat<m.end-.0001)||d.song.measures.at(-1);
  for(const b of $('guideMeasures').children){const n=Number(b.dataset.measure),inRange=n>=s.from&&n<=s.to;b.classList.toggle('selected',inRange);b.classList.toggle('now',n===measure.index);b.setAttribute('aria-current',n===measure.index?'true':'false');}
  api.paint(frame.current,frame.next,!exam&&!s.drill);
 }
 const back=window.PianoBack;window.PianoBack=()=>{if(open){close();return true;}return back?.();};
 document.addEventListener('keydown',e=>{if(!open)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}else if(e.key==='Tab'){const a=[...$('songGuidePanel').querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled)')],i=a.indexOf(document.activeElement);e.preventDefault();a[(i+(e.shiftKey?-1:1)+a.length)%a.length]?.focus();}},true);
 window.PianoSongGuide={mount,update,close,isOpen:()=>open,scoreFingers:()=>!!prefs&&prefs.fingers&&prefs.hint!=='off',reset:()=>{api=null;open=false;lastFrame='';},refresh:()=>update(liveBeat)};
})();
