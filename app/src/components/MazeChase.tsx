import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

export type MazeChaseStyle = 'wood' | 'garden';

interface Props {
  items: GameItem[];
  boardStyle?: MazeChaseStyle;
}

interface Vec {
  x: number;
  y: number;
}

interface Cell {
  c: number;
  r: number;
}

interface Bubble {
  id: string;
  label: string;
  x: number;
  y: number;
  correct: boolean;
}

type WallGrid = boolean[][];

const COLS = 17;
const ROWS = 13;
const PLAYER_R = 0.36;
const ENEMY_R = 0.36;
const CHIP_W = 2.55;
const CHIP_H = 1.28;
const PLAYER_SPEED = 4.6;
const ENEMY_SPEED = 2.2;
const N4: Cell[] = [
  { c: 1, r: 0 },
  { c: -1, r: 0 },
  { c: 0, r: 1 },
  { c: 0, r: -1 },
];

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';
const pill =
  'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function inBounds(c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < COLS && r < ROWS;
}

function circlesOverlap(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy < (r1 + r2) * (r1 + r2);
}

function keyOf(c: number, r: number): string {
  return `${c},${r}`;
}

function blocked(wall: WallGrid, x: number, y: number, rad: number): boolean {
  const x0 = Math.floor(x - rad);
  const x1 = Math.floor(x + rad - 1e-6);
  const y0 = Math.floor(y - rad);
  const y1 = Math.floor(y + rad - 1e-6);
  for (let r = y0; r <= y1; r++) {
    for (let c = x0; c <= x1; c++) {
      if (!inBounds(c, r) || wall[r][c]) return true;
    }
  }
  return false;
}

function tryMove(pos: Vec, dx: number, dy: number, wall: WallGrid, rad: number) {
  const nx = pos.x + dx;
  if (!blocked(wall, nx, pos.y, rad)) pos.x = nx;
  const ny = pos.y + dy;
  if (!blocked(wall, pos.x, ny, rad)) pos.y = ny;
}

function canCarve(wall: WallGrid, c: number, r: number): boolean {
  return c > 0 && r > 0 && c < COLS - 1 && r < ROWS - 1 && wall[r][c];
}

function generateMaze(): WallGrid {
  const wall: WallGrid = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1),
  );

  function divide(x1: number, y1: number, x2: number, y2: number) {
    const w = x2 - x1 + 1;
    const h = y2 - y1 + 1;
    if (w <= 3 && h <= 3) return;
    const splitH = h >= 3 && (h > w || w < 3 || (h === w && Math.random() < 0.5));
    if (splitH && h >= 3) {
      const wy = y1 + 1 + Math.floor(Math.random() * Math.max(1, h - 2));
      const gap = x1 + Math.floor(Math.random() * w);
      for (let x = x1; x <= x2; x++) {
        if (x !== gap) wall[wy][x] = true;
      }
      if (wy - 1 >= y1) divide(x1, y1, x2, wy - 1);
      if (wy + 1 <= y2) divide(x1, wy + 1, x2, y2);
      return;
    }
    if (w >= 3) {
      const wx = x1 + 1 + Math.floor(Math.random() * Math.max(1, w - 2));
      const gap = y1 + Math.floor(Math.random() * h);
      for (let y = y1; y <= y2; y++) {
        if (y !== gap) wall[y][wx] = true;
      }
      if (wx - 1 >= x1) divide(x1, y1, wx - 1, y2);
      if (wx + 1 <= x2) divide(wx + 1, y1, x2, y2);
    }
  }

  divide(1, 1, COLS - 2, ROWS - 2);
  ensureConnected(wall);
  return wall;
}

