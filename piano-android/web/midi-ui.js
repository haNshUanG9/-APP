/* USB MIDI status, input routing and the physical-piano workspace. */
(()=>{
  'use strict';
  const H=window.PianoHost,$=id=>document.getElementById(id),native=window.PianoAndroid;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let prefs={mode:'auto',keyboard:false,autoAdvance:true,delay:650,scale:1,left:48,right:60,channel:-1};
  try{prefs={...prefs,...JSON.parse(localStorage.getItem('piano-midi-v1')||'{}')};}catch(e){}
  if(!['auto','midi','touch'].includes(prefs.mode))prefs.mode='auto';
  if(![350,650,1200].includes(prefs.delay))prefs.delay=650;
  if(![1,1.2,1.4].includes(prefs.scale))prefs.scale=1;
  for(const k of ['left','right'])if(!Number.isInteger(prefs[k])||prefs[k]<21||prefs[k]>108)prefs[k]=k==='left'?48:60;
  if(!Number.isInteger(prefs.channel)||prefs.channel< -1||prefs.channel>15)prefs.channel=-1;
  let connection={state:native?'disconnected':'unavailable',detail:native?'连接琴的 USB TO HOST 到平板。':'USB MIDI 在 Android 安装版中使用。',devices:[],deviceId:-1,port:-1,generation:0},panelOpen=false,last=null,autoTimer=0,renderTimer=0,layout=false,learnKey=null,lastFocus=null;
  const state=MidiCore.tracker();
  const connected=()=>connection.state==='connected';
  const enabled=()=>connected()&&prefs.mode!=='touch';
  const active=()=>window.PianoEar?.isActive()||H.classicActive()||window.PianoStudy?.isActive()||window.PianoFoundation?.isActive()||window.PianoSongs?.isActive();
  function owner(){if(window.PianoEar?.isActive())return window.PianoEar;if(window.PianoSongs?.isActive())return window.PianoSongs;if(window.PianoFoundation?.isActive())return window.PianoFoundation;if(window.PianoRhythm?.isActive())return window.PianoRhythm;if(window.PianoStudy?.ownsActive())return window.PianoStudy;return H;}
  function save(){try{localStorage.setItem('piano-midi-v1',JSON.stringify(prefs));}catch(e){H.notice('输入设置暂时无法保存，本次仍可使用。');}}
  function cancelAuto(){clearTimeout(autoTimer);autoTimer=0;}
  function reset(){owner().midiEvent?.({type:'reset',all:true,channel:0,at:performance.now()});state.reset();cancelAuto();refreshMonitor();}
  function pause(){cancelAuto();window.PianoEar?.pause();H.pauseClassic?.('实体琴输入发生变化，确认后点击继续。');window.PianoStudy?.pause();window.PianoSongs?.pause();}
  function apply(force=false){
    const next=prefs.mode==='midi'||enabled();
    if(force||!active())layout=next;
    document.body.classList.toggle('midi-layout',layout);
    document.body.classList.toggle('midi-keys-visible',prefs.keyboard);
    document.body.classList.toggle('midi-reverse',window.PianoStudy?.isReverse?.()===true);
    document.body.style.setProperty('--score-scale',prefs.scale);
    if($('rhythmMidiHelp'))$('rhythmMidiHelp').textContent=enabled()?'节奏键：单侧用 '+PianoCore.midiName(prefs.right)+'；双侧左 '+PianoCore.midiName(prefs.left)+' / 右 '+PianoCore.midiName(prefs.right)+'。按下起拍，松开结束。':'触屏按谱练习；连接实体琴后可用指定琴键完成。';
    $('midiKeysToggle').textContent=prefs.keyboard?'收起琴键':'按键监视';
    $('midiKeysToggle').hidden=!layout;
    $('midiModeTag').textContent=enabled()?'实体琴输入':prefs.mode==='midi'?'等待实体琴':'触屏输入';
    const prompt=$('lessonKeyPrompt');if(prompt&&layout&&!window.PianoStudy?.isReverse?.())prompt.textContent='按键监视 · 在实体琴上作答';
    $('midiLamp').classList.toggle('connected',connected());
    $('midiDeviceText').textContent=connected()?deviceName():connection.state==='connecting'?'连接中…':connection.state==='unsupported'?'此设备不支持 MIDI':'连接实体琴';
    $('midiConnection').title=connection.detail;
    refreshMonitor();
  }
  function deviceName(){return connection.devices.find(d=>d.id===connection.deviceId&&d.port===connection.port)?.name||'USB MIDI 已连接';}
  function refreshMonitor(){
    const notes=[...new Set([...state.held.values()].map(e=>e.note))].sort((a,b)=>a-b);
    $('midiNotes').textContent=notes.length?'按住：'+notes.map(PianoCore.midiName).join(' · '):last?'最近：'+PianoCore.midiName(last.note)+' · 已松开':'弹一个音测试连接';
    $('midiPedal').textContent=state.pedals.size?'踏板：踩下':'';
    $('midiMonitor').classList.toggle('has-input',notes.length>0);
    document.querySelectorAll('.key[data-midi]').forEach(k=>k.classList.toggle('midi-pressed',notes.includes(Number(k.dataset.midi))));
    if(panelOpen){$('midiTest').textContent=notes.length?'收到：'+notes.map(PianoCore.midiName).join(' · '):last?'最近收到 '+PianoCore.midiName(last.note)+' · 力度 '+last.velocity:'请在琴上弹一个音；收到的音会显示在这里。';}
  }
  function sync(){apply();}
  function autoContinue(){
    cancelAuto();const target=owner();if(target.autoContinue){target.autoContinue();return;}
    if(!enabled()||!prefs.autoAdvance||panelOpen||document.hidden||state.held.size||!target.midiReady?.())return;
    const token=target.midiToken?.();
    autoTimer=setTimeout(()=>{autoTimer=0;if(enabled()&&!panelOpen&&!document.hidden&&!state.held.size&&owner()===target&&target.midiToken?.()===token&&target.midiReady?.())target.midiAdvance?.();},prefs.delay);
  }
  function status(data){
    const before=enabled();
    if(!data||!Array.isArray(data.devices))return;
    const changed=connection.state==='connected'&&(data.state!=='connected'||data.deviceId!==connection.deviceId||data.port!==connection.port||data.generation!==connection.generation);
    connection=data;
    if(changed){pause();reset();H.notice(data.state==='disconnected'?'实体琴已断开，训练已暂停。':data.detail);}
    if(!active())apply(true);else apply();
    if(!before&&enabled()&&active()&&owner().inputSource?.()==='touch'){owner().stopForInputChange?.();H.notice('已接入实体琴，当前触屏轮次已保存；重新开始后使用实体琴。');}
    if(panelOpen)renderPanel(false);if(before!==enabled())window.dispatchEvent(new Event('pianoinputchange'));
  }
  function eventTime(e){
    const before=performance.now();let clock=null;try{clock=native?.midiClock?.();}catch(err){}
    const after=performance.now();return typeof clock==='number'&&Number.isFinite(e.timeMs)?Math.min(after,Math.max(after-2000,e.timeMs+(before+after)/2-clock)):after;
  }
  function receive(events){
    if(!connected()||!Array.isArray(events))return;
    for(const raw of events){
      if(prefs.channel>=0&&raw.channel!==prefs.channel&&!raw.all)continue;
      const e={...raw,at:eventTime(raw)},accepted=state.accept(e);
      if(e.type==='on'&&accepted){last=e;if(learnKey&&e.note>=21&&e.note<=108){const other=learnKey==='left'?'right':'left';if(e.note!==prefs[other]){prefs[learnKey]=e.note;learnKey=null;save();renderPanel(false);}else $('midiTest').textContent='左右侧需要选择不同的琴键。';}}
      if(accepted&&enabled()&&!panelOpen&&!document.hidden&&!H.modalOpen()){const target=owner();target.midiEvent?.(e);target.midiActivity?.(e);}
    }
    refreshMonitor();autoContinue();
  }
  function renderPanel(focus=true){
    const previous=document.activeElement?.id;
    $('midiPanelContent').innerHTML=`<div class="midi-panel-head"><div><h2>实体琴与输入</h2><p>${esc(connection.detail)}</p></div><button id="midiClose">返回练习</button></div>
      <div class="midi-device-controls"><label>USB MIDI 设备<select id="midiDevice">${connection.devices.length?connection.devices.map(d=>`<option value="${d.id}:${d.port}">${esc(d.name)}${d.portName?' · '+esc(d.portName):' · 端口 '+(d.port+1)}</option>`).join(''):'<option value="">尚未发现设备</option>'}</select></label><button id="midiConnect" class="primary" ${!connection.devices.length||!native?'disabled':''}>连接所选设备</button><button id="midiRefresh" ${native?'':'disabled'}>刷新设备</button><button id="midiDisconnect" ${connected()?'':'disabled'}>断开</button></div>
      <div id="midiTest" class="midi-test" role="status"></div>
      <div class="midi-settings-grid"><label>作答输入<select id="midiMode"><option value="auto">自动 · 接入实体琴后切换</option><option value="midi">实体琴</option><option value="touch">触屏</option></select></label><label>谱面大小<select id="midiScale"><option value="1">标准</option><option value="1.2">放大 20%</option><option value="1.4">放大 40%</option></select></label><label>自由识谱换题停留<select id="midiDelay"><option value="350">较快 · 0.35 秒</option><option value="650">适中 · 0.65 秒</option><option value="1200">慢读 · 1.2 秒</option></select></label><label>接收通道<select id="midiChannel"><option value="-1">全部通道</option>${Array.from({length:16},(_,i)=>`<option value="${i}">通道 ${i+1}</option>`).join('')}</select></label>
      <label class="midi-check"><input type="checkbox" id="midiAuto">弹对并松键后自动继续（专项静候 1 秒）</label><label class="midi-check"><input type="checkbox" id="midiKeyboard">显示屏幕按键监视</label></div>
      <div class="midi-rhythm-keys"><h3>节奏训练的作答键</h3><p>单侧节奏用右侧键；双侧分别用两个指定键。这里只评节奏，不要求弹谱面音高。</p><div><button id="midiLearnLeft">${learnKey==='left'?'请弹左侧作答键…':'左侧：'+PianoCore.midiName(prefs.left)+' · 点击更换'}</button><button id="midiLearnRight">${learnKey==='right'?'请弹右侧作答键…':'右侧：'+PianoCore.midiName(prefs.right)+' · 点击更换'}</button></div></div>
      <p class="midi-panel-note">连接方式：琴的 USB TO HOST → 数据线 / 转接头 → 平板。琴保持自身声音；应用节拍器与示范单独播放。时值课程按实际松键判断，踏板状态只显示、不延长按键时值。反向定位仍在谱面上点击作答。</p>`;
    $('midiMode').value=prefs.mode;$('midiScale').value=prefs.scale;$('midiDelay').value=prefs.delay;$('midiChannel').value=prefs.channel;$('midiAuto').checked=prefs.autoAdvance;$('midiKeyboard').checked=prefs.keyboard;
    const selected=connection.deviceId+':'+connection.port;if(connection.devices.some(d=>d.id+':'+d.port===selected))$('midiDevice').value=selected;
    $('midiClose').onclick=closePanel;
    $('midiConnect').onclick=()=>{const [id,port]=$('midiDevice').value.split(':').map(Number);native?.midiConnect(id,port);};
    $('midiRefresh').onclick=()=>native?.midiRefresh();$('midiDisconnect').onclick=()=>native?.midiDisconnect();
    for(const [id,k,number]of [['midiMode','mode',false],['midiScale','scale',true],['midiDelay','delay',true],['midiChannel','channel',true]])$(id).onchange=()=>{const before=enabled();prefs[k]=number?Number($(id).value):$(id).value;reset();save();if(k==='mode'&&(before!==enabled()||active()&&owner().inputSource?.()!==(prefs.mode==='touch'?'touch':enabled()?'midi':'touch'))){owner().stopForInputChange?.();window.dispatchEvent(new Event('pianoinputchange'));}apply(true);};
    $('midiAuto').onchange=()=>{prefs.autoAdvance=$('midiAuto').checked;save();};$('midiKeyboard').onchange=()=>{prefs.keyboard=$('midiKeyboard').checked;save();apply(true);};
    $('midiLearnLeft').onclick=()=>{learnKey='left';renderPanel(false);};$('midiLearnRight').onclick=()=>{learnKey='right';renderPanel(false);};
    refreshMonitor();if(focus)$('midiClose').focus();else if(previous)$(previous)?.focus();
  }
  function openPanel(){lastFocus=document.activeElement;pause();reset();panelOpen=true;$('midiPanel').hidden=false;renderPanel();native?.midiStatus();}
  function closePanel(){panelOpen=false;learnKey=null;$('midiPanel').hidden=true;reset();apply(true);lastFocus?.focus();}
  const bar=document.createElement('div');bar.className='midi-bar';bar.innerHTML='<button id="midiConnection" class="midi-connection"><span id="midiLamp" class="midi-lamp"></span><span id="midiDeviceText"></span></button><span id="midiModeTag" class="midi-mode-tag"></span><div id="midiMonitor" class="midi-monitor"><span id="midiNotes"></span><span id="midiPedal"></span></div><button id="midiKeysToggle">按键监视</button>';
  document.querySelector('.app-shell').insertBefore(bar,document.querySelector('.app-header'));
  const panel=document.createElement('div');panel.id='midiPanel';panel.className='midi-panel-backdrop';panel.hidden=true;panel.innerHTML='<section id="midiPanelContent" class="midi-panel" role="dialog" aria-modal="true" aria-label="实体琴与输入"></section>';document.body.appendChild(panel);
  $('midiConnection').onclick=openPanel;$('midiKeysToggle').onclick=()=>{prefs.keyboard=!prefs.keyboard;save();apply(true);window.dispatchEvent(new Event('pianolayoutchange'));};
  document.addEventListener('keydown',e=>{if(!panelOpen)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closePanel();}else if(e.key==='Tab'){const nodes=[...$('midiPanel').querySelectorAll('button:not(:disabled),select,input')],i=nodes.indexOf(document.activeElement);e.preventDefault();nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length]?.focus();}},true);
  const priorBack=window.PianoBack;window.PianoBack=()=>panelOpen?(closePanel(),true):priorBack();
  const priorPause=window.PianoPause;window.PianoPause=()=>{priorPause?.();reset();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});window.addEventListener('blur',reset);
  new MutationObserver(sync).observe(document.querySelector('.main'),{childList:true});
  window.PianoInput={status,receive,reset,sync,apply,autoContinue,hasHeldNotes:()=>state.held.size>0,autoAdvanceEnabled:()=>prefs.autoAdvance,isMidi:enabled,isLayout:()=>layout,touchAllowed:()=>!enabled()&&!(active()&&owner().inputSource?.()==='midi'),panelOpen:()=>panelOpen,rhythmKeys:()=>({left:prefs.left,right:prefs.right}),context:()=>enabled()?'midi':'touch',open:openPanel};
  apply(true);native?.midiStatus();
})();
