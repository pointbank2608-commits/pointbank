import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

const TEAM_STYLES = [
  { bg: 'bg-primary', text: 'text-on-primary' },
  { bg: 'bg-error', text: 'text-on-error' },
  { bg: 'bg-secondary', text: 'text-on-secondary' },
  { bg: 'bg-tertiary', text: 'text-on-tertiary' },
  { bg: 'bg-sky-blue', text: 'text-deep-navy' },
  { bg: 'bg-warm-yellow', text: 'text-deep-navy' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 게임 시작 전에 "팀별로 할지 개인으로 할지, 팀은 몇 개로 나눌지, 누가 먼저 할지"를 정하는
 * 패널. 명단(반)만 있으면 어떤 게임에서든 똑같이 쓸 수 있도록 게임 자체 점수/로직에는
 * 관여하지 않는 순수 진행 보조 도구로 만들었다 — 결과를 저장하지 않고(그때그때 새로 뽑는
 * 용도), 화면에 크게 띄워서 학생들에게 보여주는 게 목적이다.
 */
export default function TeamOrderPanel({ roster, onClose }: { roster: GameItem[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'individual' | 'team'>('individual');
  const [teamCount, setTeamCount] = useState(2);
  const [teamOf, setTeamOf] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<string[]>(() => roster.map((r) => r.id));

  function assignTeamsRandomly(count: number) {
    const shuffled = shuffle(roster);
    const next: Record<string, number> = {};
    shuffled.forEach((r, i) => {
      next[r.id] = i % count;
    });
    setTeamOf(next);
    setOrder(shuffle(Array.from({ length: count }, (_, i) => `team-${i}`)));
  }

  function switchToTeamMode() {
    setMode('team');
    assignTeamsRandomly(teamCount);
  }

  function switchToIndividualMode() {
    setMode('individual');
    setOrder(roster.map((r) => r.id));
  }

  function changeTeamCount(next: number) {
    const n = Math.max(2, Math.min(6, next));
    setTeamCount(n);
    assignTeamsRandomly(n);
  }

  function cycleTeam(studentId: string) {
    setTeamOf((prev) => {
      const cur = prev[studentId] ?? 0;
      return { ...prev, [studentId]: (cur + 1) % teamCount };
    });
  }

  function shuffleOrder() {
    setOrder((prev) => shuffle(prev));
  }

  function move(index: number, delta: number) {
    setOrder((prev) => {
      const to = index + delta;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  const teams = useMemo(() => {
    if (mode !== 'team') return [];
    return Array.from({ length: teamCount }, (_, i) => ({
      index: i,
      members: roster.filter((r) => (teamOf[r.id] ?? 0) === i),
    }));
  }, [mode, teamCount, roster, teamOf]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-container px-5 py-4">
          <h3 className="font-title-md text-title-md text-deep-navy">{t('teamOrder.title')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
            aria-label={t('common.cancel')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          {roster.length === 0 ? (
            <div className="py-10 text-center font-body-md text-body-md text-on-surface-variant">
              {t('teamOrder.noRoster')}
            </div>
          ) : (
            <>
              <div className="flex w-fit rounded-lg bg-surface-container-low p-1">
                <button
                  type="button"
                  onClick={switchToIndividualMode}
                  className={`rounded-md px-4 py-1.5 font-label-md text-label-md transition-all ${
                    mode === 'individual' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {t('teamOrder.modeIndividual')}
                </button>
                <button
                  type="button"
                  onClick={switchToTeamMode}
                  className={`rounded-md px-4 py-1.5 font-label-md text-label-md transition-all ${
                    mode === 'team' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {t('teamOrder.modeTeam')}
                </button>
              </div>

              {mode === 'team' && (
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-label-md text-label-md text-on-surface-variant">{t('teamOrder.teamCountLabel')}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeTeamCount(teamCount - 1)}
                        disabled={teamCount <= 2}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-on-surface disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-title-md text-title-md tabular-nums">{teamCount}</span>
                      <button
                        type="button"
                        onClick={() => changeTeamCount(teamCount + 1)}
                        disabled={teamCount >= 6}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-on-surface disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => assignTeamsRandomly(teamCount)}
                      className="flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-1.5 font-label-md text-label-md text-on-secondary-container hover:opacity-90"
                    >
                      <span className="material-symbols-outlined text-base">shuffle</span>
                      {t('teamOrder.randomAssign')}
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {teams.map((team) => {
                      const style = TEAM_STYLES[team.index % TEAM_STYLES.length];
                      return (
                        <div key={team.index} className={`rounded-lg p-3 ${style.bg}`}>
                          <div className={`mb-1.5 font-label-md text-label-md ${style.text}`}>
                            {t('teamOrder.teamLabel', { n: team.index + 1 })}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {team.members.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => cycleTeam(m.id)}
                                title={t('teamOrder.cycleHint')}
                                className="rounded-full bg-surface-container-lowest/95 px-3 py-1 font-label-md text-label-md text-on-surface transition-transform hover:scale-105"
                              >
                                {m.label}
                              </button>
                            ))}
                            {team.members.length === 0 && (
                              <span className={`font-caption text-caption ${style.text} opacity-80`}>
                                {t('teamOrder.emptyTeam')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface-variant">{t('teamOrder.orderLabel')}</span>
                  <button
                    type="button"
                    onClick={shuffleOrder}
                    className="flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-1.5 font-label-md text-label-md text-on-secondary-container hover:opacity-90"
                  >
                    <span className="material-symbols-outlined text-base">shuffle</span>
                    {t('teamOrder.randomOrder')}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {order.map((id, i) => {
                    const label =
                      mode === 'team'
                        ? t('teamOrder.teamLabel', { n: Number(id.split('-')[1]) + 1 })
                        : (roster.find((r) => r.id === id)?.label ?? '');
                    return (
                      <div key={id} className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
                        <span className="w-7 text-center font-title-md text-title-md text-primary tabular-nums">{i + 1}</span>
                        <span className="flex-1 font-label-md text-label-md text-on-surface">{label}</span>
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          aria-label={t('teamOrder.moveUp')}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-20"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === order.length - 1}
                          aria-label={t('teamOrder.moveDown')}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-20"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
