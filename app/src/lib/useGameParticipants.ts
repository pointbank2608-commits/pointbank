import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ABSENT_EVENT, loadAbsent } from './absent';
import { gameParticipants, type GameParticipantMode } from './gameParticipants';
import { isShowOrderOn, loadTeamOrder, TEAM_ORDER_EVENT } from './teamOrder';
import type { GameItem } from './types';

export function useGameParticipants(classId: string | null, roster: GameItem[], savedMode: GameParticipantMode | undefined,
  teams: number, teamLabel: (n: number) => string) {
  const { t } = useTranslation();
  const { session, academy } = useAuth();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener(TEAM_ORDER_EVENT, refresh);
    window.addEventListener(ABSENT_EVENT, refresh);
    return () => { window.removeEventListener(TEAM_ORDER_EVENT, refresh); window.removeEventListener(ABSENT_EVENT, refresh); };
  }, []);
  const attending = useMemo(() => {
    void revision;
    const absent = new Set(loadAbsent(classId ?? ''));
    return roster.filter(row => !absent.has(row.id));
  }, [roster, classId, revision]);
  const scope = `${session?.user.id}:${academy?.id}`;
  const order = useMemo(() => {
    void revision;
    return attending.length ? loadTeamOrder(attending, scope) : null;
  }, [attending, scope, revision]);
  const mode = savedMode ?? (!isShowOrderOn() ? 'none' : order?.mode === 'team' ? 'team' : 'solo');
  return { mode, players: gameParticipants(mode, attending, order, teams, teamLabel, classId ? '' : t('gameTelepathy.me')) };
}