function ensureConnected(wall: WallGrid) {
  const first = pathCells(wall)[0];
  if (!first) return;

  function reachableFrom(from: Cell): Set<string> {
    const seen = new Set<string>([keyOf(from.c, from.r)]);
    const q = [from];
    for (let i = 0; i < q.length; i++) {
      const cur = q[i];
      for (const d of N4) {
        const nc = cur.c + d.c;
        const nr = cur.r + d.r;
        const k = keyOf(nc, nr);
        if (!inBounds(nc, nr) || wall[nr][nc] || seen.has(k)) continue;
        seen.add(k);
        q.push({ c: nc, r: nr });
      }
    }
    return seen;
  }

  let seen = reachableFrom(first);
  for (let guard = 0; guard < 80; guard++) {
    const cells = pathCells(wall);
    const orphan = cells.find((cell) => !seen.has(keyOf(cell.c, cell.r)));
    if (!orphan) break;

    let opened = false;
    for (const a of cells) {
      if (!seen.has(keyOf(a.c, a.r))) continue;
      if (a.c === orphan.c && Math.abs(a.r - orphan.r) === 2) {
        wall[(a.r + orphan.r) / 2][a.c] = false;
        opened = true;
        break;
      }
      if (a.r === orphan.r && Math.abs(a.c - orphan.c) === 2) {
        wall[a.r][(a.c + orphan.c) / 2] = false;
        opened = true;
        break;
      }
    }
    if (!opened) {
      for (const d of N4) {
        const nc = orphan.c + d.c;
        const nr = orphan.r + d.r;
        if (nc > 0 && nr > 0 && nc < COLS - 1 && nr < ROWS - 1 && wall[nr][nc]) {
          wall[nr][nc] = false;
          opened = true;
          break;
        }
      }
    }
    if (!opened) break;
    seen = reachableFrom(first);
  }
}

function pathCells(wall: WallGrid): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!wall[r][c]) cells.push({ c, r });
    }
  }
  return cells;
}

function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
}

function farthestFrom(wall: WallGrid, start: Cell): Cell {
  const q: Cell[] = [start];
  const dist = new Map<string, number>([[keyOf(start.c, start.r), 0]]);
  let best = start;
  let bestD = 0;
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    const d0 = dist.get(keyOf(cur.c, cur.r)) ?? 0;
    if (d0 > bestD) {
      bestD = d0;
      best = cur;
    }
    for (const d of N4) {
      const nc = cur.c + d.c;
      const nr = cur.r + d.r;
      const k = keyOf(nc, nr);
      if (!inBounds(nc, nr) || wall[nr][nc] || dist.has(k)) continue;
      dist.set(k, d0 + 1);
      q.push({ c: nc, r: nr });
    }
  }
  return best;
}

function bfsNext(wall: WallGrid, from: Vec, to: Vec): Vec | null {
  const sc = Math.max(0, Math.min(COLS - 1, Math.floor(from.x)));
  const sr = Math.max(0, Math.min(ROWS - 1, Math.floor(from.y)));
  const tc = Math.max(0, Math.min(COLS - 1, Math.floor(to.x)));
  const tr = Math.max(0, Math.min(ROWS - 1, Math.floor(to.y)));
  if (wall[sr][sc] || wall[tr][tc]) return null;
  if (sc === tc && sr === tr) return to;

  const q: Cell[] = [{ c: sc, r: sr }];
  const prev = new Map<string, string | null>();
  prev.set(keyOf(sc, sr), null);

  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    if (cur.c === tc && cur.r === tr) break;
    for (const d of N4) {
      const nc = cur.c + d.c;
      const nr = cur.r + d.r;
      const k = keyOf(nc, nr);
      if (!inBounds(nc, nr) || wall[nr][nc] || prev.has(k)) continue;
      prev.set(k, keyOf(cur.c, cur.r));
      q.push({ c: nc, r: nr });
    }
  }

  const targetKey = keyOf(tc, tr);
  if (!prev.has(targetKey)) return null;

  let cur = targetKey;
  const startKey = keyOf(sc, sr);
  while (prev.get(cur) && prev.get(cur) !== startKey) {
    cur = prev.get(cur)!;
  }
  const [nc, nr] = cur.split(',').map(Number);
  return { x: nc + 0.5, y: nr + 0.5 };
}

