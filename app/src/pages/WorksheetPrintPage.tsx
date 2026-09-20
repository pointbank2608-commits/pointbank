import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import MaterialsWordPicker from '../components/MaterialsWordPicker';
import { handoffFromLocationState, wordsFromLocationState } from '../lib/materialsHandoff';
import { useMaterialsWordLists } from '../lib/useMaterialsWordLists';
import { buildQuizQuestions } from '../lib/quizFromWordList';
import type { FullCardItem } from '../lib/types';
import TracingRow from '../components/worksheets/TracingRow';
import WorksheetSheets from '../components/worksheets/WorksheetSheets';
import { decorThemes, lineartWordCount } from '../lib/lineart';
import {
  buildWorksheet,
  DEFAULT_COLORING_OPTIONS,
  type ColoringLabelMode,
  type ColoringOptions,
  type ColoringPerPage,
  type AskTemplate,
  EMPTY_HINT_KEY,
  isWorksheetEmpty,
  NEW_WORKSHEET_KINDS,
  PHONICS_KINDS,
  type NewWorksheetKind,
} from '../lib/worksheetGenerators';

type Tab = 'list' | 'card' | 'tracing' | 'quiz' | NewWorksheetKind;
// 파닉스 전용 유형(PHONICS_KINDS)은 파닉스 워크시트 페이지(/materials/phonics)에서만 다룬다.
const TABS: Tab[] = [
  'list',
  'card',
  'tracing',
  'quiz',
  ...NEW_WORKSHEET_KINDS.filter((k) => !(PHONICS_KINDS as readonly string[]).includes(k)),
];
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
  sentence: 'tabSentence',
  multipleChoice: 'tabMultipleChoice',
  trueFalse: 'tabTrueFalse',
  miniBook: 'tabMiniBook',
  askAnswer: 'tabAskAnswer',
  boardGame: 'tabBoardGame',
  readMatch: 'tabReadMatch',
  phonicsBlank: 'tabPhonicsBlank',
  phonicsCircle: 'tabPhonicsCircle',
  phonicsOdd: 'tabPhonicsOdd',
  phonicsRhyme: 'tabPhonicsRhyme',
};

function isNewKind(tab: Tab): tab is NewWorksheetKind {
  return (NEW_WORKSHEET_KINDS as readonly string[]).includes(tab);
}

