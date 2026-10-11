import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SoloStep } from '../../lib/soloLessons';
import { stepSummary } from '../../lib/soloEdit';
import { buildGapItems, buildGapSteps, buildLineOrderSteps, GRAMMAR_TARGETS, parseTextSource, videoIdOf } from '../../lib/textBlocks';
import SoloPrintModal from './SoloPrintModal';

type Kind = 'gap' | 'order';

/**
 * 글(가사·대사·지문)로 블록 만들기 — 붙여 넣은 글에서 가사·대사 빈칸 또는 줄 순서 문제를 한 번에 만든다.
 * 쉬운 판은 보기에서 고르고, 어려운 판은 직접 쓴다. "문법 겨냥"을 고르면 그 문법이 쓰인 줄의 그 낱말만 비운다.
 * 만든 문제는 화면에서 풀거나(개별수업) 인쇄할 수 있다. 글은 이 수업 안에만 저장된다(공용 자료로 모으지 않는다).
 */
export default function SoloTextBlockModal({ lessonName, onCreate, onClose }: { lessonName: string; onCreate: (steps: SoloStep[]) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [source, setSource] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [kind, setKind] = useState<Kind>('gap');
  const [level, setLevel] = useState<'easy' | 'hard'>('easy');
  const [count, setCount] = useState(8);
  const [target, setTarget] = useState<string>('auto');
  const [customWords, setCustomWords] = useState('');
  const [lineCount, setLineCount] = useState(4);
  const [printing, setPrinting] = useState(false);

  const parsed = useMemo(() => parseTextSource(source), [source]);
  const videoId = useMemo(() => videoIdOf(videoUrl), [videoUrl]);
  const ctx = useMemo(() => ({ videoId, timed: parsed.timed, lines: parsed.lines }), [videoId, parsed]);

  const made = useMemo(() => {
    if (parsed.lines.length === 0) return { steps: [] as SoloStep[], matched: 0 };
    if (kind === 'order') return { steps: buildLineOrderSteps(parsed.lines, lineCount, ctx), matched: 0 };
    const req =
      target === 'custom'
        ? { words: customWords.split(/[,\n]/) }
        : target === 'auto'
          ? {}
          : { target };
    const items = buildGapItems(parsed.lines, req, count);
    return { steps: buildGapSteps(items, level, ctx), matched: items.length };
  }, [parsed, kind, lineCount, ctx, target, customWords, count, level]);

  const chip = (on: boolean) => `rounded-full px-4 py-1.5 font-label-md text-label-md ${on ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'}`;
  const field = 'w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary';
  const blockName = kind === 'gap' ? (level === 'hard' ? t('soloEdit.stepType_gapType') : t('soloText.kindGap')) : t('soloEdit.stepType_lineOrder');

  return (
    <div className="fixed inset-0 z-[67] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-surface-container-lowest p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[26px] text-primary">lyrics</span>
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('soloText.title')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('soloText.intro')}</p>

        <label className="block">
          <span className="mb-1 block font-label-md text-label-md font-bold text-on-surface">{t('soloText.sourceLabel')}</span>
          <textarea value={source} onChange={(e) => setSource(e.target.value)} rows={7} placeholder={t('soloText.sourcePlaceholder')} className={`${field} font-mono`} />
          <span className="mt-1 block font-caption text-caption text-on-surface-variant">
            {parsed.lines.length > 0 ? t('soloText.linesFound', { count: parsed.lines.length }) : t('soloText.sourceHint')}
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block font-caption text-caption text-on-surface-variant">{t('soloText.videoLabel')}</span>
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className={field} />
          {videoUrl.trim() && !videoId && <span className="mt-1 block font-caption text-caption text-error">{t('soloText.videoBad')}</span>}
          {videoId && !parsed.timed && parsed.lines.length > 0 && <span className="mt-1 block font-caption text-caption text-on-surface-variant">{t('soloText.noTimes')}</span>}
        </label>

        <div>
          <div className="mb-1.5 font-label-md text-label-md font-bold text-on-surface">{t('soloText.kindLabel')}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setKind('gap')} className={chip(kind === 'gap')}>
              {t('soloText.kindGap')}
            </button>
            <button type="button" onClick={() => setKind('order')} className={chip(kind === 'order')}>
              {t('soloText.kindOrder')}
            </button>
          </div>
        </div>

        {kind === 'gap' ? (
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 font-label-md text-label-md font-bold text-on-surface">{t('soloText.levelLabel')}</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setLevel('easy')} className={chip(level === 'easy')}>
                  {t('soloText.levelEasy')}
                </button>
                <button type="button" onClick={() => setLevel('hard')} className={chip(level === 'hard')}>
                  {t('soloText.levelHard')}
                </button>
              </div>
              <p className="mt-1 font-caption text-caption text-on-surface-variant">{level === 'easy' ? t('soloText.levelEasyHint') : t('soloText.levelHardHint')}</p>
            </div>
            <div>
              <div className="mb-1.5 font-label-md text-label-md font-bold text-on-surface">{t('soloText.countLabel')}</div>
              <div className="flex flex-wrap gap-2">
                {[5, 8, 10, 15].map((n) => (
                  <button key={n} type="button" onClick={() => setCount(n)} className={chip(count === n)}>
                    {t('soloText.countN', { n })}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block font-label-md text-label-md font-bold text-on-surface">{t('soloText.targetLabel')}</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className={field}>
                <option value="auto">{t('soloText.targetAuto')}</option>
                {GRAMMAR_TARGETS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.ko}
                  </option>
                ))}
                <option value="custom">{t('soloText.targetCustom')}</option>
              </select>
              {target === 'custom' ? (
                <input value={customWords} onChange={(e) => setCustomWords(e.target.value)} placeholder={t('soloText.customPlaceholder')} className={`${field} mt-2`} />
              ) : (
                target !== 'auto' && <span className="mt-1 block font-caption text-caption text-on-surface-variant">{t('soloText.targetHint')}</span>
              )}
            </label>
          </div>
        ) : (
          <div>
            <div className="mb-1.5 font-label-md text-label-md font-bold text-on-surface">{t('soloText.lineCountLabel')}</div>
            <div className="flex flex-wrap gap-2">
              {[3, 4, 5, 6].map((n) => (
                <button key={n} type="button" onClick={() => setLineCount(n)} className={chip(lineCount === n)}>
                  {t('soloText.lineCountN', { n })}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 미리보기 */}
        {parsed.lines.length === 0 ? (
          <p className="rounded-xl bg-surface-container-low px-4 py-3 font-caption text-caption text-on-surface-variant">{t('soloText.empty')}</p>
        ) : made.steps.length === 0 ? (
          <p className="rounded-xl bg-error/10 px-4 py-3 font-caption text-caption text-error">{kind === 'gap' ? t('soloText.noneGap') : t('soloText.noneOrder')}</p>
        ) : (
          <div className="rounded-xl bg-primary-fixed/25 px-4 py-3">
            <div className="font-label-md text-label-md font-bold text-deep-navy">{t('soloText.preview', { name: blockName, count: made.steps.length })}</div>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-6 font-caption text-caption text-on-surface">
              {made.steps.slice(0, 5).map((s, i) => (
                <li key={i} className="truncate">
                  {stepSummary(s)}
                </li>
              ))}
            </ol>
            {made.steps.length > 5 && <div className="mt-0.5 pl-6 font-caption text-caption text-on-surface-variant">… {t('soloText.more', { n: made.steps.length - 5 })}</div>}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={made.steps.length === 0}
            onClick={() => setPrinting(true)}
            className="flex items-center gap-1 rounded-full border border-primary px-5 py-2 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            {t('soloText.printOnly')}
          </button>
          <button
            type="button"
            disabled={made.steps.length === 0}
            onClick={() => onCreate(made.steps)}
            className="rounded-full bg-primary px-6 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-40"
          >
            {t('soloText.create')}
          </button>
        </div>
      </div>
      {printing && <SoloPrintModal steps={made.steps} title={lessonName} onClose={() => setPrinting(false)} />}
    </div>
  );
}
