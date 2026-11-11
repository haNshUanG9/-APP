/* Offline song library, engraving, transport and physical-keyboard practice. */
(()=>{
  'use strict';
  const C=SongCore,L=SongLearning,H=window.PianoHost,$=id=>document.getElementById(id),esc=C.esc;
  const MODES={beginner:['认音练习','弹对再前进'],advanced:['跟拍练习','音高与起拍'],exam:['考核','无提示完成'],listen:['欣赏','跟谱听音乐']};
  let library=[],selected=null,song=null,prefs={},page=false,busy=false,starting=false,run=null,osmd=null,renderGeneration=0,raf=0,audio=null,scheduled=[],dbPromise=null,pressed=new Set(),heldVoices=new Map(),lastCursor=-1;
  const stateKey='piano-song-settings-v1',recordKey='piano-song-reports-v1',learningKey='piano-song-learning-v1',selectionKey='piano-song-last-v1',viewKey='piano-song-view-v1';
  const reading=true;let menuPreview=false;let panelOpen=false,panelFocus=null,panelView='library',guideExercise=null,guideWrong=new Set(),guidePainted=new Set();
  let libraryReady=Promise.resolve(),theoryRun=null,pendingTheoryRestore=null;
  let learning=L.defaults(),noteIndex=new Map(),displayReport=null,practiceOrigin=null;
  try{learning=L.normalize(JSON.parse(localStorage.getItem(learningKey)||'null'));}catch(e){}
  const builtin=()=>SongBank.all(),isBuiltin=id=>builtin().some(s=>s.id===id);
  function saveLearning(){try{localStorage.setItem(learningKey,JSON.stringify(learning));}catch(e){H.notice('曲谱学习进度未能保存，请备份曲谱库。');}}
  function taskFor(){const t=learning.current[input()];return t?.songId===selected?t:null;}
  function freeTask(){delete learning.current[input()];saveLearning();}
  let records=[];
  try{prefs=JSON.parse(localStorage.getItem(stateKey)||'{}');records=JSON.parse(localStorage.getItem(recordKey)||'[]');if(!Array.isArray(records))records=[];if(!prefs||typeof prefs!=='object'||Array.isArray(prefs))prefs={};}catch(e){}
  let savedViews={};try{const raw=JSON.parse(localStorage.getItem(viewKey)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))savedViews=raw;}catch(e){}
  function saveView(){if(!song||lastCursor<0)return;const measure=(song.measures.find(m=>lastCursor<m.end)||song.measures.at(-1)).index;savedViews[selected]=measure;try{localStorage.setItem(viewKey,JSON.stringify(savedViews));}catch(e){}}
  function viewBeat(){const bar=savedViews[selected];return Number.isInteger(bar)&&song.measures[bar-1]?song.measures[bar-1].start:-1;}
  const input=()=>window.PianoInput?.isMidi()?'midi':'touch';
  const active=()=>!!run&&!run.finished;
  const guided=()=>run&&(run.settings.mode==='beginner'||run.settings.mode==='exam'&&run.settings.examKind==='notes');
  function openDB(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('piano-score-library',1);req.onupgradeneeded=()=>req.result.createObjectStore('songs',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('无法打开本机曲谱库，请导出原文件备份。'));});
    return dbPromise;
  }
  async function store(method,value){
    const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('songs',method==='getAll'?'readonly':'readwrite'),st=tx.objectStore('songs'),req=st[method](value);let result;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('本机曲谱保存失败，请检查存储空间。'));tx.onabort=()=>reject(Error('曲谱保存被中断。'));});
  }
  function settings(){return song?C.settings(song,prefs[selected]||{}):{};}
  function saveSettings(){try{localStorage.setItem(stateKey,JSON.stringify(prefs));}catch(e){H.notice('曲谱设置暂时无法保存，本轮仍可使用。');}}
  function tell(message,bad=false){if($('songFeedback')){$('songFeedback').textContent=message;$('songFeedback').classList.toggle('bad',bad);$('songFeedback').parentElement.classList.toggle('guide-message',bad||/正在准备|已暂停|结束本轮|速度已固定|独立检查/.test(message));}}
  function titleFor(s){return s.drill?'原句节奏拆练':MODES[s.mode][0]+(s.mode==='exam'?' · '+(s.examKind==='notes'?'认音考核':'跟拍考核'):'');}

  function captureTheoryContext(){
    if(!song||busy||starting)return null;
    if(active()&&run.settings.mode==='exam'){tell('考核运行中不能查阅帮助。先结束考核再进入。',true);return null;}
    const groups=active()?run.exercise.groups:C.prepared(song,settings()).groups,current=groups[active()?run.index:groups.findIndex(g=>g.sourceBeat>=Math.max(0,lastCursor))]||groups.at(-1);
    const context={version:1,songId:selected,title:song.title,settings:{...settings()},beat:Math.max(0,lastCursor),notes:current?.notes.map(n=>n.pitch)||[],scrollTop:$('songScoreScroll')?.scrollTop||0,viewWidth:innerWidth,viewHeight:innerHeight,focus:window.PianoSongGuide?.isFocused()||false,keysVisible:!$('songKeyPane')?.hidden,source:input(),at:Date.now(),practiceOrigin:practiceOrigin?{...TheoryData.copy(practiceOrigin),songId:selected}:null};
    if(active()){run.assisted=true;run.interrupted=true;run.theoryReturnId=Date.now().toString(36);context.runToken=run.theoryReturnId;theoryRun=run;pause();}
    return context;
  }
  async function restoreTheoryContext(raw){
    const ctx=TheoryData.returnContext(raw);if(!ctx)return false;
    await libraryReady;const target=library.find(s=>s.id===ctx.songId);
    if(!target){H.notice('原曲已不在本机曲库，请重新选择曲谱。');H.showPage('songsPage');return false;}
    if(active()&&run!==theoryRun){H.notice('另一段曲谱正在练习，已保留当前任务；可结束后再回原段。');return false;}
    const same=active()&&run===theoryRun&&run.theoryReturnId===ctx.runToken&&selected===ctx.songId&&run.source===input();
    if(active()&&!same)finish(false,false);
    selected=ctx.songId;song=target;prefs[selected]=C.settings(song,ctx.settings);const st=prefs[selected];
    if(same&&(st.from!==ctx.settings.from||st.to!==ctx.settings.to)){finish(false,false);}
    practiceOrigin=ctx.practiceOrigin?.songId===selected?ctx.practiceOrigin:null;
    const low=song.measures[st.from-1]?.start||0,high=song.measures[st.to-1]?.end||song.measures.at(-1).end;
    lastCursor=Math.max(low,Math.min(high,ctx.beat));saveSettings();
    pendingTheoryRestore={songId:selected,beat:lastCursor,scrollTop:ctx.scrollTop||0,sameSize:ctx.viewWidth===innerWidth&&ctx.viewHeight===innerHeight,focus:ctx.focus,keysVisible:ctx.keysVisible,same:active()&&same,sourceChanged:ctx.source!==input()};
    H.showPage('songsPage');return true;
  }
  function completeTheoryRestore(){
    const ctx=pendingTheoryRestore;if(!ctx||ctx.songId!==selected||!page)return;pendingTheoryRestore=null;
    moveCursor(ctx.beat,true);
    if(ctx.focus)window.PianoSongGuide?.enterFocus();
    if($('songKeyPane')&&$('songKeyPane').hidden===ctx.keysVisible)$('songKeysToggle')?.click();
    if(ctx.sameSize&&$('songScoreScroll'))$('songScoreScroll').scrollTop=ctx.scrollTop;
    if(ctx.same&&active()){run.paused=true;run.assisted=true;run.interrupted=true;setLocked(true);$('songPause').textContent='继续';}
    const message=ctx.sourceChanged?'已回原段；输入方式改变，请重新开始。':ctx.same?'已回原段 · 已暂停 · 本轮含知识帮助，点击继续。':'已回原曲原段 · 准备状态，点击开始。';
    tell(message);if($('songPosition')){$('songPosition').textContent=message;$('songPosition').title=message;}
  }

  function renderLibrary(){
    const host=$('songLibrary');if(!host)return;
    host.innerHTML=library.map(s=>`<button class="song-item ${s.id===selected?'selected':''}" data-song="${esc(s.id)}"><span class="song-file-type">${s.study?'练习':s.format==='midi'?'MIDI':'XML'}</span><span><strong>${esc(s.title)}</strong><small>${s.measures.length} 小节 · ${s.notes.length} 个音</small></span></button>`).join('');
    host.querySelectorAll('[data-song]').forEach(b=>b.onclick=()=>{choose(b.dataset.song);closePanel();});
  }
  function render(){
    if(!page)return;
    document.body.classList.toggle('tablet-song',reading);
    document.querySelector('.app-header > .tablet-song-top')?.remove();
    restoreTask();const expanded=$('songSetup')?.open||false,s=settings();
    $('songsPage').innerHTML=`<div class="tablet-song-top"><button id="songBack" aria-label="返回今日练习">‹</button><button id="songLibraryOpen" aria-label="打开曲库"><span class="song-title-text">${esc(song?.title||'我的曲谱')}</span><span class="song-library-cue">曲库⌄</span></button><span>${esc(MODES[s.mode]?.[0]||'')}</span><button id="songReaderToggle">${reading?'曲目与设置':'进入全幅大谱'}</button></div><div class="song-page-head"><div><span class="eyebrow">MY MUSIC · 离线曲谱室</span><h2>把喜欢的音乐，慢慢弹会。</h2><p>先听一段，再认准，最后跟着拍子连起来。</p></div><div class="actions"><button id="songImport" class="primary">＋ 导入曲谱</button><button id="songBackup">备份曲谱库</button></div></div>
      <div class="song-layout"><aside class="song-library"><div class="song-library-title"><strong>我的曲谱</strong><small>${library.length} 首 · 保存在本机</small></div><div id="songLibrary"></div><p class="song-library-help">支持 .mid / .midi、.musicxml / .xml / .mxl。MIDI 成谱需整理节奏；MusicXML 更接近原谱。</p><input id="songFile" type="file" accept=".mid,.midi,.musicxml,.xml,.mxl,.json" hidden></aside>
      <section class="song-workspace"><div class="song-title-row"><div><h3>${esc(song?.title||'正在打开曲谱库…')}</h3><p id="songMeta">${song?song.measures.length+' 小节 · '+song.tracks.length+' 个声部 · '+(song.format==='midi'?'MIDI 整理谱面':'MusicXML 原谱'):'首次使用已准备四小节练习曲。'}</p></div><button id="songDelete" ${!song||isBuiltin(selected)?'hidden':''}>移除</button></div>
      <div id="songLearning"></div><div class="song-mode-tabs" role="tablist" aria-label="曲谱模式">${Object.entries(MODES).map(([key,v])=>`<button role="tab" aria-selected="${s.mode===key}" data-song-mode="${key}" class="${s.mode===key?'selected':''}"><strong>${v[0]}</strong><small>${v[1]}</small></button>`).join('')}</div>
      <details id="songSetup" class="song-setup"><summary>自由练习设置 · 声部、范围与速度</summary><div class="song-controls" id="songControls">
        <label>声部<select id="songTrack"><option value="all">全部声部</option>${(song?.tracks||[]).map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>
        <label>练习部分<select id="songHand"><option value="both">双手</option><option value="right">右手</option><option value="left">左手</option></select></label>
        <label>起始小节<input id="songFrom" type="number" min="1" max="${song?.measures.length||1}" value="${s.from||1}"></label><label>结束小节<input id="songTo" type="number" min="1" max="${song?.measures.length||1}" value="${s.to||2}"></label>
        <label>速度 BPM<input id="songTempo" type="number" min="20" max="240" value="${Math.round(s.tempo||60)}"></label>
        <label>考核内容<select id="songExam"><option value="timed">音高与节奏</option><option value="notes">仅认音</option></select></label>
        <label>谱面大小<select id="songZoom"><option value="0.8">小</option><option value="1">标准</option><option value="1.25">大</option><option value="1.5">更大</option></select></label>
      </div>
      <details class="song-options"><summary>节拍器、输入校准与成谱设置</summary><div class="song-options-grid"><label class="song-check"><input id="songMetronome" type="checkbox">节拍器</label><label class="song-check"><input id="songLoop" type="checkbox">循环选段（练习 / 欣赏）</label><label class="song-check"><input id="songAccompany" type="checkbox">播放另一只手伴奏（跟拍）</label><label>起拍容差<select id="songTolerance"><option value="normal">宽松 · 约一拍 22%</option><option value="strict">严格 · 约一拍 12%</option></select></label><label>输入偏移 ms<input id="songOffset" type="number" min="-400" max="400" step="10" value="${s.offset||0}"></label><label>MIDI 节奏整理<select id="songGrid"><option value="0.25">十六分音符网格</option><option value="0.5">八分音符网格</option><option value="${1/3}">三连音网格</option></select></label><label>MIDI 左右手分界<select id="songSplit">${[48,55,60,65,72].map(n=>`<option value="${n}">${C.pitchName(n)}</option>`).join('')}</select></label></div><p>正偏移会从按键时间扣除，可沿用节奏课校准值。成谱整理不会修改原 MIDI；欣赏按原始音符时间播放。仅评音高与起拍，不评踏板、指法与艺术处理。考核固定当前声部、片段、速度与输入条件。</p></details></details>
      <div id="songWarning" class="song-warning" ${song?.warnings.length?'':'hidden'}>${(song?.warnings||[]).map(esc).join('<br>')}</div>
      <div class="song-transport"><button id="songStart" class="primary">${s.mode==='listen'?'播放选段':'开始'+(MODES[s.mode]?.[0]||'练习')}</button><button id="songPause" disabled>暂停</button><button id="songStop" disabled>结束</button><button id="songHint" ${s.mode!=='beginner'?'hidden':''}>给我提示</button><button id="songWhole">整曲</button><span id="songPosition">选好一两小节，从慢速开始。</span></div>
      <div class="song-score-scroll" id="songScoreScroll"><div id="songScore"><p class="song-loading">正在排版五线谱…</p></div></div>
      <div id="songHintCard" hidden></div><button id="songRhythmPad" class="song-rhythm-pad" hidden>跟着原小节的起点点击 · 休止处等待</button><div class="song-status"><span id="songFeedback" role="status">${input()==='midi'?'实体琴已连接，按琴键作答。':'可先用屏幕琴键试练；实体琴请在顶部连接 USB MIDI。'}</span><button id="songKeysToggle">${input()==='midi'?'显示屏幕琴键':'收起屏幕琴键'}</button></div><div id="songKeys" class="song-touch-keys" ${input()==='midi'?'hidden':''}></div><div id="songReport"></div><div id="songHistory"></div></section></div>`;
    arrangeWorkspace();$('songSetup').open=true;renderLibrary();$('songBack').onclick=()=>window.PianoBack?.();$('songReaderToggle').onclick=()=>openPanel('library');$('songLibraryOpen').onclick=()=>openPanel('library');if(!song)return;
    for(const [id,key]of [['songTrack','track'],['songHand','hand'],['songExam','examKind'],['songZoom','zoom'],['songTolerance','tolerance'],['songGrid','grid'],['songSplit','split']])$(id).value=String(s[key]);
    for(const [id,key]of [['songMetronome','metronome'],['songLoop','loop'],['songAccompany','accompany']])$(id).checked=s[key];
    $('songExam').disabled=s.mode!=='exam';$('songGrid').disabled=song.format!=='midi';$('songSplit').disabled=song.format!=='midi';
    $('songLoop').disabled=s.mode==='exam';$('songAccompany').disabled=s.mode!=='advanced';
    $('songImport').onclick=importPicker;$('songBackup').onclick=backup;
    $('songFile').onchange=e=>{const f=e.target.files?.[0];if(f)importFile(f);e.target.value='';};
    $('songDelete').onclick=()=>H.confirm('移除这首曲谱？','只移除本机曲谱库中的副本，原始文件保留。',async()=>{try{await store('delete',selected);library=library.filter(x=>x.id!==selected);choose(library[0].id);}catch(e){tell(e.message,true);}});
    document.querySelectorAll('[data-song-mode]').forEach(b=>b.onclick=()=>change({mode:b.dataset.songMode}));
    const fields=[['songTrack','track'],['songHand','hand'],['songExam','examKind'],['songZoom','zoom'],['songTolerance','tolerance'],['songGrid','grid'],['songSplit','split'],['songTempo','tempo'],['songFrom','from'],['songTo','to'],['songOffset','offset']];
    for(const [id,key]of fields)$(id).onchange=()=>change({[key]:$(id).value});
    for(const [id,key]of [['songMetronome','metronome'],['songLoop','loop'],['songAccompany','accompany']])$(id).onchange=()=>change({[key]:$(id).checked});
    $('songWhole').onclick=()=>change({from:1,to:song.measures.length});
    $('songStart').onclick=start;$('songPause').onclick=()=>run?.paused?resume():pause();$('songStop').onclick=()=>finish(false);$('songHint').onclick=hint;
    $('songKeysToggle').onclick=()=>{$('songKeys').hidden=!$('songKeys').hidden;$('songKeysToggle').textContent=$('songKeys').hidden?'显示屏幕琴键':'收起屏幕琴键';document.body.classList.toggle('tablet-song-keys',!$('songKeys').hidden);window.dispatchEvent(new Event('pianolayoutchange'));};
    document.body.classList.toggle('tablet-song-keys',!$('songKeys').hidden);guideExercise=C.prepared(song,s);renderKeys();renderHistory();renderLearning();mountGuidance();renderScore();
  }
  function closePanel(){const wasOpen=panelOpen;panelOpen=false;document.body.classList.remove('song-panel-open');const panel=$('songPanel');if(panel)panel.hidden=true;$('songPanelShade')?.setAttribute('hidden','');$('songReaderToggle')?.setAttribute('aria-expanded','false');$('songLibraryOpen')?.setAttribute('aria-expanded','false');if(wasOpen)(panelFocus?.isConnected?panelFocus:$('songLibraryOpen'))?.focus({preventScroll:true});}
  function setPanelView(view){
    panelView=['library','route','settings'].includes(view)?view:'library';const panel=$('songPanel');if(!panel)return;
    for(const key of ['library','route','settings']){panel.querySelector('.song-panel-'+key).hidden=key!==panelView;const tab=panel.querySelector('[data-song-panel-view="'+key+'"]');tab.setAttribute('aria-selected',String(key===panelView));tab.tabIndex=key===panelView?0:-1;}
    $('songPanelTitle').textContent={library:'我的曲谱',route:'分段学习与记录',settings:'高级练习设置'}[panelView];
  }
  function openPanel(view='library'){window.PianoSongGuide?.close();if(active()&&!run.paused)pause();if(!panelOpen)panelFocus=document.activeElement;panelOpen=true;document.body.classList.add('song-panel-open');setPanelView(view);$('songPanel').hidden=false;$('songPanelShade').hidden=false;$('songReaderToggle').setAttribute('aria-expanded','true');$('songLibraryOpen').setAttribute('aria-expanded','true');$('songPanelClose').focus();}
  function toggleReading(){if(panelOpen)closePanel();else openPanel('library');}
  function arrangeWorkspace(){
    const root=$('songsPage'),workspace=root.querySelector('.song-workspace'),panel=document.createElement('section');panel.id='songPanel';panel.className='song-panel';panel.hidden=!panelOpen;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','songPanelTitle');
    document.body.classList.toggle('song-panel-open',panelOpen);
    panel.innerHTML='<div class="song-panel-head"><h2 id="songPanelTitle">我的曲谱</h2><button id="songPanelClose" aria-label="关闭曲库与设置">×</button></div><div class="song-panel-tabs" role="tablist" aria-label="曲谱管理"><button role="tab" data-song-panel-view="library">曲库</button><button role="tab" data-song-panel-view="route">学习路线</button><button role="tab" data-song-panel-view="settings">高级设置</button></div><div class="song-panel-body"><section class="song-panel-library" role="tabpanel"></section><section class="song-panel-route" role="tabpanel"></section><section class="song-panel-settings" role="tabpanel"></section></div>';
    const left=panel.querySelector('.song-panel-library'),right=panel.querySelector('.song-panel-settings'),route=panel.querySelector('.song-panel-route');left.append(root.querySelector('.song-page-head'),root.querySelector('.song-library'));right.append(workspace.querySelector('.song-title-row'),$('songSetup'));route.append($('songLearning'),$('songHistory'));
    const footer=document.createElement('div');footer.className='song-panel-footer';footer.innerHTML='<span id="songPanelNote">选择曲目后回到谱面，练法在右上角调整。</span><button id="songPanelEnd" hidden>结束本轮</button><button class="primary" id="songPanelDone">返回谱面</button>';panel.appendChild(footer);root.appendChild(panel);
    $('songPanelDone').onclick=closePanel;$('songPanelEnd').onclick=()=>{$('songStop').click();setPanelView('library');};
    panel.querySelectorAll('[data-song-panel-view]').forEach(tab=>{const view=tab.dataset.songPanelView;tab.id='songTab-'+view;tab.setAttribute('aria-controls','songPane-'+view);const pane=panel.querySelector('.song-panel-'+view);pane.id='songPane-'+view;pane.setAttribute('aria-labelledby',tab.id);tab.onclick=()=>setPanelView(view);tab.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=[...panel.querySelectorAll('[data-song-panel-view]')],index=tabs.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowLeft'?-1:1)+3)%3;tabs[next].click();tabs[next].focus();}};});setPanelView(panelView);
    const shade=document.createElement('div');shade.id='songPanelShade';shade.className='song-panel-shade';shade.hidden=!panelOpen;root.appendChild(shade);shade.onclick=closePanel;$('songPanelClose').onclick=closePanel;for(const id of ['songReaderToggle','songLibraryOpen']){$(id).setAttribute('aria-expanded',String(panelOpen));$(id).setAttribute('aria-controls','songPanel');}
  }
  function renderKeys(){
    const s=settings(),ex=C.prepared(song,s),range=ex.all.map(n=>n.pitch);
    let lo=clamp(Math.floor(Math.min(...range)/12)*12,21,84),hi=clamp(Math.ceil(Math.max(...range)/12)*12,lo+12,108);
    const host=$('songKeys');let white=0;const count=Array.from({length:hi-lo+1},(_,i)=>lo+i).filter(n=>![1,3,6,8,10].includes(n%12)).length;host.style.setProperty('--song-keys-width',Math.max(360,count*44)+'px');
    host.innerHTML=Array.from({length:hi-lo+1},(_,i)=>lo+i).map(n=>{const black=[1,3,6,8,10].includes(n%12),x=white;if(!black)white++;return `<button data-song-key="${n}" class="${black?'black':'white'}" style="left:${(black?x-.31:x)/count*100}%;width:${(black?.62:1)/count*100}%" aria-label="${C.pitchName(n)}"><span class="guide-key-name">${n%12===0?C.pitchName(n):''}</span><span class="guide-current"></span><span class="guide-next"></span></button>`;}).join('');
    host.querySelectorAll('button').forEach(b=>{
      const n=Number(b.dataset.songKey);b.onpointerdown=e=>{if(input()==='midi')return;e.preventDefault();b.setPointerCapture?.(e.pointerId);b.classList.add('down');if(!heldVoices.has(n))heldVoices.set(n,voice(n,audioTime(),30,.16));receive({type:'on',note:n,at:performance.now()},'touch');};
      const up=()=>{b.classList.remove('down');const v=heldVoices.get(n);if(v){release(v);heldVoices.delete(n);}receive({type:'off',note:n,at:performance.now()},'touch');};b.onpointerup=up;b.onpointercancel=up;
      b.onclick=e=>{if(e.detail===0&&input()!=='midi'){receive({type:'on',note:n,at:performance.now()},'touch');receive({type:'off',note:n,at:performance.now()},'touch');voice(n,audioTime(),.2,.16);}};
    });
  }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function filteredXML(){
    const s=settings(),doc=new DOMParser().parseFromString(song.format==='midi'?C.toXML(song,s):song.xml,'application/xml');
    // Fingerings remain in the song model for keyboard guidance; keep the reading surface quiet.
    doc.querySelectorAll('fingering').forEach(n=>n.remove());
    if(s.track!=='all'){doc.querySelectorAll('score-part,part').forEach(p=>{if(p.getAttribute('id')!==s.track)p.remove();});}
    return new XMLSerializer().serializeToString(doc);
  }
  async function renderScore(){
    const gen=++renderGeneration,position=lastCursor;
    try{
      const xml=filteredXML();if(!window.opensheetmusicdisplay?.OpenSheetMusicDisplay)throw Error('本地排谱引擎未能加载。');
      osmd?.cursor?.hide();osmd=null;window.PianoScoreLayout.reset();$('songScore').innerHTML='';
      const engraver=new opensheetmusicdisplay.OpenSheetMusicDisplay('songScore',{autoResize:false,backend:'svg',drawTitle:false,stretchLastSystemLine:true,drawComposer:false,drawPartNames:false,drawMeasureNumbers:true,drawingParameters:'compacttight',followCursor:false,renderSingleHorizontalStaffline:false,disableCursor:false,cursorsOptions:[{type:0,color:'#4168cc',alpha:.2,follow:false}]});
      await engraver.load(xml);if(gen!==renderGeneration||!page)return;
      const contentWidth=$('songScoreScroll').clientWidth;if(reading)engraver.EngravingRules.RenderXMeasuresPerLineAkaSystem=contentWidth<900?1:2;
      engraver.EngravingRules.StaffDistance=2.6;engraver.EngravingRules.MinimumStaffLineDistance=2.8;engraver.EngravingRules.BetweenStaffDistance=2;
      engraver.Zoom=settings().zoom*(contentWidth<900?1.25:contentWidth<1360?1.55:1.75)*(window.PianoSongGuide.isFocused()?1.5:1);engraver.render();osmd=engraver;lastCursor=-1;indexScore();window.PianoScoreLayout.mount(engraver,song,$('songScore'),$('songScoreScroll'),settings().zoom,settings().from);moveCursor(position>=0?position:song.measures[settings().from-1].start,true);window.PianoSongGuide.refresh();if(displayReport)markScore(displayReport);completeTheoryRestore();
    $('songStart').disabled=active();if(!active())$('songPosition').textContent='第 '+(song.measures.find(m=>(position>=0?position:song.measures[settings().from-1].start)<m.end)?.index||settings().from)+' 小节';window.PianoSongGuide.refresh();
    }catch(e){if(gen!==renderGeneration)return;$('songScore').innerHTML='<p class="song-render-error">排谱失败：'+esc(e.message||e)+'。MIDI 可更换整理网格或选择单一声部后重试。</p>';$('songStart').disabled=true;osmd=null;}
  }
  function moveCursor(beat,force=false){
    if(!osmd?.cursor)return;const cur=osmd.cursor;
    try{
      const current=()=>cur.Iterator.CurrentSourceTimestamp.RealValue*4;
      if(force||beat<lastCursor-EPS){cur.reset();}
      let guard=0;while(!cur.Iterator.EndReached&&current()<beat-1e-5&&guard++<30000){
        const next=cur.Iterator.clone();next.moveToNextVisibleVoiceEntry(false);
        if(next.EndReached||next.CurrentSourceTimestamp.RealValue*4>beat+1e-5)break;
        cur.next();
      }
      cur.hide();lastCursor=beat;const graphic=cur.GNotesUnderCursor()?.[0],x=graphic?.PositionAndShape?.AbsolutePosition?.x;window.PianoScoreLayout.position(beat,Number.isFinite(x)?x*10:null);
      window.PianoSongGuide?.update(beat);
    }catch(e){/* The notation stays usable when a source has no cursor entry at this beat. */}
  }
  const EPS=1e-6;
  function choose(id){saveView();if(active())finish(false);if(id!==selected)practiceOrigin=null;selected=id;song=library.find(s=>s.id===id)||library[0];if(!song)return;selected=song.id;lastCursor=viewBeat();try{localStorage.setItem(selectionKey,selected);}catch(e){}prefs[selected]=settings();displayReport=null;saveSettings();render();}
  let changing=false;
  function change(values){
    if(changing)return;if(active()&&run.settings.mode==='exam'){pause();tell('考核条件已固定；结束考核后可以调整。');return;}
    const next=C.settings(song,{...settings(),drill:'',...values});if(JSON.stringify(next)===JSON.stringify(settings()))return;
    changing=true;try{const focusId=document.activeElement?.id,scroll=$('songPanel')?.querySelector('.song-panel-settings')?.scrollTop||0;
      if(active()){if(!practiceOrigin)practiceOrigin={settings:{...run.settings},task:taskFor()?JSON.parse(JSON.stringify(taskFor())):null,source:input()};pause();finish(false,false);}
      freeTask();prefs[selected]=next;displayReport=null;lastCursor=-1;saveSettings();render();
      if(practiceOrigin)tell('新尝试已准备好；按播放开始，完成后可回到原段。');
      if(panelOpen){const panel=$('songPanel')?.querySelector('.song-panel-settings');if(panel)panel.scrollTop=scroll;$(focusId)?.focus({preventScroll:true});}}finally{changing=false;}
  }
  function restorePracticeOrigin(){
    if(!practiceOrigin)return;if(active()&&run.settings.mode==='exam'){pause();tell('请先结束考核，再回到原段。');return;}
    if(active()){pause();finish(false,false);}const origin=practiceOrigin;practiceOrigin=null;
    if(origin.source===input())returnOrigin({origin:origin.settings,originTask:origin.task});
    else{freeTask();prefs[selected]=C.settings(song,origin.settings);saveSettings();render();tell('已恢复原片段与速度；输入方式已改变，请开始新的尝试。');}
  }
  function mountGuidance(){
    window.PianoSongGuide.mount({
      get:()=>({song,settings:active()?run.settings:settings(),exercise:active()?run.exercise:guideExercise,active:active(),run,origin:practiceOrigin,beat:lastCursor>=0?lastCursor:guideExercise.from,input:input(),pressed:[...pressed],wrong:[...guideWrong]}),
      restoreOrigin:restorePracticeOrigin,pause,
      restart:()=>{if(active())finish(false,false);start();},change,notice:tell,notation:()=>renderScore(),settingsPanel:openPanel,layout:()=>window.dispatchEvent(new Event('pianolayoutchange')),
      assist:ids=>{if(!active()||run.paused||run.settings.mode==='exam'||run.settings.mode==='listen'||!ids.length)return;run.assisted=true;for(const id of ids){if((run.hintLevels.get(id)||0)>=3)continue;run.hintLevels.set(id,3);if(guided()){const index=run.exercise.groups.findIndex(g=>g.notes.some(n=>n.id===id));if(index>=0)run.hinted.add(index);}}},
      paint:paintGuidance,
      locate:bar=>{if(active()){if(run.settings.mode!=='listen'){tell('结束本轮后再定位；练习范围在本轮内保持固定。');return;}bar=clamp(bar,run.settings.from,run.settings.to);const beat=song.measures[bar-1].start;cancelAnimationFrame(raf);silence();run.elapsed=run.countin+(C.secondsAt(song,beat,run.settings.tempo)-run.baseSeconds)*1000;run.started=performance.now();run.audioScheduled.clear();run.clickScheduled.clear();moveCursor(beat,true);if(!run.paused)tick();return;}const beat=song.measures[bar-1]?.start;if(beat!==undefined){moveCursor(beat,true);$('songPosition').textContent='第 '+bar+' 小节 · 点击开始练习当前选段';}},
      loop:value=>{if(active()){if(run.settings.mode==='exam')return;run.settings.loop=value;prefs[selected]={...settings(),loop:value};saveSettings();window.PianoSongGuide.refresh();}else change({loop:value});},
      tempo:value=>{
        const tempo=clamp(Math.round(value),20,240);
        if(!active()){change({tempo});return;}
        if(run.settings.mode!=='listen'||run.replay){change({tempo});return;}
        const r=run,beat=C.beatAt(song,r.baseSeconds+Math.max(0,time()-r.countin)/1000,r.settings.tempo),paused=r.paused;cancelAnimationFrame(raf);silence();r.settings.tempo=tempo;r.baseSeconds=C.secondsAt(song,r.exercise.from,tempo);r.elapsed=(C.secondsAt(song,beat,tempo)-r.baseSeconds)*1000;r.started=performance.now();r.duration=(C.secondsAt(song,r.exercise.to,tempo)-r.baseSeconds)*1000;r.audioScheduled.clear();r.clickScheduled.clear();
        for(const n of r.playNotes){const original=song.notes.find(x=>x.id===n.id);if(!original)continue;n.ms=(C.secondsAt(song,Math.max(original.start,r.exercise.from),tempo)-r.baseSeconds)*1000;n.dur=C.secondsAt(song,Math.min(original.start+original.duration,r.exercise.to),tempo)-C.secondsAt(song,Math.max(original.start,r.exercise.from),tempo);}
        prefs[selected]={...settings(),tempo};saveSettings();window.PianoSongGuide.update(beat);if(!paused)tick();
      }
    });
  }
  function paintGuidance(){
    // Hand identity belongs to the controls and keyboard, never to printed noteheads.
    for(const list of noteIndex.values())for(const m of list){if(m.head.style.fill!=='rgb(24, 33, 43)'){m.head.style.fill='#18212b';m.head.querySelectorAll('path').forEach(p=>p.style.fill='#18212b');}m.head.removeAttribute('data-guide-hand');m.head.removeAttribute('data-song-hand');}
  }
  function audioTime(){try{audio=window.PianoAudio.context();prepareAudio();return audio.currentTime;}catch(e){return 0;}}
  async function prepareAudio(pitches=[]){
    try{audio=window.PianoAudio.context();await window.PianoAudio.prepare(pitches);return audio.state==='running';}catch(e){return false;}
  }
  function voice(pitch,at,duration,volume=.13,click=false){
    if(!audio)return null;
    if(!click){const v=window.PianoAudio.note(pitch,{at,duration:Math.max(.04,Math.min(duration,60)),volume:Math.min(1,volume*3.6),onended:()=>{scheduled=scheduled.filter(x=>x!==v);}});scheduled.push(v);return v;}
    if(audio.state!=='running')return null;
    const o=audio.createOscillator(),g=audio.createGain();
    o.type=click?'sine':'triangle';o.frequency.value=click?(pitch?1350:900):440*2**((pitch-69)/12);o.connect(g);g.connect(audio.destination);
    const end=at+Math.max(.04,Math.min(duration,60));g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(volume,at+.008);g.gain.exponentialRampToValueAtTime(.0001,end+.05);o.start(at);o.stop(end+.06);
    const v={o,g,end};scheduled.push(v);o.onended=()=>{o.disconnect();g.disconnect();scheduled=scheduled.filter(x=>x!==v);};return v;
  }
  function release(v){if(!v||!audio)return;if(v.release){v.release(audio.currentTime,.22);return;}try{v.g.gain.cancelScheduledValues(audio.currentTime);v.g.gain.setTargetAtTime(.0001,audio.currentTime,.012);v.o.stop(audio.currentTime+.06);}catch(e){}}
  function silence(){for(const v of [...scheduled]){if(v.stop)v.stop();else try{v.o.stop();v.o.disconnect();v.g.disconnect();}catch(e){}}scheduled=[];heldVoices.clear();}
  function setLocked(lock){
    document.body.classList.toggle('song-running',lock);document.body.classList.toggle('tablet-song-playing',lock&&!run?.paused);
    $('songControls')?.querySelectorAll('input,select').forEach(e=>e.disabled=lock);
    document.querySelectorAll('[data-song-mode],.song-options input,.song-options select,#songWhole,#songImport,#songDelete,#songBackup,#songLibrary button,#songLearning button,#songSetup summary').forEach(e=>e.disabled=lock);
    if($('songRhythmPad'))$('songRhythmPad').hidden=!lock||!run?.settings.drill;
    if(!lock){$('songExam').disabled=settings().mode!=='exam';$('songGrid').disabled=song.format!=='midi';$('songSplit').disabled=song.format!=='midi';$('songLoop').disabled=settings().mode==='exam';$('songAccompany').disabled=settings().mode!=='advanced';}
    $('songStart').disabled=lock||!osmd;$('songPause').disabled=!lock;$('songStop').disabled=!lock;
    if($('songPanelEnd'))$('songPanelEnd').hidden=!lock;
    if($('songPanelNote'))$('songPanelNote').textContent=lock?'本轮条件已固定；结束本轮后可以换曲。':'选择曲目后回到谱面，练法在右上角调整。';window.PianoSongGuide?.refresh();
  }
  async function start(){
    if(active()||busy||starting||!osmd)return;
    if(taskFor()?.kind==='route'&&!taskFor().route){beginRoute();tell('下一步已准备好，请确认片段后开始。');return;}
    if(window.PianoEar?.isActive()||H.classicActive()||window.PianoStudy?.ownsActive()||window.PianoRhythm?.isActive()||window.PianoFoundation?.isActive()){tell('有其他训练正在进行，请先返回并结束，再开始曲谱练习。',true);return;}
    let ex=C.prepared(song,settings());if(ex.settings.drill==='rhythm')ex=rhythmExercise(ex);if(!ex.groups.length){tell('这个片段与声部没有可练习的音，请调整范围。',true);return;}
    starting=true;$('songStart').disabled=true;tell('正在准备钢琴音色…');const gen=renderGeneration,ok=await prepareAudio(song.notes.filter(n=>n.start<ex.from+8&&n.start+n.duration>ex.from).map(n=>n.pitch));starting=false;if(!page||gen!==renderGeneration||document.hidden){if($('songStart'))$('songStart').disabled=active()||!osmd;return;}if(ex.settings.mode==='listen'&&!ok){$('songStart').disabled=false;tell('声音未能启动，请再点播放，或检查系统音量。',true);return;}
    silence();pressed.clear();guideWrong.clear();displayReport=null;markScore(null);$('songReport').innerHTML='';$('songHintCard').hidden=true;document.body.classList.remove('song-hint-open');
    const s=ex.settings;run={settings:{...s},exercise:ex,source:input(),index:0,correct:new Set(),first:new Map(),attempts:[],presses:[],hinted:new Set(),groupResults:[],started:performance.now(),paused:false,interrupted:false,finished:false,assisted:false,elapsed:0,audioScheduled:new Set(),clickScheduled:new Set(),generation:Date.now(),wrong:0,guidedAnswers:[],firstAnswers:new Map(),hintLevels:new Map(),events:[],heldAt:new Map(),task:taskFor()?JSON.parse(JSON.stringify(taskFor())):null};
    run.baseSeconds=C.secondsAt(song,ex.from,s.tempo);run.duration=(C.secondsAt(song,ex.to,s.tempo)-run.baseSeconds)*1000;
    run.countin=s.mode==='listen'||guided()?0:song.measures[s.from-1].beats*60000/s.tempo*4/song.measures[s.from-1].unit;
    run.playNotes=s.mode==='listen'?song.notes.filter(n=>(s.track==='all'||n.track===s.track)&&(s.hand==='both'||C.handOf(song,n,s)===(s.hand==='right'?1:2))&&n.start<ex.to&&n.start+n.duration>ex.from).map(n=>({...n,ms:(C.secondsAt(song,Math.max(n.start,ex.from),s.tempo)-run.baseSeconds)*1000,dur:C.secondsAt(song,Math.min(n.start+n.duration,ex.to),s.tempo)-C.secondsAt(song,Math.max(n.start,ex.from),s.tempo)})):
      s.mode==='advanced'&&s.accompany&&s.hand!=='both'?ex.all.filter(n=>n.staff===(s.hand==='right'?2:1)).map(n=>({...n,ms:(C.secondsAt(song,n.start,s.tempo)-run.baseSeconds)*1000,dur:C.secondsAt(song,n.start+n.duration,s.tempo)-C.secondsAt(song,n.start,s.tempo)})):[];
    setLocked(true);moveCursor(ex.from,true);window.PianoInput?.sync();
    renderLearning();if(guided())showGroup();else {tell(s.mode==='listen'?'欣赏播放 · 离线钢琴采样':ok?'先听预备拍，再开始弹。':'声音未启用；先暂停检查声音，再跟拍。');tick();}
  }
  function time(){return run.elapsed+(run.paused?0:performance.now()-run.started);}
  function tick(){
    if(!active()||run.paused||!page)return;const r=run,ms=time()-r.countin,s=r.settings;
    if(ms<0){$('songPosition').textContent='预备 · '+(Math.floor((ms+r.countin)/(60000/s.tempo*4/song.measures[s.from-1].unit))+1)+' / '+song.measures[s.from-1].beats;}
    else {const beat=Math.min(r.exercise.to-EPS*2,Math.max(r.exercise.from,C.beatAt(song,r.baseSeconds+ms/1000,s.tempo))),m=song.measures.find(m=>beat<m.end-EPS);$('songPosition').textContent='第 '+(m?.index||s.to)+' 小节 · '+Math.min(100,Math.floor(ms/r.duration*100))+'%';if(beat-lastCursor>.08)moveCursor(beat);}
    const now=audio?.currentTime||0,horizon=ms+140;
    for(let i=0;i<r.playNotes.length;i++){const n=r.playNotes[i];if(r.audioScheduled.has(i)||n.ms>horizon)continue;r.audioScheduled.add(i);if(n.ms+n.dur*1000<ms)continue;voice(n.pitch,now+Math.max(0,n.ms-ms)/1000,Math.max(.04,n.dur-Math.max(0,ms-n.ms)/1000),.13*(n.velocity||80)/100);}
    if(s.metronome&&s.mode!=='listen'){
      const meter=song.measures[s.from-1],countStep=60000/s.tempo*4/meter.unit;
      for(let c=0;c<meter.beats;c++){const target=-r.countin+c*countStep,key='c'+c;if(target<=horizon&&!r.clickScheduled.has(key)){r.clickScheduled.add(key);if(target>=ms-80)voice(c===0?1:0,now+Math.max(0,target-ms)/1000,.04,.08,true);}}
      for(const m of song.measures.slice(s.from-1,s.to))for(let b=0;b<m.beats;b++){
        const target=(C.secondsAt(song,m.start+b*4/m.unit,s.tempo)-r.baseSeconds)*1000,key=m.index+':'+b;
        if(target<=horizon&&!r.clickScheduled.has(key)){r.clickScheduled.add(key);if(target>=ms-80)voice(b===0?1:0,now+Math.max(0,target-ms)/1000,.04,.075,true);}
      }
    }
    if(s.mode==='advanced'&&ms>=0){const m=r.presses.at(-1);if(m&&performance.now()-m.at<500)tell('已记录 '+C.pitchName(m.pitch)+'，保持拍子继续。');}
    if(ms>=r.duration+250){if(s.loop&&s.mode!=='exam'){finish(true,false);start();return;}finish(true);return;}
    raf=requestAnimationFrame(tick);
  }
  function showGroup(){
    const g=run.exercise.groups[run.index];if(!g){finish(true);return;}
    moveCursor(g.sourceBeat,run.index===0);$('songPosition').textContent='第 '+g.measure+' 小节 · 第 '+(run.index+1)+' / '+run.exercise.groups.length+' 组';
    tell(run.settings.mode==='exam'?'按谱独立作答；弹对后继续，结束后查看成绩。':g.notes.length>1?'同组找音：先弹齐并松键；同时起音请到跟拍练习检查。':'看清谱号与位置，弹对后松键继续。');
  }
  function receive(e,source='midi'){
    if(!active()||run.paused||!page||source!==run.source||H.modalOpen()||window.PianoInput?.panelOpen?.())return;
    if(e.type==='reset'){pressed.clear();pause();return;}
    if(e.type==='off'){if(pressed.has(e.note))run.events.push({type:'off',pitch:e.note,ms:time()-run.countin});pressed.delete(e.note);guideWrong.delete(e.note);if(guided())advanceGroup();window.PianoSongGuide?.refresh();return;}
    if(e.type!=='on'||pressed.has(e.note)||run.settings.mode==='listen')return;pressed.add(e.note);run.events.push({type:'on',pitch:e.note,ms:time()-run.countin});
    if(guided()){
      const g=run.exercise.groups[run.index];if(!g)return;const wanted=g.notes.some(n=>n.pitch===e.note);
      run.attempts.push({group:run.index,pitch:e.note,correct:wanted,at:e.at});
      run.presses.push({pitch:e.note,ms:time(),at:e.at});
      if(!wanted){guideWrong.add(e.note);run.wrong++;run.first.set(run.index,false);const missing=g.notes.filter(n=>!run.correct.has(n.pitch)).sort((a,b)=>Math.abs(a.pitch-e.note)-Math.abs(b.pitch-e.note));if(missing[0]&&!run.firstAnswers.has(missing[0].id))run.firstAnswers.set(missing[0].id,{actual:e.note,correct:false});if(run.settings.mode!=='exam')tell('收到 '+C.pitchName(e.note)+'，检查谱号、升降记号与八度。',true);window.PianoSongGuide?.refresh();return;}
      if(!run.first.has(run.index))run.first.set(run.index,true);const target=g.notes.find(n=>n.pitch===e.note);if(!run.firstAnswers.has(target.id))run.firstAnswers.set(target.id,{actual:e.note,correct:true});run.correct.add(e.note);if($('songHintCard')){$('songHintCard').hidden=true;document.body.classList.remove('song-hint-open');}
      if(run.settings.mode!=='exam')tell(run.correct.size===g.notes.length?'这一组已弹齐，松开琴键后继续。':'这个音对了，再找同一组剩下的音。');
    }else{
      const ms=time()-run.countin-(performance.now()-e.at);if(ms< -Math.min(150,60000/run.settings.tempo*.2)||ms>run.duration)return;
      run.presses.push({pitch:run.settings.drill?60:e.note,ms,at:e.at});if(run.presses.length>40000){pause();tell('按键事件过多，已暂停，请检查设备是否重复发送。',true);}
    }
    window.PianoSongGuide?.refresh();
  }
  function advanceGroup(){
    if(!active()||!guided()||run.paused||pressed.size)return;const g=run.exercise.groups[run.index];if(!g||!g.notes.every(n=>run.correct.has(n.pitch)))return;
    for(const n of g.notes){const first=run.firstAnswers.get(n.id);run.guidedAnswers.push({id:n.id,pitch:n.pitch,actual:first?.actual??null,correct:!!first?.correct&&!run.hintLevels.has(n.id),hint:run.hintLevels.has(n.id),hintLevel:run.hintLevels.get(n.id)||0,measure:g.measure,beat:g.beat,sourceBeat:g.sourceBeat,staff:n.staff,timing:true});}
    run.groupResults.push({measure:g.measure,beat:g.beat,total:g.notes.length,first:run.first.get(run.index)===true,hint:run.hinted.has(run.index)});run.index++;run.correct.clear();
    if(run.index>=run.exercise.groups.length){if(run.settings.loop&&run.settings.mode==='beginner'){finish(true,false);start();}else finish(true);}else showGroup();
  }
  function hint(){
    if(!active()||!guided()||run.settings.mode!=='beginner'||run.paused)return;
    const g=run.exercise.groups[run.index],n=g.notes.find(n=>!run.correct.has(n.pitch));if(!n)return;
    const level=Math.min(3,(run.hintLevels.get(n.id)||0)+1);run.hintLevels.set(n.id,level);run.hinted.add(run.index);
    const previous=run.exercise.groups.slice(0,run.index).reverse().flatMap(g=>g.notes).find(x=>x.staff===n.staff&&run.guidedAnswers.some(a=>a.id===x.id&&a.correct));
    const m=L.hint(n,level,previous);$('songHintCard').hidden=false;$('songHintCard').innerHTML=hintMarkup(m);document.body.classList.add('song-hint-open');$('songHintCard').scrollIntoView({block:'nearest',behavior:'smooth'});tell('提示 '+level+'/3 · 当前目标记为辅助完成，其他音分别记录。');
    $('songHintReference').onclick=()=>{if(!run?.paused)voice(m.reference,audioTime(),.6,.15);};
    if($('songHintAnswer'))$('songHintAnswer').onclick=()=>voice(n.pitch,audioTime(),.6,.15);
  }
  function previewNavigation(open){if(open){if(!active()||run.paused||!guided()||pressed.size)return false;menuPreview=true;run.elapsed=time();run.paused=true;return true;}if(menuPreview){menuPreview=false;if(active()&&page){run.started=performance.now();run.paused=false;showGroup();}}return false;}
  function pause(){if(page)saveView();if(menuPreview){menuPreview=false;run.paused=false;}document.body.classList.remove('tablet-song-playing');
    if(!active()||run.paused)return;run.elapsed=time();run.paused=true;run.interrupted=true;cancelAnimationFrame(raf);silence();pressed.clear();guideWrong.clear();window.PianoSongGuide?.refresh();if($('songPause')){$('songPause').textContent='继续';tell('已暂停。确认输入与位置后继续；本轮将标记为中断，不算独立考核。');}
  }
  async function resume(){
    if(!active()||!run.paused||!page||document.hidden)return;
    if(run.source!==input()){tell('输入方式已改变，请结束本轮后重新开始。',true);return;}
    await prepareAudio();document.body.classList.add('tablet-song-playing');run.started=performance.now();run.paused=false;pressed.clear();run.audioScheduled.clear();run.clickScheduled.clear();$('songPause').textContent='暂停';
    if(guided())showGroup();else {tell('继续跟拍；本轮含中断记录。');tick();}
  }
  function finish(complete,show=true){
    if(!active())return;const r=run,limit=Math.max(0,time()-r.countin);r.finished=true;cancelAnimationFrame(raf);silence();pressed.clear();document.body.classList.remove('song-hint-open');if($('songHintCard'))$('songHintCard').hidden=true;
    if(r.settings.mode==='listen'){if(!r.replay){r.learning=L.observe(learning,song,{...r,songId:selected,title:song.title,complete,result:null,task:r.task},Date.now());saveLearning();}if(show)tell(complete?'播放结束。可以先选一两小节，切到认音练习。':'播放已停止。');}
    else{
      let result;
      if(r.settings.mode==='beginner'||r.settings.mode==='exam'&&r.settings.examKind==='notes'){
        const answers=r.guidedAnswers.slice(),g=r.exercise.groups[r.index];
        if(!complete&&g&&r.attempts.some(a=>a.group===r.index))for(const n of g.notes){const first=r.firstAnswers.get(n.id);answers.push({id:n.id,pitch:n.pitch,actual:first?.actual??null,correct:!!first?.correct&&!r.hintLevels.has(n.id),hint:r.hintLevels.has(n.id),measure:g.measure,beat:g.beat,sourceBeat:g.sourceBeat,staff:n.staff,timing:true});}
        const correct=answers.filter(a=>a.correct).length;
        result={total:answers.length,correct,onTime:null,missed:answers.filter(a=>a.actual===null).length,wrong:r.wrong,extras:[],extraAttempts:r.attempts.filter(a=>!a.correct).map(a=>({pitch:a.pitch,measure:r.exercise.groups[a.group].measure,sourceBeat:r.exercise.groups[a.group].sourceBeat})),score:answers.length?Math.round(Math.max(0,correct-Math.max(0,r.wrong-answers.filter(a=>a.actual!==null&&!a.correct&&!a.hint).length)*.3)/answers.length*100):0,answers,hinted:r.hinted.size,completed:r.guidedAnswers.length};
      }else {result=C.evaluate(song,r.exercise,r.presses,complete?Infinity:limit);for(const a of result.answers){a.hint=r.hintLevels.has(a.id);a.hintLevel=r.hintLevels.get(a.id)||0;}result.hinted=result.answers.filter(a=>a.hint).length;}
      const report={version:2,id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),songId:selected,title:song.title,at:Date.now(),settings:{...r.settings},source:r.source,complete,interrupted:r.interrupted,assisted:!!r.assisted,result,presses:r.presses.slice(0,40000),events:r.events.slice(0,40000),task:r.task};
      if(result.total>0||r.events.length){report.learning=L.observe(learning,song,report);saveLearning();
        records.unshift(report);records=records.slice(0,40);try{localStorage.setItem(recordKey,JSON.stringify(records));}catch(e){H.notice('曲谱练习报告未能保存，请备份曲谱库。');}}
      if(show)showReport(report);
    }
    if(page){setLocked(false);$('songPause').textContent='暂停';renderHistory();renderLearning();window.PianoInput?.sync();window.PianoSongGuide?.refresh();}
  }
  function showReport(r){renderDetailedReport(r);}
  function activateTask(t){
    if(active()||!t)return;learning.current[input()]=t;prefs[selected]=C.settings(song,t.settings);displayReport=null;saveLearning();saveSettings();render();
  }
  function restoreTask(){
    const t=taskFor();if(t?.kind==='route'&&!t.route){const p=learning.plans[t.planKey];if(p){const next=L.next(learning,song,p.goal,input());if(next){learning.current[input()]=next;prefs[selected]=next.settings;saveLearning();saveSettings();}}else freeTask();}
    else if(t&&!active()){prefs[selected]=C.settings(song,t.settings);saveSettings();}
  }
  function beginRoute(){if(active())return;const t=L.next(learning,song,(taskFor()?.planKey||taskFor()?.route?.key)&&learning.plans[taskFor().planKey||taskFor().route.key]?learning.plans[taskFor().planKey||taskFor().route.key].goal:settings(),input());if(t)activateTask(t);else tell('这条分段路线已完成。可以按到期安排检查保持情况，或调整目标速度再练。');}
  function openReview(key){const m=learning.memory[key];if(!m||m.source!==input())return;const entry=library.find(s=>s.id===m.songId);if(!entry)return;choose(entry.id);activateTask(L.review(learning,{key,...m}));H.showPage('songsPage');}
  function renderLearning(){
    const host=$('songLearning');if(!host||!song)return;
    const t=taskFor(),s=settings(),a=L.analyze(song,s),due=L.due(learning,input()).filter(m=>m.songId===selected),p=t?.kind==='route'&&learning.plans[t.planKey||t.route?.key];
    let title=t?.title||'从这一段开始，认准后再跟拍',why=t?.kind==='remedy'?'针对练习保留原谱与原句入口；完成后回去检查。':t?.kind==='review'?'保持声部、速度与输入条件；两次独立确认间隔至少10分钟，通过后延长复习间隔。':song.study?song.study.goal:a.tips.join('；');
    if(p){const u=p.units[p.unit];title=(t.route?'':'下一步：')+(L.STAGES[L.stages(song,p)[p.stage]]||'本段已完成');why='第 '+(p.unit+1)+'/'+p.units.length+' 段任务 · '+(u?.connected?'连接相邻乐句':'两小节拆练')+' · 当前 '+p.clean+'/ '+(['slow','check'].includes(L.stages(song,p)[p.stage])?2:1)+' 次独立确认。';}
    const stages=p?L.stages(song,p):[];if($('songStart')&&!active()&&t?.kind==='route'&&!t.route)$('songStart').textContent='准备下一步';
    host.innerHTML=`<section class="song-learning-card"><div><span class="eyebrow">${t?.kind==='review'?'DELAYED CHECK · 到期回测':t?.kind==='remedy'?'FOCUS · 先解决这一项':'PRACTICE PATH · 分段练会'}</span><h4>${esc(title)}</h4><p>${esc(why)}</p><span class="song-condition">第 ${s.from}–${s.to} 小节 · ${{both:'双手 / 全部目标',right:'右手声部',left:'左手声部'}[s.hand]} · ${Math.round(s.tempo)} BPM${s.drill?' · 原句节奏专项':''}</span></div><div class="actions">${t?.kind==='remedy'?'<button id="songReturnOrigin" class="primary">回到原片段检查</button>':`<button id="songRoute" ${active()?'disabled':''}>${p?'继续分段路线':'按全曲分段学习'}</button>`}${due.length?`<button id="songDue" ${active()?'disabled':''}>到期回测 ${due.length} 段</button>`:''}${t?'<button id="songFree" '+(active()?'disabled':'')+'>退出引导，自由练习</button>':''}</div>${stages.length?'<ol class="song-stage-strip">'+stages.map((k,i)=>`<li class="${i===p.stage?'current':i<p.stage?'done':''}">${esc(L.STAGES[k])}</li>`).join('')+'</ol>':''}${!t?'<details class="song-piece-info"><summary>本段难点与学习前提</summary><p>'+esc(a.tips.join('；'))+'</p><p>'+esc(song.study?.prerequisite||'自动统计跨度、同时音数与时值。MIDI 左右手与分段为估计，可在自由设置中调整。')+'</p></details>':''}</section>`;
    if($('songRoute'))$('songRoute').onclick=beginRoute;
    if($('songDue'))$('songDue').onclick=()=>openReview(due[0].key);
    if($('songFree'))$('songFree').onclick=()=>{freeTask();prefs[selected]=C.settings(song,{...settings(),drill:''});saveSettings();render();};
    if($('songReturnOrigin'))$('songReturnOrigin').onclick=()=>returnOrigin(t);
    if($('songRhythmPad')){
      const down=e=>{e.preventDefault();$('songRhythmPad').setPointerCapture?.(e.pointerId);receive({type:'on',note:60,at:performance.now()},'touch');};
      const up=()=>receive({type:'off',note:60,at:performance.now()},'touch');$('songRhythmPad').onpointerdown=down;$('songRhythmPad').onpointerup=up;$('songRhythmPad').onpointercancel=up;
    }
  }
  function returnOrigin(t){
    if(active()||!t?.origin)return;
    if(t.originTask?.kind==='route'){
      const p=learning.plans[t.originTask.route?.key||t.originTask.planKey];
      if(p){activateTask(L.next(learning,song,p.goal,input()));return;}
    }
    freeTask();prefs[selected]=C.settings(song,t.origin);saveSettings();displayReport=null;render();tell('已恢复原片段、声部与速度。收起帮助，检查刚才的困难是否改善。');
  }
  function rhythmExercise(ex){
    const groups=ex.groups.map(g=>({...g,notes:[{...g.notes[0],sourcePitch:g.notes[0].pitch,pitch:60}]}));return {...ex,groups,notes:groups.flatMap(g=>g.notes)};
  }
  function hintMarkup(m){
    const lo=Math.min(-2,m.referenceOffset,m.targetOffset)-2,hi=Math.max(10,m.referenceOffset,m.targetOffset)+2,height=(hi-lo)*7+52,y=o=>24+(hi-o)*7;
    const lines=Array.from({length:5},(_,i)=>`<path d="M35 ${y(i*2)}H270"/>`).join('');let ledger='';
    for(let o=Math.floor(Math.min(0,m.targetOffset)/2)*2;o<=Math.max(8,m.targetOffset);o+=2)if(o<0||o>8)ledger+=`<path d="M207 ${y(o)}h27"/>`;
    const arrow=m.level>=2?`<path d="M153 ${y(m.referenceOffset)}L203 ${y(m.targetOffset)}" stroke="#b18a43" stroke-dasharray="4 4"/><text x="158" y="${(y(m.referenceOffset)+y(m.targetOffset))/2-8}" fill="#896629" stroke="none" font-size="12">${m.steps} 步</text>`:'';
    const octave=Math.floor(m.pitch/12)-1,keys=Array.from({length:12},(_,i)=>{const p=(octave+1)*12+i;return `<span class="${[1,3,6,8,10].includes(i)?'black':'white'} ${p===m.pitch?'target':''}">${p===m.pitch?esc(C.pitchName(p)):i===0?'C'+octave:''}</span>`;}).join('');
    return `<section class="song-hint-card"><div><strong>记忆提示 ${m.level}/3 · 当前未完成的音</strong><p>${esc(m.text)}</p><div class="actions"><button id="songHintReference">听参照音</button>${m.level===3?'<button id="songHintAnswer">听目标音</button>':''}</div>${m.level===3?'<div class="song-hint-keys" aria-label="目标所在八度">'+keys+'</div>':''}</div><svg viewBox="0 0 300 ${height}" role="img" aria-label="参照音与目标的线间位置"><g fill="none" stroke="#687c6a" stroke-width="1">${lines}${ledger}${arrow}</g><ellipse cx="95" cy="${y(m.referenceOffset)}" rx="8" ry="5" fill="#18212b"/><text x="43" y="${y(m.referenceOffset)-12}" fill="#3c6c52" font-size="12">${esc(C.pitchName(m.reference))}</text><ellipse cx="220" cy="${y(m.targetOffset)}" rx="8" ry="5" fill="#18212b"/>${m.level>=2&&m.alter?'<text x="196" y="'+(y(m.targetOffset)+5)+'" font-size="19">'+(m.alter>0?'♯':'♭')+'</text>':''}<text x="205" y="${y(m.targetOffset)-14}" fill="#896629" font-size="12">${m.level===3?esc(m.answer):'目标'}</text></svg></section>`;
  }
  function indexScore(){
    noteIndex=new Map();const cur=osmd?.cursor;if(!cur)return;
    try{cur.reset();let guard=0;while(!cur.Iterator.EndReached&&guard++<40000){const beat=cur.Iterator.CurrentSourceTimestamp.RealValue*4,key=Math.round(beat*10000),list=noteIndex.get(key)||[];
      for(const g of cur.GNotesUnderCursor()){const pitch=g.sourceNote?.Pitch;if(!pitch)continue;const heads=g.getNoteheadSVGs?.()||[],head=heads[g.vfnote?.[1]||0]||g.getSVGGElement?.();if(head&&!list.some(x=>x.head===head))list.push({pitch:g.sourceNote.halfTone+12,head,g,staff:(g.sourceNote.parentStaffEntry?.parentStaff?.idInMusicSheet??0)+1});}
      noteIndex.set(key,list);cur.next();}cur.reset();
    }catch(e){/* Text evidence and cursor remain available if a renderer omits a note shape. */}
  }
  function markScore(report){
    window.PianoScoreLayout.clearMarks();
    for(const list of noteIndex.values())for(const n of list){n.head.removeAttribute('data-song-mark');n.head.style.fill='#18212b';n.head.style.filter='';n.head.querySelectorAll('path').forEach(p=>p.style.fill='#18212b');}
    if(!report)return;
    for(const a of report.result.answers){if(a.correct&&(report.result.onTime===null||a.timing)&&!a.hint)continue;
      const beat=a.sourceBeat??(song.measures[report.settings.from-1].start+(a.beat||0)),list=noteIndex.get(Math.round(beat*10000))||[],matches=list.filter(n=>n.pitch===a.pitch),notes=matches.length?matches:report.settings.drill?list:[];
      for(const n of notes){const type=a.hint?'hint':a.actual===null?'miss':!a.correct?'pitch':'timing';n.head.dataset.songMark=type;n.head.style.fill='#18212b';n.head.querySelectorAll('path').forEach(p=>p.style.fill='#18212b');window.PianoScoreLayout.mark(beat,a.pitch,type);}
    }
  }
  function answerText(a,r){
    if(r.settings.drill)return a.correct&&a.timing?'起点正确':a.actual===null?'漏按起点':a.delta<0?'起拍偏早':'起拍偏晚';
    if(!Number.isInteger(a.pitch))return a.correct?'本组首次认准':'本组曾出错或用过提示（旧版未保存逐音位置）';
    const target=Number.isInteger(a.pitch)?C.pitchName(a.pitch):'目标音';return a.hint?target+' · 提示后完成':a.actual===null?target+' · 未匹配按键':!a.correct?target+' → 实际 '+C.pitchName(a.actual)+(Number.isInteger(a.pitch)&&(a.actual-a.pitch)%12===0?' · 八度不同':''):!a.timing&&r.result.onTime!==null?target+' · '+(a.delta<0?'偏早 ':'偏晚 ')+Math.round(Math.abs(a.delta))+' ms':target+' · 正确';
  }
  function renderDetailedReport(r){
    displayReport=r;const a=r.result,d=L.diagnosis(song,r,records),notesOnly=a.onTime===null,problems=a.answers.filter(x=>!x.correct||x.hint||!notesOnly&&!x.timing),current=taskFor(),mem=r.learning?.memory;
    const rows=problems.slice(0,36).map((x,i)=>{const m=song.measures[x.measure-1],source=x.sourceBeat??((song.measures[r.settings.from-1]?.start||0)+(x.beat||0)),beat=m?1+(source-m.start)*m.unit/4:1;return `<button data-song-error="${i}"><span>第 ${x.measure} 小节 · ${Number(beat.toFixed(2))} 拍</span><strong>${esc(answerText(x,r))}</strong></button>`;}).join('');
    const route=r.learning?.route,routeText=route?(route.done?'已完成这条分段路线，后续按到期安排检查保持。':route.passed?route.advanced?'当前步骤独立完成，可以继续下一步。':'本次独立完成，再确认一次后继续。':'当前步骤保留，先处理问题再回原句。'):'';
    $('songReport').innerHTML=`<section class="song-report"><div class="song-report-title"><div><span class="eyebrow">${r.settings.mode==='exam'?'ASSESSMENT':'PRACTICE'} · 练后复盘</span><h3>${r.complete?'本段已完成':'本轮提前结束'}${r.interrupted?' · 含中断':''}${r.settings.drill?' · 节奏拆练':''}</h3><p>${esc(titleFor(r.settings))} · ${r.settings.from}–${r.settings.to} 小节 · ${Math.round(r.settings.tempo)} BPM · ${r.source==='midi'?'实体琴':'屏幕输入'}</p></div><strong class="song-report-score">${a.score}<small> / 100</small></strong><button id="songCloseReport">返回谱面</button></div><div class="song-report-metrics"><span><strong>${a.correct} / ${a.total}</strong>${notesOnly?'无提示首次认准':'音高正确 / 应弹音数'}</span><span><strong>${notesOnly?a.completed:a.onTime}</strong>${notesOnly?'纠正后完成音数':'音高与起拍同时正确'}</span><span><strong>${notesOnly?a.hinted:a.missed+' / '+a.extras.length}</strong>${notesOnly?'使用提示组数':'漏按 / 多按'}</span></div><div class="song-next-advice"><strong>${esc(d.title)}</strong><p>${esc(d.reason)}</p>${routeText?'<p>'+esc(routeText)+'</p>':''}${mem?'<small>本片段：'+({assisted:'需要收起帮助回测',independent:'本次独立完成',stable:'同条件重复完成',retained:'延迟回测后保持'})[mem.status]+' · 下次检查 '+new Date(mem.due).toLocaleString('zh-CN')+'</small>':''}</div><div class="actions"><button id="songRetry" class="primary">原片段再练</button>${d.problems.length&&!r.interrupted?'<button id="songFocus">按主要困难拆练</button>':''}${r.task?.kind==='route'&&!route?.done?'<button id="songNextTask">继续分段路线</button>':''}${current?.kind==='remedy'?'<button id="songBackOrigin">回到原片段检查</button>':''}<button id="songListenStandard">听标准片段</button>${r.events?.length?'<button id="songListenActual">听本次按键</button>':''}</div><p class="song-problem-bars">${d.problems.length?'优先复习：第 '+d.problems.map(x=>x.measure).slice(0,12).join('、')+' 小节。谱行底部红点表示错音/漏音，金点表示提示/起拍问题；点击具体位置回到谱面。':'本次完成后，接回相邻乐句并按到期安排再检查。'}</p>${rows?'<details open class="song-error-list"><summary>具体位置 · '+problems.length+' 个目标</summary>'+rows+'</details>':''}<p class="song-report-limit">${r.assisted?'本轮使用过键位/指法预读，记为辅助练习；请关闭提示后独立检查。 ':''}${notesOnly?'本轮错键尝试 '+a.wrong+' 次。同组音可以逐个找齐；和弦起音整齐度需要跟拍检查。':'评价音高与起拍，不把所有持键长度视为必须按满的演奏标准。'}${r.interrupted?' 本轮含中断，不推进独立学习证据。':''} 软件练习规则不等同标准化考试。</p></section>`;
    const closeReport=()=>{displayReport=null;$('songReport').replaceChildren();};$('songCloseReport').onclick=closeReport;
    $('songRetry').onclick=()=>{if(active())finish(false,false);freeTask();prefs[selected]=C.settings(song,r.settings);displayReport=null;saveSettings();render();};
    if($('songFocus'))$('songFocus').onclick=()=>activateTask(L.remedy(learning,song,r.source===input()?r:{...r,source:input(),task:null},records));
    if($('songNextTask'))$('songNextTask').onclick=()=>{const p=learning.plans[r.task.route?.key||r.task.planKey];if(p)activateTask(L.next(learning,song,p.goal,input()));};
    if($('songBackOrigin'))$('songBackOrigin').onclick=()=>returnOrigin(current);
    $('songListenStandard').onclick=()=>replay(r,false);if($('songListenActual'))$('songListenActual').onclick=()=>replay(r,true);
    $('songReport').querySelectorAll('[data-song-error]').forEach(b=>b.onclick=()=>{const x=problems[+b.dataset.songError],beat=x.sourceBeat??((song.measures[r.settings.from-1]?.start||0)+(x.beat||0));closeReport();moveCursor(beat,true);$('songScoreScroll').scrollIntoView({block:'nearest',behavior:'smooth'});tell('第 '+x.measure+' 小节：'+answerText(x,r),true);});
    if($('songFocus')){$('songRetry').classList.remove('primary');$('songFocus').classList.add('primary');}
    window.PianoFeedback.present($('songReport').firstElementChild,r,'song',d);markScore(r);$('songReport').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  async function replay(r,actual){
    if(active()){if(run.replay){finish(false,false);return;}tell('请先结束本轮，再回放。');return;}
    if(!await prepareAudio()){tell('声音未能启动，请检查系统音量。',true);return;}
    silence();const s=C.settings(song,{...r.settings,mode:'listen',drill:'',loop:false}),ex=C.prepared(song,s),base=C.secondsAt(song,ex.from,s.tempo),notes=[];
    if(actual){const open=new Map();for(const e of r.events||[]){if(e.type==='on')open.set(e.pitch,e.ms);else if(open.has(e.pitch)){const start=open.get(e.pitch);open.delete(e.pitch);notes.push({pitch:e.pitch,ms:Math.max(0,start),dur:Math.max(.05,(e.ms-start)/1000),velocity:80});}}for(const [pitch,ms]of open)notes.push({pitch,ms:Math.max(0,ms),dur:.2,velocity:80});}
    else for(const n of C.prepared(song,{...s,from:1,to:song.measures.length}).notes.filter(n=>n.start<ex.to&&n.start+n.duration>ex.from)){const start=Math.max(ex.from,n.start),end=Math.min(ex.to,n.start+n.duration);notes.push({pitch:n.pitch,ms:(C.secondsAt(song,start,s.tempo)-base)*1000,dur:C.secondsAt(song,end,s.tempo)-C.secondsAt(song,start,s.tempo),velocity:n.velocity});}
    const max=actual?Math.max(0,...notes.map(n=>n.ms+n.dur*1000)):(C.secondsAt(song,ex.to,s.tempo)-base)*1000;
    run={finished:false,paused:false,interrupted:false,replay:true,settings:s,source:input(),exercise:ex,started:performance.now(),elapsed:0,countin:0,baseSeconds:base,duration:Math.min(max,120000),playNotes:notes.filter(n=>n.ms<120000),audioScheduled:new Set(),clickScheduled:new Set(),presses:[]};setLocked(true);tell(actual?'本次按键回放 · 最多两分钟，包含实际停顿。':'标准片段示范 · 最多两分钟。');tick();
  }
  function renderHome(name){
    if(!['today','progressPage'].includes(name))return;const pageNode=$(name);if(!pageNode)return;pageNode.querySelector('.song-home-card')?.remove();
    const available=new Set(library.map(s=>s.id)),due=L.due(learning,input()).filter(m=>available.has(m.songId)),pending=learning.current[input()],recent=Object.values(learning.memory).filter(m=>m.source===input()&&available.has(m.songId)).sort((a,b)=>b.last-a.last)[0];
    const host=document.createElement('section');host.id=name==='today'?'songHomeLearning':'songProgressLearning';host.className='song-home-card';const m=due[0],entry=library.find(s=>s.id===(m?.songId||pending?.songId||recent?.songId))||library.find(s=>s.id==='builtin-path-4');
    if(!entry)return;
    host.innerHTML=`<div><span class="eyebrow">${due.length?'REVIEW · 曲谱到期回测':'YOUR MUSIC · 继续练曲'}</span><h3>${esc(entry.title)}</h3><p>${m?'第 '+m.settings.from+'–'+m.settings.to+' 小节到期，保持原声部、速度与输入条件检查。':pending?'继续上次步骤：'+esc(pending.title):recent?'已有片段记录，连接下一段前先独立确认。':esc(entry.study?.goal||'从两小节起步，拆练后返回原句。')}</p><small>${due.length?'共 '+due.length+' 个曲谱片段待检查。':'原曲练习与基础课程分别保存，通过原句检查它们之间的联系。'}</small></div><button class="primary" id="${name==='today'?'songHomeAction':'songProgressAction'}">${m?'回测这一段':pending?'继续练曲':'打开分段学习'}</button>`;
    if(name==='today')(pageNode.querySelector('.daily-summary')||pageNode.firstElementChild)?.after(host);else (pageNode.querySelector('#skillEvidence')||pageNode.querySelector('.page-head'))?.after(host);
    if(name==='progressPage')window.PianoHistory?.render(pageNode);
    host.querySelector('button').onclick=()=>{if(m){openReview(m.key);return;}choose(entry.id);H.showPage('songsPage');if(!taskFor())beginRoute();};
  }
  function renderHistory(){
    if(!$('songHistory'))return;const own=records.filter(r=>r.songId===selected).slice(0,5);
    $('songHistory').innerHTML=own.length?`<details class="song-history"><summary>本曲最近练习 · ${own.length} 条</summary>${own.map(r=>`<button data-song-report="${esc(r.id)}"><span>${new Date(r.at).toLocaleDateString('zh-CN')} · ${esc(titleFor(r.settings))} · ${r.settings.from}–${r.settings.to} 小节${r.interrupted?' · 中断':''}</span><strong>${!r.result.total?'尚未形成成绩':r.complete?r.result.score+' 分':'已记录 '+r.result.total+' 音'}</strong></button>`).join('')}</details>`:'';
    $('songHistory').querySelectorAll('[data-song-report]').forEach(b=>b.onclick=()=>showReport(records.find(r=>r.id===b.dataset.songReport)));
  }
  async function importPicker(){if(active())return;if(window.PianoAndroid?.importScore){window.PianoAndroid.importScore();return;}$('songFile').click();}
  async function importFile(file){
    if(busy||active())return;busy=true;tell('正在读取并检查曲谱…');
    try{
      if(file.size>5000000)throw Error('请选择 5MB 以内的曲谱。');const bytes=new Uint8Array(await file.arrayBuffer());let value;
      if(/\.json$/i.test(file.name)){
        const backup=JSON.parse(new TextDecoder().decode(bytes));if(backup.type!=='piano-song-library'||![1,2].includes(backup.version)||!Array.isArray(backup.songs)||backup.songs.length>40)throw Error('这不是本应用的曲谱库备份。');
        const parsed=[];for(const entry of backup.songs){value=C.fromStored(entry);value.id=String(entry.id||'s'+Date.now()).slice(0,80);if(isBuiltin(value.id))throw Error('备份包含与内置练习重复的编号。');parsed.push(value);}
        for(const v of parsed)await store('put',v);
        library=[...builtin(),...(await store('getAll')).filter(s=>!isBuiltin(s.id))];
        if(backup.records&&Array.isArray(backup.records))records=backup.records.filter(validReport).slice(0,40);
        if(backup.learning)learning=L.normalize(backup.learning);saveLearning();
        if(backup.prefs&&typeof backup.prefs==='object'&&!Array.isArray(backup.prefs))prefs=backup.prefs;
        localStorage.setItem(recordKey,JSON.stringify(records));saveSettings();choose(parsed[0]?.id||library[0].id);tell('曲谱库备份已恢复。');return;
      }
      if(bytes[0]===77&&bytes[1]===84&&bytes[2]===104&&bytes[3]===100)value=C.parseMidi(bytes,file.name);
      else {
        let text;if(bytes[0]===80&&bytes[1]===75){
          if(!window.fflate)throw Error('本地压缩解码未加载。');let total=0;
          const files=fflate.unzipSync(bytes,{filter:f=>{total+=f.originalSize;if(total>25000000)throw Error('解压后曲谱超过 25MB，请导出普通 MusicXML。');return /\.(xml|musicxml)$/i.test(f.name);}});
          const container=files['META-INF/container.xml'];let path;
          if(container){const d=new DOMParser().parseFromString(new TextDecoder().decode(container),'application/xml');path=d.querySelector('rootfile')?.getAttribute('full-path');}
          path=path||Object.keys(files).find(p=>!p.startsWith('META-INF/'));
          if(!files[path])throw Error('压缩曲谱中未找到 MusicXML 主文件。');text=new TextDecoder().decode(files[path]);
        }else text=new TextDecoder('utf-8').decode(bytes);
        value=C.parseXML(text,file.name);
      }
      value.id='song-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
      await store('put',value);library.push(value);choose(value.id);tell('导入完成。先确认谱面与声部，默认从前两小节练起。');
    }catch(e){tell('导入失败：'+(e.message||e),true);}finally{busy=false;}
  }
  async function backup(){
    if(active())return;const text=JSON.stringify({type:'piano-song-library',version:2,songs:library.filter(s=>!isBuiltin(s.id)),prefs,records,learning});
    if(new Blob([text]).size>5000000){tell('曲谱库备份超过 5MB，请保留各首原文件，或先移除不使用的曲谱。',true);return;}
    if(window.PianoAndroid?.exportData)window.PianoAndroid.exportData('曲谱库与练习记录.json',text);
    else {const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=url;a.download='曲谱库与练习记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  }
  async function nativeFile(name,base64){const raw=atob(base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));await importFile(new File([bytes],name));}
  const back=window.PianoBack,pauseApp=window.PianoPause;
  window.PianoBack=()=>{if(!page||window.PianoInput?.panelOpen?.())return back?.();if(window.PianoScoreLayout.isPicking()){window.PianoScoreLayout.endRange();return true;}if(window.PianoSongGuide?.isOpen()){window.PianoSongGuide.close();return true;}if(panelOpen){closePanel();return true;}if(window.PianoSongGuide?.isFocused()){window.PianoSongGuide.exitFocus();return true;}if(active()){pause();H.confirm('结束本轮并返回？','已经尝试的音保留记录，未练到的后续音不计错。',()=>{finish(false,false);H.showPage('today');});return true;}H.showPage('today');return true;};
  window.PianoPause=()=>{pause();silence();pauseApp?.();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  window.addEventListener('pagehide',saveView);
  window.addEventListener('pianoinputchange',()=>{if(active())pause();else if(page){render();tell(input()==='midi'?'实体琴已连接。':'当前使用屏幕琴键。');}});
  let resizeTimer;window.addEventListener('resize',()=>{if(page){clearTimeout(resizeTimer);resizeTimer=setTimeout(renderScore,200);}});
  document.addEventListener('keydown',e=>{if(e.defaultPrevented||window.PianoScoreLayout.isPicking()||!page||panelOpen||window.PianoSongGuide?.isOpen()||e.repeat||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||H.modalOpen()||window.PianoInput?.panelOpen?.())return;if(e.code==='Space'){e.preventDefault();active()?(run.paused?resume():pause()):start();}});
  window.PianoSongs={
    captureTheoryContext,restoreTheoryContext,
    toggleReading,closePanel,refreshScore:()=>page&&renderScore(),
    isActive:active,inputSource:()=>run?.source||input(),midiEvent:e=>receive(e,'midi'),midiReady:()=>false,pause,stopForInputChange:pause,
    beforeOtherTraining:callback=>{if(!active())return false;pause();H.confirm('结束曲谱练习并开始新训练？','本轮已经尝试的音会保存。',()=>{finish(false,false);callback();});return true;},
    beforeNavigate:name=>{if(name!=='songsPage'){window.PianoScoreLayout.endRange();closePanel();pause();document.querySelector('.app-header > .tablet-song-top')?.remove();silence();window.PianoSongGuide?.reset();renderGeneration++;document.body.classList.remove('song-running','song-hint-open','tablet-song','tablet-song-keys','tablet-song-playing');}},
    navigate:name=>{page=name==='songsPage';if(!page)renderHome(name);if(page){$('modeTitle').textContent='我的曲谱 · 导入、听、练与考核';render();if(active()){setLocked(true);$('songPause').textContent='继续';tell('本轮已暂停，点击继续。');}}},
    previewNavigation,reports:()=>records.slice(),openReport:id=>{const r=records.find(x=>x.id===id);if(!r||!library.some(s=>s.id===r.songId))return;choose(r.songId);H.showPage('songsPage');showReport(r);},
    importFile,nativeFile,getState:()=>({song,settings:settings(),run,library:library.map(s=>({id:s.id,title:s.title})),records,learning,task:taskFor(),layout:window.PianoScoreLayout.state(),markedNotes:document.querySelectorAll('[data-song-mark]').length,cursorBeat:osmd?.cursor?osmd.cursor.Iterator.CurrentSourceTimestamp.RealValue*4:null}),
    loadDemo:()=>choose('builtin-first-piece'),choose,renderHome,continueRoute:beginRoute,review:key=>openReview(key)
  };
  library=builtin();selected=library[0].id;song=library[0];
  function validReport(r){
    const s=r?.settings,a=r?.result;
    return !!(r&&typeof r.id==='string'&&typeof r.title==='string'&&typeof r.songId==='string'&&Number.isFinite(r.at)&&s&&MODES[s.mode]&&['both','left','right'].includes(s.hand)&&Number.isFinite(s.tempo)&&s.tempo>0&&Number.isInteger(s.from)&&Number.isInteger(s.to)&&a&&Array.isArray(a.answers)&&a.answers.every(x=>x&&Number.isInteger(x.measure)&&typeof x.correct==='boolean')&&Number.isFinite(a.score)&&a.score>=0&&a.score<=100&&Number.isFinite(a.total)&&Number.isFinite(a.correct)&&Array.isArray(a.extras));
  }
  records=records.filter(validReport);
  libraryReady=store('getAll').then(saved=>{library=[...builtin(),...saved.filter(s=>!isBuiltin(s.id)).map(C.fromStored)];if(!active()){let last;try{last=localStorage.getItem(selectionKey);}catch(e){}const preferred=learning.current[input()]?.songId||last;if(library.some(s=>s.id===preferred)){selected=preferred;song=library.find(s=>s.id===preferred);lastCursor=viewBeat();}if(page)render();}renderHome(document.body.dataset.screen);}).catch(e=>H.notice(e.message));
})();
