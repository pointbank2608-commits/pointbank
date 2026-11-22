// Independent single-clip check: no multi-video audio context or guessed remote offsets.
import{readFile,writeFile,readdir,mkdir,access}from'node:fs/promises';
import{execFileSync,spawn}from'node:child_process';
import{resolve,join}from'node:path';
const[rootArg,kind='episode',pointsFile]=process.argv.slice(2),root=resolve(rootArg);
await mkdir(join(root,'validation-clips'),{recursive:true});await mkdir(join(root,'validated'),{recursive:true});
const points=new Map();
async function collect(folder,replace=true){for(const name of await readdir(join(root,folder)).catch(()=>[])){
 if(!name.endsWith('.json')||name.includes('invalid'))continue;const data=JSON.parse(await readFile(join(root,folder,name),'utf8'));
 for(const r of data.reviews??[]){if(!r.id.includes('-'+kind+'-')||r.chosenTime==null||!['move','keep'].includes(r.decision))continue;
  const job=data.jobs.find(j=>j.id===r.id);if(job&&(replace||!points.has(r.id)))points.set(r.id,{...job,chosenTime:r.chosenTime});
 }
}}
if(pointsFile){for(const p of JSON.parse(await readFile(pointsFile,'utf8')))points.set(p.id,p);}else{
 await collect('pass1/reviews');await collect('official/reviews');
 if(kind==='episode')for(const name of ['_EFba-9oNxI-episode-1880000.json']){const data=JSON.parse(await readFile(join(root,'wider/reviews',name),'utf8'));for(const r of data.reviews)points.set(r.id,{...data.jobs.find(j=>j.id===r.id),chosenTime:r.chosenTime});}
}
const jobs=[...points.values()].filter(p=>!process.env.BOUNDARY_ONLY||process.env.BOUNDARY_ONLY.split(',').includes(p.id));
const credential=()=>execFileSync('pwsh.exe',['-NoProfile','-File',join(process.env.LOCALAPPDATA,'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1'),'auth','print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();let token=credential();
const run=args=>new Promise((ok,no)=>{const p=spawn('ffmpeg',args,{windowsHide:true});let log='';p.stderr.on('data',b=>{log+=b;});p.on('error',no);p.on('close',c=>c===0?ok():no(Error(log.slice(-1000))));});
let cursor=0,count=0;const failed=[];
async function verify(job){
 const key=job.id+'-'+Math.round(job.chosenTime*1000),record=join(root,'validated',key+'.json');if(process.env.VERIFY_RECHECK!=='true')try{await access(record);return;}catch{}
 const index=JSON.parse(await readFile(join(root,'cuts',job.youtubeId+'.json'),'utf8'));
 const radius=Number(process.env.VERIFY_RADIUS??8),start=Math.max(0,job.chosenTime-radius),end=Math.min(index.duration,job.chosenTime+radius);
 const candidates=[{id:'selected',time:job.chosenTime},...index.cuts,...(index.fineCuts??[]),...(index.transitions??[]).flatMap(f=>[{id:f.id+'-start',time:f.start},{id:f.id+'-end',time:f.end}]),
  ...index.silences.map(p=>({id:p.id,time:Math.round((p.start+p.end)/2*1000)/1000}))].filter(c=>c.time>start+0.3&&c.time<end-0.3);
 const path=join(root,'validation-clips',key+'-r'+radius+'.mp4');try{await access(path);}catch{
  await run(['-hide_banner','-loglevel','error','-ss',String(start),'-i',join(root,'media',job.youtubeId+'.mkv'),'-t',String(end-start),'-vf',`fps=12,scale=480:-2,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='SOURCE %{pts\\:flt\\:${start}} - TARGET ${job.chosenTime}':x=8:y=8:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.85`,'-c:v','libx264','-preset','veryfast','-crf','25','-c:a','aac','-b:a','48k','-ar','24000','-y',path]);
 }
 const properties={verdict:{type:'STRING',enum:['safe','move','unresolved']},candidateId:{type:'STRING',nullable:true},confidence:{type:'STRING',enum:['high','medium','low']},speechClipped:{type:'BOOLEAN'},reason:{type:'STRING'}};
 const prompt=`Independently inspect AND LISTEN to this SINGLE local original audiovisual clip, SOURCE ${start}–${end}. Burned-in SOURCE time is authoritative. Proposed ${kind} cut is TARGET ${job.chosenTime}, ${job.chosenTime-start}s after this LOCAL clip begins. Do NOT confuse local elapsed time with SOURCE time.\nBefore/after content proposals: ${job.before??''} / ${job.after??''}. These labels can be wrong.\n${kind==='episode'?'Find the first frame belonging to the NEXT story, including its title/intro/COLD OPEN. Do not trim the cold open or title to jump to the main dialogue. At a safe cut no active previous-story scene/dialogue should remain after TARGET, and no next-story dialogue, title or establishing shot should have been removed before TARGET. If the first part of this clip is already the next story, TARGET is too late. If the first part still belongs to the previous story after TARGET, it is too early. A series logo transition belongs to the following story.':'Check a communicative chapter boundary. Do not divide an unfinished sentence, a question from its immediate answer in the same intention, or one continuing utterance. Prefer a natural audio pause at the change of intention or situation.'}\nThe candidate points below are actual original decoded frame/fade times or detected quiet intervals. Return safe only if TARGET is itself suitable. Otherwise select a better supplied candidate from THIS clip. If insufficient context or no safe cut, unresolved. Do not manufacture certainty. Preserve complete speech. Candidates: ${JSON.stringify(candidates.map(c=>({id:c.id,time:c.time})))}.\nReturn {verdict:safe|move|unresolved,candidateId,confidence,speechClipped,reason}. candidateId=selected only for a safe target. Explain observed content, not an unsupported timestamp.`;
 const body={contents:[{role:'user',parts:[{text:prompt},{inlineData:{mimeType:'video/mp4',data:(await readFile(path)).toString('base64')}}]}],generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties,required:Object.keys(properties)},maxOutputTokens:1700,thinkingConfig:{thinkingLevel:'LOW'}}};
 for(let attempt=0;attempt<3;attempt++){
  let r;try{r=await fetch(`https://aiplatform.googleapis.com/v1/projects/project-01c6d808-a517-4177-82f/locations/global/publishers/google/models/${process.env.VERIFY_MODEL??'gemini-3.8-flash'}:generateContent`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});}catch(error){if(attempt===2)throw error;continue;}
  const data=await r.json();if(r.status===401&&attempt<2){token=credential();continue;}if(!r.ok){if([429,500,503].includes(r.status)&&attempt<2){await new Promise(r=>setTimeout(r,8000));continue;}throw Error(r.status+': '+data.error?.message?.slice(0,80));}
  try{const text=data.candidates[0].content.parts.filter(p=>!p.thought).map(p=>p.text??'').join('');const result=JSON.parse(text);const candidate=candidates.find(c=>c.id===result.candidateId);
   if(!candidate&&result.verdict!=='unresolved')throw Error('Unknown candidate');
   await writeFile(record,JSON.stringify({job,clipStart:start,clipEnd:end,...result,sourceTime:candidate?.time??null,checkedAt:new Date().toISOString()},null,2));
   console.log(key,++count+'/'+jobs.length,result.verdict,candidate?.time??'?',result.confidence);return;
  }catch(error){if(attempt===2)throw error;}
 }
}
await Promise.all(Array.from({length:Number(process.env.VERIFY_WORKERS??4)},async()=>{while(cursor<jobs.length){const job=jobs[cursor++];try{await verify(job);}catch(error){failed.push(job.id);console.error(job.id,error.message);}}}));
console.log(JSON.stringify({kind,total:jobs.length,failed}));if(failed.length)process.exitCode=1;
