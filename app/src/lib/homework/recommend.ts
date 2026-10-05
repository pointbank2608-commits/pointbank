/**
 * 맞춤 숙제 추천(규칙 기반, AI 아님) — `student_review_candidates`(041)가 주는 낱말별 기록 → 추천 활동 + 사람이 읽을 이유.
 *
 * 규칙(REC_RULE_VERSION 에 기록):
 *  - 기본 12문제(약 10분, 최대 15분을 넘지 않게).
 *  - 60%: 최근 30일에 틀린 낱말 중 아직 다시 익히지 않은 것(틀린 뒤 맞힌 횟수가 2번 미만).
 *  - 20%: 7~45일 전에 본 뒤 틀린 적 없는 낱말(복습할 때).
 *  - 20%: 최근에 맞힌 낱말 또는 단어장의 새 낱말.
 *  - 틀린 문제를 그대로 다시 내지 않는다: 뜻을 틀리면 뜻→단어(반대 방향)·빈칸, 철자를 틀리면 글자 순서·철자 입력,
 *    듣기를 틀리면 듣고 고르기, 그림을 틀리면 그림 보고 고르기.
 *  - 자료가 부족하면(처음 답 30개 미만 또는 끝낸 활동 3개 미만) 개인화라고 하지 않고 반 공통 복습을 제안한다.
 *  - 자동으로 보내지 않는다 — 선생님이 확인하고 보낼 때만 숙제가 생긴다.
 */
import { blankSentence } from '../liveQuiz';
import type { FullCardItem } from '../types';
import { blankQ, cardOf, GEN_VERSION, lettersQ, listenQ, meaningQ, pictureQ, reverseQ, SKILL, spellQ, type BuildLabels, type Rng } from './build';
import type { HwCard, HwItemDraft, HwQuestion } from './types';

export const REC_RULE_VERSION = 'rec-v1';
const TARGET = 12;
const DAY = 86_400_000;

interface SkillStat {
  wrong: number;
  right: number;
  last_wrong: string | null;
  last_right: string | null;
}

export interface ReviewCandidates {
  graded: number;
  completed_activities: number;
  words: { word: string; card: (Partial<HwCard> & Record<string, unknown>) | null; last_seen: string; skills: Record<string, SkillStat> }[];
}

export type ReasonKind = 'wrong_meaning' | 'wrong_spelling' | 'wrong_listen' | 'wrong_picture' | 'wrong_context' | 'review_due' | 'keep_strong' | 'new_word' | 'common_review';

export interface RecReason {
  word: string;
  kind: ReasonKind;
  count?: number;
  days?: number;
}

export interface Recommendation {
  personal: boolean;
  items: HwItemDraft[];
  reasons: RecReason[];
  ruleVersion: string;
}

const toCard = (w: ReviewCandidates['words'][number]): FullCardItem | null => {
  const meaning = typeof w.card?.meaning === 'string' ? w.card.meaning : '';
  if (!meaning) return null;
  return {
    id: `rec-${w.word}`,
    word: w.word,
    meaning,
    imageUrl: typeof w.card?.imageUrl === 'string' ? w.card.imageUrl : null,
    example: typeof w.card?.example === 'string' ? w.card.example : null,
  };
};

const time = (s: string | null) => (s ? new Date(s).getTime() : 0);

/** 이 낱말에서 가장 약한 스킬(최근 30일 틀림, 틀린 뒤 2번 이상 맞히지 않은 것) */
function weakestSkill(skills: Record<string, SkillStat>, now: number): { skill: string; wrong: number } | null {
  let best: { skill: string; wrong: number } | null = null;
  for (const [skill, s] of Object.entries(skills)) {
    if (!s.wrong || now - time(s.last_wrong) > 30 * DAY) continue;
    const relearned = time(s.last_right) > time(s.last_wrong) && s.right >= s.wrong + 2;
    if (relearned) continue;
    if (!best || s.wrong > best.wrong) best = { skill, wrong: s.wrong };
  }
  return best;
}

/** 약한 스킬에 맞는, 처음과 다른 모양의 문제 */
function questionsFor(skill: string, c: FullCardItem, pool: FullCardItem[], rng: Rng): HwQuestion[] {
  const pick = (...qs: (HwQuestion | null)[]) => qs.filter((q): q is HwQuestion => !!q);
  switch (skill) {
    case SKILL.spelling:
      return pick(lettersQ(c, rng), spellQ(c));
    case SKILL.listen:
      return pick(listenQ(c, pool, rng));
    case SKILL.picture:
      return pick(pictureQ(c, pool, rng) ?? reverseQ(c, pool, rng));
    case SKILL.context:
      return pick(blankQ(c, pool, rng) ?? reverseQ(c, pool, rng));
    default:
      // 뜻을 틀렸으면 반대 방향(뜻 → 단어)과 빈칸으로
      return pick(reverseQ(c, pool, rng), blankSentence(c.example, c.word) ? blankQ(c, pool, rng) : null);
  }
}

const reasonFor = (skill: string): ReasonKind =>
  skill === SKILL.spelling ? 'wrong_spelling' : skill === SKILL.listen ? 'wrong_listen' : skill === SKILL.picture ? 'wrong_picture' : skill === SKILL.context ? 'wrong_context' : 'wrong_meaning';

