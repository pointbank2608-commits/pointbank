import { useEffect, useRef, useState } from 'react';
import { playMusic } from '../lib/gameMusic';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  participants: GameItem[];
  targetMs: number;
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
}

type Mode = 'ranked' | 'practice';
type Phase = 'idle' | 'running' | 'stopped';

interface Attempt {
  participantId: string;
  label: string;
  elapsedMs: number;
  diffMs: number;
}

function fmt(ms: number): string {
  const totalCs = Math.round(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function resultMessage(diffMs: number): string {
  if (diffMs <= 50) return '완벽해요! 놀라운 감각!';
  if (diffMs <= 200) return '거의 정확해요!';
  if (diffMs <= 500) return '훌륭해요!';
  if (diffMs <= 1000) return '아깝다!';
  return '다음엔 더 잘할 수 있어요!';
}

/**
 * 타이머 맞추기. 목표 시간을 정해두고 "시작"→"멈춤"으로 최대한 가깝게 맞히는 게임.
 * showTimer 를 끄면 숫자를 숨겨서(실제 게임에서 흔히 하는 방식) 감으로만 맞혀야 한다.
 * ranked 모드에서는 참가자가 한 명씩 돌아가며 도전하고, 끝나면 오차 순으로 순위를 보여준다.
 */
export default function TimerMatch({ participants, targetMs, music, resultSound }: Props) {
  const n = participants.length;
  const [mode, setMode] = useState<Mode>('practice');
  const [showTimer, setShowTimer] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const stopMusicRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopMusicRef.current();
    };
  }, []);

  function start() {
    if (phase === 'running') return;
    stopMusicRef.current();
    setPhase('running');
    setElapsedMs(0);
    startTimeRef.current = performance.now();
    stopMusicRef.current = playMusic(music, { loop: true });

    const tick = () => {
      setElapsedMs(performance.now() - startTimeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stop() {
    if (phase !== 'running') return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const finalElapsed = performance.now() - startTimeRef.current;
    setElapsedMs(finalElapsed);
    setPhase('stopped');
    stopMusicRef.current();
    playMusic(resultSound);

    if (mode === 'ranked' && participants[turnIndex]) {
      const diffMs = Math.abs(finalElapsed - targetMs);
      const p = participants[turnIndex];
      setAttempts((prev) => [...prev, { participantId: p.id, label: p.label, elapsedMs: finalElapsed, diffMs }]);
    }
  }

  function tryAgain() {
    setPhase('idle');
    setElapsedMs(0);
  }

  function nextTurn() {
    setTurnIndex((prev) => prev + 1);
    setPhase('idle');
    setElapsedMs(0);
  }

  function restartAll() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stopMusicRef.current();
    setTurnIndex(0);
    setAttempts([]);
    setPhase('idle');
    setElapsedMs(0);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    restartAll();
    setMode(next);
  }

  const allDone = mode === 'ranked' && n > 0 && turnIndex >= n;
  const blockedForRanked = mode === 'ranked' && n === 0;
  const diffMs = phase === 'stopped' ? Math.abs(elapsedMs - targetMs) : null;
  const leaderboard = [...attempts].sort((a, b) => a.diffMs - b.diffMs);

  return (
    <div className="flex flex-col items-center pt-3 pb-2">
      <div className="flex flex-wrap justify-center gap-2.5 mb-4">
        <div className="flex bg-surface-container-low rounded-lg p-1">
          <button
            type="button"
            onClick={() => switchMode('practice')}
            className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              mode === 'practice' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            공용 도전판
          </button>
          <button
            type="button"
            onClick={() => switchMode('ranked')}
            className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              mode === 'ranked' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            참가자별 순위
          </button>
        </div>
        <div className="flex bg-surface-container-low rounded-lg p-1">
          <button
            type="button"
            onClick={() => setShowTimer(true)}
            className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              showTimer ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            숫자 보임
          </button>
          <button
            type="button"
            onClick={() => setShowTimer(false)}
            className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              !showTimer ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            숫자 숨김
          </button>
        </div>
      </div>

      <div className="font-label-md text-label-md font-bold text-on-surface-variant mb-3.5">
        목표 {fmt(targetMs)}
      </div>

      {blockedForRanked ? (
        <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
          <div className="text-4xl mb-2">⏱️</div>
          <div className="font-body-md text-body-md">참가자별 순위를 쓰려면 참가자를 1명 이상 등록해 주세요.</div>
        </div>
      ) : allDone ? (
        <div className="w-full max-w-[420px] flex flex-col items-center">
          <div className="font-title-md text-title-md text-deep-navy mb-3.5">🏆 오차 순위</div>
          {leaderboard.map((a, i) => (
            <div
              key={a.participantId + i}
              className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-3 w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 mb-2 shadow-sm"
            >
              <span className="font-title-md text-title-md text-tertiary-container">{i + 1}</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">{a.label}</span>
              <span className="font-body-md text-sm text-on-surface-variant">{fmt(a.elapsedMs)}</span>
              <span className="font-body-md text-sm text-tertiary-container font-bold">±{fmt(a.diffMs)}</span>
            </div>
          ))}
          <button
            onClick={restartAll}
            className="mt-3 px-10 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
          >
            처음부터 다시
          </button>
        </div>
      ) : (
        <>
          {mode === 'ranked' && phase !== 'stopped' && (
            <div className="font-display-lg text-[34px] text-deep-navy mb-4 text-center">
              {participants[turnIndex]?.label} 차례!
            </div>
          )}

          <div
            className={`font-title-md text-[42px] sm:text-[64px] md:text-[96px] font-semibold text-on-surface border-4 rounded-[28px] px-5 sm:px-9 md:px-14 py-4 sm:py-5 md:py-6 mb-6 tracking-wide ${
              phase === 'running' ? 'border-warm-yellow bg-warm-yellow/15' : 'border-primary bg-surface-container-low'
            }`}
          >
            {showTimer || phase === 'stopped' ? fmt(elapsedMs) : phase === 'running' ? '??:??.??' : fmt(0)}
          </div>

          {(phase === 'idle' || phase === 'running') && (
            <button
              type="button"
              onClick={phase === 'running' ? stop : start}
              className={`w-[118px] h-[118px] rounded-full text-white font-title-md text-xl tracking-wide shadow-[0_10px_22px_-6px_rgba(186,26,26,0.6),inset_0_-4px_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 active:translate-y-px active:scale-[0.97] ${
                phase === 'running' ? 'timer-btn-pulse' : ''
              }`}
              style={{
                background:
                  phase === 'running'
                    ? 'radial-gradient(circle at 35% 30%, #ff5a5a, #e03e3e 65%, #b82c2c)'
                    : 'radial-gradient(circle at 35% 30%, #ff8a8a, #ba1a1a 65%, #e14b4b)',
              }}
            >
              {phase === 'running' ? 'STOP' : 'START'}
            </button>
          )}

          {phase === 'stopped' && diffMs != null && (
            <>
              <div className="text-center mb-4">
                <div className="font-title-md text-[26px] text-tertiary-container">오차 ±{fmt(diffMs)}</div>
                <div className="font-body-md text-body-md text-on-surface-variant mt-1">{resultMessage(diffMs)}</div>
              </div>
              {mode === 'practice' ? (
                <button
                  onClick={tryAgain}
                  className="px-10 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
                >
                  다시 도전
                </button>
              ) : (
                <button
                  onClick={nextTurn}
                  className="px-10 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
                >
                  {turnIndex + 1 >= n ? '결과 보기' : '다음 사람'}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
