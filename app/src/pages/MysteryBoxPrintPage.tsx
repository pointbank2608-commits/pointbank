import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import MaterialsWordPicker from '../components/MaterialsWordPicker';
import { wordsFromLocationState } from '../lib/materialsHandoff';
import { useMaterialsWordLists } from '../lib/useMaterialsWordLists';
import { blockLabel, isGood, rewardDeck, type Reward } from '../lib/mysteryBox';
import type { FullCardItem } from '../lib/types';

/**
 * 미스터리 박스 인쇄물(2026-10-14) — 게임을 종이로도 할 수 있게 한다.
 * ① 문제 카드: 칸 이름(A~) + 낱말·문장 + 정답/뜻 — 선생님 자료로 오려 쓴다
 * ② 보상 카드: 게임과 같은 28장 구성(점수 +·−, 바꾸기, 2배, 훔치기 …) — 뒤집어 놓고 칸에 하나씩 붙인다
 * 한 장(A4)에 카드 8장(2×4), 오리는 선이 있다. 내용 높이는 A4 한 장(273mm) 안.
 */

type Tab = 'records' | 'questions' | 'rewards';

function shuffled<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const PER_PAGE = 8;

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

export default function MysteryBoxPrintPage() {
  const { t } = useTranslation();
  const { classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading } = useMaterialsWordLists();
  const location = useLocation();
  const [words, setWords] = useState<FullCardItem[]>(() => wordsFromLocationState(location.state));
  const [tab, setTab] = useState<Tab>('records');
  const [count, setCount] = useState<20 | 28>(28);
  const [showAnswer, setShowAnswer] = useState(true);
  const [seed, setSeed] = useState(0);

  const rewards = useMemo(
    () => shuffled(rewardDeck()).slice(0, count),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, seed],
  );

  const questionCards = useMemo(() => {
    if (words.length === 0) return [];
    const pool: FullCardItem[] = [];
    while (pool.length < count) pool.push(...shuffled(words));
    return pool.slice(0, count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, count, seed]);

  const rewardLabel = (r: Reward): string => {
    switch (r.kind) {
      case 'add':
        return t('gameMysteryBox.r_add', { n: r.pts });
      case 'sub':
        return t('gameMysteryBox.r_sub', { n: r.pts });
      case 'steal':
        return t('gameMysteryBox.r_steal', { n: r.pts });
      default:
        return t(`gameMysteryBox.r_${r.kind}`);
    }
  };
  const rewardImg = (r: Reward) =>
    r.kind === 'sub' || r.kind === 'lose' || r.kind === 'half' ? 'bomb' : r.kind === 'steal' ? 'mask' : r.kind === 'add' && r.pts >= 1000 ? 'star' : r.kind === 'double' || r.kind === 'add' ? 'coins' : 'star';

  const recordRows = Array.from({ length: count }, (_, i) => i);
  const pages = tab === 'records' ? [] : tab === 'rewards' ? chunk(rewards.map((r, i) => ({ r, i })), PER_PAGE) : chunk(questionCards.map((w, i) => ({ w, i })), PER_PAGE);
  const canPrint = tab !== 'questions' || questionCards.length > 0;

  return (
    <div className="space-y-6">
      <Link to="/materials" className="no-print inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
        {t('materials.backToMaterials')}
      </Link>
      <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('materials.mysteryBoxName')}
      </h2>

      <div className="no-print space-y-4">
        <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="font-caption text-caption text-on-surface-variant mb-2">{t('materials.mysteryBox.kindLabel')}</div>
              <div className="flex bg-surface-container-low rounded-lg p-1 w-fit">
                {(['records', 'questions', 'rewards'] as Tab[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${tab === k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
                  >
                    {t(`materials.mysteryBox.kind_${k}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="font-caption text-caption text-on-surface-variant mb-2">{t('materials.mysteryBox.countLabel')}</div>
              <div className="flex bg-surface-container-low rounded-lg p-1 w-fit">
                {([20, 28] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${count === n ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {tab === 'questions' && (
              <label className="flex items-center gap-2 self-end font-label-md text-label-md text-on-surface">
                <input type="checkbox" checked={showAnswer} onChange={(e) => setShowAnswer(e.target.checked)} />
                {t('materials.mysteryBox.showAnswer')}
              </label>
            )}
          </div>

          {tab === 'questions' && (
            <div>
              <div className="font-caption text-caption text-on-surface-variant mb-2">{t('materials.wordsLabel')}</div>
              <MaterialsWordPicker words={words} onChange={setWords} wordLists={wordLists} wordListsLoading={wordListsLoading} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              className="px-5 py-2.5 rounded-full border-2 border-secondary text-secondary hover:bg-secondary-container/40 font-label-md text-label-md transition-colors"
            >
              {t('materials.mysteryBox.reshuffle')}
            </button>
            <button
              type="button"
              disabled={!canPrint}
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors disabled:opacity-50"
            >
              {t('materials.printButton')}
            </button>
            <span className="font-caption text-caption text-on-surface-variant">
              {tab === 'questions' && questionCards.length === 0 ? t('materials.mysteryBox.needWords') : t('materials.mysteryBox.hint')}
            </span>
          </div>
        </div>
      </div>

      {tab === 'records' && (
        <div className="print-sheet print-board mx-auto">
          <div className="mx-auto w-full max-w-[186mm]">
            <div className="mb-[3mm] flex items-end justify-between border-b-[0.6mm] border-deep-navy pb-[2mm]">
              <div className="font-black text-deep-navy" style={{ fontSize: '9mm' }}>{t('materials.mysteryBox.recTitle')}</div>
              <div className="text-[4.4mm] text-slate-600">{t('materials.mysteryBox.recName')} ____________ &nbsp; {t('materials.mysteryBox.recTeam')} ____</div>
            </div>
            <div className="mb-[3mm] flex items-center gap-[6mm] rounded-[3mm] bg-amber-50 px-[4mm] py-[2mm] text-[4.2mm]">
              <span className="font-bold text-deep-navy">{t('materials.mysteryBox.recLegend')}</span>
              <span className="flex items-center gap-[1mm]"><img src="/skins/mystery/mush-gold.webp" alt="" className="h-[9mm]" /> +3</span>
              <span className="flex items-center gap-[1mm]"><img src="/skins/mystery/mush-red.webp" alt="" className="h-[9mm]" /> +1</span>
              <span className="flex items-center gap-[1mm]"><img src="/skins/mystery/mush-purple.webp" alt="" className="h-[9mm]" /> −1</span>
            </div>
            <table className="w-full border-collapse text-[4.4mm]">
              <thead>
                <tr className="bg-deep-navy text-white">
                  <th className="w-[16mm] border border-deep-navy py-[1.6mm]">{t('materials.mysteryBox.recBox')}</th>
                  <th className="border border-deep-navy py-[1.6mm]">{t('materials.mysteryBox.recWord')}</th>
                  <th className="w-[34mm] border border-deep-navy py-[1.6mm]">{t('materials.mysteryBox.recMush')}</th>
                  <th className="w-[22mm] border border-deep-navy py-[1.6mm]">{t('materials.mysteryBox.recPoints')}</th>
                </tr>
              </thead>
              <tbody>
                {recordRows.map((i) => (
                  <tr key={i} style={{ height: count > 20 ? '7.2mm' : '9.6mm' }}>
                    <td className="border border-slate-400 text-center font-black text-amber-700">{blockLabel(i)}</td>
                    <td className="border border-slate-400" />
                    <td className="border border-slate-400 text-center tracking-[3mm] text-slate-400">○ ○ ○</td>
                    <td className="border border-slate-400" />
                  </tr>
                ))}
                <tr className="bg-amber-50 font-black" style={{ height: '9mm' }}>
                  <td colSpan={3} className="border border-slate-400 pr-[4mm] text-right">{t('materials.mysteryBox.recTotal')}</td>
                  <td className="border border-slate-400" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canPrint &&
        pages.map((page, pi) => (
          <div key={pi} className="print-sheet print-board mx-auto">
            <div className="no-print mb-1 text-center font-caption text-caption text-on-surface-variant">
              {pi + 1} / {pages.length}
            </div>
            <div className="mx-auto grid w-full max-w-[186mm] grid-cols-2 gap-[3mm]" style={{ gridAutoRows: '62mm' }}>
              {tab === 'rewards'
                ? (page as { r: Reward; i: number }[]).map(({ r, i }) => (
                    <div
                      key={i}
                      className="print-card relative flex flex-col items-center justify-center gap-[1.5mm] overflow-hidden rounded-[4mm] border-[0.6mm] border-dashed text-center"
                      style={{ borderColor: isGood(r) ? '#16a34a' : '#dc2626', background: isGood(r) ? '#f0fdf4' : '#fef2f2' }}
                    >
                      <span className="absolute left-[3mm] top-[2mm] text-[3mm] font-bold text-slate-400">✂ {i + 1}</span>
                      <img src={`/skins/mystery/${rewardImg(r)}.webp`} alt="" className="h-[26mm] object-contain" draggable={false} />
                      <div className="px-[3mm] font-black leading-tight" style={{ fontSize: '8mm', color: isGood(r) ? '#15803d' : '#b91c1c' }}>
                        {rewardLabel(r)}
                      </div>
                    </div>
                  ))
                : (page as { w: FullCardItem; i: number }[]).map(({ w, i }) => (
                    <div
                      key={i}
                      className="print-card relative flex flex-col items-center justify-center gap-[2mm] overflow-hidden rounded-[4mm] border-[0.6mm] border-dashed border-amber-500 bg-amber-50 text-center"
                    >
                      <span className="absolute left-[3mm] top-[2mm] rounded-[2mm] bg-amber-400 px-[2.4mm] py-[0.6mm] text-[6mm] font-black text-white">
                        {blockLabel(i)}
                      </span>
                      <div className="px-[6mm] font-black leading-tight text-deep-navy" style={{ fontSize: w.word.length > 30 ? '6mm' : w.word.length > 14 ? '8mm' : '11mm', wordBreak: 'keep-all' }}>
                        {w.word}
                      </div>
                      {showAnswer && w.meaning && (
                        <div className="px-[6mm] text-[4.4mm] text-slate-600">{w.meaning}</div>
                      )}
                    </div>
                  ))}
            </div>
          </div>
        ))}
    </div>
  );
}
