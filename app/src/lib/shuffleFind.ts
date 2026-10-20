/**
 * 컵 속 친구 찾기(Shuffle Find, 2026-10-20) — PPT "Pokemon Shuffle"(포켓볼 세 개 중 어디에 숨었나) 방식만 참고한 학급 게임.
 * 동물 친구가 컵 아래에 숨고 → 컵들이 섞이고 → 팀이 컵 아래(고정된 자리)의 낱말·문장을 소리 내어 읽으며 컵을 고르고 → 열어서 확인한다.
 * 캐릭터·컵·그림·소리는 우리 것이다(원본의 포켓몬 그림·음악은 쓰지 않는다).
 * 순수 로직만 이 파일에 둔다(화면은 components/ShuffleFind.tsx) — 한 판의 구성·섞는 순서·정답 자리를 정한다.
 */

export type ShuffleSpeed = 'slow' | 'normal' | 'fast';

export const SHUFFLE_DEFAULTS = { teams: 2, cups: 3, speed: 'normal' as ShuffleSpeed, rounds: 6 };

/** 섞는 횟수와 한 번 바꾸는 데 걸리는 시간(ms) */
export const SHUFFLE_SPEED: Record<ShuffleSpeed, { swaps: number; ms: number }> = {
  slow: { swaps: 4, ms: 950 },
  normal: { swaps: 6, ms: 680 },
  fast: { swaps: 9, ms: 450 },
};

export const SHUFFLE_ANIMALS = ['chick', 'fox', 'frog', 'penguin', 'bear', 'bunny'] as const;
export const SHUFFLE_CUPS = ['blue', 'yellow', 'green', 'orange', 'purple'] as const;

export interface ShuffleConfig {
  teams: number;
  cups: number;
  speed: ShuffleSpeed;
  rounds: number;
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(hi, Math.max(lo, n));
}

/** 저장된 설정(없거나 이상한 값 포함)을 안전한 범위로 맞춘다 */
export function normalizeShuffleConfig(c: { shuffleTeams?: number; shuffleCups?: number; shuffleSpeed?: string; shuffleRounds?: number } | undefined): ShuffleConfig {
  return {
    teams: clampInt(c?.shuffleTeams, 1, 4, SHUFFLE_DEFAULTS.teams),
    cups: clampInt(c?.shuffleCups, 3, 5, SHUFFLE_DEFAULTS.cups),
    speed: c?.shuffleSpeed === 'slow' || c?.shuffleSpeed === 'fast' ? c.shuffleSpeed : 'normal',
    rounds: clampInt(c?.shuffleRounds, 1, 30, SHUFFLE_DEFAULTS.rounds),
  };
}

/** 항목이 컵 수보다 적으면 컵 수를 줄인다(최소 2). 같은 낱말이 한 판에 두 번 나오지 않게 하려는 것이다. */
export function usableCups(itemCount: number, cups: number): number {
  return Math.max(2, Math.min(cups, itemCount));
}

/** "영어 | 해석" 한 줄을 나눈다 */
export function parseShuffleLabel(raw: string): { text: string; ko: string } {
  const cut = raw.indexOf(' | ');
  return cut >= 0 ? { text: raw.slice(0, cut).trim(), ko: raw.slice(cut + 3).trim() } : { text: raw.trim(), ko: '' };
}

/** 자리 가운데 위치(무대 가로 %) */
export function slotCenters(n: number): number[] {
  const margin = n <= 3 ? 20 : n === 4 ? 15 : 12;
  if (n === 1) return [50];
  const step = (100 - margin * 2) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round((margin + step * i) * 10) / 10);
}

/** 컵 하나의 폭(무대 가로 %) */
export function cupWidth(n: number): number {
  return n <= 3 ? 17 : n === 4 ? 15 : 13;
}

export type Rng = () => number;

