import { useEffect, useRef, useState } from 'react';
import { playMusic } from '../lib/gameMusic';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  participants: GameItem[];
  minSec: number;
  maxSec: number;
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
}

type Phase = 'idle' | 'active' | 'exploded';
type Mode = 'pass' | 'timer';

/**
 * 시한폭탄. min~maxSec 사이의 무작위 시각에 터지도록 숨겨진 타이머를 걸어둔다.
 * - "참가자 순서대로": 화면에서 "다음 사람에게 넘기기"를 누를 때마다 폭탄을 든 사람이 바뀌고,
 *   터지는 순간 그때 들고 있던 사람이 걸린다.
 * - "타이머만": 참가자 없이 카운트다운(숨김)과 폭발 연출만 — 실제 물건(인형/공 등)을 돌릴 때 씀.
 */
export default function TimeBomb({ participants, minSec, maxSec, music, resultSound }: Props) {
  const n = participants.length;
  const [mode, setMode] = useState<Mode>('pass');
  const [phase, setPhase] = useState<Phase>('idle');
  const [holderIndex, setHolderIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopMusicRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopMusicRef.current();
    };
  }, []);

  function start() {
    if (phase === 'active') return;
    if (mode === 'pass' && n < 2) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMusicRef.current();

    setHolderIndex(0);
    setPhase('active');
    stopMusicRef.current = playMusic(music, { loop: true });

    const span = Math.max(maxSec - minSec, 0);
    const delaySec = minSec + Math.random() * span;
    timerRef.current = setTimeout(() => {
      setPhase('exploded');
      stopMusicRef.current();
      playMusic(resultSound);
    }, delaySec * 1000);
  }

  function pass() {
    if (phase !== 'active' || n === 0) return;
    setHolderIndex((prev) => (prev + 1) % n);
  }

  function reset() {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMusicRef.current();
    setPhase('idle');
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    reset();
    setMode(next);
  }

  const blockedForPassMode = mode === 'pass' && n < 2;

  return (
    <div className="bomb-stage">
      <div className="scope-toggle bomb-mode-toggle">
        <button type="button" className={mode === 'pass' ? 'active' : ''} onClick={() => switchMode('pass')}>
          참가자 순서대로
        </button>
        <button type="button" className={mode === 'timer' ? 'active' : ''} onClick={() => switchMode('timer')}>
          타이머만
        </button>
      </div>

      {blockedForPassMode ? (
        <div className="wheel-empty">
          <div className="wheel-empty-icon">💣</div>
          <div>참가자를 2명 이상 등록해야 순서대로 돌릴 수 있어요.</div>
        </div>
      ) : (
        <>
          <div className={`bomb-visual ${phase}`}>
            <div className="bomb-emoji">{phase === 'exploded' ? '💥' : '💣'}</div>
            {phase === 'active' && <div className="bomb-spark">✨</div>}
          </div>

          {phase === 'idle' && (
            <button className="btn-primary wheel-spin-btn" onClick={start}>
              폭탄 돌리기 시작
            </button>
          )}

          {phase === 'active' && mode === 'pass' && (
            <>
              <div className="bomb-holder">{participants[holderIndex]?.label} 차례!</div>
              <button className="btn-primary wheel-spin-btn" onClick={pass}>
                다음 사람에게 넘기기 →
              </button>
            </>
          )}

          {phase === 'active' && mode === 'timer' && (
            <div className="bomb-holder">째깍째깍… 언제 터질까요?</div>
          )}

          {phase === 'exploded' && (
            <>
              <div className="bomb-result">
                {mode === 'pass' ? (
                  <>
                    <div className="bomb-result-label">펑! 걸린 사람</div>
                    <div className="bomb-result-name">{participants[holderIndex]?.label}</div>
                  </>
                ) : (
                  <div className="bomb-result-name">펑! 💥</div>
                )}
              </div>
              <button className="btn-primary wheel-spin-btn" onClick={reset}>
                다시 하기
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
