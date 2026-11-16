import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { extractWorksheetMaterials, type AiMaterialDraft } from '../lib/aiMaterials';
import {
  extractTextbook, fetchTextbookUnits, fetchTextbookWorksheets, textbookUnitName, TEXTBOOK_FILE_TYPES,
  TEXTBOOK_MAX_BYTES, TEXTBOOK_MAX_FILES, TEXTBOOK_MAX_PDF_PAGES, type TextbookUnit,
} from '../lib/textbooks';
import { readWorksheetStore, studioKey, type WorksheetDocument } from '../lib/worksheetStudio';

const button = 'textbook-button';
const fileTypes: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};
const acceptedFiles = [...TEXTBOOK_FILE_TYPES, ...Object.keys(fileTypes).map(extension => '.' + extension)].join(',');
const extractionErrors = ['accessDenied', 'invalidFiles', 'invalidPageRange', 'extractionFailed', 'extractionUnavailable', 'rateLimited'];

export type StudyListSourceDraft = AiMaterialDraft & {
  title: string;
  original?: { files: File[]; first: number; unclearPages: number[] };
};

export default function StudyListSourceForm({ academy, owner, busy, onBusy, onDraft }: {
  academy: string;
  owner: string;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onDraft: (draft: StudyListSourceDraft) => void;
}) {
  const { t } = useTranslation();
  const [source, setSource] = useState<'file' | 'worksheet'>('file');
  const [files, setFiles] = useState<File[]>([]);
  const [first, setFirst] = useState('1');
  const [last, setLast] = useState('1');
  const [worksheet, setWorksheet] = useState<{ title: string; document: WorksheetDocument } | null>(null);
  const [error, setError] = useState('');
  const isPdf = files[0]?.type === 'application/pdf';

  function choose(picked: File[]) {
    if (!picked.length) return;
    const next = picked.map(file => {
      if (file.type && file.type !== 'application/octet-stream') return file;
      const type = fileTypes[file.name.split('.').at(-1)?.toLowerCase() ?? ''];
      return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
    });
    if (next.length > TEXTBOOK_MAX_FILES || (next.length !== 1 && next.some(file => file.type === 'application/pdf')) ||
        next.some(file => !TEXTBOOK_FILE_TYPES.includes(file.type) || file.size === 0) ||
        next.reduce((size, file) => size + file.size, 0) > TEXTBOOK_MAX_BYTES) {
      setError('invalidFiles');
      return;
    }
    setFiles(next);
    setError('');
    setFirst('1');
    setLast('1');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || (source === 'file' ? !files.length : !worksheet)) return;
    const start = Number(first);
    const end = Number(last);
    if (source === 'file' && isPdf && (!Number.isInteger(start) || !Number.isInteger(end)
      || start < 1 || end < start || end > 1000 || end - start >= TEXTBOOK_MAX_PDF_PAGES)) {
      setError('invalidPageRange');
      return;
    }
    setError('');
    onBusy(true);
    try {
      if (source === 'worksheet' && worksheet) {
        const items = await extractWorksheetMaterials(academy, worksheet.document);
        onDraft({ ...items, title: worksheet.title });
        return;
      }
      const items = await extractTextbook(academy, files, start, end);
      if (!items.words.length && !items.sentences.length) {
        setError(items.unclearPages.length ? 'extractionFailed' : 'noStudyItems');
        return;
      }
      onDraft({ ...items, title: files[0].name.replace(/\.[^.]+$/, '') || files[0].name,
        original: { files, first: isPdf ? start : 1, unclearPages: items.unclearPages } });
    } catch (err) {
      setError(err instanceof Error && [...extractionErrors, 'noWorksheetText', 'noStudyItems'].includes(err.message)
        ? err.message : 'extractionFailed');
    } finally {
      onBusy(false);
    }
  }

  return <form className="ai-materials-form" onSubmit={submit}>
    <div className="textbook-actions" aria-label={t('aiMaterials.source')}>
      <button type="button" className={button} disabled={busy} aria-pressed={source === 'file'}
        onClick={() => { setSource('file'); setWorksheet(null); setError(''); }}>{t('aiMaterials.sourceFiles')}</button>
      <button type="button" className={button} disabled={busy} aria-pressed={source === 'worksheet'}
        onClick={() => { setSource('worksheet'); setError(''); }}>{t('aiMaterials.sourceWorksheet')}</button>
    </div>
    {source === 'file' ? <>
      <div className="textbook-actions">
        <label className={button}>{t('textbook.camera')}<input type="file" accept="image/*" capture="environment" disabled={busy}
          onChange={event => {
            const photos = [...(event.target.files ?? [])];
            if (photos.length) choose([...(isPdf ? [] : files), ...photos]);
            event.target.value = '';
          }} /></label>
        <label className={button}>{t('textbook.files')}<input type="file" accept={acceptedFiles} multiple disabled={busy}
          onChange={event => { choose([...(event.target.files ?? [])]); event.target.value = ''; }} /></label>
      </div>
      <p className="textbook-note">{t('textbook.fileLimits')}</p>
      {!!files.length && <ol className="study-source-files">{files.map((file, index) =>
        <li key={index}>{file.name}</li>)}</ol>}
      {isPdf && <div className="textbook-fields">
        <label>{t('textbook.first')}<input type="number" min={1} max={1000} disabled={busy} value={first}
          onChange={event => { setFirst(event.target.value); if (Number(event.target.value) > Number(last)) setLast(event.target.value); }} /></label>
        <label>{t('textbook.last')}<input type="number" min={1} max={1000} disabled={busy} value={last}
          onChange={event => setLast(event.target.value)} /></label>
      </div>}
      <p className="textbook-note">{t('textbook.privacy')}</p>
    </> : <>
      <StudyWorksheetPicker academy={academy} owner={owner} busy={busy} onSelect={setWorksheet} />
      <p className="textbook-note">{t('aiMaterials.worksheetPrivacy')}</p>
    </>}
    {error && <p role="alert" className="textbook-error">
      {t(error === 'extractionFailed' && source === 'worksheet' ? 'aiMaterials.worksheetExtractionFailed'
        : extractionErrors.includes(error) ? 'textbook.' + error : 'aiMaterials.' + error)}
    </p>}
    <button type="submit" className={button + ' textbook-primary'}
      disabled={busy || (source === 'file' ? !files.length : !worksheet)}>
      {t(busy ? 'aiMaterials.readingSource' : 'textbook.extract')}
    </button>
  </form>;
}

