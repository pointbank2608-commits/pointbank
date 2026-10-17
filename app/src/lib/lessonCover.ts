import type { CurriculumLesson, LessonSlide } from './types';
import { GAME_CATALOG } from './gameCatalog';
import { effectiveSlides } from './lessonSlides';

/** 수업 카드 표지(2026-10-17, 시안 03_lessons_selected) — 수업에는 미리보기 그림이 저장돼 있지 않아서, 수업에 든 첫 게임의 표지 그림을 쓰고 없으면 활동 종류로 정한 색 표지를 쓴다. */
export interface LessonCover {
  image: string | null;
  icon: string;
  /** 표지 바탕(Tailwind 클래스 전체 문자열 — 조립하지 않는다) */
  tone: string;
  /** 활동 종류 이름표(번역 키 접미사) */
  tags: TagKey[];
}

export type TagKey = 'vocab' | 'game' | 'grammar' | 'video' | 'material' | 'reading' | 'custom';

const TAG_OF: Record<LessonSlide['kind'], TagKey> = {
  image: 'custom',
  canvas: 'custom',
  web: 'custom',
  video: 'video',
  shadow: 'video',
  qna: 'video',
  drill: 'video',
  game: 'game',
  material: 'material',
  study: 'vocab',
  wordshow: 'vocab',
  attendance: 'vocab',
  grammar: 'grammar',
  rainbow: 'grammar',
  reading: 'reading',
};

const STYLE: Record<TagKey, { icon: string; tone: string }> = {
  vocab: { icon: 'abc', tone: 'bg-gradient-to-br from-[#fff4c2] to-[#ffe9a0]' },
  game: { icon: 'sports_esports', tone: 'bg-gradient-to-br from-[#e1ecff] to-[#c9dcff]' },
  grammar: { icon: 'rule', tone: 'bg-gradient-to-br from-[#ece8ff] to-[#d9d2ff]' },
  video: { icon: 'smart_display', tone: 'bg-gradient-to-br from-[#dff3ff] to-[#bfe6ff]' },
  material: { icon: 'print', tone: 'bg-gradient-to-br from-[#e3f7ec] to-[#c6eedb]' },
  reading: { icon: 'menu_book', tone: 'bg-gradient-to-br from-[#ffe9e0] to-[#ffd3c2]' },
  custom: { icon: 'auto_stories', tone: 'bg-gradient-to-br from-[#eaf1fb] to-[#d5e3f6]' },
};

export function lessonCover(lesson: Pick<CurriculumLesson, 'playlist' | 'video_url'>): LessonCover {
  const slides = effectiveSlides(lesson);
  const tags: TagKey[] = [];
  for (const s of slides) {
    const k = TAG_OF[s.kind];
    if (k && !tags.includes(k)) tags.push(k);
  }
  let image: string | null = null;
  for (const s of slides) {
    if (s.kind !== 'game') continue;
    const entry = GAME_CATALOG.find((g) => g.type === s.gameType);
    if (entry?.cover) {
      image = entry.cover;
      break;
    }
  }
  const first = tags[0] ?? 'custom';
  return { image, icon: STYLE[first].icon, tone: STYLE[first].tone, tags };
}