function group(questions: HwQuestion[], labels: BuildLabels): HwItemDraft[] {
  const quiz = questions.filter((q) => q.qtype === 'choice' && q.style !== 'blank');
  const sheet = questions.filter((q) => q.style === 'blank');
  const letters = questions.filter((q) => q.style === 'letters');
  const spell = questions.filter((q) => q.style === 'spell');
  const items: HwItemDraft[] = [];
  if (quiz.length) items.push({ kind: 'quiz', title: labels.quiz, config: {}, content: { questions: quiz } });
  if (sheet.length) items.push({ kind: 'worksheet', title: labels.worksheet, config: { sheets: ['blank'] }, content: { questions: sheet } });
  if (letters.length) items.push({ kind: 'game', title: labels.anagram, config: { game: 'anagram' }, content: { questions: letters } });
  if (spell.length) items.push({ kind: 'game', title: labels.spelling, config: { game: 'spelling' }, content: { questions: spell } });
  return items;
}

/**
 * @param cand 학생 기록
 * @param pool 반의 최근 단어장 카드(새 낱말·오답 보기 재료)
 * @param common 자료가 부족할 때 쓸 반 공통 복습 낱말(반이 많이 틀린 낱말 우선)
 */
export function recommendForStudent(cand: ReviewCandidates, pool: FullCardItem[], common: FullCardItem[], labels: BuildLabels, now = Date.now(), rng: Rng = Math.random): Recommendation {
  const known = cand.words.map((w) => ({ w, card: toCard(w) })).filter((x): x is { w: ReviewCandidates['words'][number]; card: FullCardItem } => !!x.card);
  const allPool = dedupe([...pool, ...known.map((k) => k.card), ...common]);
  const enough = cand.graded >= 30 && cand.completed_activities >= 3;

  if (!enough) {
    const words = dedupe([...common, ...pool]).slice(0, 8);
    const qs: HwQuestion[] = [];
    words.forEach((c, i) => {
      const q = i % 2 === 0 ? meaningQ(c, allPool, rng) : listenQ(c, allPool, rng);
      if (q) qs.push(q);
    });
    words.slice(0, 4).forEach((c) => {
      const q = lettersQ(c, rng);
      if (q) qs.push(q);
    });
    return { personal: false, items: group(qs.slice(0, TARGET), labels), reasons: words.slice(0, 5).map((c) => ({ word: c.word, kind: 'common_review' })), ruleVersion: REC_RULE_VERSION };
  }

  const weak = known
    .map((k) => ({ ...k, weak: weakestSkill(k.w.skills, now) }))
    .filter((k) => k.weak)
    .sort((a, b) => (b.weak?.wrong ?? 0) - (a.weak?.wrong ?? 0));
  const weakWords = new Set(weak.map((k) => k.w.word));
  const anyWrong30 = (k: (typeof known)[number]) => Object.values(k.w.skills).some((s) => s.wrong && now - time(s.last_wrong) <= 30 * DAY);
  const due = known.filter((k) => !weakWords.has(k.w.word) && !anyWrong30(k) && now - time(k.w.last_seen) >= 7 * DAY && now - time(k.w.last_seen) <= 45 * DAY);
  const strong = known.filter((k) => !weakWords.has(k.w.word) && !due.includes(k) && Object.values(k.w.skills).some((s) => s.right > 0));
  const seen = new Set(known.map((k) => k.w.word.toLowerCase()));
  const fresh = pool.filter((c) => !seen.has(c.word.trim().toLowerCase()));

  const nWeak = Math.round(TARGET * 0.6);
  const nDue = Math.round(TARGET * 0.2);
  const qs: HwQuestion[] = [];
  const reasons: RecReason[] = [];

  for (const k of weak) {
    if (qs.length >= nWeak) break;
    const add = questionsFor(k.weak!.skill, k.card, allPool, rng).slice(0, nWeak - qs.length);
    if (add.length) {
      qs.push(...add);
      reasons.push({ word: k.w.word, kind: reasonFor(k.weak!.skill), count: k.weak!.wrong });
    }
  }
  const dueTaken = due.slice(0, nDue + (nWeak - Math.min(qs.length, nWeak)));
  for (const k of dueTaken) {
    const q = meaningQ(k.card, allPool, rng);
    if (q) {
      qs.push(q);
      reasons.push({ word: k.w.word, kind: 'review_due', days: Math.round((now - time(k.w.last_seen)) / DAY) });
    }
  }
  const rest = [...fresh.map((c) => ({ card: c, isNew: true })), ...strong.map((k) => ({ card: k.card, isNew: false }))];
  for (const r of rest) {
    if (qs.length >= TARGET) break;
    const q = r.isNew ? meaningQ(r.card, allPool, rng) : listenQ(r.card, allPool, rng);
    if (q) {
      qs.push(q);
      reasons.push({ word: r.card.word, kind: r.isNew ? 'new_word' : 'keep_strong' });
    }
  }
  return { personal: true, items: group(qs.slice(0, 15), labels), reasons, ruleVersion: REC_RULE_VERSION };
}

function dedupe(cards: FullCardItem[]): FullCardItem[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    const k = c.word.trim().toLowerCase();
    if (!k || !c.meaning?.trim() || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export { cardOf, GEN_VERSION };
