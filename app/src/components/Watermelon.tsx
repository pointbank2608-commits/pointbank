import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  asSentenceSlot,
  fruitStageForCount,
  getSentencePattern,
  isCompleteSentence,
  phraseText,
  pointsForComplete,
  SLOT_COLORS,
  slotLabelKey,
  tryMergeTokens,
  type SentenceToken,
} from '../lib/sentencePatterns';
import { agreementFlightParts, applySentenceTransforms, type TokenChange } from '../lib/sentenceTransforms';
import { FRUIT_LOOKS, fruitKindForTokens, type FruitKind } from '../lib/fruitLooks';
import {
  clampDropX,
  createWatermelonWorld,
  destroyWatermelonWorld,
  dropFruit,
  findFruit,
  overflowBodies,
  removeFruit,
  snapshotFruits,
  stepWatermelonWorld,
  type FruitBody,
  type FruitSnapshot,
  type WatermelonWorld,
} from '../lib/watermelonWorld';
import { playWatermelonSfx, preloadWatermelonSfx } from '../lib/watermelonSfx';
import type { GameItem } from '../lib/types';

const TANK_W = 420;
const TANK_H = 540;
const WALL = 16;
const DANGER_Y = 92;
const DROP_Y = 52;
const AIM_STEP = 28;

function isPlayPointer(event: PointerEvent<HTMLElement>) {
  return event.isPrimary && event.button === 0;
}

function blockMenu(event: { preventDefault(): void; stopPropagation(): void }) {
  event.preventDefault();
  event.stopPropagation();
}

interface Props {
  items: GameItem[];
  patternId: string;
}

function poolForPattern(items: GameItem[], patternId: string): GameItem[] {
  const need = new Set(getSentencePattern(patternId).slots);
  return items.filter((i) => {
    const slot = asSentenceSlot(i.slot);
    return Boolean(i.label.trim()) && slot && need.has(slot);
  });
}

function pickItem(pool: GameItem[], avoidId?: string): GameItem {
  const choices = pool.length > 1 ? pool.filter((i) => i.id !== avoidId) : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}

const AGREE_MS = 2000;
const COMPLETE_HOLD_MS = 650;

function FruitShape({ kind, id, accent }: { kind: FruitKind; id: string; accent: string }) {
  const look = FRUIT_LOOKS[kind];
  const gid = `melon-g-${id}`;
  const fill = `url(#${gid})`;
  return (
    <svg viewBox="0 0 100 100" className="melon-fruit-svg" aria-hidden>
      <defs>
        <radialGradient id={gid} cx="32%" cy="28%">
          <stop offset="0%" stopColor="#fff6e8" stopOpacity="0.55" />
          <stop offset="55%" stopColor={look.fill} />
          <stop offset="100%" stopColor={look.fill} />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="56" rx="38" ry="36" fill="rgba(90,50,18,0.12)" />
      {kind === 'grape' ? (
        <>
          <circle cx="36" cy="62" r="24" fill={fill} />
          <circle cx="64" cy="62" r="24" fill={fill} />
          <circle cx="50" cy="40" r="24" fill={fill} />
        </>
      ) : kind === 'lemon' ? (
        <ellipse cx="50" cy="50" rx="33" ry="40" fill={fill} />
      ) : (
        <circle cx="50" cy="50" r="40" fill={fill} />
      )}
      {kind === 'orange' && (
        <>
          <circle cx="42" cy="44" r="1.7" fill="#e76f51" opacity="0.35" />
          <circle cx="58" cy="40" r="1.7" fill="#e76f51" opacity="0.35" />
          <circle cx="50" cy="56" r="1.7" fill="#e76f51" opacity="0.35" />
          <circle cx="38" cy="58" r="1.4" fill="#e76f51" opacity="0.28" />
        </>
      )}
      {kind === 'watermelon' && (
        <>
          <path d="M22 40 Q50 26 78 40" fill="none" stroke="#1b4332" strokeWidth="3" opacity="0.35" />
          <path d="M20 55 Q50 41 80 55" fill="none" stroke="#1b4332" strokeWidth="3" opacity="0.35" />
        </>
      )}
      {kind === 'grape' ? null : kind === 'lemon' ? (
        <ellipse cx="50" cy="50" rx="33" ry="40" fill="none" stroke={accent} strokeWidth="4" opacity="0.5" />
      ) : (
        <circle cx="50" cy="50" r="40" fill="none" stroke={accent} strokeWidth="4" opacity="0.5" />
      )}
      <path d="M62 18 C70 8, 84 12, 78 24 C72 18, 66 18, 62 18Z" fill={look.leaf} />
    </svg>
  );
}

