// One physically bounded original AV per story. Title-card inventory is a separate input.
import{readFile,writeFile,mkdir,access}from'node:fs/promises';
import{spawn,execFileSync}from'node:child_process';
import{join,resolve}from'node:path';
const[planFile,rootArg]=process.argv.slice(2),root=resolve(rootArg);
const plan=JSON.parse(await readFile(planFile,'utf8'));
await mkdir(join(root,'episode-av'),{recursive:true});await mkdir(join(root,'episode-contexts'),{recursive:true});
const credential=()=>execFileSync('pwsh.exe',['-NoProfile','-File',join(process.env.LOCALAPPDATA,'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1'),'auth','print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();let token=credential();
const run=args=>new Promise((ok,no)=>{const p=spawn('ffmpeg',args,{windowsHide:true});let log='';p.stderr.on('data',b=>{log+=b;});p.on('error',no);p.on('close',c=>c===0?ok():no(Error(log.slice(-1000))));});
const jobs=plan.flatMap(source=>source.episodes.map(episode=>({source,episode}))).filter(({episode})=>!process.env.AV_EPISODES||process.env.AV_EPISODES.split(',').includes(episode.id));let cursor=0,count=0;const failed=[];
async function build({source,episode}){
 const key=episode.id.replace(':episode:','-'),output=join(root,'episode-contexts',key+'.json');
 try{const old=JSON.parse(await readFile(output,'utf8'));if(old.start===episode.start&&old.end===episode.end){console.log(key,'cached');return;}}catch{}
 const index=JSON.parse(await readFile(join(root,'cuts',source.youtubeId+'.json'),'utf8'));
 const candidates=[{id:'episode-start',time:episode.start},...index.cuts,...index.silences.filter(p=>p.end-p.start>=.22).map(p=>({id:p.id,time:Math.round((p.start+p.end)/2*1000)/1000}))].filter(c=>c.time>=episode.start&&c.time<episode.end-.5).sort((a,b)=>a.time-b.time);
 const path=join(root,'episode-av',key+'.mp4');try{await access(path);}catch{
  await run(['-hide_banner','-loglevel','error','-ss',String(episode.start),'-i',join(root,'media',source.youtubeId+'.mkv'),'-t',String(episode.end-episode.start),'-vf',`fps=6,scale=480:-2,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='SOURCE %{pts\\:flt\\:${episode.start}}':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.85`,'-c:v','libx264','-preset','veryfast','-crf','27','-c:a','aac','-b:a','40k','-ar','24000','-y',path]);
 }
 const word={type:'OBJECT',properties:{word:{type:'STRING'},meaning:{type:'STRING'}},required:['word','meaning']};
 const chapter={type:'OBJECT',properties:{candidateId:{type:'STRING',enum:candidates.map(c=>c.id)},title:{type:'STRING'},intent:{type:'STRING'},words:{type:'ARRAY',items:word}},required:['candidateId','title','intent','words']};
 const schema={type:'OBJECT',properties:{title:{type:'STRING'},onScreenEpisodeTitle:{type:'STRING'},storySummary:{type:'STRING'},otherStoryInside:{type:'BOOLEAN'},needsReview:{type:'BOOLEAN'},chapters:{type:'ARRAY',items:chapter}},required:['title','onScreenEpisodeTitle','storySummary','otherStoryInside','needsReview','chapters']};
 const prompt=`Inspect AND LISTEN to this SINGLE physical original AV story range, SOURCE ${episode.start}–${episode.end}. Burned-in absolute SOURCE times are authoritative. Original video/audio are aligned. Episode bounds were established separately from reviewed title transitions or single-story upload edges, not from fixed-duration chopping. Do NOT change the story bounds. If another genuinely different story is embedded, otherStoryInside=true and needsReview=true; do not silently treat it as one.
Extract a faithful short KOREAN story title describing the actual premise. onScreenEpisodeTitle must be an exact visible EPISODE title only, or empty; BLUEY/Ludo/Disney/channel logos are NOT episode titles. Do not recall an official title from memory. Existing old labels are fallible and may combine wrong stories: ${JSON.stringify(episode.legacyTitles)}.
Build communicative chapters for the ENTIRE supplied range. Usually 2–4 meaningful chapters for a short excerpt, 4–7 for a longer complete story. A chapter is a situation/intention (wanting something, responding, negotiating, explaining, changing a plan, resolving). Keep questions with their immediate replies; do not split a continuing statement. Do not make separate chapters for a camera close-up, smile, walking, an intro, credit, or isolated sentence. The first chapter MUST use episode-start and include the opening with the first situation; the last continues to the supplied end.
Choose ONLY supplied actual frame/audio-pause candidate IDs for later chapter starts. Choose the natural pause BEFORE the first complete utterance of a new context, never in the middle of words or at a later camera angle that clips the beginning. Candidates: ${JSON.stringify(candidates.map(c=>({id:c.id,time:c.time})))}.
Return Korean chapter titles and communicative intents. 4–6 useful ENGLISH words/expressions with KOREAN meanings per chapter, grounded in the visible/heard situation. These are SCENE-CONTEXT practice suggestions, not claimed quotations; do not fabricate timed dialogue, translations of nonexistent lines, or a full transcript. A useful practice expression is allowed but must fit the actual communication purpose.
Return all fields in the schema. needsReview=true when unsure, never invent confidence. storySummary is a short Korean paraphrase.`;
 const body={contents:[{role:'user',parts:[{text:prompt},{inlineData:{mimeType:'video/mp4',data:(await readFile(path)).toString('base64')}}]}],generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:schema,maxOutputTokens:6500,thinkingConfig:{thinkingLevel:'LOW'}}};
 if(Buffer.byteLength(JSON.stringify(body))>19000000)throw Error('Story clip exceeds safe inline payload size');
 for(let attempt=0;attempt<3;attempt++){
  console.log(key,'full-story AV contexts',attempt+1);let r;
  try{r=await fetch(`https://aiplatform.googleapis.com/v1/projects/project-01c6d808-a517-4177-82f/locations/global/publishers/google/models/${process.env.AV_MODEL??'gemini-3.8-flash'}:generateContent`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});}catch(error){if(attempt===2)throw error;continue;}
  const data=await r.json();if(r.status===401){token=credential();continue;}if(!r.ok){if([429,500,503].includes(r.status)&&attempt<2){await new Promise(r=>setTimeout(r,8000));continue;}throw Error(r.status+': '+data.error?.message?.slice(0,100));}
  try{const text=data.candidates[0].content.parts.filter(p=>!p.thought).map(p=>p.text??'').join('');const result=JSON.parse(text);
   if(!result.chapters?.length||result.chapters[0].candidateId!=='episode-start')throw Error('Opening context missing');
   const chapters=result.chapters.map((ch,i)=>{const chosen=candidates.find(c=>c.id===ch.candidateId);if(!chosen||!ch.words?.length)throw Error('Invalid context material');if(i&&chosen.time<=candidates.find(c=>c.id===result.chapters[i-1].candidateId).time)throw Error('Nonchronological contexts');return{...ch,start:chosen.time,words:ch.words.map(w=>({...w,basis:'scene-context'}))};});
   await writeFile(output,JSON.stringify({...episode,...result,chapters,sourceId:source.youtubeId,method:'single-local-original-av-contexts',reviewedAt:new Date().toISOString()},null,2));console.log(key,++count+'/'+jobs.length,'contexts',chapters.length,'review?',result.needsReview,'mixed?',result.otherStoryInside);return;
  }catch(error){await writeFile(output+'.invalid.json',JSON.stringify(data));if(attempt===2)throw error;}
 }
}
await Promise.all(Array.from({length:Number(process.env.AV_WORKERS??4)},async()=>{while(cursor<jobs.length){const job=jobs[cursor++];try{await build(job);}catch(error){failed.push(job.episode.id);console.error(job.episode.id,error.message);}}}));
console.log(JSON.stringify({stories:jobs.length,failed}));if(failed.length)process.exitCode=1;
