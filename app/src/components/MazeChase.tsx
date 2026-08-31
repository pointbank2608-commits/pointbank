import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

interface Vec {
  x: number;
  y: number;
}

interface Obstacle {
  x: number;
  y: number;
  r: number;
}

interface Bubble {
  id: string;
  label: string;
  x: number;
  y: number;
  correct: boolean;
}

const PLAYER_R = 4.5;
const ENEMY_R = 4.5;
const BUBBLE_R = 7.5;
const PLAYER_SPEED = 46;
const ENEMY_SPEED = 27;
const START_POS: Vec = { x: 10, y: 50 };

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

function tryMove(pos: Vec, dx: number, dy: number, obstacles: Obstacle[], selfR: number) {
  const nx = clamp(pos.x + dx, selfR, 100 - selfR);
  if (!obstacles.some((o) => circlesOverlap(nx, pos.y, selfR, o.x, o.y, o.r))) pos.x = nx;
  const ny = clamp(pos.y + dy, selfR, 100 - selfR);
  if (!obstacles.some((o) => circlesOverlap(pos.x, ny, selfR, o.x, o.y, o.r))) pos.y = ny;
}

function generateObstacles(): Obstacle[] {
  const count = 2 + Math.floor(Math.random() * 2);
  const obstacles: Obstacle[] = [];
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    let tries = 0;
    do {
      x = rand(30, 80);
      y = rand(15, 85);
      tries++;
    } while (tries < 20 && Math.hypot(x - START_POS.x, y - START_POS.y) < 25);
    obstacles.push({ x, y, r: rand(8, 12) });
  }
  return obstacles;
}

function placeBubbles(target: GameItem, decoyPool: GameItem[], obstacles: Obstacle[]): Bubble[] {
  const decoys = shuffle(decoyPool.filter((d) => d.id !== target.id)).slice(0, 3);
  const words = shuffle([target, ...decoys]);
  const bubbles: Bubble[] = [];
  for (const w of words) {
    let x = 0;
    let y = 0;
    let tries = 0;
    do {
      x = rand(20, 92);
      y = rand(10, 90);
      tries++;
    } while (
      tries < 30 &&
      (obstacles.some((o) => circlesOverlap(x, y, BUBBLE_R, o.x, o.y, o.r)) ||
        bubbles.some((b) => Math.hypot(b.x - x, b.y - y) < BUBBLE_R * 2.3) ||
        Math.hypot(x - START_POS.x, y - START_POS.y) < 18)
    );
    bubbles.push({ id: w.id, label: w.label, x, y, correct: w.id === target.id });
  }
  return bubbles;
}

