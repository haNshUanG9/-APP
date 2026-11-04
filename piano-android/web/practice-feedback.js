/* One report hierarchy: round condition, observed facts, one next step, then inspectable detail. */
(()=>{
 'use strict';
 function present(root,r,kind,advice){
  root.querySelector('.report-condition')?.remove();const interrupted=!!(r.paused||r.interrupted),incomplete=r.complete===false,answers=r.answers||r.result?.answers||[],hinted=answers.filter(a=>a.hint).length,assisted=!!(r.hint||r.assisted||hinted),condition=document.createElement('div');condition.className='report-condition';condition.dataset.state=incomplete?'incomplete':interrupted?'interrupted':assisted?'assisted':'complete';
  const empty=kind==='song'&&!answers.length;
  const status=empty?'尚未形成成绩':incomplete?'本轮提前结束':interrupted?'本轮含中断':assisted?'本轮包含辅助练习':'本轮已完整完成';
  const facts=kind==='rhythm'?`已观察 ${r.result?.metrics?.seen||0} 个起点；${incomplete||interrupted?'这一轮不判断稳定程度。':'时值与起拍分别统计。'}`:`${answers.filter(a=>a.correct&&!a.hint).length} 音独立正确 · ${hinted} 音借助帮助 · ${answers.filter(a=>!a.correct&&!a.hint).length} 音待检查`;
  condition.innerHTML='<strong>'+status+'</strong><span>'+(empty?'尚未作答，原片段保留；准备好后再练。':facts)+'</span>';root.querySelector('.page-head,.song-report-title')?.after(condition);
  if(kind==='song'&&(empty||incomplete)){const score=root.querySelector('.song-report-score');if(score){score.classList.add('song-score-observation');score.textContent=empty?'尚未形成成绩':'已记录 '+answers.length+' 音';}}
  const coach=root.querySelector('.coach-card'),action=coach?.querySelector('[data-coach-action]'),repeat=root.querySelector(kind==='rhythm'?'#rhAgain':'#reportAgain');
  if(action&&repeat){if(['repeat','continue','rhythm-repeat'].includes(advice.action)&&!['pulse','duration','rest'].includes(advice.code)){action.replaceWith(repeat);repeat.classList.add('primary');}else repeat.classList.remove('primary');}
  let details=root.querySelector(':scope > .report-details');if(!details){details=document.createElement('details');details.className='report-details';details.innerHTML='<summary>'+(kind==='song'?'查看具体位置与统计说明':'查看逐音记录、谱面与统计说明')+'</summary>';root.appendChild(details);}
  const selectors=kind==='song'?'.song-problem-bars,.song-error-list,.song-report-limit':kind==='rhythm'?'.rh-recommendations,.rh-replay-head,#rhReplayStatus,.rh-timeline,.rh-report-score,.result-summary,.table-wrap':'.hint-summary,.result-summary,.table-wrap';
  for(const item of [...root.querySelectorAll(selectors)])if(!details.contains(item))details.appendChild(item);
  root.scrollTop=0;
 }
 window.PianoFeedback={present};
})();
