import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { colorFor } from '../lib/wheel';
import type { GameItem } from '../lib/types';
import GameFitText from './GameFitText';

interface Props {
  /** 기계에 등록된 전체 항목. 아직 안 뽑힌 개수·라벨 계산에 쓴다. */
  pool: GameItem[];
  /** 지금까지 뽑힌 항목, 뽑힌 순서대로. 늘어날 때마다 맨 뒤 칸으로 공이 날아간다. */
  drawnList: GameItem[];
  /** 섞는 중(공이 마구 튀는 애니메이션)인지. */
  active: boolean;
  /** 있으면 기계 옆에 빠른 추가 입력란을 보여준다(선생님 전용) — 입력하고 추가를 누르면
   * 공이 입력란에서 기계 유리 케이지 안으로 날아 들어가는 애니메이션이 재생된다. */
  onAdd?: (label: string) => void;
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

interface InFlyer {
  key: number;
  color: string;
  sx: number;
  sy: number;
  dx: number;
  dy: number;
}

const MACHINE_SRC = '/skins/lottery-machine.png?v=2';
/** 스킨에서 유리 케이지 안쪽. 값은 이미지 너비/높이 대비 비율. */
const HOLE = { cx: 0.5, cy: 0.42, r: 0.3 };
/** 앞쪽 나무 배출 홈. */
const CHUTE = { cx: 0.5, cy: 0.8 };
const BALL = 38;
export const LOTTERY_FLY_MS = 720;

function randomPos(): Pos {
  const ang = Math.random() * Math.PI * 2;
  const rad = Math.sqrt(Math.random()) * 34;
  return { left: 50 + Math.cos(ang) * rad, top: 50 + Math.sin(ang) * rad };
}

function ballFill(color: string): string {
  return `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.78), ${color} 46%, rgba(0,0,0,0.2) 100%)`;
}

function ballShadow(): string {
  return '0 5px 10px rgba(110,62,18,0.3), inset -3px -4px 7px rgba(0,0,0,0.18), inset 3px 3px 5px rgba(255,255,255,0.38)';
}

/**
 * 나무 빙고·로또 케이지 안에서 공이 튕기다가, "뽑기"를 누를 때마다 하나씩 홈으로 나와
 * 아래 로또 공 줄로 굴러간다. 뽑힌 것들은 계속 쌓이고, 케이지 안에는 아직 안 뽑힌
 * 나머지가 계속 남아 보인다.
 */
export default function LotteryMachine({ pool, drawnList, active, onAdd }: Props) {
  const { t } = useTranslation();
  const n = pool.length;
  const remaining = pool.filter((p) => !drawnList.some((d) => d.id === p.id));
  const ballsLeft = remaining.length;

  const [positions, setPositions] = useState<Pos[]>(() => Array.from({ length: n }, randomPos));
  const [displayedCount, setDisplayedCount] = useState(0);
  const [flyer, setFlyer] = useState<Flyer | null>(null);
  const [inFlyer, setInFlyer] = useState<InFlyer | null>(null);
  const [inputValue, setInputValue] = useState('');

  const wrapRef = useRef<HTMLDivElement>(null);
  const machineBoxRef = useRef<HTMLDivElement>(null);
  const chuteRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLen = useRef(drawnList.length);

  useEffect(() => {
    setPositions((prev) => {
      if (prev.length === n) return prev;
      return Array.from({ length: n }, (_, i) => prev[i] ?? randomPos());
    });
  }, [n]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setPositions((prev) => prev.map(() => randomPos()));
    }, 220);
    return () => clearInterval(id);
  }, [active]);

  // 공이 케이지 안에서 달그락거리는 효과음 — 배경음악(선생님이 고르는 설정)과 별개로,
  // 돌림판의 회전 딸깍음처럼 늘 켜져 있는 고정 효과음이다. 섞는 동안(active)만 반복
  // 재생하고, 섞기가 끝나면(active가 꺼지면) 그 자리에서 바로 멈춘다.
  useEffect(() => {
    if (!active) return;
    const audio = new Audio('/sounds/lottery-mix.wav?v=1');
    audio.loop = true;
    void audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [active]);

  useEffect(() => {
    if (drawnList.length === 0) {
      setDisplayedCount(0);
      setFlyer(null);
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    }
  }, [drawnList.length]);

  // drawnList 는 매 렌더마다 slice()로 새 배열이 만들어져서 참조가 늘 바뀐다 — 의존성 배열에
  // drawnList 를 그대로 넣으면 실제 개수가 안 바뀐 렌더에서도 effect가 재실행된다. 실제로는
  // "개수가 늘었는지"만 보면 되므로 length(원시값)로만 의존성을 건다. 측정은 requestAnimationFrame
  // 없이 effect 안에서 곧바로 한다 — useEffect는 이미 DOM이 커밋된 뒤에 실행되고, rAF로 한
  // 프레임 더 미루면 브라우저 탭이 백그라운드로 밀렸을 때(선생님이 잠깐 다른 창을 볼 때 등)
  // rAF 자체가 멈춰버려서 공개 애니메이션이 영영 안 끝나는 문제가 생긴다.
  useEffect(() => {
    if (drawnList.length <= prevLen.current) {
      prevLen.current = drawnList.length;
      return;
    }
    const i = drawnList.length - 1;
    prevLen.current = drawnList.length;
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
    const label = drawnList[i]?.label ?? '';
    setFlyer({
      key: Date.now(),
      index: i,
      label: label.length > 4 ? label.slice(0, 3) : label,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawnList.length]);

  function handleAdd() {
    const label = inputValue.trim();
    if (!label || !onAdd) return;
    const wrap = wrapRef.current?.getBoundingClientRect();
    const input = inputRef.current?.getBoundingClientRect();
    const box = machineBoxRef.current?.getBoundingClientRect();
    if (wrap && input && box) {
      const sx = input.left + input.width / 2 - wrap.left - BALL / 2;
      const sy = input.top + input.height / 2 - wrap.top - BALL / 2;
      const dx = box.left + box.width * HOLE.cx - wrap.left - BALL / 2;
      const dy = box.top + box.height * HOLE.cy - wrap.top - BALL / 2;
      if (inFlyTimerRef.current) clearTimeout(inFlyTimerRef.current);
      setInFlyer({ key: Date.now(), color: colorFor(pool.length), sx, sy, dx: dx - sx, dy: dy - sy });
      inFlyTimerRef.current = setTimeout(() => setInFlyer(null), 560);
    }
    onAdd(label);
    setInputValue('');
    inputRef.current?.focus();
  }

  const holeLeft = `${(HOLE.cx - HOLE.r) * 100}%`;
  const holeTop = `${(HOLE.cy - HOLE.r) * 100}%`;
  const holeSize = `${HOLE.r * 2 * 100}%`;
  const showBallLabel = ballsLeft <= 8;
  const resultSize = drawnList.length > 10 ? 62 : drawnList.length > 6 ? 70 : 78;

  return (
    <div
      ref={wrapRef}
      className={`relative flex w-full flex-col items-center ${onAdd ? 'md:flex-row md:items-start md:justify-center md:gap-8' : ''}`}
    >
      <div className="flex flex-col items-center">
        <div
          ref={machineBoxRef}
          className={`relative mb-1 w-[min(380px,90vw)] aspect-square ${active ? 'lottery-box-shake' : ''}`}
          style={{ filter: 'drop-shadow(0 16px 24px rgba(110, 62, 18, 0.24))' }}
        >
          <div
            className="absolute overflow-hidden rounded-full"
            style={{ left: holeLeft, top: holeTop, width: holeSize, height: holeSize }}
          >
            {remaining.map((item, i) => (
              <span
                key={item.id}
                className={`absolute flex items-center justify-center w-[38px] h-[38px] -ml-[19px] -mt-[19px] rounded-full text-[9px] font-bold text-white leading-none ${
                  active ? 'transition-[left,top] duration-[220ms] ease-[cubic-bezier(0.34,1.7,0.64,1)] lottery-ball-pulse' : ''
                }`}
                style={{
                  left: `${positions[i]?.left ?? 50}%`,
                  top: `${positions[i]?.top ?? 50}%`,
                  animationDelay: `${(i % 6) * 0.07}s`,
                  background: ballFill(colorFor(i)),
                  boxShadow: ballShadow(),
                }}
              >
                {showBallLabel ? item.label.slice(0, 3) : ''}
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

        {drawnList.length > 0 && (
          <div
            className="relative mx-auto mt-1 mb-4 w-fit max-w-[540px] rounded-[28px] px-3.5 py-3.5"
            style={{
              background: 'linear-gradient(180deg, #f7e4bc 0%, #e8c48a 58%, #d7ae6c 100%)',
              border: '3px solid #f0d7a8',
              boxShadow: '0 3px 0 #c4925c, 0 10px 16px rgba(110,62,18,0.14), inset 0 2px 0 rgba(255,255,255,0.4)',
            }}
          >
            <div className="flex flex-wrap justify-center gap-2.5">
              {drawnList.map((p, i) => {
                const revealed = i < displayedCount;
                return (
                  <div
                    key={p.id}
                    ref={(el) => {
                      slotRefs.current[i] = el;
                    }}
                    className={`relative flex items-center justify-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.3)] ${
                      revealed ? 'scale-100 opacity-100' : 'opacity-0 scale-75'
                    }`}
                    style={{
                      width: resultSize,
                      height: resultSize,
                      background: revealed ? ballFill(colorFor(i)) : 'transparent',
                      boxShadow: revealed ? ballShadow() : undefined,
                    }}
                  >
                    {revealed && (
                      <span className="absolute inset-[14%] text-white">
                        <GameFitText text={p.label} maxSize={22} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {onAdd && (
        <div className="flex w-full max-w-[300px] flex-col gap-2 md:w-[240px] md:pt-6">
          <div className="font-caption text-caption text-on-surface-variant">{t('gameOrder.quickAddLabel')}</div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              disabled={active}
              placeholder={t('gameOrder.quickAddPlaceholder')}
              className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={active || !inputValue.trim()}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('gameOrder.quickAddButton')}
            </button>
          </div>
        </div>
      )}

      {inFlyer && (
        <span
          key={inFlyer.key}
          className="lottery-insert-ball pointer-events-none absolute z-30 rounded-full"
          style={
            {
              left: inFlyer.sx,
              top: inFlyer.sy,
              width: BALL,
              height: BALL,
              '--dx': `${inFlyer.dx}px`,
              '--dy': `${inFlyer.dy}px`,
              background: ballFill(inFlyer.color),
              boxShadow: ballShadow(),
            } as CSSProperties
          }
        />
      )}

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
              boxShadow: ballShadow(),
            } as CSSProperties
          }
        >
          {flyer.label}
        </span>
      )}
    </div>
  );
}
