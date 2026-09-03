import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

export type AirplaneStyle = 'wood' | 'clay';

interface Props {
  items: GameItem[];
  boardStyle?: AirplaneStyle;
}

type FlyerKind = 'gem' | 'meteor';

interface Flyer {
  id: string;
  wordId: string;
  label: string;
  kind: FlyerKind;
  x: number;
  y: number;
  rot: number;
  tone: number;
}

interface Missile {
  id: string;
  x: number;
  y: number;
}

interface Burst {
  id: string;
  x: number;
  y: number;
  age: number;
}

const PLAYER_X = 16;
const PLAYER_W = 18;
const PLAYER_H = 11;
const GEM_W = 16;
const GEM_H = 16;
const METEOR_W = 20;
const METEOR_H = 16;
const MISSILE_W = 8;
const MISSILE_H = 3.4;
const PLAYER_SPEED = 54;
const FLYER_SPEED = 20;
const FLYER_SPEED_MAX = 52;
const FLYER_ACCEL = 0.55;
const MISSILE_SPEED = 78;
const FIRE_COOLDOWN = 0.3;
const MAX_LIVES = 3;
const HIT_IFRAMES = 0.9;
const SPAWN_X = [112, 138, 164, 190];

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

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function boxesOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;
}

function sizeOf(kind: FlyerKind): { w: number; h: number } {
  return kind === 'gem' ? { w: GEM_W, h: GEM_H } : { w: METEOR_W, h: METEOR_H };
}

function spawnY(avoidY?: number): number {
  for (let i = 0; i < 8; i++) {
    const y = rand(16, 84);
    if (avoidY == null || Math.abs(y - avoidY) > 22) return y;
  }
  return (avoidY ?? 50) < 50 ? rand(64, 84) : rand(16, 36);
}

function spawnFlyers(target: GameItem, decoyPool: GameItem[], avoidY: number): Flyer[] {
  const decoys = shuffle(decoyPool.filter((d) => d.id !== target.id)).slice(0, 3);
  const gem: Flyer = {
    id: `gem-${target.id}`,
    wordId: target.id,
    label: target.label,
    kind: 'gem',
    x: SPAWN_X[0],
    y: spawnY(avoidY),
    rot: rand(-8, 8),
    tone: 0,
  };
  const meteors = decoys.map((w, i) => ({
    id: `met-${w.id}-${i}`,
    wordId: w.id,
    label: w.label,
    kind: 'meteor' as const,
    x: SPAWN_X[(i + 1) % SPAWN_X.length],
    y: spawnY(avoidY),
    rot: rand(-22, 22),
    tone: i % 4,
  }));
  return shuffle([gem, ...meteors]);
}

