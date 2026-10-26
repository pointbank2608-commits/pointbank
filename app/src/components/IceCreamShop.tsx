import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_SFX, GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import { useRemoteActions } from '../lib/remote';
import {
  EMPTY_ORDER,
  FLAVOURS,
  REMEMBER_LINES,
  configureShop,
  type ShopMenu,
  type ShopCurrency,
  SHOP_LINES,
  SIZES,
  STYLES,
  TOPPINGS,
  rememberSegments,
  type Flavour,
  type Order,
  type ShopOption,
  type SizeOption,
} from '../lib/iceCreamShop';

/**
 * 아이스크림 가게 롤플레이(2026-10-15) — PPT "ESL Ice Cream Shop Role Play (Kids A1-A2)"를 한 게임으로 옮겼다.
 * ① 메뉴(칠판: 맛 9·크기 3·담기 2·토핑 3) ② 주문하기(대화를 한 줄씩 열며 크기·담기·맛·토핑을 골라 아이스크림을 쌓는다)
 * ③ 기억하기(PPT 10번: 빈칸 낱말을 떠올리며 대화 말하기) ④ 짝 연습(PPT 11번: 점원/손님, Switch!, 주문 카드). 점수는 없다.
 */

interface Props {
  showKo: boolean;
  menu?: ShopMenu;
  currency?: ShopCurrency;
}

type Step = 'menu' | 'order' | 'remember' | 'practice';
const STEPS: Step[] = ['menu', 'order', 'remember', 'practice'];
const STEP_ICON: Record<Step, string> = { menu: '📋', order: '🍦', remember: '🧠', practice: '🤝' };
const IMG = (n: string) => `/skins/icecream/${n}.webp`;

