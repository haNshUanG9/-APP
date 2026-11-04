/* Explicit curricula, per-task evidence and persistent, bounded retrieval queues. */
'use strict';
const LearningCore=(()=>{
  const C=PianoCore,DAY=86400000,MAX_EXTRA=12;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const defaults=()=>({version:1,tracks:{},memory:{},sessions:{},phrases:{},rhythm:{}});
  const input=x=>x==='midi'?'midi':'touch';
  const taskFor=kind=>kind==='reverse'?'staff':kind==='phrase'?'phrase':'keyboard';
  const memoryKey=(t,task='keyboard',source='touch')=>[task,input(source),C.profileKey(t)].join('|');
  const target=k=>{const [clef,n]=k.split(':');return {clef,note:C.parse(n)};};
  const validKey=k=>typeof k==='string'&&/^(treble|bass):[A-G][2-6]$/.test(k);
  const integer=(n,lo,hi,fallback=lo)=>Number.isInteger(n)&&n>=lo&&n<=hi?n:fallback;
  const finite=(n,fallback=0)=>Number.isFinite(n)&&n>=0?n:fallback;
  function normalize(raw){
    const d=defaults();if(!raw||typeof raw!=='object')return d;
    for(const [k,m]of Object.entries(raw.memory||{}).slice(0,600)){
      if(!/^(keyboard|staff|phrase)\|(midi|touch)\|(treble|bass):[A-G][2-6]$/.test(k)||!m)continue;
      d.memory[k]={stage:integer(m.stage,0,4),due:finite(m.due),successes:integer(m.successes,0,100000),relearning:m.relearning===true,reviewFails:integer(m.reviewFails,0,100000),last:finite(m.last),samples:(Array.isArray(m.samples)?m.samples:[]).filter(s=>s&&typeof s.ok==='boolean'&&typeof s.hint==='boolean'&&Number.isFinite(s.at)).slice(-24).map(s=>({ok:s.ok,hint:s.hint,hintLevel:integer(s.hintLevel,s.hint?1:0,3),at:s.at,session:typeof s.session==='string'?s.session.slice(0,70):'',position:integer(s.position,0,200),retest:s.retest===true}))};
    }
    for(const [k,t]of Object.entries(raw.tracks||{}).slice(0,30))if(/^(anchors|contrast|ledger|reverse)\|(treble|bass|mixed)\|(midi|touch)$/.test(k)&&t){
      d.tracks[k]={unit:integer(t.unit,0,100),passed:(Array.isArray(t.passed)?t.passed:[]).filter(Number.isInteger).slice(0,100),last:finite(t.last)};
    }
    for(const [k,s]of Object.entries(raw.sessions||{}).slice(0,30)){
      if(!d.tracks[k]||!s||!Array.isArray(s.plan)||s.plan.length>60||!s.plan.every(validKey)||!Array.isArray(s.retries))continue;
      const retries=s.retries.filter(r=>r&&validKey(r.key)&&Number.isInteger(r.due)&&r.due>=0&&r.due<240).slice(0,20).map(r=>({key:r.key,due:r.due,phase:r.phase===2?2:1}));
      const focus=(Array.isArray(s.focus)?s.focus:[]).filter(validKey).slice(0,3);if(!focus.length)continue;
      d.sessions[k]={id:typeof s.id==='string'?s.id.slice(0,70):'restored',track:k,unit:integer(s.unit,0,100),focus,plan:[...s.plan],cursor:integer(s.cursor,0,s.plan.length),done:integer(s.done,0,200),extra:integer(s.extra,0,MAX_EXTRA),retries,attempts:Object.fromEntries(Object.entries(s.attempts||{}).filter(([key,n])=>validKey(key)&&Number.isInteger(n)&&n>=0&&n<=3)),stats:Object.fromEntries([...new Set([...focus,...Object.keys(s.stats||{}).filter(validKey)])].slice(0,60).map(key=>{const v=s.stats?.[key]||{};return [key,{clean:integer(v.clean,0,200),last:integer(v.last,0,200),spaced:v.spaced===true,needs:v.needs===true}];})),current:s.current&&validKey(s.current.key)&&['plan','retest'].includes(s.current.type)?{key:s.current.key,type:s.current.type,phase:s.current.phase===2?2:1,position:integer(s.current.position,0,200),tail:s.current.tail===true,hintLevel:integer(s.current.hintLevel,0,3)}:null};
    }
    for(const [k,p]of Object.entries(raw.phrases||{}).slice(0,8))if(/^(treble|bass)\|(touch|midi)$/.test(k)&&p){
      const valid=ex=>ex&&Array.isArray(ex.events)&&ex.events.length<=50&&ex.events.every(e=>Number.isFinite(e.beat)&&e.beat>=0&&[.5,1,2,4].includes(e.duration)&&Array.isArray(e.targets)&&e.targets.every(t=>t&&['treble','bass'].includes(t.clef)&&t.note&&Number.isInteger(t.note.index)&&t.note.index>=14&&t.note.index<=48))&&Number.isFinite(ex.totalBeats)&&ex.totalBeats>0&&ex.totalBeats<=64;
      const renewed=integer(p.unit,0,7)>=6&&p.contentVersion!==2;
      d.phrases[k]={unit:integer(p.unit,0,7),phase:renewed?0:integer(p.phase,0,3),exercise:!renewed&&valid(p.exercise)?clone(p.exercise):null,base:!renewed&&valid(p.base)?clone(p.base):null,contentVersion:2};
    }
    for(const [k,p]of Object.entries(raw.rhythm||{}).slice(0,200))if(k.length<140&&/^[a-z0-9|_./-]+$/i.test(k)&&p){
      const state={unit:integer(p.unit,0,6),phase:integer(p.phase,0,3),clean:integer(p.clean,0,100)};
      if(k.split('|').length===3){state.pattern=integer(p.pattern,0,100);state.revision=integer(p.revision,1,1000000000);state.completed=p.completed===true;state.evidence={};for(const [ek,v] of Object.entries(p.evidence||{}).slice(0,200))if(ek.length<100&&/^[a-z0-9|_./-]+$/i.test(ek))state.evidence[ek]=integer(v,0,1000000);}
      d.rhythm[k]=state;
    }
    return d;
  }
  const rawUnits={
    anchors:{treble:[['G4'],['G4','F4'],['F4','G4','A4'],['C4','D4'],['C4','D4','E4'],['C5','B4'],['B4','C5','D5'],['E4','F4','G4'],['A4','B4','C5'],['D5','E5','F5']],bass:[['F3'],['F3','E3'],['E3','F3','G3'],['C3','D3'],['C3','D3','E3'],['C4','B3'],['A3','B3','C4'],['G2','A2','B2'],['G3','A3','B3']]},
    contrast:{treble:[['F4','G4'],['G4','A4'],['B4','C5'],['C4','D4'],['D4','E4'],['E4','F4'],['F4','A4'],['G4','B4'],['C4','C5'],['G4','G5']],bass:[['E3','F3'],['F3','G3'],['B2','C3'],['C3','D3'],['A3','B3'],['B3','C4'],['E3','G3'],['F3','A3'],['C3','C4'],['G2','G3']]},
    ledger:{treble:[['C4'],['B3','C4'],['A3','B3','C4'],['A5'],['A5','B5'],['B5','C6'],['G3','A3']],bass:[['C4'],['B3','C4'],['C4','D4'],['D4','E4'],['E2'],['D2','E2'],['C2','D2','E2']]}
  };
  function units(kind,clef){
    const source=rawUnits[kind==='reverse'?'anchors':kind]||rawUnits.anchors;
    const cs=clef==='mixed'?['treble','bass']:[clef==='bass'?'bass':'treble'];
    return cs.flatMap(c=>source[c].map((notes,i)=>({id:kind+':'+c+':'+i,clef:c,keys:notes.map(n=>c+':'+n),title:(c==='treble'?'高音':'低音')+' · '+notes.join(' / '),reference:kind==='ledger'?(c==='treble'?(C.parse(notes[0]).midi>72?'F5':'C4'):(C.parse(notes[0]).midi<48?'G2':'C4')):notes.includes(c==='treble'?'G4':'F3')?(c==='treble'?'G4':'F3'):notes.includes('C4')?'C4':notes.includes(c==='treble'?'C5':'C3')?(c==='treble'?'C5':'C3'):notes[0]})));
  }
  const trackKey=(kind,clef,source)=>[kind,clef==='dual'?'mixed':clef,input(source)].join('|');
  function track(d,kind,clef,source){const key=trackKey(kind,clef,source);return d.tracks[key]||(d.tracks[key]={unit:0,passed:[],last:0});}
  function info(d,kind,clef,source){const key=trackKey(kind,clef,source),t=track(d,kind,clef,source),all=units(kind,clef),index=Math.min(t.unit,all.length-1),unit=all[index];return {key,track:t,unit,index,total:all.length,complete:t.unit>=all.length,pending:!!d.sessions[key]};}
  function evidence(d,t,task,source){return d.memory[memoryKey(t,task,source)];}
  function observe(d,t,result,now=Date.now()){
    const key=memoryKey(t,result.task||'keyboard',result.input||'touch');let m=d.memory[key];
    if(!m)m=d.memory[key]={stage:0,due:0,successes:0,relearning:false,reviewFails:0,last:0,samples:[]};
    const ok=!!result.firstCorrect&&!result.hint&&!result.paused;
    m.samples.push({ok,hint:!!result.hint,hintLevel:integer(result.hintLevel,result.hint?1:0,3),at:now,session:result.session||'',position:result.position||0,retest:!!result.retest});m.samples=m.samples.slice(-24);m.last=now;
    if(!ok){m.successes=0;m.relearning=true;m.due=now+600000;if(result.review)m.reviewFails++;return m;}
    m.successes++;
    /* Acquisition does not cancel a scheduled relearning check. Ordinary practice never upgrades a review stage. */
    if(m.stage===0&&!m.relearning&&m.successes>=4){m.stage=1;m.due=now+DAY;}
    else if(result.review&&m.due>0&&now>=m.due&&result.confirmed){
      m.stage=m.relearning?1:Math.min(4,m.stage+1);m.relearning=false;m.due=now+[0,1,3,7,14][m.stage]*DAY;
    }
    return m;
  }
  function due(d,source,now=Date.now()){
    return Object.entries(d.memory).filter(([k,m])=>k.split('|')[1]===input(source)&&m.due>0&&m.due<=now).sort((a,b)=>a[1].due-b[1].due).map(([key,m])=>({key,task:key.split('|')[0],target:target(key.split('|')[2]),memory:m}));
  }
  function start(d,kind,clef,source,count=20){
    const i=info(d,kind,clef,source);if(d.sessions[i.key])return d.sessions[i.key];
    const focus=i.unit.keys,all=units(kind,clef),old=[...new Set(all.slice(0,i.index).flatMap(u=>u.keys))].filter(k=>!focus.includes(k)),N=[10,20,40,60].includes(count)?count:20,plan=[];
    for(let n=0;n<N;n++){
      /* First exposures are focused; later blocks change order and retain one old target in five. */
      if(n>=focus.length*3&&old.length&&n%5===4)plan.push(old[Math.floor(n/5)%old.length]);
      else {const block=Math.floor(n/focus.length),pos=n%focus.length;plan.push(focus[(block%2?focus.length-1-pos:pos+Math.floor(block/2))%focus.length]);}
    }
    const session={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),track:i.key,unit:i.index,focus:[...focus],plan,cursor:0,done:0,extra:0,retries:[],attempts:{},stats:Object.fromEntries(focus.map(k=>[k,{clean:0,last:0,spaced:false,needs:false}])),current:null};d.sessions[i.key]=session;return session;
  }
  function next(s){
    if(s.current)return s.current;
    const r=s.extra<MAX_EXTRA?s.retries.find(x=>x.due<=s.done):null;
    if(r){s.retries.splice(s.retries.indexOf(r),1);s.extra++;return s.current={key:r.key,type:'retest',phase:r.phase,position:s.done};}
    if(s.cursor<s.plan.length)return s.current={key:s.plan[s.cursor++],type:'plan',phase:0,position:s.done};
    if(s.retries.length&&s.extra<MAX_EXTRA){const item=s.retries.sort((a,b)=>a.due-b.due)[0];s.retries.shift();s.extra++;return s.current={key:item.key,type:'retest',phase:item.phase,position:s.done,tail:true};}
    return null;
  }
  function record(s,result){
    const item=s.current;if(!item)return;
    const good=result.correct&&!result.hint&&!result.paused,k=item.key,v=s.stats[k]||(s.stats[k]={clean:0,last:0,spaced:false,needs:false});
    s.done++;
    if(good){v.clean++;if(v.last>0&&s.done-v.last>=2)v.spaced=true;if(item.type==='retest'&&!item.tail&&s.done-v.last>=3)v.spaced=true;v.last=s.done;
      if(item.type==='retest'&&item.phase===1){s.retries.push({key:k,due:s.done+6,phase:2});}
      if(item.type==='retest'&&item.phase===2){v.needs=!!item.tail;}
    }else{
      v.clean=0;v.spaced=false;v.needs=true;v.last=s.done;
      s.retries=s.retries.filter(r=>r.key!==k);s.attempts[k]=(s.attempts[k]||0)+1;
      if(s.attempts[k]<=3)s.retries.push({key:k,due:s.done+2,phase:1});
    }
    s.current=null;
  }
  function summary(s){return {planned:s.plan.length,completed:s.done,extra:s.extra,pending:s.retries.length,focus:s.focus.map(key=>({key,...s.stats[key]})),passed:Object.values(s.stats).every(v=>!v.needs)&&s.retries.length===0&&s.focus.every(k=>s.stats[k].clean>=4&&!s.stats[k].needs&&(s.stats[k].spaced||s.focus.length===1&&s.stats[k].clean>=6))};}
  function finish(d,s,complete){
    const result=summary(s),t=d.tracks[s.track];
    if(complete&&result.passed){if(!t.passed.includes(s.unit))t.passed.push(s.unit);t.unit=Math.max(t.unit,s.unit+1);t.last=Date.now();delete d.sessions[s.track];}
    else if(complete){
      /* Start a fresh focused block next time, preserving the unresolved retrieval tasks. */
      s.cursor=0;s.done=0;s.extra=0;s.current=null;s.retries=Object.keys(s.stats).filter(k=>s.stats[k].needs).map(k=>({key:k,due:2,phase:1}));s.attempts={};s.stats=Object.fromEntries(Object.keys(s.stats).map(k=>[k,{clean:s.stats[k].clean,last:0,spaced:s.stats[k].spaced,needs:s.stats[k].needs}]));
    }
    return result;
  }
  function known(d,clef,source){const t=d.tracks[trackKey('anchors',clef,source)];return t?[...new Set(units('anchors',clef).slice(0,t.unit).flatMap(u=>u.keys))].map(target):[];}
  const phraseSets={treble:[['G4','F4'],['F4','G4','A4'],['C4','D4','E4'],['E4','F4','G4'],['A4','B4','C5'],['B4','C5','D5'],['C4','D4','E4','F4','G4'],['G4','A4','B4','C5','D5']],bass:[['F3','E3'],['E3','F3','G3'],['C3','D3','E3'],['G2','A2','B2'],['G3','A3','B3'],['A3','B3','C4'],['C3','D3','E3','F3','G3'],['G2','A2','B2','C3','D3']]};
  function phraseInfo(d,clef,source){const c=clef==='bass'?'bass':'treble',key=c+'|'+input(source),p=d.phrases[key]||(d.phrases[key]={unit:0,phase:0,exercise:null,base:null}),notes=phraseSets[c][p.unit],unlocked=notes.every(n=>evidence(d,{clef:c,note:C.parse(n)},'keyboard',source)?.successes>=4);return {key,state:p,clef:c,notes,unlocked,labels:['认准这一句','同句无提示','同句跟拍','小变体检查']};}
  function phraseExercise(d,clef,source){
    const i=phraseInfo(d,clef,source),p=i.state;
    if(p.unit>=6&&p.contentVersion!==2){p.phase=0;p.exercise=null;p.base=null;}
    p.contentVersion=2;if(p.exercise)return clone(p.exercise);
    const ns=i.notes.map(C.parse),order=ns.length===5?[0,1,2,3,4,2]:ns.length===3?[0,1,2,1,0,2]:[0,1,0,1,1,0];
    if(p.phase===3){if(ns.length===5)order.splice(0,6,0,2,1,3,2,4);else order[2]=ns.length===2?1:0;}
    const events=order.map((j,n)=>{const targets=[{clef:i.clef,note:ns[j]}];return {beat:n,duration:1,rest:false,targets,voices:[{targets:clone(targets),duration:1}]};});
    events.push({beat:6,duration:2,rest:true,targets:[],voices:[]});p.exercise={events,totalBeats:8,clefs:[i.clef]};if(p.phase===0)p.base=clone(p.exercise);return clone(p.exercise);
  }
  function phraseResult(d,key,report){
    const p=d.phrases[key];if(!p)return;const a=report.answers,clean=report.complete&&a.length>0&&a.every(x=>x.correct&&(p.phase===0||!x.hint))&&!(report.extras||[]).length;
    const timed=report.flow!=='guided',onTime=!timed||a.every(x=>x.delta!==null&&Math.abs(x.delta)<=60000/report.settings.tempo*.18);
    const pass=clean&&onTime&&!report.paused;
    if(pass){if(p.phase<3){p.phase++;if(p.phase===3)p.exercise=null;}else{p.unit=Math.min(7,p.unit+1);p.phase=0;p.exercise=null;p.base=null;}}
    return {passed:pass,phase:p.phase,unit:p.unit};
  }
  return Object.freeze({defaults,normalize,units,info,trackKey,taskFor,memoryKey,target,evidence,observe,due,start,next,record,summary,finish,known,phraseInfo,phraseExercise,phraseResult,MAX_EXTRA});
})();
if(typeof globalThis!=='undefined')globalThis.LearningCore=LearningCore;
