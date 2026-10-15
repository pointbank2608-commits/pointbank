import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import PresentPrintBar from '../components/PresentPrintBar';
import { usePresenting } from '../context/LessonRunnerContext';
import { FLAVOURS, REMEMBER_LINES, SIZES, STYLES, TOPPINGS, rememberSegments } from '../lib/iceCreamShop';

/**
 * 아이스크림 가게 워크시트(2026-10-15) — 게임(`/games/icecream`)과 같은 메뉴·대화로 만드는 인쇄물 4종.
 * ① 메뉴판 ② 대화 빈칸(PPT 10번 "Can you remember the conversation?") ③ 내 아이스크림 주문서(고르고 색칠)
 * ④ 점원·손님 카드와 주문 카드(오려 쓴다). 한 장은 A4(내용 273mm) 안에 들어간다.
 */

type Tab = 'menu' | 'dialogue' | 'order' | 'cards';
const TABS: Tab[] = ['menu', 'dialogue', 'order', 'cards'];
const IMG = (n: string) => `/skins/icecream/${n}.webp`;
const PINK = '#ec4899';

function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export default function IceCreamWorksheetPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const presenting = usePresenting();
  const initial = ((location.state as { materialsTab?: string } | null)?.materialsTab as Tab | undefined) ?? 'menu';
  const [tab, setTab] = useState<Tab>(TABS.includes(initial) ? initial : 'menu');
  const [seed, setSeed] = useState(1);
  const [ko, setKo] = useState(true);

  const head = (title: string, sub: string) => (
    <div className="mb-[4mm] flex items-end justify-between border-b-[0.7mm] pb-[2mm]" style={{ borderColor: PINK }}>
      <div>
        <div className="font-black text-deep-navy" style={{ fontSize: '9mm', lineHeight: 1.1 }}>
          {title}
        </div>
        <div className="mt-[1mm] text-[4.2mm] text-slate-600">{sub}</div>
      </div>
      <div className="text-[4.4mm] text-slate-600">
        {t('materials.iceCream.name')} ____________ &nbsp; {t('materials.iceCream.date')} ______
      </div>
    </div>
  );

  const menuPage = (
    <div key="menu" className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head('Ice Cream Menu', t('materials.iceCream.menuSub'))}
        <div className="text-center text-[6mm] font-black" style={{ color: PINK }}>
          Flavours{ko ? ' · 맛' : ''}
        </div>
        <div className="mt-[2mm] grid grid-cols-3 gap-x-[4mm] gap-y-[3mm]">
          {FLAVOURS.map((f) => (
            <div key={f.id} className="flex flex-col items-center">
              <img src={IMG(f.art)} alt="" className="object-contain" style={{ height: '22mm' }} draggable={false} />
              <div className="text-[4.6mm] font-bold">{f.name}</div>
              {ko && <div className="text-[3.4mm] text-slate-500">{f.ko}</div>}
            </div>
          ))}
        </div>
        <div className="mt-[5mm] grid grid-cols-3 gap-[4mm]">
          <div>
            <div className="text-center text-[5.4mm] font-black" style={{ color: PINK }}>Sizes</div>
            {SIZES.map((s) => (
              <div key={s.id} className="mt-[1.4mm] text-[4.4mm]">
                <b>{s.name}</b> ({s.scoops} scoop{s.scoops > 1 ? 's' : ''}) {s.price}
              </div>
            ))}
          </div>
          <div>
            <div className="text-center text-[5.4mm] font-black" style={{ color: PINK }}>Style</div>
            <div className="mt-[1.4mm] flex justify-around">
              {STYLES.map((s) => (
                <div key={s.id} className="flex flex-col items-center">
                  <img src={IMG(s.art)} alt="" className="object-contain" style={{ height: '17mm' }} draggable={false} />
                  <span className="text-[4.4mm] font-bold">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-center text-[5.4mm] font-black" style={{ color: PINK }}>Toppings</div>
            <div className="mt-[1.4mm] flex justify-around">
              {TOPPINGS.map((tp) => (
                <div key={tp.id} className="flex flex-col items-center text-center">
                  <img src={IMG(tp.art)} alt="" className="object-contain" style={{ height: '15mm' }} draggable={false} />
                  <span className="text-[3.2mm] font-bold leading-tight">{tp.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const dialoguePage = (
    <div key="dlg" className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head(t('materials.iceCream.dialogueTitle'), t('materials.iceCream.dialogueSub'))}
        <div className="mb-[4mm] flex flex-wrap items-center gap-[2.4mm] rounded-[3mm] bg-pink-50 px-[3mm] py-[2mm] text-[4.4mm]">
          <span className="font-bold text-deep-navy">{t('materials.iceCream.wordBox')}</span>
          {[...new Set(REMEMBER_LINES.flatMap((l) => l.blank))].map((w) => (
            <span key={w} className="rounded-full border-[0.4mm] border-pink-400 bg-white px-[2.6mm] py-[0.5mm] font-bold">
              {w}
            </span>
          ))}
        </div>
        <div className="space-y-[3.4mm]">
          {REMEMBER_LINES.map((l, i) => {
            const server = l.who === 'server';
            return (
              <div key={i} className={`flex ${server ? 'justify-start' : 'justify-end'}`}>
                <div className="rounded-[3mm] border-[0.4mm] px-[4mm] py-[2.2mm]" style={{ maxWidth: '88%', background: server ? '#fff1f2' : '#e0f2fe', borderColor: server ? '#fb7185' : '#38bdf8', fontSize: '5.2mm', lineHeight: 1.5 }}>
                  <span className="mr-[1.6mm] font-black" style={{ fontSize: '3.8mm', color: server ? '#be123c' : '#0369a1' }}>
                    {server ? 'Shop assistant' : 'Customer'}:
                  </span>
                  {rememberSegments(l).map((s, si) =>
                    s.hidden ? (
                      <span key={si} className="mx-[0.6mm] inline-block border-b-[0.5mm] border-slate-700 align-bottom" style={{ minWidth: `${Math.max(16, s.text.length * 3.2)}mm` }}>
                        &nbsp;
                      </span>
                    ) : (
                      <span key={si}>{s.text}</span>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-[5mm] text-[4.2mm] text-slate-500">{t('materials.iceCream.dialogueTip')}</div>
      </div>
    </div>
  );

  const orderPage = (
    <div key="order" className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head(t('materials.iceCream.orderTitle'), t('materials.iceCream.orderSub'))}
        <div className="grid grid-cols-2 gap-[5mm]">
          {[0, 1].map((n) => (
            <div key={n} className="rounded-[3mm] border-[0.6mm] border-dashed p-[4mm]" style={{ borderColor: PINK }}>
              <div className="text-[5.4mm] font-black text-deep-navy">🍦 {t('materials.iceCream.myIceCream')}</div>
              <div className="mt-[3mm] space-y-[2.4mm] text-[4.8mm]">
                <div>
                  <b>Size:</b> ○ small &nbsp; ○ medium &nbsp; ○ large
                </div>
                <div>
                  <b>Style:</b> ○ cone &nbsp; ○ tub
                </div>
                <div>
                  <b>Flavours:</b>
                  <div className="mt-[1mm] border-b-[0.4mm] border-slate-400">&nbsp;</div>
                  <div className="border-b-[0.4mm] border-slate-400">&nbsp;</div>
                  <div className="border-b-[0.4mm] border-slate-400">&nbsp;</div>
                </div>
                <div>
                  <b>Topping:</b> ○ hundreds and thousands ○ chocolate flake ○ chocolate sauce ○ none
                </div>
                <div className="font-bold">£ ________</div>
              </div>
              <div className="mt-[3mm] flex h-[70mm] items-center justify-center rounded-[3mm] border-[0.4mm] border-slate-300 text-[4mm] text-slate-400">
                {t('materials.iceCream.drawIt')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const roles = [
    { art: 'server-girl', role: 'Shop assistant', line: 'Hello, what can I get for you?', color: '#e11d48' },
    { art: 'server-boy', role: 'Shop assistant', line: 'Would you like any toppings?', color: '#e11d48' },
    { art: 'customer-girl', role: 'Customer', line: 'Can I get a large ice cream in a cone, please?', color: '#0284c7' },
    { art: 'customer-boy', role: 'Customer', line: 'Blueberry, raspberry and lemon, please.', color: '#0284c7' },
  ];
  const orders = useMemo(() => {
    const rand = rng(seed * 11 + 3);
    return Array.from({ length: 12 }, () => {
      const size = SIZES[Math.floor(rand() * SIZES.length)];
      const pool = [...FLAVOURS].sort(() => rand() - 0.5).slice(0, size.scoops);
      const style = STYLES[Math.floor(rand() * STYLES.length)];
      const tops = [...TOPPINGS.map((x) => x.name), 'no topping'];
      return { size, style, flavours: pool, topping: tops[Math.floor(rand() * tops.length)] };
    });
  }, [seed]);

  const cardsPages = (
    <>
      <div key="roles" className="print-sheet print-board mx-auto">
        <div className="mx-auto w-full max-w-[186mm]">
          {head(t('materials.iceCream.rolesTitle'), t('materials.iceCream.rolesSub'))}
          <div className="grid grid-cols-2 gap-[3mm]" style={{ gridAutoRows: '62mm' }}>
            {roles.map((r, i) => (
              <div key={i} className="print-card relative flex items-center gap-[3mm] overflow-hidden rounded-[3.4mm] border-[0.6mm] border-dashed bg-white p-[3mm]" style={{ borderColor: r.color }}>
                <span className="absolute left-[2mm] top-[1mm] text-[3mm] font-bold text-slate-400">✂</span>
                <img src={IMG(r.art)} alt="" className="object-contain" style={{ height: '50mm' }} draggable={false} />
                <div>
                  <div className="text-[6.4mm] font-black" style={{ color: r.color }}>{r.role}</div>
                  <div className="mt-[1mm] text-[4.2mm] leading-snug text-slate-700">“{r.line}”</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div key="orders" className="print-sheet print-board mx-auto">
        <div className="mx-auto w-full max-w-[186mm]">
          {head(t('materials.iceCream.ordersTitle'), t('materials.iceCream.ordersSub'))}
          <div className="grid grid-cols-3 gap-[3mm]" style={{ gridAutoRows: '58mm' }}>
            {orders.map((o, i) => (
              <div key={i} className="print-card relative flex flex-col items-center overflow-hidden rounded-[3.4mm] border-[0.6mm] border-dashed bg-pink-50 p-[2.4mm]" style={{ borderColor: PINK }}>
                <span className="absolute left-[2mm] top-[1mm] text-[3mm] font-bold text-slate-400">✂</span>
                <div className="flex flex-1 items-center gap-[1mm]">
                  {o.flavours.map((f) => (
                    <img key={f.id} src={IMG(f.art)} alt="" className="object-contain" style={{ height: '14mm' }} draggable={false} />
                  ))}
                </div>
                <div className="text-center text-[3.6mm] font-bold leading-tight text-slate-800">
                  {o.size.name} · {o.style.name}
                  <br />
                  {o.flavours.map((f) => f.name).join(', ')}
                  <br />
                  {o.topping}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const reshuffle = tab === 'cards' ? () => setSeed((s) => s + 1) : undefined;

  return (
    <div className="space-y-6">
      {!presenting && (
        <>
          <Link to="/materials" className="no-print inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
            {t('materials.backToMaterials')}
          </Link>
          <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">{t('materials.iceCreamName')}</h2>
        </>
      )}

      {presenting ? (
        <PresentPrintBar canPrint onReshuffle={reshuffle} />
      ) : (
        <div className="no-print bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="font-caption text-caption text-on-surface-variant mb-2">{t('materials.iceCream.kindLabel')}</div>
              <div className="flex flex-wrap bg-surface-container-low rounded-lg p-1 w-fit">
                {TABS.map((k) => (
                  <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${tab === k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
                    {t(`materials.iceCream.kind_${k}`)}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 self-end font-label-md text-label-md text-on-surface">
              <input type="checkbox" checked={ko} onChange={(e) => setKo(e.target.checked)} />
              {t('materials.iceCream.showKo')}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {tab === 'cards' && (
              <button type="button" onClick={() => setSeed((s) => s + 1)} className="px-5 py-2.5 rounded-full border-2 border-secondary text-secondary hover:bg-secondary-container/40 font-label-md text-label-md transition-colors">
                {t('materials.iceCream.reshuffle')}
              </button>
            )}
            <button type="button" onClick={() => window.print()} className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors">
              {t('materials.printButton')}
            </button>
            <span className="font-caption text-caption text-on-surface-variant">{t('materials.iceCream.hint')}</span>
          </div>
        </div>
      )}

      {tab === 'menu' && menuPage}
      {tab === 'dialogue' && dialoguePage}
      {tab === 'order' && orderPage}
      {tab === 'cards' && cardsPages}
    </div>
  );
}
