/**
 * 단어 농구 대결(Word Hoops, 2026-11-07) — 인스타그램 수업 영상 "Math Hoops"(두 팀이 같은 10문제를 동시에 풀며 공을 골라 슛하는 방식)의
 * 규칙 구조만 참고한 영어 단어 게임. 그림·문구·소리는 우리 것이다.
 *
 * - 두 팀(또는 혼자 연습)이 같은 문제 세트를 각자 속도로 푼다. 문제는 단어장 짝(`config.pairs`: 영어 left · 뜻 right)에서 만든다.
 * - 첫 시도에 맞히면 2점, 한 번 틀리고 다시 맞히면 1점, 두 번 틀리면 정답을 보여 주고 0점으로 넘어간다.
 * - 승부 방식(규칙)은 둘 중 고른다. race: 정해진 슛을 먼저·정확히 끝내기(첫 시도 정확도 → 점수 → 걸린 시간 순),
 *   timed: 제한 시간 안에 더 많이 넣기(점수 → 첫 시도 정답 수 순).
 * 순수 로직만 이 파일에 둔다(화면은 components/WordHoops.tsx).
 */
import type { MatchPair } from './types';
import type { PictureWordQuestion } from './pictureWordQuestions';

export type HoopsMode = 'meaning' | 'word' | 'mixed' | 'picture';
export type HoopsRule = 'race' | 'timed';

export const HOOPS_DEFAULTS = { teams: 2, shots: 10, mode: 'meaning' as HoopsMode, rule: 'race' as HoopsRule, seconds: 60 };
export const HOOPS_RULES: readonly HoopsRule[] = ['race', 'timed'];
export const HOOPS_SECONDS = [30, 45, 60, 90, 120, 180] as const;
/** 제한 시간제에서 미리 만들어 두는 문제 수(시간 안에 다 풀 수 없는 양) */
export const HOOPS_TIMED_POOL = 300;
export const HOOPS_MODES: readonly HoopsMode[] = ['meaning', 'word', 'mixed', 'picture'];

export interface HoopsConfig {
  teams: number;
  shots: number;
  mode: HoopsMode;
  rule: HoopsRule;
  seconds: number;
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(hi, Math.max(lo, n));
}

/** 저장된 설정(없거나 이상한 값 포함)을 안전한 범위로 맞춘다 */
export function normalizeHoopsConfig(
  c: { hoopsTeams?: number; hoopsShots?: number; hoopsMode?: string; hoopsRule?: string; hoopsSeconds?: number } | undefined,
): HoopsConfig {
  const mode = (HOOPS_MODES as readonly string[]).includes(c?.hoopsMode ?? '') ? (c?.hoopsMode as HoopsMode) : HOOPS_DEFAULTS.mode;
  return {
    teams: clampInt(c?.hoopsTeams, 1, 2, HOOPS_DEFAULTS.teams),
    shots: clampInt(c?.hoopsShots, 3, 30, HOOPS_DEFAULTS.shots),
    mode,
    rule: (HOOPS_RULES as readonly string[]).includes(c?.hoopsRule ?? '') ? (c?.hoopsRule as HoopsRule) : HOOPS_DEFAULTS.rule,
    seconds: (HOOPS_SECONDS as readonly number[]).includes(c?.hoopsSeconds ?? -1) ? (c?.hoopsSeconds as number) : HOOPS_DEFAULTS.seconds,
  };
}

export interface HoopsQuestion {
  id: string;
  /** 문제 카드에 크게 보이는 글(영어 낱말이거나 우리말 뜻) */
  prompt: string;
  /** 읽어 줄 영어(영어 낱말이 문제이거나 정답일 때) */
  speak: string;
  /** 'toMeaning' = 영어를 보고 뜻 고르기, 'toWord' = 뜻을 보고 영어 고르기 */
  dir: 'toMeaning' | 'toWord' | 'fromPicture';
  imageUrl?: string;
  choices: string[];
  correctIndex: number;
  /** 정답 뒤에 보여 주는 한 줄("apple = 사과") */
  explain: string;
}

export type Rng = () => number;

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = (s: string) => s.trim().toLowerCase();

/** 빈 칸이 있는 짝을 걸러낸다 */
export function usablePairs(pairs: readonly MatchPair[] | undefined): MatchPair[] {
  return (pairs ?? []).filter((p) => p.left.trim() && p.right.trim());
}

/** 문제를 만들 수 있는 최소 짝 수(보기 2개 + 정답) */
export const HOOPS_MIN_PAIRS = 3;

