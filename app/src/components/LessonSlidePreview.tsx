import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGameTemplateById } from '../lib/api';
import { blockOfSlide } from '../lib/blocks/registry';
import type { LessonGameMatch } from '../lib/lessonGameContent';
import { phonicsSlideState, type lessonPhonicsTopic } from '../lib/phonicsLessonGame';
import { PresentSyncContext } from '../lib/presentSync';
import type { FullCardItem, GameTemplate, LessonSlide, PhonicsBankEntry } from '../lib/types';
import { GRAMMAR_WORD_SHEET } from '../lib/grammarCoreWords';
import AccessibleDialog from './AccessibleDialog';
import AttendanceBoard from './AttendanceBoard';
import { LessonActivityExample } from './LessonActivityExample';
import LessonPrintPreview from './LessonPrintPreview';
import LessonSlideContent from './LessonSlideContent';
import GrammarWordWorksheet from './worksheets/GrammarWordWorksheet';
import PhonicsSlidePreview from './worksheets/PhonicsSlidePreview';
import { PPT_KEY_KINDS } from '../context/LessonRunnerContext';
import { PHONICS_TEACHING_PREVIEW } from '../data/phonicsTeachingCourse';
import { buildStage1Course } from '../data/phonicsStage1';
import Stage1SlideView from './phonicsStage1/Stage1SlideView';
import { Stage1WorkbookPage } from './phonicsStage1/Stage1Workbook';

export default function LessonSlidePreview({ slide, lessonSlides, title, cards, entries, gameMatch, phonicsTopic, academyId, classId, onClose }: {
  slide: LessonSlide;
  lessonSlides: LessonSlide[];
  title: string;
  cards: FullCardItem[];
  entries: PhonicsBankEntry[];
  gameMatch?: LessonGameMatch;
  phonicsTopic?: ReturnType<typeof lessonPhonicsTopic>;
  academyId: string;
  classId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const templateId = slide.kind === 'game' ? slide.templateId : null;
  const [template, setTemplate] = useState<GameTemplate | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    if (!templateId) return;
    let active = true;
    fetchGameTemplateById(templateId).then(row => {
      if (active) setTemplate(row);
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [templateId]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  let content;
  if (slide.kind === 'game' || slide.kind === 'phonicsGame') {
    const block = blockOfSlide(slide);
    const match = template && gameMatch ? { ...gameMatch, content: { items: template.items, config: template.config } } : gameMatch;
    content = !block || loadFailed ? <p>{t('lessonUx.previewUnavailable')}</p>
      : templateId && !template ? <p>{t('common.loading')}</p>
      : <LessonActivityExample block={block} selected={slide} cards={cards} entries={entries} gameMatch={match}
          phonicsMatch={slide.kind === 'phonicsGame' ? phonicsSlideState(slide.gameId, slide.unitId, cards, t('lessonUx.language') !== 'ko', undefined, phonicsTopic) : undefined}
          theme={null} title={title} large />;
  } else if (slide.kind === 'material') {
    if (slide.materialId === GRAMMAR_WORD_SHEET && slide.grammarWords) content = <GrammarWordWorksheet selection={slide.grammarWords} />;
    else if (slide.materialId === 'phonics') content = <PhonicsSlidePreview tab={slide.phonicsTab ?? 'phonicsBlank'} words={slide.words?.length ? slide.words : cards} options={slide.phonicsOptions ?? {}} />;
    else if (slide.materialId === 'phonicsstage1' && slide.phonicsStage1) {
      const ref = slide.phonicsStage1;
      const unit = PHONICS_TEACHING_PREVIEW && buildStage1Course(entries.length ? entries : undefined).find(unit => unit.id === ref.unitId);
      const first = unit && unit.slides.find(s => ref.optional ? s.optional : !s.optional && s.lesson === ref.lesson);
      if (unit && ref.view === 'workbook') content = unit.pages.map(page => <Stage1WorkbookPage key={page.id} unit={unit} page={page} />);
      else if (unit && first) content = <Stage1SlideView unit={unit} slide={first} position={unit.slides.indexOf(first) + 1} total={unit.slides.length} />;
      else content = <p>{t('phonicsTeaching.unavailable')}</p>;
    }
    else content = <LessonPrintPreview slide={slide} cards={cards} entries={entries} large />;
  } else if (slide.kind === 'attendance') {
    content = <AttendanceBoard academyId={academyId} classId={classId} teacherId={null} themeId={slide.boardTheme} interactive={false} />;
  } else {
    content = <LessonSlideContent slide={slide} lessonSlides={lessonSlides} words={cards} lessonName={title} attendance={null} fill preview />;
  }
  return (
    <AccessibleDialog label={t('curriculum.slides.previewTitle')} onClose={onClose}>
      <div className="lesson-slide-preview flex max-h-[94dvh] flex-col" onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          onClose();
        }
      }}>
        <header className="flex items-center gap-3 border-b border-outline-variant/40 px-4 py-2">
          <h2 className="min-w-0 flex-1 truncate font-bold">{t('lessonUx.preview')} · {title}</h2>
          <button type="button" aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-container" onClick={onClose}>
            <span aria-hidden="true" className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="relative h-[min(76dvh,62vw)] min-h-[min(55dvh,20rem)] overflow-auto" onClick={event => {
          if (event.defaultPrevented || slide.kind === 'study' || !PPT_KEY_KINDS.includes(slide.kind)) return;
          if ((event.target as Element).closest('button, a, input, textarea, select, label, iframe, [role="button"]')) return;
          event.currentTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }));
        }}>
          <PresentSyncContext.Provider value={null}>{content}</PresentSyncContext.Provider>
        </div>
      </div>
    </AccessibleDialog>
  );
}