function pathNeighborCount(wall: WallGrid, cell: Cell): number {
  let n = 0;
  for (const d of N4) {
    const nc = cell.c + d.c;
    const nr = cell.r + d.r;
    if (inBounds(nc, nr) && !wall[nr][nc]) n += 1;
  }
  return n;
}

function carvePockets(wall: WallGrid, start: Cell, count: number): Vec[] {
  const spots: Vec[] = [];
  const sides: Cell[] = [
    { c: 1, r: 0 },
    { c: -1, r: 0 },
    { c: 0, r: 1 },
    { c: 0, r: -1 },
  ];
  const doors = shuffle(pathCells(wall)).filter((cell) => manhattan(cell, start) >= 3);

  for (const door of doors) {
    if (spots.length >= count) break;
    dirLoop: for (const dir of shuffle(N4)) {
      const mid = { c: door.c + dir.c, r: door.r + dir.r };
      const back = { c: door.c + dir.c * 2, r: door.r + dir.r * 2 };
      if (!canCarve(wall, mid.c, mid.r) || !canCarve(wall, back.c, back.r)) continue;
      if (pathNeighborCount(wall, mid) !== 1 || pathNeighborCount(wall, back) !== 0) continue;

      for (const side of sides) {
        if (side.c === dir.c && side.r === dir.r) continue;
        if (side.c === -dir.c && side.r === -dir.r) continue;
        const mid2 = { c: mid.c + side.c, r: mid.r + side.r };
        const back2 = { c: back.c + side.c, r: back.r + side.r };
        if (!canCarve(wall, mid2.c, mid2.r) || !canCarve(wall, back2.c, back2.r)) continue;
        if (pathNeighborCount(wall, mid2) !== 0 || pathNeighborCount(wall, back2) !== 0) continue;

        const center = { x: back.c + 0.5 + side.c * 0.5, y: back.r + 0.5 + side.r * 0.5 };
        if (spots.some((s) => Math.hypot(s.x - center.x, s.y - center.y) < 3.5)) continue;

        wall[mid.r][mid.c] = false;
        wall[back.r][back.c] = false;
        wall[mid2.r][mid2.c] = false;
        wall[back2.r][back2.c] = false;
        spots.push(center);
        break dirLoop;
      }
    }
  }

  if (spots.length < count) {
    const deadEnds = shuffle(
      pathCells(wall).filter((cell) => pathNeighborCount(wall, cell) === 1 && manhattan(cell, start) >= 3),
    );
    for (const cell of deadEnds) {
      if (spots.length >= count) break;
      const center = { x: cell.c + 0.5, y: cell.r + 0.5 };
      if (spots.some((s) => Math.hypot(s.x - center.x, s.y - center.y) < 3.5)) continue;
      spots.push(center);
    }
  }

  return spots;
}

function hitsChip(px: number, py: number, b: Bubble): boolean {
  return Math.abs(px - b.x) < PLAYER_R + CHIP_W * 0.28 && Math.abs(py - b.y) < PLAYER_R + CHIP_H * 0.32;
}

interface RoundLayout {
  wall: WallGrid;
  bubbles: Bubble[];
  start: Vec;
  enemy: Vec;
  startCell: Cell;
}

function buildRound(target: GameItem, pool: GameItem[]): RoundLayout {
  const wall = generateMaze();
  const cells = pathCells(wall);
  const midR = Math.floor(ROWS / 2);
  let startCell = cells[0] ?? { c: 1, r: 1 };
  let best = Infinity;
  for (const cell of cells) {
    const d = Math.abs(cell.c - 1) * 3 + Math.abs(cell.r - midR);
    if (d < best) {
      best = d;
      startCell = cell;
    }
  }

  const decoys = shuffle(pool.filter((d) => d.id !== target.id)).slice(0, 3);
  const words = shuffle([target, ...decoys]);
  const pockets = carvePockets(wall, startCell, words.length);

  const bubbles: Bubble[] = words.map((w, i) => {
    const center = pockets[i] ?? { x: startCell.c + 4.5, y: startCell.r + 0.5 };
    return {
      id: w.id,
      label: w.label,
      x: center.x,
      y: center.y,
      correct: w.id === target.id,
    };
  });

  const enemyCell = farthestFrom(wall, startCell);

  return {
    wall,
    bubbles,
    start: { x: startCell.c + 0.5, y: startCell.r + 0.5 },
    enemy: { x: enemyCell.c + 0.5, y: enemyCell.r + 0.5 },
    startCell,
  };
}