function fruitBox(fruit: Pick<FruitSnapshot, 'x' | 'y' | 'r' | 'angle'>): CSSProperties {
  return {
    left: `${((fruit.x - fruit.r) / TANK_W) * 100}%`,
    top: `${((fruit.y - fruit.r) / TANK_H) * 100}%`,
    width: `${((fruit.r * 2) / TANK_W) * 100}%`,
    height: `${((fruit.r * 2) / TANK_H) * 100}%`,
    transform: `rotate(${fruit.angle}rad)`,
  };
}

function PhraseLabel({ tokens, agreement }: { tokens: SentenceToken[]; agreement?: TokenChange | null }) {
  const change = agreement ?? null;
  return (
    <>
      {tokens.map((token, i) => {
        const gap = i === 0 ? null : ' ';
        if (!change || i !== change.index) {
          return (
            <span key={`${token.slot}-${i}`}>
              {gap}
              {token.word}
            </span>
          );
        }
        const parts = agreementFlightParts(change.from, change.to);
        if (!parts || !parts.affix) {
          return (
            <span key={`${token.slot}-${i}`}>
              {gap}
              {token.word}
            </span>
          );
        }
        if (parts.mode === 'replace') {
          return (
            <span key={`${token.slot}-${i}`} className="melon-verb is-replace">
              {gap}
              <span className="melon-verb-from">{parts.from}</span>
              <span className="melon-verb-to">
                {parts.stem}
                <span className="melon-agree-affix">{parts.affix}</span>
              </span>
            </span>
          );
        }
        return (
          <span key={`${token.slot}-${i}`} className="melon-verb">
            {gap}
            <span className="melon-verb-stem">{parts.stem}</span>
            <span className="melon-agree-affix">{parts.affix}</span>
          </span>
        );
      })}
    </>
  );
}

function FruitBall({
  fruit,
  popping,
  ghost,
  agreeing,
}: {
  fruit: FruitSnapshot;
  popping?: boolean;
  ghost?: boolean;
  agreeing?: boolean;
}) {
  const kind = fruitKindForTokens(fruit.tokens);
  const accent = SLOT_COLORS[fruit.tokens[0]?.slot ?? 'object'];
  const label = phraseText(fruit.tokens);
  const font = Math.max(12, Math.min(22, fruit.r / Math.max(2.1, label.length * 0.26)));
  const showAgree = Boolean(agreeing || fruit.agreement);
  return (
    <div
      className={`melon-fruit${popping ? ' is-popping' : ''}${ghost ? ' is-ghost' : ''}${showAgree && !popping ? ' is-agreeing' : ''}`}
      style={fruitBox(fruit)}
    >
      <div className="melon-fruit-inner">
        <FruitShape kind={kind} id={fruit.id} accent={accent} />
        <span className="melon-fruit-word" style={{ fontSize: font }}>
          <PhraseLabel tokens={fruit.tokens} agreement={fruit.agreement} />
        </span>
        {showAgree && !popping && (
          <span className="melon-sparkles" aria-hidden>
            <i /><i /><i /><i /><i />
          </span>
        )}
      </div>
    </div>
  );
}

