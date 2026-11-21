// Assemble only evidence-backed original ranges. Never silently publish missing review output.
import{readFile,writeFile,readdir}from'node:fs/promises';
import{join,resolve}from'node:path';
const[rootArg,output,manifestOutput]=process.argv.slice(2),root=resolve(rootArg);
const base=JSON.parse(await readFile(join(root,'catalog-before.json'),'utf8'));
const bluey=JSON.parse(await readFile(join(root,'bluey-plan.json'),'utf8'));
const rebuiltStoryIds=new Set(bluey.map(s=>s.youtubeId));
const review=new Map(),validations=new Map();const issues=[],evidence=[];
for(const directory of ['pass1/reviews','official/reviews','wider/reviews','wider-fine/reviews'])for(const file of await readdir(join(root,directory)).catch(()=>[])){
 if(!file.endsWith('.json')||file.includes('invalid'))continue;const data=JSON.parse(await readFile(join(root,directory,file),'utf8'));
 for(const row of data.reviews??[]){if(directory.startsWith('wider')&&!row.id.startsWith('_EFba-9oNxI-episode-'))continue;
  if(directory.startsWith('official')&&row.chosenTime==null)continue;
  review.set(row.id,{...row,job:data.jobs?.find(j=>j.id===row.id),origin:'local-original-audio-video'});
 }
}
for(const file of await readdir(join(root,'validated')).catch(()=>[]))if(file.endsWith('.json')){
 const data=JSON.parse(await readFile(join(root,'validated',file),'utf8'));validations.set(data.job.id+'@'+data.job.chosenTime,data);
}
const manual={
 'x48eq6AYfTY-episode-1526000':{time:1525.324,reason:'Decoded original frames: outgoing Elmo/Abby shot ends at the first blurred wipe frame; includes the following cold open before the theme.'},
};
function point(source,kind,oldTime){
 const id=`${source.youtubeId}-${kind}-${Math.round(oldTime*1000)}`,row=review.get(id);
 if(manual[id]){evidence.push({id,from:oldTime,to:manual[id].time,method:'manual-decoded-frame-review',reason:manual[id].reason});return manual[id].time;}
 if(!row){issues.push({id,kind:'missing-review'});return oldTime;}
 if(row.decision==='merge'){evidence.push({id,from:oldTime,to:null,method:'local-av-context-merge'});return null;}
 if(row.chosenTime==null||row.speechClipped){issues.push({id,kind:'unsafe-review',reason:row.reason});return oldTime;}
 const validation=validations.get(id+'@'+row.chosenTime);
 if(validation?.verdict==='unresolved'){
  if(kind==='chapter'){evidence.push({id,from:oldTime,to:null,method:'merged-no-safe-communicative-boundary',reason:validation.reason});return null;}
  issues.push({id,kind:'unresolved-single-clip',reason:validation.reason});return row.chosenTime;
 }
 const time=validation?.sourceTime??row.chosenTime;
 if(kind==='episode'&&!validation)issues.push({id,kind:'missing-single-clip-confirmation'});
 evidence.push({id,from:oldTime,to:time,method:validation?'single-clip-audio-video-confirmation':'local-audio-video-review',candidateId:validation?.candidateId??row.candidateId});
 return time;
}
const dedupe=words=>[...new Map(words.map(w=>[w.word.toLowerCase().trim()+'|'+w.meaning.trim(),w])).values()];
const wording=text=>text.replaceAll('까유','카이유').replaceAll('까이유','카이유').replaceAll('까일루','카이유');
function combineContext(previous,next){
 if(!previous)return;
 previous.words=dedupe([...previous.words,...next.words]);
 previous.title=[...new Set([previous.title,next.title])].join(' · ');
 previous.intent=[...new Set([previous.intent,next.intent].filter(Boolean))].join(' · ');
}
const pending=[];const result=[];const chapterPoints=[];
for(const original of base){
 const source=structuredClone(original),probe=JSON.parse(await readFile(join(root,'media',source.youtubeId+'.probe.json'),'utf8'));source.duration=Number(probe.format.duration);
 if(rebuiltStoryIds.has(source.youtubeId)){
  const plan=bluey.find(s=>s.youtubeId===source.youtubeId);const episodes=[];
  for(const episode of plan.episodes){
   const path=join(root,'episode-contexts',episode.id.replace(':episode:','-')+'.json');let data;
   try{data=JSON.parse(await readFile(path,'utf8'));}catch{pending.push(episode.id);continue;}
   if(data.needsReview||data.otherStoryInside){issues.push({id:episode.id,kind:'story-context-review',summary:data.storySummary});}
   // Display descriptive titles consistently. A model's recalled official title is not an independently read title card.
   const chapters=data.chapters.map((chapter,i)=>({title:wording(chapter.title),intent:wording(chapter.intent),start:chapter.start,end:data.chapters[i+1]?.start??episode.end,thumbnail:null,words:dedupe(chapter.words.map(word=>word.word==='dandruff / dirty dishes'?{...word,word:'dirty dishes'}:word)),frames:[chapter.start]}));
   episodes.push({id:episode.id,title:wording(data.title),titleOrigin:'summary',start:episode.start,end:episode.end,thumbnail:episode.thumbnail,aliases:episode.aliases,chapters,
    boundary:{method:'original-av-v2',revision:2,sampleSeconds:0,reviewedAt:data.reviewedAt}});
   evidence.push({id:episode.id,from:null,to:episode.start,end:episode.end,method:data.method==='manual-frame-dialogue-review'?data.method:plan.episodes.length===1?'single-upload-and-full-story-av':'decoded-original-title-transition-and-full-story-av',...(data.reviewNote?{reason:data.reviewNote}:{}),chapters:data.chapters.map(chapter=>({start:chapter.start,candidateId:chapter.candidateId}))});
  }
  if(episodes.length===plan.episodes.length)source.episodes=episodes;
  source.checkedAt=new Date().toISOString();
  result.push(source);continue;
 }
 const starts=source.episodes.map((ep,i)=>i===0?0:point(source,'episode',ep.start));
 for(let i=0;i<starts.length;i++)if(starts[i]==null||i&&starts[i]<=starts[i-1])issues.push({id:source.episodes[i].id,kind:'invalid-episode-order'});
 for(const[epIndex,episode]of source.episodes.entries()){
  const oldChapters=episode.chapters;episode.start=starts[epIndex]??episode.start;episode.end=starts[epIndex+1]??source.duration;
  const chapters=[];
  for(const[index,old]of oldChapters.entries()){
   const start=index===0?episode.start:point(source,'chapter',old.start),previous=chapters.at(-1);
   if(start==null){combineContext(previous,old);continue;}
   if(index&&(start<=episode.start+.1||start>=episode.end-.1||previous&&start<=previous.start+.5)){
    // A proposed camera/context split resolves to the story edge: keep the complete context together.
    combineContext(previous,old);
    evidence.push({id:`${source.youtubeId}-chapter-${Math.round(old.start*1000)}`,method:'folded-context-at-verified-story-edge',from:old.start,to:null});continue;
   }
   const chapter={...old,start,end:0,frames:[start]};chapters.push(chapter);
   if(index){const id=`${source.youtubeId}-chapter-${Math.round(old.start*1000)}`,row=review.get(id);
    if(row?.job){chapterPoints.push({...row.job,chosenTime:row.chosenTime});if(!validations.has(id+'@'+row.chosenTime))issues.push({id,kind:'missing-single-clip-confirmation'});}
   }
  }
  for(let i=0;i<chapters.length;i++)chapters[i].end=chapters[i+1]?.start??episode.end;
  episode.chapters=chapters;episode.boundary={method:'original-av-v2',revision:2,sampleSeconds:0,reviewedAt:new Date().toISOString()};
 }
 source.checkedAt=new Date().toISOString();result.push(source);
}
for(const source of result){
 if(source.episodes[0].start!==0||source.episodes.at(-1).end!==source.duration)issues.push({id:source.youtubeId,kind:'source-coverage'});
 for(const[i,episode]of source.episodes.entries()){
  if(i&&source.episodes[i-1].end!==episode.start)issues.push({id:episode.id,kind:'episode-gap'});
  if(!episode.chapters.length||episode.chapters[0].start!==episode.start||episode.chapters.at(-1).end!==episode.end)issues.push({id:episode.id,kind:'chapter-coverage'});
  for(const[j,chapter]of episode.chapters.entries())if(chapter.start<episode.start||chapter.end>episode.end||chapter.end<=chapter.start||j&&episode.chapters[j-1].end!==chapter.start)issues.push({id:episode.id,kind:'chapter-bounds',start:chapter.start,end:chapter.end});
 }
}
await writeFile(join(root,'non-bluey-chapter-points.json'),JSON.stringify(chapterPoints,null,2));
await writeFile(join(root,'assembly-audit.json'),JSON.stringify({pending,issues,evidence},null,2));
if((pending.length||issues.length)&&process.env.CATALOG_DRAFT!=='true')throw Error(`Unfinished boundary review: ${pending.length} stories, ${issues.length} issues; see assembly-audit.json`);
await writeFile(output,JSON.stringify(result,null,2)+'\n');
if(manifestOutput)await writeFile(manifestOutput,JSON.stringify({version:2,reviewedAt:new Date().toISOString(),sources:result.map(s=>({youtubeId:s.youtubeId,duration:s.duration,episodeIds:s.episodes.map(e=>e.id)})),evidence},null,2)+'\n');
console.log(JSON.stringify({sources:result.length,episodes:result.flatMap(s=>s.episodes).length,chapters:result.flatMap(s=>s.episodes.flatMap(e=>e.chapters)).length,pending:pending.length,issues:issues.length,chapterPoints:chapterPoints.length}));
