/* One task workspace inside the production shell, using the existing piano and bridge. */
(()=>{
 'use strict';
 window.PianoGlyphs=window.PianoHost.glyphs;
 const root=document.getElementById('theoryPage');
 root.innerHTML='<div id="theoryReturn" hidden></div><nav class="theory-tabs" aria-label="乐理工作区"><button data-theory-tab="learner">查知识 / 我忘了</button><button data-theory-tab="explorer">和弦探索</button><button data-theory-tab="evidence">复习与记录</button><span></span><button id="theoryStop">停止声音</button></nav><div id="theoryLearner" class="theory-module"></div><div id="theoryExplorer" class="theory-module" hidden></div>';
})();
