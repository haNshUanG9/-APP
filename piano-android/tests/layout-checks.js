/* Read-only checks of the rendered product, not assertions about CSS implementation. */
(()=>{
 const frame=document.getElementById('layoutFrame');
 function inspect(){
  const d=frame.contentDocument,w=frame.contentWindow;if(!d?.body||!w.PianoReady)return;
  const checks=[],visible=e=>!!e&&e.getClientRects().length>0,box=e=>e.getBoundingClientRect(),one=s=>d.querySelector(s);
  const add=(name,ok,detail)=>checks.push({name,ok,detail});
  add('root width',d.documentElement.scrollWidth<=w.innerWidth,{width:w.innerWidth,scrollWidth:d.documentElement.scrollWidth});
  if(d.body.dataset.screen==='today'){
   const training=one('.training-plan'),song=one('#songHomeLearning');if(training&&song){const a=box(training),b=box(song);add('home practice and song regions do not overlap',a.right<=b.left+1||a.bottom<=b.top+1,{training:a.toJSON(),song:b.toJSON()});}
  }
  if(d.body.dataset.screen==='topics'){
   const list=box(one('.topic-list')),options=box(one('.topic-options'));
   add('topics have separate regions',list.right<=options.left+1||list.bottom<=options.top+1,{list:list.toJSON(),options:options.toJSON()});
   const rows=[...d.querySelectorAll('.topic-row')].map(box);
   add('topic rows do not intersect settings',rows.every(r=>r.right<=options.left+1||r.bottom<=options.top+1||r.top>=options.bottom-1),{last:rows.at(-1).toJSON()});
  }
  for(const id of ['guideClose','guideDone','guideRangeApply','songPanelClose','songPanelDone']){
   const e=d.getElementById(id);if(!visible(e)||e.closest('[hidden]'))continue;
   const r=box(e),hit=d.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   add(id+' remains visible and hit',r.top>=0&&r.bottom<=w.innerHeight&&r.left>=0&&r.right<=w.innerWidth&&(hit===e||e.contains(hit)),r.toJSON());
  }
  if(d.body.classList.contains('tablet-study')){
   for(const id of ['lessonBack','lessonPause','lessonTools','lessonHint','workspaceKeyboard']){
    const e=d.getElementById(id);if(!visible(e))continue;const r=box(e);
    add(id+' touch target',r.width>=47.5&&r.height>=47.5,r.toJSON());
   }
   const top=one('.lesson-top'),footer=one('.lesson-footer'),keys=one('#lessonKeyScroll');
   if(visible(keys))add('question workspace shares left edge',Math.abs(box(top).left+parseFloat(w.getComputedStyle(top).paddingLeft)-box(keys).left)<1&&Math.abs(box(footer).left+parseFloat(w.getComputedStyle(footer).paddingLeft)-box(keys).left)<1);
  }
  window.LayoutChecks={width:w.innerWidth,height:w.innerHeight,screen:d.body.dataset.screen,checks,passed:checks.every(c=>c.ok)};
  document.getElementById('layoutChecks').textContent=JSON.stringify(window.LayoutChecks,null,2);
 }
 frame.addEventListener('load',()=>{new MutationObserver(inspect).observe(frame.contentDocument.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','data-screen','aria-expanded']});inspect();});
 window.addEventListener('resize',inspect);
 document.getElementById('runLayoutChecks').onclick=inspect;
})();
