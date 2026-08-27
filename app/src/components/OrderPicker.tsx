import { useRef, useState } from 'react';
import { playMusic } from '../lib/gameMusic';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  participants: GameItem[];
  music?: MusicSelection | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const REVEAL_STEP_MS = 550;

export default function OrderPicker({ participants, music }: Props) {
  const [order, setOrder] = useState<GameItem[] | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const [running, setRunning] = useState(false);
  const stopMusicRef = useRef<() => void>(() => {});
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function start() {
    if (participants.length < 2 || running) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    stopMusicRef.current();

    const shuffled = shuffle(participants);
    setOrder(shuffled);
    setRevealCount(0);
    setRunning(true);
    stopMusicRef.current = playMusic(music, { loop: true });

    shuffled.forEach((_, i) => {
      const t = setTimeout(
        () => {
          setRevealCount((c) => c + 1);
          if (i === shuffled.length - 1) {
            setRunning(false);
            stopMusicRef.current();
          }
        },
        (i + 1) * REVEAL_STEP_MS,
      );
      timersRef.current.push(t);
    });
  }

  if (participants.length < 2) {
    return (
      <div className="wheel-empty">
        <div className="wheel-empty-icon">🔀</div>
        <div>참가자를 2명 이상 등록해야 순서를 뽑을 수 있어요.</div>
      </div>
    );
  }

  const shown = order ?? participants;

  return (
    <div className="order-stage">
      <div className="order-grid">
        {shown.map((p, i) => {
          const isRevealed = order != null && i < revealCount;
          return (
            <div key={order ? p.id : `slot-${i}`} className={`order-card ${isRevealed ? 'revealed' : ''}`}>
              <div className="order-card-rank">{i + 1}등</div>
              <div className="order-card-name">{isRevealed ? p.label : '?'}</div>
            </div>
          );
        })}
      </div>

      <button className="btn-primary wheel-spin-btn" onClick={start} disabled={running}>
        {running ? '순서 뽑는 중…' : order ? '다시 뽑기' : '순서 뽑기 시작'}
      </button>
    </div>
  );
}
