import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from './AccessibleDialog';
import MaterialDraftReview, { type MaterialDraftItem } from './MaterialDraftReview';
import StudyListSourceForm, { StudyListOriginal, type StudyListSourceDraft } from './StudyListSourceForm';
import TeachingDraftReview from './TeachingDraftReview';
import { MaterialGradeField } from './TeachingMaterialOptions';
import { AI_MATERIAL_COUNT_LIMIT, generateAiMaterials, makeAiMaterialList, saveAiMaterials, type AiMaterialList } from '../lib/aiMaterials';
import { assertWorkbookSpace, examCategories, isTeachingReviewComplete, makeTeachingLessonSlides, makeTeachingWorkbook,
  saveTeachingLesson, saveTeachingWorkbook, type ExamCategory, type SourceMaterialOptions, type TeachingDraft } from '../lib/teachingMaterials';
import type { LessonSlide, WordListKind } from '../lib/types';
import type { WorksheetDocument } from '../lib/worksheetStudio';
import '../styles/textbooks.css';

const kinds = ['words', 'sentences'] as const;
const generationErrors = ['accessDenied', 'rateLimited', 'extractionFailed', 'extractionUnavailable', 'invalidGeneration'];
const button = 'textbook-button';
const primary = `${button} textbook-primary`;
type ReviewItem = MaterialDraftItem & { page?: number; meaningSuggested?: boolean };
type Review = Record<typeof kinds[number], ReviewItem[]>;
type PreparedSave = {
  lists: AiMaterialList[];
  lesson?: { id: string; name: string; level: string; slides: LessonSlide[] };
  workbook?: { id: string; document: WorksheetDocument; unitId?: string };
};
export type SavedAiMaterials = { listId?: string; lessonId?: string; workbookPath?: string };