function pctBox(x: number, y: number, rad: number) {
  return {
    left: `${((x - rad) / COLS) * 100}%`,
    top: `${((y - rad) / ROWS) * 100}%`,
    width: `${((rad * 2) / COLS) * 100}%`,
    height: `${((rad * 2) / ROWS) * 100}%`,
  };
}

function pctChip(x: number, y: number) {
  return {
    left: `${((x - CHIP_W / 2) / COLS) * 100}%`,
    top: `${((y - CHIP_H / 2) / ROWS) * 100}%`,
    width: `${(CHIP_W / COLS) * 100}%`,
    height: `${(CHIP_H / ROWS) * 100}%`,
  };
}

function isEditorTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function escapeChip(pos: Vec, bubble: Bubble, wall: WallGrid) {
  const pdx = pos.x - bubble.x;
  const pdy = pos.y - bubble.y;
  const pdist = Math.hypot(pdx, pdy) || 1;
  tryMove(pos, (pdx / pdist) * 0.85, (pdy / pdist) * 0.85, wall, PLAYER_R);
  if (!hitsChip(pos.x, pos.y, bubble)) return;
  for (const d of N4) {
    const probe = { ...pos };
    tryMove(probe, d.c * 1.2, d.r * 1.2, wall, PLAYER_R);
    if (!hitsChip(probe.x, probe.y, bubble)) {
      pos.x = probe.x;
      pos.y = probe.y;
      return;
    }
  }
}

