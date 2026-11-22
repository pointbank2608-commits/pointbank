import { effectiveSlides } from './lessonSlides';
import type { CurriculumLesson, VideoSlide } from './types';

/** The editor and thumbnail playback must select the same teacher-owned revision. */
export function findVideoQuestionLesson(rows: CurriculumLesson[], clipId: string, teacherId: string, episodeId?:string) {
  const matches=(s:ReturnType<typeof effectiveSlides>[number]):s is VideoSlide=>s.kind==='video'&&s.clipId===clipId&&!!s.questionLesson&&(episodeId?s.animationEpisode?.id===episodeId:!s.animationEpisode);
  const lesson = rows.filter(row => row.created_by === teacherId && effectiveSlides(row).some(matches))
    .sort((a,b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))[0];
  const slide = lesson && effectiveSlides(lesson).find(matches);
  return lesson && slide ? {lesson,slide} : null;
}
