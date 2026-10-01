import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * 게임 효과음·배경음악(2026-09-28, 선생님이 게임·순간마다 직접 고른 소리).
 * 파일은 public/sounds/sfx/<번호>.mp3 — 번호는 sound-source 의 소리 번호표와 같다
 * (1xxx 카드·칩·주사위, 2xxx 전자음, 3xxx 부딪힘, 4xxx 딩·클릭, 5xxx 짧은 멜로디, 6xxx 클릭,
 * 7xxx 성우, 8xxx 구글 AI 배경음악·목소리). 원본 다듬기는 sound-source/build_app_sfx.py.
 * 소리를 바꾸려면 아래 GAME_SFX 의 번호만 바꾸고, 새 번호면 파일도 같이 만든다.
 */
export const GAME_SFX = {
  baskin31: { count: 3121, penalty: 5020, roundEnd: 5037 },
  connect4: { drop: 1024, win: 7046, tie: 7017 },
  popcorn: { pop: 2015, result: 4015 },
  twodice: { shake: 1045, roll: 1048, claim: 1024, bingo: 5037 },
  quiz: { question: 4066, correct: 4015, wrong: 4025, finish: 5037 },
  hangman: { key: 6001, hit: 4031, miss: 4023, win: 5037, lose: 5042 },
  truefalse: { correct: 4015, wrong: 4025, finish: 5037 },
  matchup: { pick: 6001, match: 4015, miss: 4025, finish: 5037 },
  whackamole: { popUp: 2020, hit: 3096, miss: 4023, timeUp: 8105, finish: 5037 },
  flashcards: { flip: 4041, next: 1013, shuffle: 1011 },
  anagram: { tile: 4006, correct: 4015, wrong: 4025, finish: 5037 },
  groupsort: { pick: 1012, drop: 4020, correct: 4015, wrong: 4025, finish: 5037 },
  unscramble: { move: 1012, correct: 4015, wrong: 4025, finish: 5037 },
  typeanswer: { key: 6001, correct: 4015, wrong: 4025, finish: 5037 },
  spellword: { key: 6001, correct: 4015, wrong: 4025, finish: 5037 },
  rankorder: { move: 1015, correct: 4015, wrong: 4025, finish: 5037 },
  wordsearch: { pick: 6001, found: 4015, wrong: 4025, finish: 5037 },
  crossword: { key: 6001, word: 4015, wrong: 4025, finish: 5037 },
  mathgen: { question: 4065, correct: 4015, wrong: 4025, finish: 5037 },
  mazechase: { move: 4074, wall: 3111, goal: 4015, wrong: 4023, finish: 5037 },
  airplane: { fly: 2004, hit: 2035, wrongHit: 2059, crash: 3091, finish: 5037 },
  labeleddiagram: { pick: 6001, correct: 4015, wrong: 4025, finish: 5037 },
  imagequiz: { reveal: 4041, correct: 4015, wrong: 4025, finish: 5037 },
  gameshowquiz: { bgm: 8001, question: 5030, correct: 4015, wrong: 4025, bonus: 2037, fifty: 2028, win: 8007 },
  winlosequiz: { bgm: 8002, bet: 1037, correct: 2035, wrong: 2012, finish: 5054 },
  quizshow: {
    lobby: 8004,
    join: 2015,
    bgm: 8002,
    timeUp: 8105,
    buzz: 2054,
    reveal: 4015,
    round: 7026,
    finalRound: 7013,
    champion: 7011,
  },
} as const;

/** 여러 게임이 같이 쓰는 목소리 */
export const COMMON_SFX = { start: 8108, praise: 8102, tryAgain: 8104, yourTurn: 8118 } as const;

export type GameSfxKey = keyof typeof GAME_SFX;

const url = (n: number) => `/sounds/sfx/${n}.mp3?v=1`;

/* ---------------- 소리 켜기·끄기(모든 게임 공통, 브라우저에 기억) ---------------- */

