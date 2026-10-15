import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_SFX, GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import { useRemoteActions } from '../lib/remote';
import { RESTAURANTS, fillLine, pickChoices, type MenuItem, type Restaurant, type RestaurantId } from '../lib/restaurantRoleplay';

/**
 * 레스토랑 롤플레이(2026-10-15) — PPT "Ordering Food at a Restaurant"을 한 게임으로 옮겼다.
 * ① 메뉴(그림을 눌러 읽기) ② 주문하기(서버 질문·손님 대답을 한 줄씩 열고, 손님 대답의 빈칸은 메뉴에서 눌러 채워 주문서를 만든다)
 * ③ 짝 연습(Partner A 서버 / Partner B 손님, "Switch!"로 역할 바꾸기, 주문 카드 뽑기). 메뉴 4단계: 피자 카페 → 타코 식당 → 카페 3 → 카페 4.
 * 점수는 없다(PPT 원본에도 없다).
 */

interface Props {
  levels: RestaurantId[];
  showKo: boolean;
}

type Step = 'menu' | 'order' | 'practice';
const STEPS: Step[] = ['menu', 'order', 'practice'];
const STEP_ICON: Record<Step, string> = { menu: '📋', order: '🧾', practice: '🤝' };
const IMG = (n: string) => `/skins/restaurant/${n}.webp`;

