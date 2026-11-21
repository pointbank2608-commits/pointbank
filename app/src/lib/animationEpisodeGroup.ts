import type {EpisodeMaterial} from './animationEpisodes';
import {lessonBoard,lessonTitleSlide} from './lessonCanvas';
import type {FullCardItem,LessonSlide,VideoSlide} from './types';

export type EpisodeGroupSelection={episodeId:string;chapterStarts:number[];wordIds:string[];minutes:number};
const stamp=(seconds:number)=>`${Math.floor(seconds/60)}:${(seconds%60).toFixed(3).padStart(6,'0')}`;

/** Editable classroom draft from the shared reviewed catalogue. No writes. */
export function episodeGroupLesson(material:EpisodeMaterial,selection:EpisodeGroupSelection){
  const {episode,source,chapters}=material;
  if(selection.episodeId!==episode.id)throw Error('Episode selection mismatch');
  const selected=chapters.filter(chapter=>selection.chapterStarts.includes(chapter.start));
  if(!selected.length)throw Error('Choose at least one chapter');
  const words=material.words.filter(word=>selection.wordIds.includes(word.id)&&word.chapterIds.some(index=>selection.chapterStarts.includes(chapters[index].start)));
  const cards:FullCardItem[]=words.map(word=>({id:word.id,word:word.word,meaning:word.meaning,imageUrl:word.imageUrl,example:word.example}));
  const slides:LessonSlide[]=[lessonTitleSlide(episode.title,`${source.series} · ${selection.minutes}분 · ${selected.length}개 챕터`,'pastel')];
  if(cards.length)slides.push({id:crypto.randomUUID(),kind:'wordshow',words:cards,boardTheme:'whiteboard'});
  // Separate nonconsecutive selections: omitted chapters never slip into a broad playback envelope.
  const runs:typeof selected[]=[];
  for(const chapter of selected){const run=runs.at(-1);if(run?.at(-1)?.end===chapter.start)run.push(chapter);else runs.push([chapter]);}
  for(const run of runs){
    const start=run[0].start,end=run.at(-1)!.end;
    const lines=material.lines.filter(line=>line.start>=start&&line.end<=end);
    const script=lines.map(line=>`[${stamp(line.start)}-${stamp(line.end)}] ${line.speaker?line.speaker+': ':''}${line.en}${line.ko?' | '+line.ko:''}`).join('\n');
    const video:VideoSlide={id:crypto.randomUUID(),kind:'video',title:episode.title,clipId:source.rows[0].id,videoUrl:`https://www.youtube.com/watch?v=${source.youtubeId}`,startSec:start,endSec:end,
      source:script,chapters:run.map(chapter=>({title:chapter.title,start:chapter.start,end:chapter.end})),
      animationEpisode:{id:episode.id,revision:episode.boundary?.revision??1,start:episode.start,end:episode.end}};
    slides.push(video,lessonBoard('상황과 말하는 뜻을 이야기해요',['누가 무엇을 원했나요?','상대방은 어떻게 반응했나요?','말하는 뜻을 우리말로 설명해 보세요.'],4,'whiteboard'));
    if(lines.length)slides.push({id:crypto.randomUUID(),kind:'shadow',title:episode.title,videoUrl:video.videoUrl,source:script,flow:'manual',repeat:1,speed:1,subtitle:'both',roleTeams:0,clipId:video.clipId});
  }
  slides.push(lessonBoard('오늘 배운 내용 총정리',['어떤 상황에서 어떤 뜻으로 말했나요?','오늘 고른 표현을 새로운 상황에 써 보세요.'],5,'whiteboard'));
  return {name:episode.title,slides};
}
