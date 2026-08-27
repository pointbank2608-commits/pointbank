import { useRef, useState } from 'react';
import LotteryMachine from './LotteryMachine';
import { playMusic } from '../lib/gameMusic';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  participants: GameItem[];
  ranks: GameItem[];
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
}

type Phase = 'idle' | 'mixing' | 'revealing' | 'done';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MIX_MS = 1100;
const REVEAL_STEP_MS = 550;

export default function OrderPicker({ participants, ranks, music, resultSound }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [order, setOrder] = useState<GameItem[] | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const stopMusicRef = useRef<() => void>(() => {});
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const busy = phase === 'mixing' || phase === 'revealing';

  function start() {
    if (participants.length < 2 || busy) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    stopMusicRef.current();

    const shuffled = shuffle(participants);
    setOrder(shuffled);
    setRevealCount(0);
    setPhase('mixing');
    stopMusicRef.current = playMusic(music, { loop: true });

    const mixTimer = setTimeout(() => {
      setPhase('revealing');
      shuffled.forEach((_, i) => {
        const t = setTimeout(
          () => {
            setRevealCount((c) => c + 1);
            if (i === shuffled.length - 1) {
              setPhase('done');
              stopMusicRef.current();
              playMusic(resultSound);
            }
          },
          (i + 1) * REVEAL_STEP_MS,
        );
        timersRef.current.push(t);
      });
    }, MIX_MS);
    timersRef.current.push(mixTimer);
  }

  if (participants.length < 2) {
    return (
      <div className="wheel-empty">
        <div className="wheel-empty-icon">🔀</div>
        <div>참가자를 2명 이상 등록해야 순서를 뽑을 수 있어요.</div>
      </div>
    );
  }

  return (
    <div className="order-stage">
      <LotteryMachine participants={participants} ranks={ranks} order={order} active={busy} revealCount={revealCount} />

      <button className="btn-primary wheel-spin-btn" onClick={start} disabled={busy}>
        {phase === 'mixing' ? '섞는 중…' : phase === 'revealing' ? '순서 뽑는 중…' : order ? '다시 뽑기' : '순서 뽑기 시작'}
      </button>
    </div>
  );
}
