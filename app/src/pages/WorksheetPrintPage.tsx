import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import MaterialsWordPicker from '../components/MaterialsWordPicker';
import { useMaterialsWordLists } from '../lib/useMaterialsWordLists';
import { buildQuizQuestions } from '../lib/quizFromWordList';
import type { FullCardItem } from '../lib/types';

type Tab = 'list' | 'card' | 'tracing' | 'quiz';
const TABS: Tab[] = ['list', 'card', 'tracing', 'quiz'];

export default function WorksheetPrintPage() {
  const { t } = useTranslation();
  const { classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading } = useMaterialsWordLists();
  const [words, setWords] = useState<FullCardItem[]>([]);
  const [tab, setTab] = useState<Tab>('list');
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  const quiz = useMemo(
    () =>
      buildQuizQuestions(
        { items: words.map((w) => ({ id: w.id, word: w.word, meaning: w.meaning, image_url: w.imageUrl, category: null })) },
        'wordToMeaning',
      ),
    [words],
  );

  const canPreview = tab === 'quiz' ? quiz.length > 0 : words.length > 0;

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

          <div className="flex bg-surface-container-low rounded-lg p-1 w-fit">
            {TABS.map((tb) => (
              <button
                key={tb}
                type="button"
                onClick={() => setTab(tb)}
                className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                  tab === tb ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                {t(`materials.worksheet.tab${tb === 'list' ? 'List' : tb === 'card' ? 'Card' : tb === 'tracing' ? 'Tracing' : 'Quiz'}`)}
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

          {!canPreview ? (
            <div className="font-body-md text-body-md text-on-surface-variant">
              {tab === 'quiz' && words.length > 0
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
