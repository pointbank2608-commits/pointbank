import { useEffect, useRef, useState } from 'react';
import { colorFor } from '../lib/wheel';
import type { GameItem } from '../lib/types';

interface Props {
  participants: GameItem[];
  order: GameItem[] | null;
  active: boolean;
  revealCount: number;
}

/**
 * 상자 안에서 공이 섞이다가, 순서가 정해질 때마다 공 하나가 튀어나와
 * 슬롯에 자리를 잡는 뽑기 기계 애니메이션.
 */
export default function LotteryMachine({ participants, order, active, revealCount }: Props) {
  const n = participants.length;
  const shown = order ?? participants;
  const ballsLeft = Math.max(n - revealCount, 0);

  const [popIndex, setPopIndex] = useState<number | null>(null);
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevReveal = useRef(revealCount);

  useEffect(() => {
    if (revealCount > prevReveal.current && order) {
      const i = revealCount - 1;
      setPopIndex(i);
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
      popTimerRef.current = setTimeout(() => setPopIndex(null), 480);
    }
    prevReveal.current = revealCount;
    return () => {
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
    };
  }, [revealCount, order]);

  return (
    <div className="lottery-stage">
      <div className={`lottery-box ${active ? 'active' : ''}`}>
        {Array.from({ length: ballsLeft }, (_, i) => (
          <span
            key={i}
            className="lottery-ball"
            style={{ background: colorFor(i), animationDelay: `${(i % 6) * 0.11}s` }}
          />
        ))}
      </div>

      <div className="lottery-slots">
        {popIndex != null && (
          <span
            key={`pop-${popIndex}`}
            className="lottery-pop-ball"
            style={{
              left: `calc(${((popIndex + 0.5) / n) * 100}% - 12px)`,
              background: colorFor(popIndex),
            }}
          />
        )}
        {shown.map((p, i) => {
          const revealed = order != null && i < revealCount;
          return (
            <div key={order ? p.id : `slot-${i}`} className={`lottery-slot ${revealed ? 'revealed' : ''}`}>
              <span className="lottery-slot-rank">{i + 1}등</span>
              <span className="lottery-slot-name">{revealed ? p.label : '?'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
