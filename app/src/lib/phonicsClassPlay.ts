import { useEffect, useState } from 'react';
import { fetchStudentsOfClass } from './api';
import { defaultTeamOrder, type TeamOrderState } from './teamOrder';
import type { GameItem, PhonicsClassPlay } from './types';
const EMPTY_ROSTER: GameItem[] = [];

export function phonicsClassPlay(value: PhonicsClassPlay | undefined, teams: number): PhonicsClassPlay {
  return value ?? { classId: null, mode: teams > 1 ? 'team' : 'none', teamCount: Math.max(2, teams), autoTurn: true, absentIds: [] };
}

/** Match saved order to the current roster without silently inventing student identities. */
export function phonicsClassOrder(roster: GameItem[], play: PhonicsClassPlay): TeamOrderState {
  const saved = play.order ?? defaultTeamOrder(roster);
  const teamCount = Math.max(2, Math.min(4, play.teamCount));
  const mode = play.mode === 'team' ? 'team' : 'individual';
  const valid = mode === 'team' ? Array.from({ length: teamCount }, (_, i) => `team-${i}`) : roster.map(row => row.id);
  const kept = saved.mode === mode ? [...new Set(saved.order.filter(id => valid.includes(id)))] : [];
  const order = [...kept, ...valid.filter(id => !kept.includes(id))];
  const teamOf = Object.fromEntries(roster.map((row, i) => [row.id, Math.max(0, saved.teamOf[row.id] ?? i) % teamCount]));
  return { ...saved, mode, teamCount, teamOf, order, turn: Math.max(0, order.indexOf(saved.order[saved.turn])) };
}

export function usePhonicsClassRoster(classId: string | null) {
  const [state, setState] = useState<{ classId: string | null; students: GameItem[]; loading: boolean; error: string | null }>({classId: null, students: [], loading: false, error: null});
  useEffect(() => {
    if (!classId) return;
    let active = true;
    setState({classId, students: [], loading: true, error: null});
    void fetchStudentsOfClass(classId).then(rows => {
      if (active) setState({classId, students: rows.map(row => ({id: row.id, label: row.name})), loading: false, error: null});
    }).catch(() => {
      if (active) setState({classId, students: [], loading: false, error: 'roster'});
    });
    return () => { active = false; };
  }, [classId]);
  return classId && state.classId === classId ? state : {students: EMPTY_ROSTER, loading: !!classId, error: null};
}
