/* The recommendation is an executable, bounded next step. */
(()=>{
  'use strict';
  const H=window.PianoHost,C=window.CoachCore,V=window.PianoStudio;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function act(entry){
    const {report,advice,kind}=entry;
    if(kind==='rhythm'){
      const exercise=JSON.parse(JSON.stringify(report.exercise));
      if(['pulse','duration','rest'].includes(advice.code))exercise.settings.tempo=Math.max(30,(exercise.settings.tempo||60)-10);
      return window.PianoRhythm.practiceExercise(exercise,exercise.settings);
    }
    if(advice.action==='continue')return window.PianoStudy.continueReport(report);
    if(advice.action==='repeat'&&report.settings?.foundationAttempt)return window.PianoFoundation.retryReport(report);
    if(advice.action==='pitch')return window.PianoStudy.practiceFocus(report,advice.focus,advice.reason);
    if(advice.action==='rhythm'){
      const ex=C.rhythmExercise(report);if(ex){ex.phraseOrigin=window.RhythmCore.normalizePhraseOrigin({exercise:report.exercise,settings:{...report.settings,flow:report.flow}});return window.PianoRhythm.practiceExercise(ex,ex.settings);}
    }
    let exercise=advice.action==='chunk'?C.chunk(report):advice.action==='variation'?C.variation(report):report.exercise;
    if(exercise)return window.PianoStudy.practiceExercise(exercise,{...report.settings,foundationAttempt:null,course:'free',flow:advice.action==='chunk'?'guided':report.flow,tempo:report.settings?.tempo||60,helperOrigin:advice.action==='chunk'?{kind:'phrase',settings:{...report.settings,foundationAttempt:null,course:'free',exercise:report.exercise,helperOrigin:undefined}}:null});
    return window.PianoStudy.practiceFocus(report,advice.focus,advice.reason);
  }
  function render(entry,host){
    const a=entry.advice;host.className='coach-card';host.innerHTML=`<div><span class="eyebrow">NEXT STEP · 本轮先解决这一项</span><h3>${esc(a.title)}</h3><p>${esc(a.reason)}</p>${a.secondary?`<small>${esc(a.secondary)}</small>`:''}</div><button class="primary" data-coach-action>${esc(a.label)}${V.icon('arrow')}</button>`;
    host.querySelector('[data-coach-action]').onclick=()=>act(entry);
    if(host.closest?.('.show-report'))window.PianoFeedback?.present(host.closest('.show-report'),entry.report,entry.kind,entry.advice);
    if(entry.kind==='rhythm'){const origin=window.RhythmCore.normalizePhraseOrigin(entry.report.exercise?.phraseOrigin);if(origin){const button=document.createElement('button');button.textContent='返回原句无提示检查';button.onclick=()=>window.PianoStudy.practiceExercise(origin.exercise,origin.settings);host.appendChild(button);}}
  }
  window.PianoCoach={renderStudy:(report,host)=>render({kind:'study',report,advice:C.study(report)},host),renderRhythm:(report,host)=>render({kind:'rhythm',report,advice:C.rhythm(report)},host),latest:()=>C.latest(H.getDB().study,window.PianoInput?.isMidi()?'midi':'touch'),act,render};
})();
