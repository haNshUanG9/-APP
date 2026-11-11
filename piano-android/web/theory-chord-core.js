/* Offline harmonic model. Complete observations are distinct from hypotheses. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ChordCore=api})(typeof window==='object'?window:globalThis,function(){
'use strict';
const mod=n=>(n%12+12)%12;
const ROOTS=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'],LETTERS='CDEFGAB',NATURAL=[0,2,4,5,7,9,11];
const types=[
 ['major','','大三和弦',[0,4,7],['1','3','5'],[0,2,4],[], '大三度上叠小三度，相邻距离4+3半音。'],
 ['minor','m','小三和弦',[0,3,7],['1','♭3','5'],[0,2,4],[], '小三度上叠大三度，相邻距离3+4半音。'],
 ['dim','dim','减三和弦',[0,3,6],['1','♭3','♭5'],[0,2,4],[], '两个小三度叠置，五音比纯五度低半音。'],
 ['aug','aug','增三和弦',[0,4,8],['1','3','♯5'],[0,2,4],[], '两个大三度叠置；对称结构存在三个根音解释。'],
 ['dom7','7','大小七和弦',[0,4,7,10],['1','3','5','♭7'],[0,2,4,6],[7], '大三和弦加小七度；属功能需结合调性。'],
 ['maj7','maj7','大七和弦',[0,4,7,11],['1','3','5','7'],[0,2,4,6],[7], '大三和弦加大七度，七音比普通7高半音。'],
 ['min7','m7','小七和弦',[0,3,7,10],['1','♭3','5','♭7'],[0,2,4,6],[7], '小三和弦加小七度；可与另一根音六和弦同音组。'],
 ['halfDim','m7♭5','半减七和弦',[0,3,6,10],['1','♭3','♭5','♭7'],[0,2,4,6],[], '减三和弦加小七度，也记ø7；与减七的七音相差半音。'],
 ['dim7','dim7','减七和弦',[0,3,6,9],['1','♭3','♭5','♭♭7'],[0,2,4,6],[], '相邻3+3+3半音；减七度9半音，写♭♭7，不写6。'],
 ['sus2','sus2','挂二和弦',[0,2,7],['1','2','5'],[0,1,4],[], '二音替代三音；没有三度，不决定大小性质。'],
 ['sus4','sus4','挂四和弦',[0,5,7],['1','4','5'],[0,3,4],[], '四音替代三音；不等于已经知道它在调里的作用。'],
 ['six','6','大六和弦',[0,4,7,9],['1','3','5','6'],[0,2,4,5],[], '大三和弦加大六度，与另一根音小七同音组。'],
 ['min6','m6','小六和弦',[0,3,7,9],['1','♭3','5','6'],[0,2,4,5],[], '小三和弦加大六度，与另一根音半减七同音组。'],
 ['add9','add9','附加九和弦',[0,4,7,14],['1','3','5','9'],[0,2,4,8],[7], '大三和弦加九音，不包含七音；与9和弦不同。'],
 ['minAdd9','m(add9)','小附加九和弦',[0,3,7,14],['1','♭3','5','9'],[0,2,4,8],[7], '小三和弦加九音，不包含七音。'],
 ['minMaj7','m(maj7)','小大七和弦',[0,3,7,11],['1','♭3','5','7'],[0,2,4,6],[7], '小三和弦加大七度；小三度与大七度分别描述三音和七音。'],
 ['nine','9','属九结构',[0,4,7,10,14],['1','3','5','♭7','9'],[0,2,4,6,8],[7], '大小七和弦加大九度；三音、小七音、九音是性质证据。'],
 ['maj9','maj9','大九和弦',[0,4,7,11,14],['1','3','5','7','9'],[0,2,4,6,8],[7], '大七和弦加大九度；大七音不能省成add9后仍声称maj9。'],
 ['min9','m9','小九和弦',[0,3,7,10,14],['1','♭3','5','♭7','9'],[0,2,4,6,8],[7], '小七和弦加大九度，保留小三音与小七音。'],
 ['eleven','11','属十一结构',[0,4,7,10,14,17],['1','3','5','♭7','9','11'],[0,2,4,6,8,10],[7,14], '含小七音与十一音；大三音与十一音接近，配音需留意碰撞。缺三音时只作不确定假设。'],
 ['min11','m11','小十一和弦',[0,3,7,10,14,17],['1','♭3','5','♭7','9','11'],[0,2,4,6,8,10],[7,14], '小七基础上加入十一音；可省五/九，保留性质音。'],
 ['thirteen','13','属十三结构',[0,4,7,10,14,17,21],['1','3','5','♭7','9','11','13'],[0,2,4,6,8,10,12],[7,14,17], '大小七基础上加入十三音；常省五、九、十一，需明示省略，不假装完整输入。']
].map(([id,suffix,zh,intervals,degrees,steps,optional,rule])=>Object.freeze({id,suffix,zh,intervals,degrees,steps,optional,required:intervals.filter(x=>!optional.includes(x)),rule}));
const byId=id=>types.find(t=>t.id===id);
const pcs=notes=>[...new Set(notes.map(mod))].sort((a,b)=>a-b);
const eq=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
function parseRoot(label){const s=String(label).replace(/#/g,'♯').replace(/b/g,'♭');const letter=LETTERS.indexOf(s[0]);if(letter<0)return null;let alter=[...s.slice(1)].reduce((a,x)=>a+(x==='♯'?1:x==='♭'?-1:0),0);return {letter,alter,pc:mod(NATURAL[letter]+alter),name:s}}
function spell(root,type,rootLabel=ROOTS[mod(root)]){const r=parseRoot(rootLabel);let result={};for(let i=0;i<type.intervals.length;i++){const interval=type.intervals[i],letter=(r.letter+type.steps[i])%7,pc=mod(root+interval);let alter=mod(pc-NATURAL[letter]+6)-6;result[pc]={name:LETTERS[letter]+(alter>0?'♯'.repeat(alter):'♭'.repeat(-alter)),letter,alter,degree:type.degrees[i],interval};}return result}
function note(n,spelling=null,octave=true){const v=spelling?.[mod(n)]||parseRoot(ROOTS[mod(n)]);return (v.name||ROOTS[mod(n)])+(octave?(Math.floor((n-v.alter)/12)-1):'')}
function make(root,type,bass,rootLabel){const spelling=spell(root,type,rootLabel),label=rootLabel||ROOTS[root];const bassName=spelling[mod(bass)]?.name||ROOTS[mod(bass)];return {id:root+':'+type.id,root,typeId:type.id,type,spelling,bass,name:label+type.suffix+(mod(bass)!==root?'/'+bassName:''),rootLabel:label,formula:type.degrees.join(' · ')}}
function exact(notes){const p=pcs(notes),bass=Math.min(...notes);let a=[];if(p.length<3)return a;for(const t of types)for(let r=0;r<12;r++){if(eq(p,pcs(t.intervals.map(x=>x+r))))a.push(make(r,t,bass))}return a.sort((a,b)=>(a.root===mod(bass)?-1:0)-(b.root===mod(bass)?-1:0)||types.indexOf(a.type)-types.indexOf(b.type));}
function hypotheses(notes,options={}){const p=pcs(notes),bass=Math.min(...notes),a=[];if(p.length<3)return a;
 for(const t of types)for(let r=0;r<12;r++){
  const expected=pcs(t.intervals.map(x=>x+r)),missing=expected.filter(x=>!p.includes(x)),extra=p.filter(x=>!expected.includes(x));const match=p.length-extra.length;
  if(!missing.length&&extra.length===1&&t.intervals.length<=4&&p.length<=5){
   const c=make(r,t,bass),lowestOnly=mod(bass)===extra[0]&&notes.filter(n=>mod(n)===extra[0]).length===1&&Math.min(...notes.filter(n=>mod(n)!==extra[0]))-bass>=7;
   a.push({...c,kind:lowestOnly?'bass':'extra',missing,extra,evidence:lowestOnly?'上方音组完整匹配；额外音只在独立低音出现。是否为持续低音还需时间与上下文。':'其中一个完整核心结构可被观察到；额外音的作用未知，不能仅凭瞬时音组认定为经过音。',rank:lowestOnly?2:4});
  }
  if(extra.length||!missing.length||match<3||missing.length>3)continue;
  const missingIntervals=t.intervals.filter(x=>missing.includes(mod(r+x))),omission=missingIntervals.every(x=>t.optional.includes(x));
  const onlyCritical=missing.length===1&&(missing[0]===r||((t.intervals.includes(3)||t.intervals.includes(4))&&[mod(r+3),mod(r+4)].includes(missing[0])));
  if(!omission&&!onlyCritical)continue;
  if(missing.includes(r)&&options.assumedRoot!==r)continue;
  const c=make(r,t,bass);a.push({...c,kind:omission?'omission':'incomplete',missing,extra,evidence:omission?'当前包含根音与必要性质音；按该结构允许省略的音列为配音假设，不等于完整精确匹配。':missing.includes(r)?'若假设这个根音存在，可组成该结构；实际没有弹根音，无法唯一确认。':'缺少决定大小性质的三音；不能唯一判断和弦性质。',rank:omission?1:3});
 }
 return a.sort((a,b)=>a.rank-b.rank||a.missing.length-b.missing.length||a.type.intervals.length-b.type.intervals.length).slice(0,10);
}
function analyze(notes,options={}){const clean=[...new Set(notes.filter(n=>Number.isInteger(n)&&n>=21&&n<=108))].sort((a,b)=>a-b),p=pcs(clean),matches=exact(clean);return {notes:clean,pcs:p,bass:clean[0],status:!clean.length?'empty':p.length<3?'insufficient':matches.length>1?'ambiguous':matches.length?'exact':'unmatched',matches,hypotheses:hypotheses(clean,options)}}
function chordNotes(root,typeId,octave=4){const t=byId(typeId);return t.intervals.map(v=>12*(octave+1)+root+v)}
function keyInfo(label){if(!label||label==='none')return null;const [rootLabel,mode='major']=label.split(':');const r=parseRoot(rootLabel);if(!r)return null;const steps=mode==='minor'?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];const tri=mode==='minor'?['minor','dim','major','minor','minor','major','major']:['major','minor','minor','major','major','minor','dim'];const roman=mode==='minor'?['i','ii°','III','iv','v','VI','VII']:['I','ii','iii','IV','V','vi','vii°'];const scales=steps.map((v,i)=>{let letter=(r.letter+i)%7,pc=mod(r.pc+v),alter=mod(pc-NATURAL[letter]+6)-6;return {pc,label:LETTERS[letter]+(alter>0?'♯'.repeat(alter):'♭'.repeat(-alter)),type:tri[i],roman:roman[i]}});return {root:r.pc,mode,label:rootLabel+(mode==='minor'?'小调':'大调'),scales}}
function functionOf(c,key){if(!key||!c)return null;let i=key.scales.findIndex(s=>s.pc===c.root);if(i<0)return {roman:'调外',role:'非调内根音',diatonic:false};const t=c.type,scale=key.scales[i],inside=t.intervals.every(v=>key.scales.some(x=>x.pc===mod(c.root+v)));let role=[0,2,5].includes(i)?'主功能关联':[1,3].includes(i)?'下属功能关联':'属功能关联';if(key.mode==='minor'&&i===4&&['major','dom7'].includes(t.id))return {roman:'V'+(t.id==='dom7'?'⁷':''),role:'和声小调中的属功能',diatonic:true};if(!inside)return {roman:scale.roman+'（变体）',role:'根音在调内，性质含调外音',diatonic:false};let roman=scale.roman;if(t.id==='halfDim')roman=roman.replace('°','')+'ø⁷';else if(t.id==='dim7')roman=roman.replace('°','')+'°⁷';else if(t.id==='maj7')roman+='maj⁷';else if(t.id==='minMaj7')roman+='(maj⁷)';else if(['min7','dom7'].includes(t.id))roman+='⁷';else if(t.intervals.length>3)roman+='('+t.suffix+')';return {roman,role,diatonic:true}}
function voiceLead(source,root,typeId){const t=byId(typeId),ps=pcs(t.intervals.map(x=>root+x));const src=[...source].sort((a,b)=>a-b);const count=Math.max(src.length,ps.length);let best=null;
 for(const bass of [root+36,root+48]){let pool=[];for(let n=Math.max(bass+1,45);n<=84;n++)if(ps.includes(mod(n)))pool.push(n);
  function search(arr,start){if(arr.length===count){if(ps.some(pc=>!arr.some(n=>mod(n)===pc)))return;let cost=arr.reduce((sum,n,i)=>sum+Math.abs(n-(src[Math.min(i,src.length-1)]??(48+i*5))),0)+Math.abs(arr[arr.length-1]-72)*.08;if(!best||cost<best.cost)best={notes:[...arr],cost};return}for(let i=start;i<pool.length;i++){if(arr.length>1&&pool[i]-arr[arr.length-1]>14)continue;if(pool.length-i<count-arr.length)break;search([...arr,pool[i]],i+1)}}
  if(count<=7)search([bass],0);
 }
 if(!best){const notes=ps.map(pc=>48+mod(pc-root)+root).sort((a,b)=>a-b);best={notes,cost:0}}
 const n=best.notes,moves=n.map((to,i)=>({from:src[Math.min(i,src.length-1)],to,delta:to-src[Math.min(i,src.length-1)],added:i>=src.length}));return {...best,moves};
}
function recommend(current,source,keyLabel,goal='continue'){
 if(!current||!source.length)return [];
 const key=keyInfo(keyLabel);let specs=[];
 if(key){const currentIndex=key.scales.findIndex(x=>x.pc===current.root);let indices=goal==='close'?[0,4,5]:goal==='expand'?[3,1,5]:[5,3,4];if(currentIndex===4)indices=goal==='expand'?[5,3,0]:[0,5,3];else if(currentIndex===1||currentIndex===6)indices=[4,0,5];
  for(const i of indices){const s=key.scales[i];let type=s.type;if(i===4)type='dom7';if(s.pc===current.root&&type===current.typeId)continue;specs.push({root:s.pc,typeId:type,rootLabel:s.label,index:i})}
  if(specs.length<3)for(const s of key.scales){if(s.pc!==current.root&&!specs.some(x=>x.root===s.pc))specs.push({root:s.pc,typeId:s.type,rootLabel:s.label,index:key.scales.indexOf(s)});if(specs.length===3)break;}
 }else{specs=[{root:mod(current.root+5),typeId:'major'},{root:mod(current.root+9),typeId:'minor'},{root:mod(current.root+7),typeId:'dom7'}]}
 return specs.slice(0,3).map(s=>{const v=voiceLead(source,s.root,s.typeId),c=make(s.root,byId(s.typeId),v.notes[0],s.rootLabel),fn=functionOf(c,key);const common=pcs(source).filter(x=>pcs(v.notes).includes(x));let explanation=key?`${key.label}背景下，${fn.roman}：${fn.role}。`:'未确认调性：以下仅作音程与共同音比较，不声称调内功能。';
  if(key&&s.index===4)explanation+='可用于准备收束；之后尝试主和弦，比较倾向音。';else if(key&&s.index===0)explanation+='尝试回到主和弦；是否形成结尾还取决于旋律与节奏。';else if(key&&[1,3].includes(s.index))explanation+='可作为展开或向属和弦推进的一种方向。';else if(key)explanation+='可以继续展开，比较共同音与色彩。';
  return {...c,notes:v.notes,moves:v.moves,common,explanation,context:key?.label||'未定调',function:fn,goal};
 });
}
return Object.freeze({ROOTS,types,byId,mod,pcs,eq,parseRoot,spell,note,make,exact,hypotheses,analyze,chordNotes,keyInfo,functionOf,voiceLead,recommend});
});
