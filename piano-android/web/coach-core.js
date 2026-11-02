/* Evidence-based practice choices. A report is evidence, not a diagnosis of the person. */
'use strict';
const CoachCore=(()=>{
  const natural=m=>Number.isInteger(m)&&m>=21&&m<=108&&[0,2,4,5,7,9,11].includes(m%12);
  const copy=x=>JSON.parse(JSON.stringify(x));
  const clampTempo=n=>Math.max(30,Math.min(240,Math.round(Number(n)||60)));
  function focus(report){
    const xs=(report.answers||[]).filter(a=>natural(a.expected)&&['treble','bass'].includes(a.clef));
    const score=new Map();xs.forEach(a=>{const key=a.clef+':'+a.expected,v=score.get(key)||{clef:a.clef,midi:a.expected,weight:0};v.weight+=!a.correct?3:a.hint?2:0;score.set(key,v);});
    return [...score.values()].filter(x=>x.weight>0).sort((a,b)=>b.weight-a.weight).slice(0,3).map(({clef,midi})=>({clef,midi}));
  }
  function study(report={}){
    const a=Array.isArray(report.answers)?report.answers:[],timed=report.flow!=='guided',beat=60000/clampTempo(report.settings?.tempo),matched=a.filter(x=>Number.isInteger(x.actual)),wrong=matched.filter(x=>!x.correct),octaves=wrong.filter(x=>x.actual!==x.expected&&(x.actual-x.expected)%12===0),hints=a.filter(x=>x.hint),misses=a.filter(x=>x.actual===null),late=matched.filter(x=>x.correct&&Number.isFinite(x.delta)&&Math.abs(x.delta)>beat*.18),extras=Array.isArray(report.extras)?report.extras.length:0;
    const evidence={seen:a.length,matched:matched.length,wrong:wrong.length,octaves:octaves.length,hints:hints.length,missed:misses.length,timing:late.length,extras};
    const phrase=report.kind==='phrase'||!!report.exercise;
    const out=(code,title,reason,label,action,secondary='')=>({code,title,reason,label:action==='repeat'&&!phrase?'保持范围再练一轮':label,action:action==='repeat'&&!phrase?'continue':action,secondary,evidence,focus:focus(report)});
    if(report.paused)return out('interrupted','这轮有中断，先续练同一内容','暂停会改变时间条件；这一轮不据此判断你的主要困难。','同一内容继续练','repeat');
    if(a.length<4)return out('observe','先积累一小段独立表现',`本轮只有 ${a.length} 个已评估音，暂不判断哪项能力最薄弱。`,'同一内容再练','repeat');
    if(octaves.length>=2&&octaves.length>=wrong.length/2)return out('octave','先把八度和琴键位置对上',`本轮 ${octaves.length} 次错键与目标相差整八度，先固定这些音练键盘位置。`,'固定这几个音练位置','pitch',hints.length>=2?'还有提示使用记录，复练时逐步收起。':'');
    if(wrong.length>=2)return out('pitch','先认准当前音组',`本轮 ${wrong.length} 个起点匹配到了不同音高，先撤去跟拍压力，认准出错的音。`,'缩小音组，不限时练','pitch',timed&&(late.length+misses.length+extras>=2)?'起拍也有不稳定记录，先解决音高，再回到原句。':'');
    const pitchStable=matched.length>=4&&matched.filter(x=>x.correct&&!x.hint).length/matched.length>=.8;
    if(timed&&pitchStable&&late.length+misses.length+extras>=2)return out('timing','固定音组，先把这一小节的拍子练稳',`已匹配按键的音高较稳定；另有 ${late.length} 次明显起拍偏差、${misses.length} 次漏按、${extras} 次多按。`,'提取出错小节练节奏','rhythm');
    if(hints.length>=2&&hints.length/a.length>=.4)return out('hint','先检查撤掉提示后能否认出',`本轮 ${hints.length}/${a.length} 个音使用过提示；辅助完成和独立认出分开记录。`,'同音组撤提示再认','pitch');
    if(timed&&misses.length>=2)return out('coordination','先缩短片段，减轻同时处理的负担',`本轮有 ${misses.length} 个未匹配起点。先不限时读出错小节，再回到原句。`,'只练出错这一小节','chunk');
    if(!wrong.length&&!hints.length&&!misses.length&&!extras&&!late.length&&report.complete){
      if(!phrase)return out('steady',report.kind==='review'?'本次复习较稳定，查看下一项安排':'这一组较稳定，继续当前学习安排',report.kind==='review'?'本次检查记录已保存。继续查看到期复习或首页的下一项练习。':'本轮独立完成较稳定。按课程顺序继续；自由练习保持相同任务和音域。',report.kind==='review'?'查看下一项安排':report.courseResult?.passed?'进入下一单元':'继续当前音组','continue');
      if(!variation(report))return out('steady','这一句较稳定，再独立确认一次','先保持原句和速度，再独立完成一次。','同一内容再练','repeat');
      return out('transfer','原内容较稳定，检查一个小变化','本轮独立完成较稳定。下一步只换一个已学音，保持节奏和音域。','检查一个小变化','variation');
    }
    return out('observe',phrase?'保留原内容，再观察一轮':'保持当前范围，再观察一轮',phrase?'当前错误还不足以稳定归为同一原因。先保持内容和速度，再独立完成一次。':'当前错误还不足以稳定归为同一原因。先保持练习任务和音域，再完成一轮。','同一内容再练','repeat');
  }
  function rhythm(report={}){
    const m=report.result?.metrics||{},answers=report.result?.answers||[],seen=Number(m.seen)||0,beat=60000/clampTempo(report.settings?.tempo),unstable=answers.filter(a=>a.hit&&!a.interrupted&&Math.abs(a.delta)>beat*.18).length;
    const result=(code,title,reason,label)=>({code,title,reason,label,action:'rhythm-repeat',evidence:{seen,missed:m.missed||0,extras:m.extras||0,short:m.short||0,long:m.long||0,timing:unstable},secondary:''});
    if(report.paused||report.hint)return result('assisted','先收起帮助，再检查同一节奏',report.paused?'本轮曾暂停，不据此判断稳定程度。':'本轮看过拆解提示，下一轮检查独立完成。','重练同一节奏');
    if(seen<4)return result('observe','先完整练一小段',`本轮只有 ${seen} 个可评起点，先保留原题继续观察。`,'重练同一节奏');
    if((m.restExtras||0)>=2)return result('rest','休止时继续数拍，等到下一个起点',`本轮有 ${m.restExtras} 次多按发生在休止内部。先看该小节拆解，再练原题。`,'同一节奏练等待');
    if((m.short||0)+(m.long||0)>=2&&(m.hit||0)>=seen*.8)return result('duration','起点较准，先练延续与松键',`本轮有 ${m.short||0} 次提前松键、${m.long||0} 次延续过长。这里按时值专项规则评价。`,'同一节奏练时值');
    if((m.missed||0)+(m.extras||0)+unstable>=2)return result('pulse','先稳定起拍，暂不加新节奏',`本轮漏按 ${m.missed||0} 次、多按 ${m.extras||0} 次，匹配起点中有 ${unstable} 次偏差较大。`,'同一节奏慢速练');
    return result('steady','这一小段较稳定，按课程顺序继续','课程仍保留各母型和阶段记录；本次完成不等同于长期掌握。','同一节奏再确认');
  }
  function worstBar(report){
    const counts=new Map(),beats=Number(report.settings?.meter?.[0])||4;
    for(const a of report.answers||report.result?.answers||[]){const bad=a.correct===false||a.hint||a.hit===false||a.hold===false||Number.isFinite(a.delta)&&Math.abs(a.delta)>60000/clampTempo(report.settings?.tempo)*.18;if(!bad)continue;const e=report.exercise?.events?.[a.event],bar=Number.isInteger(a.bar)?a.bar:e?Math.floor(e.beat/beats):0;counts.set(bar,(counts.get(bar)||0)+1);}
    const beatMs=60000/clampTempo(report.settings?.tempo),total=Number(report.exercise?.totalBeats)||0;
    for(const extra of report.extras||[]){if(!Number.isFinite(extra.ms)||extra.ms<0||extra.ms>=total*beatMs)continue;const bar=Math.floor(extra.ms/beatMs/beats);counts.set(bar,(counts.get(bar)||0)+1);}
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0]||0;
  }
  function chunk(report,bar=worstBar(report)){
    const ex=report.exercise;if(!ex||!Array.isArray(ex.events))return null;
    const beats=Number(report.settings?.meter?.[0])||4,lo=bar*beats,hi=Math.min(ex.totalBeats,lo+beats);if(hi<=lo)return null;
    const events=ex.events.filter(e=>e.beat>=lo&&e.beat<hi).map(e=>({...copy(e),beat:e.beat-lo,duration:Math.min(e.duration,hi-e.beat),voices:(e.voices||[]).map(v=>({...copy(v),duration:Math.min(v.duration,hi-e.beat)}))}));
    if(!events.length)return null;return {events,totalBeats:hi-lo,clefs:ex.clefs||[...new Set(events.flatMap(e=>(e.targets||[]).map(t=>t.clef)))]};
  }
  function variation(report){
    if(!report.exercise?.events)return null;const ex=copy(report.exercise),known={treble:new Map(),bass:new Map()};
    ex.events.forEach(e=>(e.targets||[]).forEach(t=>known[t.clef]?.set(t.note.midi,t.note)));
    for(const e of ex.events){const t=e.targets?.[0],other=t&&[...known[t.clef].values()].find(n=>n.midi!==t.note.midi);if(!other)continue;const before=t.note.midi;t.note=copy(other);(e.voices||[]).forEach(v=>(v.targets||[]).forEach(x=>{if(x.clef===t.clef&&x.note.midi===before)x.note=copy(other);}));return ex;}
    return null;
  }
  function rhythmExercise(report){
    const ex=chunk(report);if(!ex)return null;
    const notes=ex.events.filter(e=>(e.targets||[]).length).sort((a,b)=>a.beat-b.beat),starts=[...new Map(notes.map(e=>[e.beat,e])).values()],events=[];let at=0;
    const add=(duration,rest)=>{let left=duration;while(left>0){const d=[4,2,1,.5].find(x=>x<=left);if(!d)return false;events.push({beat:at,duration:d,rest,lane:'main',bar:0,pattern:'coach-focus'});at+=d;left-=d;}return true;};
    for(let i=0;i<starts.length;i++){const e=starts[i];if(e.beat>at&&!add(e.beat-at,true))return null;const end=Math.min(ex.totalBeats,starts[i+1]?.beat??ex.totalBeats,e.beat+e.duration);if(end>at&&!add(end-at,false))return null;}
    if(at<ex.totalBeats&&!add(ex.totalBeats-at,true))return null;if(!events.some(e=>!e.rest))return null;
    const meter=ex.totalBeats+'/4';if(!['2/4','3/4','4/4'].includes(meter))return null;
    return {settings:{course:'free',mode:'pattern',meter,bars:1,tempo:clampTempo((report.settings?.tempo||60)-10),counting:true,metronome:true,adaptive:false},events,bars:[{index:0,id:'coach-focus'}],totalBeats:ex.totalBeats};
  }
  function latest(studyData,source='touch'){
    const reports=[...(studyData?.reports||[]).map(report=>({kind:'study',report})),...(studyData?.rhythm?.reports||[]).map(report=>({kind:'rhythm',report}))].filter(x=>(x.report.settings?.input||'touch')===source&&Number.isFinite(x.report.at)&&!x.report.paused).sort((a,b)=>b.report.at-a.report.at);
    const entry=reports[0];if(!entry)return null;return {...entry,advice:entry.kind==='rhythm'?rhythm(entry.report):study(entry.report)};
  }
  return Object.freeze({study,rhythm,focus,chunk,variation,rhythmExercise,latest,worstBar});
})();
if(typeof globalThis!=='undefined')globalThis.CoachCore=CoachCore;