const STYLE = `
@keyframes rs-pop { 0%{transform:scale(.5);opacity:0} 60%{transform:scale(1.1);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes rs-rise { 0%{transform:translateY(10%);opacity:0} 100%{transform:translateY(0);opacity:1} }
@keyframes rs-glow { 0%,100%{box-shadow:0 0 0 0 rgba(250,204,21,.95)} 50%{box-shadow:0 0 0 .7cqw rgba(250,204,21,0)} }
@keyframes rs-swap { 0%{transform:rotateY(0)} 50%{transform:rotateY(90deg)} 100%{transform:rotateY(0)} }
.rs-btn { transition: transform .15s, filter .15s; }
.rs-btn:hover:not(:disabled) { transform: translateY(-3%) scale(1.03); filter: brightness(1.04); }
.rs-btn:active:not(:disabled) { transform: scale(.97); }
.rs-btn:disabled { cursor: default; }
@media (prefers-reduced-motion: reduce) { .rs-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

function randomPick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

export default function RestaurantRoleplay({ levels, showKo: showKoProp }: Props) {
  const { t } = useTranslation();
  const list = useMemo(() => {
    const picked = RESTAURANTS.filter((r) => levels.includes(r.id));
    return picked.length > 0 ? picked : RESTAURANTS;
  }, [levels]);
  const [restId, setRestId] = useState<RestaurantId>(list[0].id);
  const [step, setStep] = useState<Step>('menu');
  const [showKo, setShowKo] = useState(showKoProp);
  const rest: Restaurant = list.find((r) => r.id === restId) ?? list[0];

  useEffect(() => {
    if (!list.some((r) => r.id === restId)) setRestId(list[0].id);
  }, [list, restId]);

  /* ---- 주문하기 ---- */
  const [shown, setShown] = useState(0); // 열린 대화 줄 수
  const [picks, setPicks] = useState<Record<number, MenuItem>>({});
  const timers = useRef<number[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const l = timers.current;
    return () => l.forEach((id) => window.clearTimeout(id));
  }, []);

  function resetOrder() {
    setShown(0);
    setPicks({});
  }
  useEffect(resetOrder, [restId]);

  // 새 대사가 열리면 맨 아래로
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, picks]);

  const lastIdx = shown - 1;
  const lastLine = lastIdx >= 0 ? rest.lines[lastIdx] : null;
  const waitingPick = !!lastLine && lastLine.who === 'customer' && !!lastLine.pick && !picks[lastIdx];
  const finished = shown >= rest.lines.length && !waitingPick;
  const lineText = (i: number): string => {
    const l = rest.lines[i];
    return fillLine(l.text, picks[i]?.name ?? null);
  };

  function nextLine() {
    if (waitingPick || shown >= rest.lines.length) return;
    const i = shown;
    setShown(i + 1);
    const l = rest.lines[i];
    playSfx(GAME_SFX.restaurant.line);
    if (!(l.who === 'customer' && l.pick)) speak(l.text.replace('…', ''));
  }

  function choose(item: MenuItem) {
    if (!waitingPick || !lastLine) return;
    setPicks((p) => ({ ...p, [lastIdx]: item }));
    playSfx(GAME_SFX.restaurant.pick);
    speak(fillLine(lastLine.text, item.name));
  }

  function autoPick() {
    if (!waitingPick || !lastLine) return;
    const choices = pickChoices(rest, lastLine);
    if (choices.length > 0) choose(randomPick(choices).item);
  }

  const order = rest.lines
    .map((l, i) => ({ l, i, item: picks[i] }))
    .filter((x) => x.l.who === 'customer' && x.l.pick && x.item);

  useEffect(() => {
    if (step === 'order' && finished && shown > 0) playSfx(GAME_SFX.restaurant.done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  /* ---- 짝 연습 ---- */
  const [swapped, setSwapped] = useState(false);
  const [card, setCard] = useState<MenuItem[] | null>(null);
  function drawCard() {
    const items = rest.lines.filter((l) => l.who === 'customer' && l.pick).map((l) => {
      const choices = pickChoices(rest, l);
      return randomPick(choices).item;
    });
    setCard(items);
    playSfx(GAME_SFX.restaurant.pick);
  }
  function switchRoles() {
    setSwapped((v) => !v);
    playSfx(COMMON_SFX.yourTurn);
  }
  useEffect(() => {
    setCard(null);
    setSwapped(false);
  }, [restId]);

  /* ---- 선생님 폰 리모컨 ---- */
  const stepIdx = STEPS.indexOf(step);
  const nextStep = stepIdx < STEPS.length - 1 ? [{ id: 'step', label: t('gameRestaurant.nextStep'), tone: 'neutral' as const, run: () => setStep(STEPS[stepIdx + 1]) }] : [];
  useRemoteActions(
    step === 'menu'
      ? nextStep
      : step === 'order'
        ? [
            { id: 'next', label: t('gameRestaurant.nextLine'), tone: 'primary' as const, run: nextLine },
            { id: 'auto', label: t('gameRestaurant.autoPick'), tone: 'neutral' as const, run: autoPick },
            { id: 'again', label: t('gameRestaurant.again'), tone: 'neutral' as const, run: resetOrder },
            ...nextStep,
          ]
        : [
            { id: 'card', label: t('gameRestaurant.drawCard'), tone: 'primary' as const, run: drawCard },
            { id: 'switch', label: 'Switch!', tone: 'good' as const, run: switchRoles },
          ],
  );

  const pill = { fontSize: 'clamp(11px, 1.9cqw, 26px)' };
  const bf = { fontSize: 'clamp(11px, 1.7cqw, 22px)' };
  const btn = 'rs-btn rounded-full px-[1.8cqw] py-[0.7cqw] font-bold text-white shadow-lg';
  const serverText = rest.lines.filter((l) => l.who === 'server');
  const customerText = rest.lines.filter((l) => l.who === 'customer');

  return (
    <div className="space-y-3">
      <style>{STYLE}</style>

      <div className="flex flex-wrap items-center gap-2">
        {list.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRestId(r.id)}
            className="rounded-full px-4 py-2 font-label-md text-label-md transition-colors"
            style={{
              background: rest.id === r.id ? r.color : 'transparent',
              color: rest.id === r.id ? '#fff' : undefined,
              border: rest.id === r.id ? `1px solid ${r.color}` : '1px solid rgba(120,120,120,.35)',
            }}
          >
            {t('gameRestaurant.levelN', { n: r.level })} · {r.ko}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-outline-variant/60" />
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
            {i + 1}. {t(`gameRestaurant.step_${s}`)}
          </button>
        ))}
      </div>

      <div
        className="relative w-full overflow-hidden rounded-[24px] shadow-lg"
        style={{ aspectRatio: '16 / 9', containerType: 'size', background: `#fde68a url(${IMG(rest.scene)}) center / cover no-repeat` }}
      >
        <div className="absolute left-0 right-0 top-[2.2%] z-20 text-center">
          <span className="inline-block max-w-[92%] rounded-full bg-white/92 px-[2.4cqw] py-[0.6cqw] font-bold text-slate-800 shadow" style={pill}>
            {step === 'menu' ? rest.welcome : t(`gameRestaurant.hint_${step}`)}
          </span>
        </div>

        {/* ① 메뉴 */}
        {step === 'menu' && (
          <>
            <div
              className="absolute z-10 overflow-hidden rounded-[1.6cqw] border-[0.4cqw] shadow-xl"
              style={{ left: '4%', right: '4%', top: '12%', bottom: '10%', background: 'rgba(255,243,176,.97)', borderColor: rest.color }}
            >
              <div className="text-center font-black text-slate-900" style={{ fontSize: 'clamp(14px, 2.8cqw, 38px)', lineHeight: 1.2, paddingTop: '0.6cqw' }}>
                {rest.menuTitle}
              </div>
              <div
                className="grid gap-x-[1.4cqw] gap-y-[0.8cqw] px-[1.6cqw] pb-[0.8cqw]"
                style={{ gridTemplateColumns: `repeat(${rest.sections.length >= 3 && !rest.sections.some((s) => s.wide) ? 3 : 2}, minmax(0, 1fr))`, height: 'calc(100% - 4.4cqw)', alignContent: 'space-evenly' }}
              >
                {rest.sections.map((s) => (
                  <div key={s.id} className="min-w-0" style={{ gridColumn: s.wide ? '1 / -1' : undefined }}>
                    <div className="mb-[0.5cqw] flex justify-center">
                      <span className="rounded-[0.9cqw] px-[1.6cqw] py-[0.2cqw] font-black text-white" style={{ background: rest.color, fontSize: 'clamp(11px, 1.8cqw, 24px)' }}>
                        {s.title}
                        {showKo ? ` · ${s.ko}` : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-start justify-center gap-[0.8cqw]">
                      {s.items.map((it) => (
                        <button
                          key={it.name}
                          type="button"
                          onClick={() => {
                            playSfx(GAME_SFX.restaurant.pick);
                            speak(it.name);
                          }}
                          className="rs-btn flex flex-col items-center"
                          style={{ width: s.items.length >= 5 ? '9.6cqw' : s.wide ? '10.5cqw' : '11.5cqw' }}
                        >
                          <img src={IMG(it.art)} alt="" className="object-contain drop-shadow" style={{ height: s.wide ? '8cqw' : '9cqw', maxWidth: '100%' }} draggable={false} />
                          <span className="mt-[0.2cqw] text-center font-bold leading-tight text-slate-900" style={{ fontSize: 'clamp(9px, 1.35cqw, 18px)' }}>
                            {it.name}
                          </span>
                          {showKo && (
                            <span className="text-center text-indigo-700" style={{ fontSize: 'clamp(8px, 1.05cqw, 14px)' }}>
                              {it.ko}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-[2%] z-20 flex justify-center gap-[0.8cqw]">
              <button type="button" onClick={() => setShowKo((v) => !v)} className={btn} style={{ ...bf, background: showKo ? '#8b5cf6' : '#64748b' }}>
                {t('gameRestaurant.koToggle')}
              </button>
              <button type="button" onClick={() => setStep('order')} className={btn} style={{ ...bf, background: '#16a34a' }}>
                {t('gameRestaurant.toOrder')} ▶
              </button>
            </div>
          </>
        )}

        {/* ② 주문하기 */}
        {step === 'order' && (
          <>
            {/* 대화 */}
            <div
              ref={chatRef}
              className="absolute z-10 flex flex-col gap-[0.7cqw] overflow-y-auto rounded-[1.6cqw] bg-white/82 p-[1.2cqw] shadow-xl"
              style={{ left: '2%', width: '46%', top: '11.5%', bottom: '11%' }}
            >
              {rest.lines.slice(0, shown).map((l, i) => {
                const server = l.who === 'server';
                return (
                  <div key={i} className={`rs-anim flex items-end gap-[0.8cqw] ${server ? '' : 'flex-row-reverse'}`} style={{ animation: 'rs-rise .3s both' }}>
                    <img src={IMG(server ? rest.server : rest.customer)} alt="" className="shrink-0 object-contain" style={{ height: '7.5cqw' }} draggable={false} />
                    <button
                      type="button"
                      onClick={() => speak(lineText(i).replace('…', ''))}
                      className="rounded-[1.1cqw] border-[0.2cqw] px-[1cqw] py-[0.45cqw] text-left font-bold text-slate-800"
                      style={{ background: server ? '#fff7ed' : '#e0f2fe', borderColor: server ? '#fb923c' : '#38bdf8', fontSize: 'clamp(10px, 1.6cqw, 22px)' }}
                    >
                      <span className="block font-black" style={{ fontSize: '0.62em', color: server ? '#c2410c' : '#0369a1' }}>
                        {server ? 'Server' : 'Customer'}
                      </span>
                      {lineText(i)}
                      {showKo && (
                        <span className="block font-normal text-slate-500" style={{ fontSize: '0.66em' }}>
                          {fillLine(l.ko, picks[i]?.ko ?? null)}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
              {shown === 0 && (
                <div className="m-auto text-center font-bold text-slate-500" style={{ fontSize: 'clamp(10px, 1.6cqw, 22px)' }}>
                  {t('gameRestaurant.startHint')}
                </div>
              )}
            </div>

            {/* 메뉴에서 고르기 */}
            <div className="absolute z-10 flex flex-col gap-[0.8cqw]" style={{ left: '50%', right: '2%', top: '11.5%', bottom: '11%' }}>
              <div className="flex-1 overflow-y-auto rounded-[1.6cqw] bg-amber-50/95 p-[1cqw] shadow-xl">
                {waitingPick && lastLine ? (
                  <>
                    <div className="mb-[0.6cqw] text-center font-black text-slate-800" style={{ fontSize: 'clamp(10px, 1.6cqw, 22px)' }}>
                      {t('gameRestaurant.chooseOne')}
                    </div>
                    <div className="flex flex-wrap justify-center gap-[0.8cqw]">
                      {pickChoices(rest, lastLine).map(({ item }) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => choose(item)}
                          className="rs-btn rs-anim flex flex-col items-center rounded-[1cqw] border-[0.25cqw] border-white bg-white/90 p-[0.5cqw] shadow"
                          style={{ width: '10cqw', animation: 'rs-glow 1.6s ease-in-out infinite' }}
                        >
                          <img src={IMG(item.art)} alt="" className="object-contain" style={{ height: '7cqw' }} draggable={false} />
                          <span className="text-center font-bold leading-tight text-slate-900" style={{ fontSize: 'clamp(9px, 1.3cqw, 17px)' }}>
                            {item.name}
                          </span>
                          {showKo && <span className="text-indigo-700" style={{ fontSize: 'clamp(8px, 1cqw, 13px)' }}>{item.ko}</span>}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-[0.6cqw] text-center">
                    <img src={IMG('notepad')} alt="" className="object-contain" style={{ height: '9cqw' }} draggable={false} />
                    <div className="font-black text-slate-700" style={{ fontSize: 'clamp(11px, 1.7cqw, 24px)' }}>
                      {finished ? t('gameRestaurant.done') : t('gameRestaurant.waiting')}
                    </div>
                  </div>
                )}
              </div>

              {/* 주문서 */}
              <div className="shrink-0 rounded-[1.4cqw] bg-white/92 px-[1.2cqw] py-[0.7cqw] shadow-xl" style={{ minHeight: '10cqw' }}>
                <div className="font-black text-slate-700" style={{ fontSize: 'clamp(9px, 1.3cqw, 18px)' }}>
                  🧾 {t('gameRestaurant.orderSlip')}
                </div>
                <div className="mt-[0.3cqw] flex flex-wrap items-center gap-[0.8cqw]">
                  {order.length === 0 ? (
                    <span className="text-slate-400" style={{ fontSize: 'clamp(9px, 1.2cqw, 16px)' }}>
                      {t('gameRestaurant.slipEmpty')}
                    </span>
                  ) : (
                    order.map(({ item, i }) => (
                      <div key={i} className="rs-anim flex items-center gap-[0.4cqw] rounded-full bg-amber-100 px-[0.8cqw] py-[0.2cqw]" style={{ animation: 'rs-pop .35s both' }}>
                        <img src={IMG(item!.art)} alt="" className="object-contain" style={{ height: '3.4cqw' }} draggable={false} />
                        <span className="font-bold text-slate-800" style={{ fontSize: 'clamp(9px, 1.25cqw, 17px)' }}>
                          {item!.name}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-[2%] z-20 flex justify-center gap-[0.8cqw]">
              <button type="button" onClick={nextLine} disabled={waitingPick || shown >= rest.lines.length} className={`${btn} disabled:opacity-40`} style={{ ...bf, background: '#6366f1' }}>
                {shown === 0 ? t('gameRestaurant.start') : t('gameRestaurant.nextLine')} ▶
              </button>
              {waitingPick && (
                <button type="button" onClick={autoPick} className={btn} style={{ ...bf, background: '#0ea5a4' }}>
                  🎲 {t('gameRestaurant.autoPick')}
                </button>
              )}
              <button type="button" onClick={resetOrder} className={btn} style={{ ...bf, background: '#64748b' }}>
                {t('gameRestaurant.again')}
              </button>
              <button type="button" onClick={() => setShowKo((v) => !v)} className={btn} style={{ ...bf, background: showKo ? '#8b5cf6' : '#64748b' }}>
                {t('gameRestaurant.koToggle')}
              </button>
              {finished && (
                <button type="button" onClick={() => setStep('practice')} className={btn} style={{ ...bf, background: '#16a34a' }}>
                  {t('gameRestaurant.toPractice')} ▶
                </button>
              )}
            </div>
          </>
        )}

        {/* ③ 짝 연습 */}
        {step === 'practice' && (
          <>
            {([0, 1] as const).map((side) => {
              // side 0 = Partner A(왼쪽), 1 = Partner B(오른쪽). 처음엔 A=서버, B=손님이고 Switch! 로 바뀐다.
              const isServer = (side === 0) !== swapped;
              const lines = isServer ? serverText : customerText;
              return (
                <div
                  key={side}
                  className="rs-anim absolute z-10 flex flex-col rounded-[1.6cqw] bg-white/88 p-[1cqw] shadow-xl"
                  style={{ [side === 0 ? 'left' : 'right']: '2%', width: '46%', top: '11.5%', bottom: '12%' }}
                >
                  <div className="flex items-center gap-[1cqw]">
                    <img src={IMG(isServer ? rest.server : rest.customer)} alt="" className="object-contain" style={{ height: '13cqw' }} draggable={false} />
                    <div>
                      <div className="font-black text-slate-500" style={{ fontSize: 'clamp(10px, 1.5cqw, 20px)' }}>
                        Partner {side === 0 ? 'A' : 'B'}:
                      </div>
                      <div className="rounded-full px-[1.4cqw] py-[0.3cqw] font-black text-white" style={{ background: isServer ? '#ea580c' : '#0284c7', fontSize: 'clamp(12px, 2.2cqw, 30px)' }}>
                        {isServer ? 'Server' : 'Customer'}
                      </div>
                      <div className="mt-[0.4cqw] text-slate-600" style={{ fontSize: 'clamp(9px, 1.3cqw, 18px)' }}>
                        {isServer ? t('gameRestaurant.askPartner') : t('gameRestaurant.tellPartner')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-[0.8cqw] flex flex-1 flex-col justify-evenly gap-[0.5cqw] overflow-y-auto">
                    {lines.map((l, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => speak(l.text.replace('{}', '').replace('…', ''))}
                        className="rounded-[1cqw] border-[0.2cqw] px-[1cqw] py-[0.4cqw] text-left font-bold text-slate-800"
                        style={{ background: isServer ? '#fff7ed' : '#e0f2fe', borderColor: isServer ? '#fb923c' : '#38bdf8', fontSize: 'clamp(10px, 1.5cqw, 20px)' }}
                      >
                        {l.text.replace('{}', '______')}
                        {showKo && (
                          <span className="block font-normal text-slate-500" style={{ fontSize: '0.68em' }}>
                            {l.ko.replace('{}', '____')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 가운데: 주문 카드 */}
            {card && (
              <div className="rs-anim absolute left-1/2 top-[31%] z-20 -translate-x-1/2 rounded-[1.4cqw] bg-amber-50 px-[1.2cqw] py-[0.8cqw] shadow-2xl" style={{ animation: 'rs-pop .4s both', width: '18cqw' }}>
                <div className="text-center font-black text-slate-700" style={{ fontSize: 'clamp(9px, 1.3cqw, 17px)' }}>
                  🧾 {t('gameRestaurant.yourOrder')}
                </div>
                <div className="mt-[0.4cqw] flex flex-wrap justify-center gap-[0.6cqw]">
                  {card.map((c, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <img src={IMG(c.art)} alt="" className="object-contain" style={{ height: '5.4cqw' }} draggable={false} />
                      <span className="text-center font-bold text-slate-800" style={{ fontSize: 'clamp(8px, 1.05cqw, 14px)' }}>
                        {c.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-[2%] z-20 flex justify-center gap-[0.8cqw]">
              <button type="button" onClick={drawCard} className={btn} style={{ ...bf, background: '#6366f1' }}>
                🎲 {t('gameRestaurant.drawCard')}
              </button>
              <button type="button" onClick={switchRoles} className={`${btn} rs-anim`} style={{ ...bf, background: '#16a34a' }}>
                Switch! 🔄
              </button>
              <button type="button" onClick={() => setShowKo((v) => !v)} className={btn} style={{ ...bf, background: showKo ? '#8b5cf6' : '#64748b' }}>
                {t('gameRestaurant.koToggle')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
