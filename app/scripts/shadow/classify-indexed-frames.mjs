import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const [sourcesFile,framesDir,imageDir,out,...ids]=process.argv.slice(2);
const sources=JSON.parse(await readFile(sourcesFile,'utf8')).filter(source=>!ids.length||ids.includes(source.youtubeId));
const official=JSON.parse(await readFile('app/src/data/animationEpisodes.json','utf8'));
const refreshToken=()=>execFileSync('pwsh.exe',['-NoProfile','-File',join(process.env.LOCALAPPDATA,'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1'),'auth','print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();
let token=refreshToken();
const project=process.env.GCP_PROJECT??'project-01c6d808-a517-4177-82f';
await mkdir(out,{recursive:true});let cursor=0;const failed=[];
async function classify(source){
  const {frames}=JSON.parse(await readFile(join(framesDir,`${source.youtubeId}.frames.json`),'utf8'));
  const interval=frames[1].time-frames[0].time;
  const stride=Math.max(1,Math.round((source.duration>600?20:6)/interval));
  const sampled=frames.flatMap((frame,index)=>index%stride===0?[{...frame,index}]:[]);
  const windowSize=source.duration>600?Number(process.env.ANIMATION_WINDOW??60):60;
  const advance=source.duration>600?Number(process.env.ANIMATION_ADVANCE??45):45;
  let last=null;
  for(let offset=0;offset<sampled.length;offset+=advance){
    if(process.env.ANIMATION_OFFSETS&&!process.env.ANIMATION_OFFSETS.split(',').map(Number).includes(offset))continue;
    const file=join(out,`${source.youtubeId}-${offset}.json`);
    try{last=JSON.parse(await readFile(file,'utf8'));console.log(source.youtubeId,offset,'cached');if(offset+windowSize>=sampled.length)break;continue;}catch{/* new */}
    const selected=sampled.slice(offset,offset+windowSize),parts=process.env.ANIMATION_REFERENCE_DIR?[]:[{fileData:{fileUri:`https://www.youtube.com/watch?v=${source.youtubeId}`,mimeType:'video/*'},videoMetadata:{startOffset:`${sampled[offset].time}s`,endOffset:`${Math.min(source.duration,sampled[offset+windowSize]?.time??source.duration)}s`,fps:0.5}}];
    let reference;
    if(process.env.ANIMATION_REFERENCE_DIR){
      const referenceOffset=Math.floor(offset/45)*45;
      let raw;
      try{raw=JSON.parse(await readFile(join(process.env.ANIMATION_REFERENCE_DIR,`${source.youtubeId}-${referenceOffset}.json`),'utf8'));}catch{raw={episodes:[]};}
      reference={episodes:raw.episodes.map(ep=>({title:ep.title,firstFrame:ep.firstFrame}))};
    }
    for(const frame of selected){parts.push({text:`FRAME_ID=${frame.index}. This ID identifies ONLY the immediately following original image.`},{inlineData:{mimeType:'image/jpeg',data:(await readFile(join(imageDir,`${source.youtubeId}-frame-${frame.index}.jpg`))).toString('base64')}});}
    const provider=official.find(item=>item.youtubeId===source.youtubeId);
    parts.push({text:`Organize these TRUE, chronological frames of an animation video into complete STORIES (episodes), then communicative chapters within each story. Source: ${source.title}.
IMPORTANT: Do not estimate or output seconds. Choose ONLY an exact FRAME_ID supplied immediately before an image. Use the ID of the first image of each new story/chapter. The first supplied image is ${selected[0].index}, last ${selected.at(-1).index}. Preserve chronological order.
An episode is an entire narrative problem and its resolution. Changing places, night-to-morning, sleeping/dreaming/waking, or a different camera does NOT start a new episode while the same premise continues. In particular, preparing for Easter and then an Easter egg hunt are ONE story. Skating, buying hot chocolate and playing at the same winter fair are ONE story. Within that story identify communicative situations (requesting, reassuring, explaining, refusing/accepting, helping, resolving), typically 3–7 chapters per complete episode.
${reference?`QUALITY REVIEW: These indexed original frames are the authoritative source. The prior audiovisual candidate may have UNSYNCHRONIZED AUDIO from outside this window. Correct every episode or chapter contradicted by the visible sequence. Do not preserve a candidate story about Christmas when actual frames show supermarket shopping, or merge separate visible title cards. Read on-screen episode titles when available. Use the candidate only as a semantic hint, never as evidence over an actual image. This input is SILENT: do not claim to hear speech. Prior candidate: ${JSON.stringify(reference.episodes)}`:`The original VIDEO AND AUDIO for this window are provided first. Audio may include parts OUTSIDE this window: ignore every topic that is not supported by the indexed images here. Use audio only when it matches the actual visible situation. Use the separately indexed reference images for exact boundary IDs.`} Vocabulary is SCENE-CONTEXT suggestions: useful visible nouns/actions and communication expressions with Korean meaning, not a claimed quote. 4–7 words/expressions per chapter.
${last?`The overlapping previous window ended in this story: ${last.episodes?.at(-1)?.title}. Keep it together if the same premise continues.`:''}
${provider?.episodes.length?`Preserve these authoritative provider/single-episode divisions: ${JSON.stringify(provider.episodes.map(ep=>({title:ep.title,start:ep.start,end:ep.end})))}`:''}
Return JSON {"episodes":[{"firstFrame":${selected[0].index},"title":"faithful short Korean story title","titleOrigin":"summary","continuesBefore":false,"continuesAfter":false,"boundaryReason":"visual change between the previous image and firstFrame, or continuation","chapters":[{"firstFrame":${selected[0].index},"title":"한국어 상황·소통 의도 제목","intent":"설명","words":[{"word":"...","meaning":"..."}]}]}]}.
Every chapter must name an actual supplied FRAME_ID. Never create IDs not supplied. If no new episode begins, return ONE continuing episode, not a story per scene. Do not invent original episode titles.`});
    console.log(source.youtubeId,offset,'classifying',selected[0].index,selected.at(-1).index);
    const frameChoice={type:'STRING',enum:selected.map(frame=>String(frame.index))};
    const chapterSchema={type:'OBJECT',properties:{firstFrame:frameChoice,title:{type:'STRING'},intent:{type:'STRING'},words:{type:'ARRAY',items:{type:'OBJECT',properties:{word:{type:'STRING'},meaning:{type:'STRING'}},required:['word','meaning']}}},required:['firstFrame','title','intent','words']};
    const responseSchema={type:'OBJECT',properties:{episodes:{type:'ARRAY',items:{type:'OBJECT',properties:{firstFrame:frameChoice,title:{type:'STRING'},titleOrigin:{type:'STRING'},continuesBefore:{type:'BOOLEAN'},continuesAfter:{type:'BOOLEAN'},boundaryReason:{type:'STRING'},chapters:{type:'ARRAY',items:chapterSchema}},required:['firstFrame','title','continuesBefore','continuesAfter','chapters']}}},required:['episodes']};
    let result;
    for(let attempt=0;attempt<5;attempt++){
      let response;
      const model=process.env.ANIMATION_MODEL??'gemini-3.1-pro-preview';
      try{response=await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','x-goog-user-project':project},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema,maxOutputTokens:20000,thinkingConfig:model.includes('2.5')?{thinkingBudget:1024}:{thinkingLevel:'LOW'}}}),signal:AbortSignal.timeout(180000)});}
      catch(error){if(attempt===4)throw error;console.log(source.youtubeId,offset,'network retry',attempt+1);await new Promise(resolve=>setTimeout(resolve,15000));continue;}
      const data=await response.json();
      if(!response.ok){if(response.status===401&&attempt<4){token=refreshToken();continue;}if(attempt===4||![429,500,503].includes(response.status))throw new Error(`${source.youtubeId}: ${response.status} ${data.error?.message?.slice(0,100)}`);console.log('capacity retry',source.youtubeId,attempt);await new Promise(resolve=>setTimeout(resolve,Math.min(60000,15000*2**attempt)));continue;}
      try{result=JSON.parse((data.candidates?.[0]?.content?.parts??[]).filter(part=>!part.thought).map(part=>part.text??'').join(''));break;}
      catch(error){if(attempt===4)throw error;console.log(source.youtubeId,offset,'incomplete JSON retry',attempt+1);}
    }
    const allowed=new Set(selected.map(frame=>frame.index));
    if(Array.isArray(result))result={episodes:result};
    if(!Array.isArray(result?.episodes)){await writeFile(file+'.invalid.json',JSON.stringify(result,null,2));throw new Error('Invalid episode response, preserved for inspection');}
    await writeFile(file+'.candidate.json',JSON.stringify(result,null,2));
    for(const episode of result.episodes){episode.firstFrame=Number(episode.firstFrame);if(!allowed.has(episode.firstFrame))throw new Error('Unknown episode frame ID');for(const chapter of episode.chapters){chapter.firstFrame=Number(chapter.firstFrame);if(!allowed.has(chapter.firstFrame))throw new Error('Unknown chapter frame ID');}}
    last={...result,youtubeId:source.youtubeId,windowFirstFrame:selected[0].index,windowLastFrame:selected.at(-1).index,interval,stride,origin:reference?'indexed-original-frame-review':'original-video-and-indexed-frames'};
    await writeFile(file,JSON.stringify(last,null,2));console.log(source.youtubeId,offset,'ready',result.episodes.map(ep=>`${ep.firstFrame} ${ep.title}`).join(' | '));
    if(offset+windowSize>=sampled.length)break;
  }
}
await Promise.all(Array.from({length:Number(process.env.ANIMATION_WORKERS??2)},async()=>{while(cursor<sources.length){const source=sources[cursor++];try{await classify(source);}catch(error){failed.push(source.youtubeId);console.error('SOURCE_RETRY_NEEDED',source.youtubeId,error.message);}}}));
console.log('source pass finished',JSON.stringify({sources:sources.length,retryNeeded:failed}));
if(failed.length)process.exitCode=1;
