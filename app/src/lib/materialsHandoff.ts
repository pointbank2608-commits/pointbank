import type { FullCardItem } from './types';

/**
 * 사전·파닉스·내 단어장에서 고른 단어를 수업 자료실 페이지로 넘길 때 쓰는 라우터 state 모양.
 * 전역 스토어 대신 navigate(path, { state }) 로만 넘긴다 — 새로고침하면 사라지지만, 옛 선택이
 * 나중에 열어본 자료실 페이지를 몰래 채워두는 일이 없다.
 */
export interface MaterialsHandoffState {
  materialsWords?: FullCardItem[];
  /** 워크시트 페이지가 처음 열 탭(주제별 워크시트에서 유형을 골라 넘어올 때). */
  materialsTab?: string;
  /** 색칠하기 탭의 제목·장식 주제 초기값(주제별 워크시트에서 넘어올 때). */
  materialsColoringTitle?: string;
  materialsDecorTheme?: string | null;
}

/** 자료실 페이지가 마운트될 때 useState 초기값으로 쓴다(선택 없이 직접 들어오면 빈 배열). */
export function wordsFromLocationState(state: unknown): FullCardItem[] {
  const words = (state as MaterialsHandoffState | null)?.materialsWords;
  if (!Array.isArray(words)) return [];
  return words.filter((w) => typeof w?.id === 'string' && typeof w?.word === 'string');
}

export function handoffFromLocationState(state: unknown): MaterialsHandoffState {
  return (state as MaterialsHandoffState | null) ?? {};
}

/** 자료실 페이지 경로 — 선택 바·단어장 목록 어디서든 같은 버튼 세트를 쓰기 위한 목록. */
export const MATERIAL_TARGETS = [
  { id: 'flashcards', path: '/materials/flashcards', icon: 'print', labelKey: 'materials.launch.flashcards', primary: true },
  { id: 'worksheet', path: '/materials/worksheet', icon: 'description', labelKey: 'materials.launch.worksheet', primary: false },
  { id: 'bingo', path: '/materials/bingo', icon: 'grid_on', labelKey: 'materials.launch.bingo', primary: false },
  { id: 'memorycards', path: '/materials/memory-cards', icon: 'style', labelKey: 'materials.launch.memoryCards', primary: false },
] as const;
