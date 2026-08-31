import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LotteryMachine, { LOTTERY_FLY_MS } from './LotteryMachine';
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
const REVEAL_STEP_MS = 880;

export default function OrderPicker({ participants, ranks, music, resultSound }: Props) {
  const { t } = useTranslation();
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
        const timer = setTimeout(
          () => {
            setRevealCount((c) => c + 1);
            if (i === shuffled.length - 1) {
              const doneTimer = setTimeout(() => {
                setPhase('done');
                stopMusicRef.current();
                playMusic(resultSound);
              }, LOTTERY_FLY_MS);
              timersRef.current.push(doneTimer);
            }
          },
          (i + 1) * REVEAL_STEP_MS,
        );
        timersRef.current.push(timer);
      });
    }, MIX_MS);
    timersRef.current.push(mixTimer);
  }

  if (participants.length < 2) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🔀</div>
        <div className="font-body-md text-body-md">{t('gameOrder.needTwoParticipants')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <LotteryMachine participants={participants} ranks={ranks} order={order} active={busy} revealCount={revealCount} />

      <button
        onClick={start}
        disabled={busy}
        className="mt-2 px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container disabled:opacity-60 text-on-secondary font-title-md text-title-md shadow-sm transition-colors"
      >
        {phase === 'mixing'
          ? t('gameOrder.mixing')
          : phase === 'revealing'
            ? t('gameOrder.revealing')
            : order
              ? t('gameOrder.drawAgain')
              : t('gameOrder.startDraw')}
      </button>
    </div>
  );
}
