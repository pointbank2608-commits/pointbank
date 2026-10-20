import { gameClock } from '../lib/gameClock';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { isGameSoundOn } from '../lib/gameSfx';
import LotteryCabinet from './LotteryCabinet';
import type { GameItem } from '../lib/types';
import LotteryBall from './LotteryBall';

interface Props {
  /** 기계에 등록된 전체 항목. 아직 안 뽑힌 개수·라벨 계산에 쓴다. */
  pool: GameItem[];
  /** 지금까지 뽑힌 항목, 뽑힌 순서대로. 늘어날 때마다 맨 뒤 칸으로 공이 날아간다. */
  drawnList: GameItem[];
  /** 섞는 중(공이 마구 튀는 애니메이션)인지. */
  active: boolean;
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

const HOLE = { cx: 0.5, cy: 161 / 440, rx: 0.28, ry: 112 / 440 };
const CHUTE = { cx: 0.5, cy: 0.86 };
const BALL_COLORS = ['#f49eaa', '#8ccdb8', '#98c9ed', '#f2cf7d', '#b6a6df', '#efb48b'];
const ballColor = (index: number) => BALL_COLORS[index % BALL_COLORS.length];
const BALL = 38;
export const LOTTERY_FLY_MS = 720;

function randomPos(): Pos {
  const ang = Math.random() * Math.PI * 2;
  const rad = Math.sqrt(Math.random()) * 34;
  return { left: 50 + Math.cos(ang) * rad, top: 50 + Math.sin(ang) * rad };
}

/**
 * 유리 추첨기 안에서 공이 튕기다가, "뽑기"를 누를 때마다 하나씩 홈으로 나와
 * 아래 로또 공 줄로 굴러간다. 뽑힌 것들은 계속 쌓이고, 케이지 안에는 아직 안 뽑힌
 * 나머지가 계속 남아 보인다.
 */
export default function LotteryMachine({ pool, drawnList, active }: Props) {
  const n = pool.length;
  const remaining = pool.filter((p) => !drawnList.some((d) => d.id === p.id));
  const ballsLeft = remaining.length;

  const [positions, setPositions] = useState<Pos[]>(() => Array.from({ length: n }, randomPos));
  const [displayedCount, setDisplayedCount] = useState(0);
  const [flyer, setFlyer] = useState<Flyer | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const chuteRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flyTimerRef = useRef<ReturnType<typeof gameClock.setTimeout> | null>(null);
  const prevLen = useRef(drawnList.length);

  useEffect(() => {
    setPositions((prev) => {
      if (prev.length === n) return prev;
      return Array.from({ length: n }, (_, i) => prev[i] ?? randomPos());
    });
  }, [n]);

  useEffect(() => {
    if (!active) return;
    const id = gameClock.setInterval(() => {
      setPositions((prev) => prev.map(() => randomPos()));
    }, 220);
    return () => gameClock.clearInterval(id);
  }, [active]);

  // 공이 케이지 안에서 달그락거리는 효과음 — 배경음악(선생님이 고르는 설정)과 별개로,
  // 돌림판의 회전 딸깍음처럼 늘 켜져 있는 고정 효과음이다. 섞는 동안(active)만 반복
  // 재생하고, 섞기가 끝나면(active가 꺼지면) 그 자리에서 바로 멈춘다.
  useEffect(() => {
    if (!active || !isGameSoundOn()) return;
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
      if (flyTimerRef.current) gameClock.clearTimeout(flyTimerRef.current);
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
    const scale = wrap.width / (wrapRef.current?.offsetWidth || wrap.width);
    const sx = (chute.left + chute.width / 2 - wrap.left) / scale - BALL / 2;
    const sy = (chute.top + chute.height / 2 - wrap.top) / scale - BALL / 2;
    const ex = (slot.left + slot.width / 2 - wrap.left) / scale - BALL / 2;
    const ey = (slot.top + slot.height / 2 - wrap.top) / scale - BALL / 2;
    const label = drawnList[i]?.label ?? '';
    setFlyer({
      key: gameClock.dateNow(),
      index: i,
      label: label.length > 4 ? label.slice(0, 3) : label,
      color: ballColor(i),
      sx,
      sy,
      dx: ex - sx,
      dy: ey - sy,
    });
    if (flyTimerRef.current) gameClock.clearTimeout(flyTimerRef.current);
    flyTimerRef.current = gameClock.setTimeout(() => {
      setDisplayedCount(i + 1);
      setFlyer(null);
    }, LOTTERY_FLY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawnList.length]);

  const holeLeft = `${(HOLE.cx - HOLE.rx) * 100}%`;
  const holeTop = `${(HOLE.cy - HOLE.ry) * 100}%`;
  const holeWidth = `${HOLE.rx * 2 * 100}%`;
  const holeHeight = `${HOLE.ry * 2 * 100}%`;
  const showBallLabel = ballsLeft <= 8;
  const resultSize = drawnList.length > 10 ? 62 : drawnList.length >= 6 ? 70 : 78;

  return (
    <div
      ref={wrapRef}
      className="relative flex w-full flex-col items-center" data-lottery-machine
    >
      <div className="flex flex-col items-center">
        <div
          className={`relative mb-1 w-[min(380px,82vw)] aspect-[10/11] ${active ? 'lottery-box-shake' : ''}`}
        >
          <LotteryCabinet />
          <div
            className="absolute overflow-hidden rounded-full" data-lottery-pool aria-hidden="true"
            style={{ left: holeLeft, top: holeTop, width: holeWidth, height: holeHeight }}
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
                }}
              >
                <LotteryBall color={ballColor(i)} label={showBallLabel ? item.label.slice(0, 3) : undefined} compact />
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-0 z-10"><LotteryCabinet front /></div>
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
              background: '#fff9ed',
              border: '2px solid #e1d4bb',
              boxShadow: '0 4px 0 #d5c5a4, 0 8px 20px #526c6514',
            }}
          >
            <div className="flex flex-wrap justify-center gap-2.5">
              {drawnList.map((p, i) => {
                const revealed = i < displayedCount;
                return (
                  <div
                    data-lottery-result={revealed ? p.label : undefined}
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
                    }}
                  >
                    {revealed && <LotteryBall color={ballColor(i)} label={p.label} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
            } as CSSProperties
          }
        >
          <LotteryBall color={flyer.color} label={flyer.label} compact />
        </span>
      )}
    </div>
  );
}
