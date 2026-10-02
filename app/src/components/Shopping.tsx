import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isGameSoundOn, playSfx, useGameSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import {
  LIST_FRAME,
  buildShelf,
  buildShoppingList,
  missionsFor,
  sceneGoods,
  shoppingPhrase,
  spotBackground,
  uniqueShopItems,
  type ShopGood,
  type ShoppingListEntry,
  type ShoppingMode,
  type ShoppingScene,
} from '../lib/shopping';
import type { ImageQuizItem } from '../lib/types';

interface Props {
  items: ImageQuizItem[];
  mode: ShoppingMode;
  /** 쇼핑 목록에 넣을 물건 수(목록 외우기 방식) */
  listSize: number;
  /** 목록을 외우는 시간(초). null 이면 선생님이 "장보기 시작"을 눌러 넘어간다. */
  memorizeSeconds: number | null;
  /** 통째로 그린 가게 그림에서 장보기. 있으면 items 대신 그림 속 물건을 쓴다. */
  scene?: ShoppingScene | null;
}

type Phase = 'ready' | 'memorize' | 'shop' | 'done';

// 가게 모양: 정면 진열대(3줄 × 6칸) + 양옆 진열대(3줄 × 3칸씩). 화면은 16:9 무대이고 치수는 무대 크기 비율(cqw·cqh).
const ROWS = 3;
const BACK_COLS = 6;
const SIDE_COLS = 3;
const BACK_SLOTS = ROWS * BACK_COLS;
const SIDE_SLOTS = ROWS * SIDE_COLS;
const SHELF_MAX = BACK_SLOTS + SIDE_SLOTS * 2;
/** 통로 깊이 · 옆 진열대가 화면 앞쪽으로 더 나오는 길이 · 벽 위치·높이 */
const DEPTH = 35;
const NEAR = 12;
/** 바닥·천장은 카트 아래까지 이어지게 더 길게 */
const FLOOR_NEAR = 70;
const WALL_TOP = 10;
const WALL_HEIGHT = 62;
const AISLE_LEFT = 5;
const AISLE_WIDTH = 90;

/** 빈 칸을 채우는 상자 색(물건이 적어도 진열대가 차 보이게) */
const BOX_COLORS = ['#f6b352', '#7fc8a9', '#f08a8a', '#8fb8ed', '#c9a0dc', '#f3d36b'];

interface Flyer {
  key: number;
  good: ShopGood;
  /** 가운데 좌표와 크기(무대 기준 px) */
  from: { cx: number; cy: number; size: number };
  to: { cx: number; cy: number; size: number };
  /** 0 누른 자리에서 작게 → 1 뿅 하고 커짐 → 2 카트로 날아감 */
  step: 0 | 1 | 2;
}