const STYLE = `
@keyframes ic-pop { 0%{transform:scale(.5);opacity:0} 60%{transform:scale(1.12);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes ic-rise { 0%{transform:translateY(10%);opacity:0} 100%{transform:translateY(0);opacity:1} }
@keyframes ic-drop { 0%{transform:translateY(-120%);opacity:0} 70%{transform:translateY(6%);opacity:1} 100%{transform:translateY(0)} }
@keyframes ic-glow { 0%,100%{box-shadow:0 0 0 0 rgba(250,204,21,.95)} 50%{box-shadow:0 0 0 .7cqw rgba(250,204,21,0)} }
@keyframes ic-bob { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-4%) rotate(2deg)} }
.ic-btn { transition: transform .15s, filter .15s; }
.ic-btn:hover:not(:disabled) { transform: translateY(-3%) scale(1.03); filter: brightness(1.04); }
.ic-btn:active:not(:disabled) { transform: scale(.97); }
.ic-btn:disabled { cursor: default; }
@media (prefers-reduced-motion: reduce) { .ic-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

function randomOf<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** 쌓아 올린 아이스크림(콘/컵 + 스쿱 + 토핑) — 컨테이너 크기에 맞춰 퍼센트로 그린다 */
function IceCream({ order, className, style }: { order: Order; className?: string; style?: CSSProperties }) {
  const n = order.flavours.length;
  const isTub = order.style?.id === 'tub';
  const topping = order.topping && order.topping !== 'none' ? order.topping.id : null;
  // Coordinates share the cup rim and the real upper scoop, rather than fixed topping heights.
  const scoops = order.flavours.map((_f, i) => isTub
    ? n === 1 ? { left: 20, width: 60, bottom: 34 }
      : n === 2 ? { left: i === 0 ? 4 : 40, width: 56, bottom: i === 0 ? 34 : 36 }
        : i < 2 ? { left: i === 0 ? 2 : 42, width: 56, bottom: 34 }
          : { left: 22, width: 56, bottom: 52 }
    : { left: 17, width: 66, bottom: 36 + i * 17 });
  const surface = isTub && n === 2 ? scoops : scoops.slice(-1);
  const asPercent = (position: { left: number; width: number; bottom: number }): CSSProperties => ({
    left: `${position.left}%`, width: `${position.width}%`, bottom: `${position.bottom}%`,
  });
  const abs = (s: CSSProperties): CSSProperties => ({ position: 'absolute', ...s });
  return (
    <div className={className} style={{ position: 'relative', aspectRatio: '1 / 1.45', transform: !isTub && n === 3 ? 'scale(.88)' : undefined, transformOrigin: 'bottom center', ...style }}>
      {order.style && (
        <img src={IMG(isTub ? 'tub' : 'cone')} alt="" draggable={false} style={abs(isTub ? { left: '14%', width: '72%', bottom: '2%' } : { left: '22%', width: '56%', bottom: '0' })} className="object-contain" />
      )}
      {order.flavours.map((f, i) => {
        const pos = asPercent(scoops[i]);
        return (
          <img
            key={`${f.id}-${i}`}
            src={IMG(f.art)}
            alt=""
            draggable={false}
            className="ic-anim object-contain"
            style={{ ...abs(pos), animation: 'ic-drop .45s both', zIndex: 2 + i }}
          />
        );
      })}
      {topping && n > 0 && (
        topping === 'flake' ? (
          <img src={IMG('flake')} alt="" draggable={false} className="ic-anim object-contain"
            style={{ ...abs(asPercent({ left: scoops[n - 1].left + scoops[n - 1].width * .4,
              width: scoops[n - 1].width * .64, bottom: scoops[n - 1].bottom + 14 })),
              zIndex: 10, animation: 'ic-pop .4s both' }} />
        ) : surface.map((scoop, i) => {
          const mask = `url(${IMG(order.flavours[scoops.indexOf(scoop)].art)})`;
          return <div key={`${topping}-${i}`} className="ic-anim" style={{ ...abs(asPercent(scoop)),
            aspectRatio: '259 / 239', maskImage: mask, WebkitMaskImage: mask,
            maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat',
            zIndex: 10 + i, animation: 'ic-pop .4s both', pointerEvents: 'none' }}>
            <img src={IMG(topping === 'sauce' ? 'sauce' : 'sprinkles')} alt="" draggable={false}
              className="object-contain" style={abs({ left: '8%', width: '84%', bottom: topping === 'sauce' ? '10%' : '22%' })} />
          </div>;
        })
      )}
    </div>
  );
}

function cardOrder(): Order {
  const size = randomOf(SIZES);
  return {
    size,
    style: randomOf(STYLES),
    flavours: shuffle(FLAVOURS).slice(0, size.scoops),
    topping: randomOf<ShopOption | 'none'>([...TOPPINGS, 'none']),
  };
}

export default function IceCreamShop({ showKo: showKoProp, menu = 'full', currency = '£' }: Props) {
  const { t } = useTranslation();
  configureShop({ menu, currency });
  const [step, setStep] = useState<Step>('menu');
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, [step]);
  const [showKo, setShowKo] = useState(showKoProp);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const l = timers.current;
    return () => l.forEach((id) => window.clearTimeout(id));
  }, []);

  /* ---- 주문하기 ---- */
  const [shown, setShown] = useState(0);
  const [order, setOrder] = useState<Order>(EMPTY_ORDER);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, order]);

  const lastIdx = shown - 1;
  const lastLine = lastIdx >= 0 ? SHOP_LINES[lastIdx] : null;
  const need = lastLine?.who === 'customer' ? lastLine.pick : undefined;
  const sizeStyleDone = !!order.size && !!order.style;
  const flavoursDone = !!order.size && order.flavours.length >= order.size.scoops;
  const pickDone = !need ? true : need === 'sizeStyle' ? sizeStyleDone : need === 'flavours' ? flavoursDone : order.topping !== null;
  const waiting = !!need && !pickDone;
  const finished = shown >= SHOP_LINES.length;

  function resetOrder() {
    window.speechSynthesis?.cancel();
    setShown(0);
    setOrder(EMPTY_ORDER);
  }

  function nextLine() {
    if (waiting || finished) return;
    const i = shown;
    setShown(i + 1);
    playSfx(GAME_SFX.icecream.line);
    const line = SHOP_LINES[i];
    if (!line.pick) speak(line.text(order));
  }

  function say(i: number, o: Order) {
    speak(SHOP_LINES[i].text(o));
  }

  function chooseSize(s: SizeOption) {
    playSfx(GAME_SFX.icecream.pick);
    const o = { ...order, size: s, flavours: order.flavours.slice(0, s.scoops) };
    setOrder(o);
    if (o.style) say(lastIdx, o);
  }
  function chooseStyle(s: ShopOption) {
    playSfx(GAME_SFX.icecream.pick);
    const o = { ...order, style: s };
    setOrder(o);
    if (o.size) say(lastIdx, o);
  }
  function toggleFlavour(f: Flavour) {
    if (!order.size) return;
    playSfx(GAME_SFX.icecream.scoop);
    const has = order.flavours.some((x) => x.id === f.id);
    let flavours = has ? order.flavours.filter((x) => x.id !== f.id) : [...order.flavours, f];
    if (!has && flavours.length > order.size.scoops) flavours = flavours.slice(-order.size.scoops);
    const o = { ...order, flavours };
    setOrder(o);
    if (flavours.length >= order.size.scoops) say(lastIdx, o);
  }
  function chooseTopping(tp: ShopOption | 'none') {
    playSfx(GAME_SFX.icecream.pick);
    const o = { ...order, topping: tp };
    setOrder(o);
    say(lastIdx, o);
  }

  function autoPick() {
    if (!waiting) return;
    if (need === 'sizeStyle') {
      const size = order.size ?? randomOf(SIZES);
      const style = order.style ?? randomOf(STYLES);
      const o = { ...order, size, style };
      setOrder(o);
      say(lastIdx, o);
    } else if (need === 'flavours' && order.size) {
      const o = { ...order, flavours: shuffle(FLAVOURS).slice(0, order.size.scoops) };
      setOrder(o);
      say(lastIdx, o);
    } else if (need === 'topping') chooseTopping(randomOf<ShopOption | 'none'>([...TOPPINGS, 'none']));
  }

  useEffect(() => {
    if (step === 'order' && finished) playSfx(GAME_SFX.icecream.done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  /* ---- 기억하기 ---- */
  const [open, setOpen] = useState<Set<string>>(new Set());
  const bank = [...new Set(REMEMBER_LINES.flatMap((l) => l.blank))];

  /* ---- 짝 연습 ---- */
  const [swapped, setSwapped] = useState(false);
  const [card, setCard] = useState<Order | null>(null);
  function drawCard() {
    setCard(cardOrder());
    playSfx(GAME_SFX.icecream.pick);
  }
  function switchRoles() {
    setSwapped((v) => !v);
    playSfx(COMMON_SFX.yourTurn);
  }

  /* ---- 선생님 폰 리모컨 ---- */
  const stepIdx = STEPS.indexOf(step);
  const nextStep = stepIdx < STEPS.length - 1 ? [{ id: 'step', label: t('gameIceCream.nextStep'), tone: 'neutral' as const, run: () => setStep(STEPS[stepIdx + 1]) }] : [];
  useRemoteActions(
    step === 'menu'
      ? nextStep
      : step === 'order'
        ? [
            { id: 'next', label: t('gameIceCream.nextLine'), tone: 'primary' as const, run: nextLine },
            { id: 'auto', label: t('gameIceCream.autoPick'), tone: 'neutral' as const, run: autoPick },
            { id: 'again', label: t('gameIceCream.again'), tone: 'neutral' as const, run: resetOrder },
            ...nextStep,
          ]
        : step === 'remember'
          ? [{ id: 'all', label: t('gameIceCream.revealAll'), tone: 'primary' as const, run: () => setOpen(new Set(REMEMBER_LINES.flatMap((l, li) => rememberSegments(l).map((s, si) => (s.hidden ? `${li}:${si}` : '')).filter(Boolean)))) }, ...nextStep]
          : [
              { id: 'card', label: t('gameIceCream.drawCard'), tone: 'primary' as const, run: drawCard },
              { id: 'switch', label: 'Switch!', tone: 'good' as const, run: switchRoles },
            ],
  );

  const pill = { fontSize: 'clamp(11px, 1.9cqw, 26px)' };
  const bf = { fontSize: 'clamp(11px, 1.7cqw, 22px)' };
  const btn = 'ic-btn rounded-full px-[1.8cqw] py-[0.7cqw] font-bold text-white shadow-lg';
  const scene = step === 'order' && finished ? 'scene-beach' : 'scene-shop';
  const serverLines = SHOP_LINES.filter((l) => l.who === 'server');
  const customerLines = SHOP_LINES.filter((l) => l.who === 'customer');
  const emptyForText: Order = { ...EMPTY_ORDER, size: SIZES[2], style: STYLES[0] };

  return (
    <div className="space-y-3">
      <style>{STYLE}</style>

      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md transition-colors ${
              step === s ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant/50 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span aria-hidden="true">{STEP_ICON[s]}</span>
            {i + 1}. {t(`gameIceCream.step_${s}`)}
          </button>
        ))}
      </div>

      <div
        className="relative w-full overflow-hidden rounded-[24px] shadow-lg"
        style={{ aspectRatio: '16 / 9', containerType: 'size', background: `#fbcfe8 url(${IMG(scene)}) center / cover no-repeat` }}
      >
        <div className="absolute left-0 right-0 top-[2.2%] z-20 text-center">
          <span className="inline-block max-w-[92%] rounded-full bg-white/92 px-[2.4cqw] py-[0.6cqw] font-bold text-slate-800 shadow" style={pill}>
            {step === 'order' && finished ? t('gameIceCream.lastLine') : t(`gameIceCream.hint_${step}`)}
          </span>
        </div>

        {/* ① 메뉴 */}
        {step === 'menu' && (
          <>
            <div className="absolute z-10 grid gap-[1.4cqw] rounded-[1.6cqw] border-[0.6cqw] border-amber-800 p-[1.4cqw] shadow-xl" style={{ left: '4%', right: '4%', top: '11.5%', bottom: '11%', background: 'rgba(38,44,52,.95)', gridTemplateColumns: '1.35fr 1fr' }}>
              <div className="flex flex-col">
                <div className="mb-[0.6cqw] text-center font-black text-yellow-200" style={{ fontSize: 'clamp(12px, 2cqw, 28px)' }}>
                  Flavours{showKo ? ' · 맛' : ''}
                </div>
                <div className="grid flex-1 grid-cols-3 gap-[0.8cqw]">
                  {FLAVOURS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        playSfx(GAME_SFX.icecream.pick);
                        speak(f.name);
                      }}
                      className="ic-btn flex flex-col items-center justify-center rounded-[1cqw] bg-white/10 p-[0.4cqw]"
                    >
                      <img src={IMG(f.art)} alt="" className="object-contain" style={{ height: '8cqw' }} draggable={false} />
                      <span className="text-center font-bold leading-tight text-white" style={{ fontSize: 'clamp(9px, 1.4cqw, 19px)' }}>
                        {f.name}
                      </span>
                      {showKo && <span className="text-yellow-100" style={{ fontSize: 'clamp(8px, 1.05cqw, 14px)' }}>{f.ko}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-[0.8cqw]">
                <div>
                  <div className="text-center font-black text-yellow-200" style={{ fontSize: 'clamp(11px, 1.7cqw, 24px)' }}>
                    Sizes{showKo ? ' · 크기' : ''}
                  </div>
                  <div className="mt-[0.4cqw] flex justify-around">
                    {SIZES.map((s) => (
                      <button key={s.id} type="button" onClick={() => speak(`${s.name}, ${s.scoops} scoop${s.scoops > 1 ? 's' : ''}`)} className="ic-btn flex flex-col items-center">
                        <IceCream order={{ size: s, style: STYLES[0], flavours: FLAVOURS.slice(0, s.scoops), topping: null }} style={{ height: '9.5cqw', aspectRatio: '1 / 1.45' }} />
                        <span className="font-bold text-white" style={{ fontSize: 'clamp(9px, 1.3cqw, 18px)' }}>{s.name}</span>
                        <span className="text-yellow-100" style={{ fontSize: 'clamp(8px, 1.05cqw, 14px)' }}>
                          {s.scoops} scoop{s.scoops > 1 ? 's' : ''} · {s.price}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-center font-black text-yellow-200" style={{ fontSize: 'clamp(11px, 1.7cqw, 24px)' }}>
                    Style{showKo ? ' · 담기' : ''}
                  </div>
                  <div className="mt-[0.3cqw] flex justify-around">
                    {STYLES.map((s) => (
                      <button key={s.id} type="button" onClick={() => speak(s.name)} className="ic-btn flex items-center gap-[0.6cqw]">
                        <img src={IMG(s.art)} alt="" className="object-contain" style={{ height: '5.4cqw' }} draggable={false} />
                        <span className="font-bold text-white" style={{ fontSize: 'clamp(10px, 1.5cqw, 20px)' }}>{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-center font-black text-yellow-200" style={{ fontSize: 'clamp(11px, 1.7cqw, 24px)' }}>
                    Toppings{showKo ? ' · 토핑' : ''}
                  </div>
                  <div className="mt-[0.3cqw] flex justify-around">
                    {TOPPINGS.map((tp) => (
                      <button key={tp.id} type="button" onClick={() => speak(tp.name)} className="ic-btn flex flex-col items-center">
                        <img src={IMG(tp.art)} alt="" className="object-contain" style={{ height: '5.4cqw' }} draggable={false} />
                        <span className="text-center font-bold leading-tight text-white" style={{ fontSize: 'clamp(8px, 1.15cqw, 16px)', maxWidth: '10cqw' }}>
                          {tp.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-[2%] z-20 flex justify-center gap-[0.8cqw]">
              <button type="button" onClick={() => setShowKo((v) => !v)} className={btn} style={{ ...bf, background: showKo ? '#8b5cf6' : '#64748b' }}>
                {t('gameIceCream.koToggle')}
              </button>
              <button type="button" onClick={() => setStep('order')} className={btn} style={{ ...bf, background: '#16a34a' }}>
                {t('gameIceCream.toOrder')} ▶
              </button>
            </div>
          </>
        )}

        {/* ② 주문하기 */}
        {step === 'order' && !finished && (
          <>
            <div ref={chatRef} className="absolute z-10 flex flex-col gap-[0.7cqw] overflow-y-auto rounded-[1.6cqw] bg-white/84 p-[1.2cqw] shadow-xl" style={{ left: '2%', width: '42%', top: '11.5%', bottom: '11%' }}>
              {SHOP_LINES.slice(0, shown).map((l, i) => {
                const server = l.who === 'server';
                return (
                  <div key={i} className={`ic-anim flex items-end gap-[0.8cqw] ${server ? '' : 'flex-row-reverse'}`} style={{ animation: 'ic-rise .3s both' }}>
                    <img src={IMG(server ? 'server-girl' : 'customer-boy')} alt="" className="shrink-0 object-contain" style={{ height: '7.5cqw' }} draggable={false} />
                    <button
                      type="button"
                      onClick={() => speak(l.text(order))}
                      className="rounded-[1.1cqw] border-[0.2cqw] px-[1cqw] py-[0.45cqw] text-left font-bold text-slate-800"
                      style={{ background: server ? '#fff1f2' : '#e0f2fe', borderColor: server ? '#fb7185' : '#38bdf8', fontSize: 'clamp(10px, 1.55cqw, 21px)' }}
                    >
                      <span className="block font-black" style={{ fontSize: '0.62em', color: server ? '#be123c' : '#0369a1' }}>
                        {server ? 'Shop assistant' : 'Customer'}
                      </span>
                      {l.text(order)}
                      {showKo && (
                        <span className="block font-normal text-slate-500" style={{ fontSize: '0.66em' }}>
                          {l.ko(order)}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
              {shown === 0 && (
                <div className="m-auto text-center font-bold text-slate-500" style={{ fontSize: 'clamp(10px, 1.6cqw, 22px)' }}>
                  {t('gameIceCream.startHint')}
                </div>
              )}
            </div>

            {/* 고르기 + 아이스크림 */}
            <div className="absolute z-10 flex gap-[1cqw]" style={{ left: '46%', right: '2%', top: '11.5%', bottom: '11%' }}>
              <div className="flex-1 overflow-y-auto rounded-[1.6cqw] bg-amber-50/95 p-[1cqw] shadow-xl">
                {waiting && need === 'sizeStyle' && (
                  <div className="space-y-[0.8cqw]">
                    <div className="text-center font-black text-slate-800" style={{ fontSize: 'clamp(10px, 1.5cqw, 20px)' }}>{t('gameIceCream.pickSizeStyle')}</div>
                    <div className="flex justify-center gap-[0.6cqw]">
                      {SIZES.map((s) => (
                        <button key={s.id} type="button" onClick={() => chooseSize(s)} className="ic-btn rounded-[1cqw] border-[0.25cqw] px-[1cqw] py-[0.5cqw] font-bold" style={{ borderColor: order.size?.id === s.id ? '#ec4899' : '#fff', background: order.size?.id === s.id ? '#fce7f3' : '#fff', fontSize: 'clamp(10px, 1.5cqw, 20px)' }}>
                          {s.name}
                          <span className="block font-normal text-slate-500" style={{ fontSize: '0.7em' }}>{s.scoops} scoop{s.scoops > 1 ? 's' : ''}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-center gap-[0.6cqw]">
                      {STYLES.map((s) => (
                        <button key={s.id} type="button" onClick={() => chooseStyle(s)} className="ic-btn flex items-center gap-[0.5cqw] rounded-[1cqw] border-[0.25cqw] px-[1cqw] py-[0.4cqw] font-bold" style={{ borderColor: order.style?.id === s.id ? '#ec4899' : '#fff', background: order.style?.id === s.id ? '#fce7f3' : '#fff', fontSize: 'clamp(10px, 1.5cqw, 20px)' }}>
                          <img src={IMG(s.art)} alt="" className="object-contain" style={{ height: '4.2cqw' }} draggable={false} />
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {waiting && need === 'flavours' && order.size && (
                  <>
                    <div className="mb-[0.5cqw] text-center font-black text-slate-800" style={{ fontSize: 'clamp(10px, 1.5cqw, 20px)' }}>
                      {t('gameIceCream.pickFlavours', { n: order.size.scoops, now: order.flavours.length })}
                    </div>
                    <div className="grid grid-cols-3 gap-[0.6cqw]">
                      {FLAVOURS.map((f) => {
                        const on = order.flavours.some((x) => x.id === f.id);
                        return (
                          <button key={f.id} type="button" onClick={() => toggleFlavour(f)} className="ic-btn flex flex-col items-center rounded-[1cqw] border-[0.25cqw] p-[0.3cqw]" style={{ borderColor: on ? '#ec4899' : '#fff', background: on ? '#fce7f3' : '#fff' }}>
                            <img src={IMG(f.art)} alt="" className="object-contain" style={{ height: '5cqw' }} draggable={false} />
                            <span className="text-center font-bold leading-tight text-slate-800" style={{ fontSize: 'clamp(8px, 1.15cqw, 16px)' }}>{f.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {waiting && need === 'topping' && (
                  <div className="space-y-[0.6cqw]">
                    <div className="text-center font-black text-slate-800" style={{ fontSize: 'clamp(10px, 1.5cqw, 20px)' }}>{t('gameIceCream.pickTopping')}</div>
                    <div className="flex flex-wrap justify-center gap-[0.8cqw]">
                      {TOPPINGS.map((tp) => (
                        <button key={tp.id} type="button" onClick={() => chooseTopping(tp)} className="ic-btn flex flex-col items-center rounded-[1cqw] border-[0.25cqw] border-white bg-white p-[0.5cqw]" style={{ width: '10cqw' }}>
                          <img src={IMG(tp.art)} alt="" className="object-contain" style={{ height: '6cqw' }} draggable={false} />
                          <span className="text-center font-bold leading-tight text-slate-800" style={{ fontSize: 'clamp(8px, 1.15cqw, 16px)' }}>{tp.name}</span>
                        </button>
                      ))}
                      <button type="button" onClick={() => chooseTopping('none')} className="ic-btn flex items-center justify-center rounded-[1cqw] border-[0.25cqw] border-white bg-white p-[0.5cqw] font-bold text-slate-700" style={{ width: '10cqw', fontSize: 'clamp(9px, 1.3cqw, 18px)' }}>
                        {t('gameIceCream.noTopping')}
                      </button>
                    </div>
                  </div>
                )}
                {!waiting && (
                  <div className="flex h-full items-center justify-center text-center font-black text-slate-600" style={{ fontSize: 'clamp(11px, 1.7cqw, 24px)' }}>
                    {t('gameIceCream.waiting')}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-end justify-center rounded-[1.6cqw] bg-white/70 p-[1cqw] shadow-xl" style={{ width: '18cqw' }}>
                <IceCream order={order} style={{ width: '100%' }} />
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-[2%] z-20 flex justify-center gap-[0.8cqw]">
              <button type="button" onClick={nextLine} disabled={waiting} className={`${btn} disabled:opacity-40`} style={{ ...bf, background: '#ec4899' }}>
                {shown === 0 ? t('gameIceCream.start') : t('gameIceCream.nextLine')} ▶
              </button>
              {waiting && (
                <button type="button" onClick={autoPick} className={btn} style={{ ...bf, background: '#0ea5a4' }}>
                  🎲 {t('gameIceCream.autoPick')}
                </button>
              )}
              <button type="button" onClick={resetOrder} className={btn} style={{ ...bf, background: '#64748b' }}>
                {t('gameIceCream.again')}
              </button>
              <button type="button" onClick={() => setShowKo((v) => !v)} className={btn} style={{ ...bf, background: showKo ? '#8b5cf6' : '#64748b' }}>
                {t('gameIceCream.koToggle')}
              </button>
            </div>
          </>
        )}

        {/* ② 끝: 해변에서 아이스크림 */}
        {step === 'order' && finished && (
          <>
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-[10%]">
              <div className="ic-anim" style={{ animation: 'ic-bob 1.6s ease-in-out infinite', height: '52%', aspectRatio: '1 / 1.45' }}>
                <IceCream order={order} style={{ height: '100%' }} />
              </div>
              <div className="mt-[1cqw] rounded-[1.6cqw] bg-white/90 px-[2cqw] py-[0.8cqw] text-center font-black text-slate-800 shadow-xl" style={{ fontSize: 'clamp(12px, 2.2cqw, 30px)' }}>
                {t('gameIceCream.enjoy')}
                <div className="font-bold text-pink-600" style={{ fontSize: '0.6em' }}>
                  {order.size?.name} · {order.style?.name} · {order.flavours.map((f) => f.name).join(', ')} · {order.size?.price}
                </div>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-[2%] z-20 flex justify-center gap-[0.8cqw]">
              <button type="button" onClick={resetOrder} className={btn} style={{ ...bf, background: '#ec4899' }}>
                {t('gameIceCream.again')}
              </button>
              <button type="button" onClick={() => setStep('remember')} className={btn} style={{ ...bf, background: '#16a34a' }}>
                {t('gameIceCream.toRemember')} ▶
              </button>
            </div>
          </>
        )}

        {/* ③ 기억하기 */}
        {step === 'remember' && (
          <>
            <div className="absolute z-10 flex flex-wrap items-center justify-center gap-[0.8cqw]" style={{ left: '4%', right: '4%', top: '10.5%' }}>
              {bank.map((w) => (
                <span key={w} className="rounded-full border-[0.2cqw] border-amber-500 bg-white/95 px-[1.2cqw] py-[0.2cqw] font-bold text-slate-800" style={{ fontSize: 'clamp(9px, 1.3cqw, 18px)' }}>
                  {w}
                </span>
              ))}
            </div>
            <div className="absolute z-10 flex flex-col justify-evenly gap-[0.5cqw] overflow-y-auto rounded-[1.6cqw] bg-white/86 px-[1.4cqw] py-[0.8cqw] shadow-xl" style={{ left: '14%', right: '14%', top: '19%', bottom: '11%' }}>
              {REMEMBER_LINES.map((l, li) => {
                const server = l.who === 'server';
                return (
                  <div key={li} className={`flex ${server ? 'justify-start' : 'justify-end'}`}>
                    <div className="max-w-[90%] rounded-[1.2cqw] border-[0.2cqw] px-[1.1cqw] py-[0.3cqw]" style={{ background: server ? '#fff1f2' : '#e0f2fe', borderColor: server ? '#fb7185' : '#38bdf8' }}>
                      <button type="button" onClick={() => speak(l.text)} className="block text-left font-bold leading-snug text-slate-800" style={{ fontSize: 'clamp(9px, 1.45cqw, 20px)' }}>
                        <span className="mr-[0.5cqw] font-black" style={{ fontSize: '0.74em', color: server ? '#be123c' : '#0369a1' }}>
                          {server ? 'Shop assistant:' : 'Customer:'}
                        </span>
                        {rememberSegments(l).map((s, si) => {
                          if (!s.hidden) return <span key={si}>{s.text}</span>;
                          const key = `${li}:${si}`;
                          if (open.has(key)) return <span key={si} className="rounded bg-yellow-200 px-[0.2cqw] text-emerald-700">{s.text}</span>;
                          return (
                            <span
                              key={si}
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpen((o) => new Set(o).add(key));
                                playSfx(GAME_SFX.icecream.pick);
                              }}
                              className="mx-[0.2cqw] inline-block cursor-pointer rounded border-b-[0.25cqw] border-slate-700 bg-white/70 align-bottom text-transparent"
                              style={{ minWidth: `${Math.max(5, s.text.length * 0.8)}cqw` }}
                            >
                              {s.text.replace(/./g, '·')}
                            </span>
                          );
                        })}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="absolute inset-x-0 bottom-[2%] z-20 flex justify-center gap-[0.8cqw]">
              <button
                type="button"
                onClick={() => setOpen(new Set(REMEMBER_LINES.flatMap((l, li) => rememberSegments(l).map((s, si) => (s.hidden ? `${li}:${si}` : '')).filter(Boolean))))}
                className={btn}
                style={{ ...bf, background: '#10b981' }}
              >
                {t('gameIceCream.revealAll')}
              </button>
              <button type="button" onClick={() => setOpen(new Set())} className={btn} style={{ ...bf, background: '#64748b' }}>
                {t('gameIceCream.again')}
              </button>
              <button type="button" onClick={() => setStep('practice')} className={btn} style={{ ...bf, background: '#16a34a' }}>
                {t('gameIceCream.toPractice')} ▶
              </button>
            </div>
          </>
        )}

        {/* ④ 짝 연습 */}
        {step === 'practice' && (
          <>
            {([0, 1] as const).map((side) => {
              const isServer = (side === 0) !== swapped;
              const lines = isServer ? serverLines : customerLines;
              return (
                <div key={side} className="absolute z-10 flex flex-col rounded-[1.6cqw] bg-white/88 p-[1cqw] shadow-xl" style={{ [side === 0 ? 'left' : 'right']: '2%', width: '36%', top: '11.5%', bottom: '12%' }}>
                  <div className="flex items-center gap-[1cqw]">
                    <img src={IMG(isServer ? 'server-girl' : 'customer-boy')} alt="" className="object-contain" style={{ height: '12cqw' }} draggable={false} />
                    <div>
                      <div className="font-black text-slate-500" style={{ fontSize: 'clamp(10px, 1.5cqw, 20px)' }}>
                        Partner {side === 0 ? 'A' : 'B'}:
                      </div>
                      <div className="rounded-full px-[1.2cqw] py-[0.3cqw] font-black text-white" style={{ background: isServer ? '#e11d48' : '#0284c7', fontSize: 'clamp(11px, 1.9cqw, 26px)' }}>
                        {isServer ? 'Shop assistant' : 'Customer'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-[0.8cqw] flex flex-1 flex-col justify-evenly gap-[0.4cqw] overflow-y-auto">
                    {lines.map((l, i) => (
                      <button key={i} type="button" onClick={() => speak(l.text(emptyForText).replace('______', ''))} className="rounded-[1cqw] border-[0.2cqw] px-[0.9cqw] py-[0.3cqw] text-left font-bold text-slate-800" style={{ background: isServer ? '#fff1f2' : '#e0f2fe', borderColor: isServer ? '#fb7185' : '#38bdf8', fontSize: 'clamp(9px, 1.3cqw, 18px)' }}>
                        {l.pick ? l.text({ ...EMPTY_ORDER }) : l.text(emptyForText)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* 가운데 주문 카드 */}
            <div className="absolute left-1/2 z-20 flex -translate-x-1/2 flex-col items-center rounded-[1.4cqw] bg-amber-50/95 px-[1cqw] py-[0.7cqw] shadow-2xl" style={{ top: '14%', width: '20cqw', bottom: '12%' }}>
              <div className="text-center font-black text-slate-700" style={{ fontSize: 'clamp(9px, 1.3cqw, 18px)' }}>
                🧾 {t('gameIceCream.yourOrder')}
              </div>
              {card ? (
                <>
                  <IceCream order={card} style={{ height: '62%' }} />
                  <div className="text-center font-bold leading-tight text-slate-800" style={{ fontSize: 'clamp(8px, 1.15cqw, 16px)' }}>
                    {card.size?.name} · {card.style?.name}
                    <br />
                    {card.flavours.map((f) => f.name).join(', ')}
                    <br />
                    {card.topping === 'none' ? t('gameIceCream.noTopping') : card.topping?.name}
                  </div>
                </>
              ) : (
                <div className="m-auto text-center text-slate-500" style={{ fontSize: 'clamp(9px, 1.2cqw, 16px)' }}>
                  {t('gameIceCream.drawHint')}
                </div>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-[2%] z-20 flex justify-center gap-[0.8cqw]">
              <button type="button" onClick={drawCard} className={btn} style={{ ...bf, background: '#6366f1' }}>
                🎲 {t('gameIceCream.drawCard')}
              </button>
              <button type="button" onClick={switchRoles} className={btn} style={{ ...bf, background: '#16a34a' }}>
                Switch! 🔄
              </button>
              <button type="button" onClick={() => setShowKo((v) => !v)} className={btn} style={{ ...bf, background: showKo ? '#8b5cf6' : '#64748b' }}>
                {t('gameIceCream.koToggle')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
