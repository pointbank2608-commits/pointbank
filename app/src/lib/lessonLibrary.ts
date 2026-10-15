import type { GameType } from './types';
import type { LessonLevel } from './lessonLevel';

/**
 * 수업 라이브러리(2026-10-15) — 게임을 어떻게 쓸지 모르는 선생님이 "완성된 수업"을 꺼내 쓰는 곳.
 * 내 수업 > 수업 라이브러리에서 고르면 내 반의 수업(슬라이드·블록)으로 복사되고, 그 뒤엔 평소 수업처럼 고치거나 바로 시작한다.
 * 수업의 내용(슬라이드)은 수업 레시피(lessonRecipes.ts)가 만든다 — 새 라이브러리 수업 = 레시피 한 개 + 여기 한 줄 + 번역 문구.
 * 완성도 높은 수업만 올린다(사용자 결정 2026-10-15). 나중에 개수가 늘면 관리자가 DB에 올리는 방식으로 옮길 수 있다.
 */
export interface LibraryLesson {
  id: string;
  /** 슬라이드를 만들어 주는 레시피 id */
  recipeId: string;
  icon: string;
  cover: string;
  minutes: number;
  levels: LessonLevel[];
  /** 이 수업이 쓰는 게임 — 게임 이름으로 찾을 수 있게 */
  games: GameType[];
  /** 수업에 낱말 단어장이 필요한지(필요하면 가져올 때 단어장을 고른다) */
  needsWords: boolean;
  /** 번역 키: lessonLibrary.<id>Name / Desc / Steps */
  key: string;
}

export const LESSON_LIBRARY: LibraryLesson[] = [
  {
    id: 'airport',
    recipeId: 'airport',
    icon: 'flight',
    cover: '/covers/game-airport.jpg',
    minutes: 40,
    levels: ['elementary', 'middle'],
    games: ['airport'],
    needsWords: false,
    key: 'airport',
  },
  {
    id: 'restaurant',
    recipeId: 'restaurant',
    icon: 'restaurant',
    cover: '/covers/game-restaurant.jpg',
    minutes: 40,
    levels: ['elementary', 'middle'],
    games: ['restaurant'],
    needsWords: false,
    key: 'restaurant',
  },
  {
    id: 'icecream',
    recipeId: 'icecream',
    icon: 'icecream',
    cover: '/covers/game-icecream.jpg',
    minutes: 40,
    levels: ['elementary'],
    games: ['icecream'],
    needsWords: false,
    key: 'icecream',
  },
  {
    id: 'doctor',
    recipeId: 'doctor',
    icon: 'medical_services',
    cover: '/covers/game-doctor.jpg',
    minutes: 40,
    levels: ['elementary'],
    games: ['doctor'],
    needsWords: false,
    key: 'doctor',
  },
  {
    id: 'lightning',
    recipeId: 'lightning',
    icon: 'thunderstorm',
    cover: '/covers/game-lightning.jpg',
    minutes: 30,
    levels: ['elementary', 'middle'],
    games: ['lightning'],
    needsWords: false,
    key: 'lightning',
  },
];