export default function WorksheetPrintPage() {
  const { t } = useTranslation();
  const { classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading } = useMaterialsWordLists();
  const location = useLocation();
  const [words, setWords] = useState<FullCardItem[]>(() => wordsFromLocationState(location.state));
  const [tab, setTab] = useState<Tab>(() => {
    const requested = handoffFromLocationState(location.state).materialsTab;
    return requested && (TABS as string[]).includes(requested) ? (requested as Tab) : 'list';
  });
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [seed, setSeed] = useState(1);
  const [askTemplate, setAskTemplate] = useState<AskTemplate>('like');
  // 단어 리스트에 뜻 말고 무엇을 더 보여줄지(품사·예문·그림).
  const [listShow, setListShow] = useState({ pos: true, example: false, image: false });
  // 사선지에 뜻·그림도 함께 보여줄지.
  const [tracingShow, setTracingShow] = useState({ meaning: false, image: false });
  const [coloring, setColoring] = useState<ColoringOptions>(() => {
    const h = handoffFromLocationState(location.state);
    return {
      ...DEFAULT_COLORING_OPTIONS,
      title: h.materialsColoringTitle ?? DEFAULT_COLORING_OPTIONS.title,
      decorTheme: h.materialsDecorTheme ?? DEFAULT_COLORING_OPTIONS.decorTheme,
    };
  });

  const quiz = useMemo(
    () =>
      buildQuizQuestions(
        { items: words.map((w) => ({ id: w.id, word: w.word, meaning: w.meaning, image_url: w.imageUrl, category: null })) },
        'wordToMeaning',
      ),
    [words],
  );

  const generated = useMemo(() => (isNewKind(tab) ? buildWorksheet(tab, words, seed, { coloring, sheetTitle: coloring.title, askTemplate }) : null), [tab, words, seed, coloring, askTemplate]);
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

          {tab === 'list' && words.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-label-md text-label-md text-on-surface-variant">
              <span>{t('materials.worksheet.listShowLabel')}</span>
              {(['pos', 'example', 'image'] as const).map((key) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={listShow[key]}
                    onChange={(e) => setListShow((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  {t(`materials.worksheet.listShow_${key}`)}
                </label>
              ))}
            </div>
          )}

          {tab === 'tracing' && words.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-label-md text-label-md text-on-surface-variant">
              <span>{t('materials.worksheet.listShowLabel')}</span>
              {(['meaning', 'image'] as const).map((key) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tracingShow[key]}
                    onChange={(e) => setTracingShow((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  {t(`materials.worksheet.tracingShow_${key}`)}
                </label>
              ))}
            </div>
          )}

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

          {(tab === 'miniBook' || tab === 'boardGame') && words.length > 0 && (
            <div className="space-y-2 rounded-lg border border-outline-variant/50 p-3">
              <label className="flex flex-wrap items-center gap-2 font-label-md text-label-md text-on-surface-variant">
                {t('materials.worksheet.coloringTitleLabel')}
                <input
                  value={coloring.title}
                  onChange={(e) => setColoring((c) => ({ ...c, title: e.target.value }))}
                  maxLength={40}
                  className="min-w-[200px] flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 font-body-md text-body-md text-on-surface"
                />
              </label>
              {tab === 'miniBook' && (
                <p className="font-caption text-caption text-on-surface-variant">{t('materials.worksheet.miniBookHint')}</p>
              )}
            </div>
          )}

          {tab === 'askAnswer' && words.length > 0 && (
            <label className="flex flex-wrap items-center gap-2 font-label-md text-label-md text-on-surface-variant">
              {t('materials.worksheet.askTemplateLabel')}
              <select
                value={askTemplate}
                onChange={(e) => setAskTemplate(e.target.value as AskTemplate)}
                className="rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-on-surface"
              >
                <option value="like">{t('materials.worksheet.askTemplateLike')}</option>
                <option value="have">{t('materials.worksheet.askTemplateHave')}</option>
                <option value="see">{t('materials.worksheet.askTemplateSee')}</option>
              </select>
            </label>
          )}

          {isNewKind(tab) && tab !== 'coloring' && tab !== 'miniBook' && tab !== 'askAnswer' && tab !== 'boardGame' && words.length > 0 && (
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
          {/* 예문·그림이 들어가면 한 줄이 길어져서 한 단으로, 아니면 두 단으로 보여준다. */}
          <div className={listShow.example || listShow.image ? '' : 'columns-2 gap-8'}>
            {words.map((w, i) => (
              <div
                key={w.id}
                className={`print-card flex gap-2 border-b border-outline-variant/40 py-1.5 ${listShow.image ? 'items-center' : 'items-baseline'}`}
              >
                <span className="font-caption text-caption text-on-surface-variant w-6 shrink-0">{i + 1}.</span>
                {listShow.image && (
                  <span className="flex h-[14mm] w-[14mm] shrink-0 items-center justify-center">
                    {w.imageUrl ? <img src={w.imageUrl} alt="" className="h-full w-full object-contain" /> : null}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-title-md text-title-md text-deep-navy">{w.word}</span>
                    {listShow.pos && w.partOfSpeech && (
                      <span className="rounded bg-surface-container-high px-1.5 font-caption text-caption text-on-surface-variant">
                        {w.partOfSpeech}
                      </span>
                    )}
                    <span className="font-body-md text-body-md text-on-surface-variant">{w.meaning}</span>
                  </div>
                  {listShow.example && w.example && (
                    <div className="font-body-sm text-body-sm text-on-surface-variant">{w.example}</div>
                  )}
                </div>
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
        <div className="print-sheet mx-auto p-6 space-y-[4mm]">
          {words.map((w) => (
            <div key={w.id} className="print-card">
              <div className="mb-[3mm] flex flex-wrap items-baseline gap-x-3">
                <span className="font-bold text-deep-navy" style={{ fontSize: '30px', lineHeight: 1.1 }}>
                  {w.word}
                </span>
                {tracingShow.meaning && w.meaning && <span className="text-[18px] text-on-surface-variant">{w.meaning}</span>}
              </div>
              {/* 그림은 사선지 3줄 블록 높이(13mm × 3 + 줄 사이 8mm × 2 = 55mm)에 맞춘다. */}
              <div className="flex items-stretch gap-[6mm]">
                {tracingShow.image && w.imageUrl && (
                  <img src={w.imageUrl} alt="" className="h-[55mm] w-[55mm] shrink-0 object-contain" />
                )}
                <div className="min-w-0 flex-1">
                  {[0, 1, 2].map((row) => (
                    <TracingRow key={row} word={w.word} trace={row === 0} last={row === 2} />
                  ))}
                </div>
              </div>
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
