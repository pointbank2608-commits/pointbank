import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  extractTextbook, fetchTextbookUnits, fetchTextbookWorksheets, saveTextbookUnit,
  textbookListItems, textbookOriginalUrl, textbookUnitPath, textbookWorksheetPath,
  TEXTBOOK_FILE_TYPES, TEXTBOOK_MAX_BYTES, TEXTBOOK_MAX_FILES, TEXTBOOK_MAX_PDF_PAGES,
  type TextbookItem, type TextbookUnit, type TextbookWorksheet,
} from '../lib/textbooks';
import '../styles/textbooks.css';

const button = 'textbook-button';
const primary = `${button} textbook-primary`;
type ReviewedItem = TextbookItem & { included: boolean };
type Review = { words: ReviewedItem[]; sentences: ReviewedItem[]; unclearPages: number[] };
const extractionErrors = ['accessDenied', 'invalidFiles', 'invalidPageRange', 'extractionFailed', 'extractionUnavailable', 'rateLimited'];
const fileTypesByExtension: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};

export default function TextbookLibrary({ academy, owner, onSaved }: {
  academy: string; owner: string; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const [units, setUnits] = useState<TextbookUnit[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const active = useRef(false);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setFailed(false);
    try {
      const rows = await fetchTextbookUnits(academy, owner);
      if (active.current && request === sequence.current) setUnits(rows);
    } catch {
      if (active.current && request === sequence.current) setFailed(true);
    }
  }, [academy, owner]);
  useEffect(() => {
    active.current = true;
    void reload();
    return () => { active.current = false; };
  }, [reload]);

  const selectedId = params.get('unit');
  const selected = units?.find(unit => unit.id === selectedId);
  const books = [...new Set(units?.map(unit => unit.textbook))];
  function saved(unit: TextbookUnit) {
    if (!active.current) return;
    ++sequence.current;
    setFailed(false);
    setUnits(prev => [unit, ...(prev ?? []).filter(row => row.id !== unit.id)]);
    setParams({ tab: 'textbooks', unit: unit.id });
    setCreating(false);
    onSaved();
    notify(t('textbook.saved'));
  }

  return <section className="textbook-library" aria-label={t('textbook.tab')}>
    {creating ? <TextbookImport academy={academy} owner={owner} books={books} onSaved={saved} onClose={() => setCreating(false)} /> :
      selected ? <TextbookUnitView key={selected.id} unit={selected} /> : <>
        <header className="textbook-heading">
          <h3>{t('textbook.library')}</h3>
          <button type="button" className={primary} onClick={() => setCreating(true)}>{t('textbook.add')}</button>
        </header>
        {failed ? <p role="alert">{t('textbook.loadFailed')} <button type="button" className={button} onClick={() => void reload()}>{t('textbook.retry')}</button></p> :
          units === null ? <p role="status">{t('common.loading')}</p> : <>
            {selectedId && <p role="alert">{t('textbook.unitMissing')}</p>}
            {!books.length && <p>{t('textbook.empty')}</p>}
            {books.map(book => <section key={book} className="textbook-card">
              <h4>{book}</h4>
              <div className="textbook-actions">{units.filter(unit => unit.textbook === book).map(unit =>
                <Link className={button} key={unit.id} to={textbookUnitPath(unit.id)}>{unit.title}</Link>)}</div>
            </section>)}
          </>}
      </>}
  </section>;
}

