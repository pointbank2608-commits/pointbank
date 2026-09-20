import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import MaterialsWordPicker from '../components/MaterialsWordPicker';
import { wordsFromLocationState } from '../lib/materialsHandoff';
import { useMaterialsWordLists } from '../lib/useMaterialsWordLists';
import { buildQuizQuestions } from '../lib/quizFromWordList';
import type { FullCardItem } from '../lib/types';
import WorksheetSheets from '../components/worksheets/WorksheetSheets';
import { decorThemes, lineartWordCount } from '../lib/lineart';
import {
  buildWorksheet,
  DEFAULT_COLORING_OPTIONS,
  type ColoringLabelMode,
  type ColoringOptions,
  type ColoringPerPage,
  EMPTY_HINT_KEY,
  isWorksheetEmpty,
  NEW_WORKSHEET_KINDS,
  type NewWorksheetKind,
} from '../lib/worksheetGenerators';

type Tab = 'list' | 'card' | 'tracing' | 'quiz' | NewWorksheetKind;
const TABS: Tab[] = ['list', 'card', 'tracing', 'quiz', ...NEW_WORKSHEET_KINDS];
const TAB_LABEL_KEY: Record<Tab, string> = {
  list: 'tabList',
  card: 'tabCard',
  tracing: 'tabTracing',
  quiz: 'tabQuiz',
  coloring: 'tabColoring',
  match: 'tabMatch',
  wordSearch: 'tabWordSearch',
  unscramble: 'tabUnscramble',
  fillBlank: 'tabFillBlank',
  grouping: 'tabGrouping',
  cutPaste: 'tabCutPaste',
};

function isNewKind(tab: Tab): tab is NewWorksheetKind {
  return (NEW_WORKSHEET_KINDS as readonly string[]).includes(tab);
}

