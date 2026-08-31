import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
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

interface Flyer {
  key: number;
  index: number;
  label: string;
  color: string;
  sx: number;
  sy: number;
  dx: number;
  dy: number;
}

const MACHINE_SRC = '/skins/lottery-machine.png';
/** 스킨 이미지에서 측정한 유리구 구멍. 값은 이미지 너비/높이 대비 비율. */
const HOLE = { cx: 0.488, cy: 0.441, r: 0.295 };
/** 받침대 앞쪽 배출구. */
const CHUTE = { cx: 0.5, cy: 0.82 };
const BALL = 40;
export const LOTTERY_FLY_MS = 720;

function randomPos(): Pos {
  const ang = Math.random() * Math.PI * 2;
  const rad = Math.sqrt(Math.random()) * 32;
  return { left: 50 + Math.cos(ang) * rad, top: 50 + Math.sin(ang) * rad };
}

function ballFill(color: string): string {
  return `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.7), ${color} 44%, rgba(0,0,0,0.18) 100%)`;
}

/**
 * 유리구 안에서 공이 튕기다가, 순서가 정해질 때마다 받침대 구멍으로 나와
 * 아래 슬롯으로 굴러간다.
 */
export default function LotteryMachine({ participants, ranks, order, active, revealCount }: Props) {
  const { t } = useTranslation();
  const n = participants.length;
  const shown = order ?? participants;
  const ballsLeft = Math.max(n - revealCount, 0);

  const [positions, setPositions] = useState<Pos[]>(() => Array.from({ length: n }, randomPos));
  const [displayedCount, setDisplayedCount] = useState(0);
  const [flyer, setFlyer] = useState<Flyer | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const chuteRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevReveal = useRef(revealCount);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setPositions((prev) => prev.map(() => randomPos()));
    }, 320);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (revealCount === 0) {
      setDisplayedCount(0);
      setFlyer(null);
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    }
  }, [revealCount]);

  useEffect(() => {
    if (revealCount <= prevReveal.current || !order) {
      prevReveal.current = revealCount;
      return;
    }
    const i = revealCount - 1;
    prevReveal.current = revealCount;
    const raf = requestAnimationFrame(() => {
      const wrap = wrapRef.current?.getBoundingClientRect();
      const chute = chuteRef.current?.getBoundingClientRect();
      const slot = slotRefs.current[i]?.getBoundingClientRect();
      if (!wrap || !chute || !slot) {
        setDisplayedCount(i + 1);
        return;
      }
      const sx = chute.left + chute.width / 2 - wrap.left - BALL / 2;
      const sy = chute.top + chute.height / 2 - wrap.top - BALL / 2;
      const ex = slot.left + slot.width / 2 - wrap.left - BALL / 2;
      const ey = slot.top + slot.height / 2 - wrap.top - BALL / 2;
      setFlyer({
        key: Date.now(),
        index: i,
        label: order[i]?.label.slice(0, 3) ?? '',
        color: colorFor(i),
        sx,
        sy,
        dx: ex - sx,
        dy: ey - sy,
      });
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
      flyTimerRef.current = setTimeout(() => {
        setDisplayedCount(i + 1);
        setFlyer(null);
      }, LOTTERY_FLY_MS);
    });
    return () => cancelAnimationFrame(raf);
  }, [revealCount, order]);

  const holeLeft = `${(HOLE.cx - HOLE.r) * 100}%`;
  const holeTop = `${(HOLE.cy - HOLE.r) * 100}%`;
  const holeSize = `${HOLE.r * 2 * 100}%`;
  const showBallLabel = n <= 8;

  return (
    <div ref={wrapRef} className="relative flex flex-col items-center w-full">
      <div
        className={`relative w-[min(300px,88vw)] aspect-square mb-1 ${active ? 'lottery-box-shake' : ''}`}
        style={{ filter: 'drop-shadow(0 14px 22px rgba(110, 62, 18, 0.22))' }}
      >
        <div
          className="absolute overflow-hidden rounded-full"
          style={{ left: holeLeft, top: holeTop, width: holeSize, height: holeSize }}
        >
          {Array.from({ length: ballsLeft }, (_, i) => (
            <span
              key={i}
              className={`absolute flex items-center justify-center w-[40px] h-[40px] -ml-[20px] -mt-[20px] rounded-full text-[9px] font-bold text-white leading-none ${
                active ? 'transition-[left,top] duration-[320ms] ease-[cubic-bezier(0.34,1.7,0.64,1)] lottery-ball-pulse' : ''
              }`}
              style={{
                left: `${positions[i]?.left ?? 50}%`,
                top: `${positions[i]?.top ?? 50}%`,
                animationDelay: `${(i % 6) * 0.08}s`,
                background: ballFill(colorFor(i)),
                boxShadow: '0 4px 8px rgba(110,62,18,0.28), inset -3px -4px 6px rgba(0,0,0,0.16)',
              }}
            >
              {showBallLabel ? participants[i]?.label.slice(0, 3) : ''}
            </span>
          ))}
        </div>
        <img src={MACHINE_SRC} alt="" draggable={false} className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none" />
        <div
          ref={chuteRef}
          className="pointer-events-none absolute z-20 h-2 w-2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${CHUTE.cx * 100}%`, top: `${CHUTE.cy * 100}%` }}
        />
      </div>

      <div className="relative w-full flex flex-wrap justify-center gap-3 mt-3.5 mb-5">
        {shown.map((p, i) => {
          const revealed = order != null && i < displayedCount;
          return (
            <div
              key={order ? p.id : `slot-${i}`}
              ref={(el) => {
                slotRefs.current[i] = el;
              }}
              className={`w-[108px] min-h-[92px] rounded-2xl flex flex-col items-center justify-center gap-1.5 p-2.5 transition-all duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.3)] ${
                revealed ? 'scale-105 -translate-y-1' : ''
              }`}
              style={
                revealed
                  ? {
                      backgroundColor: colorFor(i),
                      border: '3px solid #f0d7a8',
                      boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
                    }
                  : {
                      backgroundColor: '#fffdf8',
                      border: '2px dashed #9ad6c4',
                      boxShadow: '0 4px 10px rgba(110,62,18,0.06)',
                    }
              }
            >
              <span className={`font-caption text-caption tracking-wide ${revealed ? 'text-white/90' : 'text-on-surface-variant'}`}>
                {ranks[i]?.label ?? t('gameOrder.ordinalStyle', { n: i + 1 })}
              </span>
              <span
                className={`font-title-md text-title-md text-center [word-break:keep-all] ${
                  revealed ? 'text-white font-bold' : 'text-on-surface-variant'
                }`}
              >
                {revealed ? p.label : '?'}
              </span>
            </div>
          );
        })}
      </div>

      {flyer && (
        <span
          key={flyer.key}
          className="lottery-eject-ball pointer-events-none absolute z-30 flex items-center justify-center rounded-full text-[9px] font-bold text-white leading-none"
          style={
            {
              left: flyer.sx,
              top: flyer.sy,
              width: BALL,
              height: BALL,
              '--dx': `${flyer.dx}px`,
              '--dy': `${flyer.dy}px`,
              background: ballFill(flyer.color),
              boxShadow: '0 6px 12px rgba(110,62,18,0.35), inset -3px -4px 6px rgba(0,0,0,0.16)',
            } as CSSProperties
          }
        >
          {flyer.label}
        </span>
      )}
    </div>
  );
}
