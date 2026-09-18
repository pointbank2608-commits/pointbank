import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from './AccessibleDialog';
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

const SPIN_STEPS = 12;
const SPIN_MIN_MS = 55;
const SPIN_MAX_MS = 260;

/** 슬롯머신처럼 랜덤 뽑기 버튼을 누르면 빠르게 몇 번 더 섞어 보여주다가(점점 느려지며)
 * 마지막에 진짜 결과로 멈춘다 — 바로 결과가 나오면 재미없다는 실사용 피드백으로 추가.
 * 가만히 있다가 툭 바뀌는 대신 "돌아가는 느낌"을 주는 게 목적이라, 중간 단계는 진짜
 * 결과와 같은 방식으로 계속 다시 뽑기만 하면 된다(어차피 전부 무작위라 마지막 것만
 * "진짜"로 채택하는 셈). 모션을 줄이고 싶은 사용자는 즉시 최종 결과만 보여준다. */
function useSlotSpin() {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  function spin(tick: () => void) {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tick();
      return;
    }

    setSpinning(true);
    let delay = 0;
    for (let i = 0; i < SPIN_STEPS; i++) {
      const t = i / (SPIN_STEPS - 1);
      delay += SPIN_MIN_MS + (SPIN_MAX_MS - SPIN_MIN_MS) * t * t;
      const isLast = i === SPIN_STEPS - 1;
      timersRef.current.push(
        setTimeout(() => {
          tick();
          if (isLast) setSpinning(false);
        }, delay),
      );
    }
  }

  return { spin, spinning };
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
  const { spin, spinning } = useSlotSpin();

  /** 순서대로(섞지 않고) count개 팀에 고르게 나눠 담는다 — 팀 모드에 처음 들어가거나
   * 팀 수를 바꿀 때 쓰는 "일단 뭐라도 채워두는" 기본값. 실제 무작위 배정은
   * assignTeamsRandomly(랜덤 배정 버튼)만 한다. */
  function distributeTeamsInOrder(count: number): Record<string, number> {
    const next: Record<string, number> = {};
    roster.forEach((r, i) => {
      next[r.id] = i % count;
    });
    return next;
  }

  function assignTeamsRandomly(count: number) {
    spin(() => {
      const shuffled = shuffle(roster);
      const next: Record<string, number> = {};
      shuffled.forEach((r, i) => {
        next[r.id] = i % count;
      });
      setTeamOf(next);
      setOrder(shuffle(Array.from({ length: count }, (_, i) => `team-${i}`)));
    });
  }

  function switchToTeamMode() {
    setMode('team');
    // 이미 (이전에 수동으로 혹은 랜덤 배정으로) 팀이 정해져 있으면 그대로 두고, 처음
    // 들어가는 거면 순서대로 고르게 나눠 채운다 — 팀 버튼을 누르자마자 자동으로 랜덤
    // 배정돼버리면 안 된다는 실사용 피드백으로 고침.
    if (Object.keys(teamOf).length === 0) {
      setTeamOf(distributeTeamsInOrder(teamCount));
    }
    setOrder(Array.from({ length: teamCount }, (_, i) => `team-${i}`));
  }

  function switchToIndividualMode() {
    setMode('individual');
    setOrder(roster.map((r) => r.id));
  }

  function changeTeamCount(next: number) {
    const n = Math.max(2, Math.min(6, next));
    setTeamCount(n);
    // 팀 수만 바꾸는 것도 랜덤 배정이 아니다 — 기존에 수동/랜덤으로 정해둔 팀은 그 팀
    // 번호가 새 팀 수 안에 여전히 있으면 그대로 두고, 범위 밖으로 밀려난 사람만(팀 수를
    // 줄였을 때) 순서대로 다시 채운다.
    setTeamOf((prev) => {
      const redistributed: Record<string, number> = {};
      roster.forEach((r, i) => {
        const cur = prev[r.id];
        redistributed[r.id] = cur !== undefined && cur < n ? cur : i % n;
      });
      return redistributed;
    });
    setOrder(Array.from({ length: n }, (_, i) => `team-${i}`));
  }

  function cycleTeam(studentId: string) {
    setTeamOf((prev) => {
      const cur = prev[studentId] ?? 0;
      return { ...prev, [studentId]: (cur + 1) % teamCount };
    });
  }

  function shuffleOrder() {
    spin(() => setOrder((prev) => shuffle(prev)));
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
    <AccessibleDialog label={t('teamOrder.title')} onClose={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-container px-5 py-4">
          <h3 className="font-title-md text-title-md text-deep-navy">{t('teamOrder.title')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
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
                  disabled={spinning}
                  className={`rounded-md px-4 py-1.5 font-label-md text-label-md transition-all disabled:opacity-50 ${
                    mode === 'individual' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                  }`}
                >
                  {t('teamOrder.modeIndividual')}
                </button>
                <button
                  type="button"
                  onClick={switchToTeamMode}
                  disabled={spinning}
                  className={`rounded-md px-4 py-1.5 font-label-md text-label-md transition-all disabled:opacity-50 ${
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
                        disabled={teamCount <= 2 || spinning}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-on-surface disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-title-md text-title-md tabular-nums">{teamCount}</span>
                      <button
                        type="button"
                        onClick={() => changeTeamCount(teamCount + 1)}
                        disabled={teamCount >= 6 || spinning}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-on-surface disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => assignTeamsRandomly(teamCount)}
                      disabled={spinning}
                      aria-busy={spinning}
                      className="flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-1.5 font-label-md text-label-md text-on-secondary-container hover:opacity-90 disabled:opacity-60"
                    >
                      <span className={`material-symbols-outlined text-base ${spinning ? 'animate-spin' : ''}`}>shuffle</span>
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
                                disabled={spinning}
                                title={t('teamOrder.cycleHint')}
                                className="rounded-full bg-surface-container-lowest/95 px-3 py-1 font-label-md text-label-md text-on-surface transition-transform hover:scale-105 disabled:opacity-60"
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
                    disabled={spinning}
                    aria-busy={spinning}
                    className="flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-1.5 font-label-md text-label-md text-on-secondary-container hover:opacity-90 disabled:opacity-60"
                  >
                    <span className={`material-symbols-outlined text-base ${spinning ? 'animate-spin' : ''}`}>shuffle</span>
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
                      <div
                        key={id}
                        className={`flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 ${spinning ? 'animate-pulse' : ''}`}
                      >
                        <span className="w-7 text-center font-title-md text-title-md text-primary tabular-nums">{i + 1}</span>
                        <span className="flex-1 font-label-md text-label-md text-on-surface">{label}</span>
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0 || spinning}
                          aria-label={t('teamOrder.moveUp')}
                          className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-20"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === order.length - 1 || spinning}
                          aria-label={t('teamOrder.moveDown')}
                          className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-20"
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
    </AccessibleDialog>
  );
}
