/**
 * 텔레파시 게임(Telepathy, 2026-10-20) — PPT "Pokemon Telepathy Game"(공 속에서 어떤 포켓몬이 나올지 미리 적어 맞히기) 방식만 참고한 학급 게임.
 * 후보 낱말·문장 3개가 동물 친구와 함께 나온다 → 팀마다 "알에서 어떤 친구가 나올지" 종이에 적는다(철자 연습) →
 * 알이 흔들리고 열리면 하나가 나온다 → 정답을 적은 팀이 1점. 그림·소리는 우리 것이고, 나오는 친구는 매번 무작위라 외울 수 없다.
 * 순수 로직만 이 파일에 둔다(화면은 components/Telepathy.tsx).
 */
import { SHUFFLE_ANIMALS, drawLabels, shuffled, type Rng } from './shuffleFind';

export { parseShuffleLabel as parseTelepathyLabel, rankTeams } from './shuffleFind';

export const TELEPATHY_DEFAULTS = { teams: 3, choices: 3, rounds: 8, seconds: 20 };
/** 적는 시간(초): 0은 시간 제한 없음(선생님이 직접 "공개"를 누른다) */
export const TELEPATHY_SECONDS = [0, 10, 15, 20, 30, 45, 60] as const;

export interface TelepathyConfig {
  teams: number;
  choices: number;
  rounds: number;
  seconds: number;
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(hi, Math.max(lo, n));
}

/** 저장된 설정(없거나 이상한 값 포함)을 안전한 범위로 맞춘다 */
export function normalizeTelepathyConfig(c: { telepathyTeams?: number; telepathyChoices?: number; telepathyRounds?: number; telepathySeconds?: number } | undefined): TelepathyConfig {
  const s = typeof c?.telepathySeconds === 'number' ? c.telepathySeconds : TELEPATHY_DEFAULTS.seconds;
  return {
    teams: clampInt(c?.telepathyTeams, 2, 6, TELEPATHY_DEFAULTS.teams),
    choices: clampInt(c?.telepathyChoices, 3, 4, TELEPATHY_DEFAULTS.choices),
    rounds: clampInt(c?.telepathyRounds, 1, 30, TELEPATHY_DEFAULTS.rounds),
    seconds: (TELEPATHY_SECONDS as readonly number[]).includes(s) ? s : TELEPATHY_DEFAULTS.seconds,
  };
}

/** 항목이 후보 수보다 적으면 후보 수를 줄인다(최소 2) */
export function usableChoices(itemCount: number, choices: number): number {
  return Math.max(2, Math.min(choices, itemCount));
}

export interface TelepathyRound {
  /** 후보로 보여 줄 항목 번호(자리 순서) */
  labels: number[];
  /** 자리마다 붙는 동물 친구(서로 다름) */
  animals: Array<(typeof SHUFFLE_ANIMALS)[number]>;
  /** 알에서 나올 자리(정답) */
  answer: number;
}

/** 한 판을 만든다: 덱에서 후보를 뽑고, 동물을 서로 다르게 붙이고, 나올 자리를 무작위로 정한다 */
export function buildTelepathyRound(deck: number[], itemCount: number, choices: number, rng: Rng = Math.random): { round: TelepathyRound; deck: number[] } {
  const drawn = drawLabels(deck, itemCount, choices, rng);
  const animals = shuffled(SHUFFLE_ANIMALS, rng).slice(0, drawn.labels.length);
  const answer = Math.floor(rng() * drawn.labels.length);
  return { round: { labels: drawn.labels, animals, answer }, deck: drawn.deck };
}

/** 이번 판에 맞힌 팀(true)을 점수에 더한다 */
export function addRoundScores(scores: readonly number[], won: readonly boolean[]): number[] {
  return scores.map((s, i) => s + (won[i] ? 1 : 0));
}
