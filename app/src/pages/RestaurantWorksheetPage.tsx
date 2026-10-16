import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import PresentPrintBar from '../components/PresentPrintBar';
import { usePresenting } from '../context/LessonRunnerContext';
import { RESTAURANTS, fillLine, pickChoices, type MenuItem, type Restaurant } from '../lib/restaurantRoleplay';

/**
 * 레스토랑 롤플레이 워크시트(2026-10-15) — 게임(`/games/restaurant`)과 같은 메뉴·대화로 만드는 인쇄물 4종.
 * ① 메뉴판(PPT 노트: "메뉴를 인쇄해 반복 연습") ② 주문 대화 빈칸(낱말 상자) ③ 주문서(서버가 받아 적기)
 * ④ 짝 연습 카드(서버·손님 역할 카드 + 주문 카드, 오려 쓴다). 한 장은 A4(내용 273mm) 안에 들어간다.
 */

type Tab = 'menu' | 'dialogue' | 'pad' | 'cards';
const TABS: Tab[] = ['menu', 'dialogue', 'pad', 'cards'];
const IMG = (n: string) => `/skins/restaurant/${n}.webp`;

function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export default function RestaurantWorksheetPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const presenting = usePresenting();
  const initial = ((location.state as { materialsTab?: string } | null)?.materialsTab as Tab | undefined) ?? 'menu';
  const [tab, setTab] = useState<Tab>(TABS.includes(initial) ? initial : 'menu');
  const [seed, setSeed] = useState(1);
  const [ko, setKo] = useState(true);

  const head = (title: string, sub: string, color: string) => (
    <div className="mb-[4mm] flex items-end justify-between border-b-[0.7mm] pb-[2mm]" style={{ borderColor: color }}>
      <div>
        <div className="font-black text-deep-navy" style={{ fontSize: '9mm', lineHeight: 1.1 }}>
          {title}
        </div>
        <div className="mt-[1mm] text-[4.2mm] text-slate-600">{sub}</div>
      </div>
      <div className="text-[4.4mm] text-slate-600">
        {t('materials.restaurant.name')} ____________ &nbsp; {t('materials.restaurant.date')} ______
      </div>
    </div>
  );

  const menuPage = (r: Restaurant) => {
    const total = r.sections.reduce((a, x) => a + x.items.length, 0);
    const imgH = total > 14 ? 15 : 21;
    return (
    <div key={`menu-${r.id}`} className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head(r.menuTitle, `${t('materials.restaurant.levelN', { n: r.level })} · ${r.ko}`, r.color)}
        <div className="space-y-[4mm]">
          {r.sections.map((s) => (
            <div key={s.id}>
              <span className="inline-block rounded-[2mm] px-[4mm] py-[0.8mm] text-[5.4mm] font-black text-white" style={{ background: r.color }}>
                {s.title}
                {ko ? ` · ${s.ko}` : ''}
              </span>
              <div className="mt-[2mm] grid grid-cols-4 gap-x-[3mm] gap-y-[2mm]">
                {s.items.map((it) => (
                  <div key={it.name} className="flex flex-col items-center text-center">
                    <img src={IMG(it.art)} alt="" className="object-contain" style={{ height: `${imgH}mm` }} draggable={false} />
                    <div className="text-[4.4mm] font-bold leading-tight text-slate-900">{it.name}</div>
                    {ko && <div className="text-[3.4mm] text-slate-500">{it.ko}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    );
  };

  const dialoguePage = (r: Restaurant) => {
    const bank: MenuItem[] = [];
    r.lines.forEach((l) => pickChoices(r, l).forEach(({ item }) => bank.every((b) => b.name !== item.name) && bank.push(item)));
    return (
      <div key={`dlg-${r.id}`} className="print-sheet print-board mx-auto">
        <div className="mx-auto w-full max-w-[186mm]">
          {head(`${r.menuTitle} — ${t('materials.restaurant.dialogueTitle')}`, t('materials.restaurant.dialogueSub'), r.color)}
          <div className="mb-[4mm] flex flex-wrap items-center gap-[2.4mm] rounded-[3mm] bg-amber-50 px-[3mm] py-[2mm] text-[4.2mm]">
            <span className="font-bold text-deep-navy">{t('materials.restaurant.wordBox')}</span>
            {bank.map((b) => (
              <span key={b.name} className="rounded-full border-[0.4mm] border-amber-500 bg-white px-[2.6mm] py-[0.5mm] font-bold">
                {b.name}
              </span>
            ))}
          </div>
          <div className="space-y-[2.6mm]">
            {r.lines.map((l, i) => {
              const server = l.who === 'server';
              return (
                <div key={i} className={`flex ${server ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className="rounded-[3mm] border-[0.4mm] px-[4mm] py-[2mm]"
                    style={{ maxWidth: '86%', background: server ? '#fff7ed' : '#e0f2fe', borderColor: server ? '#fb923c' : '#38bdf8', fontSize: '5mm', lineHeight: 1.4 }}
                  >
                    <span className="mr-[1.6mm] font-black" style={{ fontSize: '3.8mm', color: server ? '#c2410c' : '#0369a1' }}>
                      {server ? 'Server' : 'Customer'}:
                    </span>
                    {l.pick ? (
                      <>
                        {l.text.split('{}')[0]}
                        <span className="mx-[1mm] inline-block border-b-[0.5mm] border-slate-700 align-bottom" style={{ minWidth: '34mm' }}>
                          &nbsp;
                        </span>
                        {l.text.split('{}')[1]}
                      </>
                    ) : (
                      l.text
                    )}
                    {ko && <div className="text-slate-500" style={{ fontSize: '3.6mm' }}>{fillLine(l.ko, '____')}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-[5mm] text-[4.2mm] text-slate-500">{t('materials.restaurant.dialogueTip')}</div>
        </div>
      </div>
    );
  };

  const padPage = (r: Restaurant) => {
    const pickSections = [...new Set(r.lines.flatMap((l) => l.pick ?? []))].map((id) => r.sections.find((s) => s.id === id)!).filter(Boolean);
    const pad = (n: number) => (
      <div key={n} className="rounded-[3mm] border-[0.6mm] border-dashed p-[4mm]" style={{ borderColor: r.color }}>
        <div className="flex items-center justify-between text-[5mm] font-black text-deep-navy">
          <span>🧾 {t('materials.restaurant.padTitle')}</span>
          <span className="text-[4.2mm] font-normal text-slate-600">
            {t('materials.restaurant.table')} ____ &nbsp; {t('materials.restaurant.customer')} ____________
          </span>
        </div>
        <div className="mt-[3mm] space-y-[2.6mm]">
          {pickSections.map((s) => (
            <div key={s.id} className="flex items-baseline gap-[3mm] text-[5mm]">
              <span className="w-[34mm] shrink-0 font-bold" style={{ color: r.color }}>
                {s.title}
              </span>
              <span className="flex-1 border-b-[0.4mm] border-slate-400">&nbsp;</span>
            </div>
          ))}
        </div>
      </div>
    );
    return (
      <div key={`pad-${r.id}`} className="print-sheet print-board mx-auto">
        <div className="mx-auto w-full max-w-[186mm]">
          {head(`${r.menuTitle} — ${t('materials.restaurant.padHeading')}`, t('materials.restaurant.padSub'), r.color)}
          <div className="space-y-[5mm]">{[0, 1, 2].map((n) => pad(n))}</div>
        </div>
      </div>
    );
  };

  /* 짝 연습 카드: 역할 카드 + 주문 카드(시드로 고정) */
  const orderCards = useMemo(() => {
    const out: { r: Restaurant; items: MenuItem[] }[] = [];
    RESTAURANTS.forEach((r, ri) => {
      const rand = rng(seed * 7 + ri * 13 + 1);
      for (let k = 0; k < 3; k++) {
        const items = r.lines
          .filter((l) => l.who === 'customer' && l.pick)
          .map((l) => {
            const ch = pickChoices(r, l);
            return ch[Math.floor(rand() * ch.length)].item;
          });
        out.push({ r, items });
      }
    });
    return out;
  }, [seed]);

  const cardsPages = () => (
    <>
      <div key="roles" className="print-sheet print-board mx-auto">
        <div className="mx-auto w-full max-w-[186mm]">
          {head(t('materials.restaurant.rolesTitle'), t('materials.restaurant.rolesSub'), '#0f766e')}
          <div className="grid grid-cols-2 gap-[3mm]" style={{ gridAutoRows: '52mm' }}>
            {RESTAURANTS.flatMap((r) =>
              (['server', 'customer'] as const).map((role) => (
                <div
                  key={`${r.id}-${role}`}
                  className="print-card relative flex items-center gap-[3mm] overflow-hidden rounded-[3.4mm] border-[0.6mm] border-dashed bg-white p-[3mm]"
                  style={{ borderColor: r.color }}
                >
                  <span className="absolute left-[2mm] top-[1mm] text-[3mm] font-bold text-slate-400">✂</span>
                  <img src={IMG(role === 'server' ? r.server : r.customer)} alt="" className="object-contain" style={{ height: '40mm' }} draggable={false} />
                  <div className="min-w-0">
                    <div className="text-[3.6mm] font-bold text-slate-500">
                      {r.menuTitle} · {t('materials.restaurant.levelN', { n: r.level })}
                    </div>
                    <div className="text-[7mm] font-black leading-tight" style={{ color: role === 'server' ? '#ea580c' : '#0284c7' }}>
                      {role === 'server' ? 'Server' : 'Customer'}
                    </div>
                    <div className="mt-[1mm] text-[4mm] leading-snug text-slate-700">
                      {role === 'server' ? r.lines.find((l) => l.who === 'server')?.text : r.lines.find((l) => l.who === 'customer')?.text}
                    </div>
                  </div>
                </div>
              )),
            )}
          </div>
        </div>
      </div>
      <div key="orders" className="print-sheet print-board mx-auto">
        <div className="mx-auto w-full max-w-[186mm]">
          {head(t('materials.restaurant.ordersTitle'), t('materials.restaurant.ordersSub'), '#be185d')}
          <div className="grid grid-cols-3 gap-[3mm]" style={{ gridAutoRows: '58mm' }}>
            {orderCards.map(({ r, items }, i) => (
              <div key={i} className="print-card relative flex flex-col overflow-hidden rounded-[3.4mm] border-[0.6mm] border-dashed bg-amber-50 p-[2.4mm]" style={{ borderColor: r.color }}>
                <span className="absolute left-[2mm] top-[1mm] text-[3mm] font-bold text-slate-400">✂</span>
                <div className="text-center text-[3.6mm] font-black" style={{ color: r.color }}>
                  {r.menuTitle}
                </div>
                <div className="mt-[1mm] grid flex-1 grid-cols-2 content-center gap-x-[1mm] gap-y-[1mm]">
                  {items.map((it, k) => (
                    <div key={k} className="flex flex-col items-center">
                      <img src={IMG(it.art)} alt="" className="object-contain" style={{ height: '13mm' }} draggable={false} />
                      <span className="text-center text-[3.2mm] font-bold leading-tight text-slate-800">{it.name}</span>
                    </div>
                  ))}
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
          <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
            {t('materials.restaurantName')}
          </h2>
        </>
      )}

      {presenting ? (
        <PresentPrintBar canPrint onReshuffle={reshuffle} />
      ) : (
        <div className="no-print bg-surface-container-lowest rounded-xl p-5 shadow-card space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="font-caption text-caption text-on-surface-variant mb-2">{t('materials.restaurant.kindLabel')}</div>
              <div className="flex flex-wrap bg-surface-container-low rounded-lg p-1 w-fit">
                {TABS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${tab === k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
                  >
                    {t(`materials.restaurant.kind_${k}`)}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 self-end font-label-md text-label-md text-on-surface">
              <input type="checkbox" checked={ko} onChange={(e) => setKo(e.target.checked)} />
              {t('materials.restaurant.showKo')}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {tab === 'cards' && (
              <button
                type="button"
                onClick={() => setSeed((s) => s + 1)}
                className="px-5 py-2.5 rounded-full border-2 border-secondary text-secondary hover:bg-secondary-container/40 font-label-md text-label-md transition-colors"
              >
                {t('materials.restaurant.reshuffle')}
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
            >
              {t('materials.printButton')}
            </button>
            <span className="font-caption text-caption text-on-surface-variant">{t('materials.restaurant.hint')}</span>
          </div>
        </div>
      )}

      {tab === 'menu' && RESTAURANTS.map(menuPage)}
      {tab === 'dialogue' && RESTAURANTS.map(dialoguePage)}
      {tab === 'pad' && RESTAURANTS.map(padPage)}
      {tab === 'cards' && cardsPages()}
    </div>
  );
}