export default function Watermelon({ items, patternId }: Props) {
  const { t } = useTranslation();
  const pattern = useMemo(() => getSentencePattern(patternId), [patternId]);
  const pool = useMemo(() => poolForPattern(items, patternId), [items, patternId]);
  const tankRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<WatermelonWorld | null>(null);
  const nextRef = useRef<GameItem | null>(null);
  const dropLock = useRef(false);
  const overflowMs = useRef(0);
  const patternRef = useRef(pattern);
  const overRef = useRef(false);
  const mergeRef = useRef<(world: WatermelonWorld, a: FruitBody, b: FruitBody) => boolean>(() => false);
  patternRef.current = pattern;
  const [fruits, setFruits] = useState<FruitSnapshot[]>([]);
  const [nextItem, setNextItem] = useState<GameItem | null>(null);
  const [aimX, setAimX] = useState(TANK_W / 2);
  const aimXRef = useRef(aimX);
  const poolRef = useRef(pool);
  const nudgeTimer = useRef<number | null>(null);
  aimXRef.current = aimX;
  poolRef.current = pool;
  const [score, setScore] = useState(0);
  const [popping, setPopping] = useState<{
    id: string;
    x: number;
    y: number;
    r: number;
    tokens: SentenceToken[];
    agreement?: TokenChange | null;
    agreeing?: boolean;
  } | null>(null);
  const [over, setOver] = useState(false);
  const [burst, setBurst] = useState<string | null>(null);

  useEffect(() => {
    if (pool.length === 0) {
      nextRef.current = null;
      setNextItem(null);
      return;
    }
    const current = nextRef.current;
    if (current && pool.some((i) => i.id === current.id)) return;
    const first = pickItem(pool);
    nextRef.current = first;
    setNextItem(first);
  }, [pool]);

  useEffect(() => {
    const world = createWatermelonWorld({
      width: TANK_W,
      height: TANK_H,
      wall: WALL,
      dangerY: DANGER_Y,
      onMerge(a, b) {
        return mergeRef.current(world, a, b);
      },
    });
    worldRef.current = world;
    preloadWatermelonSfx();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      stepWatermelonWorld(world, dt);
      setFruits(snapshotFruits(world));
      if (!overRef.current && overflowBodies(world).length > 0) {
        overflowMs.current += dt;
        if (overflowMs.current > 1600) {
          overRef.current = true;
          setOver(true);
          playWatermelonSfx('over');
        }
      } else if (overflowBodies(world).length === 0) {
        overflowMs.current = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      destroyWatermelonWorld(world);
      worldRef.current = null;
    };
  }, []);

  mergeRef.current = (world, a, b) => {
    if (overRef.current) return false;
    if (!a.fruitData || !b.fruitData) return false;
    const current = patternRef.current;
    const merged = tryMergeTokens(a.fruitData.tokens, b.fruitData.tokens, current.slots);
    if (!merged) return false;
    const transformed = applySentenceTransforms(merged);
    const tokens = transformed.tokens;
    const agreement = transformed.changes[0] ?? null;
    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    removeFruit(world, a);
    removeFruit(world, b);
    const body = dropFruit(world, { id: crypto.randomUUID(), tokens, agreement }, x, y);
    playWatermelonSfx('merge');
    if (agreement) playWatermelonSfx('agree');
    if (isCompleteSentence(tokens, current.slots)) {
      const delay = agreement ? AGREE_MS : COMPLETE_HOLD_MS;
      const id = body.fruitData.id;
      window.setTimeout(() => {
        const live = worldRef.current;
        if (!live || overRef.current) return;
        const still = findFruit(live, id);
        if (!still) return;
        const stage = fruitStageForCount(tokens.length);
        setPopping({
          id: `pop-${Date.now()}`,
          x: still.position.x,
          y: still.position.y,
          r: stage.radius,
          tokens,
          agreement,
        });
        setBurst(phraseText(tokens));
        playWatermelonSfx('pop');
        setScore((s) => s + pointsForComplete(current));
        removeFruit(live, still);
        window.setTimeout(() => {
          setPopping(null);
          setBurst(null);
        }, 700);
      }, delay);
    }
    return true;
  };

  function tankPoint(clientX: number) {
    const el = tankRef.current;
    if (!el) return TANK_W / 2;
    const rect = el.getBoundingClientRect();
    const scale = rect.width / TANK_W;
    return (clientX - rect.left) / scale;
  }

  function setAim(next: number) {
    const r = fruitStageForCount(1).radius;
    const x = clampDropX(TANK_W, WALL, next, r);
    aimXRef.current = x;
    setAimX(x);
  }

  function aimAt(clientX: number) {
    setAim(tankPoint(clientX));
  }

  function nudgeBy(dir: -1 | 1) {
    setAim(aimXRef.current + dir * AIM_STEP);
  }

  function clearNudge() {
    if (nudgeTimer.current != null) {
      window.clearInterval(nudgeTimer.current);
      nudgeTimer.current = null;
    }
  }

  function startNudge(dir: -1 | 1, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!isPlayPointer(event)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    clearNudge();
    nudgeBy(dir);
    nudgeTimer.current = window.setInterval(() => nudgeBy(dir), 70);
  }

  function drop() {
    const world = worldRef.current;
    const item = nextRef.current;
    if (!world || !item || overRef.current || dropLock.current || poolRef.current.length === 0) return;
    const slot = asSentenceSlot(item.slot);
    if (!slot) return;
    dropLock.current = true;
    const r = fruitStageForCount(1).radius;
    const x = clampDropX(TANK_W, WALL, aimXRef.current, r);
    dropFruit(world, { id: crypto.randomUUID(), tokens: [{ word: item.label, slot }] }, x, DROP_Y);
    playWatermelonSfx('drop');
    const following = pickItem(poolRef.current, item.id);
    nextRef.current = following;
    setNextItem(following);
    window.setTimeout(() => {
      dropLock.current = false;
    }, 420);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeBy(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeBy(1);
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        drop();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearNudge();
    };
  }, []);

  if (pool.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="font-body-md text-body-md">{t('gameWatermelon.needRoles')}</div>
      </div>
    );
  }

  const nextStage = fruitStageForCount(1);
  const nextSlot = asSentenceSlot(nextItem?.slot);

  return (
    <div className="flex w-full flex-col items-center gap-3" onContextMenu={blockMenu}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="melon-score" data-skin-object="score-card">
          <span className="font-caption text-caption text-[#9adfd4]">{t('gameWatermelon.scoreLabel')}</span>
          <span className="font-mono text-[28px] font-bold tabular-nums text-[#e8fbf6]">{score}</span>
        </div>
        <div className="rounded-full bg-secondary-container px-4 py-1.5 font-label-md text-label-md text-on-secondary-container">
          {t(pattern.nameKey)}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {pattern.slots.map((slot, i) => (
          <span
            key={`${slot}-${i}`}
            className="melon-slot-chip"
            style={{ background: SLOT_COLORS[slot] }}
          >
            {t(slotLabelKey(slot))}
            {i < pattern.slots.length - 1 ? <span className="opacity-70"> →</span> : null}
          </span>
        ))}
      </div>

      <div
        ref={tankRef}
        className="melon-tank"
        data-skin-stage="board"
        onContextMenu={blockMenu}
        onPointerMove={(event) => {
          if (event.pointerType === 'mouse') aimAt(event.clientX);
        }}
        onPointerDown={(event) => {
          if (!isPlayPointer(event)) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
          aimAt(event.clientX);
          drop();
        }}
      >
        <div className="melon-rim" />
        <div className="melon-danger" style={{ top: `${(DANGER_Y / TANK_H) * 100}%` }} />
        {nextItem && nextSlot && !over && (
          <FruitBall
            ghost
            fruit={{
              id: 'ghost',
              x: aimX,
              y: DROP_Y,
              r: nextStage.radius,
              angle: 0,
              tokens: [{ word: nextItem.label, slot: nextSlot }],
            }}
          />
        )}
        {fruits.map((fruit) => (
          <FruitBall key={fruit.id} fruit={fruit} />
        ))}
        {popping && (
          <FruitBall
            fruit={{ ...popping, angle: 0 }}
            popping={!popping.agreeing}
            agreeing={popping.agreeing}
          />
        )}
        {burst && <div className="melon-burst">{burst}!</div>}
        {over && (
          <div className="melon-over">
            <div className="font-title-md text-[22px] font-bold text-white">{t('gameWatermelon.gameOver')}</div>
            <div className="mt-1 font-body-md text-body-md text-white/90">
              {t('gameWatermelon.finalScore', { score })}
            </div>
          </div>
        )}
      </div>
      <div className="melon-pad" role="group" aria-label={t('gameWatermelon.padLabel')} onContextMenu={blockMenu}>
        <button
          type="button"
          className="melon-dir"
          aria-label={t('gameWatermelon.moveLeft')}
          onContextMenu={blockMenu}
          onPointerDown={(event) => startNudge(-1, event)}
          onPointerUp={clearNudge}
          onPointerCancel={clearNudge}
          onLostPointerCapture={clearNudge}
        >
          ◀
        </button>
        <button
          type="button"
          className="melon-dir is-drop"
          onContextMenu={blockMenu}
          onPointerDown={(event) => {
            event.preventDefault();
            if (!isPlayPointer(event)) return;
            drop();
          }}
        >
          {t('gameWatermelon.dropButton')}
        </button>
        <button
          type="button"
          className="melon-dir"
          aria-label={t('gameWatermelon.moveRight')}
          onContextMenu={blockMenu}
          onPointerDown={(event) => startNudge(1, event)}
          onPointerUp={clearNudge}
          onPointerCancel={clearNudge}
          onLostPointerCapture={clearNudge}
        >
          ▶
        </button>
      </div>
      <div className="font-caption text-caption text-on-surface-variant">{t('gameWatermelon.dropHint')}</div>
    </div>
  );
}