function ToyPlane({ className, style }: { className?: string; style?: CSSProperties }) {
  const rawId = useId().replace(/:/g, '');
  return (
    <div data-skin-object="player" className={`ap-plane${className ? ` ${className}` : ''}`} style={style}>
      <svg className="ap-plane-svg" viewBox="0 0 220 100" aria-hidden>
        <defs>
          <linearGradient id={`${rawId}-wood`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8e4b8" />
            <stop offset="42%" stopColor="#e8c48a" />
            <stop offset="100%" stopColor="#c9964e" />
          </linearGradient>
          <linearGradient id={`${rawId}-dark`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ead2a4" />
            <stop offset="100%" stopColor="#b07a3c" />
          </linearGradient>
          <linearGradient id={`${rawId}-glass`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8f6ee" />
            <stop offset="100%" stopColor="#2a9d8c" />
          </linearGradient>
        </defs>
        <ellipse cx="90" cy="86" rx="11" ry="11" fill="#c4925c" />
        <ellipse cx="90" cy="86" rx="4.5" ry="4.5" fill="#fff4e0" />
        <rect x="87" y="62" width="6" height="18" rx="2" fill="#c9964e" />
        <ellipse cx="96" cy="58" rx="40" ry="11" fill={`url(#${rawId}-dark)`} transform="rotate(-8 96 58)" />
        <path d="M10 14 L46 50 L18 56 Z" fill={`url(#${rawId}-wood)`} stroke="#a86d35" strokeWidth="1.2" />
        <ellipse cx="30" cy="56" rx="20" ry="7" fill={`url(#${rawId}-dark)`} />
        <ellipse cx="104" cy="54" rx="78" ry="15" fill={`url(#${rawId}-wood)`} />
        <rect x="62" y="50" width="54" height="7" rx="3.5" fill="#3dbea8" />
        <ellipse cx="148" cy="40" rx="16" ry="12" fill={`url(#${rawId}-glass)`} />
        <ellipse cx="176" cy="54" rx="16" ry="12" fill={`url(#${rawId}-dark)`} />
        <ellipse className="ap-plane-prop" cx="204" cy="54" rx="5" ry="24" fill="#c4925c" />
        <circle cx="200" cy="54" r="6" fill="#ead2a4" stroke="#a86d35" strokeWidth="1" />
      </svg>
    </div>
  );
}

function WordGem({
  label,
  style,
}: {
  label?: string;
  style: CSSProperties;
}) {
  return (
    <div data-skin-object="bubble" className="ap-gem" style={style}>
      <span className="ap-gem-facet is-left" />
      <span className="ap-gem-facet is-right" />
      <span className="ap-gem-shine" />
      {label ? <span className="ap-flyer-word">{label}</span> : null}
    </div>
  );
}

function MeteorRock({
  label,
  className,
  style,
}: {
  label?: string;
  className: string;
  style: CSSProperties;
}) {
  return (
    <div data-skin-object="bubble" className={className} style={style}>
      <span className="ap-meteor-tail" />
      <span className="ap-meteor-body">
        <span className="ap-meteor-crater is-a" />
        <span className="ap-meteor-crater is-b" />
        <span className="ap-meteor-crater is-c" />
      </span>
      {label ? <span className="ap-flyer-word">{label}</span> : null}
    </div>
  );
}

function ToyMissile({ style }: { style: CSSProperties }) {
  return (
    <div className="ap-missile" style={style}>
      <span className="ap-missile-fin" />
      <span className="ap-missile-body" />
      <span className="ap-missile-nose" />
    </div>
  );
}

export function AirplaneEmptyMotif() {
  return (
    <div className="ap-tray pointer-events-none w-[168px] p-2">
      <div className="ap-sky" style={{ aspectRatio: '16 / 9' }}>
        <MeteorRock className="ap-meteor" style={{ left: '54%', top: '14%', width: '34%', height: '32%' }} />
        <WordGem style={{ left: '58%', top: '52%', width: '28%', height: '30%' }} />
        <ToyPlane style={{ left: '4%', top: '38%', width: '46%', height: '40%' }} />
      </div>
    </div>
  );
}

function isEditorTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export default function Airplane({ items, boardStyle = 'wood' }: Props) {
  const { t } = useTranslation();
  const clay = boardStyle === 'clay';
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [crashed, setCrashed] = useState(false);
  const [, setTick] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);
  const itemKey = items.map((it) => it.id).join(',');

  const playerYRef = useRef(50);
  const keysRef = useRef({ up: false, down: false, fire: false });
  const flyersRef = useRef<Flyer[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const burstsRef = useRef<Burst[]>([]);
  const cooldownRef = useRef(0);
  const iframeRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const elapsedRef = useRef(0);
  const roundOverRef = useRef(false);
  const flashTimers = useRef<number[]>([]);

  function clearFlashes() {
    flashTimers.current.forEach((id) => window.clearTimeout(id));
    flashTimers.current = [];
    setWrongFlash(false);
  }

  function resetRound(nextPos: number, nextOrder: number[]) {
    if (nextPos >= nextOrder.length) {
      flyersRef.current = [];
      missilesRef.current = [];
      burstsRef.current = [];
      return;
    }
    playerYRef.current = 50;
    flyersRef.current = spawnFlyers(items[nextOrder[nextPos]], items, playerYRef.current);
    missilesRef.current = [];
    burstsRef.current = [];
    cooldownRef.current = 0;
    iframeRef.current = 0;
    roundOverRef.current = false;
  }

  function beginGame(nextOrder: number[]) {
    livesRef.current = MAX_LIVES;
    setLives(MAX_LIVES);
    setCrashed(false);
    elapsedRef.current = 0;
    iframeRef.current = 0;
    resetRound(0, nextOrder);
  }

  useEffect(() => {
    clearFlashes();
    const nextOrder = shuffle(items.map((_, i) => i));
    setOrder(nextOrder);
    setPos(0);
    setScore(0);
    beginGame(nextOrder);
    return clearFlashes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  useEffect(() => {
    if (pos >= order.length) return;
    resetRound(pos, order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, order]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditorTarget(e.target)) return;
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        keysRef.current.fire = true;
        return;
      }
      const map: Record<string, 'up' | 'down'> = {
        ArrowUp: 'up',
        w: 'up',
        W: 'up',
        ArrowDown: 'down',
        s: 'down',
        S: 'down',
      };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      keysRef.current[dir] = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space' || e.key === 'Enter') keysRef.current.fire = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keysRef.current.up = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keysRef.current.down = false;
    }
    function clearKeys() {
      keysRef.current = { up: false, down: false, fire: false };
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
      cooldownRef.current = Math.max(0, cooldownRef.current - dt);
      iframeRef.current = Math.max(0, iframeRef.current - dt);

      if (!roundOverRef.current) {
        elapsedRef.current += dt;
        const flyerSpeed = Math.min(FLYER_SPEED_MAX, FLYER_SPEED + elapsedRef.current * FLYER_ACCEL);
        const k = keysRef.current;
        const dy = ((k.down ? 1 : 0) - (k.up ? 1 : 0)) * PLAYER_SPEED * dt;
        playerYRef.current = clamp(playerYRef.current + dy, PLAYER_H / 2, 100 - PLAYER_H / 2);

        if (k.fire && cooldownRef.current <= 0) {
          missilesRef.current.push({
            id: `ms-${now}-${Math.random().toString(36).slice(2, 6)}`,
            x: PLAYER_X + PLAYER_W / 2 + 2,
            y: playerYRef.current,
          });
          cooldownRef.current = FIRE_COOLDOWN;
        }

        for (const f of flyersRef.current) {
          f.x -= flyerSpeed * dt;
          const { w } = sizeOf(f.kind);
          if (f.x < -w) {
            f.x = rand(108, 186);
            f.y = f.kind === 'gem' ? spawnY(playerYRef.current) : rand(16, 84);
          }
        }

        const liveMissiles: Missile[] = [];
        for (const m of missilesRef.current) {
          m.x += MISSILE_SPEED * dt;
          if (m.x > 112) continue;
          let spent = false;
          for (const f of flyersRef.current) {
            const { w, h } = sizeOf(f.kind);
            if (!boxesOverlap(m.x, m.y, MISSILE_W, MISSILE_H, f.x, f.y, w * 0.86, h * 0.86)) continue;
            spent = true;
            if (f.kind === 'meteor') {
              burstsRef.current.push({ id: `b-${f.id}-${now}`, x: f.x, y: f.y, age: 0 });
              flyersRef.current = flyersRef.current.filter((other) => other.id !== f.id);
            }
            break;
          }
          if (!spent) liveMissiles.push(m);
        }
        missilesRef.current = liveMissiles;

        for (const f of flyersRef.current) {
          const { w, h } = sizeOf(f.kind);
          if (!boxesOverlap(PLAYER_X, playerYRef.current, PLAYER_W * 0.72, PLAYER_H * 0.62, f.x, f.y, w * 0.8, h * 0.8)) {
            continue;
          }
          if (f.kind === 'gem') {
            roundOverRef.current = true;
            setScore((s) => s + 1);
            flyersRef.current = flyersRef.current.filter((other) => other.id !== f.id);
            burstsRef.current.push({ id: `g-${f.id}-${now}`, x: f.x, y: f.y, age: 0 });
            flashTimers.current.push(window.setTimeout(() => setPos((p) => p + 1), 420));
          } else {
            burstsRef.current.push({ id: `h-${f.id}-${now}`, x: f.x, y: f.y, age: 0 });
            f.x = rand(140, 196);
            f.y = rand(16, 84);
            setWrongFlash(true);
            flashTimers.current.push(window.setTimeout(() => setWrongFlash(false), 250));
            if (iframeRef.current <= 0) {
              livesRef.current = Math.max(0, livesRef.current - 1);
              setLives(livesRef.current);
              iframeRef.current = HIT_IFRAMES;
              if (livesRef.current <= 0) {
                roundOverRef.current = true;
                setCrashed(true);
              }
            }
          }
          break;
        }
      }

      burstsRef.current = burstsRef.current.filter((b) => {
        b.age += dt;
        return b.age < 0.42;
      });

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
          <AirplaneEmptyMotif />
        </div>
        <div className="font-body-md text-body-md">{t('gameAirplane.needParticipants')}</div>
      </div>
    );
  }

  if (order.length === 0) return null;

  const finished = pos >= order.length;

  function restart() {
    clearFlashes();
    const nextOrder = shuffle(items.map((_, i) => i));
    setOrder(nextOrder);
    setPos(0);
    setScore(0);
    beginGame(nextOrder);
  }

  if (finished || crashed) {
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">
              {t(crashed ? 'gameAirplane.crashedTitle' : 'gameAirplane.finishedTitle')}
            </div>
            <div className="font-title-md text-[22px] font-bold tabular-nums text-deep-navy">
              {t('gameAirplane.scoreLabel', { score, total: order.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameAirplane.restartButton')}
        </button>
      </div>
    );
  }

  const target = items[order[pos]];
  if (!target) return null;

  function dpadDown(dir: 'up' | 'down' | 'fire', event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    keysRef.current[dir] = true;
  }
  function dpadUp(dir: 'up' | 'down' | 'fire') {
    keysRef.current[dir] = false;
  }

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <div
          className="ap-lives"
          role="meter"
          aria-label={t('gameAirplane.livesLabel')}
          aria-valuemin={0}
          aria-valuemax={MAX_LIVES}
          aria-valuenow={lives}
        >
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span key={i} className={`ap-life ${i < lives ? '' : 'is-empty'}`} />
          ))}
        </div>
        <div className="rounded-full bg-secondary px-3 py-1 font-title-md text-[13px] font-bold tabular-nums text-on-secondary">
          {t('gameAirplane.scoreNow', { score })}
        </div>
        <div className="rounded-full bg-primary-container px-3 py-1 font-title-md text-[13px] font-bold tabular-nums text-on-primary-container">
          {pos + 1} / {order.length}
        </div>
        <div className="font-title-md text-title-md text-deep-navy">
          {t('gameAirplane.targetLabel', { word: target.label })}
        </div>
      </div>

      <div className="mb-3 flex w-full max-w-[1040px] flex-col items-center gap-3 sm:flex-row sm:items-stretch">
        <div
          data-skin-stage="sky"
          className={`ap-tray min-w-0 flex-1 ${clay ? 'ap-clay' : ''} ${wrongFlash ? 'is-wrong' : ''}`}
        >
          <div className="ap-sky">
            {flyersRef.current.map((f) =>
              f.kind === 'gem' ? (
                <WordGem
                  key={f.id}
                  label={f.label}
                  style={{
                    left: `${f.x - GEM_W / 2}%`,
                    top: `${f.y - GEM_H / 2}%`,
                    width: `${GEM_W}%`,
                    height: `${GEM_H}%`,
                    zIndex: 2,
                    transform: `rotate(${f.rot}deg)`,
                  }}
                />
              ) : (
                <MeteorRock
                  key={f.id}
                  label={f.label}
                  className={clay ? `ap-meteor ap-clay-${f.tone}` : 'ap-meteor'}
                  style={{
                    left: `${f.x - METEOR_W / 2}%`,
                    top: `${f.y - METEOR_H / 2}%`,
                    width: `${METEOR_W}%`,
                    height: `${METEOR_H}%`,
                    zIndex: 2,
                    transform: `rotate(${f.rot}deg)`,
                  }}
                />
              ),
            )}

            {missilesRef.current.map((m) => (
              <ToyMissile
                key={m.id}
                style={{
                  left: `${m.x - MISSILE_W / 2}%`,
                  top: `${m.y - MISSILE_H / 2}%`,
                  width: `${MISSILE_W}%`,
                  height: `${MISSILE_H}%`,
                  zIndex: 3,
                }}
              />
            ))}

            {burstsRef.current.map((b) => (
              <div
                key={b.id}
                className="ap-burst"
                style={{
                  left: `${b.x - 8}%`,
                  top: `${b.y - 8}%`,
                  width: '16%',
                  height: '16%',
                  zIndex: 5,
                }}
              >
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}

            <ToyPlane
              className={iframeRef.current > 0 ? 'is-hurt' : undefined}
              style={{
                left: `${PLAYER_X - PLAYER_W / 2}%`,
                top: `${playerYRef.current - PLAYER_H / 2}%`,
                width: `${PLAYER_W}%`,
                height: `${PLAYER_H}%`,
                zIndex: 4,
              }}
            />
          </div>
        </div>

        <div className={`ap-pad ${clay ? 'ap-clay' : ''}`} role="group" aria-label={t('gameAirplane.dpadLabel')}>
          <button
            type="button"
            onPointerDown={(event) => dpadDown('up', event)}
            onPointerUp={() => dpadUp('up')}
            onPointerCancel={() => dpadUp('up')}
            className="ap-dir"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={t('gameAirplane.fireButton')}
            onPointerDown={(event) => dpadDown('fire', event)}
            onPointerUp={() => dpadUp('fire')}
            onPointerCancel={() => dpadUp('fire')}
            className="ap-dir ap-fire"
          >
            <span className="ap-fire-icon" />
          </button>
          <button
            type="button"
            onPointerDown={(event) => dpadDown('down', event)}
            onPointerUp={() => dpadUp('down')}
            onPointerCancel={() => dpadUp('down')}
            className="ap-dir"
          >
            ▼
          </button>
        </div>
      </div>

      <div className="font-caption text-caption text-on-surface-variant">{t('gameAirplane.controlsHint')}</div>
    </div>
  );
}
