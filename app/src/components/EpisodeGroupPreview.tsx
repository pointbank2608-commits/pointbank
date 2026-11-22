import {useState} from 'react';
import AccessibleDialog from './AccessibleDialog';
import LessonSlideContent from './LessonSlideContent';
import type {LessonSlide} from '../lib/types';

/** The real classroom/student renderer, without a saved run or sensor context. */
export default function EpisodeGroupPreview({name,slides,onClose}:{name:string;slides:LessonSlide[];onClose:()=>void}){
  const [index,setIndex]=useState(0);
  const slide=slides[index];
  return <AccessibleDialog label="단체수업 미리보기" onClose={onClose}>
    <section className="w-full min-w-0 space-y-3 p-3" data-group-episode-preview>
      <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{name}</h2><button type="button" className="min-h-11 rounded-xl border px-4" onClick={onClose}>설정으로 돌아가기</button></header>
      <p className="text-sm text-on-surface-variant">단체수업 미리보기예요. 수업 저장이나 학습 기록은 남지 않아요.</p>
      <nav aria-label="단체수업 슬라이드 이동" className="flex items-center gap-3"><button type="button" disabled={!index} onClick={()=>setIndex(i=>i-1)} className="min-h-11 rounded-xl border px-4 disabled:opacity-40">이전 슬라이드</button><span>{index+1}/{slides.length}</span><button type="button" disabled={index===slides.length-1} onClick={()=>setIndex(i=>i+1)} className="min-h-11 rounded-xl border px-4 disabled:opacity-40">다음 슬라이드</button></nav>
      <div className="relative h-[min(68vh,680px)] min-h-96 overflow-auto rounded-xl bg-slate-50" data-group-preview-slide={slide.id}>
        <LessonSlideContent key={slide.id} slide={slide} words={[]} fill lessonName={name} attendance={null} student lessonSlides={slides}/>
      </div>
    </section>
  </AccessibleDialog>;
}