export default function MazeChase({ items }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState(0);
  const [, setTick] = useState(0);
  const [caughtFlash, setCaughtFlash] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);

  const playerRef = useRef<Vec>({ ...START_POS });
  const enemyRef = useRef<Vec>({ x: 92, y: 15 });
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const bubblesRef = useRef<Bubble[]>([]);
  const roundOverRef = useRef(false);

  useEffect(() => {
    if (pos >= order.length) return;
    obstaclesRef.current = generateObstacles();
    bubblesRef.current = placeBubbles(items[order[pos]], items, obstaclesRef.current);
    playerRef.current = { ...START_POS };
    enemyRef.current = { x: 92, y: 15 };
    roundOverRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, order]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowUp' || e.key === 'w') keysRef.current.up = true;
      if (e.key === 'ArrowDown' || e.key === 's') keysRef.current.down = true;
      if (e.key === 'ArrowLeft' || e.key === 'a') keysRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') keysRef.current.right = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'ArrowUp' || e.key === 'w') keysRef.current.up = false;
      if (e.key === 'ArrowDown' || e.key === 's') keysRef.current.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a') keysRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') keysRef.current.right = false;
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
        let dx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        let dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
        const len = Math.hypot(dx, dy) || 1;
        dx = (dx / len) * PLAYER_SPEED * dt;
        dy = (dy / len) * PLAYER_SPEED * dt;
        if (dx !== 0 || dy !== 0) tryMove(playerRef.current, dx, dy, obstaclesRef.current, PLAYER_R);

        const edx = playerRef.current.x - enemyRef.current.x;
        const edy = playerRef.current.y - enemyRef.current.y;
        const edist = Math.hypot(edx, edy) || 1;
        tryMove(
          enemyRef.current,
          (edx / edist) * ENEMY_SPEED * dt,
          (edy / edist) * ENEMY_SPEED * dt,
          obstaclesRef.current,
          ENEMY_R,
        );

        if (circlesOverlap(playerRef.current.x, playerRef.current.y, PLAYER_R, enemyRef.current.x, enemyRef.current.y, ENEMY_R)) {
          playerRef.current = { ...START_POS };
          setCaughtFlash(true);
          window.setTimeout(() => setCaughtFlash(false), 350);
        }

        for (const b of bubblesRef.current) {
          if (circlesOverlap(playerRef.current.x, playerRef.current.y, PLAYER_R, b.x, b.y, BUBBLE_R)) {
            if (b.correct) {
              roundOverRef.current = true;
              setScore((s) => s + 1);
              window.setTimeout(() => {
                setPos((p) => p + 1);
              }, 450);
            } else {
              const pdx = playerRef.current.x - b.x;
              const pdy = playerRef.current.y - b.y;
              const pdist = Math.hypot(pdx, pdy) || 1;
              playerRef.current.x = clamp(playerRef.current.x + (pdx / pdist) * 10, PLAYER_R, 100 - PLAYER_R);
              playerRef.current.y = clamp(playerRef.current.y + (pdy / pdist) * 10, PLAYER_R, 100 - PLAYER_R);
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
        <div className="text-4xl mb-2">🏃</div>
        <div className="font-body-md text-body-md">{t('gameMazeChase.needParticipants')}</div>
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
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameMazeChase.finishedTitle')}</div>
        <div className="font-display-lg text-[40px] text-deep-navy mb-6 tabular-nums">
          {t('gameMazeChase.scoreLabel', { score, total: order.length })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameMazeChase.restartButton')}
        </button>
      </div>
    );
  }

  const target = items[order[pos]];

  function dpadDown(dir: 'up' | 'down' | 'left' | 'right') {
    keysRef.current[dir] = true;
  }
  function dpadUp(dir: 'up' | 'down' | 'left' | 'right') {
    keysRef.current[dir] = false;
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2 w-full">
      <div className="flex items-center gap-3 mb-3">
        <div className="font-caption text-caption text-on-surface-variant tabular-nums">
          {pos + 1} / {order.length}
        </div>
        <div className="font-title-md text-title-md text-deep-navy">{t('gameMazeChase.targetLabel', { word: target.label })}</div>
      </div>

      <div
        className={`relative w-full max-w-[420px] aspect-[4/3] rounded-2xl overflow-hidden border-2 mb-4 transition-colors ${
          caughtFlash ? 'border-error bg-error-container/30' : wrongFlash ? 'border-error/60 bg-surface-container-low' : 'border-outline-variant/40 bg-surface-container-low'
        }`}
      >
        {obstaclesRef.current.map((o, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-outline-variant/50"
            style={{
              left: `${o.x - o.r}%`,
              top: `${o.y - o.r}%`,
              width: `${o.r * 2}%`,
              height: `${o.r * 2}%`,
            }}
          />
        ))}

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
            left: `${playerRef.current.x - PLAYER_R}%`,
            top: `${playerRef.current.y - PLAYER_R}%`,
            width: `${PLAYER_R * 2}%`,
            height: `${PLAYER_R * 2}%`,
          }}
        >
          🐹
        </div>

        <div
          className="absolute flex items-center justify-center rounded-full bg-error text-on-error text-lg shadow-md transition-none"
          style={{
            left: `${enemyRef.current.x - ENEMY_R}%`,
            top: `${enemyRef.current.y - ENEMY_R}%`,
            width: `${ENEMY_R * 2}%`,
            height: `${ENEMY_R * 2}%`,
          }}
        >
          👻
        </div>
      </div>

      <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameMazeChase.controlsHint')}</div>
      <div className="grid grid-cols-3 gap-1 w-[150px] select-none">
        <div />
        <button
          type="button"
          onPointerDown={() => dpadDown('up')}
          onPointerUp={() => dpadUp('up')}
          onPointerLeave={() => dpadUp('up')}
          className="aspect-square rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center text-lg active:bg-primary-container"
        >
          ▲
        </button>
        <div />
        <button
          type="button"
          onPointerDown={() => dpadDown('left')}
          onPointerUp={() => dpadUp('left')}
          onPointerLeave={() => dpadUp('left')}
          className="aspect-square rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center text-lg active:bg-primary-container"
        >
          ◀
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
        <button
          type="button"
          onPointerDown={() => dpadDown('right')}
          onPointerUp={() => dpadUp('right')}
          onPointerLeave={() => dpadUp('right')}
          className="aspect-square rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center text-lg active:bg-primary-container"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
