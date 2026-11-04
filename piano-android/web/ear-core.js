/* Relative listening has its own evidence; no absolute-pitch requirement. */
'use strict';
const EarCore=(()=>{
 const DAY=86400000;
 const LEVELS=[
  {id:'direction',title:'相同与方向',goal:'听参照音，判断第二个音相同、向上还是向下。',tip:'轻轻哼住第一个音，再听第二个音往哪里走。'},
  {id:'distance',title:'一步与跳进',goal:'方向不变，比较两音靠得近还是跨得远。',tip:'先哼出两个音，比较它们之间的距离，不急着猜音名。'},
  {id:'contour',title:'三音的轮廓',goal:'记住三个音是上行、下行、折返还是重复。',tip:'边听边用手比出高低曲线，最后收起动作再听。'},
  {id:'difference',title:'乐句相同与不同',goal:'比较两条三音短句，检查是否只改了一个音。',tip:'把第一句留在脑中，再听第二句中间的音。'},
  {id:'keyboard',title:'有参照地找键',goal:'给出中央C参照，听目标音后在琴键上找到它。',tip:'先重听C4，再从这个参照判断目标在上方多远。'},
  {id:'melody',title:'听后复现音组',goal:'从两个音逐步增加到四个音，按顺序弹回来。',tip:'先记轮廓再记顺序；必要时先跟唱，之后收起帮助复现。'}
 ];
 const integer=(v,max=10000)=>Number.isInteger(v)&&v>=0?Math.min(v,max):0;
 const defaults=()=>({version:1,tracks:{touch:{},midi:{}},reports:[]});
 function normalize(raw){const d=defaults();for(const source of ['touch','midi'])for(const l of LEVELS){const p=raw?.tracks?.[source]?.[l.id];if(p)d.tracks[source][l.id]={passed:p.passed===true,checks:integer(p.checks),clean:integer(p.clean),retained:integer(p.retained,4),last:Number.isFinite(p.last)?p.last:0,retentionAfter:Number.isFinite(p.retentionAfter)?Math.max(0,p.retentionAfter):(Number.isFinite(p.last)?p.last+DAY:0),due:Number.isFinite(p.due)?Math.max(0,p.due):0};}d.reports=(Array.isArray(raw?.reports)?raw.reports:[]).filter(r=>r&&LEVELS.some(l=>l.id===r.level)&&['touch','midi'].includes(r.source)&&Number.isFinite(r.at)&&Array.isArray(r.answers)&&r.answers.length<=8).slice(-60).map(r=>({...r,answers:r.answers.filter(a=>a&&typeof a.correct==='boolean'&&typeof a.check==='boolean').map(a=>({correct:a.correct,first:a.first===true,check:a.check,hint:a.hint===true,replays:integer(a.replays,20)}))}));return d;}
 function question(level,index=0,random=Math.random,check=false){
  const pick=a=>a[Math.min(a.length-1,Math.floor(Math.max(0,Math.min(.999999,Number(random())||0))*a.length))];
  const base=pick(check?[53,57,64,67]:[55,60,65]),id=LEVELS.some(l=>l.id===level)?level:'direction';let reference=base,sequences=[],answer,choices=[],pitches=[];
  if(id==='direction'){const delta=pick([0,0,2,-2,5,-5,7,-7]);sequences=[[base,base+delta]];answer=delta===0?'same':delta>0?'up':'down';choices=[['same','相同'],['up','更高'],['down','更低']];}
  if(id==='distance'){const step=pick([1,2,5,7]),direction=pick([-1,1]);sequences=[[base,base+step*direction]];answer=step<=2?'near':'far';choices=[['near','相邻一步'],['far','跳开较远']];}
  if(id==='contour'){const kind=pick(['up','down','turn','repeat']),shape={up:[0,2,4],down:[4,2,0],turn:[0,4,0],repeat:[0,0,0]}[kind];sequences=[shape.map(x=>base+x)];answer=kind;choices=[['up','一路向上'],['down','一路向下'],['turn','先上后回'],['repeat','重复同音']];}
  if(id==='difference'){const changed=pick([false,true]),first=[base,base+2,base+4];sequences=[first,[base,base+(changed?5:2),base+4]];answer=changed?'different':'same';choices=[['same','两句相同'],['different','有一个音不同']];}
  if(id==='keyboard'){reference=60;pitches=[pick([60,62,64,65,67])];sequences=[[60,pitches[0]]];}
  if(id==='melody'){reference=60;const count=index<2?2:index<4?3:4,pool=[60,62,64];pitches=Array.from({length:count},()=>pick(pool));sequences=[pitches];}
  return {level:id,check,reference,sequences,pitches,answer,choices};
 }
 function recommend(d,source='touch',now=Date.now()){const track=d.tracks[source]||d.tracks.touch;const due=LEVELS.find(l=>track[l.id]?.due>0&&track[l.id].due<=now);return {level:(due||LEVELS.find(l=>!track[l.id]?.passed)||LEVELS[0]).id,review:!!due};}
 function observe(d,r,now=Date.now()){
  if(!r.complete||r.interrupted||!r.answers.length)return null;const checks=r.answers.filter(a=>a.check),clean=checks.filter(a=>a.correct&&a.first&&!a.hint),passed=checks.length===4&&clean.length>=3;
  const p=d.tracks[r.source][r.level]||(d.tracks[r.source][r.level]={passed:false,checks:0,clean:0,retained:0,last:0,retentionAfter:0,due:0});const wasDue=p.due>0&&now>=p.due;
  p.checks+=checks.length;p.clean+=clean.length;p.last=now;
  if(passed){p.passed=true;if(r.review&&wasDue&&p.retentionAfter>0&&now>=p.retentionAfter)p.retained=Math.min(4,p.retained+1);if(!p.due||wasDue){p.due=now+[1,3,7,14,21][p.retained]*DAY;p.retentionAfter=now+DAY;}}else{p.retained=0;p.due=now+600000;p.retentionAfter=now+DAY;}
  return {passed,clean:clean.length,checks:checks.length,retained:p.retained,due:p.due};
 }
 return {LEVELS,defaults,normalize,question,recommend,observe};
})();
if(typeof globalThis!=='undefined')globalThis.EarCore=EarCore;
if(typeof module!=='undefined'&&module.exports)module.exports=EarCore;
