import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  createTextbookBook, extractTextbook, fetchTextbookBook, fetchTextbookBooks, fetchTextbookUnit, fetchTextbookWorksheets, saveTextbookUnit,
  textbookBookPath, textbookLibraryPath, textbookListItems, textbookOriginalUrl, textbookUnitPath, textbookWorksheetPath,
  TEXTBOOK_FILE_TYPES, TEXTBOOK_MAX_BYTES, TEXTBOOK_MAX_FILES, TEXTBOOK_MAX_PDF_PAGES,
  type TextbookBook, type TextbookItem, type TextbookUnit, type TextbookWorksheet,
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

type LibraryOwner = {
  academy: string; owner: string; onSaved: () => void;
};
type Screen =
  | { kind: 'loading' | 'failed' }
  | { kind: 'library'; books: Awaited<ReturnType<typeof fetchTextbookBooks>> }
  | { kind: 'book'; book: Awaited<ReturnType<typeof fetchTextbookBook>> }
  | { kind: 'unit'; unit: TextbookUnit | null };

export default function TextbookLibrary(props: LibraryOwner) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const unitId = params.get('unit');
  const bookId = unitId ? null : params.get('book');
  return <section className="textbook-library" aria-label={t('textbook.tab')}>
    <TextbookLibraryScreen key={unitId ? `unit:${unitId}` : bookId ? `book:${bookId}` : 'library'}
      {...props} unitId={unitId} bookId={bookId} />
  </section>;
}

function TextbookLibraryScreen({ academy, owner, unitId, bookId, onSaved }: LibraryOwner & {
  unitId: string | null; bookId: string | null;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [creating, setCreating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const active = useRef(false);
  const load = useCallback(async (): Promise<Screen> => {
    if (unitId) return { kind: 'unit', unit: await fetchTextbookUnit(academy, owner, unitId) };
    if (bookId) return { kind: 'book', book: await fetchTextbookBook(academy, owner, bookId) };
    return { kind: 'library', books: await fetchTextbookBooks(academy, owner) };
  }, [academy, owner, bookId, unitId]);
  useEffect(() => {
    let current = true;
    active.current = true;
    load().then(result => { if (current) setScreen(result); }, () => { if (current) setScreen({ kind: 'failed' }); });
    return () => { current = false; active.current = false; };
  }, [load, attempt]);

  function unitSaved(unit: TextbookUnit) {
    if (!active.current) return;
    navigate(textbookUnitPath(unit.id));
    onSaved();
    notify(t('textbook.saved'));
  }

  if (screen.kind === 'loading') return <p role="status">{t('common.loading')}</p>;
  if (screen.kind === 'failed') return <>
    {(bookId || unitId) && <Link to={textbookLibraryPath}>{t('textbook.back')}</Link>}
    <p role="alert">{t('textbook.loadFailed')}</p>
    <button type="button" className={button} onClick={() => { setScreen({ kind: 'loading' }); setAttempt(n => n + 1); }}>{t('textbook.retry')}</button>
  </>;
  if (screen.kind === 'unit' && screen.unit) return <TextbookUnitView unit={screen.unit} />;
  if (screen.kind === 'book' && screen.book) {
    const book = screen.book;
    if (creating) return <TextbookImport academy={academy} owner={owner} book={book} onSaved={unitSaved} onClose={() => setCreating(false)} />;
    return <>
      <Link to={textbookLibraryPath}>{t('textbook.back')}</Link>
      <header className="textbook-heading">
        <h3>{book.title}</h3>
        <button type="button" className={primary} onClick={() => setCreating(true)}>{t('textbook.add')}</button>
      </header>
      <section className="textbook-card" aria-label={t('textbook.contents')}>
        <h4>{t('textbook.contents')}</h4>
        {book.units.length ? <ol className="textbook-contents">{book.units.map(unit =>
          <li key={unit.id}><Link className={button} to={textbookUnitPath(unit.id)}>{unit.title}</Link></li>
        )}</ol> : <p>{t('textbook.noUnits')}</p>}
      </section>
    </>;
  }
  if (screen.kind !== 'library') return <>
    <Link to={textbookLibraryPath}>{t('textbook.back')}</Link>
    <p role="alert">{t(screen.kind === 'unit' ? 'textbook.unitMissing' : 'textbook.bookMissing')}</p>
  </>;
  if (creating) return <TextbookBookForm academy={academy} owner={owner} onClose={() => setCreating(false)}
    onSaved={book => { if (active.current) navigate(textbookBookPath(book.id)); }} />;
  return <>
    <header className="textbook-heading">
      <h3>{t('textbook.library')}</h3>
      <button type="button" className={primary} onClick={() => setCreating(true)}>{t('textbook.newBook')}</button>
    </header>
    {screen.books.length ? <ul className="textbook-books">{screen.books.map(book =>
      <li key={book.id}><Link className="textbook-card textbook-book" to={textbookBookPath(book.id)}>
        <span>{book.title}</span>
        <small>{t('textbook.unitCount', { count: book.unitCount })}</small>
      </Link></li>
    )}</ul> : <p>{t('textbook.empty')}</p>}
  </>;
}

function TextbookBookForm({ academy, owner, onSaved, onClose }: {
  academy: string; owner: string; onSaved: (book: TextbookBook) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !title.trim()) return;
    setSaving(true);
    setFailed(false);
    try {
      onSaved(await createTextbookBook(academy, owner, title));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }
  return <form className="textbook-card" onSubmit={submit}>
    <h3>{t('textbook.newBook')}</h3>
    <div className="textbook-fields">
      <label>{t('textbook.book')}<input value={title} maxLength={120} required disabled={saving} onChange={e => setTitle(e.target.value)} /></label>
    </div>
    {failed && <p role="alert" className="textbook-error">{t('textbook.saveFailed')}</p>}
    <div className="textbook-actions">
      <button type="submit" className={primary} disabled={saving || !title.trim()}>{t(saving ? 'textbook.saving' : 'textbook.createBook')}</button>
      <button type="button" className={button} disabled={saving} onClick={onClose}>{t('common.cancel')}</button>
    </div>
  </form>;
}

function TextbookImport({ academy, owner, book, onSaved, onClose }: {
  academy: string; owner: string; book: TextbookBook; onSaved: (unit: TextbookUnit) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [id] = useState(() => crypto.randomUUID());
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
    if (status || !title.trim() || !files.length) return;
    const words = review?.words.filter(item => item.included) ?? [];
    const sentences = review?.sentences.filter(item => item.included) ?? [];
    if ([...words, ...sentences].some(item => !item.text.trim() || !item.meaning.trim())) {
      setError('requireMeaning');
      return;
    }
    setStatus('saving'); setError('');
    try {
      onSaved(await saveTextbookUnit({
        id, academy, owner, textbook: book.title, title, files, words: textbookListItems(words), sentences: textbookListItems(sentences),
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
    <p>{book.title}</p>
    <div className="textbook-fields">
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
      <button type="submit" className={primary} disabled={!!status || !title.trim()}>
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
    <Link to={textbookBookPath(unit.book_id)}>{t('textbook.backToBook')}</Link>
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
