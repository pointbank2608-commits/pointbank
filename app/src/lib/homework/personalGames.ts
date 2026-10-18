import type { FullCardItem } from '../types';
import type { SoloStep } from '../soloLessons';
import {
  recommendForStudent,
  type ReviewCandidates,
  type Recommendation,
} from './recommend';
import { type BuildLabels, type Rng, SKILL } from './build';
import type { HwItemDraft, HwQuestion } from './types';

/** 선택한 자료 안에서 개인화한다. 원본 단어장/기록은 변경하지 않는다. */
export function recommendGamePractice(
  candidates: ReviewCandidates,
  pool: FullCardItem[],
  common: FullCardItem[],
  labels: BuildLabels,
  now = Date.now(),
  rng: Rng = Math.random,
  scopeToPool = false,
): Recommendation {
  const source = new Map(pool.map((c) => [c.word.trim().toLowerCase(), c]));
  const keys = new Set(source.keys());
  const scoped = scopeToPool
    ? {
        ...candidates,
        words: candidates.words
          .filter((w) => {
            const c = source.get(w.word.trim().toLowerCase());
            return (
              c &&
              (!w.card?.meaning ||
                String(w.card.meaning).trim() === c.meaning.trim())
            );
          })
          .map((w) => ({
            ...w,
            card: { ...source.get(w.word.trim().toLowerCase())! },
          })),
      }
    : candidates;
  const rec = recommendForStudent(
    scoped,
    pool,
    scopeToPool
      ? common.filter((c) => keys.has(c.word.trim().toLowerCase()))
      : common,
    labels,
    now,
    rng,
  );
  const buckets = new Map<string, HwItemDraft>();
  for (const item of rec.items)
    for (const original of item.content.questions) {
      const q = { ...original };
      // 직접 철자 확인에는 소리 힌트를 붙이지 않는다. 듣기는 별도 능력으로 측정한다.
      if (q.skill === SKILL.spelling) q.speak = null;
      const key =
        q.style === 'letters'
          ? 'anagram'
          : q.qtype === 'text'
            ? 'spelling'
            : q.skill.startsWith('listening.')
              ? 'listen'
              : 'choice';
      if (!buckets.has(key))
        buckets.set(key, {
          kind: 'game',
          title:
            key === 'anagram'
              ? labels.anagram
              : key === 'spelling'
                ? labels.spelling
                : labels.quiz,
          config: key === 'anagram' || key === 'spelling' ? { game: key } : {},
          content: { questions: [] },
        });
      buckets.get(key)!.content.questions.push(q);
    }
  return {
    ...rec,
    items: [...buckets.values()],
    ruleVersion: 'personal-game-v1',
  };
}

/** 같은 문제를 기존 개별수업 서버 채점 형식으로 변환한다. 저장은 교사 권한으로 한다. */
export function gamePracticeToSolo(
  items: HwItemDraft[],
  title: string,
): SoloStep[] {
  const steps: SoloStep[] = [
    { t: 'intro', title, text: '짧은 게임으로 오늘 필요한 낱말을 연습해요.' },
  ];
  for (const item of items)
    for (const q of item.content.questions) {
      const step = questionToSolo(q);
      if (step) steps.push(step);
    }
  return steps;
}
function questionToSolo(q: HwQuestion): SoloStep | null {
  const imageUrl = q.imageUrl ?? null;
  if (q.qtype === 'choice' && q.choices && typeof q.correct === 'number') {
    const common = { options: [...q.choices], answer: q.correct };
    if (q.style === 'listen')
      return {
        t: 'listenPick',
        word: q.speak || q.word,
        ...common,
        images: q.choices.map(() => null),
      };
    if (q.style === 'blank')
      return {
        t: 'fillBlank',
        sentence: q.prompt,
        meaning: q.sub || '',
        ...common,
      };
    if (q.style === 'reverse' || q.style === 'picture')
      return { t: 'pickWord', meaning: q.prompt, imageUrl, ...common };
    return { t: 'pickMeaning', word: q.word, imageUrl: null, ...common };
  }
  if (q.qtype === 'text' && typeof q.correct === 'string')
    return q.skill === SKILL.dictation
      ? { t: 'dictation', word: q.correct, length: q.correct.length }
      : {
          t: 'typeWord',
          word: q.correct,
          meaning: q.prompt,
          imageUrl,
          length: q.correct.length,
          first: '',
        };
  if (q.qtype === 'order' && Array.isArray(q.correct)) {
    if (q.joiner === '')
      return {
        t: 'spell',
        word: q.correct.join(''),
        meaning: q.prompt,
        imageUrl,
        letters: q.tokens || [],
      };
    return {
      t: 'unscramble',
      sentence: q.correct.join(q.joiner ?? ' '),
      words: q.tokens || [],
    };
  }
  return null;
}
