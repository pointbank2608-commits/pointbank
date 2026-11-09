/**
 * 줄다리기 대결(Tug of War, 2026-11-08) — 인스타그램 수업 영상 "Tug of War Interactive game"(두 팀이 각자 문제를 풀어
 * 맞히면 줄을 우리 쪽으로 당기고, 틀리면 3초 동안 줄을 못 당기는 방식)의 규칙 구조만 참고한 게임. 그림·문구·소리는 우리 것이다.
 *
 * - 두 팀이 같은 문제 묶음을 **각자 따로**(서로 다른 순서·보기 배치) 푼다. 문제는 퀴즈 문제(`config.questions`)를 그대로 쓴다.
 * - 맞히면 줄이 우리 쪽으로 한 칸 당겨지고, 틀리면 그 팀만 얼음(기본 3초) 동안 답할 수 없다. 틀린 보기는 그 문제에서 지워진다.
 * - 줄이 끝 선까지 당겨지면 이긴다. 제한 시간이 있으면 시간이 끝났을 때 더 당겨 놓은 팀이 이기고, 같으면 연장전(다음 한 칸을 먼저 당긴 팀).
 * 순수 로직만 이 파일에 둔다(화면은 components/TugOfWar.tsx).
 */
import type { QuizQuestion } from './types';
import type { PictureWordQuestion } from './pictureWordQuestions';

export type TugQuestion = QuizQuestion & Partial<Pick<PictureWordQuestion, 'imageUrl'>>;

export const TUG_DEFAULTS = { pull: 5, freeze: 3, seconds: 180 };
export const TUG_PULLS = [3, 4, 5, 6, 8, 10] as const;
export const TUG_FREEZES = [2, 3, 5] as const;
export const TUG_SECONDS = [0, 60, 120, 180, 300] as const;
/** 한 문제에서 한 번에 보여 주는 보기 수(정답 + 오답 최대 3개) */
export const TUG_MAX_CHOICES = 4;
/** 팀마다 미리 만들어 두는 문제 수(시간 안에 다 풀 수 없는 양, 문제가 모자라면 되풀이한다) */
export const TUG_DECK = 200;

export interface TugConfig {
  /** 이기려면 상대보다 몇 칸 더 당겨야 하는지(= 줄이 끝 선까지 가는 칸 수) */
  pull: number;
  /** 틀렸을 때 얼음 시간(초) */
  freeze: number;
  /** 제한 시간(초), 0이면 제한 없음 */
  seconds: number;
}

function pick(v: unknown, allowed: readonly number[], fallback: number): number {
  return typeof v === 'number' && allowed.includes(v) ? v : fallback;
}

/** 저장된 설정(없거나 이상한 값 포함)을 허용된 값으로 맞춘다 */
export function normalizeTugConfig(c: { tugPull?: number; tugFreeze?: number; tugSeconds?: number } | undefined): TugConfig {
  return {
    pull: pick(c?.tugPull, TUG_PULLS, TUG_DEFAULTS.pull),
    freeze: pick(c?.tugFreeze, TUG_FREEZES, TUG_DEFAULTS.freeze),
    seconds: pick(c?.tugSeconds, TUG_SECONDS, TUG_DEFAULTS.seconds),
  };
}

export type Rng = () => number;

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 문제 하나가 풀 수 있는 모양인지(질문·정답이 있고 보기가 2개 이상, 정답이 보기 안에 있음) */
export function isTugQuestion(q: QuizQuestion): boolean {
  const filled = q.choices.filter((c) => c.trim());
  return !!q.question.trim() && filled.length >= 2 && !!q.choices[q.correctIndex]?.trim();
}

export function playableTugQuestions(questions: readonly TugQuestion[] | undefined): TugQuestion[] {
  return (questions ?? []).filter(isTugQuestion);
}

export interface TugShown {
  id: string;
  question: string;
  imageUrl?: string;
  choices: string[];
  correctIndex: number;
}

/** 보기를 최대 4개로 줄이고(정답은 항상 포함) 순서를 섞는다. 같은 글자 보기는 하나만 둔다. */
export function presentTugQuestion(q: TugQuestion, rng: Rng = Math.random): TugShown {
  const answer = q.choices[q.correctIndex].trim();
  const seen = new Set([answer.toLowerCase()]);
  const wrong: string[] = [];
  for (const c of shuffle(q.choices.map((x, i) => (i === q.correctIndex ? '' : x.trim())), rng)) {
    if (!c || seen.has(c.toLowerCase())) continue;
    seen.add(c.toLowerCase());
    wrong.push(c);
    if (wrong.length >= TUG_MAX_CHOICES - 1) break;
  }
  const choices = shuffle([answer, ...wrong], rng);
  return { id: q.id, question: q.question.trim(), ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}), choices, correctIndex: choices.indexOf(answer) };
}

/**
 * 한 팀이 풀 문제 순서를 미리 만든다. 문제를 한 바퀴 다 풀기 전에는 같은 문제가 나오지 않고,
 * 한 바퀴가 끝나 다시 섞을 때 바로 앞 문제가 이어서 나오지 않는다. 팀마다 따로 부르면 순서·보기 배치가 서로 달라진다.
 */
export function buildTugDeck(questions: readonly TugQuestion[] | undefined, count = TUG_DECK, rng: Rng = Math.random): TugShown[] {
  const pool = playableTugQuestions(questions);
  if (pool.length === 0) return [];
  const out: TugShown[] = [];
  let bag: TugQuestion[] = [];
  let last: string | null = null;
  while (out.length < count) {
    if (bag.length === 0) bag = shuffle(pool, rng);
    let next = bag.shift() as TugQuestion;
    if (next.id === last && bag.length > 0) {
      const alt = bag.shift() as TugQuestion;
      bag.push(next);
      next = alt;
    }
    last = next.id;
    out.push(presentTugQuestion(next, rng));
  }
  return out;
}

/**
 * 줄의 위치. pos 는 "팀 0(왼쪽)이 더 당겨 놓은 칸 수"이고 음수면 팀 1(오른쪽)이 앞선다.
 * 끝 선에 닿으면 그 팀이 이긴다. 시간이 끝났다면 앞선 쪽이 이기고, 같으면 null(연장전).
 */
export function tugWinner(pos: number, pull: number, timeUp: boolean): 0 | 1 | null {
  if (pos >= pull) return 0;
  if (pos <= -pull) return 1;
  if (timeUp) return pos > 0 ? 0 : pos < 0 ? 1 : null;
  return null;
}

/** 연장전에서는 한 칸만 앞서도 이긴다 */
export function tugSuddenWinner(pos: number): 0 | 1 | null {
  return pos > 0 ? 0 : pos < 0 ? 1 : null;
}

/** 줄 가운데 매듭이 있는 가로 위치(%): 0 = 팀 0 쪽 끝 선, 100 = 팀 1 쪽 끝 선 */
export function tugKnotPercent(pos: number, pull: number, fieldWidth = 76): number {
  const clamped = Math.max(-pull, Math.min(pull, pos));
  const half = fieldWidth / 2;
  return 50 - (clamped / pull) * half;
}

export interface TugStats {
  correct: number;
  wrong: number;
}

/** 첫 시도 정확도(%) — 맞힌 수 / (맞힌 수 + 틀린 수) */
export function tugAccuracy(s: TugStats): number {
  const total = s.correct + s.wrong;
  return total === 0 ? 0 : Math.round((s.correct / total) * 100);
}

/** 남은 시간 m:ss (올림) */
export function formatTugClock(remainingMs: number): string {
  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
