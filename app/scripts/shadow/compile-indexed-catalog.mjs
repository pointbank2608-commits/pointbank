import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const [metadataFile,framesDir,analysisDir,imageDir,out,dictionaryFile]=process.argv.slice(2);
const excluded=new Set(JSON.parse(await readFile('app/src/data/animationExcludedSources.json','utf8')).map(source=>source.youtubeId));
const sources=JSON.parse(await readFile(metadataFile,'utf8')).filter(source=>!excluded.has(source.youtubeId));
const provider=JSON.parse(await readFile('app/src/data/animationEpisodes.json','utf8'));
if(provider.some(source=>source.episodes.some(episode=>episode.boundary?.revision>=2))&&process.env.ALLOW_COARSE_REBUILD!=='true')throw Error('AV-reviewed catalogue is protected. Use assemble-av-catalog.mjs; coarse rebuild requires explicit ALLOW_COARSE_REBUILD=true.');
const corrections=JSON.parse(await readFile('app/src/data/animationEpisodeCorrections.json','utf8'));
const normalize=text=>text.toLowerCase().replace(/[^a-z' ]/g,' ').replace(/\s+/g,' ').trim();
const dictionary=dictionaryFile?JSON.parse(await readFile(dictionaryFile,'utf8')):[];
const wording=text=>String(text??'').replaceAll('까유','카이유').replaceAll('까이유','카이유');
const catalog=[],missing=[];
const thumbnailDir='app/public/animation-episodes';await mkdir(thumbnailDir,{recursive:true});
for(const source of sources){
  const {frames}=JSON.parse(await readFile(join(framesDir,`${source.youtubeId}.frames.json`),'utf8'));
  const interval=frames[1].time-frames[0].time,stride=Math.max(1,Math.round((source.duration>600?20:6)/interval));
  const sample=frames.flatMap((frame,index)=>index%stride===0?[{...frame,index}]:[]);
  const isBluey=['kioBK0l8w5w','gk73udXY__E'].includes(source.youtubeId);
  const sourceDir=isBluey&&process.env.ANIMATION_BLUEY_DIR?process.env.ANIMATION_BLUEY_DIR:analysisDir;
  const windowSize=isBluey&&process.env.ANIMATION_BLUEY_DIR?24:source.duration>600?Number(process.env.ANIMATION_WINDOW??60):60;
  const advance=isBluey&&process.env.ANIMATION_BLUEY_DIR?18:source.duration>600?Number(process.env.ANIMATION_ADVANCE??45):45;
  const windows=[];
  for(let offset=0;offset<sample.length;offset+=advance){
    try{
      let raw;
      try{raw=await readFile(join(sourceDir+'-review',`${source.youtubeId}-${offset}.json`),'utf8');}
      catch{raw=await readFile(join(sourceDir,`${source.youtubeId}-${offset}.json`),'utf8');}
      windows.push(JSON.parse(raw));
    }catch{missing.push(`${source.youtubeId}:${offset}`);}
    if(offset+windowSize>=sample.length)break;
  }
  if(!windows.length)continue;
  const candidates=windows.flatMap((window,windowIndex)=>window.episodes.map((episode,index)=>({
    ...episode,windowIndex,start:frames[episode.firstFrame]?.time,
    truncatedBefore:index===0&&window.windowFirstFrame>0,
    truncatedAfter:index===window.episodes.length-1&&frames[window.windowLastFrame].time+interval*stride<source.duration,
    end:frames[window.episodes[index+1]?.firstFrame]?.time??Math.min(source.duration,frames[window.windowLastFrame].time+interval*stride),
    chapters:episode.chapters.map(chapter=>({...chapter,start:frames[chapter.firstFrame]?.time})),
  }))).filter(episode=>Number.isFinite(episode.start)&&episode.end>episode.start).sort((a,b)=>a.start-b.start||b.end-a.end);
  // Window starts are not story starts. Prefer a full narrative over an overlapping truncated proposal.
  const score=episode=>(!episode.truncatedBefore&&!episode.truncatedAfter?10:0)+(!episode.truncatedBefore?2:0)+(!episode.truncatedAfter?2:0);
  const groups=[];
  for(const episode of candidates.filter(episode=>!episode.truncatedBefore)){
    const match=groups.find(group=>!group.windows.includes(episode.windowIndex)&&(
      Math.abs(group.best.start-episode.start)<=interval*stride||
      (wording(group.best.title)===wording(episode.title)&&Math.min(group.best.end,episode.end)>Math.max(group.best.start,episode.start)&&(group.best.truncatedAfter||episode.truncatedAfter))));
    if(match){match.windows.push(episode.windowIndex);if(score(episode)>score(match.best))match.best=episode;}
    else groups.push({best:episode,windows:[episode.windowIndex]});
  }
  const correction=corrections.find(item=>item.youtubeId===source.youtubeId);
  let grouped=groups.map(group=>group.best).filter(episode=>!correction?.removeStarts.includes(episode.start));
  for(const patch of correction?.episodes??[]){
    grouped=grouped.filter(episode=>episode.start!==patch.start);
    grouped.push({...patch,chapters:patch.chapters.map(ch=>({...ch,end:0})),start:patch.start,end:source.duration,truncatedBefore:false,truncatedAfter:false,manual:true});
  }
  grouped.sort((a,b)=>a.start-b.start);
  for(const change of correction?.moveStarts??[]){const episode=grouped.find(episode=>episode.start===change.from);if(episode)episode.start=change.to;}
  grouped.sort((a,b)=>a.start-b.start);
  for(const episode of grouped)if(correction?.rename?.[String(episode.start)])episode.title=correction.rename[String(episode.start)];
  // A title/opening frame belongs to the following narrative, never to a separate episode card.
  for(let index=grouped.length-2;index>=0;index--)if(/^(?:블루이\s*)?(?:타이틀(?: 카드)?|오프닝|크레딧|에피소드 종료|title card|intro)$/i.test(grouped[index].title.trim())){
    grouped[index+1].start=grouped[index].start;grouped.splice(index,1);
  }
  const authoritative=(provider.find(item=>item.youtubeId===source.youtubeId)?.episodes??[]).filter(episode=>!episode.boundary||episode.boundary.method==='provider-or-single-upload');
  let contextualCandidates=candidates;
  if(authoritative.length&&source.duration>600&&process.env.ANIMATION_CONTEXT_DIR){
    const contextWindows=[];
    for(let offset=0;offset<sample.length;offset+=18){
      try{contextWindows.push(JSON.parse(await readFile(join(process.env.ANIMATION_CONTEXT_DIR,`${source.youtubeId}-${offset}.json`),'utf8')));}catch{missing.push(`${source.youtubeId}:context:${offset}`);}
      if(offset+24>=sample.length)break;
    }
    contextualCandidates=contextWindows.flatMap((window,windowIndex)=>window.episodes.map((episode,index)=>({
      ...episode,windowIndex,start:frames[episode.firstFrame]?.time,truncatedBefore:index===0&&window.windowFirstFrame>0,
      end:frames[window.episodes[index+1]?.firstFrame]?.time??Math.min(source.duration,frames[window.windowLastFrame].time+interval*stride),
      chapters:episode.chapters.map(chapter=>({...chapter,start:frames[chapter.firstFrame]?.time}))
    })));
  }
  const boundaries=authoritative.length?authoritative:grouped.map((episode,index)=>({title:episode.title,titleOrigin:episode.titleOrigin??'summary',start:index===0?0:episode.start,end:grouped[index+1]?.start??source.duration,chapters:[],chosen:episode}));
  const episodes=[];
  for(const boundary of boundaries){
    const preferred=boundary.chosen&&!boundary.chosen.truncatedAfter? [boundary.chosen]:contextualCandidates;
    const allChapters=preferred.flatMap(episode=>episode.chapters.map((chapter,index)=>({...chapter,end:episode.chapters[index+1]?.start??episode.end,
      windowIndex:episode.windowIndex,edge:episode.truncatedBefore&&index===0}))).filter(chapter=>Number.isFinite(chapter.start));
    const byStart=new Map();
    for(const chapter of allChapters.filter(chapter=>chapter.start>=boundary.start&&chapter.start<boundary.end)){
      if(chapter.edge&&chapter.start>boundary.start)continue;
      const previous=byStart.get(chapter.start);
      if(previous){previous.words.push(...(chapter.words??[]));previous.end=Math.max(previous.end,chapter.end);}else byStart.set(chapter.start,{...chapter,words:[...(chapter.words??[])]});
    }
    let chapters=[...byStart.values()].sort((a,b)=>a.start-b.start);
    if(!chapters.length){missing.push(`${source.youtubeId}:chapters:${boundary.start}`);continue;}
    if(boundary.chapters?.length){
      chapters=boundary.chapters.map(chapter=>{
        const relevant=allChapters.filter(candidate=>Math.max(0,Math.min(candidate.end,chapter.end)-Math.max(candidate.start,chapter.start))/Math.min(candidate.end-candidate.start,chapter.end-chapter.start)>.2)
          .sort((a,b)=>Math.max(0,Math.min(b.end,chapter.end)-Math.max(b.start,chapter.start))-Math.max(0,Math.min(a.end,chapter.end)-Math.max(a.start,chapter.start)));
        return {...chapter,title:relevant[0]?.title??chapter.title,providerTitle:chapter.title,intent:relevant[0]?.intent??chapter.title,
          words:relevant.flatMap(candidate=>candidate.words)};
      });
    }
    if(process.env.ANIMATION_SEMANTIC_DIR){
      try{
        const refinement=JSON.parse(await readFile(join(process.env.ANIMATION_SEMANTIC_DIR,`${source.youtubeId}-${Math.round(boundary.start*1000)}.json`),'utf8'));
        if(refinement.chapters[0]?.start!==boundary.start||refinement.chapters.some(ch=>ch.start<boundary.start||ch.start>=boundary.end))throw new Error('Invalid semantic chapter range');
        chapters=refinement.chapters;
      }catch(error){if(error.code!=='ENOENT')throw error;}
    }
    const unique=chapters.map((chapter,index)=>{
      const start=index===0?boundary.start:chapter.start,end=chapters[index+1]?.start??boundary.end;
      const words=[...new Map(chapter.words.filter(word=>word.word?.trim()&&word.meaning?.trim()).map(raw=>{
        const word=/[가-힣]/.test(raw.word)&&!/[가-힣]/.test(raw.meaning)?{word:raw.meaning,meaning:raw.word}:raw;
        const entry=dictionary.find(entry=>normalize(entry.word)===normalize(word.word)&&entry.meaning.replace(/\s/g,'')===word.meaning.replace(/\s/g,''));
        return [normalize(word.word)+'|'+word.meaning.trim(),{word:word.word.trim(),meaning:word.meaning.trim(),basis:'scene-context',...(entry?.image_url?{imageUrl:entry.image_url}:{})}];
      })).values()];
      if(!words.length)missing.push(`${source.youtubeId}:words:${start}`);
      return {title:wording(chapter.title),intent:wording(chapter.intent),start,end,thumbnail:null,frames:[chapter.start],words};
    });
    const thumbnailFrame=Math.min(frames.length-1,Math.round((boundary.start+Math.min(15,(boundary.end-boundary.start)/4))/interval));
    const asset=`${source.youtubeId}-${Math.round(boundary.start*1000)}.jpg`;
    await copyFile(join(imageDir,`${source.youtubeId}-frame-${thumbnailFrame}.jpg`),join(thumbnailDir,asset));
    const titleOrigin=boundary.titleOrigin==='on-screen'&&/[가-힣]/.test(boundary.title)?'summary':boundary.titleOrigin;
    episodes.push({id:`${source.youtubeId}:episode:${Math.round(boundary.start*1000)}`,title:wording(boundary.title),titleOrigin,
      start:boundary.start,end:boundary.end,thumbnail:`/animation-episodes/${asset}`,chapters:unique,
      boundary:{method:authoritative.length?'provider-or-single-upload':'original-video-and-indexed-frames',sampleSeconds:interval*stride}});
  }
  catalog.push({...source,status:'available',episodes});
}
if(missing.length)throw new Error('Unfinished source windows/materials: '+missing.join(', '));
if(catalog.length!==sources.length)throw new Error('Source coverage incomplete');
for(const source of catalog){
  if(!source.episodes.length||source.episodes[0].start!==0||source.episodes.at(-1).end!==source.duration)throw new Error('Incomplete original coverage '+source.youtubeId);
  for(let index=1;index<source.episodes.length;index++)if(source.episodes[index-1].end!==source.episodes[index].start)throw new Error('Original gap '+source.youtubeId);
}
await writeFile(out,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({sources:catalog.length,episodes:catalog.flatMap(source=>source.episodes).length,chapters:catalog.flatMap(source=>source.episodes.flatMap(ep=>ep.chapters)).length,words:catalog.flatMap(source=>source.episodes.flatMap(ep=>ep.chapters.flatMap(ch=>ch.words))).length}));