export default function MazeChase({ items, boardStyle = 'wood' }: Props) {
  const { t } = useTranslation();
  const garden = boardStyle === 'garden';
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState(0);
  const [, setTick] = useState(0);
  const [caughtFlash, setCaughtFlash] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const itemKey = items.map((it) => it.id).join(',');

  const playerRef = useRef<Vec>({ x: 1.5, y: 5.5 });
  const enemyRef = useRef<Vec>({ x: 13.5, y: 1.5 });
  const startRef = useRef<Vec>({ x: 1.5, y: 5.5 });
  const enemySpawnRef = useRef<Vec>({ x: 13.5, y: 1.5 });
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const wallRef = useRef<WallGrid>([]);
  const bubblesRef = useRef<Bubble[]>([]);
  const roundOverRef = useRef(false);
  const playingRef = useRef(false);
  const immuneUntilRef = useRef(0);
  const flashTimers = useRef<number[]>([]);

  const layout = useMemo(() => {
    if (items.length < 2 || pos >= order.length) return null;
    const target = items[order[pos]];
    if (!target) return null;
    return buildRound(target, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, pos, order]);

  function clearFlashes() {
    flashTimers.current.forEach((id) => window.clearTimeout(id));
    flashTimers.current = [];
    setCaughtFlash(false);
    setWrongFlash(false);
  }

  useEffect(() => {
    clearFlashes();
    setOrder(shuffle(items.map((_, i) => i)));
    setPos(0);
    setScore(0);
    return clearFlashes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  const layoutSync = useRef<RoundLayout | null>(null);
  if (layout !== layoutSync.current) {
    layoutSync.current = layout;
    if (layout) {
      wallRef.current = layout.wall;
      bubblesRef.current = layout.bubbles;
      startRef.current = { ...layout.start };
      enemySpawnRef.current = { ...layout.enemy };
      playerRef.current = { ...layout.start };
      enemyRef.current = { ...layout.enemy };
      roundOverRef.current = false;
      playingRef.current = true;
      immuneUntilRef.current = performance.now() + 700;
    } else {
      playingRef.current = false;
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditorTarget(e.target)) return;
      const map: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up',
        w: 'up',
        W: 'up',
        ArrowDown: 'down',
        s: 'down',
        S: 'down',
        ArrowLeft: 'left',
        a: 'left',
        A: 'left',
        ArrowRight: 'right',
        d: 'right',
        D: 'right',
      };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      keysRef.current[dir] = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keysRef.current.up = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keysRef.current.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = false;
    }
    function clearKeys() {
      keysRef.current = { up: false, down: false, left: false, right: false };
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
    };
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    let raf = 0;
    let lastTime = performance.now();

    function loop(now: number) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const wall = wallRef.current;

      if (playingRef.current && !roundOverRef.current && wall.length) {
        const k = keysRef.current;
        let dx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        let dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
        const len = Math.hypot(dx, dy) || 1;
        dx = (dx / len) * PLAYER_SPEED * dt;
        dy = (dy / len) * PLAYER_SPEED * dt;
        if (dx !== 0 || dy !== 0) tryMove(playerRef.current, dx, dy, wall, PLAYER_R);

        const waypoint =
          performance.now() > immuneUntilRef.current
            ? bfsNext(wall, enemyRef.current, playerRef.current)
            : null;
        if (waypoint) {
          const edx = waypoint.x - enemyRef.current.x;
          const edy = waypoint.y - enemyRef.current.y;
          const edist = Math.hypot(edx, edy) || 1;
          const step = ENEMY_SPEED * dt;
          if (step >= edist) {
            enemyRef.current.x = waypoint.x;
            enemyRef.current.y = waypoint.y;
          } else {
            tryMove(enemyRef.current, (edx / edist) * step, (edy / edist) * step, wall, ENEMY_R);
          }
        }

        if (
          performance.now() > immuneUntilRef.current &&
          circlesOverlap(
            playerRef.current.x,
            playerRef.current.y,
            PLAYER_R,
            enemyRef.current.x,
            enemyRef.current.y,
            ENEMY_R,
          )
        ) {
          playerRef.current = { ...startRef.current };
          enemyRef.current = { ...enemySpawnRef.current };
          immuneUntilRef.current = performance.now() + 900;
          setCaughtFlash(true);
          flashTimers.current.push(window.setTimeout(() => setCaughtFlash(false), 350));
        }

        for (const b of bubblesRef.current) {
          if (hitsChip(playerRef.current.x, playerRef.current.y, b)) {
            if (b.correct) {
              roundOverRef.current = true;
              setScore((s) => s + 1);
              flashTimers.current.push(
                window.setTimeout(() => {
                  setPos((p) => p + 1);
                }, 450),
              );
            } else {
              escapeChip(playerRef.current, b, wall);
              setWrongFlash(true);
              flashTimers.current.push(window.setTimeout(() => setWrongFlash(false), 250));
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
  }, [items.length]);

  if (items.length < 2) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center">
          <div className="mz-tray pointer-events-none w-[140px] p-2">
            <div className="mz-floor" style={{ aspectRatio: `${COLS} / ${ROWS}` }}>
              <div
                className="mz-cells"
                style={{ gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }}
              >
                {Array.from({ length: 20 }, (_, i) => {
                  const c = i % 5;
                  const r = Math.floor(i / 5);
                  const path = (c === 1 && r >= 1) || (r === 2 && c >= 1 && c <= 3) || (c === 3 && r <= 2);
                  return <span key={i} className={path ? 'mz-path' : 'mz-wall'} />;
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="font-body-md text-body-md">{t('gameMazeChase.needParticipants')}</div>
      </div>
    );
  }

  if (order.length === 0) return null;

  const finished = pos >= order.length;

  function restart() {
    clearFlashes();
    setOrder(shuffle(items.map((_, i) => i)));
    setPos(0);
    setScore(0);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div
          className="mb-6 w-[min(360px,92%)] px-2 py-2 text-center"
          style={{
            borderRadius: 22,
            background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
            boxShadow: woodShadow,
          }}
        >
          <div
            className="px-4 py-5"
            style={{
              borderRadius: 16,
              background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
            }}
          >
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameMazeChase.finishedTitle')}</div>
            <div className="font-title-md text-[22px] font-bold tabular-nums text-deep-navy">
              {t('gameMazeChase.scoreLabel', { score, total: order.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameMazeChase.restartButton')}
        </button>
      </div>
    );
  }

  const target = items[order[pos]];
  if (!target || !layout) return null;

  function dpadDown(dir: 'up' | 'down' | 'left' | 'right', event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    keysRef.current[dir] = true;
  }
  function dpadUp(dir: 'up' | 'down' | 'left' | 'right') {
    keysRef.current[dir] = false;
  }

  const flashClass = caughtFlash ? 'is-caught' : wrongFlash ? 'is-wrong' : '';

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <div className="rounded-full bg-secondary px-3 py-1 font-title-md text-[13px] font-bold tabular-nums text-on-secondary">
          {pos + 1} / {order.length}
        </div>
        <div className="font-title-md text-title-md text-deep-navy">
          {t('gameMazeChase.targetLabel', { word: target.label })}
        </div>
      </div>

      <div data-skin-stage="maze" className={`mz-tray mb-4 ${garden ? 'mz-garden' : ''} ${flashClass}`}>
        <div className="mz-floor" style={{ aspectRatio: `${COLS} / ${ROWS}` }}>
          <div
            className="mz-cells"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            }}
          >
            {layout.wall.flatMap((row, r) =>
              row.map((isWall, c) => {
                const isStart = c === layout.startCell.c && r === layout.startCell.r;
                return (
                  <span
                    key={`${c}-${r}`}
                    className={`${isWall ? 'mz-wall' : 'mz-path'}${isStart ? ' is-start' : ''}`}
                  />
                );
              }),
            )}
          </div>

          {layout.bubbles.map((b, i) => (
            <div
              key={b.id}
              data-skin-object="bubble"
              className={garden ? `mz-balloon mz-clay-${i % 4}` : 'mz-chip'}
              style={{ ...pctChip(b.x, b.y), zIndex: 2 }}
            >
              {b.label}
            </div>
          ))}

          <div
            data-skin-object="player"
            className="mz-marble"
            style={{ ...pctBox(playerRef.current.x, playerRef.current.y, PLAYER_R), zIndex: 4 }}
          />

          <div
            data-skin-object="enemy"
            className="mz-marble is-foe"
            style={{ ...pctBox(enemyRef.current.x, enemyRef.current.y, ENEMY_R), zIndex: 3 }}
          />
        </div>
      </div>

      <div className="mb-2 font-caption text-caption text-on-surface-variant">{t('gameMazeChase.controlsHint')}</div>
      <div className={`mz-pad ${garden ? 'mz-garden' : ''}`} role="group" aria-label={t('gameMazeChase.dpadLabel')}>
        <div className="mz-pad-grid">
          <div />
          <button
            type="button"
            onPointerDown={(event) => dpadDown('up', event)}
            onPointerUp={() => dpadUp('up')}
            onPointerCancel={() => dpadUp('up')}
            className="mz-dir"
          >
            ▲
          </button>
          <div />
          <button
            type="button"
            onPointerDown={(event) => dpadDown('left', event)}
            onPointerUp={() => dpadUp('left')}
            onPointerCancel={() => dpadUp('left')}
            className="mz-dir"
          >
            ◀
          </button>
          <button
            type="button"
            onPointerDown={(event) => dpadDown('down', event)}
            onPointerUp={() => dpadUp('down')}
            onPointerCancel={() => dpadUp('down')}
            className="mz-dir"
          >
            ▼
          </button>
          <button
            type="button"
            onPointerDown={(event) => dpadDown('right', event)}
            onPointerUp={() => dpadUp('right')}
            onPointerCancel={() => dpadUp('right')}
            className="mz-dir"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