function TextbookImport({ academy, owner, books, onSaved, onClose }: {
  academy: string; owner: string; books: string[]; onSaved: (unit: TextbookUnit) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [id] = useState(() => crypto.randomUUID());
  const [book, setBook] = useState('');
  const [title, setTitle] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [first, setFirst] = useState('1');
  const [last, setLast] = useState('1');
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<Review | null>(null);
  const [status, setStatus] = useState<'extracting' | 'saving' | null>(null);
  const [error, setError] = useState('');
  const pdf = files[0]?.type === 'application/pdf';
  const openFile = files[pdf ? 0 : page - 1];
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (!openFile) { setPreview(''); return; }
    const url = URL.createObjectURL(openFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [openFile]);

  function choose(picked: File[]) {
    if (!picked.length) return;
    const next = picked.map(file => {
      if (file.type && file.type !== 'application/octet-stream') return file;
      const type = fileTypesByExtension[file.name.split('.').at(-1)?.toLowerCase() ?? ''];
      return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
    });
    const hasPdf = next.some(file => file.type === 'application/pdf');
    if (next.length > TEXTBOOK_MAX_FILES || (hasPdf && next.length !== 1) ||
        next.some(file => !TEXTBOOK_FILE_TYPES.includes(file.type) || file.size === 0) ||
        next.reduce((bytes, file) => bytes + file.size, 0) > TEXTBOOK_MAX_BYTES) {
      setError('invalidFiles');
      return;
    }
    setFiles(next); setReview(null); setError(''); setPage(1); setFirst('1'); setLast('1');
  }

  async function extract() {
    if (!files.length || status) return;
    const start = Number(first);
    const end = Number(last);
    if (pdf && (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 1000 || end - start >= TEXTBOOK_MAX_PDF_PAGES)) {
      setError('invalidPageRange');
      return;
    }
    setStatus('extracting'); setError('');
    try {
      const next = await extractTextbook(academy, files, start, end);
      const include = (item: TextbookItem) => ({ ...item, included: true });
      setReview({ words: next.words.map(include), sentences: next.sentences.map(include), unclearPages: next.unclearPages });
      setPage(pdf ? start : 1);
    } catch (err) {
      setError(err instanceof Error && extractionErrors.includes(err.message) ? err.message : 'extractionFailed');
    } finally {
      setStatus(null);
    }
  }

  function edit(kind: 'words' | 'sentences', index: number, update: Partial<ReviewedItem>) {
    setReview(current => current && { ...current, [kind]: current[kind].map((item, i) => i === index ? { ...item, ...update } : item) });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (status || !book.trim() || !title.trim() || !files.length) return;
    const words = review?.words.filter(item => item.included) ?? [];
    const sentences = review?.sentences.filter(item => item.included) ?? [];
    if ([...words, ...sentences].some(item => !item.text.trim() || !item.meaning.trim())) {
      setError('requireMeaning');
      return;
    }
    setStatus('saving'); setError('');
    try {
      onSaved(await saveTextbookUnit({
        id, academy, owner, textbook: book, title, files, words: textbookListItems(words), sentences: textbookListItems(sentences),
      }));
    } catch {
      setError('saveFailed');
    } finally {
      setStatus(null);
    }
  }
  const hasSelected = review && [...review.words, ...review.sentences].some(item => item.included);
  return <form className="textbook-card" onSubmit={save}>
    <header className="textbook-heading"><h3>{t('textbook.add')}</h3>
      <button type="button" className={button} disabled={!!status} onClick={onClose}>{t('common.cancel')}</button></header>
    <div className="textbook-fields">
      <label>{t('textbook.book')}<input value={book} list="textbook-names" maxLength={120} required disabled={!!status} onChange={e => setBook(e.target.value)} /></label>
      <datalist id="textbook-names">{books.map(name => <option key={name} value={name} />)}</datalist>
      <label>{t('textbook.unit')}<input value={title} maxLength={120} required disabled={!!status} onChange={e => setTitle(e.target.value)} /></label>
    </div>
    <div className="textbook-actions">
      <label className={button}>{t('textbook.camera')}<input type="file" accept="image/*" capture="environment" disabled={!!status}
        onChange={e => { const photos = [...(e.target.files ?? [])]; if (photos.length) choose([...(pdf ? [] : files), ...photos]); e.target.value = ''; }} /></label>
      <label className={button}>{t('textbook.files')}<input type="file" accept={TEXTBOOK_FILE_TYPES.concat(['.jpg', '.jpeg', '.png', '.webp', '.pdf']).join(',')} multiple disabled={!!status}
        onChange={e => { choose([...(e.target.files ?? [])]); e.target.value = ''; }} /></label>
    </div>
    <p className="textbook-note">{t('textbook.fileLimits')}</p>
    {!!files.length && <>
      <div className="textbook-actions">{files.map((file, i) => <button type="button" className={button} key={i} aria-pressed={pdf || page === i + 1}
        onClick={() => setPage(i + 1)}>{t('textbook.fileOrder', { count: i + 1 })} · {file.name}</button>)}</div>
      {pdf && <div className="textbook-fields">
        <label>{t('textbook.first')}<input type="number" min={1} max={1000} disabled={!!status} value={first}
          onChange={e => { setFirst(e.target.value); if (Number(e.target.value) > Number(last)) setLast(e.target.value); setReview(null); }} /></label>
        <label>{t('textbook.last')}<input type="number" min={1} max={1000} disabled={!!status} value={last} onChange={e => { setLast(e.target.value); setReview(null); }} /></label>
      </div>}
      <p className="textbook-note">{t('textbook.privacy')}</p>
      <button type="button" className={primary} disabled={!!status} onClick={() => void extract()}>
        {t(status === 'extracting' ? 'textbook.extracting' : 'textbook.extract')}</button>
    </>}
    {error && <p role="alert" className="textbook-error">{t(`textbook.${error}`)}</p>}
    {(review || preview) && <div className="textbook-review">
      {preview && <aside className="textbook-original">
        <h4>{t('textbook.upload')}</h4>
        {pdf ? <iframe title={t('textbook.upload')} src={`${preview}#page=${page}`} /> : <img src={preview} alt={openFile?.name ?? ''} />}
        <a className={button} href={pdf ? `${preview}#page=${page}` : preview} target="_blank" rel="noopener">{t('textbook.openPage')} · {t('textbook.page', { count: page })}</a>
      </aside>}
      {review && <div>
        <h4>{t('textbook.review')}</h4><p className="textbook-note">{t('textbook.reviewHelp')}</p>
        {!!review.unclearPages.length && <p role="status" className="textbook-error">{t('textbook.unclear', { pages: review.unclearPages.join(', ') })}</p>}
        {(['words', 'sentences'] as const).map(kind => <fieldset key={kind} disabled={!!status}>
          <legend>{t(`textbook.${kind}`)}</legend>
          {!review[kind].length && <p>{t('textbook.noItems')}</p>}
          {review[kind].map((item, i) => <div className="textbook-item" key={i}>
            <div className="textbook-actions">
              <label className="textbook-check"><input type="checkbox" checked={item.included} onChange={e => edit(kind, i, { included: e.target.checked })} />{t('textbook.include')}</label>
              <button type="button" className={button} aria-pressed={page === item.page} onClick={() => setPage(item.page)}>{t('textbook.page', { count: item.page })}</button>
              {item.meaningSuggested && <small>{t('textbook.suggested')}</small>}
            </div>
            <div className="textbook-fields"><label>{t('textbook.english')}<input value={item.text} maxLength={100} onChange={e => edit(kind, i, { text: e.target.value })} /></label>
              <label>{t('textbook.meaning')}<input value={item.meaning} maxLength={160} onChange={e => edit(kind, i, { meaning: e.target.value })} /></label></div>
          </div>)}
        </fieldset>)}
      </div>}
    </div>}
    {!!files.length && <div>
      {hasSelected && <p className="textbook-note">{t('textbook.listSharing')}</p>}
      <button type="submit" className={primary} disabled={!!status || !book.trim() || !title.trim()}>
        {t(status === 'saving' ? 'textbook.saving' : hasSelected ? 'textbook.save' : 'textbook.saveOriginal')}</button>
    </div>}
  </form>;
}

function TextbookUnitView({ unit }: { unit: TextbookUnit }) {
  const { t } = useTranslation();
  const [sheets, setSheets] = useState<TextbookWorksheet[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [original, setOriginal] = useState<{ url: string; name: string; mime: string } | null>(null);
  const [opening, setOpening] = useState(false);
  const [originalFailed, setOriginalFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    fetchTextbookWorksheets(unit.id).then(rows => { if (current) setSheets(rows); }, () => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [unit.id, attempt]);
  async function showOriginal(file: TextbookUnit['files'][number]) {
    setOpening(true); setOriginalFailed(false);
    try {
      setOriginal({ ...file, url: await textbookOriginalUrl(file) });
    } catch {
      setOriginalFailed(true);
    } finally {
      setOpening(false);
    }
  }
  return <>
    <Link to="/wordlists?tab=textbooks">{t('textbook.back')}</Link>
    <header className="textbook-heading"><h3>{unit.title}</h3><span>{unit.textbook}</span></header>
    <section className="textbook-card">
      <h4>{t('textbook.created')}</h4>
      <div className="textbook-actions">
        {unit.word_list_id && <><Link className={button} to={`/wordlists?list=${unit.word_list_id}`}>{t('textbook.words')}</Link>
          <Link className={primary} to={textbookWorksheetPath(unit.id, unit.word_list_id)}>{t('textbook.wordWorksheet')}</Link></>}
        {unit.sentence_list_id && <><Link className={button} to={`/wordlists?list=${unit.sentence_list_id}`}>{t('textbook.sentences')}</Link>
          <Link className={primary} to={textbookWorksheetPath(unit.id, unit.sentence_list_id)}>{t('textbook.sentenceWorksheet')}</Link></>}
      </div>
      {!unit.word_list_id && !unit.sentence_list_id && <p>{t('textbook.noLists')}</p>}
    </section>
    <section className="textbook-card">
      <h4>{t('textbook.worksheets')}</h4>
      {failed ? <p role="alert">{t('textbook.loadFailed')} <button type="button" className={button} onClick={() => { setFailed(false); setAttempt(i => i + 1); }}>{t('textbook.retry')}</button></p> :
        sheets === null ? <p role="status">{t('common.loading')}</p> : !sheets.length ? <p>{t('textbook.noWorksheets')}</p> :
          <div className="textbook-actions">{sheets.map(sheet => <Link className={button} key={sheet.id} to={textbookWorksheetPath(unit.id, undefined, sheet.id)}>
            {sheet.document.title.trim() || t(`worksheetStudio.activities.${sheet.document.activityId}.title`)}
          </Link>)}</div>}
    </section>
    <section className="textbook-card">
      <h4>{t('textbook.upload')}</h4>
      <div className="textbook-actions">{unit.files.map(file => <button type="button" className={button} key={file.path} disabled={opening}
        onClick={() => void showOriginal(file)}>{file.name}</button>)}</div>
      {originalFailed && <p role="alert">{t('textbook.loadFailed')}</p>}
      {original && <div className="textbook-original">
        {original.mime !== 'application/pdf' && <img src={original.url} alt={original.name} />}
        <a href={original.url} target="_blank" rel="noopener" className={button}>{t('textbook.openPage')} · {original.name}</a>
      </div>}
    </section>
  </>;
}
