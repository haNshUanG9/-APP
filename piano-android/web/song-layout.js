/* The engraver owns notation; this adapter presents complete systems without stretching glyphs. */
(()=>{
 'use strict';
 const NS='http://www.w3.org/2000/svg';let pages=[],viewport=null,sourceSong=null;
 const el=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
 function mount(engraver,song,host,scroll,zoom=1){
  pages=[];viewport=scroll;sourceSong=song;const originals=[...host.querySelectorAll('svg')],fragments=[];
  for(const [pi,page]of engraver.GraphicSheet.MusicPages.entries()){
   const original=originals[pi];if(!original)continue;const systems=page.MusicSystems,width=original.viewBox.baseVal.width;
   const buckets=systems.map(system=>({system,nodes:[],boxes:[]}));
   for(const node of [...original.children]){
    if(['defs','style'].includes(node.tagName.toLowerCase()))continue;let box;try{box=node.getBBox();}catch(e){continue;}
    const center=box.y+box.height/2;let best=0,distance=Infinity;
    systems.forEach((s,i)=>{const p=s.PositionAndShape,lo=(p.AbsolutePosition.y+p.BorderTop)*10,hi=(p.AbsolutePosition.y+p.BorderBottom)*10,d=center<lo?lo-center:center>hi?center-hi:0;if(d<distance){distance=d;best=i;}});
    buckets[best]?.nodes.push(node);buckets[best]?.boxes.push(box);
   }
   for(const {system,nodes,boxes}of buckets){if(!nodes.length)continue;
    const top=Math.min(...boxes.map(b=>b.y))-6,bottom=Math.max(...boxes.map(b=>b.y+b.height))+6,svg=el('svg',{viewBox:`0 ${top} ${width} ${bottom-top}`,preserveAspectRatio:'xMidYMid meet',role:'img','aria-label':'完整钢琴谱行'}),section=document.createElement('section');section.className='song-system-page';
    for(const d of original.querySelectorAll(':scope > defs,:scope > style'))svg.appendChild(d.cloneNode(true));
    const band=el('rect',{class:'song-measure-band',y:top+3,height:bottom-top-6,rx:4,fill:'#edf2fa'}),cursor=el('line',{class:'song-playhead',y1:top+4,y2:bottom-4,stroke:'#4a6c9b','stroke-width':1.4,visibility:'hidden'});svg.append(band,...nodes,cursor);section.appendChild(svg);
    // Clef/key changes can create instruction-only graphical measures with no source bar.
    const measures=system.StaffLines[0].Measures.filter(m=>m.parentSourceMeasure).map(m=>({index:m.parentSourceMeasure.MeasureNumber,x:m.PositionAndShape.AbsolutePosition.x*10,width:m.PositionAndShape.Size.width*10}));
    if(!measures.length)continue;
    section.dataset.from=measures[0]?.index||1;section.dataset.to=measures.at(-1)?.index||1;pages.push({section,svg,band,cursor,measures,top,bottom,width,system});fragments.push(section);
   }
  }
  host.replaceChildren(...fragments);if(!pages.length)throw Error('曲谱未能生成完整谱行。');
  const desired=Math.max(...pages.map(p=>(p.bottom-p.top)/p.width*scroll.clientWidth))*Math.max(.8,zoom),count=Math.max(1,Math.min(2,Math.floor(scroll.clientHeight/Math.max(190,desired))));
  const gap=24,height=(scroll.clientHeight-gap*(count-1))/count;
  for(let i=0;i<pages.length;i+=count){const spread=document.createElement('div');spread.className='song-system-screen';spread.style.height=scroll.clientHeight+'px';host.appendChild(spread);for(const p of pages.slice(i,i+count)){const natural=(p.bottom-p.top)/p.width*(host.clientWidth-40),fit=count===1?height:Math.min(height,natural+20);p.section.style.height=fit+'px';p.section.dataset.height=fit;p.screen=spread;spread.appendChild(p.section);}}
  host.dataset.systemsPerView=count;scroll.scrollTop=0;
 }
 function position(beat,x=null){
  if(!viewport||!sourceSong)return;const measure=sourceSong.measures.find(m=>beat<m.end)||sourceSong.measures.at(-1),page=pages.find(p=>p.measures.some(m=>m.index===measure.index));if(!page)return;
  pages.forEach(p=>{p.section.classList.toggle('current-system',p===page);p.band.setAttribute('visibility',p===page?'visible':'hidden');p.cursor.setAttribute('visibility',p===page?'visible':'hidden');});
  const m=page.measures.find(m=>m.index===measure.index),px=x??m.x+m.width*Math.max(0,Math.min(1,(beat-measure.start)/(measure.end-measure.start)));page.band.setAttribute('x',m.x);page.band.setAttribute('width',Math.max(4,m.width));page.cursor.setAttribute('x1',px);page.cursor.setAttribute('x2',px);
  const top=page.screen.offsetTop,bottom=top+page.screen.offsetHeight;if(top<viewport.scrollTop-1||bottom>viewport.scrollTop+viewport.clientHeight+1)viewport.scrollTop=top;
 }
 function clearMarks(){for(const p of pages)p.svg.querySelectorAll('[data-feedback-marker]').forEach(e=>e.remove());}
 function mark(beat,pitch,type){const m=sourceSong?.measures.find(m=>beat<m.end),p=pages.find(p=>p.measures.some(x=>x.index===m?.index));if(!p)return;const measure=p.measures.find(x=>x.index===m.index),x=measure.x+measure.width*(beat-m.start)/(m.end-m.start);p.svg.appendChild(el('circle',{'data-feedback-marker':type,cx:x,cy:p.bottom-4,r:2.8,fill:type==='hint'||type==='timing'?'#b37c20':'#b33e4b','aria-label':pitch+' '+type}));}
 function state(){return pages.map(p=>({from:+p.section.dataset.from,to:+p.section.dataset.to,height:p.section.clientHeight,rect:p.section.getBoundingClientRect().toJSON()}));}
 window.PianoScoreLayout={mount,position,state,mark,clearMarks,reset:()=>{pages=[];viewport=null;sourceSong=null;}};
})();
