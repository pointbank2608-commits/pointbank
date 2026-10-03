// 팀·순서 정하기(TeamOrderPanel)에서 정한 팀과 순서를 기억해 두고, 게임 화면의 "순서 보여주기" 줄이 읽는다.
// 반(명단)마다 이 브라우저에 저장한다 — 랜덤 버튼을 다시 누르거나 직접 바꾸기 전까지 그대로 남는다(2026-10-03).
import type { GameItem } from './types';

export interface TeamOrderState {
  mode: 'individual' | 'team';
  teamCount: number;
  /** 학생 id → 팀 번호(0부터) */
  teamOf: Record<string, number>;
  /** 개인이면 학생 id, 팀이면 `team-<번호>` 를 차례대로 */
  order: string[];
  /** 지금 차례(order 의 몇 번째인지) */
  turn: number;
}

export const TEAM_ORDER_EVENT = 'classbank:teamorder';
const SHOW_KEY = 'classbank.showOrder';

/** 명단이 같으면 같은 열쇠 — 반 id 를 따로 받지 않아도 반마다 따로 저장된다. */
function keyFor(roster: GameItem[]): string {
  const ids = roster.map((r) => r.id).sort().join(',');
  let h = 5381;
  for (let i = 0; i < ids.length; i++) h = ((h << 5) + h + ids.charCodeAt(i)) >>> 0;
  return `classbank.teamOrder.${h.toString(36)}`;
}

export function defaultTeamOrder(roster: GameItem[]): TeamOrderState {
  return { mode: 'individual', teamCount: 2, teamOf: {}, order: roster.map((r) => r.id), turn: 0 };
}

/** 저장해 둔 것을 지금 명단에 맞춰 돌려준다(전학·새 학생이 있어도 깨지지 않게). 없으면 명단 순서 그대로. */
export function loadTeamOrder(roster: GameItem[]): TeamOrderState {
  const base = defaultTeamOrder(roster);
  if (roster.length === 0) return base;
  try {
    const raw = localStorage.getItem(keyFor(roster));
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<TeamOrderState>;
    const mode = saved.mode === 'team' ? 'team' : 'individual';
    const teamCount = Math.max(2, Math.min(6, Number(saved.teamCount) || 2));
    const teamOf: Record<string, number> = {};
    roster.forEach((r, i) => {
      const cur = saved.teamOf?.[r.id];
      teamOf[r.id] = typeof cur === 'number' && cur < teamCount ? cur : i % teamCount;
    });
    const valid = mode === 'team' ? Array.from({ length: teamCount }, (_, i) => `team-${i}`) : roster.map((r) => r.id);
    const kept = (saved.order ?? []).filter((id) => valid.includes(id));
    const order = [...kept, ...valid.filter((id) => !kept.includes(id))];
    const turn = Math.max(0, Math.min(order.length - 1, Number(saved.turn) || 0));
    return { mode, teamCount, teamOf: mode === 'team' || saved.teamOf ? teamOf : {}, order, turn };
  } catch {
    return base;
  }
}

export function saveTeamOrder(roster: GameItem[], state: TeamOrderState): void {
  if (roster.length === 0) return;
  try {
    localStorage.setItem(keyFor(roster), JSON.stringify(state));
  } catch {
    // 저장이 막힌 브라우저에서는 이번 화면에서만 유지된다
  }
  window.dispatchEvent(new Event(TEAM_ORDER_EVENT));
}

export function isShowOrderOn(): boolean {
  try {
    return localStorage.getItem(SHOW_KEY) === '1';
  } catch {
    return false;
  }
}

export function setShowOrderOn(on: boolean): void {
  try {
    localStorage.setItem(SHOW_KEY, on ? '1' : '0');
  } catch {
    // 무시
  }
}
