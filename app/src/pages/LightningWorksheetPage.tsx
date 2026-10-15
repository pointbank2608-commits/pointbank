import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import PresentPrintBar from '../components/PresentPrintBar';
import { usePresenting } from '../context/LessonRunnerContext';
import { LIGHTNING_SAMPLES } from '../lib/lightningLuck';

/**
 * 번개 피하기 워크시트(2026-10-16) — ① 읽기 카드(오려 쓰기) ② 서바이벌 기록지 ③ 빈칸 채우기 ④ 내가 번개를 맞으면?(그림+문장).
 * 한 장은 A4(내용 273mm) 안에 들어간다. 문장은 날씨·폭풍 기본 12개(게임 기본 문장과 같다).
 */
type Tab = 'cards' | 'score' | 'fill' | 'draw';
const TABS: Tab[] = ['cards', 'score', 'fill', 'draw'];
const INDIGO = '#4f46e5';

function shuffled<T>(a: T[], seed: number): T[] {
  const r = [...a];
  let s = seed * 9301 + 49297;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export default function LightningWorksheetPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const presenting = usePresenting();
  const initial = ((location.state as { materialsTab?: string } | null)?.materialsTab as Tab | undefined) ?? 'cards';
  const [tab, setTab] = useState<Tab>(TABS.includes(initial) ? initial : 'cards');
  const [seed, setSeed] = useState(1);
  const [ko, setKo] = useState(true);
  const [answers, setAnswers] = useState(false);
  const samples = LIGHTNING_SAMPLES;
  const wordBox = useMemo(() => shuffled(samples.map((s) => s.blank), seed), [seed, samples]);

  const head = (title: string, sub: string) => (
    <div className="mb-[4mm] flex items-end justify-between border-b-[0.7mm] pb-[2mm]" style={{ borderColor: INDIGO }}>
      <div>
        <div className="font-black text-deep-navy" style={{ fontSize: '9mm', lineHeight: 1.1 }}>{title}</div>
        <div className="mt-[1mm] text-[4.2mm] text-slate-600">{sub}</div>
      </div>
      <div className="text-[4.4mm] text-slate-600">
        {t('materials.lightning.name')} ____________ &nbsp; {t('materials.lightning.date')} ______
      </div>
    </div>
  );

  const cardsPage = (
    <div key="cards" className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head(t('materials.lightning.cardsTitle'), t('materials.lightning.cardsSub'))}
        <div className="grid grid-cols-2 gap-[3mm]" style={{ gridAutoRows: '36mm' }}>
          {samples.map((s, i) => (
            <div key={i} className="print-card relative flex flex-col items-center justify-center overflow-hidden rounded-[3.4mm] border-[0.6mm] border-dashed bg-indigo-50 p-[2.4mm] text-center" style={{ borderColor: INDIGO }}>
              <span className="absolute left-[2mm] top-[1mm] text-[3mm] font-bold text-slate-400">✂</span>
              <span className="absolute right-[2mm] top-[1mm] text-[4mm]">⚡</span>
              <div className="text-[7mm] font-black text-deep-navy">{s.en}</div>
              {ko && <div className="mt-[1mm] text-[4mm] text-indigo-600">{s.ko}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const rounds = 10;
  const rows = 20;
  const scorePage = (
    <div key="score" className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head(t('materials.lightning.scoreTitle'), t('materials.lightning.scoreSub'))}
        <table className="w-full border-collapse text-center text-[4mm]">
          <thead>
            <tr>
              <th className="border-[0.4mm] border-slate-400 bg-indigo-50 py-[1.4mm]">{t('materials.lightning.studentCol')}</th>
              <th className="border-[0.4mm] border-slate-400 bg-indigo-50">{t('materials.lightning.nameCol')}</th>
              {Array.from({ length: rounds }, (_, i) => (
                <th key={i} className="w-[10mm] border-[0.4mm] border-slate-400 bg-indigo-50">{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r} style={{ height: '10.5mm' }}>
                <td className="w-[14mm] border-[0.4mm] border-slate-400 font-bold">{r + 1}</td>
                <td className="border-[0.4mm] border-slate-400" />
                {Array.from({ length: rounds }, (_, i) => (
                  <td key={i} className="border-[0.4mm] border-slate-400" />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-[3mm] text-[3.8mm] text-slate-600">{t('materials.lightning.scoreLegend')}</div>
      </div>
    </div>
  );

  const fillPage = (
    <div key="fill" className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head(t('materials.lightning.fillTitle'), t('materials.lightning.fillSub'))}
        <div className="mb-[4mm] flex flex-wrap justify-center gap-[2mm] rounded-[3mm] bg-indigo-50 p-[3mm]">
          {wordBox.map((w) => (
            <span key={w} className="rounded-full border-[0.4mm] bg-white px-[3mm] py-[0.8mm] text-[4.4mm] font-bold" style={{ borderColor: INDIGO }}>{w}</span>
          ))}
        </div>
        <div className="space-y-[2.6mm]">
          {samples.map((s, i) => {
            const parts = s.en.split(new RegExp(`(${s.blank})`, 'i'));
            return (
              <div key={i} className="flex items-baseline gap-[3mm] text-[5.4mm]">
                <span className="w-[8mm] font-bold text-slate-500">{i + 1}.</span>
                <span>
                  {parts.map((p, k) =>
                    p.toLowerCase() === s.blank.toLowerCase() ? (
                      <span key={k} className="inline-block min-w-[30mm] border-b-[0.5mm] border-slate-600 text-center font-bold text-emerald-700">
                        {answers ? p : ' '}
                      </span>
                    ) : (
                      <span key={k}>{p}</span>
                    ),
                  )}
                </span>
                {ko && <span className="ml-auto text-[3.6mm] text-indigo-600">{s.ko}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const drawPage = (
    <div key="draw" className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head(t('materials.lightning.drawTitle'), t('materials.lightning.drawSub'))}
        <div className="flex h-[150mm] items-center justify-center rounded-[4mm] border-[0.7mm] border-dashed text-[5mm] text-slate-400" style={{ borderColor: INDIGO }}>
          {t('materials.lightning.drawBox')}
        </div>
        <div className="mt-[6mm] space-y-[7mm] text-[5.4mm]">
          <div>
            <b>Lightning strikes! I look like</b> <span className="inline-block w-[90mm] border-b-[0.5mm] border-slate-600">&nbsp;</span>.
          </div>
          <div>
            <b>I feel</b> <span className="inline-block w-[60mm] border-b-[0.5mm] border-slate-600">&nbsp;</span>. <b>My hair is</b> <span className="inline-block w-[50mm] border-b-[0.5mm] border-slate-600">&nbsp;</span>.
          </div>
          <div className="text-[4mm] text-slate-500">{t('materials.lightning.drawHint')}</div>
        </div>
      </div>
    </div>
  );

  const reshuffle = tab === 'fill' ? () => setSeed((s) => s + 1) : undefined;

  return (
    <div className="space-y-6">
      {!presenting && (
        <>
          <Link to="/materials" className="no-print inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
            {t('materials.backToMaterials')}
          </Link>
          <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">{t('materials.lightningName')}</h2>
        </>
      )}

      {presenting ? (
        <PresentPrintBar canPrint onReshuffle={reshuffle} />
      ) : (
        <div className="no-print bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="font-caption text-caption text-on-surface-variant mb-2">{t('materials.lightning.kindLabel')}</div>
              <div className="flex flex-wrap bg-surface-container-low rounded-lg p-1 w-fit">
                {TABS.map((k) => (
                  <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${tab === k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
                    {t(`materials.lightning.kind_${k}`)}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 self-end font-label-md text-label-md text-on-surface">
              <input type="checkbox" checked={ko} onChange={(e) => setKo(e.target.checked)} />
              {t('materials.lightning.showKo')}
            </label>
            <label className="flex items-center gap-2 self-end font-label-md text-label-md text-on-surface">
              <input type="checkbox" checked={answers} onChange={(e) => setAnswers(e.target.checked)} />
              {t('materials.lightning.withAnswers')}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {tab === 'fill' && (
              <button type="button" onClick={() => setSeed((s) => s + 1)} className="px-5 py-2.5 rounded-full border-2 border-secondary text-secondary hover:bg-secondary-container/40 font-label-md text-label-md transition-colors">
                {t('materials.lightning.reshuffle')}
              </button>
            )}
            <button type="button" onClick={() => window.print()} className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors">
              {t('materials.printButton')}
            </button>
            <span className="font-caption text-caption text-on-surface-variant">{t('materials.lightning.hint')}</span>
          </div>
        </div>
      )}

      {tab === 'cards' && cardsPage}
      {tab === 'score' && scorePage}
      {tab === 'fill' && fillPage}
      {tab === 'draw' && drawPage}
    </div>
  );
}