export default function WorksheetPrintPage() {
  const { t } = useTranslation();
  const { classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading } = useMaterialsWordLists();
  const location = useLocation();
  const [words, setWords] = useState<FullCardItem[]>(() => wordsFromLocationState(location.state));
  const [tab, setTab] = useState<Tab>('list');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [seed, setSeed] = useState(1);
  const [coloring, setColoring] = useState<ColoringOptions>(DEFAULT_COLORING_OPTIONS);

  const quiz = useMemo(
    () =>
      buildQuizQuestions(
        { items: words.map((w) => ({ id: w.id, word: w.word, meaning: w.meaning, image_url: w.imageUrl, category: null })) },
        'wordToMeaning',
      ),
    [words],
  );

  const generated = useMemo(() => (isNewKind(tab) ? buildWorksheet(tab, words, seed, { coloring }) : null), [tab, words, seed, coloring]);
  const generatedEmpty = generated ? isWorksheetEmpty(generated) : false;
  const canPreview = generated ? !generatedEmpty : tab === 'quiz' ? quiz.length > 0 : words.length > 0;

  return (
    <div className="space-y-6">
      <Link
        to="/materials"
        className="no-print inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        {t('materials.backToMaterials')}
      </Link>

      <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('materials.worksheetName')}
      </h2>

      <div className="no-print space-y-4">
        <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />

        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
          <div>
            <div className="font-caption text-caption text-on-surface-variant mb-2">{t('materials.wordsLabel')}</div>
            <MaterialsWordPicker
              words={words}
              onChange={setWords}
              wordLists={wordLists}
              wordListsLoading={wordListsLoading}
            />
          </div>

          <div className="flex flex-wrap bg-surface-container-low rounded-lg p-1 w-fit max-w-full gap-y-1">
            {TABS.map((tb) => (
              <button
                key={tb}
                type="button"
                onClick={() => setTab(tb)}
                className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                  tab === tb ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                {t(`materials.worksheet.${TAB_LABEL_KEY[tb]}`)}
              </button>
            ))}
          </div>

          {tab === 'quiz' && (
            <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant w-fit cursor-pointer">
              <input
                type="checkbox"
                checked={showAnswerKey}
                onChange={(e) => setShowAnswerKey(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              {t('materials.worksheet.showAnswerKey')}
            </label>
          )}

          {tab === 'coloring' && words.length > 0 && (
            <div className="space-y-3 rounded-lg border border-outline-variant/50 p-3">
              <label className="flex flex-wrap items-center gap-2 font-label-md text-label-md text-on-surface-variant">
                {t('materials.worksheet.coloringTitleLabel')}
                <input
                  value={coloring.title}
                  onChange={(e) => setColoring((c) => ({ ...c, title: e.target.value }))}
                  maxLength={40}
                  className="min-w-[200px] flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 font-body-md text-body-md text-on-surface"
                />
              </label>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-label-md text-label-md text-on-surface-variant">
                <label className="flex items-center gap-2">
                  {t('materials.worksheet.coloringLabelMode')}
                  <select
                    value={coloring.labelMode}
                    onChange={(e) => setColoring((c) => ({ ...c, labelMode: e.target.value as ColoringLabelMode }))}
                    className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-on-surface"
                  >
                    <option value="word">{t('materials.worksheet.coloringModeWord')}</option>
                    <option value="write">{t('materials.worksheet.coloringModeWrite')}</option>
                    <option value="none">{t('materials.worksheet.coloringModeNone')}</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  {t('materials.worksheet.coloringPerPage')}
                  <select
                    value={coloring.perPage}
                    onChange={(e) => setColoring((c) => ({ ...c, perPage: Number(e.target.value) as ColoringPerPage }))}
                    className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-on-surface"
                  >
                    {[4, 6, 8, 9].map((n) => (
                      <option key={n} value={n}>
                        {t('materials.worksheet.coloringPerPageOption', { count: n })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  {t('materials.worksheet.coloringTheme')}
                  <select
                    value={coloring.decorTheme ?? ''}
                    onChange={(e) => setColoring((c) => ({ ...c, decorTheme: e.target.value || null }))}
                    className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-on-surface"
                  >
                    <option value="">{t('materials.worksheet.coloringThemeNone')}</option>
                    {decorThemes().map((th) => (
                      <option key={th} value={th}>
                        {th}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="font-caption text-caption text-on-surface-variant">
                {t('materials.worksheet.coloringCoverage', { count: lineartWordCount })}
              </p>
            </div>
          )}

          {isNewKind(tab) && tab !== 'coloring' && words.length > 0 && (
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant w-fit cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAnswers}
                  onChange={(e) => setIncludeAnswers(e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
                {t('materials.worksheet.includeAnswerPage')}
              </label>
              <button
                type="button"
                onClick={() => setSeed((n) => n + 1)}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full border-2 border-primary text-primary hover:bg-primary/10 font-label-md text-label-md transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  shuffle
                </span>
                {t('materials.worksheet.reshuffle')}
              </button>
            </div>
          )}

          {!canPreview ? (
            <div className="font-body-md text-body-md text-on-surface-variant">
              {words.length === 0
                ? t('materials.worksheet.needAtLeastOne')
                : generated
                  ? t(`materials.worksheet.${EMPTY_HINT_KEY[generated.kind]}`)
                  : tab === 'quiz'
                    ? t('materials.worksheet.needAtLeastTwoForQuiz')
                    : t('materials.worksheet.needAtLeastOne')}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors"
            >
              {t('materials.printButton')}
            </button>
          )}
        </div>
      </div>

      {canPreview && generated?.kind === 'coloring' && generated.skipped.length > 0 && (
        <p className="no-print font-caption text-caption text-on-surface-variant">
          {t('materials.worksheet.coloringSkipped', { words: generated.skipped.join(', ') })}
        </p>
      )}

      {canPreview && generated && (
        <div className="print-sheet mx-auto">
          <WorksheetSheets data={generated} includeAnswers={includeAnswers} />
        </div>
      )}

      {canPreview && tab === 'list' && (
        <div className="print-sheet mx-auto p-6">
          <div className="columns-2 gap-8">
            {words.map((w, i) => (
              <div key={w.id} className="print-card flex items-baseline gap-2 py-1.5 border-b border-outline-variant/40">
                <span className="font-caption text-caption text-on-surface-variant w-6 shrink-0">{i + 1}.</span>
                <span className="font-title-md text-title-md text-deep-navy">{w.word}</span>
                <span className="font-body-md text-body-md text-on-surface-variant">{w.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {canPreview && tab === 'card' && (
        <div className="print-sheet mx-auto p-6">
          <div className="grid grid-cols-3 gap-[5mm]">
            {words.map((w) => (
              <div
                key={w.id}
                className="print-card flex flex-col items-center rounded-[4mm] border-2 border-outline-variant p-[3mm] gap-[2mm]"
              >
                <div className="w-full aspect-square rounded-[3mm] bg-surface-container-low flex items-center justify-center overflow-hidden">
                  {w.imageUrl ? (
                    <img src={w.imageUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span style={{ fontSize: '32px' }} aria-hidden>
                      🔤
                    </span>
                  )}
                </div>
                <div className="font-title-md font-bold text-deep-navy text-center" style={{ wordBreak: 'keep-all' }}>
                  {w.word}
                </div>
                <div className="font-body-sm text-on-surface-variant text-center" style={{ wordBreak: 'keep-all' }}>
                  {w.meaning}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canPreview && tab === 'tracing' && (
        <div className="print-sheet mx-auto p-6 space-y-[6mm]">
          {words.map((w) => (
            <div key={w.id} className="print-card">
              <div className="font-headline-sm font-bold text-deep-navy mb-[2mm]">{w.word}</div>
              {[0, 1, 2].map((row) => (
                <div key={row} className="relative h-[9mm] mb-[1mm]">
                  <div className="absolute left-0 right-0 top-0 border-t border-outline-variant" />
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-outline-variant" />
                  <div className="absolute left-0 right-0 bottom-0 border-t border-outline-variant" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {canPreview && tab === 'quiz' && (
        <div className="print-sheet mx-auto p-6 space-y-4">
          {quiz.map((q, i) => (
            <div key={q.id} className="print-card">
              <div className="font-title-md text-title-md text-deep-navy mb-1">
                {i + 1}. {q.question}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 pl-4">
                {q.choices.map((choice, ci) => (
                  <span
                    key={ci}
                    className={`font-body-md text-body-md ${
                      showAnswerKey && ci === q.correctIndex ? 'text-primary font-bold underline' : 'text-on-surface'
                    }`}
                  >
                    {String.fromCharCode(97 + ci)}. {choice}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
