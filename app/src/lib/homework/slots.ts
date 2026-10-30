/**
 * 맞춤 칸(2026-10-30) — 숙제 틀(슬라이드 한 벌)에서 "학생마다 내용이 달라지는 칸".
 * 선생님은 틀 하나만 고치고, 보낼 때 학생마다 추천 엔진(rec-v1, AI 아님)이 만든 활동이 칸을 채운다.
 * 칸이 없는 활동(공통 블록)은 모든 학생에게 그대로 간다. 칸은 초안에서만 있고, 배정된 숙제에는 채워진 활동만 남는다.
 */
import type { Recommendation } from './recommend';
import type { FullCardItem } from '../types';
import { confuseQ, fadeQ, flashQ, shuffleWith, SKILL } from './build';
import type { HwItemDraft, HwQuestion } from './types';

export type SlotWant = 'quiz' | 'game' | 'memory';
export interface SlotConfig {
  /** quiz: 문제 활동(약한 낱말 퀴즈) · game: 혼자 하는 게임(글자 섞기·철자 등) · memory: 자동 암기 세트(학생의 약한 능력에 맞는 방식을 쉬운 것부터 이어서) */
  want: SlotWant;
  /** 칸 하나에 넣을 문제 수(1~12) */
  count: number;
  /** 재료 단어장 id(비우면 반의 가장 최근 단어장) */
  listId: string;
}

export const SLOT_NAMES: Record<SlotWant, [string, string]> = {
  quiz: ['학생별 맞춤 퀴즈', 'Personal quiz'],
  game: ['학생별 맞춤 게임', 'Personal game'],
  memory: ['자동 암기 세트', 'Auto memorize set'],
};

export const isSlot = (it: HwItemDraft) => !!it.config.slot;
export const hasSlots = (items: HwItemDraft[]) => items.some(isSlot);

export function newSlot(want: SlotWant, en = false): HwItemDraft {
  return {
    kind: want === 'game' ? 'game' : 'quiz',
    title: SLOT_NAMES[want][en ? 1 : 0],
    config: { slot: { want, count: want === 'game' ? 6 : want === 'memory' ? 20 : 5, listId: '' } },
    content: { questions: [] },
  };
}

export interface ExpandResult {
  /** 배정할 활동(칸은 이 학생의 활동으로 바뀌었고, 채울 게 없는 칸은 빠졌다) */
  items: HwItemDraft[];
  /** 채울 재료가 없어 빠진 칸 수 */
  empty: number;
}

/**
 * 한 학생의 추천(rec)으로 칸을 채운다. 같은 종류 추천 활동을 앞에서부터 하나씩 쓰고, 문제는 칸의 count 만큼만 남긴다.
 * 순수 함수 — 서버·난수를 부르지 않는다.
 */
export function expandSlots(items: HwItemDraft[], rec: Pick<Recommendation, 'items'> | null, pool: FullCardItem[] = []): ExpandResult {
  const quizzes = (rec?.items ?? []).filter((x) => x.kind === 'quiz' || x.kind === 'worksheet');
  const games = (rec?.items ?? []).filter((x) => x.kind === 'game');
  const used = { quiz: 0, game: 0 };
  let empty = 0;
  const out: HwItemDraft[] = [];
  for (const it of items) {
    const slot = it.config.slot;
    if (!slot) {
      out.push(structuredClone(it));
      continue;
    }
    if (slot.want === 'memory') {
      const made = memorySet(rec?.items ?? [], pool, Math.max(1, Math.min(Math.round(slot.count) || 1, 60)));
      if (!made.length) {
        empty += 1;
        continue;
      }
      out.push({ kind: 'quiz', title: it.title.trim() || SLOT_NAMES.memory[0], config: {}, content: { questions: made } });
      continue;
    }
    const source = slot.want === 'game' ? games : quizzes;
    const pick = source[used[slot.want as 'quiz' | 'game']++];
    const count = Math.max(1, Math.min(Math.round(slot.count) || 1, 12));
    if (!pick || !pick.content.questions.length) {
      empty += 1;
      continue;
    }
    const { slot: _slot, ...config } = pick.config;
    void _slot;
    out.push({
      ...structuredClone(pick),
      title: it.title.trim() || pick.title,
      config,
      content: { ...structuredClone(pick.content), questions: structuredClone(pick.content.questions.slice(0, count)) },
    });
  }
  return { items: out, empty };
}

/**
 * 자동 암기 세트(규칙 기반, AI 아님): 추천 엔진이 이 학생에게 골라 준 문제(약한 낱말·복습할 때·새 낱말)를
 * 쉬운 것(고르기)에서 어려운 것(떠올려 쓰기)으로 이어 붙이고, 철자·소리를 약해 하는 낱말에는 섬광 카드·점점 가리기를,
 * 뜻을 헷갈리는 낱말에는 헷갈리는 짝 고르기를 더한다. 같은 낱말은 서로 다른 방식으로 한 번씩만 다시 묻는다.
 */
export function memorySet(recItems: HwItemDraft[], pool: FullCardItem[], count: number): HwQuestion[] {
  const base = recItems.flatMap((x) => x.content.questions);
  const rng = Math.random;
  const stage = (q: HwQuestion) => (q.qtype === 'choice' ? 0 : q.style === 'letters' ? 1 : 2);
  const extra: HwQuestion[] = [];
  const seen = new Set<string>();
  for (const q of base) {
    const key = q.word.toLowerCase();
    if (!q.card || !key || seen.has(key)) continue;
    seen.add(key);
    const card: FullCardItem = { id: key, word: q.card.word, meaning: q.card.meaning, imageUrl: q.card.imageUrl ?? null, example: q.card.example ?? null };
    const more =
      q.skill === SKILL.spelling || q.skill === SKILL.dictation
        ? [fadeQ(card), flashQ(card)]
        : q.skill === SKILL.listen
          ? [flashQ(card)]
          : [confuseQ(card, pool, rng)];
    for (const m of more) if (m) extra.push(m);
  }
  const all = [...base, ...shuffleWith(extra, rng)];
  all.sort((a, b) => stage(a) - stage(b));
  return all.slice(0, count);
}
