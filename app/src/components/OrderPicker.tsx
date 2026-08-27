import { useEffect, useRef, useState } from 'react';
import LotteryMachine from './LotteryMachine';
import { playMusic } from '../lib/gameMusic';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  participants: GameItem[];
  music?: MusicSelection | null;
}

type Style = 'cards' | 'lottery';
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
const FLICKER_MS = 90;

export default function OrderPicker({ participants, music }: Props) {
  const [style, setStyle] = useState<Style>('cards');
  const [phase, setPhase] = useState<Phase>('idle');
  const [order, setOrder] = useState<GameItem[] | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const [flicker, setFlicker] = useState<string[]>([]);
  const stopMusicRef = useRef<() => void>(() => {});
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const busy = phase === 'mixing' || phase === 'revealing';

  // 섞는 동안(카드 스타일) 각 칸에 무작위 이름을 빠르게 스쳐 보여줘서 "섞이는" 느낌을 준다.
  useEffect(() => {
    if (style !== 'cards' || phase !== 'mixing') return;
    const id = setInterval(() => {
      setFlicker(participants.map(() => participants[Math.floor(Math.random() * participants.length)].label));
    }, FLICKER_MS);
    return () => clearInterval(id);
  }, [style, phase, participants]);

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

  const shown = order ?? participants;

  return (
    <div className="order-stage">
      <div className="scope-toggle order-style-toggle">
        <button type="button" className={style === 'cards' ? 'active' : ''} onClick={() => setStyle('cards')} disabled={busy}>
          🃏 카드 섞기
        </button>
        <button
          type="button"
          className={style === 'lottery' ? 'active' : ''}
          onClick={() => setStyle('lottery')}
          disabled={busy}
        >
          🎱 뽑기 기계
        </button>
      </div>

      {style === 'cards' ? (
        <div className="order-grid">
          {shown.map((p, i) => {
            const isRevealed = order != null && i < revealCount;
            const label = isRevealed ? p.label : phase === 'mixing' ? (flicker[i] ?? '?') : '?';
            return (
              <div
                key={order ? p.id : `slot-${i}`}
                className={`order-card ${isRevealed ? 'revealed' : ''} ${phase === 'mixing' ? 'mixing' : ''}`}
              >
                <div className="order-card-rank">{i + 1}등</div>
                <div className="order-card-name">{label}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <LotteryMachine participants={participants} order={order} active={busy} revealCount={revealCount} />
      )}

      <button className="btn-primary wheel-spin-btn" onClick={start} disabled={busy}>
        {phase === 'mixing' ? '섞는 중…' : phase === 'revealing' ? '순서 뽑는 중…' : order ? '다시 뽑기' : '순서 뽑기 시작'}
      </button>
    </div>
  );
}
