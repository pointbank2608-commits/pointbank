// Refine fixed story ranges into communicative units; never change episode boundaries.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const [catalogFile,framesDir,imageDir,out]=process.argv.slice(2);
const catalog=JSON.parse(await readFile(catalogFile,'utf8'));
const jobs=catalog.flatMap(source=>source.episodes.filter(episode=>episode.chapters.length>24||(episode.chapters.length===1&&episode.end-episode.start>=120)).map(episode=>({source,episode})));
const token=()=>execFileSync('pwsh.exe',['-NoProfile','-File',join(process.env.LOCALAPPDATA,'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1'),'auth','print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();
let credential=token(),cursor=0;
const project=process.env.GCP_PROJECT??'project-01c6d808-a517-4177-82f';
await mkdir(out,{recursive:true});
async function refine({source,episode}){
  const file=join(out,`${source.youtubeId}-${Math.round(episode.start*1000)}.json`);
  try{await readFile(file);console.log(episode.id,'cached');return;}catch{/* new */}
  const {frames}=JSON.parse(await readFile(join(framesDir,`${source.youtubeId}.frames.json`),'utf8'));
  const interval=frames[1].time-frames[0].time;
  const step=Math.max(1,Math.round(Math.max(20,(episode.end-episode.start)/45)/interval));
  const images=frames.flatMap((frame,index)=>frame.time>=episode.start&&frame.time<episode.end&&index%step===0?[{...frame,index}]:[]);
  const allowed=[...new Set([episode.start,...episode.chapters.map(ch=>ch.start),...images.map(frame=>frame.time)])].sort((a,b)=>a-b);
  const parts=[];
  for(const frame of images)parts.push({text:`Original frame at ${frame.time} seconds.`},{inlineData:{mimeType:'image/jpeg',data:(await readFile(join(imageDir,`${source.youtubeId}-frame-${frame.index}.jpg`))).toString('base64')}});
  parts.push({text:`Refine chapters WITHIN one fixed story range ${episode.start}–${episode.end} of ${source.title}, episode label ${episode.title}. Do not create episodes. These are actual silent original frames; do not claim to hear dialogue.
The current chapter proposals below may be isolated camera shots. Merge consecutive shots with the same communicative purpose into one coherent context: what someone wants/needs, how another person responds, what they negotiate/explain, and the resolution. Do not keep separate chapters for a smile, close-up, entrance, opening/credit screen, or individual line. For a long Sesame Street episode keep separate learning segments (story, letter, number, song, problem) but group consecutive shots of the same segment. Usually 6–20 chapters for an episode longer than 20 minutes, 2–7 chapters for a shorter story. Do not split by uniform time or to hit a count.
Use the visible sequence as evidence. Existing chapter titles/vocabulary are proposals, not unquestionable facts. Keep the entire range covered. Choose ONLY a supplied allowed start, first chapter MUST start at ${episode.start}. Allowed starts: ${JSON.stringify(allowed)}.
Proposals: ${JSON.stringify(episode.chapters.map(ch=>({start:ch.start,title:ch.title,intent:ch.intent,words:ch.words})))}
Return {"chapters":[{"start":"${episode.start}","title":"한국어 문맥 제목","intent":"누가 누구에게 왜 말하는지 또는 실제로 보이는 학습 목적","words":[{"word":"ENGLISH word or useful expression only","meaning":"한국어 뜻만"}]}]}. Select 4–7 useful words/expressions per context, suitable for the visible situation. They are scene-context practice suggestions, NOT quotations or a complete transcript.`});
  const schema={type:'OBJECT',properties:{chapters:{type:'ARRAY',items:{type:'OBJECT',properties:{start:{type:'STRING',enum:allowed.map(String)},title:{type:'STRING'},intent:{type:'STRING'},words:{type:'ARRAY',items:{type:'OBJECT',properties:{word:{type:'STRING',description:'English word or expression, never Korean'},meaning:{type:'STRING',description:'Korean meaning'}},required:['word','meaning']}}},required:['start','title','intent','words']}}},required:['chapters']};
  for(let attempt=0;attempt<5;attempt++){
    console.log(episode.id,'refining',attempt);
    let response;
    try{response=await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/gemini-3.8-flash:generateContent`,{method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json','x-goog-user-project':project},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:schema,maxOutputTokens:14000,thinkingConfig:{thinkingLevel:'LOW'}}}),signal:AbortSignal.timeout(180000)});}catch(error){if(attempt===4)throw error;continue;}
    const data=await response.json();
    if(response.status===401){credential=token();continue;}
    if(!response.ok){if(attempt===4||![429,500,503].includes(response.status))throw new Error(`${response.status}: ${data.error?.message?.slice(0,100)}`);await new Promise(resolve=>setTimeout(resolve,15000));continue;}
    const result=JSON.parse(data.candidates[0].content.parts.filter(part=>!part.thought).map(part=>part.text??'').join(''));
    for(const chapter of result.chapters)chapter.start=Number(chapter.start);
    result.chapters.sort((a,b)=>a.start-b.start);
    if(result.chapters[0]?.start!==episode.start||new Set(result.chapters.map(ch=>ch.start)).size!==result.chapters.length)throw new Error('Invalid context boundaries');
    await writeFile(file,JSON.stringify({...result,episodeId:episode.id,origin:'original-frames-and-context-proposal-review'},null,2));
    console.log(episode.id,'ready',result.chapters.length);return;
  }
  throw new Error('Chapter review failed '+episode.id);
}
await Promise.all(Array.from({length:2},async()=>{while(cursor<jobs.length)await refine(jobs[cursor++]);}));
console.log('semantic reviews complete',jobs.length);
