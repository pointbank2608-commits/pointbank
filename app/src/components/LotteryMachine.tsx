import { useEffect, useRef, useState } from 'react';
import { colorFor } from '../lib/wheel';
import type { GameItem } from '../lib/types';

interface Props {
  participants: GameItem[];
  ranks: GameItem[];
  order: GameItem[] | null;
  active: boolean;
  revealCount: number;
}

interface Pos {
  left: number;
  top: number;
}

function randomPos(): Pos {
  return { left: 12 + Math.random() * 76, top: 16 + Math.random() * 68 };
}

/**
 * 상자 안에서 공이 요란하게 튕겨 다니다가, 순서가 정해질 때마다 공 하나가 튀어나와
 * 슬롯에 자리를 잡는 뽑기 기계 애니메이션. 공 위치는 JS로 짧은 간격마다 무작위로
 * 다시 정하고, CSS transition의 통통 튀는 easing으로 실제로 튕겨 다니는 것처럼 보이게 한다.
 */
export default function LotteryMachine({ participants, ranks, order, active, revealCount }: Props) {
  const n = participants.length;
  const shown = order ?? participants;
  const ballsLeft = Math.max(n - revealCount, 0);

  const [positions, setPositions] = useState<Pos[]>(() => Array.from({ length: n }, randomPos));

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setPositions((prev) => prev.map(() => randomPos()));
    }, 320);
    return () => clearInterval(id);
  }, [active]);

  const [popIndex, setPopIndex] = useState<number | null>(null);
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevReveal = useRef(revealCount);

  useEffect(() => {
    if (revealCount > prevReveal.current && order) {
      const i = revealCount - 1;
      setPopIndex(i);
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
      popTimerRef.current = setTimeout(() => setPopIndex(null), 520);
    }
    prevReveal.current = revealCount;
    return () => {
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
    };
  }, [revealCount, order]);

  return (
    <div className="flex flex-col items-center w-full">
      <div
        className={`relative w-[min(360px,92vw)] h-[190px] bg-gradient-to-b from-surface-container-low to-surface-container-lowest border-4 border-primary rounded-[30px] overflow-hidden shadow-[inset_0_8px_18px_rgba(39,101,168,0.16)] mb-2 ${
          active ? 'lottery-box-shake' : ''
        }`}
      >
        {Array.from({ length: ballsLeft }, (_, i) => (
          <span
            key={i}
            className={`absolute w-[42px] h-[42px] -ml-[21px] -mt-[21px] rounded-full shadow-[0_5px_10px_rgba(39,101,168,0.38),inset_-4px_-4px_0_rgba(0,0,0,0.15)] ${
              active ? 'transition-[left,top] duration-[320ms] ease-[cubic-bezier(0.34,1.7,0.64,1)] lottery-ball-pulse' : ''
            }`}
            style={{
              background: colorFor(i),
              left: `${positions[i]?.left ?? 50}%`,
              top: `${positions[i]?.top ?? 50}%`,
              animationDelay: `${(i % 6) * 0.08}s`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full flex flex-wrap justify-center gap-3 mt-3.5 mb-5">
        {popIndex != null && (
          <span
            key={`pop-${popIndex}`}
            className="lottery-drop-badge absolute -top-[150px] w-8 h-8 rounded-full shadow-[0_5px_10px_rgba(39,101,168,0.4)] pointer-events-none z-[3]"
            style={{
              left: `calc(${((popIndex + 0.5) / n) * 100}% - 16px)`,
              background: colorFor(popIndex),
            }}
          />
        )}
        {shown.map((p, i) => {
          const revealed = order != null && i < revealCount;
          return (
            <div
              key={order ? p.id : `slot-${i}`}
              className={`w-[108px] min-h-[92px] rounded-2xl flex flex-col items-center justify-center gap-1.5 p-2.5 transition-all duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.3)] ${
                revealed
                  ? 'border-2 border-warm-yellow bg-warm-yellow/15 scale-105 -translate-y-1 shadow-[0_4px_20px_rgba(39,101,168,0.08)]'
                  : 'border-2 border-dashed border-outline-variant bg-surface-container-lowest shadow-[0_4px_20px_rgba(39,101,168,0.08)]'
              }`}
            >
              <span className="font-caption text-caption text-on-surface-variant tracking-wide">
                {ranks[i]?.label ?? `${i + 1}등`}
              </span>
              <span
                className={`font-title-md text-title-md text-center [word-break:keep-all] ${
                  revealed ? 'text-tertiary-container' : 'text-on-surface'
                }`}
              >
                {revealed ? p.label : '?'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