export function shuffled<T>(a: readonly T[], rng: Rng = Math.random): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** 이번 판에 쓸 항목 번호 `cups`개를 덱에서 뽑는다(덱이 모자라면 새로 섞되 같은 판에 같은 항목이 겹치지 않게 한다). */
export function drawLabels(deck: number[], itemCount: number, cups: number, rng: Rng = Math.random): { labels: number[]; deck: number[] } {
  let rest = [...deck];
  const labels: number[] = [];
  let guard = 0;
  while (labels.length < cups && guard++ < 10) {
    if (rest.length === 0) rest = shuffled(Array.from({ length: itemCount }, (_, i) => i), rng);
    const i = rest.findIndex((x) => !labels.includes(x));
    if (i < 0) {
      rest = shuffled(Array.from({ length: itemCount }, (_, k) => k).filter((x) => !labels.includes(x)), rng);
      if (rest.length === 0) break;
      continue;
    }
    labels.push(rest[i]);
    rest.splice(i, 1);
  }
  return { labels, deck: rest };
}

/** 섞는 순서: 서로 다른 두 자리를 맞바꾸는 것을 count 번(바로 앞과 같은 쌍은 절대 고르지 않는다) */
export function makeSwaps(cups: number, count: number, rng: Rng = Math.random): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let a = 0; a < cups; a++) for (let b = a + 1; b < cups; b++) pairs.push([a, b]);
  const out: Array<[number, number]> = [];
  for (let k = 0; k < count; k++) {
    const prev = out[k - 1];
    const choices = prev ? pairs.filter(([a, b]) => a !== prev[0] || b !== prev[1]) : pairs;
    out.push(choices[Math.floor(rng() * choices.length)]);
  }
  return out;
}

/** 자리마다 어느 컵이 있는지(cupAtSlot[자리] = 컵 번호)에 섞는 순서를 적용한 결과 */
export function applySwaps(cupAtSlot: readonly number[], swaps: ReadonlyArray<readonly [number, number]>): number[] {
  const arr = [...cupAtSlot];
  for (const [a, b] of swaps) [arr[a], arr[b]] = [arr[b], arr[a]];
  return arr;
}

export interface ShuffleRound {
  labels: number[];
  hideCup: number;
  animal: (typeof SHUFFLE_ANIMALS)[number];
  swaps: Array<[number, number]>;
  /** 섞기가 끝난 뒤 자리마다 있는 컵 */
  finalCupAtSlot: number[];
  /** 동물이 있는 자리(= 정답) */
  answerSlot: number;
}

export function buildRound(labels: number[], speed: ShuffleSpeed, prevAnimal?: string, rng: Rng = Math.random): ShuffleRound {
  const cups = labels.length;
  const hideCup = Math.floor(rng() * cups);
  const animals = SHUFFLE_ANIMALS.filter((a) => a !== prevAnimal);
  const animal = animals[Math.floor(rng() * animals.length)];
  const swaps = makeSwaps(cups, SHUFFLE_SPEED[speed].swaps, rng);
  const finalCupAtSlot = applySwaps(Array.from({ length: cups }, (_, i) => i), swaps);
  return { labels, hideCup, animal, swaps, finalCupAtSlot, answerSlot: finalCupAtSlot.indexOf(hideCup) };
}

export interface ShuffleScore {
  scores: number[];
  turn: number;
}

/** 한 판 결과를 점수에 반영하고 다음 팀으로 넘긴다(팀이 1이면 차례 없이 맞힌 횟수만 센다) */
export function scoreRound(state: ShuffleScore, found: boolean): ShuffleScore {
  const scores = [...state.scores];
  if (found) scores[state.turn] = (scores[state.turn] ?? 0) + 1;
  return { scores, turn: scores.length > 1 ? (state.turn + 1) % scores.length : 0 };
}

/** 순위(점수 높은 순, 같으면 같은 등수) */
export function rankTeams(scores: readonly number[]): Array<{ team: number; score: number; rank: number }> {
  const rows = scores.map((score, team) => ({ team, score })).sort((a, b) => b.score - a.score || a.team - b.team);
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.score !== rows[i - 1].score) rank = i + 1;
    return { ...r, rank };
  });
}
