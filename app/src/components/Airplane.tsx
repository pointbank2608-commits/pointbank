import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

interface Bubble {
  id: string;
  label: string;
  x: number;
  y: number;
  correct: boolean;
}

const PLAYER_X = 12;
const PLAYER_R = 4.5;
const BUBBLE_R = 7.5;
const PLAYER_SPEED = 55;
const BUBBLE_SPEED = 24;
const SPAWN_X = [104, 128, 152, 176];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function circlesOverlap(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy < (r1 + r2) * (r1 + r2);
}

function spawnBubbles(target: GameItem, decoyPool: GameItem[]): Bubble[] {
  const decoys = shuffle(decoyPool.filter((d) => d.id !== target.id)).slice(0, 3);
  const words = shuffle([target, ...decoys]);
  return words.map((w, i) => ({
    id: w.id,
    label: w.label,
    x: SPAWN_X[i % SPAWN_X.length],
    y: rand(12, 88),
    correct: w.id === target.id,
  }));
}

export default function Airplane({ items }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState(0);
  const [, setTick] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);

  const playerYRef = useRef(50);
  const keysRef = useRef({ up: false, down: false });
  const bubblesRef = useRef<Bubble[]>([]);
  const roundOverRef = useRef(false);

  useEffect(() => {
    if (pos >= order.length) return;
    bubblesRef.current = spawnBubbles(items[order[pos]], items);
    playerYRef.current = 50;
    roundOverRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, order]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowUp' || e.key === 'w') keysRef.current.up = true;
      if (e.key === 'ArrowDown' || e.key === 's') keysRef.current.down = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'ArrowUp' || e.key === 'w') keysRef.current.up = false;
      if (e.key === 'ArrowDown' || e.key === 's') keysRef.current.down = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    let raf = 0;
    let lastTime = performance.now();

    function loop(now: number) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (!roundOverRef.current) {
        const k = keysRef.current;
        const dy = ((k.down ? 1 : 0) - (k.up ? 1 : 0)) * PLAYER_SPEED * dt;
        playerYRef.current = clamp(playerYRef.current + dy, PLAYER_R, 100 - PLAYER_R);

        for (const b of bubblesRef.current) {
          b.x -= BUBBLE_SPEED * dt;
          if (b.x < -10) {
            b.x = rand(104, 176);
            b.y = rand(12, 88);
          }
        }

        for (const b of bubblesRef.current) {
          if (circlesOverlap(PLAYER_X, playerYRef.current, PLAYER_R, b.x, b.y, BUBBLE_R)) {
            if (b.correct) {
              roundOverRef.current = true;
              setScore((s) => s + 1);
              window.setTimeout(() => {
                setPos((p) => p + 1);
              }, 450);
            } else {
              b.x = rand(140, 190);
              b.y = rand(12, 88);
              setWrongFlash(true);
              window.setTimeout(() => setWrongFlash(false), 250);
            }
            break;
          }
        }
      }

      setTick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (items.length < 2) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">✈️</div>
        <div className="font-body-md text-body-md">{t('gameAirplane.needParticipants')}</div>
      </div>
    );
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(items.map((_, i) => i)));
    setPos(0);
    setScore(0);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🏆</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameAirplane.finishedTitle')}</div>
        <div className="font-display-lg text-[40px] text-deep-navy mb-6 tabular-nums">
          {t('gameAirplane.scoreLabel', { score, total: order.length })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameAirplane.restartButton')}
        </button>
      </div>
    );
  }

  const target = items[order[pos]];

  function dpadDown(dir: 'up' | 'down') {
    keysRef.current[dir] = true;
  }
  function dpadUp(dir: 'up' | 'down') {
    keysRef.current[dir] = false;
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2 w-full">
      <div className="flex items-center gap-3 mb-3">
        <div className="font-caption text-caption text-on-surface-variant tabular-nums">
          {pos + 1} / {order.length}
        </div>
        <div className="font-title-md text-title-md text-deep-navy">{t('gameAirplane.targetLabel', { word: target.label })}</div>
      </div>

      <div
        className={`relative w-full max-w-[460px] aspect-[4/3] rounded-2xl overflow-hidden border-2 mb-4 transition-colors ${
          wrongFlash ? 'border-error/60 bg-error-container/20' : 'border-outline-variant/40 bg-gradient-to-r from-sky-100 to-surface-container-low'
        }`}
      >
        {bubblesRef.current.map((b) => (
          <div
            key={b.id}
            className="absolute flex items-center justify-center rounded-full bg-surface-container-lowest border-2 border-primary/50 shadow-sm font-label-md text-[10px] sm:text-xs text-on-surface text-center px-1"
            style={{
              left: `${b.x - BUBBLE_R}%`,
              top: `${b.y - BUBBLE_R}%`,
              width: `${BUBBLE_R * 2}%`,
              height: `${BUBBLE_R * 2}%`,
            }}
          >
            {b.label}
          </div>
        ))}

        <div
          className="absolute flex items-center justify-center rounded-full bg-primary text-on-primary text-lg shadow-md transition-none"
          style={{
            left: `${PLAYER_X - PLAYER_R}%`,
            top: `${playerYRef.current - PLAYER_R}%`,
            width: `${PLAYER_R * 2}%`,
            height: `${PLAYER_R * 2}%`,
          }}
        >
          ✈️
        </div>
      </div>

      <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameAirplane.controlsHint')}</div>
      <div className="flex flex-col gap-1 w-[64px] select-none">
        <button
          type="button"
          onPointerDown={() => dpadDown('up')}
          onPointerUp={() => dpadUp('up')}
          onPointerLeave={() => dpadUp('up')}
          className="aspect-square rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center text-lg active:bg-primary-container"
        >
          ▲
        </button>
        <button
          type="button"
          onPointerDown={() => dpadDown('down')}
          onPointerUp={() => dpadUp('down')}
          onPointerLeave={() => dpadUp('down')}
          className="aspect-square rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center text-lg active:bg-primary-container"
        >
          ▼
        </button>
      </div>
    </div>
  );
}