export default function AiMaterialsDialog({ academy, owner, mode, preferredKind, onClose, onSaved }: {
  academy: string; owner: string; mode: 'source' | 'topic'; preferredKind?: WordListKind;
  onClose: () => void; onSaved: (result: SavedAiMaterials) => void;
}) {
  const { t } = useTranslation();
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState(3);
  const [wordCount, setWordCount] = useState('10');
  const [sentenceCount, setSentenceCount] = useState('5');
  const [name, setName] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [options, setOptions] = useState<SourceMaterialOptions>();
  const [teaching, setTeaching] = useState<TeachingDraft>();
  const [unitId, setUnitId] = useState<string>();
  const [original, setOriginal] = useState<StudyListSourceDraft['original']>();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'generating' | 'saving' | null>(null);
  const [error, setError] = useState('');
  const [savePrepared, setSavePrepared] = useState(false);
  const pendingSave = useRef<PreparedSave | null>(null);
  const draftName = useRef<HTMLInputElement>(null);
  const reviewing = !!review;
  useEffect(() => { if (reviewing) draftName.current?.focus(); }, [reviewing]);
  const dialogTitle = t(mode === 'source' ? 'aiMaterials.sourceTitle' : 'aiMaterials.title');
  const requested = { words: Number(wordCount), sentences: Number(sentenceCount) };
  const listKinds = kinds.filter(kind => !options || options.outputs.includes(kind));
  const hasWorkbook = options?.outputs.includes('workbook') === true;
  const selectedCount = review ? listKinds.reduce((total, kind) => total + review[kind].filter(item => item.included).length, 0) : 0;

  function gradeLabel(level: number) {
    return t(level <= 6 ? 'aiMaterials.primaryGrade' : level <= 9 ? 'aiMaterials.middleGrade' : 'aiMaterials.highGrade',
      { grade: level <= 6 ? level : (level - 1) % 3 + 1 });
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (status || !topic.trim()) return;
    setStatus('generating');
    setError('');
    try {
      const draft = await generateAiMaterials(academy, {
        topic: topic.trim(), grade, wordCount: requested.words, sentenceCount: requested.sentences,
      });
      const suffix = ` · ${gradeLabel(grade)}`;
      setSourceDraft({ ...draft, title: `${topic.trim().slice(0, 120 - suffix.length).trimEnd()}${suffix}` });
    } catch (err) {
      setError(err instanceof Error && generationErrors.includes(err.message) ? err.message : 'extractionFailed');
    } finally {
      setStatus(null);
    }
  }

  function updateDraft(kind: typeof kinds[number], update: (items: ReviewItem[]) => ReviewItem[]) {
    setReview(current => current && { ...current, [kind]: update(current[kind]) });
    setError('');
  }

  function setSourceDraft(draft: StudyListSourceDraft) {
    const include = (item: Omit<ReviewItem, 'included' | 'id'>): ReviewItem => ({ ...item, id: crypto.randomUUID(), included: true });
    setName(draft.title.trim().slice(0, draft.options?.outputs.includes('workbook') ? 100 : 120));
    setOptions(draft.options);
    setTeaching(draft.objective ? { objective: draft.objective, lesson: draft.lesson, practice: draft.practice } : undefined);
    setUnitId(draft.unitId);
    setOriginal(draft.original);
    setPage(draft.original?.first ?? 1);
    setReview({ words: draft.words.map(include), sentences: draft.sentences.map(include) });
    setError('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!review || status || !name.trim() || (!selectedCount && !teaching)) return;
    const dialog = event.currentTarget.closest('dialog');
    setError('');
    if (!pendingSave.current) {
      const words = listKinds.includes('words') ? review.words.filter(item => item.included) : [];
      const sentences = listKinds.includes('sentences') ? review.sentences.filter(item => item.included) : [];
      if ([...words, ...sentences].some(item => !item.text.trim() || !item.meaning.trim())) {
        setError('requireMeaning');
        return;
      }
      if (teaching && !isTeachingReviewComplete(teaching, options?.teaching?.minutes)) {
        setError('incompleteTeachingReview');
        return;
      }
      const lists = [
        ...(words.length ? [makeAiMaterialList('word', name.trim(), words)] : []),
        ...(sentences.length ? [makeAiMaterialList('sentence', name.trim(), sentences)] : []),
      ];
      const prepared: PreparedSave = { lists };
      try {
        if (teaching?.lesson && options?.teaching) {
          const durations = teaching.lesson.map(stage => t('aiMaterials.minuteLabel', { count: stage.minutes }));
          prepared.lesson = { id: crypto.randomUUID(), name: name.trim(),
            level: `${gradeLabel(options.teaching.grade)} · ${t(`aiMaterials.${options.teaching.level}`)}`,
            slides: makeTeachingLessonSlides(teaching, durations, !hasWorkbook, t('aiMaterials.lessonPractice')) };
        }
        if (teaching && hasWorkbook) {
          if (!unitId) assertWorkbookSpace(academy, owner);
          const labels = options?.teaching?.exam ? Object.fromEntries(examCategories.map(key =>
            [key, t(`aiMaterials.${key}`)])) as Record<ExamCategory, string> : undefined;
          prepared.workbook = { id: crypto.randomUUID(), document: makeTeachingWorkbook(name, teaching, labels), unitId };
        }
      } catch (err) {
        setError(err instanceof Error && err.message === 'workbookStorageLimit' ? err.message : 'incompleteTeachingReview');
        return;
      }
      pendingSave.current = prepared;
      setSavePrepared(true);
    }
    setStatus('saving');
    try {
      const { lists, lesson, workbook } = pendingSave.current;
      if (lists.length) await saveAiMaterials(academy, owner, lists);
      if (lesson) await saveTeachingLesson(academy, owner, lesson.id, lesson.name, lesson.level, lesson.slides,
        lists.find(list => list.kind === 'word')?.id ?? null);
      const workbookPath = workbook ? await saveTeachingWorkbook(academy, owner, workbook.id, workbook.document, workbook.unitId) : undefined;
      dialog?.close();
      onSaved({ listId: (lists.find(list => list.kind === preferredKind) ?? lists[0])?.id, lessonId: lesson?.id, workbookPath });
    } catch (err) {
      setError(err instanceof Error && err.message === 'workbookStorageLimit' ? err.message : 'saveFailed');
    } finally {
      setStatus(null);
    }
  }

  const errorMessage = error && (error === 'requireMeaning' || error === 'rateLimited' || error === 'accessDenied'
    ? t(`textbook.${error}`) : t(`aiMaterials.${error}`));

  return <AccessibleDialog label={dialogTitle} onClose={onClose} nativeDismiss={status ? 'disabled' : 'enabled'}
    className="textbook-chooser textbook-card ai-materials-dialog">
    <header className="textbook-heading">
      <h3>{dialogTitle}</h3>
      <form method="dialog">
        <button type="submit" className={button} disabled={!!status}>{t('common.cancel')}</button>
      </form>
    </header>
    {mode === 'source' && <div hidden={!!review}>
      <StudyListSourceForm academy={academy} owner={owner} busy={!!status}
        onBusy={busy => setStatus(busy ? 'generating' : null)} onDraft={setSourceDraft} />
    </div>}
    {review && <form onSubmit={save}>
      <div className="textbook-fields">
        <label>{t('aiMaterials.name')}<input ref={draftName} value={name} maxLength={hasWorkbook ? 100 : 120} required disabled={savePrepared}
          onChange={e => setName(e.target.value)} /></label>
      </div>
      <p className="textbook-note">{t(teaching ? 'aiMaterials.reviewTeaching' : mode === 'source' ? 'aiMaterials.studyReviewHelp' : 'aiMaterials.reviewHelp')}</p>
      {!!original?.unclearPages.length && <p role="status" className="textbook-error">
        {t('textbook.unclear', { pages: original.unclearPages.join(', ') })}
      </p>}
      <div className={original && listKinds.length ? 'textbook-review' : undefined}>
        {original && <StudyListOriginal files={original.files} page={page} />}
        <div>{listKinds.map(kind => <MaterialDraftReview key={kind} disabled={savePrepared}
          title={t(mode === 'source' ? 'aiMaterials.studyCount' : 'aiMaterials.reviewCount', {
            list: t(`textbook.${kind}`), actual: review[kind].length, requested: requested[kind],
          })}
          items={review[kind]} onEdit={(id, update) => updateDraft(kind, items =>
            items.map(item => item.id === id ? { ...item, ...update } : item))}
          actions={mode === 'source' ? {
            addLabel: t(kind === 'words' ? 'aiMaterials.addWord' : 'aiMaterials.addSentence'),
            removeLabel: t(kind === 'words' ? 'aiMaterials.removeWord' : 'aiMaterials.removeSentence'),
            onAdd: () => {
              const item = { id: crypto.randomUUID(), text: '', meaning: '', included: true, focusOnMount: true };
              updateDraft(kind, items => [...items, item]);
            },
            onRemove: id => updateDraft(kind, items => items.filter(item => item.id !== id)),
          } : undefined}
          source={original ? index => {
            const { page: itemPage, meaningSuggested } = review[kind][index];
            return <>
              {itemPage !== undefined && <button type="button" className={button} aria-pressed={page === itemPage}
                onClick={() => setPage(itemPage)}>{t('textbook.page', { count: itemPage })}</button>}
              {meaningSuggested && <small>{t('textbook.suggested')}</small>}
            </>;
          } : undefined} />)}</div>
      </div>
      {teaching && options?.teaching && <TeachingDraftReview draft={teaching} settings={options.teaching}
        workbook={hasWorkbook} disabled={savePrepared} onChange={value => { setTeaching(value); setError(''); }} />}
      <footer className="ai-materials-footer">
        {errorMessage && <p role="alert" className="textbook-error">{errorMessage}</p>}
        {selectedCount > 0 && <p className="textbook-note">{t('textbook.listSharing')}</p>}
        {hasWorkbook && <p className="textbook-note">{t(unitId ? 'aiMaterials.workbookUnit' : 'aiMaterials.workbookLocal')}</p>}
        <div className="textbook-actions">
          <button type="submit" className={primary} disabled={!!status || !name.trim() || (!selectedCount && !teaching)}>
            {t(status ? 'textbook.saving' : savePrepared ? 'aiMaterials.retrySave' : 'aiMaterials.save')}</button>
          {!savePrepared && <button type="button" className={button} onClick={() => { setReview(null); setError(''); }}>
            {t(mode === 'source' ? 'aiMaterials.changeSource' : 'aiMaterials.changeSettings')}</button>}
        </div>
      </footer>
    </form>}
    {mode === 'topic' && !review && <form className="ai-materials-form" onSubmit={generate}>
      <div className="textbook-fields">
        <label>{t('aiMaterials.topic')}<input value={topic} maxLength={120} required disabled={!!status}
          onChange={e => setTopic(e.target.value)} placeholder={t('aiMaterials.topicExample')} /></label>
        <MaterialGradeField value={grade} disabled={!!status} onChange={setGrade} />
        <label>{t('aiMaterials.wordCount')}<input type="number" required min={1} max={AI_MATERIAL_COUNT_LIMIT}
          value={wordCount} disabled={!!status} onChange={e => setWordCount(e.target.value)} /></label>
        <label>{t('aiMaterials.sentenceCount')}<input type="number" required min={1} max={AI_MATERIAL_COUNT_LIMIT}
          value={sentenceCount} disabled={!!status} onChange={e => setSentenceCount(e.target.value)} /></label>
      </div>
      <p className="textbook-note">{t('aiMaterials.provider')}</p>
      {errorMessage && <p role="alert" className="textbook-error">{errorMessage}</p>}
      <button type="submit" className={primary} disabled={!!status || !topic.trim()}>
        {t(status ? 'aiMaterials.generating' : 'aiMaterials.generate')}</button>
    </form>}
  </AccessibleDialog>;
}
