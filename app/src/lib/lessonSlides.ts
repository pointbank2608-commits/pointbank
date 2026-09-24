import type { CurriculumLesson, GameType, LegacyCurriculumStep, LessonSlide } from './types';

function isLegacyPlaylist(playlist: unknown): playlist is LegacyCurriculumStep[] {
  if (!Array.isArray(playlist) || playlist.length === 0) return false;
  // 새 슬라이드는 전부 kind 가 있다 — 옛 재생목록({id, gameType})은 없다.
  return !('kind' in (playlist[0] as object));
}

/**
 * curriculum_lessons.playlist 를 항상 LessonSlide[] 로 읽는다.
 * - 새 레슨: playlist 가 이미 LessonSlide[] 라 그대로 돌려준다.
 * - 옛 레슨(슬라이드 빌더 이전, {id, gameType}[] 모양): GameSlide[] 로 간주해 읽고,
 *   video_url 이 있으면 맨 앞에 VideoSlide 를 하나 합성한다.
 * DB 백필 없이 메모리에서만 보정 — 편집 화면에서 한 번 저장하면 새 구조로 자연히 바뀐다
 * (자가 치유). 저장 자체는 하지 않으므로 순수 함수로 몇 번을 호출해도 안전하다.
 */
export function effectiveSlides(lesson: Pick<CurriculumLesson, 'playlist' | 'video_url'>): LessonSlide[] {
  const slides: LessonSlide[] = isLegacyPlaylist(lesson.playlist)
    ? lesson.playlist.map((step) => ({ id: step.id, kind: 'game' as const, gameType: step.gameType as GameType }))
    : (lesson.playlist as LessonSlide[]);

  const hasVideoSlide = slides.some((s) => s.kind === 'video');
  if (!hasVideoSlide && lesson.video_url) {
    return [{ id: `legacy-video-${lesson.video_url}`, kind: 'video', videoUrl: lesson.video_url }, ...slides];
  }
  return slides;
}
