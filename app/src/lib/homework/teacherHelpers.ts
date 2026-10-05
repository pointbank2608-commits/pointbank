/** 숙제 선생님 화면이 같이 쓰는 도우미(컴포넌트 파일 밖에 두어 빠른 새로고침이 깨지지 않게) */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchHomeworkOverview, fetchHomeworkSummary } from '../homework';
import type { FullCardItem } from '../types';
import type { BuildLabels } from './build';

/** 숙제 활동 이름(학생 화면에도 그대로 보인다) */
export function useBuildLabels(): BuildLabels {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      quiz: t('studentHw.kind_quiz'),
      worksheet: t('studentHw.kind_worksheet'),
      matchup: t('studentHw.game_matchup'),
      anagram: t('studentHw.game_anagram'),
      spelling: t('studentHw.game_spelling'),
      shadowing: t('studentHw.kind_shadowing'),
    }),
    [t],
  );
}

/** 낱말 카드 스냅샷(학습 기록의 card) → 카드 */
export function cardFromSnapshot(word: string, card: Record<string, unknown> | null | undefined, i = 0): FullCardItem | null {
  const meaning = typeof card?.meaning === 'string' ? card.meaning : '';
  if (!word || !meaning) return null;
  return {
    id: `snap-${i}-${word}`,
    word,
    meaning,
    imageUrl: typeof card?.imageUrl === 'string' ? card.imageUrl : null,
    example: typeof card?.example === 'string' ? card.example : null,
  };
}

/** 반 최근 숙제 3개에서 많이 틀린 낱말(카드가 있는 것만) */
export async function fetchClassWrongCards(classId: string): Promise<FullCardItem[]> {
  const list = (await fetchHomeworkOverview(classId)).filter((h) => h.kind !== 'custom').slice(0, 3);
  const sums = await Promise.all(list.map((h) => fetchHomeworkSummary(h.id).catch(() => null)));
  const count = new Map<string, { n: number; card: FullCardItem }>();
  sums.forEach((s) =>
    s?.class_wrong_words.forEach((w, i) => {
      const c = cardFromSnapshot(w.word, w.card, i);
      if (!c) return;
      const k = w.word.toLowerCase();
      count.set(k, { n: (count.get(k)?.n ?? 0) + w.count, card: c });
    }),
  );
  return [...count.values()].sort((a, b) => b.n - a.n).map((x) => x.card);
}


/** 판단 기준(서버 숫자 → 말). 문제 8개 미만이면 판단하지 않는다. */
export const MIN_SKILL_N = 8;
export type SkillLabel = 'good' | 'practice' | 'review';
export function skillLabel(n: number, rate: number | null): SkillLabel | null {
  if (n < MIN_SKILL_N || rate === null) return null;
  return rate >= 0.85 ? 'good' : rate >= 0.65 ? 'practice' : 'review';
}