/**
 * 문제 세트를 만든다. 짝이 모자라면 같은 낱말이 다시 나오되 바로 이어서 나오지는 않는다.
 * 두 팀이 같은 세트를 푸므로 보기 순서도 한 번만 섞는다.
 */
export function buildHoopsQuestions(
  pairs: readonly MatchPair[] | undefined,
  shots: number,
  mode: HoopsMode,
  rng: Rng = Math.random,
): HoopsQuestion[] {
  const pool = usablePairs(pairs);
  if (pool.length < 2) return [];
  const out: HoopsQuestion[] = [];
  let deck: MatchPair[] = [];
  let last: string | null = null;
  for (let n = 0; n < shots; n += 1) {
    if (deck.length === 0) deck = shuffle(pool, rng);
    let pick = deck.shift() as MatchPair;
    if (pick.id === last && deck.length > 0) {
      const alt = deck.shift() as MatchPair;
      deck.push(pick);
      pick = alt;
    }
    last = pick.id;
    const dir: HoopsQuestion['dir'] = mode === 'meaning' ? 'toMeaning' : mode === 'word' ? 'toWord' : rng() < 0.5 ? 'toMeaning' : 'toWord';
    const answer = (dir === 'toMeaning' ? pick.right : pick.left).trim();
    const seen = new Set([norm(answer)]);
    const wrong: string[] = [];
    for (const other of shuffle(pool, rng)) {
      if (other.id === pick.id) continue;
      const text = (dir === 'toMeaning' ? other.right : other.left).trim();
      if (seen.has(norm(text))) continue;
      seen.add(norm(text));
      wrong.push(text);
      if (wrong.length >= 2) break;
    }
    const choices = shuffle([answer, ...wrong], rng);
    out.push({
      id: `${n}-${pick.id}`,
      prompt: (dir === 'toMeaning' ? pick.left : pick.right).trim(),
      speak: pick.left.trim(),
      dir,
      choices,
      correctIndex: choices.indexOf(answer),
      explain: `${pick.left.trim()} = ${pick.right.trim()}`,
    });
  }
  return out;
}

export function buildHoopsPictureQuestions(questions: readonly PictureWordQuestion[], shots: number): HoopsQuestion[] {
  const deck = shuffle(questions);
  if (!deck.length) return [];
  return Array.from({ length: shots }, (_, index) => {
    const row = deck[index % deck.length];
    const answer = row.choices[row.correctIndex];
    const choices = shuffle(row.choices);
    return { id: `${index}-${row.id}`, prompt: '', speak: answer, dir: 'fromPicture', imageUrl: row.imageUrl,
      choices, correctIndex: choices.indexOf(answer), explain: answer };
  });
}

/** n번째 시도(1부터)에서 맞혔을 때 점수: 첫 시도 2점, 두 번째 1점 */
export function pointsForTry(tryNumber: number): number {
  return tryNumber <= 1 ? 2 : tryNumber === 2 ? 1 : 0;
}

/** 한 문제에서 틀릴 수 있는 횟수(이만큼 틀리면 정답을 알려 주고 넘어간다) */
export const HOOPS_MAX_MISSES = 2;

export interface HoopsResult {
  team: number;
  points: number;
  /** 첫 시도에 맞힌 문제 수 */
  firstTry: number;
  /** 넣은 슛(맞힌 문제) 수 */
  made: number;
  shots: number;
  ms: number;
}

/**
 * 승부 순서(앞이 1등).
 * race: 첫 시도 정답 수 → 점수 → 걸린 시간 / timed: 점수 → 첫 시도 정답 수(시간은 모두 같으므로 보지 않는다)
 */
export function rankHoops(results: readonly HoopsResult[], rule: HoopsRule = 'race'): HoopsResult[] {
  return [...results].sort((a, b) =>
    rule === 'timed' ? b.points - a.points || b.firstTry - a.firstTry : b.firstTry - a.firstTry || b.points - a.points || a.ms - b.ms,
  );
}

/** 1등이 둘 이상 같은 기록이면 무승부 */
export function isHoopsTie(results: readonly HoopsResult[], rule: HoopsRule = 'race'): boolean {
  if (results.length < 2) return false;
  const [a, b] = rankHoops(results, rule);
  return a.firstTry === b.firstTry && a.points === b.points && (rule === 'timed' || a.ms === b.ms);
}

/** 제한 시간 표기 m:ss (올림, 0초 아래로 내려가지 않음) */
export function formatHoopsCountdown(remainingMs: number): string {
  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** 걸린 시간을 m:ss.s 로 */
export function formatHoopsTime(ms: number): string {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = (total % 60000) / 1000;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
