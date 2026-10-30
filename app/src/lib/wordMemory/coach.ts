/**
 * 단어암기 프로젝트 선생님 도구 — 시험 숙제 만들기(구간 시험·최종 시험·헷갈리는 낱말 확인)와 학부모 요약 글.
 * 시험은 새 서버 기능 없이 기존 숙제(졸업 시험 방식: 낱말마다 뜻·듣기·철자·빈칸 중 다른 방식으로 한 번씩)로 낸다 — 결과는 숙제 결과 화면에서 본다.
 */
import { createHomework } from '../homework';
import { memoryItemFromCards } from '../homework/memory';
import type { FullCardItem } from '../types';
import type { WmCardRow, WmProgressStudent } from './types';

export const SECTION_SIZE = 50;

export const toFullCards = (rows: readonly WmCardRow[]): FullCardItem[] =>
  rows.map((r, i) => ({ id: r.key || String(i), word: r.word, meaning: r.meaning, imageUrl: r.imageUrl ?? null, example: r.example ?? null, category: null }) as FullCardItem);

/** 시험 숙제 한 개(졸업 시험 블록)를 만들어 학생들에게 낸다. 낱말이 모자라 문제를 못 만들면 'no_questions' */
export async function createCheckTest(a: { classId: string; studentIds: string[]; title: string; cards: readonly WmCardRow[]; en: boolean }) {
  const item = memoryItemFromCards(toFullCards(a.cards), 'graduate', Math.min(a.cards.length, 100), a.en);
  if (!item) throw new Error('no_questions');
  item.title = a.title;
  return createHomework({ requestId: crypto.randomUUID(), classId: a.classId, title: a.title, items: [item], studentIds: a.studentIds, dueAt: null, kind: 'selected' });
}

/** 최종 시험 낱말: 아직 졸업 못 한 낱말이 20개 이상이면 그 낱말로, 아니면 전체에서 무작위 100개 */
export function pickFinalCards(weak: readonly WmCardRow[], all: readonly WmCardRow[], rng: () => number = Math.random): WmCardRow[] {
  if (weak.length >= 20) return weak.slice(0, 100);
  const a = [...all];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 100);
}

export const sectionCount = (words: number) => Math.max(1, Math.ceil(words / SECTION_SIZE));

const fmtDate = (iso: string, en: boolean) => {
  const [, m, d] = iso.split('-').map(Number);
  return en ? `${m}/${d}` : `${m}월 ${d}일`;
};

/** 학부모에게 카톡으로 보낼 한 줄 요약(평가·순위 없이 숫자와 다음 일정만) */
export function parentSummary(a: { en: boolean; student: string; planTitle: string; words: number; progress: WmProgressStudent; streak?: number }): string {
  const { en, progress: p } = a;
  const pct = a.words > 0 ? Math.round((100 * p.kept) / a.words) : 0;
  const lines = en
    ? [`[Word project] ${a.student} – ${a.planTitle}`, `• Words met: ${p.met}/${a.words}`, `• Words remembered days later: ${p.kept} (${pct}%)`]
    : [`[단어 암기 프로젝트] ${a.student} 학생 – ${a.planTitle}`, `• 만난 낱말 ${p.met}/${a.words}개`, `• 며칠 뒤에도 기억한 낱말 ${p.kept}개 (${pct}%)`];
  if (a.streak && a.streak > 0) lines.push(en ? `• Studied ${a.streak} day(s) in a row` : `• 연속 학습 ${a.streak}일`);
  if (p.completed) lines.push(en ? 'Goal reached!' : '목표를 달성했어요!');
  else if (p.pace.graduate_date) lines.push(en ? `At this pace the project finishes around ${fmtDate(p.pace.graduate_date, true)}.` : `지금 속도라면 ${fmtDate(p.pace.graduate_date, false)} 무렵 마칠 수 있어요.`);
  lines.push(en ? 'Thank you for your support!' : '집에서도 응원해 주세요.');
  return lines.join('\n');
}

export { fmtDate };
