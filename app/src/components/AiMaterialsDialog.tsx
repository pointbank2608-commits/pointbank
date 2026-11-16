import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from './AccessibleDialog';
import MaterialDraftReview, { type MaterialDraftItem } from './MaterialDraftReview';
import StudyListSourceForm, { StudyListOriginal, type StudyListSourceDraft } from './StudyListSourceForm';
import { AI_MATERIAL_COUNT_LIMIT, generateAiMaterials, makeAiMaterialList, saveAiMaterials, type AiMaterialList } from '../lib/aiMaterials';
import type { WordListKind } from '../lib/types';
import '../styles/textbooks.css';

const kinds = ['words', 'sentences'] as const;
const generationErrors = ['accessDenied', 'rateLimited', 'extractionFailed', 'extractionUnavailable', 'invalidGeneration'];
const button = 'textbook-button';
const primary = `${button} textbook-primary`;
type ReviewItem = MaterialDraftItem & { page?: number; meaningSuggested?: boolean };
type Review = Record<typeof kinds[number], ReviewItem[]>;

export default function AiMaterialsDialog({ academy, owner, mode, preferredKind, onClose, onSaved }: {
  academy: string; owner: string; mode: 'source' | 'topic'; preferredKind?: WordListKind;
  onClose: () => void; onSaved: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('3');
  const [wordCount, setWordCount] = useState('10');
  const [sentenceCount, setSentenceCount] = useState('5');
  const [name, setName] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [original, setOriginal] = useState<StudyListSourceDraft['original']>();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'generating' | 'saving' | null>(null);
  const [error, setError] = useState('');
  const [savePrepared, setSavePrepared] = useState(false);
  const pendingSave = useRef<AiMaterialList[] | null>(null);
  const dialogTitle = t(mode === 'source' ? 'aiMaterials.sourceTitle' : 'aiMaterials.title');
  const requested = { words: Number(wordCount), sentences: Number(sentenceCount) };
  const selectedCount = review ? kinds.reduce((total, kind) => total + review[kind].filter(item => item.included).length, 0) : 0;

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
        topic: topic.trim(), grade: Number(grade), wordCount: requested.words, sentenceCount: requested.sentences,
      });
      const suffix = ` · ${gradeLabel(Number(grade))}`;
      setSourceDraft({ ...draft, title: `${topic.trim().slice(0, 120 - suffix.length).trimEnd()}${suffix}` });
    } catch (err) {
      setError(err instanceof Error && generationErrors.includes(err.message) ? err.message : 'extractionFailed');
    } finally {
      setStatus(null);
    }
  }

  function edit(kind: typeof kinds[number], index: number, update: Partial<MaterialDraftItem>) {
    setReview(current => current && { ...current, [kind]: current[kind].map((item, i) => i === index ? { ...item, ...update } : item) });
    setError('');
  }

  function setSourceDraft(draft: StudyListSourceDraft) {
    const include = (item: Omit<ReviewItem, 'included'>): ReviewItem => ({ ...item, included: true });
    setName(draft.title.trim().slice(0, 120));
    setOriginal(draft.original);
    setPage(draft.original?.first ?? 1);
    setReview({ words: draft.words.map(include), sentences: draft.sentences.map(include) });
    setError('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!review || status || !name.trim() || !selectedCount) return;
    const dialog = event.currentTarget.closest('dialog');
    setError('');
    if (!pendingSave.current) {
      const words = review.words.filter(item => item.included);
      const sentences = review.sentences.filter(item => item.included);
      if ([...words, ...sentences].some(item => !item.text.trim() || !item.meaning.trim())) {
        setError('requireMeaning');
        return;
      }
      const rows = [
        ...(words.length ? [makeAiMaterialList('word', name.trim(), words)] : []),
        ...(sentences.length ? [makeAiMaterialList('sentence', name.trim(), sentences)] : []),
      ];
      pendingSave.current = rows;
      setSavePrepared(true);
    }
    setStatus('saving');
    try {
      const lists = pendingSave.current;
      await saveAiMaterials(academy, owner, lists);
      dialog?.close();
      onSaved((lists.find(list => list.kind === preferredKind) ?? lists[0]).id);
    } catch {
      setError('saveFailed');
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
        <label>{t('aiMaterials.name')}<input value={name} maxLength={120} required disabled={savePrepared}
          onChange={e => setName(e.target.value)} /></label>
      </div>
      <p className="textbook-note">{t(mode === 'source' ? 'aiMaterials.studyReviewHelp' : 'aiMaterials.reviewHelp')}</p>
      {!!original?.unclearPages.length && <p role="status" className="textbook-error">
        {t('textbook.unclear', { pages: original.unclearPages.join(', ') })}
      </p>}
      <div className={original ? 'textbook-review' : undefined}>
        {original && <StudyListOriginal files={original.files} page={page} />}
        <div>{kinds.map(kind => <MaterialDraftReview key={kind} disabled={savePrepared}
          title={t(mode === 'source' ? 'aiMaterials.studyCount' : 'aiMaterials.reviewCount', {
            list: t(`textbook.${kind}`), actual: review[kind].length, requested: requested[kind],
          })}
          items={review[kind]} onEdit={(index, update) => edit(kind, index, update)}
          source={original ? index => {
            const { page: itemPage, meaningSuggested } = review[kind][index];
            return <>
              {itemPage !== undefined && <button type="button" className={button} aria-pressed={page === itemPage}
                onClick={() => setPage(itemPage)}>{t('textbook.page', { count: itemPage })}</button>}
              {meaningSuggested && <small>{t('textbook.suggested')}</small>}
            </>;
          } : undefined} />)}</div>
      </div>
      <footer className="ai-materials-footer">
        {errorMessage && <p role="alert" className="textbook-error">{errorMessage}</p>}
        <p className="textbook-note">{t('textbook.listSharing')}</p>
        <div className="textbook-actions">
          <button type="submit" className={primary} disabled={!!status || !name.trim() || !selectedCount}>
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
        <label>{t('aiMaterials.grade')}<select aria-label={t('aiMaterials.grade')} value={grade} disabled={!!status} onChange={e => setGrade(e.target.value)}>
          {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>
            {gradeLabel(index + 1)}
          </option>)}
        </select></label>
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
