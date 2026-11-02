/* Shared memory scaffold for specialty, reverse, phrase and free reading. */
(()=>{
  'use strict';
  const C=PianoCore,HC=HintCore;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function diagram(m,level){
    const bottom=C.parse(m.target.clef==='treble'?'E4':'G2').index;
    const indices=[bottom,bottom+8,m.reference.note.index,m.target.note.index];
    const lo=Math.min(...indices)-2,hi=Math.max(...indices)+2,height=Math.max(150,(hi-lo)*12+38),y=n=>22+(hi-n)*12;
    let h='';for(let k=0;k<5;k++)h+=`<line x1="30" x2="500" y1="${y(bottom+k*2)}" y2="${y(bottom+k*2)}" stroke="#bacbc3"/>`;
    const draw=(n,x,color)=>{
      let s='';C.ledgerOffsets(n.index-bottom).forEach(k=>s+=`<line x1="${x-17}" x2="${x+17}" y1="${y(bottom+k)}" y2="${y(bottom+k)}" stroke="${color}" stroke-width="2"/>`);
      return s+`<ellipse cx="${x}" cy="${y(n.index)}" rx="10" ry="7" fill="${color}"/><line x1="${x+9}" x2="${x+9}" y1="${y(n.index)}" y2="${y(n.index)-30}" stroke="${color}" stroke-width="2"/>`;
    };
    h+=draw(m.reference.note,85,'#759f91')+draw(m.target.note,450,'#264c40');
    if(level>=2){
      const points=m.path.map((n,i)=>[m.steps?85+i*365/m.steps:450,y(n.index)]);
      if(m.steps){h+=`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#3b8b70" stroke-width="2.4" stroke-dasharray="5 4"/>`;m.path.slice(1,-1).forEach((n,i)=>h+=`<circle cx="${85+(i+1)*365/m.steps}" cy="${y(n.index)}" r="5" fill="white" stroke="#3b8b70" stroke-width="2"/>`);}
      h+=`<text x="270" y="${height-11}" text-anchor="middle" fill="#376756" font-size="14">${esc(m.steps?m.relation:'与参照在同一位置')}</text>`;
    }
    h+=`<text x="85" y="16" text-anchor="middle" font-size="14" fill="#567e70">${esc(C.short(m.reference.note))} · 参照</text><text x="450" y="16" text-anchor="middle" font-size="14" fill="#264c40">${level===3?esc(C.short(m.target.note)):'目标 · ？'}</text>`;
    if(level===1&&m.steps)h+=`<text x="270" y="${height-12}" text-anchor="middle" font-size="15" fill="#376756">${m.delta>0?'↗ 在参照上方':'↘ 在参照下方'}</text>`;
    return `<svg class="memory-diagram" viewBox="0 0 530 ${height}" role="img" aria-label="${esc(m.target.clef==='treble'?'高音谱表':'低音谱表')}参照与目标位置关系">${h}</svg>`;
  }
  function keyboard(m){
    const octave=m.target.note.octave;
    return `<div class="memory-keys" aria-label="目标八度的白键位置">${C.LETTERS.map((l,i)=>`<span class="${i===m.target.note.letter?'is-target':''}">${l}${octave}${i===m.target.note.letter?' ●':''}</span>`).join('')}</div>`;
  }
  function render(container,options){
    if(!container)return;const level=HC.clampLevel(options.level);
    container.hidden=!level;if(!level){container.innerHTML='';window.PianoTabletNotation?.memory(container,null,0);return;}
    const m=HC.model(options.target,options),review=options.review;window.PianoTabletNotation?.memory(container,m,level);
    container.innerHTML=`<section class="memory-card" data-hint-level="${level}"><div class="memory-card-head"><strong>帮助我记住</strong><div>${[1,2,3].map(n=>`<button data-memory-level="${n}" class="${level===n?'selected':''}" aria-pressed="${level===n}">${['看参照','看关系','看答案'][n-1]}</button>`).join('')}<button data-memory-close aria-label="收起记忆提示">收起</button></div></div><div class="memory-card-body">${diagram(m,level)}<div class="memory-explanation"><p>${esc(HC.text(m,level))}</p>${level===3?keyboard(m):''}<small>${options.note|| (review?'这次作为辅助学习，之后还需无提示复习。':'提示帮助学习，本音不计独立认出；之后再无提示试一次。')}</small></div></div></section>`;
    container.querySelectorAll('[data-memory-level]').forEach(b=>b.onclick=()=>options.onLevel(Number(b.dataset.memoryLevel)));
    container.querySelector('[data-memory-close]').onclick=()=>options.onLevel(0);
  }
  window.PianoHints={render,label:n=>n===undefined?'用过提示（旧版）':HC.LEVELS[HC.clampLevel(n)]};
})();
