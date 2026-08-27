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

/**
 * 시한폭탄(폭탄 돌리기). 시작하면 min~maxSec 사이의 무작위 시각에 터지도록 숨겨진
 * 타이머를 걸어두고, "다음 사람에게 넘기기"를 누를 때마다 폭탄을 든 사람이 바뀐다.
 * 터지는 순간 그때 폭탄을 들고 있던 사람이 걸린다 — 정확히 언제 터질지는 아무도 모른다.
 */
export default function TimeBomb({ participants, minSec, maxSec, music, resultSound }: Props) {
  const n = participants.length;
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
    if (n < 2 || phase === 'active') return;
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

  if (n < 2) {
    return (
      <div className="wheel-empty">
        <div className="wheel-empty-icon">💣</div>
        <div>참가자를 2명 이상 등록해야 폭탄을 돌릴 수 있어요.</div>
      </div>
    );
  }

  return (
    <div className="bomb-stage">
      <div className={`bomb-visual ${phase}`}>
        <div className="bomb-emoji">{phase === 'exploded' ? '💥' : '💣'}</div>
        {phase === 'active' && <div className="bomb-spark">✨</div>}
      </div>

      {phase === 'idle' && (
        <button className="btn-primary wheel-spin-btn" onClick={start}>
          폭탄 돌리기 시작
        </button>
      )}

      {phase === 'active' && (
        <>
          <div className="bomb-holder">{participants[holderIndex].label} 차례!</div>
          <button className="btn-primary wheel-spin-btn" onClick={pass}>
            다음 사람에게 넘기기 →
          </button>
        </>
      )}

      {phase === 'exploded' && (
        <>
          <div className="bomb-result">
            <div className="bomb-result-label">펑! 걸린 사람</div>
            <div className="bomb-result-name">{participants[holderIndex].label}</div>
          </div>
          <button className="btn-primary wheel-spin-btn" onClick={reset}>
            다시 하기
          </button>
        </>
      )}
    </div>
  );
}
