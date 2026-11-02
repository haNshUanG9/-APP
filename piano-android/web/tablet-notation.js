/* Engrave to the available reading area, keeping staff spacing independent of page width. */
(()=>{
 'use strict';
 const C=PianoCore,G=__GLYPHS__,esc=C=>String(C).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const size=id=>{const el=document.getElementById(id);return {w:Math.max(300,el?.clientWidth||innerWidth-60),h:Math.max(180,el?.clientHeight||innerHeight-260)};};
 const glyph=(c,x,y,g)=>`<path d="${G[c].path}" transform="translate(${x} ${y}) scale(${g/250} -${g/250})" fill="#1e293b"/>`;
 const ref=c=>C.parse(c==='treble'?'E4':'G2').index;
 function staff(c,bottom,w,g){let h='';for(let i=0;i<5;i++)h+=`<path d="M28 ${bottom-i*g}H${w-28}" stroke="#7b879b" stroke-width="1.25"/>`;return h+glyph(c,45,bottom-(c==='treble'?g:g*3),g);}
 function note(t,x,bottom,g,duration=1,color='#1e293b',attrs='',active=false){
  const delta=t.note.index-ref(t.clef),y=bottom-delta*g/2,down=delta>=4,sx=x+(down?-g*.56:g*.56),sy=y+(down?g*3.1:-g*3.1);let h='';
  if(active)h+=`<circle cx="${x}" cy="${y}" r="${g*1.06}" fill="#eaf0fc"/>`;
  C.ledgerOffsets(delta).forEach(k=>h+=`<path d="M${x-g*1.2} ${bottom-k*g/2}h${g*2.4}" stroke="${color}" stroke-width="1.6"/>`);
  h+=`<ellipse ${attrs} cx="${x}" cy="${y}" rx="${g*(duration>=4?.8:.65)}" ry="${g*.43}" transform="rotate(${duration>=4?0:-20} ${x} ${y})" fill="${duration>=2?'#fcfcfd':color}" stroke="${color}" stroke-width="${duration>=2?2:1}"/>`;
  if(duration<4)h+=`<path d="M${sx} ${y}V${sy}" stroke="${color}" stroke-width="${Math.max(2,g*.06)}"/>`;
  if(duration===.5)h+=`<path d="${G[down?'flagDown':'flagUp'].path}" transform="translate(${sx} ${sy}) scale(${g/250} -${g/250})" fill="${color}"/>`;
  return h;
 }
 function single(t,{stage='lessonStage',choices=null,active=true}={}){
  const {w,h}=size(stage),delta=t.note.index-ref(t.clef),lo=Math.min(0,delta),hi=Math.max(8,delta),slots=choices?.length||1;
  const g=Math.min(58,w/(choices?slots*3.2+4:15),(h-70)/((hi-lo)/2+6)),bottom=h/2+(hi+lo)*g/4;
  let svg=staff(t.clef,bottom,w,g);
  if(choices)choices.forEach((n,i)=>{const x=g*4+(i+.5)*(w-g*4-30)/slots;svg+=`<g data-position="${n.midi}" role="button" tabindex="0" aria-label="候选音 ${esc(C.location(t.clef,n))}"><rect x="${x-g*1.3}" y="16" width="${g*2.6}" height="${h-32}" fill="transparent"/>${note({clef:t.clef,note:n},x,bottom,g)}</g>`;});
  else svg+=note(t,w*.64,bottom,g,1,'#1e293b',`data-target="${t.note.midi}" data-note-index="${t.note.index}" data-clef="${t.clef}"`,active);
  return `<svg class="${choices?'reverse-score':'single-note-score'} tablet-score" data-staff-space="${g}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${choices?'选择对应谱面位置':'识别五线谱音符'}">${svg}</svg>`;
 }
 function classic(targets,active,done){
  if(targets.length===1)return `<div class="score-row">${single(targets[0],{stage:'stage',active:active===0})}</div>`;
  const {w,h}=size('stage'),dual=new Set(targets.map(t=>t.clef)).size>1,cols=dual?(w<850?1:2):(w<850?2:4),per=dual?cols*2:cols;let html='';
  for(let start=0;start<targets.length;start+=per){const ts=targets.slice(start,start+per),rowH=Math.max(h,dual?380:260),g=Math.min(dual?34:44,(rowH-100)/(dual?15:10),w/(cols*4+5)),bottoms={treble:dual?rowH*.37:rowH*.59,bass:dual?rowH*.78:rowH*.59};let s='';
   [...new Set(ts.map(t=>t.clef))].forEach(c=>s+=staff(c,bottoms[c],w,g));
   ts.forEach((t,k)=>{const i=start+k,col=dual?Math.floor(k/2):k,x=g*4+(col+.5)*(w-g*4-30)/cols;s+=`<g data-slot="${i}">${note(t,x,bottoms[t.clef],g,1,'#1e293b',`data-note-index="${t.note.index}" data-clef="${t.clef}"`,i===active)}<text x="${x+g}" y="${bottoms[t.clef]+g*2.4}" font-size="18" fill="#59677c">${i+1}</text></g>`;});
   html+=`<div class="score-row" data-score-row="${start/per}"><svg class="tablet-score" viewBox="0 0 ${w} ${rowH}" role="img" aria-label="按编号认音">${s}</svg></div>`;
  }return html;
 }
 function phrase(lesson){
  const {w,h}=size('lessonStage'),dual=lesson.clefs.length>1,maxGap=dual?32:42;
  let beatsPerRow=w<1000||dual?4:8;const density=Math.max(...lesson.groups.map(e=>1/Math.max(.5,e.duration||1)));if(w<1300&&density>1)beatsPerRow=4;
  const g=Math.min(maxGap,(w-70)/(6+beatsPerRow*2.2)),rowH=Math.max(h,(dual?16:10)*g),bottoms=dual?{treble:rowH*.35,bass:rowH*.77}:{treble:rowH*.59,bass:rowH*.59},x0=g*7.8,step=(w-x0-45)/beatsPerRow;
  let html='';for(let start=0;start<lesson.totalBeats;start+=beatsPerRow){const end=Math.min(lesson.totalBeats,start+beatsPerRow);let s='';lesson.clefs.forEach(c=>{s+=staff(c,bottoms[c],w,g);s+=`<text x="${g*5.6}" y="${bottoms[c]-g*2.4}" font-size="${g*1.6}" fill="#59677c">4</text><text x="${g*5.6}" y="${bottoms[c]-g*.5}" font-size="${g*1.6}" fill="#59677c">4</text>`;});
   for(let b=start;b<=end;b+=4){const x=x0+(b-start)*step-g*.9;s+=`<path d="M${x} ${bottoms[lesson.clefs[0]]-g*4}V${bottoms[lesson.clefs.at(-1)]}" stroke="#a4adba"/>`;if(b<end)s+=`<text x="${x+g*.4}" y="${bottoms[lesson.clefs[0]]-g*5}" font-size="17" fill="#59677c">${Math.floor(b/4)+1}</text>`;}
   lesson.groups.forEach((e,i)=>{if(e.beat<start||e.beat>=end)return;const x=x0+(e.beat-start)*step;s+=`<g data-event="${i}" data-beat="${e.beat}">`;lesson.clefs.forEach(c=>{const ts=e.targets.filter(t=>t.clef===c);if(ts.length)ts.forEach(t=>{const v=(e.voices||[]).find(v=>v.targets.some(a=>a.clef===c));s+=note(t,x,bottoms[c],g,v?.duration||e.duration,'#1e293b',`data-target="${t.note.midi}"`,lesson.settings.flow==='guided'&&i===lesson.index);});else{const held=lesson.groups.slice(0,i).some(p=>p.beat<e.beat&&(p.voices||[]).some(v=>v.targets.some(t=>t.clef===c)&&p.beat+v.duration>e.beat));if(!held){const key=e.duration>=4?'rest4':e.duration>=2?'rest2':e.duration>=1?'rest1':'rest05';s+=`<path d="${G[key].path}" transform="translate(${x} ${bottoms[c]-g*2}) scale(${g/250} -${g/250})" fill="#667386"/>`;}}});s+='</g>';});
   s+=`<line class="score-cursor" x1="${x0}" x2="${x0}" y1="30" y2="${rowH-30}" stroke="#8098c0" stroke-width="2" visibility="hidden"/>`;
   html+=`<div class="phrase-row" data-start-beat="${start}" data-end-beat="${end}" data-origin="${x0}" data-step="${step}"><svg class="tablet-score" viewBox="0 0 ${w} ${rowH}" role="img" aria-label="短句第${Math.floor(start/4)+1}小节">${s}</svg></div>`;
  }return html;
 }
 function memory(container,m,level){
  const root=container?.closest('.lesson-reading,.reading-board');if(!root)return;
  root.querySelectorAll('[data-tablet-memory]').forEach(e=>e.remove());if(!level||!m)return;
  const target=root.querySelector(`[data-target="${m.target.note.midi}"],[data-note-index="${m.target.note.index}"][data-clef="${m.target.clef}"]`);if(!target)return;
  const svg=target.closest('svg'),box=svg.viewBox.baseVal,g=Number(svg.dataset.staffSpace)||Math.abs(Number(target.getAttribute('ry'))/.43),tx=Number(target.getAttribute('cx')),ty=Number(target.getAttribute('cy')),bottom=ty+(m.target.note.index-ref(m.target.clef))*g/2,rx=Math.max(g*4.6,tx-box.width*.25),ry=bottom-(m.reference.note.index-ref(m.target.clef))*g/2;
  let s=note(m.reference,rx,bottom,g,2,'#1e293b')+`<text x="${rx}" y="${Math.min(box.height-24,Math.max(bottom+g*1.8,ry+g*2.3))}" font-size="${Math.min(20,g*.48)}" text-anchor="middle" fill="#4f70a6">${esc(C.short(m.reference.note))} · 参照</text>`;
  s+=`<text x="${tx}" y="${Math.min(box.height-24,ty+g*2.3)}" font-size="${Math.min(20,g*.48)}" text-anchor="middle" fill="#4f70a6">当前目标</text>`;
  if(level>=2&&m.steps){let d=`M${rx+g*.8} ${ry}`;m.path.slice(1).forEach((n,i)=>{const x=rx+(i+1)*(tx-rx)/m.steps,y=bottom-(n.index-ref(m.target.clef))*g/2;d+=` H${x-g*.65} V${y}`;if(i<m.steps-1)s+=`<circle cx="${x}" cy="${y}" r="${g*.1}" fill="#fcfcfd" stroke="#bca27d" stroke-width="2"/>`;});s+=`<path d="${d}" fill="none" stroke="#bca27d" stroke-width="2" stroke-dasharray="6 7"/>`;}
  const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('data-tablet-memory','');group.innerHTML=s;svg.appendChild(group);
 }
 window.PianoTabletNotation={single,classic,phrase,memory};
})();
