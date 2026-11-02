/* A shared view of distinct evidence stores; it does not merge their mastery calculations. */
(()=>{
 'use strict';const H=window.PianoHost,C=PianoCore,esc=SongCore.esc,$=id=>document.getElementById(id);
 const labels={course:'课程',study:'专项与短句',rhythm:'节奏',song:'曲谱',classic:'自由识谱'};
 function entries(){const d=H.getDB(),out=[];
  for(const r of d.study.reports||[])out.push({id:r.id,at:r.at,type:r.settings?.foundationAttempt?'course':'study',source:r.settings?.input||'touch',title:({anchors:'参照音',contrast:'易混音',ledger:'加线音',reverse:'琴键到谱面',phrase:'短句',review:'到期复习'})[r.kind]||'基础训练',complete:r.complete,interrupted:r.paused,assisted:r.answers?.some(a=>a.hint),report:r,open:()=>window.PianoStudy.showReport(r)});
  for(const r of d.study.rhythm?.reports||[])out.push({id:r.id,at:r.at,type:'rhythm',source:r.settings?.input||'touch',title:RhythmCore.LABELS[r.settings.mode],complete:r.complete,interrupted:r.paused,assisted:r.hint,report:r,open:()=>window.PianoRhythm.showReport(r)});
  for(const source of ['touch','midi'])for(const [i,r]of (d.study.foundation?.tracks?.[source]?.history||[]).entries()){const lesson=FoundationCore.LESSONS[r.unit];out.push({id:'course-'+source+'-'+i,at:r.at,type:'course',source,title:'第 '+(r.unit+1)+' 课 · '+(FoundationCore.LABELS[r.kind]||r.kind),complete:true,interrupted:r.reason==='interrupted',assisted:r.reason==='hint',clean:r.clean,detail:(lesson?.title||'课程检查')+' · '+(r.clean?'独立检查通过':'需要回测')});}
  for(const r of d.reports||[])out.push({id:r.id,at:Date.parse(r.date)||0,type:'classic',source:r.settings?.input||'touch',title:'自由识谱',complete:r.complete!==false,report:r,open:()=>H.showClassicReport?.(r)});
  for(const r of window.PianoSongs?.reports?.()||[])out.push({id:r.id,at:r.at,type:'song',source:r.source,title:r.title+' · '+r.settings.from+'—'+r.settings.to+' 小节',complete:r.complete,interrupted:r.interrupted,assisted:r.assisted||r.result?.answers?.some(a=>a.hint),report:r,open:()=>window.PianoSongs.openReport(r.id)});
  return out.sort((a,b)=>b.at-a.at);
 }
 function render(root){if(!root||root.id!=='progressPage')return;root.querySelector('#practiceTimeline')?.remove();
  let categorized=root.querySelector('.history-categories');if(!categorized){categorized=document.createElement('details');categorized.className='history-categories';categorized.innerHTML='<summary>按训练类型查看旧记录与基础复习安排</summary>';for(const item of [...root.children])if(!item.classList.contains('studio-heading')&&!item.classList.contains('page-head')&&!item.classList.contains('progress-tools')&&item.id!=='songHomeLearning')categorized.appendChild(item);root.appendChild(categorized);}
  const host=document.createElement('section');host.id='practiceTimeline';host.innerHTML='<div class="history-heading"><h3>全部练习记录</h3><span>各类训练分别评价，集中查看</span></div><div class="history-filters"><label>训练<select id="historyType"><option value="all">全部训练</option>'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label><label>输入<select id="historyInput"><option value="all">全部输入</option><option value="touch">屏幕琴键</option><option value="midi">实体琴</option></select></label><span id="historyCount"></span></div><div id="historyEntries"></div><button id="historyMore" hidden>再显示 20 条</button>';
  (root.querySelector('.progress-tools')||root.firstElementChild)?.after(host);let limit=20;
  function paint(){const xs=entries().filter(e=>($('historyType').value==='all'||e.type===$('historyType').value)&&($('historyInput').value==='all'||e.source===$('historyInput').value));$('historyCount').textContent=xs.length+' 条记录';$('historyMore').hidden=xs.length<=limit;
   $('historyEntries').innerHTML=xs.length?xs.slice(0,limit).map((e,i)=>{const state=e.complete===false?'提前结束':e.interrupted?'含中断':e.assisted?'借助帮助':e.clean===false?'待回测':'已完成';return '<article class="history-entry"><div><small>'+labels[e.type]+' · '+(e.source==='midi'?'实体琴':'屏幕琴键')+' · '+esc(new Date(e.at).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))+'</small><strong>'+esc(e.title)+'</strong><span>'+state+'</span></div>'+(e.open?'<button data-history-entry="'+i+'">查看记录</button>':'<details><summary>检查详情</summary><p>'+esc(e.detail)+'</p></details>')+'</article>';}).join(''):'<div class="empty"><p>暂无这一类记录。完成练习后会在这里汇总。</p></div>';
   host.querySelectorAll('[data-history-entry]').forEach(b=>b.onclick=()=>xs[+b.dataset.historyEntry].open());
  }
  $('historyType').onchange=$('historyInput').onchange=()=>{limit=20;paint();};$('historyMore').onclick=()=>{limit+=20;paint();};paint();
 }
 window.PianoHistory={render,entries};
})();
