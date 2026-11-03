import { useSyncExternalStore } from 'react';

/**
 * 문법별 게임의 "팀·점수" 설정(2026-11-04): 수업(여러 팀)에서도, 과외처럼 혼자 풀 때도 같은 게임을 쓰도록
 * 팀 수(0 = 혼자 풀기, 1~4)와 점수 표시를 설정으로 둔다. 이 브라우저에 기억하고 15개 게임이 같이 쓴다.
 * 점수는 화면 안의 놀이 점수일 뿐 칭찬 통장 포인트와 연결되지 않는다.
 */
export interface GrammarPlay {
  /** 0 = 팀 없이 혼자 풀기 */
  teams: number;
  showScore: boolean;
}

const KEY = 'classbank.grammarPlay';
const DEFAULT: GrammarPlay = { teams: 2, showScore: true };

function read(): GrammarPlay {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<GrammarPlay>;
    const teams = Number.isInteger(v.teams) && (v.teams as number) >= 0 && (v.teams as number) <= 4 ? (v.teams as number) : DEFAULT.teams;
    return { teams, showScore: v.showScore !== false };
  } catch {
    return DEFAULT;
  }
}

let current: GrammarPlay | null = null;
const listeners = new Set<() => void>();

export function getGrammarPlay(): GrammarPlay {
  if (!current) current = read();
  return current;
}

export function setGrammarPlay(patch: Partial<GrammarPlay>): void {
  const next = { ...getGrammarPlay(), ...patch };
  if (next.teams === current?.teams && next.showScore === current?.showScore) return;
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장소를 못 써도 이 화면에서는 설정이 적용된다
  }
  listeners.forEach((l) => l());
}

export function useGrammarPlay(): GrammarPlay {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    getGrammarPlay,
    () => DEFAULT,
  );
}

/** 게임 안에서 쓰는 팀 수(혼자 풀기도 한 사람 몫으로 센다) */
export const initialTeams = (): number => Math.max(1, getGrammarPlay().teams);
