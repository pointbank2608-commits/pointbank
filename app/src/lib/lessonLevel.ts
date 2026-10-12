import { useCallback, useState } from 'react';

/**
 * 수업 만들기의 "대상" 고르기(2026-10-12 사용자 제안) — 초등 체험형 수업과 중·고등 학교 진도·입시용 수업이 같이 있어서
 * 처음에 대상을 고르면 그 대상에 맞는 수업 세트·레시피·노래·교과과정만 보여 준다. 선택은 이 브라우저에 기억한다.
 */
export type LessonLevel = 'elementary' | 'middle' | 'high';
export type LessonLevelFilter = LessonLevel | 'all';

export const LESSON_LEVELS: { id: LessonLevelFilter; ko: string; en: string }[] = [
  { id: 'all', ko: '전체', en: 'All' },
  { id: 'elementary', ko: '초등', en: 'Elementary' },
  { id: 'middle', ko: '중등', en: 'Middle school' },
  { id: 'high', ko: '고등', en: 'High school' },
];

const KEY = 'classbank.lessonLevel';

export function readLessonLevel(): LessonLevelFilter {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'elementary' || v === 'middle' || v === 'high' || v === 'all') return v;
  } catch {
    // 저장소를 못 쓰는 환경 — 기본값
  }
  return 'all';
}

export function useLessonLevel(): [LessonLevelFilter, (l: LessonLevelFilter) => void] {
  const [level, setLevel] = useState<LessonLevelFilter>(readLessonLevel);
  const set = useCallback((l: LessonLevelFilter) => {
    setLevel(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // 무시
    }
  }, []);
  return [level, set];
}

/** 필터가 전체이거나, 항목의 대상에 필터가 들어 있으면 보인다. 대상이 안 적힌 항목은 초등용으로 본다(옛 수업 세트). */
export function levelMatches(filter: LessonLevelFilter, levels: readonly LessonLevel[] | undefined, fallback: LessonLevel[] = ['elementary']): boolean {
  if (filter === 'all') return true;
  return (levels && levels.length > 0 ? levels : fallback).includes(filter);
}
