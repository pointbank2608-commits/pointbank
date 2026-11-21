import catalogueData from '../data/animationEpisodes.json';
import type {VideoClip} from './videoClips';
import {parseShadowText} from './shadowLines';
import {withSource} from './soloBoard';
import type {SoloStep} from './soloLessons';
import type {SoloVideoDraft} from './soloVideoTemplate';
import {sceneWordPicture} from './animationScene';
import {excludedAnimationSources} from './animationExclusions';

export type EpisodeChapter = {title:string;start:number;end:number;thumbnail:string|null;intent?:string;providerTitle?:string;
  frames?:number[];words?:{word:string;meaning:string;basis:'scene-context';imageUrl?:string|null}[]};
export type Episode = {id:string;title:string;titleOrigin:string;start:number;end:number;thumbnail:string|null;chapters:EpisodeChapter[];
  boundary?:{method:string;sampleSeconds:number;beforeFrame?:number;afterFrame?:number};};
type EpisodeSource={youtubeId:string;title:string;duration:number;checkedAt:string;status:string;episodes:Episode[]};
// JSON imports widen string literals; the catalogue generator and coverage check validate this schema.
const catalogue=catalogueData as EpisodeSource[];
// Communication labels checked against the existing timed dialogue for this episode.
const beeCommunication=[
  {title:'무서워하는 카이유를 안심시켜요',intent:'양은 부드럽고 친근하다는 설명으로 걱정을 덜어 줘요.'},
  {title:'벌에 쏘인 카이유가 불편함을 말해요',intent:'어디가 아픈지 말하고, 가족이 상황을 알아보며 도와줘요.'},
  {title:'벌의 행동을 설명하고 오해를 풀어요',intent:'벌집과 꿀을 설명하며 벌이 일부러 해치려던 것은 아니라는 뜻을 전해요.'},
  {title:'당나귀 타기를 부탁하고 궁금한 점을 물어요',intent:'타도 되는지 허락을 구하고, 당나귀가 두 사람을 태울 수 있는지 물어요.'},
];
const norm=(text:string)=>text.toLowerCase().replace(/[’]/g,"'").replace(/[^a-z' ]/g,' ').replace(/\s+/g,' ').trim();
const includesWord=(text:string,word:string)=>` ${norm(text)} `.includes(` ${norm(word)} `);
export const episodeChapters=(episode:Episode):EpisodeChapter[]=>episode.chapters.length?episode.chapters:[{title:episode.title,start:episode.start,end:episode.end,thumbnail:episode.thumbnail}];

export function animationEpisodeLibrary(clips:VideoClip[]){
  const visible=clips.filter(clip=>!clip.hidden&&!clip.pack?.phonicsSong&&!excludedAnimationSources.has(clip.youtube_id));
  const sources=catalogue.flatMap(source=>{
    const rows=visible.filter(clip=>clip.youtube_id===source.youtubeId);
    if(!rows.length)return [];
    const full=rows.find(row=>row.pack.fullVideo)?.pack.fullVideo;
    const scripts=full?[full.script]:rows.map(row=>row.script);
    const lines=[...new Map(scripts.flatMap(script=>parseShadowText(script)).map(line=>[`${line.start}:${line.en}`,line])).values()].sort((a,b)=>a.start-b.start);
    return [{...source,rows,lines,series:rows[0].series}];
  });
  const episodes=sources.flatMap(source=>source.episodes.map(episode=>{
    const lines=source.lines.filter(line=>line.start>=episode.start&&line.end<=episode.end);
    const chapters=episodeChapters(episode).map((chapter,index)=>source.youtubeId==='yCzDip2ma9o'&&beeCommunication[index]
      ?{...chapter,providerTitle:chapter.title,...beeCommunication[index]}:chapter);
    const words=new Map<string,{id:string;word:string;meaning:string;imageUrl:string|null;example:string;start:number;end:number;chapterIds:number[];scriptChapterIds:number[];basis:'script'|'scene-context'}>();
    for(const row of source.rows)for(const word of row.pack.words??[]){
      const evidence=lines.find(line=>includesWord(line.en,word.word)||norm(line.en)===norm(word.example));
      if(!evidence||!word.word.trim()||!word.meaning.trim())continue;
      const key=norm(word.word)+'|'+word.meaning.trim();
      const appearances=lines.filter(line=>includesWord(line.en,word.word)||norm(line.en)===norm(word.example));
      const chapterIds=chapters.flatMap((chapter,index)=>appearances.some(line=>line.start>=chapter.start&&line.start<chapter.end)?[index]:[]);
      words.set(key,{id:`${episode.id}/word/${encodeURIComponent(key)}`,word:word.word,meaning:word.meaning,
        imageUrl:word.imageUrl??sceneWordPicture(row,word.word,word.meaning)??null,example:evidence.en,start:evidence.start,end:evidence.end,chapterIds,scriptChapterIds:[...chapterIds],basis:'script'});
    }
    for(const [chapterIndex,chapter] of chapters.entries())for(const word of chapter.words??[]){
      if(!word.word.trim()||!word.meaning.trim())continue;
      const key=norm(word.word)+'|'+word.meaning.trim();const existing=words.get(key);
      if(existing){if(!existing.chapterIds.includes(chapterIndex))existing.chapterIds.push(chapterIndex);continue;}
      words.set(key,{id:`${episode.id}/word/${encodeURIComponent(key)}`,word:word.word,meaning:word.meaning,imageUrl:word.imageUrl??null,
        example:'',start:chapter.start,end:chapter.end,chapterIds:[chapterIndex],scriptChapterIds:[],basis:'scene-context'});
    }
    return {episode,source,lines,chapters,words:[...words.values()]};
  }));
  return {sources,episodes,pending:sources.filter(source=>!source.episodes.length)};
}
export type EpisodeMaterial=ReturnType<typeof animationEpisodeLibrary>['episodes'][number];

/** Selection changes practice, never the episode identity or the original source bounds. */
export function episodeLessonDraft(material:EpisodeMaterial, selectedChapters:number[], selectedWords:string[], minutes:number):SoloVideoDraft{
  const {episode,source,chapters,lines}=material;
  const selected=new Set(selectedChapters);
  const steps:SoloStep[]=[{t:'intro',title:episode.title,text:'상황과 말하는 뜻을 이해하고, 필요한 표현을 익혀요.'}];
  for(const [index,chapter] of chapters.entries()){
    if(!selected.has(index))continue;
    steps.push({t:'intro',title:chapter.title,text:chapter.intent??'누가 누구에게 어떤 뜻으로 말하는지 생각하며 들어 보세요.'},
      {t:'watch',title:chapter.title,mode:'listen',clip:{videoId:source.youtubeId,start:chapter.start,end:chapter.end,
        captions:lines.filter(line=>line.start>=chapter.start&&line.end<=chapter.end).map(line=>({start:line.start,end:line.end,text:line.en}))}});
  }
  for(const word of material.words.filter(word=>selectedWords.includes(word.id)&&word.chapterIds.some(index=>selected.has(index))))
    steps.push({t:'meet',word:word.word,meaning:word.meaning,imageUrl:word.imageUrl,example:word.example});
  const shadow=lines.filter(line=>line.ko&&line.en.split(/\s+/).length>=3&&chapters.some((chapter,index)=>selected.has(index)&&line.start>=chapter.start&&line.end<=chapter.end));
  shadow.forEach((line,index)=>{
    if(index<Math.max(2,minutes/5))steps.push({t:'lineSing',en:line.en,ko:line.ko,originalOnly:true,practice:'repeat',clip:{videoId:source.youtubeId,start:line.start,end:line.end}});
    steps.push({t:'lineSing',en:line.en,ko:line.ko,originalOnly:true,practice:'shadow',clip:{videoId:source.youtubeId,start:line.start,end:line.end}});
  });
  let shadows=0;
  return {name:episode.title,minutes,steps:withSource(steps,{id:source.rows[0].id,name:episode.title}),checks:[],finalReview:true,
    defaultExcluded:steps.flatMap((step,index)=>step.t==='lineSing'&&step.practice==='shadow'&&++shadows>minutes/5?[index]:[])};
}
