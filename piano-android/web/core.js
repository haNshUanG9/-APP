'use strict';
const PianoCore=(()=>{
 const LETTERS=['C','D','E','F','G','A','B'],SOLFEGE=['Do','Re','Mi','Fa','Sol','La','Si'];
 const SEMITONES=[0,2,4,5,7,9,11],RANGES={beginner:{treble:['E4','F5'],bass:['G2','A3']},basic:{treble:['C4','A5'],bass:['E2','C4']},extended:{treble:['G3','C6'],bass:['C2','E4']}};
 const MODES={treble:'高音识谱',bass:'低音识谱',mixed:'混合识谱',dual:'双谱表识谱'};
 const DEFAULT={mode:'mixed',difficulty:'beginner',noteCount:1,strategy:'adaptive',selectedNotes:[],timing:'auto',secondsPerNote:10,limit:10,count:20};
 function parse(s){const m=/^([A-G])(\d)$/.exec(s);if(!m)throw Error('Invalid pitch');const letter=LETTERS.indexOf(m[1]),octave=+m[2];return fromIndex(octave*7+letter);}
 function fromIndex(index){const octave=Math.floor(index/7),letter=((index%7)+7)%7;return{letter,octave,index,midi:(octave+1)*12+SEMITONES[letter]};}
 function label(n){return `${SOLFEGE[n.letter]}（${LETTERS[n.letter]}${n.octave}）`;}
 function short(n){return LETTERS[n.letter]+n.octave;}
 function profileKey(t){return t.clef+':'+short(t.note);}
 function pool(d,c){const r=RANGES[d][c],lo=parse(r[0]).index,hi=parse(r[1]).index;return Array.from({length:hi-lo+1},(_,i)=>fromIndex(lo+i));}
 function shuffle(a,random=Math.random){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
 function median(a){if(!a.length)return null;const v=[...a].sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;}
 function totalLimit(settings,n=settings.noteCount){return settings.timing==='unlimited'?0:settings.timing==='auto'?settings.secondsPerNote*n:settings.limit;}
 function observe(profiles,target,sample){if(!sample.reached)return;const key=profileKey(target);let p=profiles[key];if(!p)p=profiles[key]={target:{clef:target.clef,note:{...target.note}},seen:0,errors:0,samples:[]};p.seen++;if(!sample.firstCorrect)p.errors++;p.samples.push({firstCorrect:!!sample.firstCorrect,hint:!!sample.hint,hintLevel:Number.isInteger(sample.hintLevel)?sample.hintLevel:0,firstMs:!sample.hint&&Number.isFinite(sample.firstMs)?Math.max(0,sample.firstMs):null,completionMs:Number.isFinite(sample.completionMs)?Math.max(0,sample.completionMs):null,completed:!!sample.completed,timeout:!!sample.timeout,paused:!!sample.paused,context:sample.context||null,date:sample.date||new Date().toISOString()});p.samples=p.samples.slice(-20);p.last=p.samples.at(-1).date;}
 function baseline(profiles,clef,context=null){const medians=Object.values(profiles).filter(p=>p.target.clef===clef).map(p=>median(p.samples.filter(s=>s.firstCorrect&&!s.hint&&!s.paused&&s.firstMs!==null&&(!context||s.context===context)).slice(-8).map(s=>s.firstMs))).filter(x=>x!==null);return median(medians)||2000;}
 function weakness(profile,base,context=null){if(!profile||!profile.samples.length)return{score:0,error:false,slow:false,time:null,threshold:Math.max(2000,base*1.5),recentRate:0};const recent=profile.samples.slice(-12);const good=recent.filter(s=>s.firstCorrect&&!s.hint&&!s.paused&&s.firstMs!==null&&(!context||s.context===context)),time=median(good.slice(-8).map(s=>s.firstMs)),rate=recent.filter(s=>!s.firstCorrect||s.hint).length/recent.length,stable=recent.length>=5&&recent.slice(-5).every(s=>s.firstCorrect&&!s.hint),threshold=Math.max(2000,base*1.5),error=!stable&&rate>0,slow=good.length>=3&&time>threshold;const errorScore=error?(rate*4+(recent.at(-1).firstCorrect&&!recent.at(-1).hint?0:1)):0,slowScore=slow?Math.min(3,(time/threshold-1)*2+.5):0;return{score:Math.min(8,errorScore+slowScore),error,slow,time,threshold,recentRate:rate};}
 function trialContext(settings,full=settings.fullKeyboard){return settings.difficulty+':'+(settings.noteCount===1?'single':'sequence')+':'+(full?'88':'local')+(settings.input==='midi'?':midi':'');}
 function weakTargets(profiles,clef,notes,context=null){const base=baseline(profiles,clef,context);return notes.map(note=>{const target={clef,note},p=profiles[profileKey(target)],w=weakness(p,base,context);return{...target,...w};}).filter(t=>t.score>0);}
 function weighted(items,random){const sum=items.reduce((s,t)=>s+t.score,0);let r=random()*sum;for(const t of items){r-=t.score;if(r<0)return t;}return items.at(-1);}
 function clefsFor(mode){return mode==='treble'?['treble']:mode==='bass'?['bass']:['treble','bass'];}
 function practicePool(settings,profiles={}){
  const selected=new Set(settings.selectedNotes||[]),notes={},weak={};
  for(const c of ['treble','bass']){
   const full=pool(settings.difficulty,c);
   weak[c]=weakTargets(profiles,c,full,trialContext(settings));
   notes[c]=settings.strategy==='custom'?full.filter(n=>selected.has(profileKey({clef:c,note:n}))):settings.strategy==='weak'?weak[c].map(t=>t.note):full;
  }
  return{notes,weak,missing:clefsFor(settings.mode).filter(c=>!notes[c].length)};
 }
 /* Restricted pools are fixed for a round; adaptive weights still refresh every question. */
 function createGenerator(settings,getProfiles=()=>({}),random=Math.random){
  const resolved=practicePool(settings,getProfiles());
  if(resolved.missing.length)throw Error('所选谱表没有可练习的音');
  const schedule=settings.mode==='mixed'?shuffle(Array.from({length:settings.count},(_,i)=>i%2?'bass':'treble'),random):Array(settings.count).fill(settings.mode);
  const bags={treble:[],bass:[]},last={};
  function balanced(c){
   if(!bags[c].length)bags[c]=shuffle(resolved.notes[c],random);
   if(bags[c].at(-1).index===last[c]&&bags[c].length>1)[bags[c][0],bags[c][bags[c].length-1]]=[bags[c].at(-1),bags[c][0]];
   return bags[c].pop();
  }
  function take(c){
   const notes=resolved.notes[c],profiles=getProfiles();let note,source='coverage';
   if(settings.strategy==='weak'){
    let candidates=resolved.weak[c].filter(t=>t.note.index!==last[c]);
    if(!candidates.length)candidates=resolved.weak[c];
    note=weighted(candidates,random).note;source='weakOnly';
   }else{
    const weak=settings.strategy==='adaptive'?weakTargets(profiles,c,notes,trialContext(settings)).filter(t=>t.note.index!==last[c]):[],r=random();
    if(settings.strategy==='adaptive'&&r<.6&&weak.length){note=weighted(weak,random).note;source='weak';}
    else if(settings.strategy==='adaptive'&&r>=.9){const available=notes.filter(n=>n.index!==last[c]);note=available[Math.floor(random()*available.length)];source='random';}
    else{note=balanced(c);if(settings.strategy==='custom')source='custom';}
   }
   if(note.index===last[c]&&notes.length>1)note=notes.find(n=>n.index!==last[c]);
   last[c]=note.index;return{clef:c,note:{...note},source};
  }
  return{next(id){const mode=schedule[id-1]||settings.mode,N=settings.noteCount;const targets=[];
   for(let i=0;i<N;i++){const c=mode==='dual'?(i%2===1?'bass':i===N-1&&N%2===1&&id%2===0?'bass':'treble'):mode;targets.push({...take(c),group:mode==='dual'?Math.floor(i/2):i});}
   return{id,targets};
  }};
 }
 function generate(settings,random=Math.random,profiles={}){const g=createGenerator(settings,()=>profiles,random);return Array.from({length:settings.count},(_,i)=>g.next(i+1));}
 function location(c,n){const d=n.index-parse(c==='treble'?'E4':'G2').index,pre=c==='treble'?'高音谱表':'低音谱表';if(d>=0&&d<=8)return `${pre}第${d%2?(d+1)/2:(d/2+1)}${d%2?'间':'线'}`;if(d<0)return `${pre}下加${Math.ceil(-d/2)}${d%2?'间':'线'}`;return `${pre}上加${Math.ceil((d-8)/2)}${d%2?'间':'线'}`;}
 function ledgerOffsets(d){let r=[];if(d<0)for(let k=-2;k>=d;k-=2)r.push(k);if(d>8)for(let k=10;k<=d;k+=2)r.push(k);return r;}
 function report(records,settings,complete){
  const statuses={firstCorrect:0,assisted:0,corrected:0,wrongTimeout:0,noAnswerTimeout:0,stopped:0},per={treble:{seen:0,correct:0},bass:{seen:0,correct:0}};
  let seen=0,correct=0,completed=0,unseen=0,assisted=0;const times=[];
  records.forEach(r=>{statuses[r.status]++;r.slots.forEach((s,i)=>{const c=r.targets[i].clef;if(s.reached){seen++;if(s.hint)assisted++;else{per[c].seen++;if(s.firstCorrect){correct++;per[c].correct++;if(!s.paused&&s.firstMs!==null)times.push(s.firstMs);}}if(s.completed)completed++;}else unseen++;});});
  const evaluated=records.length-statuses.stopped,unaided=seen-assisted;
  return{id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),version:3,date:new Date().toISOString(),settings:{...settings},complete,records:records.map(r=>({...r})),total:records.length,statuses,accuracy:evaluated?statuses.firstCorrect/evaluated:0,completion:evaluated?(statuses.firstCorrect+statuses.corrected+statuses.assisted)/evaluated:0,noteAccuracy:unaided?correct/unaided:null,seenNotes:seen,unaidedNotes:unaided,assistedNotes:assisted,correctNotes:correct,completedNotes:completed,unseenNotes:unseen,medianMs:median(times),speedSamples:times.length,per};
 }
 function midiName(m){const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];return names[m%12]+(Math.floor(m/12)-1);}
 function keyboardRange(settings,full){if(full)return[21,108];const cs=settings.mode==='treble'?['treble']:settings.mode==='bass'?['bass']:['treble','bass'];let nums=cs.flatMap(c=>C.RANGES[settings.difficulty][c].map(parse).map(n=>n.midi));return[Math.floor(Math.min(...nums)/12)*12,Math.floor(Math.max(...nums)/12)*12+11];}
 const C={LETTERS,SOLFEGE,SEMITONES,RANGES,MODES,DEFAULT,parse,fromIndex,label,short,profileKey,pool,shuffle,median,totalLimit,observe,baseline,weakness,weakTargets,trialContext,clefsFor,practicePool,createGenerator,generate,location,ledgerOffsets,report,midiName,keyboardRange};return Object.freeze(C);
})();
if(typeof globalThis!=='undefined')globalThis.PianoCore=PianoCore;
