// Local, timestamp-burned original AV excerpts, never remote-URL offset estimates.
// Output is review evidence; this script does not mutate the published catalogue.
import {readFile,writeFile,mkdir,access,stat} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [catalogFile,mediaDir,indexDir,outDir,kind='episode',...ids]=process.argv.slice(2);
const catalog=JSON.parse(await readFile(catalogFile,'utf8')).filter(s=>!ids.length||ids.includes(s.youtubeId));
const media=resolve(mediaDir),indices=resolve(indexDir),out=resolve(outDir);
await mkdir(join(out,'clips'),{recursive:true});await mkdir(join(out,'reviews'),{recursive:true});
const ffmpeg=(args)=>new Promise((accept,reject)=>{const p=spawn('ffmpeg',args,{windowsHide:true});let log='';p.stderr.on('data',b=>{log+=b;});p.on('error',reject);p.on('close',c=>c===0?accept():reject(Error(log.slice(-1000))));});
const refresh=()=>execFileSync('pwsh.exe',['-NoProfile','-File',join(process.env.LOCALAPPDATA,'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1'),'auth','print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();
let token=refresh();const jobs=[];
for(const source of catalog){
 const index=JSON.parse(await readFile(join(indices,source.youtubeId+'.json'),'utf8'));
 for(const [epIndex,episode]of source.episodes.entries()){
  const targets=kind==='episode'?(epIndex?[{at:episode.start,before:source.episodes[epIndex-1].title,after:episode.title}]:[]):
   episode.chapters.slice(1).map((chapter,i)=>({at:chapter.start,before:episode.chapters[i].title,after:chapter.title,intent:chapter.intent}));
  for(const target of targets){
   const id=`${source.youtubeId}-${kind}-${Math.round(target.at*1000)}`;
   if(process.env.BOUNDARY_ONLY&&!process.env.BOUNDARY_ONLY.split(',').includes(id))continue;
   const radius=Number(process.env.BOUNDARY_RADIUS??32),start=Math.max(0,target.at-radius),end=Math.min(index.duration,target.at+radius);
   const authoritative=kind==='episode'&&episode.boundary?.method==='provider-or-single-upload';
   const options=[...(index.transitions??[]).filter(c=>c.end>start+2&&c.end<end-2).map(c=>({id:c.id,time:c.end,kind:'first-visible-frame-after-fade',fadeStart:c.start})),...[...index.cuts,...(kind==='episode'?index.fineCuts??[]:[])].filter(c=>c.time>start+2&&c.time<end-2).map(c=>({id:c.id,time:c.time,kind:'decoded-scene-cut'})),
    ...index.silences.filter(p=>p.start>start+2&&p.end<end-2).map(p=>({id:p.id,time:Math.round((p.start+p.end)/2*1000)/1000,kind:'audio-pause',quiet:[p.start,p.end]})),
    {id:'unchanged',time:target.at,kind:'unverified-current-proposal'}].filter(c=>!authoritative||Math.abs(c.time-target.at)<=Number(process.env.BOUNDARY_PROVIDER_TOLERANCE??1.5)).sort((a,b)=>a.time-b.time);
   jobs.push({id,youtubeId:source.youtubeId,kind,episodeId:episode.id,episodeTitle:episode.title,authoritative,...target,start,end,options});
  }
 }
}
const planKey=createHash('sha256').update(JSON.stringify(jobs.map(j=>j.id))).digest('hex').slice(0,10);
await writeFile(join(out,kind+'-jobs-'+planKey+'.json'),JSON.stringify(jobs,null,2));
const batches=[];
for(const source of catalog){const items=jobs.filter(j=>j.youtubeId===source.youtubeId);for(let i=0;i<items.length;i+=4)batches.push(items.slice(i,i+4));}
let cursor=0,complete=0;const failed=[];
async function review(batch){
 const key=batch[0].id,record=join(out,'reviews',key+'.json');
 const model=process.env.BOUNDARY_MODEL??'gemini-3.8-flash';
 const inputHash=createHash('sha256').update(JSON.stringify({version:2,model,batch})).digest('hex');
 try{const old=JSON.parse(await readFile(record,'utf8'));if(old.inputHash===inputHash){console.log(key,'cached');return;}}catch{}
 const parts=[];
 for(const job of batch){
  const path=join(out,'clips',job.id+'.mp4');
  try{await access(path);}catch{await ffmpeg(['-hide_banner','-loglevel','error','-ss',String(job.start),'-i',join(media,job.youtubeId+'.mkv'),'-t',String(job.end-job.start),'-vf',
   `fps=8,scale=480:-2,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='SOURCE %{pts\\:flt\\:${job.start}}':x=8:y=8:fontsize=19:fontcolor=white:box=1:boxcolor=black@0.85`,
   '-c:v','libx264','-preset','veryfast','-crf','27','-c:a','aac','-b:a','32k','-ar','22050','-y',path]);}
  parts.push({text:`JOB ${job.id}. Original local audiovisual excerpt SOURCE ${job.start}–${job.end}. Proposed ${job.kind} boundary ${job.at}; BEFORE proposal: ${job.before}; AFTER proposal: ${job.after}; parent story: ${job.episodeTitle}. ${job.intent??''} ${job.authoritative?'AUTHORITATIVE PROVIDER EPISODE MARKER: preserve the full next TV episode INCLUDING any COLD OPEN before the theme song. Do not move to the later opening song or first main story dialogue. Only snap the existing marker to its immediate frame/pause transition.':''}\nCandidate positions from decoded original frames and audio: ${JSON.stringify(job.options)}`},
   {inlineData:{mimeType:'video/mp4',data:(await readFile(path)).toString('base64')}});
 }
 parts.push({text:`Inspect and LISTEN to EACH local clip. These are original, correctly aligned audio/video files with burned-in absolute SOURCE timestamps, NOT YouTube URLs with potentially ignored offset parameters. Do not infer timing from the proposal.
For each JOB select the genuine ${kind==='episode'?'STORY boundary, including the next story opening/title if present':'COMMUNICATIVE CONTEXT boundary: keep the preceding statement/question AND its immediate response together where they share one intention'}. A camera cut, bedtime/morning, shopping then playing, or song within the same problem is NOT a new episode. The supplied titles are fallible proposals, not proof of a new story.
Choose a supplied candidateId for that JOB at a natural pause/transition BEFORE the first words of the new unit and AFTER the final words of the old unit. Do NOT cut through speech. The EARLIEST new-story establishing shot, title or opening belongs to the NEW story: prefer its first-visible-frame-after-fade, never a later close-up cut after the establishing shot. For a crossfade use the inter-story pause before the first words. ${kind==='episode'?'If this is a false STORY split in one continuing narrative, decision=merge.':'For chapters, decision=merge ONLY when the same communicative context and intention continue across the proposed boundary. Merely being in one story does NOT make a chapter boundary false.'} If no safe candidate or insufficient context, decision=unresolved. Do not manufacture certainty. A chapter can be kept if the proposed time is itself a genuine natural boundary. Only choose a candidate from its own job. Return every JOB once; the id is the exact supplied string WITHOUT the word JOB.
Return JSON {reviews:[{id,candidateId:string|null,decision:keep|move|merge|unresolved,confidence:high|medium|low,beforeSummary,afterSummary,lastWordsBefore(max 5 words),firstWordsAfter(max 5 words),speechClipped:boolean,reason}]}. Summaries and reasons should explain the actual heard/seen transition, not repeat the time. Short word snippets are evidence, not a full transcript.`});
 const properties={id:{type:'STRING',enum:batch.map(j=>j.id)},candidateId:{type:'STRING',nullable:true},decision:{type:'STRING',enum:['keep','move','merge','unresolved']},confidence:{type:'STRING',enum:['high','medium','low']},beforeSummary:{type:'STRING'},afterSummary:{type:'STRING'},lastWordsBefore:{type:'STRING'},firstWordsAfter:{type:'STRING'},speechClipped:{type:'BOOLEAN'},reason:{type:'STRING'}};
 const schema={type:'OBJECT',properties:{reviews:{type:'ARRAY',items:{type:'OBJECT',properties,required:Object.keys(properties)}}},required:['reviews']};
 const body={contents:[{role:'user',parts}],generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:schema,maxOutputTokens:6500,thinkingConfig:{thinkingLevel:'LOW'}}};
 if(Buffer.byteLength(JSON.stringify(body))>19000000)throw Error('Inline AV batch exceeds safe payload limit');
 for(let attempt=0;attempt<3;attempt++){
  console.log(key,'AV review',attempt+1);
  let r;
  try{r=await fetch(`https://aiplatform.googleapis.com/v1/projects/${process.env.GCP_PROJECT??'project-01c6d808-a517-4177-82f'}/locations/global/publishers/google/models/${model}:generateContent`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});}
  catch(error){if(attempt===2)throw error;console.log(key,'network retry');continue;}
  const data=await r.json();if(r.status===401){token=refresh();continue;}
  if(!r.ok){if([429,500,503].includes(r.status)&&attempt<2){await new Promise(r=>setTimeout(r,15000));continue;}throw Error(r.status+': '+data.error?.message?.slice(0,160));}
  try{
   const raw=(data.candidates?.[0]?.content?.parts??[]).filter(p=>!p.thought).map(p=>p.text??'').join('');const result=JSON.parse(raw);
   if(result.reviews?.length!==batch.length||new Set(result.reviews.map(r=>r.id)).size!==batch.length)throw Error('Incomplete review set');
   for(const item of result.reviews){item.id=String(item.id).replace(/^JOB\s+/,'').trim();const job=batch.find(j=>j.id===item.id);if(!job)throw Error('Unknown job');const option=job.options.find(c=>c.id===item.candidateId);if(!option&&!['merge','unresolved'].includes(item.decision))throw Error('Unknown source candidate');item.originalTime=job.at;item.chosenTime=option?.time??null;}
   await writeFile(record,JSON.stringify({origin:'local-original-audio-video',inputHash,model,reviewedAt:new Date().toISOString(),jobs:batch,reviews:result.reviews},null,2));
   console.log(key,'reviewed',++complete+'/'+batches.length,result.reviews.map(r=>`${r.decision}:${r.chosenTime??'?'}:${r.confidence}`).join(' '));return;
  }catch(error){await writeFile(record+'.invalid.json',JSON.stringify(data));if(attempt===2)throw error;}
 }
 throw Error('Review failed after retries');
}
await Promise.all(Array.from({length:Number(process.env.BOUNDARY_WORKERS??3)},async()=>{while(cursor<batches.length){const batch=batches[cursor++];try{await review(batch);}catch(error){failed.push(batch[0].id);console.error(batch[0].id,error.message);}}}));
console.log(JSON.stringify({kind,jobs:jobs.length,batches:batches.length,failed}));if(failed.length)process.exitCode=1;