const STORE_KEY = 'classbank.gameSound';
let soundOn = (() => {
  try {
    return localStorage.getItem(STORE_KEY) !== 'off';
  } catch {
    return true;
  }
})();
const listeners = new Set<() => void>();

export function isGameSoundOn(): boolean {
  return soundOn;
}

export function setGameSoundOn(on: boolean): void {
  soundOn = on;
  try {
    localStorage.setItem(STORE_KEY, on ? 'on' : 'off');
  } catch {
    /* 저장이 막혀도 이번 화면에서는 적용 */
  }
  activeBgm.forEach((a) => (on ? void a.play().catch(() => {}) : a.pause()));
  listeners.forEach((l) => l());
}

export function useGameSoundOn(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => soundOn,
  );
}

/* ---------------- 재생 ---------------- */

// 같은 소리가 빠르게 겹쳐 나도(글자 입력·칩 여러 개) 끊기지 않게 소리마다 몇 개씩 돌려 쓴다.
const pools = new Map<number, HTMLAudioElement[]>();

function instance(n: number): HTMLAudioElement {
  const pool = pools.get(n) ?? [];
  pools.set(n, pool);
  const free = pool.find((a) => a.paused || a.ended);
  if (free) return free;
  const a = new Audio(url(n));
  a.preload = 'auto';
  if (pool.length < 4) pool.push(a);
  return a;
}

/** 효과음 한 번. 소리를 꺼 두었으면 아무 일도 안 한다. */
export function playSfx(n: number | undefined, volume = 0.8): void {
  if (!n || !soundOn) return;
  const a = instance(n);
  a.currentTime = 0;
  a.volume = volume;
  void a.play().catch(() => {});
}

const activeBgm = new Set<HTMLAudioElement>();

/** 배경음악 반복 재생. 돌려받은 함수를 부르면 멈춘다. 소리를 끄면 멈췄다가 켜면 이어서 나온다. */
export function startBgm(n: number, volume = 0.3): () => void {
  const a = new Audio(url(n));
  a.loop = true;
  a.volume = volume;
  activeBgm.add(a);
  if (soundOn) void a.play().catch(() => {});
  return () => {
    a.pause();
    activeBgm.delete(a);
  };
}

/** 게임 화면이 뜰 때 그 게임 소리를 미리 받아 둔다(첫 소리가 늦게 나지 않게). 배경음악은 받지 않는다. */
export function useGameSfx<K extends GameSfxKey>(game: K): (typeof GAME_SFX)[K] {
  useEffect(() => {
    Object.values(GAME_SFX[game]).forEach((n) => {
      if (n < 8001 || n > 8008) instance(n);
    });
  }, [game]);
  return GAME_SFX[game];
}

/** 배경음악을 켜 둘 조건(예: 문제를 푸는 중)이 참인 동안만 반복 재생 */
export function useBgm(n: number | undefined, playing: boolean, volume = 0.3): void {
  useEffect(() => {
    if (!n || !playing) return;
    return startBgm(n, volume);
  }, [n, playing, volume]);
}

/**
 * 문제형 게임 공통: step(몇 번째 문제)이 바뀔 때 question 소리, finished 가 거짓→참이 되는 순간 finish 소리.
 * 처음 화면이 뜰 때(첫 문제)도 question 소리가 난다. 조기 return 앞(훅 규칙)에서 부를 것.
 */
export function useStepSounds(step: number, finished: boolean, question?: number, finish?: number, praise = true): void {
  const wasFinished = useRef(finished);
  useEffect(() => {
    if (!finished) playSfx(question);
  }, [step, finished, question]);
  useEffect(() => {
    if (finished && !wasFinished.current && finish) {
      playSfx(finish);
      // 끝 멜로디 뒤에 "Great job!" (공통 칭찬 목소리)
      if (praise) {
        const id = window.setTimeout(() => playSfx(COMMON_SFX.praise), 1100);
        wasFinished.current = finished;
        return () => window.clearTimeout(id);
      }
    }
    wasFinished.current = finished;
  }, [finished, finish, praise]);
}
