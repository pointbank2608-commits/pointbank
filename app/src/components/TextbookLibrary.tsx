import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  createTextbookBook, createTextbookCatalogUnit, fetchTextbookBook, fetchTextbookBooks, fetchTextbookUnit, fetchTextbookWorksheets,
  textbookBookPath, textbookLibraryPath, textbookOriginalUrl, textbookUnitPath, textbookWorksheetPath,
  type TextbookBook, type TextbookUnit, type TextbookWorksheet,
} from '../lib/textbooks';
import '../styles/textbooks.css';

const button = 'textbook-button';
const primary = `${button} textbook-primary`;
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
    if (creating) return <TextbookUnitForm book={book} onSaved={unitSaved} onClose={() => setCreating(false)} />;
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

function TextbookUnitForm({ book, onSaved, onClose }: {
  book: TextbookBook; onSaved: (unit: TextbookUnit) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [id] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !title.trim()) return;
    setSaving(true);
    setFailed(false);
    try {
      onSaved(await createTextbookCatalogUnit(id, book.id, title));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return <form className="textbook-card" onSubmit={submit}>
    <h3>{t('textbook.add')}</h3>
    <p>{book.title}</p>
    <div className="textbook-fields">
      <label>{t('textbook.unit')}<input value={title} maxLength={120} required disabled={saving}
        onChange={event => setTitle(event.target.value)} /></label>
    </div>
    {failed && <p role="alert" className="textbook-error">{t('textbook.saveFailed')}</p>}
    <div className="textbook-actions">
      <button type="submit" className={primary} disabled={saving || !title.trim()}>{t(saving ? 'textbook.saving' : 'textbook.createUnit')}</button>
      <button type="button" className={button} disabled={saving} onClick={onClose}>{t('common.cancel')}</button>
    </div>
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
      {!unit.word_list_id && !unit.sentence_list_id && <>
        <p>{t('textbook.noLists')}</p>
        <Link className={primary} to={textbookWorksheetPath(unit.id)}>{t('textbook.makeWorksheet')}</Link>
      </>}
    </section>
    <section className="textbook-card">
      <h4>{t('textbook.worksheets')}</h4>
      {failed ? <p role="alert">{t('textbook.loadFailed')} <button type="button" className={button} onClick={() => { setFailed(false); setAttempt(i => i + 1); }}>{t('textbook.retry')}</button></p> :
        sheets === null ? <p role="status">{t('common.loading')}</p> : !sheets.length ? <p>{t('textbook.noWorksheets')}</p> :
          <div className="textbook-actions">{sheets.map(sheet => <Link className={button} key={sheet.id} to={textbookWorksheetPath(unit.id, undefined, sheet.id)}>
            {sheet.document.title.trim() || t(`worksheetStudio.activities.${sheet.document.activityId}.title`)}
          </Link>)}</div>}
    </section>
    {!!unit.files.length && <section className="textbook-card">
      <h4>{t('textbook.upload')}</h4>
      <div className="textbook-actions">{unit.files.map(file => <button type="button" className={button} key={file.path} disabled={opening}
        onClick={() => void showOriginal(file)}>{file.name}</button>)}</div>
      {originalFailed && <p role="alert">{t('textbook.loadFailed')}</p>}
      {original && <div className="textbook-original">
        {original.mime !== 'application/pdf' && <img src={original.url} alt={original.name} />}
        <a href={original.url} target="_blank" rel="noopener" className={button}>{t('textbook.openPage')} · {original.name}</a>
      </div>}
    </section>}
  </>;
}