function say(text: string) {
  if (isGameSoundOn()) speak(text);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

/** 물건을 정면 진열대부터 채우고, 남으면 왼쪽·오른쪽 진열대에 번갈아 놓는다. 빈 칸은 null(장식 상자). */
function layoutShelves(shelf: ImageQuizItem[]) {
  const pad = (list: ImageQuizItem[], size: number): (ImageQuizItem | null)[] => [...list, ...Array(Math.max(0, size - list.length)).fill(null)];
  const back = shelf.slice(0, BACK_SLOTS);
  const rest = shelf.slice(BACK_SLOTS);
  // 옆 진열대는 가운데 줄 → 아랫줄 → 윗줄 순서로 채운다(윗줄은 화면 위쪽 안내 상자에 가려지기 쉽다).
  const side = (list: ImageQuizItem[]) => {
    const slots: (ImageQuizItem | null)[] = Array(SIDE_SLOTS).fill(null);
    const order = [1, 2, 0].flatMap((row) => Array.from({ length: SIDE_COLS }, (_, c) => row * SIDE_COLS + c));
    list.slice(0, SIDE_SLOTS).forEach((item, i) => (slots[order[i]] = item));
    return slots;
  };
  return {
    back: pad(back, BACK_SLOTS),
    left: side(rest.filter((_, i) => i % 2 === 0)),
    right: side(rest.filter((_, i) => i % 2 === 1)),
  };
}

/**
 * 장보기. 카트를 밀고 가게 통로에 서 있는 화면에서 진열대의 물건을 눌러 담는다. 담을 때마다
 * "I'd like an onion."처럼 a / an / some 문장이 나온다.
 * list: 목록을 잠깐 보고 외운 뒤 그대로 담기 · dish/event: 상황 카드를 보고 필요한 것을 자유롭게 담기.
 */
export default function Shopping({ items, mode, listSize, memorizeSeconds, scene = null }: Props) {
  const { t } = useTranslation();
  const sfx = useGameSfx('shopping');
  const goods: ShopGood[] = useMemo(() => (scene ? sceneGoods(scene) : uniqueShopItems(items)), [items, scene]);
  const missions = missionsFor(mode);

  const [phase, setPhase] = useState<Phase>('ready');
  const [list, setList] = useState<ShoppingListEntry[]>([]);
  const [shelf, setShelf] = useState<ImageQuizItem[]>(() => buildShelf(uniqueShopItems(items), [], SHELF_MAX));
  const [cart, setCart] = useState<string[]>([]);
  const [missionIndex, setMissionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [peeking, setPeeking] = useState(false);
  const [peeks, setPeeks] = useState(0);
  const [misses, setMisses] = useState(0);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [spoken, setSpoken] = useState('');
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [arriving, setArriving] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const peekTimer = useRef<number | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const basketRef = useRef<HTMLDivElement>(null);
  const flyerKey = useRef(0);

  const mission = missions.length ? missions[missionIndex % missions.length] : null;
  const frame = mission ? mission.frame : LIST_FRAME;
  const byId = useMemo(() => new Map(goods.map((g) => [g.id, g])), [goods]);
  const walls = useMemo(() => layoutShelves(shelf), [shelf]);
  /** 카트에 담긴 개수 · 목록에서 담아야 하는 개수("2 lemons"면 2, 자유 담기는 1) · 다 담았는지 */
  const countOf = (id: string) => cart.filter((x) => x === id).length;
  const needOf = (id: string) => list.find((e) => e.item.id === id)?.quantity ?? 1;
  const fullOf = (id: string) => countOf(id) >= needOf(id);
  const listTotal = list.reduce((n, e) => n + e.quantity, 0);

  useEffect(() => () => {
    if (peekTimer.current) window.clearTimeout(peekTimer.current);
  }, []);

  // 목록 외우는 시간
  useEffect(() => {
    if (phase !== 'memorize' || memorizeSeconds == null) return;
    if (secondsLeft <= 0) {
      setPhase('shop');
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [phase, secondsLeft, memorizeSeconds]);

  function startRound(nextMission = missionIndex) {
    setCart([]);
    setPeeks(0);
    setMisses(0);
    setSpoken('');
    setPeeking(false);
    setMissionIndex(nextMission);
    setRound((n) => n + 1);
    playSfx(sfx.reveal);
    if (mode === 'list') {
      const nextList = buildShoppingList(goods, listSize);
      setList(nextList);
      setShelf(buildShelf(goods, nextList.map((e) => e.item), SHELF_MAX));
      setSecondsLeft(memorizeSeconds ?? 0);
      setPhase('memorize');
    } else {
      setList([]);
      setShelf(buildShelf(goods, [], SHELF_MAX));
      setPhase('shop');
    }
  }

  function peek() {
    if (peeking) return;
    setPeeking(true);
    setPeeks((n) => n + 1);
    peekTimer.current = window.setTimeout(() => setPeeking(false), 3000);
  }

  /** 누른 물건 그림이 진열대에서 카트로 날아가는 연출 */
  /** 누른 물건이 그 자리에서 뿅 하고 튀어나온 뒤 카트로 날아가는 연출. 도착할 때까지 카트 안 그림은 숨긴다. */
  function flyToCart(item: ShopGood, el: HTMLElement) {
    const stage = sceneRef.current?.getBoundingClientRect();
    const basket = basketRef.current?.getBoundingClientRect();
    if (!stage || !basket) return;
    const from = el.getBoundingClientRect();
    const key = ++flyerKey.current;
    const flyer: Flyer = {
      key,
      good: item,
      from: { cx: from.left - stage.left + from.width / 2, cy: from.top - stage.top + from.height / 2, size: Math.min(from.width, from.height) },
      to: { cx: basket.left - stage.left + basket.width / 2, cy: basket.top - stage.top + basket.height * 0.6, size: stage.width * 0.05 },
      step: 0,
    };
    const setStep = (step: 1 | 2) => setFlyers((list) => list.map((f) => (f.key === key ? { ...f, step } : f)));
    setFlyers((list) => [...list, flyer]);
    setArriving((ids) => [...ids, item.id]);
    window.setTimeout(() => setStep(1), 30);
    window.setTimeout(() => setStep(2), 290);
    window.setTimeout(() => {
      setFlyers((list) => list.filter((f) => f.key !== key));
      setArriving((ids) => {
        const k = ids.indexOf(item.id);
        return k < 0 ? ids : [...ids.slice(0, k), ...ids.slice(k + 1)];
      });
    }, 820);
  }

  function pick(item: ShopGood, el: HTMLElement) {
    if (phase !== 'shop') return;
    if (mode === 'list') {
      const entry = list.find((e) => e.item.id === item.id);
      if (!entry) {
        setMisses((n) => n + 1);
        setWrongId(item.id);
        window.setTimeout(() => setWrongId(null), 500);
        playSfx(sfx.wrong);
        return;
      }
      // 이미 수량을 다 채운 물건은 더 담기지 않는다
      if (countOf(item.id) >= entry.quantity) return;
      const next = [...cart, item.id];
      const have = next.filter((x) => x === item.id).length;
      flyToCart(item, el);
      setCart(next);
      if (have < entry.quantity) {
        // "2 lemons"인데 아직 하나만 담았다 — 체크하지 않고 몇 개 담았는지만 알려 준다
        setSpoken(`${entry.phrase}  (${have} / ${entry.quantity})`);
        playSfx(sfx.pick);
        return;
      }
      const sentence = `${frame} ${entry.phrase}.`;
      setSpoken(sentence);
      playSfx(sfx.correct);
      say(sentence);
      if (list.every((e) => next.filter((x) => x === e.item.id).length >= e.quantity)) {
        window.setTimeout(() => {
          setPhase('done');
          playSfx(sfx.finish);
        }, 1100);
      }
      return;
    }
    // 자유 담기: 다시 누르면 카트에서 뺀다
    if (cart.includes(item.id)) {
      setCart(cart.filter((id) => id !== item.id));
      setSpoken('');
      return;
    }
    flyToCart(item, el);
    setCart([...cart, item.id]);
    const sentence = `${frame} ${shoppingPhrase(item.answer)}.`;
    setSpoken(sentence);
    playSfx(sfx.pick);
    say(sentence);
  }

  function finishFree() {
    setPhase('done');
    playSfx(sfx.finish);
  }

  if (goods.length < 2) {
    return <div className="py-16 text-center font-body-md text-body-md text-on-surface-variant">{t('gameShopping.needSetup')}</div>;
  }

  const cartItems = cart.map((id) => byId.get(id)).filter((it): it is ShopGood => !!it);
  /** 카트 안에 보이는 것 — 날아오는 중인 물건은 도착한 뒤에 보인다 */
  const landed = (() => {
    const pending = [...arriving];
    const shown: ShopGood[] = [];
    for (let i = cartItems.length - 1; i >= 0; i--) {
      const k = pending.indexOf(cartItems[i].id);
      if (k >= 0) pending.splice(k, 1);
      else shown.unshift(cartItems[i]);
    }
    return shown;
  })();

  /** 물건의 작은 그림 — 그림 가게면 장면에서 그 자리를 잘라 보여 준다. */
  const thumb = (good: ShopGood, className: string, style: CSSProperties, key?: string | number) => {
    if (good.cutout) {
      // 배경 없는 물건 그림: 동그란 테두리 없이 그림자만
      const plain: CSSProperties = { ...style, border: 'none', boxShadow: 'none', borderRadius: 0, filter: 'drop-shadow(0 0.35cqw 0.4cqw rgba(30,20,10,0.4))' };
      return <img key={key} src={good.cutout} alt={good.answer} className={`object-contain ${className.replace('rounded-full', '')}`} style={plain} draggable={false} />;
    }
    const bg = spotBackground(good);
    return bg ? (
      <div key={key} role="img" aria-label={good.answer} className={className} style={{ ...bg, ...style }} />
    ) : (
      <img key={key} src={good.imageUrl} alt={good.answer} className={`object-cover ${className}`} style={style} draggable={false} />
    );
  };

  // ── 진열대 한 면 ──
  /** texture 가 있으면 물건이 가득 그려진 진열대 그림을 깔고(양옆), 단어 그림은 그 위에 카드로만 올린다. */
  function wall(slots: (ImageQuizItem | null)[], cols: number, board: string, sign?: string, texture?: string) {
    return (
      <div
        className="flex h-full w-full flex-col"
        style={
          texture
            ? { backgroundImage: `url(${texture})`, backgroundSize: '100% 100%', boxShadow: 'inset 0 0 5cqw rgba(0,0,0,0.3)' }
            : { background: board, border: '0.6cqw solid #e8edf3', boxShadow: 'inset 0 0 4cqw rgba(0,0,0,0.35)' }
        }
      >
        {sign && (
          <div className="flex items-center justify-center bg-[#2f8f4e] font-extrabold tracking-wide text-white" style={{ height: '6cqh', fontSize: '3.4cqh' }}>
            {sign}
          </div>
        )}
        {chunk(slots, cols).map((row, r) => (
          <div key={r} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-end justify-around" style={{ padding: '0 1cqw' }}>
              {row.map((item, c) =>
                item ? (
                  <button
                    key={item.id}
                    type="button"
                    title={item.answer}
                    onClick={(e) => pick(item, e.currentTarget)}
                    className={`relative aspect-square h-[84%] overflow-hidden bg-white transition-transform duration-150 hover:-translate-y-[6%] hover:scale-105 ${
                      fullOf(item.id) ? 'opacity-30' : ''
                    } ${wrongId === item.id ? 'animate-[shop-shake_0.4s]' : ''}`}
                    style={{
                      borderRadius: '1cqw',
                      border: `0.35cqw solid ${wrongId === item.id ? '#e5484d' : fullOf(item.id) ? '#3f9b52' : '#ffffff'}`,
                      boxShadow: '0 0.5cqw 0.9cqw rgba(30,50,80,0.32)',
                    }}
                  >
                    <img src={item.imageUrl} alt={item.answer} className="h-full w-full object-cover" draggable={false} />
                  </button>
                ) : texture ? (
                  <span key={`gap-${r}-${c}`} aria-hidden="true" />
                ) : (
                  <div
                    key={`box-${r}-${c}`}
                    aria-hidden="true"
                    className="h-[66%]"
                    style={{
                      width: '5.5cqw',
                      borderRadius: '0.5cqw',
                      background: `linear-gradient(180deg, ${BOX_COLORS[(r * 3 + c) % BOX_COLORS.length]} 0 34%, #fffdf5 34% 62%, ${BOX_COLORS[(r * 3 + c) % BOX_COLORS.length]} 62%)`,
                      boxShadow: '0 0.4cqw 0.7cqw rgba(30,50,80,0.25)',
                      opacity: 0.85,
                    }}
                  />
                ),
              )}
            </div>
            <div className="flex items-center justify-around" style={{ height: '2.4cqh', padding: '0 1cqw', visibility: texture ? 'hidden' : 'visible', background: 'linear-gradient(180deg,#e2b274,#96642c)', boxShadow: '0 0.6cqh 0.8cqh rgba(0,0,0,0.4)' }}>
              {row.map((_, c) => (
                <span key={c} aria-hidden="true" style={{ width: '3.2cqw', height: '1.5cqh', borderRadius: '0.2cqw', background: c % 2 ? '#fff7c2' : '#ffffff', border: '0.1cqw solid #c9a15a' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const wallBox: CSSProperties = { position: 'absolute', top: `${WALL_TOP}cqh`, height: `${WALL_HEIGHT}cqh` };
  const sideWidth = DEPTH + NEAR;
  const floorTop = WALL_TOP + WALL_HEIGHT;

  // ── 쇼핑 목록 종이 ──
  const notepad = (showChecks: boolean, big = false) => (
    <div className="bg-[#fffef5]" style={{ borderRadius: '1.2cqw', padding: big ? '2cqw 2.6cqw' : '1.2cqw 1.5cqw', border: '0.2cqw solid #eadfbd', boxShadow: '0 0.8cqw 2cqw rgba(40,25,5,0.3)' }}>
      <div className="text-center font-bold text-[#8a5a14]" style={{ fontSize: big ? '2.6cqw' : '1.7cqw', borderBottom: '0.25cqw dashed #e3c98a', marginBottom: '0.8cqw', paddingBottom: '0.3cqw' }}>
        Shopping List
      </div>
      <ul>
        {list.map((e) => {
          const got = fullOf(e.item.id);
          const have = countOf(e.item.id);
          return (
            <li key={e.item.id} className="flex items-center font-semibold text-[#3b2a12]" style={{ gap: '0.8cqw', fontSize: big ? '2.7cqw' : '1.75cqw', lineHeight: 1.45 }}>
              <span
                className="inline-flex shrink-0 items-center justify-center text-white"
                style={{
                  width: big ? '2.4cqw' : '1.6cqw',
                  height: big ? '2.4cqw' : '1.6cqw',
                  borderRadius: '0.35cqw',
                  border: `0.2cqw solid ${showChecks && got ? '#3f9b52' : '#b89a5e'}`,
                  background: showChecks && got ? '#3f9b52' : '#ffffff',
                  fontSize: big ? '1.8cqw' : '1.2cqw',
                }}
              >
                {showChecks && got ? '✓' : ''}
              </span>
              <span className={showChecks && got && !big ? 'opacity-60 line-through' : ''}>{e.phrase}</span>
              {showChecks && !got && have > 0 && (
                <span className="font-bold text-[#c2410c]" style={{ fontSize: '0.8em' }}>
                  {have} / {e.quantity}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  const missionCard = (big = false) =>
    mission && (
      <div
        className={`bg-[#fff6d6] ${big ? 'text-center' : 'flex items-center text-left'}`}
        style={{ gap: '1cqw', borderRadius: '1.2cqw', padding: big ? '1cqw' : '0.6cqw 1.2cqw 0.6cqw 0.6cqw', border: '0.2cqw solid #f0d98a', boxShadow: '0 0.8cqw 2cqw rgba(40,25,5,0.3)' }}
      >
        <img src={mission.image} alt="" className="mx-auto shrink-0 object-cover" style={{ width: big ? '16cqw' : '6cqw', height: big ? '16cqw' : '6cqw', borderRadius: '1cqw' }} />
        <div className="font-bold leading-snug text-[#5a3d0c]" style={{ fontSize: big ? '2.4cqw' : '1.7cqw', marginTop: big ? '0.6cqw' : 0 }}>
          {mission.prompt}
        </div>
      </div>
    );

  const bigButton = (label: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-primary font-bold text-on-primary shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
      style={{ fontSize: '2cqw', padding: '1cqw 3cqw' }}
    >
      {label}
    </button>
  );

  const overlay = (children: ReactNode) => (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0b1e36]/55 text-center backdrop-blur-[3px]" style={{ gap: '1.6cqw', padding: '3cqw' }}>
      {children}
    </div>
  );

  return (
    <div ref={sceneRef} className="relative mx-auto aspect-video w-full select-none overflow-hidden rounded-2xl bg-[#1d2a3d]" style={{ containerType: 'size' }}>
      {scene ? (
        /* 통째로 그린 가게 그림 — 물건 자리를 눌러 담는다 */
        <div key={round} className="absolute inset-0 animate-[shop-zoom_0.9s_ease-out]">
          <img src={scene.image} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
          {goods.map((good) => {
            const spot = good.spot;
            if (!spot) return null;
            const inCart = fullOf(good.id);
            const partial = !inCart && countOf(good.id) > 0;
            const wrong = wrongId === good.id;
            return (
              <button
                key={good.id}
                type="button"
                title={good.answer}
                onClick={(e) => pick(good, e.currentTarget)}
                className={`absolute transition-all duration-150 hover:scale-105 hover:bg-white/15 ${wrong ? 'animate-[shop-shake_0.4s]' : ''}`}
                style={{
                  left: `${(spot.x / scene.width) * 100}%`,
                  top: `${(spot.y / scene.height) * 100}%`,
                  width: `${(spot.w / scene.width) * 100}%`,
                  height: `${(spot.h / scene.height) * 100}%`,
                  borderRadius: '1cqw',
                  outline: wrong ? '0.4cqw solid #e5484d' : inCart ? '0.35cqw solid #3f9b52' : undefined,
                  background: inCart ? 'rgba(255,255,255,0.28)' : undefined,
                }}
              >
                {inCart && (
                  <span className="absolute inline-flex items-center justify-center rounded-full bg-[#3f9b52] font-bold text-white" style={{ right: '4%', top: '6%', width: '2.4cqw', height: '2.4cqw', fontSize: '1.6cqw' }}>
                    ✓
                  </span>
                )}
                {partial && (
                  <span className="absolute inline-flex items-center justify-center rounded-full bg-[#f59e0b] font-bold text-white" style={{ right: '4%', top: '6%', height: '2.4cqw', padding: '0 0.7cqw', fontSize: '1.4cqw' }}>
                    {countOf(good.id)} / {needOf(good.id)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* 단어장 가게 — 카트를 밀고 통로에 서서 보는 시점(CSS 3D) */
      <div className="absolute inset-0" style={{ perspective: '75cqw', perspectiveOrigin: '50% 42%' }}>
        <div key={round} className="absolute inset-0 animate-[shop-enter_0.9s_ease-out]" style={{ transformStyle: 'preserve-3d' }}>
          {/* 천장과 조명 */}
          <div
            style={{
              position: 'absolute',
              left: `${AISLE_LEFT}cqw`,
              width: `${AISLE_WIDTH}cqw`,
              top: `${WALL_TOP}cqh`,
              height: `${DEPTH + FLOOR_NEAR}cqw`,
              transformOrigin: 'center top',
              transform: `translateZ(${FLOOR_NEAR}cqw) rotateX(-90deg)`,
              background: 'repeating-linear-gradient(180deg,#dfe6ee 0 14%,#ffffff 14% 18%,#dfe6ee 18% 25%)',
            }}
          />
          {/* 바닥 타일 */}
          <div
            style={{
              position: 'absolute',
              left: `${AISLE_LEFT}cqw`,
              width: `${AISLE_WIDTH}cqw`,
              top: `calc(${floorTop}cqh - ${DEPTH + FLOOR_NEAR}cqw)`,
              height: `${DEPTH + FLOOR_NEAR}cqw`,
              transformOrigin: 'center bottom',
              transform: `translateZ(${FLOOR_NEAR}cqw) rotateX(90deg)`,
              backgroundColor: '#e9e3d6',
              backgroundImage:
                'linear-gradient(rgba(120,105,80,0.28) 0.25cqw, transparent 0.25cqw), linear-gradient(90deg, rgba(120,105,80,0.28) 0.25cqw, transparent 0.25cqw)',
              backgroundSize: '11.25cqw 11cqw',
            }}
          />
          {/* 정면 진열대 */}
          <div style={{ ...wallBox, left: `${AISLE_LEFT}cqw`, width: `${AISLE_WIDTH}cqw`, transform: `translateZ(-${DEPTH}cqw)` }}>
            {wall(walls.back, BACK_COLS, 'linear-gradient(180deg,#31445e,#243349)', 'FRESH MARKET')}
          </div>
          {/* 왼쪽 진열대 */}
          <div style={{ ...wallBox, left: `${AISLE_LEFT}cqw`, width: `${sideWidth}cqw`, transformOrigin: 'left center', transform: `translateZ(${NEAR}cqw) rotateY(90deg)`, paddingLeft: `${NEAR / 2}cqw`, background: '#1d2a3d' }}>
            {wall(walls.left, SIDE_COLS, '', undefined, '/skins/shop-wall-left.webp')}
          </div>
          {/* 오른쪽 진열대 */}
          <div
            style={{
              ...wallBox,
              left: `${AISLE_LEFT + AISLE_WIDTH - sideWidth}cqw`,
              width: `${sideWidth}cqw`,
              transformOrigin: 'right center',
              transform: `translateZ(${NEAR}cqw) rotateY(-90deg)`,
              paddingRight: `${NEAR / 2}cqw`,
              background: '#1d2a3d',
            }}
          >
            {wall(walls.right, SIDE_COLS, '', undefined, '/skins/shop-wall-right.webp')}
          </div>
        </div>
      </div>
      )}

      {/* 카트(밀고 있는 사람 시점) */}
      <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2" style={{ width: scene ? '38cqw' : '43cqw', aspectRatio: '1100 / 581', bottom: '-2cqh' }}>
        <img src="/skins/shop-cart.webp" alt="" className="absolute inset-0 h-full w-full" draggable={false} />
        <div
          ref={basketRef}
          key={landed.length}
          className={`absolute flex flex-wrap content-end items-end justify-center ${landed.length ? 'animate-[shop-bump_0.3s]' : ''}`}
          style={{ left: '27%', right: '27%', top: '20%', height: '46%' }}
        >
          {landed.slice(-9).map((it, i) =>
            thumb(
              it,
              'rounded-full',
              it.cutout
                ? { width: '6cqw', height: '6cqw', margin: '-0.9cqw -0.7cqw', transform: `rotate(${((i * 37) % 31) - 15}deg)` }
                : { width: '4.8cqw', height: '4.8cqw', margin: '-0.35cqw', border: '0.3cqw solid #ffffff', boxShadow: '0 0.3cqw 0.6cqw rgba(30,50,80,0.4)' },
              `${it.id}-${i}`,
            ),
          )}
        </div>
        {phase === 'shop' && mode === 'list' && (
          <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white font-extrabold text-deep-navy shadow" style={{ bottom: '13%', fontSize: '1.8cqw', padding: '0.2cqw 1.4cqw' }}>
            {cart.length} / {listTotal}
          </div>
        )}
      </div>

      {/* 카트로 날아가는 그림 */}
      {flyers.map((f) => {
        const at = f.step === 2 ? f.to : f.from;
        const size = f.step === 0 ? f.from.size * 0.7 : f.step === 1 ? f.from.size * 1.6 : f.to.size;
        return thumb(
          f.good,
          'pointer-events-none absolute z-20 rounded-full',
          {
            left: at.cx - size / 2,
            top: at.cy - size / 2,
            width: size,
            height: size,
            border: '3px solid #fff',
            transition: f.step === 1 ? 'all 0.24s cubic-bezier(0.3, 1.7, 0.5, 1)' : 'all 0.5s cubic-bezier(0.5, -0.3, 0.75, 1)',
          },
          f.key,
        );
      })}

      {/* 장보는 동안: 말하기 틀(왼쪽 위), 목록·상황 카드(오른쪽 위) */}
      {phase === 'shop' && (
        <>
          <div className="absolute z-20 bg-white/95" style={{ left: '1.5cqw', top: '1.5cqw', maxWidth: '40cqw', borderRadius: '1.2cqw', padding: '0.8cqw 1.3cqw', boxShadow: '0 0.6cqw 1.6cqw rgba(20,40,70,0.3)' }}>
            <div className="font-bold text-deep-navy" style={{ fontSize: '1.7cqw' }}>
              {frame} <span className="text-primary">a … / an … / some …</span>
            </div>
            {spoken && (
              <button type="button" onClick={() => say(spoken)} className="flex items-center text-left font-extrabold text-deep-navy" style={{ gap: '0.6cqw', fontSize: '2.6cqw', marginTop: '0.3cqw' }}>
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: '2.6cqw' }} aria-hidden="true">
                  volume_up
                </span>
                {spoken}
              </button>
            )}
          </div>

          <div className="absolute z-20" style={{ right: scene ? '28cqw' : '1.5cqw', top: '1.5cqw', width: mode === 'list' ? '23cqw' : '32cqw' }}>
            {mode === 'list' ? (
              peeking ? (
                notepad(true)
              ) : (
                <button
                  type="button"
                  onClick={peek}
                  className="flex w-full items-center justify-center bg-[#fffef5] font-bold text-[#8a5a14] hover:bg-[#fff8dc]"
                  style={{ gap: '0.6cqw', borderRadius: '1.2cqw', padding: '1.2cqw', fontSize: '1.7cqw', border: '0.25cqw dashed #d8b96a', boxShadow: '0 0.6cqw 1.6cqw rgba(40,25,5,0.25)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '2cqw' }} aria-hidden="true">
                    visibility
                  </span>
                  {t('gameShopping.peekButton')}
                </button>
              )
            ) : (
              missionCard()
            )}
          </div>

          {mode !== 'list' && (
            <div className="absolute z-20" style={{ right: '1.5cqw', bottom: '1.5cqw' }}>
              {bigButton(t('gameShopping.finishButton'), finishFree, cart.length === 0)}
            </div>
          )}
        </>
      )}

      {/* 시작 전 */}
      {phase === 'ready' &&
        overlay(
          <>
            <div className="font-extrabold text-white" style={{ fontSize: '4cqw', textShadow: '0 0.3cqw 1cqw rgba(0,0,0,0.4)' }}>
              {t(`gameShopping.mode_${mode}`)}
            </div>
            <div className="text-white/90" style={{ fontSize: '1.7cqw', maxWidth: '60cqw' }}>
              {t(`gameShopping.modeHint_${mode}`)}
            </div>
            {missionCard(true)}
            {bigButton(t('gameShopping.startButton'), () => startRound())}
          </>,
        )}

      {/* 목록 외우기 */}
      {phase === 'memorize' &&
        overlay(
          <>
            <div className="font-extrabold text-white" style={{ fontSize: '3cqw', textShadow: '0 0.3cqw 1cqw rgba(0,0,0,0.4)' }}>
              {t('gameShopping.memorizeTitle')}
            </div>
            <div style={{ width: '42cqw' }} className="text-left">
              {notepad(false, true)}
            </div>
            <div className="flex items-center" style={{ gap: '2cqw' }}>
              {memorizeSeconds != null && (
                <div className="flex items-center justify-center rounded-full bg-warm-yellow font-extrabold text-deep-navy shadow" style={{ width: '6cqw', height: '6cqw', fontSize: '3.2cqw' }}>
                  {secondsLeft}
                </div>
              )}
              {bigButton(t('gameShopping.goShoppingButton'), () => setPhase('shop'))}
            </div>
          </>,
        )}

      {/* 끝 */}
      {phase === 'done' &&
        overlay(
          <>
            <div className="font-extrabold text-white" style={{ fontSize: '4cqw', textShadow: '0 0.3cqw 1cqw rgba(0,0,0,0.4)' }}>
              {t('gameShopping.doneTitle')}
            </div>
            {mode === 'list' ? (
              <>
                <div style={{ width: '42cqw' }} className="text-left">
                  {notepad(true, true)}
                </div>
                <div className="text-white/90" style={{ fontSize: '1.7cqw' }}>
                  {t('gameShopping.doneStats', { peeks, misses })}
                </div>
              </>
            ) : (
              <>
                {mission && (
                  <div className="font-bold text-warm-yellow" style={{ fontSize: '2.2cqw' }}>
                    {mission.prompt}
                  </div>
                )}
                <ul className="grid grid-cols-2 overflow-y-auto text-left" style={{ gap: '0.8cqw', width: '74cqw', maxHeight: '48cqh' }}>
                  {cartItems.map((it) => (
                    <li key={it.id} className="flex items-center bg-white/95" style={{ gap: '1cqw', borderRadius: '1cqw', padding: '0.6cqw 1cqw' }}>
                      {thumb(it, 'shrink-0', { width: '5cqw', height: '5cqw', borderRadius: '0.8cqw' })}
                      <button type="button" onClick={() => say(`${frame} ${shoppingPhrase(it.answer)}.`)} className="text-left font-bold text-deep-navy hover:underline" style={{ fontSize: '2.1cqw' }}>
                        {frame} {shoppingPhrase(it.answer)}.
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {bigButton(mode === 'list' ? t('gameShopping.newListButton') : t('gameShopping.nextMissionButton'), () => startRound(mode === 'list' ? missionIndex : missionIndex + 1))}
          </>,
        )}
    </div>
  );
}
