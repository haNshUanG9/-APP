const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const out=path.resolve(__dirname,'../web/samples/salamander');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'Piano-Offline-Sample-Import'}});if(!r.ok)throw Error(`${r.status}: ${url}`);return Buffer.from(await r.arrayBuffer());}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const commit='efd8296360f9526e379bfbe5c1698ff54d6a1d34';
 const base=`https://raw.githubusercontent.com/Tonejs/audio/${commit}/salamander/`;
 fs.writeFileSync(path.join(out,'README.upstream.txt'),await get(base+'README'));
 const notes=[[21,'A0']];for(let o=1;o<=7;o++)for(const [pc,n]of [[0,'C'],[3,'Ds'],[6,'Fs'],[9,'A']])notes.push([12*(o+1)+pc,n+o]);notes.push([108,'C8']);
 const records=[];let cursor=0;
 await Promise.all(Array.from({length:4},async()=>{while(cursor<notes.length){const [midi,note]=notes[cursor++],filename=note+'.mp3',b=await get(base+filename);if(b.length<1000)throw Error('Unexpected sample '+filename);fs.writeFileSync(path.join(out,filename),b);records.push({midi,file:filename,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}}));
 records.sort((a,b)=>a.midi-b.midi);
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({name:'Salamander Grand Piano',author:'Alexander Holm',instrument:'Yamaha C5',license:'CC BY 3.0',licenseURL:'https://creativecommons.org/licenses/by/3.0/',source:'https://github.com/Tonejs/audio/tree/'+commit+'/salamander',commit,modifications:'MP3 files redistributed unchanged from the pinned upstream; runtime pitch shifting and gain envelopes are applied during playback.',samples:records},null,2)+'\n');
 fs.writeFileSync(path.join(out,'NOTICE.txt'),'Salamander Grand Piano — Alexander Holm\nSampled instrument: Yamaha C5.\nLicensed under Creative Commons Attribution 3.0 Unported (CC BY 3.0).\nLicense: https://creativecommons.org/licenses/by/3.0/\nSource: https://github.com/Tonejs/audio/tree/'+commit+'/salamander\nMP3 files redistributed unchanged; see README.upstream.txt for original notices.\nThe application applies pitch shifting, gain and note-release envelopes at runtime.\nThis application is not endorsed by the original author.\n');
 console.log(JSON.stringify({commit,samples:records.length,bytes:records.reduce((n,s)=>n+s.bytes,0)},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
