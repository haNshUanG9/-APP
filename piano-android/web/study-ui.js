/* New learning routes reuse the offline shell and its private local data. */
(() => {
  'use strict';
  const C=PianoCore,S=StudyCore,LCore=LearningCore,H=window.PianoHost,$=id=>document.getElementById(id),G=H.glyphs,V=window.PianoStudio;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names={anchors:'参照音定位',contrast:'易混音对照',ledger:'加线音专项',reverse:'琴键到谱面',review:'到期复习',phrase:'短句读谱',rhythm:'节奏练习'};
  let lesson=null,currentPage='today',raf=0,audio=null,scheduled=0,clickTimers=[],keyboardDown=new Map(),activeOscillators=new Set();
  const AUTO_ADVANCE_MS=1000,heldPointers=new Set();let advanceTimer=0,lastInput=0;
  function cancelAdvance(){clearTimeout(advanceTimer);advanceTimer=0;}
  function inputHeld(){return heldPointers.size>0||!!(window.PianoInput?.isMidi()&&window.PianoInput?.hasHeldNotes?.());}
  function groupComplete(){return !!lesson?.slots.length&&lesson.slots.every(s=>s.completed);}
  function autoReady(){return lesson?.active&&lesson.state==='guided'&&lesson.kind!=='rhythm'&&currentPage==='studyLesson'&&!document.hidden&&!H.modalOpen()&&!window.PianoInput?.panelOpen?.()&&groupComplete()&&!inputHeld()&&!(window.PianoInput?.isMidi()&&window.PianoInput.autoAdvanceEnabled?.()===false);}
  function autoContinue(){
    if(!autoReady()||!lastInput){cancelAdvance();return;}if(advanceTimer)return;
    const owner=lesson,index=lesson.index;
    advanceTimer=setTimeout(()=>{advanceTimer=0;if(lesson===owner&&lesson.index===index&&autoReady())advance();},Math.max(0,AUTO_ADVANCE_MS-(performance.now()-lastInput)));
  }
  function inputActivity(){cancelAdvance();lastInput=performance.now();autoContinue();}
  function lastGroup(){const L=lesson,s=L.courseSession;return s?s.cursor>=s.plan.length&&!(s.retries.length&&s.extra<LCore.MAX_EXTRA):L.index===L.groups.length-1;}
  // Pointer release is observed outside the keys too, so dragging off a key cannot leave a stale hold.
  document.addEventListener('pointerdown',e=>{if(lesson?.active&&lesson.state==='guided'&&currentPage==='studyLesson'&&e.button===0&&e.target.closest?.('#lessonKeys [data-midi],#lessonStage [data-position]')){heldPointers.add(e.pointerId);inputActivity();}},true);
  for(const type of ['pointerup','pointercancel'])document.addEventListener(type,e=>{if(heldPointers.delete(e.pointerId))inputActivity();});
  const data=()=>H.getDB().study;
  const source=()=>window.PianoInput?.isMidi()?'midi':'touch';
  const learning=()=>data().learning||(data().learning=LCore.defaults());
  const reviewDue=()=>LCore.due(learning(),source());
  const focusedInfo=(kind,clef)=>LCore.info(learning(),kind,clef,kind==='reverse'?'touch':source());
  const percent=(a,b)=>b?Math.round(a/b*100)+'%':'暂无';
  const fmt=ms=>ms===null?'暂无':(ms/1000).toFixed(2)+'秒';
  function bindPages(el) {el.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>H.showPage(b.dataset.page));}
  function classic() {H.configureClassic({});}
  function today() {
    const d=data(),due=reviewDue(),weak=[...new Set([...Object.values(H.getDB().profiles).filter(p=>C.weakness(p,C.baseline(H.getDB().profiles,p.target.clef,p.samples.at(-1)?.context),p.samples.at(-1)?.context).score>0).map(p=>C.profileKey(p.target)),...S.weakNotes(d).map(C.profileKey)])],recent=d.reports[d.reports.length-1];
    $('today').innerHTML=`${V.heading('01','今天，从这里开始。','循序学习，隔题巩固，再回到音乐中。','<div class="actions"><button id="freePractice">自由练习</button><button data-page="help">学习说明</button></div>')}
      <section class="foundation-entry home-lesson"><div class="home-lesson-heading"><span class="eyebrow">循序课程</span><span>18 节小课 · 6 个章节</span></div><h3 id="homeLessonTitle">继续当前课</h3><p id="homeLessonDetail"></p><div class="home-route"><span>认音</span><i>→</i><span>听辨</span><i>→</i><span>跟弹</span><i>→</i><span>读句</span></div><div id="homeCoursePreview" class="home-course-preview"></div><button id="foundationStart" class="primary">继续循序学习 ${V.icon('arrow')}</button></section>
      <div class="training-plan"><div class="plan-intro"><span class="eyebrow">${due.length?'今天的复习':'巩固当前音组'}</span><h3>${due.length?due.length+' 个音，该再认一遍了。':'先把这几个音记牢。'}</h3><p>${due.length?'间隔一段时间后，再检查能否独立认出。':esc(focusedInfo('anchors','treble').unit.title)+' · 同组反复，逐步增加难度。'}</p><button id="dailyStart">${due.length?'开始到期复习':'开始参照音训练'} ${V.icon('arrow')}</button></div><ol class="daily-steps"><li><span class="route-icon">${V.icon('anchors')}</span><div><h3>专项练习</h3><p>定位 · 加线 · 易混音</p></div><button data-page="topics" aria-label="打开专项练习">${V.icon('arrow')}</button></li><li><span class="route-icon">${V.icon('phrase')}</span><div><h3>短句读谱</h3><p>同一句，先读准再跟拍</p></div><button data-page="reading" aria-label="打开短句读谱">${V.icon('arrow')}</button></li><li><span class="route-icon">${V.icon('rhythm')}</span><div><h3>节奏与拍子</h3><p>稳拍 · 时值 · 节奏模仿</p></div><button id="dailyRhythm" aria-label="打开节奏训练">${V.icon('arrow')}</button></li></ol></div>
      <div class="daily-summary"><div><strong>${due.length}</strong><span>到期复习音</span></div><div><strong>${weak.length}</strong><span>待加强音</span></div><div><strong>${d.reports.length+(d.rhythm?.reports?.length||0)}</strong><span>专项训练记录</span></div></div>
      ${lesson?.active?'<div class="resume-strip"><p>有一项训练已暂停，进度仍保留。</p><button id="resumeLesson">返回训练</button></div>':''}
      <details class="home-quick"><summary>自定义快速识谱</summary><div class="quick-practice"><div><h3>快速识谱</h3><p>易错和较慢的音自动加练。</p></div><label>谱表<select id="quickClef"><option value="treble">高音</option><option value="bass">低音</option><option value="mixed">高低混合</option><option value="dual">双谱表</option></select></label><label>每题音数<input id="quickNotes" type="number" min="1" max="15" step="1" inputmode="numeric" value="${H.getDB().settings.noteCount}"></label><label>整题时限<select id="quickTiming"><option value="auto">按音数计算</option><option value="unlimited">不限时</option></select></label><button id="quickStart" class="primary">开始识谱</button><p id="quickError" role="alert" class="bad" hidden></p></div></details>`;
    $('quickClef').value=H.getDB().settings.mode;$('quickTiming').value=H.getDB().settings.timing==='unlimited'?'unlimited':'auto';
    $('quickStart').onclick=()=>{const n=Number($('quickNotes').value),mode=$('quickClef').value;const error=!Number.isInteger(n)||n<1||n>15?'音数须为1～15的整数。':mode==='dual'&&n<2?'双谱表至少需要2个音。':'';$('quickError').textContent=error;$('quickError').hidden=!error;if(error)return;H.configureClassic({mode,noteCount:n,timing:$('quickTiming').value,strategy:'adaptive'});H.startClassic();};
    bindPages($('today'));$('dailyStart').onclick=()=>due.length?launch('review',{clef:'mixed'}):launch('anchors',{clef:'treble',course:'progressive',count:20});$('dailyRhythm').onclick=()=>window.PianoRhythm.open();$('freePractice').onclick=classic;
    if($('resumeLesson'))$('resumeLesson').onclick=()=>H.showPage('studyLesson');
    if(window.PianoFoundation){
      const recommendation=window.PianoFoundation.recommendation?.(),t=H.getDB().study.foundation.tracks[source()],current=FoundationCore.LESSONS[Math.min(t.unit,17)];$('homeLessonTitle').textContent=current.title;$('homeLessonDetail').textContent=recommendation?.detail||current.concept;$('today').querySelector('.home-lesson-heading .eyebrow').textContent='继续第 '+(t.unit+1)+' / 18 课';$('today').querySelector('.home-lesson-heading>span:last-child').textContent='已完成 '+t.passed.length+' 课';$('today').querySelector('.home-route').innerHTML='<span>当前阶段</span><strong>'+esc(FoundationCore.LABELS[t.phase]||'复习')+'</strong>';
      const c=current.pool[0].clef,base=C.parse(c==='bass'?'G2':'E4').index,notes=current.pool.filter(n=>n.clef===c).slice(0,7);let preview='';for(let i=0;i<5;i++)preview+=`<path d="M12 ${110-i*20}H500"/>`;preview+=`<path d="${G[c].path}" transform="translate(24 ${c==='bass'?50:90}) scale(.08 -.08)" stroke="none"/>`;notes.forEach((n,i)=>{const x=135+i*310/Math.max(1,notes.length-1),delta=C.parse(C.midiName(n.midi)).index-base,y=110-delta*10;for(const k of C.ledgerOffsets(delta))preview+=`<path d="M${x-18} ${110-k*10}h36"/>`;preview+=`<ellipse cx="${x}" cy="${y}" rx="12" ry="8" transform="rotate(-18 ${x} ${y})"/><path d="M${x+12} ${y}v-48"/>`;});$('homeCoursePreview').innerHTML='<svg viewBox="0 0 520 150" role="img" aria-label="本课音组预览">'+preview+'</svg>';$('foundationStart').onclick=()=>window.PianoFoundation.continueCurrent();
    }
  }
  function topics() {
    const rows=[['anchors','参照音与周围位置一起练，逐步扩大线间距离。'],['contrast','成对比较相邻音、三度或八度；有错键记录时加入实际混淆。'],['ledger','按难度练上下加线，从靠近谱表的位置逐步扩展。'],['reverse','先看一个琴键，再在指定谱表上找同一个音。'],['rhythm','稳拍、数拍、时值、休止、听后模仿与双侧配合。']];
    $('topics').innerHTML=`${V.heading('02','把难点，逐个练熟。','一次专注一种能力，再把它放回音乐里。','<button id="topicFree">自由练习 ↗</button>')}<div class="topic-list">${rows.map(([k,p],i)=>`<div class="topic-row" data-course="${k}"><span class="course-no">${String(i+1).padStart(2,'0')}</span><span class="topic-number">${V.icon(k)}</span><div><h3>${k==='rhythm'?'节奏与拍子':names[k]}</h3><p>${p}</p></div><button data-topic="${k}" class="${i===0?'primary':''}">开始练习${V.icon('arrow')}</button></div>`).join('')}</div><div class="topic-options"><label>练习安排<select id="topicCourse"><option value="progressive">循序课程 · 固定音组</option><option value="free">自由抽题 · 全音域</option></select></label><label>练习谱表<select id="topicClef"><option value="treble">高音谱表</option><option value="bass">低音谱表</option><option value="mixed">高低混合</option></select></label><label>音域难度<select id="topicDifficulty"><option value="beginner">入门 · 近邻与近加线</option><option value="basic">基础 · 扩展位置</option><option value="extended">拓展 · 宽音域与八度</option></select></label><label>每轮题量<select id="topicCount"><option value="10">10题</option><option value="20">20题</option><option value="40">40题</option><option value="60">60题</option></select></label><label>节奏难度<select id="topicRhythm"><option value="1">基础 四分与二分</option><option value="2">进阶 加入八分</option></select></label><label>节奏速度<select id="topicTempo">${[40,50,60,70,80].map(x=>`<option value="${x}">${x} BPM</option>`).join('')}</select></label><p>音高专项按所选题量练习；节奏课程单独选择拍号、小节和速度。用过参照提示的音不计入无提示准确率，也不会升级复习间隔。</p></div>`;
    $('topicClef').value=data().settings.clef==='dual'?'treble':data().settings.clef;$('topicCourse').value=data().settings.course||'progressive';
    $('topicDifficulty').value=data().settings.difficulty;$('topicCount').value=data().settings.count;$('topicRhythm').value=data().settings.rhythm;$('topicTempo').value=data().settings.tempo;$('topicRhythm').parentElement.hidden=true;$('topicTempo').parentElement.hidden=true;
    $('topics').querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>b.dataset.topic==='rhythm'?window.PianoRhythm.open():launch(b.dataset.topic,{clef:$('topicClef').value,course:$('topicCourse').value,difficulty:$('topicDifficulty').value,count:Number($('topicCount').value),tempo:Number($('topicTempo').value),rhythm:Number($('topicRhythm').value),metronome:true}));$('topicFree').onclick=classic;
    $('topics').insertAdjacentHTML('beforeend','<div class="section-heading"><h3>你的学习路线</h3><span>反复巩固，再向前一步</span></div>');
    const map=document.createElement('div');map.id='unitOverview';map.className='unit-overview';$('topics').appendChild(map);
    if(window.PianoFoundation){const entry=document.createElement('section');entry.className='foundation-entry';entry.innerHTML='<div><span class="eyebrow">18 节小课 · 36 条乐句</span><h3>循序课程</h3><p>需要按顺序学习时，从当前课继续。</p></div><button class="primary" id="topicFoundation">打开课程地图</button>';$('topics').querySelector('.page-head').after(entry);$('topicFoundation').onclick=()=>window.PianoFoundation.open();}
    function updateUnits(){const clef=$('topicClef').value,progressive=$('topicCourse').value==='progressive';$('topicDifficulty').disabled=progressive;$('unitOverview').hidden=!progressive;$('unitOverview').innerHTML=['anchors','contrast','ledger','reverse'].map(kind=>{const i=focusedInfo(kind,clef);return `<div class="learning-card"><h3>${names[kind]} · 单元 ${i.index+1}/${i.total}</h3><p>${esc(i.unit.title)}${i.complete?' · 已完成路线，可继续巩固':i.pending?' · 有未完成计划，开始后续练':''}</p><p>当前目标各至少4次无提示正确；错误需通过隔题回测。</p><details class="course-map"><summary>查看学习顺序</summary><ol>${LCore.units(kind,clef).map((u,n)=>`<li class="${n<i.track.unit?'passed':n===i.index?'current':''}">${esc(u.title)}${n<i.track.unit?' · 已通过':''}</li>`).join('')}</ol></details></div>`;}).join('');}updateUnits();$('topicClef').onchange=updateUnits;$('topicCourse').onchange=updateUnits;
    const work=document.createElement('div');work.className='topics-layout';const list=$('topics').querySelector('.topic-list'),options=$('topics').querySelector('.topic-options');list.before(work);work.append(list,options);const progress=document.createElement('details');progress.className='topics-progress';progress.innerHTML='<summary>当前进度与学习顺序</summary>';progress.appendChild($('unitOverview'));options.appendChild(progress);$('topics').querySelector('.section-heading')?.remove();

  }
  function reading() {
    const s=data().settings;
    $('reading').innerHTML=`${V.heading('03','让音符，连成音乐。','先读懂一句，再把它练得自然流畅。','<button id="readingFree">自由练习与倒计时 ↗</button>')}
    <div class="reading-settings"><div class="reading-description"><span class="eyebrow">READ · REPEAT · REMEMBER</span><h3>慢慢认准，<br>再跟着拍子走。</h3>${V.artwork()}<p>学习时可以停下来纠错；连续练习时，跟着预备拍进入，结束后再复盘错音。</p><p>同一句反复练熟后，再通过小变体检查记忆。测评使用新短句，并关闭音高提示。</p><p class="muted">自然音 · 4/4拍 · 中央C = C4<br>琴键范围在本轮内保持固定。</p></div><div class="reading-form">
    <label>练习安排<select id="studyCourse"><option value="progressive">循序课程 · 同句巩固</option><option value="free">自由短句</option></select></label><label>谱表<select id="studyClef"><option value="treble">高音</option><option value="bass">低音</option><option value="mixed">高低轮换</option><option value="dual">双谱表</option></select></label>
    <label>每段音符数<div class="study-number"><button id="studyMinus" aria-label="减少短句音数">−</button><input id="studyNotes" type="number" min="1" max="15" step="1" inputmode="numeric"><button id="studyPlus" aria-label="增加短句音数">＋</button></div></label>
    <label>音域<select id="studyDifficulty"><option value="beginner">入门 · 谱表内</option><option value="basic">基础 · 扩展音域</option><option value="extended">拓展 · 加线音域</option></select></label><label>音型<select id="studyPattern"><option value="steps">级进 上行与下行</option><option value="repeat">重复音与相邻音</option><option value="thirds">三度跳进</option><option value="mixed">混合音型</option></select></label>
    <label>节奏<select id="studyRhythm"><option value="1">基础 四分与二分</option><option value="2">进阶 加入八分与休止</option></select></label>
    <label id="dualChoice">双谱表配合<select id="studyDual"><option value="alternate">上下交替</option><option value="sustain">低音长音 高音移动</option><option value="together">同一拍上下同时</option></select></label>
    <label>训练方式<select id="studyFlow"><option value="guided">学习 可停下来纠错</option><option value="continuous">连续 跟着拍子走</option><option value="assessment">测评 新题无音高提示</option></select></label>
    <label id="tempoChoice">速度<select id="studyTempo">${[40,50,60,70,80].map(x=>`<option value="${x}">${x} BPM 每分钟${x}拍</option>`).join('')}</select></label>
    <label class="study-check"><input type="checkbox" id="studyMetro">开启节拍器</label><button class="primary" id="studyLaunch">开始短句</button><p id="studySettingsError" role="alert" class="bad" hidden></p></div></div>`;
    const map={Course:'course',Clef:'clef',Difficulty:'difficulty',Notes:'notes',Pattern:'pattern',Rhythm:'rhythm',Dual:'dual',Flow:'flow',Tempo:'tempo'};Object.keys(map).forEach(k=>$('study'+k).value=s[map[k]]);$('studyMetro').checked=s.metronome;
    function controls(){const progressive=$('studyCourse').value==='progressive';for(const id of ['studyNotes','studyPattern','studyRhythm','studyFlow','studyDifficulty'])$(id).disabled=progressive;$('studyMinus').disabled=progressive;$('studyPlus').disabled=progressive;
      const i=LCore.phraseInfo(learning(),$('studyClef').value,source());let box=$('phraseCourseInfo');if(!box){box=document.createElement('div');box.id='phraseCourseInfo';box.className='phrase-phase';$('reading').querySelector('.reading-description').appendChild(box);}box.hidden=!progressive;box.innerHTML=`<h3>单元 ${i.state.unit+1}/8 · ${esc(i.notes.join(' / '))}</h3><p>阶段：${i.labels[i.state.phase]}。${i.unlocked?'目标音已练熟，可以开始短句。':'先在音高专项中把这些音各独立认对至少4次，再开始短句。'} 循序短句使用单谱表、固定6音和较慢跟拍；双谱表可在自由短句中练习。</p>`;
      $('dualChoice').hidden=$('studyClef').value!=='dual';$('tempoChoice').hidden=$('studyFlow').value==='guided';$('studyMetro').parentElement.hidden=$('studyFlow').value==='guided';}
    controls();['studyCourse','studyClef','studyFlow'].forEach(id=>$(id).onchange=controls);
    ['studyMinus','studyPlus'].forEach(id=>$(id).onclick=()=>{$('studyNotes').value=Math.max(1,Math.min(15,(Number($('studyNotes').value)||1)+(id==='studyPlus'?1:-1)));});
    $('studyLaunch').onclick=()=>{
      const notes=Number($('studyNotes').value);let error='';
      if(!Number.isInteger(notes)||notes<1||notes>15)error='音符数须为1～15的整数。';
      if($('studyClef').value==='dual'&&notes<2)error='双谱表至少需要2个音，上下合计。';
      if($('studyClef').value==='dual'&&$('studyDual').value==='sustain'&&notes<3)error='低音长音配合至少需要3个音。';
      $('studySettingsError').textContent=error;$('studySettingsError').hidden=!error;if(error)return;
      const settings={course:$('studyCourse').value,clef:$('studyClef').value,difficulty:$('studyDifficulty').value,notes,pattern:$('studyPattern').value,rhythm:Number($('studyRhythm').value),dual:$('studyDual').value,flow:$('studyFlow').value,tempo:Number($('studyTempo').value),metronome:$('studyMetro').checked};
      data().settings={...s,...settings};H.save();launch('phrase',settings);
    };$('readingFree').onclick=classic;
  }
  function confirmLaunch(fn) {
    if(window.PianoSongs?.beforeOtherTraining?.(fn))return;
    if(window.PianoFoundation?.isActive()){window.PianoFoundation.stopForStudy(()=>confirmLaunch(fn));return;}
    if(window.PianoRhythm?.isActive()){window.PianoRhythm.stopForStudy(()=>confirmLaunch(fn));return;}
    window.PianoRhythm?.leaveView();
    if(H.classicActive()){H.showPage('practice');H.notice('请先结束当前自由练习，再开始专项或短句。');return;}
    if(lesson?.active){pause();H.confirm('结束当前训练并开始新训练？','已经完成的音会保存，尚未轮到的音不计错。',()=>{finish(false,false);fn();});return;}
    fn();
  }
  function launch(kind,options={}) {
    confirmLaunch(()=>{
      const settings={...data().settings,...options,input:kind==='reverse'?'touch':source(),helperOrigin:options.helperOrigin||null,foundationAttempt:kind==='phrase'&&typeof FoundationCore!=='undefined'?FoundationCore.normalizeAttempt(options.foundationAttempt):null,focusKeys:Array.isArray(options.focusKeys)?options.focusKeys.slice(0,3):[],focusReason:options.focusReason||''};if(kind!=='phrase')settings.flow='guided';
      const progressive=settings.course!=='free'&&['anchors','contrast','ledger','reverse'].includes(kind);
      let groups=[],totalBeats=0,clefs,courseSession=null,courseInfo=null,phraseCourse=null,phraseReview=null;
      if(progressive){
        if(settings.clef==='dual')settings.clef='treble';
        courseInfo=focusedInfo(kind,settings.clef);courseSession=LCore.start(learning(),kind,settings.clef,settings.input,options.count||settings.count||20);
        const item=LCore.next(courseSession);if(!item){LCore.finish(learning(),courseSession,true);H.save();return launch(kind,options);}
        const t=LCore.target(item.key);groups=[{targets:[t],beat:0,duration:1,rest:false,voices:[{targets:[t],duration:1}],retrieval:item,introduction:!LCore.evidence(learning(),t,LCore.taskFor(kind),settings.input)?.samples.length}];clefs=[courseInfo.unit.clef];
      }else if(kind==='phrase'){
        let p;
        if(settings.course!=='free'){
          if(!['treble','bass'].includes(settings.clef)){H.notice('循序短句先使用单谱表；双谱表可选自由短句。');return;}
          phraseCourse=LCore.phraseInfo(learning(),settings.clef,settings.input);
          if(!phraseCourse.unlocked){H.notice('请先在音高专项中把 '+phraseCourse.notes.join(' / ')+' 各无提示认对至少4次。');return;}
          settings.notes=6;settings.tempo=50;settings.flow=phraseCourse.state.phase<2?'guided':'continuous';settings.rhythm=1;
          p=LCore.phraseExercise(learning(),settings.clef,settings.input);
        }else p=options.exercise?JSON.parse(JSON.stringify(options.exercise)):S.phrase(settings,data());
        groups=p.events;totalBeats=p.totalBeats;clefs=p.clefs;
      }else if(kind==='review'){
        const due=reviewDue();if(!due.length){H.notice('当前输入方式暂无到期复习。');return;}
        if(due[0].task==='phrase'){
          phraseReview=due[0];const t=phraseReview.target;settings.clef=t.clef;settings.flow='continuous';settings.tempo=50;
          const known=LCore.known(learning(),t.clef,settings.input),other=known.find(n=>n.note.midi!==t.note.midi)||t;
          groups=[t,other,t,other,t,other].map((n,i)=>({targets:[n],beat:i,duration:1,rest:false,voices:[{targets:[n],duration:1}]}));groups.push({targets:[],beat:6,duration:2,rest:true,voices:[]});totalBeats=8;clefs=[t.clef];
        }else{
          for(let pass=0;pass<2;pass++)for(const item of due.filter(x=>x.task!=='phrase').slice(0,30)){
            const t=item.target;groups.push({targets:[t],beat:0,duration:1,rest:false,voices:[{targets:[t],duration:1}],review:{key:item.key,task:item.task,confirmed:pass===1}});
          }
          if(groups.length===2){
            const t=groups[0].targets[0],known=LCore.known(learning(),t.clef,settings.input).filter(x=>x.note.midi!==t.note.midi),fill=known.length?known:[t];
            const intervening=Array.from({length:3},(_,n)=>{const v=fill[n%fill.length];return {targets:[v],beat:0,duration:1,rest:false,voices:[{targets:[v],duration:1}],reviewFiller:true};});groups.splice(1,0,...intervening);
          }
          clefs=[...new Set(groups.map(g=>g.targets[0].clef))];
        }
      }else if(kind==='rhythm'){const r=S.rhythmEvents(settings.rhythm,2);groups=r.events;totalBeats=r.totalBeats;clefs=['treble'];}
      else {const focus=(Array.isArray(options.focusKeys)?options.focusKeys:[]).filter(k=>/^(treble|bass):[A-G][2-6]$/.test(k)).slice(0,3),ts=focus.length?Array.from({length:10},(_,i)=>LCore.target(focus[(i+Math.floor(i/focus.length))%focus.length])):S.topicTargets(kind,settings.clef,data(),Math.random,options.count||settings.count||20,settings.difficulty);groups=ts.map(t=>({targets:[t],beat:0,duration:1,rest:false,voices:[{targets:[t],duration:1}]}));clefs=C.clefsFor(settings.clef);}
      data().settings={...data().settings,...settings,exercise:undefined,helperOrigin:undefined};H.save();
      cancelAdvance();heldPointers.clear();lastInput=0;
      lesson={active:true,kind,settings,groups,totalBeats,clefs,courseSession,courseInfo,phraseCourse,phraseReview,reviewFirst:{},index:0,slots:[],answers:[],presses:[],hint:false,started:performance.now(),groupStart:performance.now(),state:'guided',elapsed:0,pausedGroup:false,keyboardFull:typeof options.keyboardFull==='boolean'?options.keyboardFull:H.getDB().fullKeyboard,at:Date.now(),totalTargets:courseSession?courseSession.plan.length:groups.reduce((n,g)=>n+g.targets.length,0)};
      resetSlots();window.PianoInput?.apply(true);H.showPage('studyLesson');if(settings.flow!=='guided')startClock();
    });
  }
  function resetSlots(){const g=lesson.groups[lesson.index];lesson.slots=g?g.targets.map(t=>({target:t,firstCorrect:null,firstMidi:null,firstMs:null,completed:false,committed:false,hint:false,hintLevel:0})):[];lesson.groupStart=performance.now();lesson.hint=false;lesson.hintDisplay=0;lesson.pausedGroup=false;const restored=lesson.courseSession?.current?.hintLevel||0;if(restored){lesson.hint=true;lesson.slots.forEach(x=>{x.hint=true;x.hintLevel=restored;});}}
  function restSymbol(d,x,y,color) {
    if(d>=4)y-=16;const key=d>=4?'rest4':d>=2?'rest2':d>=1?'rest1':'rest05';
    return `<path d="${G[key].path}" transform="translate(${x} ${y}) scale(.064 -.064)" fill="${color}"/>`;
  }
  function noteShape(t,duration,x,bottom,color,active=false,attrs='') {
    const d=t.note.index-C.parse(t.clef==='treble'?'E4':'G2').index,y=bottom-d*8,down=d>=4,sx=x+(down?-9:9),stemEnd=y+(down?52:-52);let h='';
    if(active)h+=`<circle cx="${x}" cy="${y}" r="21" fill="#dceee7"/>`;
    C.ledgerOffsets(d).forEach(k=>h+=`<line x1="${x-18}" x2="${x+18}" y1="${bottom-k*8}" y2="${bottom-k*8}" stroke="${color}" stroke-width="1.5"/>`);
    h+=`<ellipse ${attrs} cx="${x}" cy="${y}" rx="${duration>=4?13:10}" ry="7" transform="rotate(${duration>=4?0:-20} ${x} ${y})" fill="${duration>=2?'white':color}" stroke="${color}" stroke-width="${duration>=2?2.2:1}"/>`;
    if(duration<4)h+=`<line x1="${sx}" x2="${sx}" y1="${y}" y2="${stemEnd}" stroke="${color}" stroke-width="2"/>`;
    if(duration===.5)h+=`<path d="${G[down?'flagDown':'flagUp'].path}" transform="translate(${sx} ${stemEnd}) scale(.064 -.064)" fill="${color}"/>`;
    return h;
  }
  function staff(c,bottom,end=1070) {
    let h='';for(let i=0;i<5;i++)h+=`<line x1="65" x2="${end}" y1="${bottom-i*16}" y2="${bottom-i*16}" stroke="#76877e" stroke-width="1"/>`;
    h+=`<path d="${G[c].path}" transform="translate(78 ${bottom-(c==='treble'?16:48)}) scale(.064 -.064)" fill="#22352f"/>`;return h;
  }
  function singleScore(t,reverse=false) {
    if(window.PianoTabletNotation){
      let choices=null;if(reverse){const group=lesson.groups[lesson.index],pool=lesson.courseSession?[C.fromIndex(t.note.index-1),t.note,C.fromIndex(t.note.index+1)]:C.pool(lesson.settings.difficulty||'basic',t.clef);if(!group.choices)group.choices=C.shuffle([t.note,...C.shuffle(pool.filter(n=>n.index!==t.note.index)).slice(0,lesson.courseSession?2:6)]);choices=group.choices;}
      return PianoTabletNotation.single(t,{choices});
    }
    const bottom=167,width=reverse?1100:innerWidth<700?520:680;let h=staff(t.clef,bottom,width-30);
    if(!reverse)h+=noteShape(t,1,width*.57,bottom,'#22352f',true,`data-target="${t.note.midi}"`);
    if(reverse){
      const g=lesson.groups[lesson.index],pool=lesson.courseSession?[C.fromIndex(t.note.index-1),t.note,C.fromIndex(t.note.index+1)]:C.pool(lesson.settings.difficulty||'basic',t.clef);
      if(!g.choices)g.choices=C.shuffle([t.note,...C.shuffle(pool.filter(n=>n.index!==t.note.index)).slice(0,lesson.courseSession?2:6)]);
      g.choices.forEach((n,i)=>{const x=g.choices.length<=3?390+i*180:210+i*135;
        h+=`<g data-position="${n.midi}" role="button" tabindex="0" aria-label="候选音 ${C.location(t.clef,n)}"><rect x="${x-50}" y="16" width="100" height="210" rx="8" fill="transparent"/>${noteShape({clef:t.clef,note:n},1,x,bottom,'#22352f')}</g>`;});
    }
    return `<svg class="${reverse?'reverse-score':'single-note-score'}" viewBox="0 0 ${width} 245" role="img" aria-label="${reverse?'选择与琴键音高对应的谱面位置':'识别五线谱音符'}">${h}</svg>`;
  }
  function phraseScore() {
    if(window.PianoTabletNotation)return PianoTabletNotation.phrase(lesson);
    const L=lesson,dual=L.clefs.length>1,rows=Math.ceil(L.totalBeats/8),wide=L.settings.difficulty==='extended',height=dual?(wide?440:340):(wide?270:230);let html='';
    for(let row=0;row<rows;row++){
      const start=row*8,end=Math.min(L.totalBeats,start+8),bottoms={treble:dual?(wide?175:116):(wide?175:155),bass:dual?(wide?385:275):(wide?175:155)};let svg='';
      if(dual)svg+=`<path d="${G.brace.path}" transform="translate(46 ${bottoms.bass}) scale(.12 -${(bottoms.bass-bottoms.treble+64)/1000})" fill="#22352f"/><line x1="64" x2="64" y1="${bottoms.treble-64}" y2="${bottoms.bass}" stroke="#76877e"/>`;
      L.clefs.forEach(c=>{svg+=staff(c,bottoms[c]);svg+=`<text x="126" y="${bottoms[c]-38}" font-size="23" fill="#22352f">4</text><text x="126" y="${bottoms[c]-15}" font-size="23" fill="#22352f">4</text>`;});
      const xFor=beat=>185+(beat-start)*105;
      for(let beat=start;beat<=end;beat+=4){const x=beat===start?165:xFor(beat)-29;svg+=`<line x1="${x}" x2="${x}" y1="${bottoms[L.clefs[0]]-64}" y2="${bottoms[L.clefs[L.clefs.length-1]]}" stroke="#7b8c83" stroke-width="1.3"/>`;if(beat<end)svg+=`<text x="${x+15}" y="22" font-size="15" fill="#718079">第${Math.floor(beat/4)+1}小节</text>`;}
      L.groups.forEach((e,i)=>{
        if(e.beat<start||e.beat>=end)return;const x=xFor(e.beat),active=L.settings.flow==='guided'&&i===L.index,color=i<L.index&&L.settings.flow==='guided'?'#8d9f95':'#22352f';
        svg+=`<g data-event="${i}" data-beat="${e.beat}">`;
        L.clefs.forEach(c=>{
          const ts=e.targets.filter(t=>t.clef===c),voices=e.voices||[];
          if(ts.length)ts.forEach(t=>{const v=voices.find(v=>v.targets.some(a=>a.clef===c));svg+=noteShape(t,v?v.duration:e.duration,x,bottoms[c],color,active,`data-target="${t.note.midi}"`);});
          else {
            const sustained=L.groups.slice(0,i).some(p=>p.beat<e.beat && (p.voices||[]).some(v=>v.targets.some(t=>t.clef===c)&&p.beat+v.duration>e.beat));
            if(!sustained)svg+=restSymbol(e.duration,x,bottoms[c]-32,color);
          }
        });svg+='</g>';
      });
      const cursor=L.clockBeat!==undefined&&L.clockBeat>=start&&L.clockBeat<end?xFor(L.clockBeat):null;
      svg+=`<line class="score-cursor" x1="${cursor===null?185:cursor}" x2="${cursor===null?185:cursor}" y1="35" y2="${height-24}" stroke="#27675f" stroke-width="2" ${cursor===null?'visibility="hidden"':''}/>`;
      html+=`<div class="phrase-row" data-start-beat="${start}" data-end-beat="${end}"><svg viewBox="0 0 1100 ${height}" role="img" aria-label="4/4拍短句${dual?'双谱表':''}">${svg}</svg></div>`;
    }return html;
  }
  function rhythmScore() {
    const L=lesson;let svg=staff('treble',155);svg+=`<text x="125" y="117" font-size="23">4</text><text x="125" y="139" font-size="23">4</text>`;
    L.groups.forEach((e,i)=>{const x=180+e.beat*104;svg+=`<g data-event="${i}" data-beat="${e.beat}">${e.rest?restSymbol(e.duration,x,123,'#22352f'):noteShape({clef:'treble',note:C.parse('C5')},e.duration,x,155,'#22352f')}</g>`;});
    [0,4,8].forEach(b=>svg+=`<line x1="${b?180+b*104-27:160}" x2="${b?180+b*104-27:160}" y1="91" y2="155" stroke="#76877e"/>`);
    svg+=`<line class="score-cursor" x1="180" x2="180" y1="35" y2="185" stroke="#27675f" stroke-width="2" visibility="hidden"/>`;
    return `<div class="phrase-row" data-start-beat="0" data-end-beat="8"><svg viewBox="0 0 1100 225" role="img" aria-label="两小节节奏谱">${svg}</svg></div>`;
  }
  function renderLesson() {
    const L=lesson;if(!L)return;
    const guided=L.settings.flow==='guided',reverse=L.kind==='reverse'||L.groups[L.index]?.review?.task==='staff',rhythm=L.kind==='rhythm';
    $('studyLesson').innerHTML=`<div class="lesson-top"><button id="lessonBack" aria-label="打开导航">‹</button><div><h2>${names[L.kind]}</h2><p id="lessonStatus"></p></div><span id="lessonCounter"></span><div class="actions"><button id="lessonFinish">结束</button><button id="lessonPause">${L.state==='paused'?'继续':'暂停'}</button></div></div><div class="lesson-track"><div id="lessonFill"></div></div><div class="lesson-reading"><div id="lessonStage" class="lesson-stage"></div><div class="lesson-caption"><span id="lessonCaption"></span><button id="lessonHint" ${rhythm?'hidden':''}>${guided?'帮助我记住':'转入提示练习'}</button></div></div>
      ${rhythm?'<div class="rhythm-controls"><button id="rhythmTap" class="primary">按谱点击拍子</button><p>音符起点点击一次；休止符处不点。当前评估起拍时间，不评估按住时长。</p></div>':'<section class="study-keyboard-area"><div class="study-keyboard-toolbar"><span id="lessonKeyPrompt">点击琴键作答</span><div><button id="lessonLocal">局部键盘</button><button id="lessonFull">88键</button><button id="lessonSound">声音</button></div></div><div id="lessonKeyScroll" class="keyboard-scroll"><div id="lessonKeys" class="keyboard"></div></div></section>'}
      <div class="lesson-footer"><p id="lessonFeedback" role="status"></p><button id="lessonTools" aria-label="键盘、声音与输入设置" aria-expanded="false">•••</button><button id="lessonNext" hidden class="primary">下一题</button></div><div id="lessonPauseCover" class="lesson-pause-cover" ${L.state==='paused'?'':'hidden'}><h3>训练已暂停</h3><p>计时已停止，回来后手动继续。</p><button id="coverResume" class="primary">继续训练</button></div>`;
    $('lessonBack').onclick=()=>window.PianoTablet?.openNavigation();$('lessonTools').onclick=()=>{const opened=document.body.classList.toggle('task-tools-open');$('lessonTools').setAttribute('aria-expanded',String(opened));};if(!rhythm){$('studyLesson').querySelector('.lesson-footer').appendChild($('lessonHint'));const toolbar=$('studyLesson').querySelector('.study-keyboard-toolbar');$('studyLesson').appendChild(toolbar);const tools=toolbar.querySelector('div');const inputButton=document.createElement('button');inputButton.textContent='输入设置';inputButton.onclick=()=>window.PianoInput?.open();tools.appendChild(inputButton);const endButton=document.createElement('button');endButton.textContent='结束本轮';endButton.onclick=()=>$('lessonFinish').click();tools.appendChild(endButton);} $('lessonFinish').onclick=()=>{pause();H.confirm('结束这次训练？','已经完成的音会保存，尚未轮到的音不计错。',()=>finish(false));};
    $('lessonPause').onclick=()=>L.state==='paused'?resume():pause();$('coverResume').onclick=resume;
    $('lessonNext').onclick=advance;$('lessonHint').onclick=hint;
    if(rhythm){$('rhythmTap').addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();press(60);});$('rhythmTap').addEventListener('click',e=>{if(e.detail===0)press(60);});}
    else{keyboard();$('lessonLocal').onclick=()=>{L.keyboardChanged=L.keyboardChanged||L.keyboardFull;L.keyboardFull=false;H.getDB().fullKeyboard=false;H.save();keyboard();};$('lessonFull').onclick=()=>{L.keyboardChanged=L.keyboardChanged||!L.keyboardFull;L.keyboardFull=true;H.getDB().fullKeyboard=true;H.save();keyboard();};$('lessonSound').onclick=()=>{H.getDB().sound=!H.getDB().sound;H.save();$('lessonSound').textContent='声音：'+(H.getDB().sound?'开':'关');};}
    renderQuestion();
    if(L.settings.focusKeys?.length)$('studyLesson').querySelector('.lesson-top h2').textContent='针对练习 · 固定音组认音';
    if(!guided && L.state!=='paused'){$('lessonCaption').textContent=clockInstruction();$('lessonFeedback').textContent=clockInstruction();}
  }
  function renderQuestion(reflow=false) {
    const L=lesson,g=L.groups[L.index];if(!g)return;
    $('lessonStage').innerHTML=L.kind==='rhythm'?rhythmScore():L.kind==='phrase'||L.phraseReview?phraseScore():singleScore(g.targets[0],L.kind==='reverse'||g.review?.task==='staff');
    $('lessonHint').hidden=L.kind==='rhythm'||g.rest;
    if(L.kind==='reverse'||g.review?.task==='staff'){
      $('lessonStage').querySelectorAll('[data-position]').forEach(p=>{const act=()=>press(Number(p.dataset.position));p.onclick=act;p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}};});
      $('lessonFeedback').textContent='看高亮琴键，在谱上选择对应音符。';$('lessonCaption').textContent='看下方高亮琴键，在'+(g.targets[0].clef==='treble'?'高音':'低音')+'谱表的候选音中点对应音符。';$('lessonKeyPrompt').textContent=C.label(g.targets[0].note)+' · 点击琴键可听音';
      $('lessonKeys').querySelectorAll('[data-midi]').forEach(k=>k.classList.toggle('target-key',Number(k.dataset.midi)===g.targets[0].note.midi));
      const key=$('lessonKeys').querySelector(`[data-midi="${g.targets[0].note.midi}"]`);if(key)key.scrollIntoView({block:'nearest',inline:'center'});
    } else if(L.settings.flow==='guided') {
      $('lessonCaption').textContent=g.rest?'这是休止符，留出'+g.duration+'拍空白。':'当前'+(g.targets.length===2?'同一时刻的两个音，可以分别点准。':(g.targets[0].clef==='treble'?'高音谱表':'低音谱表'))+' · 先认准位置';
      if(g.rest){$('lessonNext').hidden=false;$('lessonNext').textContent='读过休止，继续';}
    }
    $('lessonStatus').textContent=L.settings.flow==='guided'?`学习模式 · ${Math.min(L.answers.length+1,L.totalTargets)} / ${L.totalTargets} 个音`:(L.settings.flow==='assessment'?'无提示测评':'连续训练')+' · '+L.settings.tempo+' BPM';
    if(L.settings.flow==='guided')$('lessonFill').style.width=(L.answers.length/Math.max(1,L.totalTargets)*100)+'%';
    if(L.courseSession?.current){
      const session=L.courseSession,item=session.current,u=L.courseInfo.unit,stat=LCore.summary(session);
      const mode=item.type==='retest'?'隔题回测':g.introduction?'认识本组':'无提示巩固';
      if(g.introduction&&L.kind!=='reverse'){
        if(!reflow)markAutomaticCue(3);$('lessonCaption').textContent='首次认识 · 对照参照位置，再找到琴键；稍后会无提示回测。';
      }else if(L.kind!=='reverse')$('lessonCaption').textContent=mode+' · 先独立认音，需要时再打开帮助。';
      $('lessonStatus').textContent=`单元 ${L.courseInfo.index+1}/${L.courseInfo.total} · ${mode} · 已完成 ${session.done} / ${stat.planned}计划题 · 加练 ${session.extra}/${LCore.MAX_EXTRA}`;
      $('lessonFill').style.width=Math.min(100,session.done/(stat.planned+session.extra)*100)+'%';
    }else if(L.phraseCourse){$('lessonStatus').textContent='短句单元 '+(L.phraseCourse.state.unit+1)+' · '+L.phraseCourse.labels[L.phraseCourse.state.phase];if(L.phraseCourse.state.phase===0&&L.state==='guided'){if(!reflow)markAutomaticCue(3);$('lessonCaption').textContent='认识这一句 · 看参照与走向；下一阶段同句无提示。';}}
    if(L.phraseReview)$('lessonStatus').textContent='到期复习 · 短句音高 · 在短句中确认 '+C.short(L.phraseReview.target.note);
    if(g.reviewFiller)$('lessonStatus').textContent='复习间隔 · 插入已学内容，再检查刚才的目标';
    if(g.review)$('lessonStatus').textContent='到期复习 · '+({keyboard:'看谱弹琴',staff:'琴键到谱面',phrase:'短句音高'}[g.review.task])+' · '+(g.review.confirmed?'第二次无提示确认':'第一次检查')+' · '+(L.index+1)+' / '+L.groups.length;
    if($('lessonCounter')){const session=L.courseSession,stat=session?LCore.summary(session):null;$('lessonCounter').textContent=session?`${session.done+1} / ${stat.planned+session.extra}`:`${L.index+1} / ${L.groups.length}`;$('lessonCounter').title=$('lessonStatus').textContent;}if(L.kind!=='rhythm'){$('lessonHint').textContent='提示';$('lessonHint').setAttribute('aria-label',L.settings.flow==='guided'?'记忆提示':'转入提示练习');}renderLessonHint();window.PianoInput?.sync();window.PianoInput?.autoContinue();
    if(L.kind==='phrase'&&L.settings.flow==='guided'){
      const row=$('lessonStage').querySelector(`[data-event="${L.index}"]`)?.closest('.phrase-row');if(row)row.scrollIntoView({block:'nearest'});
    }
  }
  let menuPreview=null;
  function previewNavigation(open){const L=lesson;if(open){if(!L?.active||L.settings.flow!=='guided'||L.state!=='guided'||heldPointers.size)return false;cancelAdvance();menuPreview={lesson:L,elapsed:performance.now()-L.groupStart};L.state='menu-preview';return true;}if(menuPreview){if(lesson===menuPreview.lesson&&L.active&&currentPage==='studyLesson'){L.state='guided';L.groupStart=performance.now()-menuPreview.elapsed;if(groupComplete()){lastInput=performance.now();autoContinue();}}menuPreview=null;}return false;}
  function keyboard() {
    const L=lesson;if(!$('lessonKeys'))return;let lo=48,hi=83;
    if(L.kind==='ledger'){lo=36;hi=95;}else if(L.kind==='phrase'){lo=L.clefs.includes('bass')?48:60;hi=L.clefs.includes('treble')?83:71;}else if(L.settings.clef==='treble'){lo=60;hi=95;}else if(L.settings.clef==='bass'){lo=36;hi=71;}
    const expected=L.groups.flatMap(g=>g.targets.map(t=>t.note.midi));if(expected.length){lo=Math.min(lo,...expected);hi=Math.max(hi,...expected);}
    if(!L.keyboardFull&&expected.length){const pool=L.courseInfo?.unit?.keys?.map(k=>LCore.target(k)?.note.midi).filter(Number.isFinite)||expected;lo=Math.floor(Math.min(...pool)/12)*12;hi=Math.ceil(Math.max(...pool)/12)*12;hi=Math.max(hi,lo+23);lo=Math.max(21,lo);hi=Math.min(108,hi);}
    if(L.keyboardFull){lo=21;hi=108;}
    const black=m=>[1,3,6,8,10].includes(m%12),n=Array.from({length:hi-lo+1},(_,i)=>lo+i).filter(m=>!black(m)).length;let whites='',blacks='',w=0;
    for(let m=lo;m<=hi;m++){if(black(m))blacks+=`<button data-midi="${m}" class="key black" aria-label="${C.midiName(m)}" style="left:${w/n*100}%;width:${.62/n*100}%"></button>`;else{whites+=`<button data-midi="${m}" class="key white" aria-label="${C.midiName(m)}">${m%12===0?`<span class="c-label">${C.midiName(m)}</span>`:''}</button>`;w++;}}
    $('lessonKeys').innerHTML=whites+blacks;$('lessonKeys').style.minWidth=n*(L.keyboardFull?48:32)+'px';$('lessonKeyScroll').scrollLeft=0;$('lessonLocal').classList.toggle('selected',!L.keyboardFull);$('lessonFull').classList.toggle('selected',L.keyboardFull);$('lessonSound').textContent='声音：'+(H.getDB().sound?'开':'关');
    const prompt=$('lessonKeyPrompt'),scroll=$('lessonKeyScroll');prompt.innerHTML='<span>'+C.midiName(lo)+'–'+C.midiName(hi)+'</span><button id="lessonKeysLeft" aria-label="键盘向低音区移动">‹</button><button id="lessonKeysRight" aria-label="键盘向高音区移动">›</button><small id="lessonKeySwipe">左右滑动</small>';
    const syncRange=()=>{if(lesson!==L||!scroll.isConnected||!$('lessonKeysLeft'))return;const overflow=scroll.scrollWidth>scroll.clientWidth+2;$('lessonKeysLeft').hidden=$('lessonKeysRight').hidden=$('lessonKeySwipe').hidden=!overflow;$('lessonKeysLeft').disabled=scroll.scrollLeft<=1;$('lessonKeysRight').disabled=scroll.scrollLeft>=scroll.scrollWidth-scroll.clientWidth-1;};
    $('lessonKeysLeft').onclick=()=>scroll.scrollBy({left:-scroll.clientWidth*.65,behavior:'smooth'});$('lessonKeysRight').onclick=()=>scroll.scrollBy({left:scroll.clientWidth*.65,behavior:'smooth'});scroll.onscroll=syncRange;requestAnimationFrame(syncRange);
    const container=$('lessonKeys');
    container.onpointerdown=e=>{const k=e.target.closest('[data-midi]');if(!k||e.button>0||L.state==='paused')return;
      if(e.pointerType==='touch'&&L.settings.flow==='guided'){keyboardDown.set(e.pointerId,{key:k,x:e.clientX,y:e.clientY});return;}
      e.preventDefault();activateKey(k);
    };
    container.onpointerup=e=>{const p=keyboardDown.get(e.pointerId);if(!p)return;keyboardDown.delete(e.pointerId);if(Math.hypot(p.x-e.clientX,p.y-e.clientY)>10)return;e.preventDefault();activateKey(p.key);};
    container.onpointercancel=e=>keyboardDown.delete(e.pointerId);
    container.onclick=e=>{const k=e.target.closest('[data-midi]');if(k&&e.detail===0)activateKey(k);};
    if(L.kind==='reverse'||L.groups[L.index]?.review?.task==='staff')renderReverseKey();else if(L.keyboardFull)requestAnimationFrame(()=>{const center=$('lessonKeys')?.querySelector('[data-midi="60"]'),scroll=$('lessonKeyScroll');if(center&&scroll)scroll.scrollLeft=Math.max(0,center.offsetLeft-scroll.clientWidth/2);});
  }
  function renderReverseKey(){const t=lesson.groups[lesson.index]?.targets[0];if(t)$('lessonKeys').querySelectorAll('[data-midi]').forEach(k=>k.classList.toggle('target-key',Number(k.dataset.midi)===t.note.midi));}
  function activateKey(k){if(lesson.kind!=='reverse'&&lesson.groups[lesson.index]?.review?.task!=='staff'&&window.PianoInput&&!window.PianoInput.touchAllowed())return;if(lesson.state==='paused'||H.modalOpen())return;const midi=Number(k.dataset.midi);H.play(midi);k.classList.add('pressed');setTimeout(()=>k.classList.remove('pressed'),160);if(lesson.kind!=='reverse'&&lesson.groups[lesson.index]?.review?.task!=='staff')press(midi);}
  function markAutomaticCue(level){
    lesson.hint=true;lesson.hintDisplay=level;
    lesson.slots.filter(x=>!x.committed).forEach(x=>{x.hint=true;x.hintLevel=Math.max(x.hintLevel||0,level);});
    if(lesson.courseSession?.current)lesson.courseSession.current.hintLevel=level;
    H.save();
  }
  function renderLessonHint(){
    const L=lesson,slot=L.slots.find(x=>!x.completed);if(!$('lessonStage'))return;
    let host=$('lessonMemory');if(!host){host=document.createElement('div');host.id='lessonMemory';host.className='memory-host';$('lessonStage').after(host);}
    const level=slot&&L.state==='guided'?L.hintDisplay||0:0;
    $('studyLesson').querySelector('.lesson-reading')?.classList.toggle('has-memory',!!level);
    if(!slot){host.hidden=true;host.innerHTML='';window.PianoTabletNotation?.memory(host,null,0);return;}
    const previous=L.index>0?L.groups[L.index-1]?.targets.find(t=>t.clef===slot.target.clef&&L.answers.some(a=>a.event===L.index-1&&a.expected===t.note.midi&&a.correct)):null;
    PianoHints.render(host,{target:slot.target,level,previous:L.kind==='phrase'?previous:null,reference:L.courseInfo?.unit.reference,known:LCore.known(learning(),slot.target.clef,L.settings.input),review:L.kind==='review',onLevel:setLessonHintLevel});
  }
  function setLessonHintLevel(level){
    const L=lesson;if(!L?.active||L.state!=='guided')return;
    const slot=L.slots.find(x=>!x.completed);if(!slot)return;
    L.hintDisplay=level;
    if(level){L.hint=true;slot.hint=true;slot.hintLevel=Math.max(slot.hintLevel||0,level);if(L.courseSession?.current)L.courseSession.current.hintLevel=Math.max(L.courseSession.current.hintLevel||0,level);H.save();}
    renderLessonHint();
  }
  function hint(){
    const L=lesson;if(!L?.active||L.state==='paused')return;
    if(L.settings.flow!=='guided'){
      const exercise={events:L.groups,totalBeats:L.totalBeats,clefs:L.clefs},origin={kind:L.kind,settings:{...L.settings}};
      finish(false,false);
      launch('phrase',{...origin.settings,course:'free',flow:'guided',exercise,helperOrigin:origin});
      if(lesson?.active){setLessonHintLevel(1);$('lessonCaption').textContent='辅助短句学习 · 结束后返回原训练，无提示检查。';}
      return;
    }
    setLessonHintLevel((L.hintDisplay||0)>=3?3:(L.hintDisplay||0)+1);
  }
  function press(midi,eventAt=performance.now(),source='touch') {
    const L=lesson;if(!L?.active||L.state==='paused'||H.modalOpen()||currentPage!=='studyLesson')return;
    if(L.settings.flow==='guided')inputActivity();
    if(L.settings.flow!=='guided'){
      const ms=clockElapsed()-(performance.now()-eventAt)-4000*60/L.settings.tempo;if(ms<0){$('lessonFeedback').textContent='先听预备四拍，谱面开始后再作答。';return;}
      if(ms>=L.totalBeats*60000/L.settings.tempo)return;
      L.presses.push({midi,ms});$('lessonFeedback').textContent='已记录按键，保持拍子继续。';return;
    }
    const g=L.groups[L.index];if(!g||g.rest||L.slots.every(x=>x.completed))return;
    let slot=L.slots.find(x=>!x.completed&&x.target.note.midi===midi);
    if(!slot)slot=L.slots.filter(x=>!x.completed).sort((a,b)=>Math.abs(a.target.note.midi-midi)-Math.abs(b.target.note.midi-midi))[0];
    const ok=slot.target.note.midi===midi;
    if(slot.firstCorrect===null){slot.firstCorrect=ok;slot.firstMidi=midi;slot.firstMs=Math.max(0,eventAt-L.groupStart);slot.source=source;}
    if(!ok){$('lessonFeedback').className='bad';$('lessonFeedback').textContent=source==='midi'?MidiCore.feedback(slot.target.note.midi,midi):'还没找对，检查谱号、位置与八度。';return;}
    slot.completed=true;commitSlot(slot);if(!L.slots.every(x=>x.completed)){L.hintDisplay=L.phraseCourse?.state.phase===0?3:0;}renderLessonHint();
    $('lessonFeedback').className='good';$('lessonFeedback').textContent=L.slots.every(x=>x.completed)?'本组完成。':'这个音已完成，再找同一时刻的另一个音。';
    if(L.slots.every(x=>x.completed)){
      H.save();$('lessonStatus').textContent=L.courseSession?'单元 '+(L.courseInfo.index+1)+' · 已完成 '+L.courseSession.done+'题 · '+L.courseSession.retries.length+'项待回测':'学习模式 · 已完成 '+L.answers.length+' / '+L.totalTargets+' 个音';$('lessonFill').style.width=L.answers.length/L.totalTargets*100+'%';$('lessonStage').querySelectorAll('[data-event="'+L.index+'"] circle').forEach(c=>c.remove());
      $('lessonHint').hidden=true;$('lessonNext').hidden=false;$('lessonNext').textContent=lastGroup()?'立即查看结果':'立即继续';
      $('lessonFeedback').textContent=window.PianoInput?.isMidi()&&window.PianoInput.autoAdvanceEnabled?.()===false?'本组完成 · 松键后点击'+(lastGroup()?'立即查看结果。':'立即继续。'):'本组完成 · 松键后 1 秒无新输入，自动'+(lastGroup()?'显示结果。':'继续。');autoContinue();
      if(L.kind!=='phrase'&&L.kind!=='reverse')$('lessonCaption').textContent=C.label(g.targets[0].note)+' · '+C.location(g.targets[0].clef,g.targets[0].note);
    }
  }
  function commitSlot(x) {
    if(x.committed)return;x.committed=true;const L=lesson,g=L.groups[L.index],review=g.review,task=review?.task||(L.kind==='reverse'?'staff':L.kind==='phrase'?'phrase':'keyboard'),clean=!!x.firstCorrect&&!x.hint&&!L.pausedGroup;
    L.answers.push({expected:x.target.note.midi,clef:x.target.clef,actual:x.firstMidi,correct:!!x.firstCorrect,ms:L.pausedGroup||x.hint?null:x.firstMs,delta:null,hint:!!x.hint,hintLevel:x.hintLevel||0,event:L.index});
    const result={reached:true,firstCorrect:x.firstCorrect,firstMidi:x.firstMidi,firstMs:x.firstMs,paused:L.pausedGroup,hint:!!x.hint,hintLevel:x.hintLevel||0,task,input:L.settings.input,context:L.kind+':'+(x.source==='midi'?'midi':L.keyboardFull?'88':'local'),session:L.courseSession?.id||String(L.at),position:L.index,retest:g.retrieval?.type==='retest',review:!!review,confirmed:!!review?.confirmed&&L.reviewFirst[review.key]===true};
    if(review&&!review.confirmed)L.reviewFirst[review.key]=clean;
    S.observeNote(data(),x.target,result);
    if(L.courseSession&&L.slots.every(s=>s.committed))LCore.record(L.courseSession,{correct:L.slots.every(s=>s.firstCorrect),hint:L.hint,paused:L.pausedGroup});
    H.save();
  }
  function advance(){
    const L=lesson;if(!L?.active||L.state==='paused')return;
    if(!L.groups[L.index]?.rest&&!groupComplete())return;
    if(inputHeld()){$('lessonFeedback').textContent='请先松开琴键，再继续。';return;}
    cancelAdvance();lastInput=0;
    if(L.courseSession){const item=LCore.next(L.courseSession);H.save();if(!item){finish(true);return;}const t=LCore.target(item.key);L.groups.push({targets:[t],beat:0,duration:1,rest:false,voices:[{targets:[t],duration:1}],retrieval:item,introduction:!LCore.evidence(learning(),t,LCore.taskFor(L.kind),L.settings.input)?.samples.length});L.index=L.groups.length-1;}
    else {if(L.index===L.groups.length-1){finish(true);return;}L.index++;}
    resetSlots();$('lessonFeedback').textContent='';$('lessonNext').hidden=true;$('lessonHint').hidden=L.kind==='rhythm';renderQuestion();
  }
  function prepareAudio() {
    try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=audio||new AC();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch(e){/* Timing remains available without audio. */}
  }
  function beep(at,strong) {
    if(!audio||audio.state!=='running')return;
    const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=strong?1200:850;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.18,at+.003);gain.gain.exponentialRampToValueAtTime(.0001,at+.055);oscillator.connect(gain);gain.connect(audio.destination);activeOscillators.add(oscillator);oscillator.start(at);oscillator.stop(at+.06);oscillator.onended=()=>{activeOscillators.delete(oscillator);gain.disconnect();};
  }
  function clockInstruction(){return lesson.kind==='rhythm'?'只在音符起点点击；休止符处不点。':lesson.settings.clef==='dual'&&lesson.settings.dual==='sustain'?'长音只在起点按一次；本版不评估持续按住的时长。':'跟着拍子走，错音结束后复盘；不逐音停下来纠错。';}
  function startClock(){prepareAudio();lesson.state='countin';lesson.elapsed=0;lesson.clockStart=performance.now();lesson.clockBeat=-4;scheduled=0;tick();}
  function clockElapsed(){return lesson.elapsed+(lesson.state==='countin'||lesson.state==='running'?performance.now()-lesson.clockStart:0);}
  function cancelBeats(){activeOscillators.forEach(o=>{try{o.stop();}catch(e){}});activeOscillators.clear();clickTimers.forEach(clearTimeout);clickTimers=[];if(audio&&audio.state==='running')audio.suspend().catch(()=>{});}
  function tick() {
    const L=lesson;if(!L?.active||!['countin','running'].includes(L.state))return;
    const beatMs=60000/L.settings.tempo,elapsed=clockElapsed(),beat=elapsed/beatMs-4;L.clockBeat=beat;
    while(scheduled*beatMs<elapsed+90 && scheduled<L.totalBeats+4){
      if(L.settings.metronome){prepareAudio();if(audio&&audio.state==='running')beep(audio.currentTime+Math.max(0,(scheduled*beatMs-elapsed)/1000),scheduled%4===0);}
      scheduled++;
    }
    if(beat<0){$('lessonStatus').textContent=(L.phraseCourse?L.phraseCourse.labels[L.phraseCourse.state.phase]+' · ':'')+'预备四拍 · '+(Math.floor(beat+4)+1)+' / 4';$('lessonCaption').textContent='准备好，数完四拍开始。';}
    else{L.state='running';$('lessonStatus').textContent=(L.phraseCourse?L.phraseCourse.labels[L.phraseCourse.state.phase]+' · ':'')+(L.settings.flow==='assessment'?'无提示测评':'连续训练')+' · 第'+(Math.floor(beat/4)+1)+'小节 第'+(Math.floor(beat%4)+1)+'拍';$('lessonCaption').textContent=clockInstruction();}
    if($('lessonCounter'))$('lessonCounter').textContent=beat<0?'预备 '+(Math.floor(beat+4)+1)+' / 4':'第 '+(Math.floor(beat/4)+1)+' 小节 · '+(Math.floor(beat%4)+1)+' 拍';$('lessonFill').style.width=Math.max(0,Math.min(100,beat/L.totalBeats*100))+'%';
    $('lessonStage').querySelectorAll('.phrase-row').forEach(row=>{const lo=Number(row.dataset.startBeat),hi=Number(row.dataset.endBeat),cursor=row.querySelector('.score-cursor');const inside=beat>=lo&&beat<hi;cursor.setAttribute('visibility',inside?'visible':'hidden');if(inside){const x=Number(row.dataset.origin|| (L.kind==='rhythm'?180:185))+(beat-lo)*Number(row.dataset.step||(L.kind==='rhythm'?104:105));cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);if(row.offsetTop<$('lessonStage').scrollTop||row.offsetTop+row.offsetHeight>$('lessonStage').scrollTop+$('lessonStage').clientHeight)row.scrollIntoView({block:'nearest'});}});
    if(beat>=L.totalBeats){finish(true);return;}raf=requestAnimationFrame(tick);
  }
  function pause() {
    cancelAdvance();heldPointers.clear();
    if(menuPreview){lesson.state='guided';menuPreview=null;}
    if(!lesson?.active||lesson.state==='paused')return;
    if(lesson.settings.flow!=='guided'){lesson.elapsed=clockElapsed();lesson.previousState=lesson.state;cancelAnimationFrame(raf);cancelBeats();}else lesson.pausedGroup=true;
    lesson.wasPaused=true;lesson.state='paused';keyboardDown.clear();if($('lessonPauseCover')){$('lessonPauseCover').hidden=false;$('lessonPause').textContent='继续';}
  }
  function resume() {
    if(!lesson?.active||lesson.state!=='paused'||document.hidden||currentPage!=='studyLesson')return;
    $('lessonPauseCover').hidden=true;$('lessonPause').textContent='暂停';
    if(lesson.settings.flow==='guided'){lesson.state='guided';lesson.groupStart=performance.now();if(groupComplete()){lastInput=performance.now();autoContinue();}}
    else{lesson.state=lesson.previousState||'countin';lesson.clockStart=performance.now();scheduled=Math.ceil(lesson.elapsed/(60000/lesson.settings.tempo));prepareAudio();tick();}
  }
  function finish(complete=true,display=true) {
    cancelAdvance();heldPointers.clear();lastInput=0;
    const L=lesson;if(!L?.active)return;cancelAnimationFrame(raf);cancelBeats();
    let answers=L.answers,extras=[];
    if(L.settings.flow!=='guided') {
      const elapsed=Math.max(0,clockElapsed()-4*60000/L.settings.tempo),beatMs=60000/L.settings.tempo;
      const visited=complete?L.groups:L.groups.filter(e=>e.beat*beatMs<elapsed);
      const result=S.evaluate(visited,L.presses,beatMs,L.kind);answers=result.answers;extras=result.extras;
      if(L.kind==='phrase'||L.phraseReview)answers.forEach(a=>{const note=C.pool('extended',a.clef).find(n=>n.midi===a.expected);/* Interrupted timing cannot provide clean acquisition or review evidence. */if(note&&!(L.wasPaused&&a.correct))S.observeNote(data(),{clef:a.clef,note},{reached:true,firstCorrect:a.correct,firstMidi:a.actual,firstMs:null,paused:!!L.wasPaused,task:'phrase',input:L.settings.input,review:!!L.phraseReview&&a.expected===L.phraseReview.target.note.midi,confirmed:!!L.phraseReview&&complete&&!L.wasPaused&&!extras.length&&answers.every(x=>x.correct&&x.delta!==null&&Math.abs(x.delta)<=60000/L.settings.tempo*.18),context:'continuous:'+L.settings.tempo+':'+L.settings.input});});
    } else {
      /* A wrong attempt in an unfinished group remains observable; untouched notes remain unseen. */
      L.slots.filter(x=>x.firstCorrect!==null&&!x.committed).forEach(x=>commitSlot(x));
    }
    const courseResult=L.courseSession?LCore.finish(learning(),L.courseSession,complete):null;
    L.active=false;L.state='finished';keyboardDown.clear();
    const report={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),at:Date.now(),kind:L.kind,flow:L.settings.flow,clef:L.settings.clef,settings:{...L.settings,exercise:undefined,helperOrigin:undefined,keyboardFull:L.keyboardFull,keyboardChanged:!!L.keyboardChanged},complete,paused:!!L.wasPaused,answers,extras,courseResult,courseTrack:L.courseSession?.track||null,courseInfo:L.courseInfo,exercise:L.kind==='phrase'?{events:L.groups,totalBeats:L.totalBeats,clefs:L.clefs}:null,phraseCourseKey:L.phraseCourse?.key||null,helperOrigin:L.settings.helperOrigin||null};
    if(report.phraseCourseKey)report.phraseResult=LCore.phraseResult(learning(),report.phraseCourseKey,report);
    if(report.settings.foundationAttempt)report.foundationResult=window.PianoFoundation?.acceptReport(report)||null;
    H.save();if(answers.length){data().reports.push(report);data().reports=data().reports.slice(-60);H.save();}
    if(display){H.showPage('studyLesson');renderStudyReport(report);}
  }
  function reportAccuracy(r){const x=S.summary(r);return r.flow!=='guided'&&r.kind!=='rhythm'?percent(x.matchedCorrect,x.matched):percent(x.unaidedCorrect,x.seen);}
  function comparable(a,b){if(a.settings?.keyboardChanged||b.settings?.keyboardChanged)return false;return a.kind===b.kind&&a.flow===b.flow&&a.clef===b.clef&&['notes','count','pattern','rhythm','tempo','dual','keyboardFull','difficulty','input'].every(k=>a.settings?.[k]===b.settings?.[k]);}
  function renderStudyReport(r) {
    const x=S.summary(r),timed=r.flow!=='guided',rhythm=r.kind==='rhythm';
    const matches=data().reports.filter(a=>a.id!==r.id&&comparable(a,r)).slice(-5),previous=matches[matches.length-1];
    $('studyLesson').innerHTML=`<div class="page-head"><div><h2>${r.complete?'训练完成':'训练提前结束'}</h2><p>${names[r.kind]} · ${r.flow==='guided'?'学习模式':r.flow==='assessment'?'新题测评':'连续模式'} · ${x.seen}个已评估音${timed?' · '+r.settings.tempo+' BPM':''}</p></div><div class="actions"><button id="reportAgain" class="primary">生成新题再练</button><button data-page="progressPage">进步记录</button></div></div>
      <div class="stats"><div><div class="stat-label">${rhythm?'拍点命中率':timed?'已匹配按键音高准确率':'本轮独立认准率'}</div><div class="stat-value">${timed&&!rhythm?percent(x.matchedCorrect,x.matched):percent(x.unaidedCorrect,x.seen)}</div><div class="stat-help">${timed&&!rhythm?x.matchedCorrect:x.unaidedCorrect} / ${timed&&!rhythm?x.matched:x.seen} ${rhythm?'个音符起点':timed?'个已匹配按键':'个已评估音（提示另计）'}</div></div><div><div class="stat-label">${timed?'起拍偏差中位数':r.kind==='reverse'?'谱面定位中位数':'首次找键中位数'}</div><div class="stat-value">${fmt(timed?x.medianDelta:x.median)}</div><div class="stat-help">${timed?x.timingSeen:x.speedSamples}个有效样本${timed?' · 仅含匹配到的按键':' · 暂停和提示样本排除'}</div></div><div><div class="stat-label">${timed?'漏按 / 多按':'使用提示的音'}</div><div class="stat-value">${timed?x.missed+' / '+x.extras:x.seen-x.unaided}</div><div class="stat-help">${timed?'包含休止期间多按':'提示帮助学习，单独统计'}</div></div></div>
      <p class="result-summary">${timed?'音高按匹配到的琴键评估；起拍偏差单独显示。未匹配起点计漏按，额外按键计多按；音高准确率的分母只包含已匹配的按键。当前只评估起点，不评估持续按住时长。设备音频与触屏延迟会影响偏差，建议在同一设备、相同速度下比较。':'本轮独立认准率使用全部已评估音作为分母，提示后的完成另行记录。找键时间包含认谱和寻找琴键。反向定位记录另一种任务，不与找键速度混合。复习间隔是可调整的初始安排。'}<br>${previous?'最近同条件记录：'+reportAccuracy(previous)+'；当前：'+reportAccuracy(r)+'。':'暂无同条件对照记录，继续积累样本。'}${r.flow==='assessment'?' 本次使用新短句，未提供音高提示。':''}</p>
      <div class="table-wrap"><table><thead><tr><th>音符</th><th>${timed?'实际按键':'第一次选择'}</th><th>结果</th><th>${timed?'起拍偏差':'首次用时'}</th></tr></thead><tbody>${r.answers.map((a,i)=>`<tr><td>${i+1}. ${rhythm?'节奏拍点':(a.clef==='treble'?'高音 ':'低音 ')+C.midiName(a.expected)}</td><td>${a.actual===null?'未按':rhythm?'已点':C.midiName(a.actual)}</td><td>${a.correct?'正确':'待加强'}${a.hint?' · '+PianoHints.label(a.hintLevel):''}</td><td>${timed?a.delta===null?'未匹配':Math.round(a.delta)+' ms':fmt(a.ms)}</td></tr>`).join('')}</tbody></table></div>`;
    $('studyLesson').classList.add('show-report');bindPages($('studyLesson'));$('reportAgain').textContent=r.courseResult?(r.courseResult.passed?'进入下一单元':'继续巩固本组'):r.phraseCourseKey?'继续同句课程':'重练同一题';$('reportAgain').onclick=()=>r.kind==='review'?(reviewDue().length?launch('review',r.settings):H.showPage('today')):launch(r.kind,{...r.settings,exercise:r.exercise});if(r.kind==='review')$('reportAgain').textContent=reviewDue().length?'继续到期复习':'返回今日练习';
    if(r.exercise&&!r.phraseCourseKey){const button=document.createElement('button');button.textContent='生成新短句';button.onclick=()=>launch(r.kind,r.settings);$('reportAgain').after(button);}
    if(r.flow==='guided'){
      const box=document.createElement('div');box.className='hint-summary';
      box.innerHTML=[0,1,2,3].map(level=>`<span>${PianoHints.label(level)}：${r.answers.filter(a=>(a.hint?a.hintLevel:0)===level).length}音</span>`).join('');
      const legacy=r.answers.filter(a=>a.hint&&a.hintLevel===undefined).length;if(legacy)box.insertAdjacentHTML('beforeend','<span>旧版提示：'+legacy+'音</span>');$('studyLesson').querySelector('.stats').after(box);
    }
    if(r.helperOrigin){const b=document.createElement('button');b.textContent='回到原训练无提示检查';b.onclick=()=>launch(r.helperOrigin.kind,r.helperOrigin.settings);$('reportAgain').after(b);}
    if(r.courseResult){const box=document.createElement('div');box.className='learning-result';box.innerHTML=`<h3>${r.courseResult.passed?'本单元通过':'本组仍需巩固'}</h3><p>计划 ${r.courseResult.planned} 题，完成 ${r.courseResult.completed} 次作答，加练 ${r.courseResult.extra} 题。未完成回测会在继续时保留。</p><div class="unit-progress">${r.courseResult.focus.map(v=>`<span class="${v.clean>=4&&!v.needs?'ready':''}">${esc(v.key.split(':')[1])} · 无提示正确 ${v.clean}/4${v.needs?' · 待回测':''}</span>`).join('')}</div><p>通过本单元表示本次已练稳，长期记忆仍需到期复习。</p>`;$('studyLesson').querySelector('.page-head').after(box);}
    if(r.phraseCourseKey){const box=document.createElement('div');box.className='learning-result';box.innerHTML=`<h3>${r.phraseResult?.passed?'阶段通过':'保留这一句继续练'}</h3><p>认识阶段可看提示；之后要求完整、无错、无提示。跟拍还检查起拍与多按，暂停轮次不升级。未通过时保留原谱面。</p>`;$('studyLesson').querySelector('.page-head').after(box);}
    if(window.PianoCoach){const host=document.createElement('section');$('studyLesson').querySelector('.page-head').after(host);window.PianoCoach.renderStudy(r,host);}
    if(r.settings?.foundationAttempt){const box=document.createElement('section');box.className='foundation-report-link';box.innerHTML=`<div><span class="eyebrow">循序课程 · ${esc(FoundationCore.LESSONS[r.settings.foundationAttempt.unit].title)}</span><h3>${r.foundationResult?.passed?'阶段完成，继续学习链':'这条乐句还需再练'}</h3><p>${esc(r.foundationResult?.reason||'这轮未推进课程，可重新进入当前阶段。')}</p></div><button id="foundationReportBack" class="primary">返回课程，继续下一步</button>`;$('studyLesson').querySelector('.page-head').after(box);$('foundationReportBack').onclick=()=>window.PianoFoundation.open();$('reportAgain').textContent=r.foundationResult?.passed?'继续本课下一阶段':'重练当前阶段';$('reportAgain').onclick=()=>window.PianoFoundation.retryReport(r);}
  }
  function progress() {
    const d=data(),reports=[...d.reports].reverse(),conf=Object.keys(d.confusions).map(k=>{const t=S.targetFromKey(k);return {t,x:S.commonConfusion(d,t)};}).filter(x=>x.x?.confirmed);
    $('progressPage').innerHTML=`${V.heading('05','每一次练习，都算数。','在相同条件下，看看自己认得更准、弹得更稳了吗。')}<div class="progress-tools"><button data-page="profiles">薄弱音与数据备份</button><button data-page="mistakes">自由练习错题本</button><button data-page="history">自由练习记录</button><button data-page="help">学习说明</button></div>
      <div class="progress-review"><h3>复习安排</h3><p>已记录${Object.keys(d.notes).length}个音，到期${reviewDue().length}个。按任务与输入方式分别复习；到期后两次无提示确认通过才延长至1、3、7、14天。普通练习不会推迟到期时间，错音和提示音10分钟后检查。</p><button id="progressReview" ${reviewDue().length?'':'disabled'}>练到期音</button></div>
      ${conf.length?`<div class="confusion-list"><h3>历史易混音记录</h3><p>至少有3次实际错键记录才列在这里，仍需结合短句表现判断。</p>${conf.slice(0,8).map(a=>`<p>${a.t.clef==='treble'?'高音':'低音'} ${C.short(a.t.note)} → ${C.midiName(a.x.midi)} · 最近记录${a.x.count}次</p>`).join('')}</div>`:''}
      <h3 class="record-heading">专项与短句记录</h3>${reports.length?`<div class="table-wrap"><table><thead><tr><th>时间与内容</th><th>条件</th><th>准确率与口径</th><th>样本数</th><th></th></tr></thead><tbody>${reports.map(r=>{const x=S.summary(r);return `<tr><td>${esc(new Date(r.at).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))}<br>${names[r.kind]}</td><td>${{treble:'高音',bass:'低音',mixed:'混合',dual:'双谱表'}[r.clef]} · ${r.flow==='guided'?'学习':r.flow==='assessment'?'测评':'连续'}${r.flow==='guided'?'':' · '+r.settings.tempo+' BPM'}</td><td>${r.flow==='guided'?percent(x.unaidedCorrect,x.seen):r.kind==='rhythm'?percent(x.correct,x.seen):percent(x.matchedCorrect,x.matched)}<br><small>${r.flow==='guided'?'本轮独立认准':r.kind==='rhythm'?'拍点命中':'已匹配按键音高'}</small></td><td>${r.flow!=='guided'&&r.kind!=='rhythm'?x.matched:x.seen}${(r.flow!=='guided'&&r.kind!=='rhythm'?x.matched:x.seen)<10?' · 继续观察':''}</td><td><button data-study-report="${esc(r.id)}">查看</button></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty"><h3>先完成一项训练</h3><p>这里保留最近60次专项、短句与节奏记录。</p></div>'}`;
    const rr=[...(data().rhythm?.reports||[])].reverse();
    $('progressPage').insertAdjacentHTML('beforeend',`<h3 class="record-heading">节奏课程记录</h3>${rr.length?`<div class="table-wrap"><table><thead><tr><th>时间与课程</th><th>条件</th><th>起点 / 时值</th><th>漏按 / 多按</th><th></th></tr></thead><tbody>${rr.map(r=>{const m=r.result.metrics;return `<tr><td>${esc(new Date(r.at).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))}<br>${RhythmCore.LABELS[r.settings.mode]}</td><td>${r.settings.meter} · ${r.settings.tempo} BPM<br>${r.settings.bars}小节</td><td>${percent(m.hit,m.seen)}${RhythmCore.isHold(r.settings)?' / '+percent(m.holdCorrect,m.holds):''}</td><td>${m.missed} / ${m.extras}</td><td><button data-rhythm-report="${esc(r.id)}">查看</button></td></tr>`;}).join('')}</tbody></table></div>`:'<p class="muted">完成节奏课程后，在这里查看起拍、时值和回放。</p>'}`);
    $('progressPage').querySelectorAll('[data-rhythm-report]').forEach(b=>b.onclick=()=>window.PianoRhythm.showReport(data().rhythm.reports.find(r=>r.id===b.dataset.rhythmReport)));
    bindPages($('progressPage'));$('progressReview').onclick=()=>launch('review',{clef:'mixed'});$('progressPage').querySelectorAll('[data-study-report]').forEach(b=>b.onclick=()=>{const r=data().reports.find(a=>a.id===b.dataset.studyReport);if(!r)return;H.showPage('studyLesson');renderStudyReport(r);});
  }
  function navigate(name) {
    currentPage=name;document.body.dataset.screen=name;$('studyLesson').classList.remove('show-report');
    const route={today:'今日练习',topics:'专项练习',reading:'短句读谱',progressPage:'进步记录',rhythmPage:'节奏与拍子',foundationPage:'循序入门',studyLesson:lesson?names[lesson.kind]:'训练记录'}[name];
    if(route)$('modeTitle').textContent=route+' · 完全离线';
    if(name==='today')today();if(name==='topics')topics();if(name==='reading')reading();if(name==='progressPage')progress();if(name==='studyLesson'&&lesson?.active)renderLesson();
    const active=name==='studyLesson'&&lesson?.active?(lesson.kind==='phrase'?'reading':'topics'):['practice','notePicker','rhythmPage','foundationPage'].includes(name)?'topics':['profiles','mistakes','history','result','help','studyLesson'].includes(name)?'progressPage':name;
    document.querySelectorAll('.nav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===active));
    if(name==='help')$('help').insertAdjacentHTML('beforeend','<div class="section helptext"><h3>帮助我记住</h3><p>识谱、专项、反向定位和学习短句均可展开记忆提示：先看附近参照，再看上行下行与线间关系，最后按需看答案与键盘位置。收起提示不会把本音改记为独立认出；专项后续仍需无提示回测。</p><p>初次认识可以看完整讲解，后续逐渐撤掉提示。连续短句可转入同谱面的辅助学习，结束后回原训练无提示检查。自由识谱打开提示时，本题转为不限时；提示音不计识别速度。</p><p>节奏在准备时可逐小节拆解，开始跟拍后自动收起。用过拆解的轮次作为辅助练习，不推进课程；结束后也可在复盘中看提示，再重练同一节奏。</p></div>');
    if(name==='help')$('help').insertAdjacentHTML('beforeend','<div class="section helptext"><h3>新训练模式</h3><p>专项练习包含参照音、易混音、加线音和琴键到谱面的反向定位。短句有学习、连续和测评模式；上下谱表按时间对齐。短句仍评估音高与起点；时值、松键与双侧节奏请进入“节奏与拍子”课程。</p><p>新训练记录与复习安排会一起导出到备份JSON。连续模式先预备四拍，休止符处不按；暂停与进入后台都会停止计时。</p></div>');
  }
  function back() {
    if(H.modalOpen())return false;if(window.PianoRhythm?.back())return true;
    if(currentPage==='studyLesson'&&lesson?.active){pause();H.confirm('结束训练并返回？','已完成的音会保存，未轮到的音不计错。',()=>{finish(false,false);H.showPage('today');});return true;}
    return false;
  }
  window.PianoStudy={
    continueReport:report=>report.kind==='review'&&!reviewDue().length?H.showPage('today'):launch(report.kind,{...report.settings,exercise:undefined}),
    practiceFocus:(report,targets,reason)=>{const focusKeys=(targets||[]).filter(t=>['treble','bass'].includes(t.clef)&&Number.isInteger(t.midi)&&[0,2,4,5,7,9,11].includes(t.midi%12)).map(t=>t.clef+':'+C.midiName(t.midi)).filter(k=>/^(treble|bass):[A-G][2-6]$/.test(k)).slice(0,3);if(!focusKeys.length){H.notice('这一轮的有效音符不足，先回入门单元继续。');return;}const clefs=new Set(focusKeys.map(k=>k.split(':')[0]));launch('anchors',{...report.settings,foundationAttempt:null,course:'free',flow:'guided',clef:clefs.size===1?[...clefs][0]:'mixed',count:10,focusKeys,focusReason:reason,helperOrigin:report.exercise?{kind:'phrase',settings:{...report.settings,foundationAttempt:null,course:'free',exercise:report.exercise,helperOrigin:undefined}}:null});},
    practiceExercise:(exercise,settings)=>launch('phrase',{...settings,course:'free',exercise}),
    showReport:r=>{H.showPage('studyLesson');renderStudyReport(r);},inputSource:()=>lesson?.settings.input||'touch',previewNavigation,
    stopForInputChange:()=>{if(lesson?.active){finish(false,false);H.showPage('today');}},
    isReverse:()=>currentPage==='studyLesson'&&lesson?.active&&(lesson.kind==='reverse'||lesson.groups[lesson.index]?.review?.task==='staff'),
    midiEvent:e=>{if(e.type==='reset'){cancelAdvance();lastInput=0;return;}if(currentPage!=='studyLesson'||!lesson?.active||(lesson.kind==='reverse'||lesson.groups[lesson.index]?.review?.task==='staff'))return;if(e.type==='on')press(e.note,e.at,'midi');},
    autoContinue,midiActivity:e=>{if(e.type==='on'||e.type==='off')inputActivity();},
    midiReady:()=>currentPage==='studyLesson'&&lesson?.active&&lesson.kind!=='reverse'&&lesson.groups[lesson.index]?.review?.task!=='staff'&&lesson.state==='guided'&&!H.modalOpen()&&(lesson.groups[lesson.index]?.rest||lesson.slots.length>0&&lesson.slots.every(s=>s.completed)),
    midiToken:()=>lesson?.index,
    midiAdvance:()=>{if(lesson?.active&&lesson.state==='guided')advance();},
    isActive:()=>!!lesson?.active||!!window.PianoRhythm?.isActive()||!!window.PianoFoundation?.isActive(),ownsActive:()=>!!lesson?.active,stopForRhythm:confirmLaunch,beforeClassicStart:callback=>{if(window.PianoSongs?.beforeOtherTraining?.(callback))return true;if(window.PianoFoundation?.isActive()){window.PianoFoundation.stopForStudy(callback);return true;}if(window.PianoRhythm?.beforeClassicStart(callback))return true;if(!lesson?.active)return false;pause();H.confirm('结束当前专项并开始自由练习？','已完成的音会保存，尚未轮到的音不计错。',()=>{finish(false,false);callback();});return true;},navigate,beforeNavigate:name=>{window.PianoRhythm?.beforeNavigate(name);if(name!=='studyLesson')pause();},pause:()=>{pause();window.PianoRhythm?.pause();window.PianoFoundation?.pause();},back};
  window.addEventListener('resize',()=>{if(currentPage==='studyLesson'&&lesson?.active&&$('lessonStage'))renderQuestion(true);});
  document.addEventListener('keydown',e=>{if(e.repeat||H.modalOpen()||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(currentPage==='studyLesson'&&lesson?.active){if(e.key==='Escape'){e.preventDefault();lesson.state==='paused'?resume():pause();}if(e.code==='Space'&&lesson.kind==='rhythm'){e.preventDefault();press(60);}}});
  window.addEventListener('pianoinputchange',()=>{if(!lesson?.active&&!H.classicActive()&&!window.PianoRhythm?.isActive()&&['today','topics','reading','progressPage'].includes(currentPage))H.showPage(currentPage);});
  H.showPage('today');window.PianoStartup.phase='ready';window.PianoReady=true;
})();
