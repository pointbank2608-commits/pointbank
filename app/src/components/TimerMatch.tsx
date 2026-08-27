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
    <div className="timer-match-stage">
      <div className="timer-match-toggles">
        <div className="scope-toggle">
          <button type="button" className={mode === 'practice' ? 'active' : ''} onClick={() => switchMode('practice')}>
            공용 도전판
          </button>
          <button type="button" className={mode === 'ranked' ? 'active' : ''} onClick={() => switchMode('ranked')}>
            참가자별 순위
          </button>
        </div>
        <div className="scope-toggle">
          <button type="button" className={showTimer ? 'active' : ''} onClick={() => setShowTimer(true)}>
            숫자 보임
          </button>
          <button type="button" className={!showTimer ? 'active' : ''} onClick={() => setShowTimer(false)}>
            숫자 숨김
          </button>
        </div>
      </div>

      <div className="timer-match-target">목표 {fmt(targetMs)}</div>

      {blockedForRanked ? (
        <div className="wheel-empty">
          <div className="wheel-empty-icon">⏱️</div>
          <div>참가자별 순위를 쓰려면 참가자를 1명 이상 등록해 주세요.</div>
        </div>
      ) : allDone ? (
        <div className="timer-leaderboard">
          <div className="timer-leaderboard-title">🏆 오차 순위</div>
          {leaderboard.map((a, i) => (
            <div key={a.participantId + i} className="timer-leaderboard-row">
              <span className="timer-leaderboard-rank">{i + 1}</span>
              <span className="timer-leaderboard-name">{a.label}</span>
              <span className="timer-leaderboard-time">{fmt(a.elapsedMs)}</span>
              <span className="timer-leaderboard-diff">±{fmt(a.diffMs)}</span>
            </div>
          ))}
          <button className="btn-primary wheel-spin-btn" onClick={restartAll}>
            처음부터 다시
          </button>
        </div>
      ) : (
        <>
          {mode === 'ranked' && phase !== 'stopped' && (
            <div className="bomb-holder">{participants[turnIndex]?.label} 차례!</div>
          )}

          <div className={`timer-match-display ${phase}`}>
            {showTimer || phase === 'stopped' ? fmt(elapsedMs) : phase === 'running' ? '??:??.??' : fmt(0)}
          </div>

          {(phase === 'idle' || phase === 'running') && (
            <button
              type="button"
              className={`timer-round-btn ${phase === 'running' ? 'running' : ''}`}
              onClick={phase === 'running' ? stop : start}
            >
              {phase === 'running' ? 'STOP' : 'START'}
            </button>
          )}

          {phase === 'stopped' && diffMs != null && (
            <>
              <div className="timer-match-result">
                <div className="timer-match-diff">오차 ±{fmt(diffMs)}</div>
                <div className="timer-match-message">{resultMessage(diffMs)}</div>
              </div>
              {mode === 'practice' ? (
                <button className="btn-primary wheel-spin-btn" onClick={tryAgain}>
                  다시 도전
                </button>
              ) : (
                <button className="btn-primary wheel-spin-btn" onClick={nextTurn}>
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
