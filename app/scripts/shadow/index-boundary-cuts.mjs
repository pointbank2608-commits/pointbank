// Detect actual decoded video frame transitions; these are candidates, not semantic truth.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join,resolve} from 'node:path';
const [catalogFile,mediaDirectory,outputDirectory,...ids]=process.argv.slice(2);
const catalog=JSON.parse(await readFile(catalogFile,'utf8')).filter(s=>!ids.length||ids.includes(s.youtubeId));
const media=resolve(mediaDirectory),out=resolve(outputDirectory);await mkdir(out,{recursive:true});
function run(args){return new Promise((accept,reject)=>{const p=spawn('ffmpeg',args,{cwd:out,windowsHide:true});let log='';p.stdout.on('data',b=>{log+=b;});p.stderr.on('data',b=>{log+=b;});p.on('error',reject);p.on('close',c=>c===0?accept(log):reject(Error(log.slice(-1200))));});}
let cursor=0;
await Promise.all(Array.from({length:2},async()=>{while(cursor<catalog.length){
 const source=catalog[cursor++],id=source.youtubeId,file=join(media,id+'.mkv');
 let previous;
 try{previous=JSON.parse(await readFile(join(out,id+'.json'),'utf8'));if(previous.transitions){console.log(id,'cut index cached');continue;}}catch{}
 await access(file);console.log(id,'indexing decoded source frames');
 if(previous){
  const black=await run(['-hide_banner','-nostats','-i',file,'-vf','scale=160:-2,blackdetect=d=0.04:pix_th=0.10:pic_th=0.94','-an','-f','null','-']);
  previous.transitions=[...black.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m,index)=>({id:'fade-'+index,start:Number(m[1]),end:Number(m[2])}));
  await writeFile(join(out,id+'.json'),JSON.stringify(previous,null,2));console.log(id,'fade candidates ready',previous.transitions.length);continue;
 }
 const black=await run(['-hide_banner','-nostats','-i',file,'-vf',`scale=160:-2,blackdetect=d=0.04:pix_th=0.10:pic_th=0.94,select='gt(scene,0.22)',metadata=print:file=${id}.cuts.raw`,'-an','-fps_mode','vfr','-f','null','-']);
 const transitions=[...black.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m,index)=>({id:'fade-'+index,start:Number(m[1]),end:Number(m[2])}));
 const cutsRaw=await readFile(join(out,id+'.cuts.raw'),'utf8');
 const cuts=[...cutsRaw.matchAll(/pts_time:([\d.]+)\r?\nlavfi.scene_score=([\d.]+)/g)].map((m,index)=>({id:'cut-'+index,time:Number(m[1]),score:Number(m[2])}));
 const silenceRaw=await run(['-hide_banner','-nostats','-i',file,'-vn','-af','silencedetect=noise=-30dB:d=0.14','-f','null','-']);
 const silences=[...silenceRaw.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m,index)=>({id:'pause-'+index,start:Number(m[1]),end:Number(m[2])}));
 const probe=JSON.parse(await readFile(join(media,id+'.probe.json'),'utf8'));
 await writeFile(join(out,id+'.json'),JSON.stringify({youtubeId:id,duration:Number(probe.format.duration),fps:probe.streams.find(s=>s.codec_type==='video').r_frame_rate,cuts,silences,transitions},null,2));
 console.log(id,'cut index ready',cuts.length,'cuts',silences.length,'pauses');
}}));