function StudyWorksheetPicker({ academy, owner, busy, onSelect }: {
  academy: string;
  owner: string;
  busy: boolean;
  onSelect: (worksheet: { title: string; document: WorksheetDocument } | null) => void;
}) {
  const { t } = useTranslation();
  const [copies] = useState(() => readWorksheetStore(studioKey(owner, academy)).copies);
  const [units, setUnits] = useState<TextbookUnit[] | null>(null);
  const [unit, setUnit] = useState('');
  const [sheet, setSheet] = useState('');
  const [sheets, setSheets] = useState<{ id: string; title: string; document: WorksheetDocument }[] | null>(null);
  const [error, setError] = useState<'units' | 'sheets' | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (units) return;
    let active = true;
    fetchTextbookUnits(academy, owner).then(rows => { if (active) setUnits(rows); },
      () => { if (active) setError('units'); });
    return () => { active = false; };
  }, [academy, owner, retry, units]);

  useEffect(() => {
    if (!unit || unit === 'local') return;
    let active = true;
    fetchTextbookWorksheets(unit).then(rows => {
      if (active) setSheets(rows.map(row => ({ ...row,
        title: row.document.title.trim() || t(`worksheetStudio.activities.${row.document.activityId}.title`),
      })));
    }, () => { if (active) setError('sheets'); });
    return () => { active = false; };
  }, [unit, retry, t]);

  const options = unit === 'local' ? copies.map(copy => ({ ...copy, title: copy.name || copy.document.title })) : sheets;
  return <>
    <div className="textbook-fields">
      <label>{t('aiMaterials.worksheetLocation')}<select value={unit} disabled={busy} onChange={event => {
        setUnit(event.target.value); setSheet(''); setSheets(null);
        if (error === 'sheets') setError(null);
        onSelect(null);
      }}>
        <option value="">{t('aiMaterials.chooseLocation')}</option>
        <option value="local">{t('aiMaterials.localWorksheets')}</option>
        {units?.map(row => <option key={row.id} value={row.id}>{textbookUnitName(row)}</option>)}
      </select></label>
      {!!options?.length && <label>{t('aiMaterials.sourceWorksheet')}<select value={sheet} disabled={busy}
        onChange={event => {
          setSheet(event.target.value);
          onSelect(options.find(option => option.id === event.target.value) ?? null);
        }}>
        <option value="">{t('aiMaterials.chooseWorksheet')}</option>
        {options.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}
      </select></label>}
    </div>
    {unit && options?.length === 0 && <p className="textbook-note">{t('aiMaterials.noWorksheets')}</p>}
    {!error && (!units || (unit && !options)) && <p role="status">{t('common.loading')}</p>}
    {error && <p className="textbook-error" role="alert">{t('aiMaterials.worksheetLoadFailed')}{' '}
      <button type="button" className={button} disabled={busy}
        onClick={() => { setError(null); setRetry(value => value + 1); }}>{t('textbook.retry')}</button></p>}
  </>;
}

export function StudyListOriginal({ files, page }: { files: File[]; page: number }) {
  const { t } = useTranslation();
  const pdf = files[0].type === 'application/pdf';
  const file = files[pdf ? 0 : page - 1];
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!preview || !file) return null;
  const href = pdf ? preview + '#page=' + page : preview;
  return <aside className="textbook-original">
    <a className={button} href={href} target="_blank" rel="noopener">
      {t('textbook.openPage')} · {t('textbook.page', { count: page })}
    </a>
    {pdf ? <iframe title={t('textbook.upload')} src={href} /> : <img src={href} alt={file.name} />}
  </aside>;
}
