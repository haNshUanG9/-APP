(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ChordLearning=api})(typeof window==='object'?window:globalThis,function(){
'use strict';
class Progress{
 constructor(storage,key='piano-chord-lab-v1'){this.storage=storage;this.key=key;this.error='';this.data={version:1,records:{},chain:[]};try{const raw=JSON.parse(storage?.getItem(key)||'null');if(raw?.version===1&&raw.records&&Array.isArray(raw.chain))this.data=raw}catch(e){this.error='读取本地记录失败，已在本次会话继续。'}}
 save(){try{this.storage?.setItem(this.key,JSON.stringify(this.data));if(!this.storage)this.error='本地存储不可用；本次记录仅保留到关闭。'}catch(e){this.error='本地存储不可用；本次记录仅保留到关闭。'}}
 record(id,{correct,hints=0,source='touch',demonstration=false,feedbackSeen=false},now=Date.now()){const r=this.data.records[id]||{attempts:0,independent:0,assisted:0,incorrect:0,streak:0};r.attempts++;r.last={correct,hints,source,demonstration,feedbackSeen,at:now};if(!correct){r.incorrect++;r.streak=0}else if(demonstration||hints||feedbackSeen){r.assisted++;r.streak=0}else{r.independent++;r.streak++}if(correct)r.completed=true;r.due=now+(correct?(hints||demonstration||feedbackSeen?86400000:[86400000,3*86400000,7*86400000][Math.min(r.streak-1,2)]):10*60000);this.data.records[id]=r;this.save();return r}
 due(now=Date.now()){return Object.entries(this.data.records).filter(([id,r])=>r.due<=now).map(([id])=>id)}
 summary(){const a=Object.values(this.data.records);return {attempted:a.length,independent:a.filter(r=>r.independent>0).length,assisted:a.reduce((n,r)=>n+r.assisted,0),incorrect:a.reduce((n,r)=>n+r.incorrect,0),due:this.due().length}}
 clear(){this.data={version:1,records:{},chain:[]};this.save()}
}
function check(card,{notes=[],choice=null}){if(card.answer.kind==='choice')return {correct:choice===card.answer.value,reason:choice===card.answer.value?card.explanation:card.error};let actual=[...new Set(notes.map(n=>(n%12+12)%12))].sort((a,b)=>a-b),expected=[...new Set(card.answer.notes.map(n=>n%12))].sort((a,b)=>a-b);let correct=actual.join(',')===expected.join(',');if(correct&&card.answer.bass!==undefined)correct=notes.length>0&&Math.min(...notes)%12===card.answer.bass;return {correct,reason:correct?card.explanation:card.error}}
return {Progress,check};
});
