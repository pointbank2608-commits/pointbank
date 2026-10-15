import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import PresentPrintBar from '../components/PresentPrintBar';
import { usePresenting } from '../context/LessonRunnerContext';
import {
  AIRPORT_ARRIVALS,
  AIRPORT_DEPARTURES,
  AIRPORT_PLACES,
  AIRPORT_ROUTE,
  BOARD_QUESTIONS,
  DEFAULT_AIRPORT_WORDS,
  splitLine,
  type AirportPlace,
} from '../lib/airportRoleplay';

/**
 * 공항 롤플레이 워크시트(2026-10-15) — 게임(`/games/airport`)과 같은 대본·전광판으로 만드는 인쇄물 4종.
 * ① 대본 빈칸 채우기(낱말 상자 + 정답지) ② 대화 순서 맞추기(줄을 섞어 번호 붙이기) ③ 전광판 읽기(문제 4 + 직접 만들어 풀기 줄)
 * ④ 역할 카드(오려서 짝끼리 쓰는 장소·직원·손님 카드). 한 장은 A4(내용 273mm) 안에 들어간다.
 */

type Tab = 'cloze' | 'order' | 'board' | 'cards';
const TABS: Tab[] = ['cloze', 'order', 'board', 'cards'];

function shuffled<T>(a: T[], seed: number): T[] {
  // 시드가 같으면 같은 순서(미리보기 = 인쇄)
  const r = [...a];
  let s = seed * 9301 + 49297;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const LETTERS = 'ABCDEFGHIJ';

export default function AirportWorksheetPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const presenting = usePresenting();
  const initialTab = ((location.state as { materialsTab?: string } | null)?.materialsTab as Tab | undefined) ?? 'cloze';
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab) ? initialTab : 'cloze');
  const [seed, setSeed] = useState(1);
  const [answers, setAnswers] = useState(false);
  const [ko, setKo] = useState(true);

  const sheetHead = (title: string, sub: string) => (
    <div className="mb-[4mm] flex items-end justify-between border-b-[0.6mm] border-deep-navy pb-[2mm]">
      <div>
        <div className="font-black text-deep-navy" style={{ fontSize: '9mm', lineHeight: 1.1 }}>
          {title}
        </div>
        <div className="mt-[1mm] text-[4.2mm] text-slate-600">{sub}</div>
      </div>
      <div className="text-[4.4mm] text-slate-600">
        {t('materials.airport.name')} ____________ &nbsp; {t('materials.airport.date')} ______
      </div>
    </div>
  );

  /* ① 빈칸 채우기 — 장소마다 한 장 */
  const clozePage = (p: AirportPlace, withAnswers: boolean) => {
    const bank = [...new Set(p.lines.flatMap((l) => l.blank ?? []))];
    // 빈칸이 있는 줄만 원문 그대로 보이게 하면 너무 쉬워서, 모든 줄을 보이되 빈칸 낱말만 지운다
    return (
      <div key={`${p.id}-${withAnswers}`} className="print-sheet print-board mx-auto">
        <div className="mx-auto w-full max-w-[186mm]">
          {sheetHead(`${p.title} — ${t('materials.airport.clozeTitle')}`, withAnswers ? t('materials.airport.answerKey') : t('materials.airport.clozeSub'))}
          <div className="mb-[4mm] flex flex-wrap items-center gap-[3mm] rounded-[3mm] bg-amber-50 px-[4mm] py-[2.4mm] text-[4.6mm]">
            <span className="font-bold text-deep-navy">{t('materials.airport.wordBox')}</span>
            {bank.map((w) => (
              <span key={w} className="rounded-full border-[0.4mm] border-amber-500 bg-white px-[3mm] py-[0.6mm] font-bold">
                {w}
              </span>
            ))}
          </div>
          <div className="space-y-[3.4mm]">
            {p.lines.map((line, i) => {
              const segs = splitLine(line, true);
              const staff = line.who === 'staff';
              return (
                <div key={i} className={`flex ${staff ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className="rounded-[3mm] border-[0.4mm] px-[4mm] py-[2.2mm]"
                    style={{ maxWidth: '88%', background: staff ? '#ffedd5' : '#e0f2fe', borderColor: staff ? '#fb923c' : '#38bdf8', fontSize: '5mm', lineHeight: 1.5 }}
                  >
                    <span className="mr-[1.6mm] font-black" style={{ fontSize: '4mm', color: staff ? '#c2410c' : '#0369a1' }}>
                      {line.speaker}:
                    </span>
                    {segs.map((s, si) =>
                      s.hidden ? (
                        <span key={si} className="mx-[0.6mm] inline-block border-b-[0.5mm] border-slate-700 text-center align-bottom" style={{ minWidth: `${Math.max(16, s.text.length * 3.1)}mm` }}>
                          {withAnswers ? <span className="font-black text-emerald-700">{s.text}</span> : ' '}
                        </span>
                      ) : (
                        <span key={si}>{s.text}</span>
                      ),
                    )}
                    {ko && <div className="text-slate-500" style={{ fontSize: '3.6mm' }}>{line.ko}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* ② 순서 맞추기 — 한 장에 장소 하나(줄을 섞어 번호) */
  const orderPages = useMemo(
    () =>
      AIRPORT_PLACES.map((p) => {
        const idx = p.lines.map((_, i) => i);
        const mixed = shuffled(idx, seed + p.lines.length);
        // 섞인 결과가 그대로면 한 칸 민다
        if (mixed.every((v, i) => v === i)) mixed.push(mixed.shift() as number);
        return { p, mixed };
      }),
    [seed],
  );

  const orderPage = (p: AirportPlace, mixed: number[], withAnswers: boolean) => (
    <div key={`${p.id}-${withAnswers}`} className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {sheetHead(`${p.title} — ${t('materials.airport.orderTitle')}`, withAnswers ? t('materials.airport.answerKey') : t('materials.airport.orderSub'))}
        <div className="space-y-[3.2mm]">
          {mixed.map((lineIdx, pos) => {
            const line = p.lines[lineIdx];
            const staff = line.who === 'staff';
            return (
              <div key={pos} className="flex items-center gap-[3mm]">
                <div className="flex h-[10mm] w-[14mm] shrink-0 items-center justify-center rounded-[2mm] border-[0.5mm] border-slate-500 text-[6mm] font-black text-emerald-700">
                  {withAnswers ? lineIdx + 1 : ''}
                </div>
                <div
                  className="flex-1 rounded-[3mm] border-[0.4mm] px-[4mm] py-[2mm]"
                  style={{ background: staff ? '#ffedd5' : '#e0f2fe', borderColor: staff ? '#fb923c' : '#38bdf8', fontSize: '4.8mm', lineHeight: 1.45 }}
                >
                  <span className="mr-[1.6mm] font-black" style={{ fontSize: '3.8mm', color: staff ? '#c2410c' : '#0369a1' }}>
                    {LETTERS[pos]}. {line.speaker}:
                  </span>
                  {line.text}
                </div>
              </div>
            );
          })}
        </div>
        {!withAnswers && <div className="mt-[5mm] text-[4.2mm] text-slate-500">{t('materials.airport.orderTip')}</div>}
      </div>
    </div>
  );

  /* ③ 전광판 읽기 */
  const boardPage = (withAnswers: boolean) => (
    <div key={`board-${withAnswers}`} className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {sheetHead(t('materials.airport.boardTitle'), withAnswers ? t('materials.airport.answerKey') : t('materials.airport.boardSub'))}
        <div className="mb-[5mm] grid grid-cols-2 gap-[4mm]">
          {([['Arrivals', AIRPORT_ARRIVALS], ['Departures', AIRPORT_DEPARTURES]] as const).map(([title, rows]) => (
            <div key={title} className="overflow-hidden rounded-[2.4mm] border-[0.6mm] border-slate-900 bg-slate-800">
              <div className="bg-yellow-300 py-[1.2mm] text-center text-[6mm] font-black text-slate-900">{title}</div>
              {rows.map(([time, city]) => (
                <div key={time + city} className="flex gap-[3mm] border-t border-slate-600 px-[3mm] py-[1.2mm] text-[4.4mm] font-bold text-white">
                  <span className="w-[13mm] tabular-nums">{time}</span>
                  <span className="uppercase tracking-wide">{city}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-[3.6mm]">
          {BOARD_QUESTIONS.map((q, i) => (
            <div key={q.q} className="flex items-baseline gap-[3mm] text-[5mm]">
              <span className="font-black text-deep-navy">{i + 1}.</span>
              <span className="flex-1">
                {q.q}
                {ko && <span className="block text-[3.6mm] text-slate-500">{q.ko}</span>}
              </span>
              <span className="inline-block w-[42mm] border-b-[0.5mm] border-slate-700 text-center font-black text-emerald-700">{withAnswers ? q.answer : ' '}</span>
            </div>
          ))}
          <div className="mt-[3mm] rounded-[3mm] border-[0.4mm] border-dashed border-slate-400 px-[4mm] py-[3mm] text-[4.6mm]">
            <div className="font-bold text-deep-navy">{t('materials.airport.boardMake')}</div>
            <div className="mt-[3mm] border-b-[0.4mm] border-slate-400 py-[2.4mm]">Q. When does the flight to ______________ depart / arrive?</div>
            <div className="border-b-[0.4mm] border-slate-400 py-[2.4mm]">Q. Where is the flight departing / arriving at ______ going / coming from?</div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ④ 역할 카드 — 한 장에 8장(2×4), 오려서 쓴다 */
  const cardsPage = () => {
    const cards: { place: AirportPlace; role: 'place' | 'staff' | 'customer' }[] = [];
    AIRPORT_PLACES.forEach((p) => {
      cards.push({ place: p, role: 'place' }, { place: p, role: 'staff' }, { place: p, role: 'customer' });
    });
    return (
      <div key="cards" className="print-sheet print-board mx-auto">
        <div className="mx-auto w-full max-w-[186mm]">
          {sheetHead(t('materials.airport.cardsTitle'), t('materials.airport.cardsSub'))}
          <div className="grid grid-cols-3 gap-[3mm]" style={{ gridAutoRows: '58mm' }}>
            {cards.map(({ place, role }, i) => {
              const color = role === 'place' ? place.color : role === 'staff' ? '#ea580c' : '#0284c7';
              const title = role === 'place' ? place.name : role === 'staff' ? place.staff : 'Customer';
              const art = role === 'place' ? place.art : role === 'staff' ? place.staffArt : 'traveler';
              const first = role === 'staff' ? place.lines.find((l) => l.who === 'staff') : role === 'customer' ? place.lines.find((l) => l.who === 'customer') : null;
              return (
                <div key={i} className="print-card relative flex flex-col items-center justify-between overflow-hidden rounded-[3.4mm] border-[0.6mm] border-dashed bg-white p-[2.4mm] text-center" style={{ borderColor: color }}>
                  <span className="absolute left-[2mm] top-[1mm] text-[3mm] font-bold text-slate-400">✂</span>
                  <img src={`/skins/airport/${art}.webp`} alt="" className="object-contain" style={{ height: '27mm' }} draggable={false} />
                  <div className="font-black leading-tight" style={{ fontSize: '5.2mm', color }}>
                    {title}
                  </div>
                  <div className="text-[3.4mm] leading-tight text-slate-600">
                    {role === 'place' ? place.ko : first ? `“${first.text}”` : ''}
                  </div>
                </div>
              );
            })}
            {/* 낱말 카드 */}
            {DEFAULT_AIRPORT_WORDS.slice(0, 5).map((w) => (
              <div key={w.word} className="print-card relative flex flex-col items-center justify-between overflow-hidden rounded-[3.4mm] border-[0.6mm] border-dashed border-amber-500 bg-amber-50 p-[2.4mm] text-center">
                <span className="absolute left-[2mm] top-[1mm] text-[3mm] font-bold text-slate-400">✂</span>
                <img src={`/skins/airport/${w.art}.webp`} alt="" className="object-contain" style={{ height: '27mm' }} draggable={false} />
                <div className="font-black leading-tight text-deep-navy" style={{ fontSize: '4.6mm' }}>
                  {w.word}
                </div>
                <div className="text-[3.6mm] text-slate-600">{w.ko}</div>
              </div>
            ))}
          </div>
          <div className="mt-[3mm] text-[4mm] text-slate-500">{AIRPORT_ROUTE.map((r) => r.name).join(' → ')}</div>
        </div>
      </div>
    );
  };

  const reshuffle = tab === 'order' ? () => setSeed((s) => s + 1) : undefined;

  return (
    <div className="space-y-6">
      {!presenting && (
        <>
          <Link to="/materials" className="no-print inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
            {t('materials.backToMaterials')}
          </Link>
          <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
            {t('materials.airportName')}
          </h2>
        </>
      )}

      {presenting ? (
        <PresentPrintBar canPrint onReshuffle={reshuffle}>
          <label className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface">
            <input type="checkbox" checked={answers} onChange={(e) => setAnswers(e.target.checked)} />
            {t('materials.airport.withAnswers')}
          </label>
        </PresentPrintBar>
      ) : (
        <div className="no-print bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="font-caption text-caption text-on-surface-variant mb-2">{t('materials.airport.kindLabel')}</div>
              <div className="flex flex-wrap bg-surface-container-low rounded-lg p-1 w-fit">
                {TABS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${tab === k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
                  >
                    {t(`materials.airport.kind_${k}`)}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 self-end font-label-md text-label-md text-on-surface">
              <input type="checkbox" checked={ko} onChange={(e) => setKo(e.target.checked)} />
              {t('materials.airport.showKo')}
            </label>
            <label className="flex items-center gap-2 self-end font-label-md text-label-md text-on-surface">
              <input type="checkbox" checked={answers} onChange={(e) => setAnswers(e.target.checked)} />
              {t('materials.airport.withAnswers')}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {tab === 'order' && (
              <button
                type="button"
                onClick={() => setSeed((s) => s + 1)}
                className="px-5 py-2.5 rounded-full border-2 border-secondary text-secondary hover:bg-secondary-container/40 font-label-md text-label-md transition-colors"
              >
                {t('materials.airport.reshuffle')}
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
            >
              {t('materials.printButton')}
            </button>
            <span className="font-caption text-caption text-on-surface-variant">{t('materials.airport.hint')}</span>
          </div>
        </div>
      )}

      {tab === 'cloze' && (
        <>
          {AIRPORT_PLACES.map((p) => clozePage(p, false))}
          {answers && AIRPORT_PLACES.map((p) => clozePage(p, true))}
        </>
      )}
      {tab === 'order' && (
        <>
          {orderPages.map(({ p, mixed }) => orderPage(p, mixed, false))}
          {answers && orderPages.map(({ p, mixed }) => orderPage(p, mixed, true))}
        </>
      )}
      {tab === 'board' && (
        <>
          {boardPage(false)}
          {answers && boardPage(true)}
        </>
      )}
      {tab === 'cards' && cardsPage()}
    </div>
  );
}
