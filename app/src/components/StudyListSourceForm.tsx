import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { extractWorksheetMaterials, type SourceMaterialDraft } from '../lib/aiMaterials';
import { hasTeachingDraft, type MaterialOutput, type SourceMaterialOptions } from '../lib/teachingMaterials';
import {
  extractTextbook, fetchTextbookUnits, fetchTextbookWorksheets, textbookUnitName, TEXTBOOK_FILE_TYPES,
  TEXTBOOK_MAX_BYTES, TEXTBOOK_MAX_FILES, TEXTBOOK_MAX_PDF_PAGES, type TextbookUnit,
} from '../lib/textbooks';
import { readWorksheetStore, studioKey, type WorksheetDocument } from '../lib/worksheetStudio';
import TeachingMaterialOptions, { buildSourceOptions, defaultTeachingForm } from './TeachingMaterialOptions';

const button = 'textbook-button';
const fileTypes: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};
const acceptedFiles = [...TEXTBOOK_FILE_TYPES, ...Object.keys(fileTypes).map(extension => '.' + extension)].join(',');
const extractionErrors = ['accessDenied', 'invalidFiles', 'invalidPageRange', 'extractionFailed', 'extractionUnavailable', 'rateLimited'];

type SelectedWorksheet = { title: string; document: WorksheetDocument; unitId?: string };
export type StudyListSourceDraft = SourceMaterialDraft & {
  title: string;
  options?: SourceMaterialOptions;
  unitId?: string;
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
  const [source, setSource] = useState<'camera' | 'file' | 'worksheet'>('file');
  const [files, setFiles] = useState<File[]>([]);
  const [first, setFirst] = useState('1');
  const [last, setLast] = useState('1');
  const [worksheet, setWorksheet] = useState<SelectedWorksheet | null>(null);
  const [outputs, setOutputs] = useState<MaterialOutput[]>(['words', 'sentences']);
  const [settings, setSettings] = useState(defaultTeachingForm);
  const [error, setError] = useState('');
  const isPdf = files[0]?.type === 'application/pdf';
  const teaching = outputs.includes('lesson') || outputs.includes('workbook');

  function choose(picked: File[], from: 'camera' | 'file') {
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
    setSource(from);
    setWorksheet(null);
    setFiles(next);
    setError('');
    setFirst('1');
    setLast('1');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || (source === 'worksheet' ? !worksheet : !files.length)) return;
    const options = buildSourceOptions(outputs, settings);
    if (!options) { setError('invalidTeachingOptions'); return; }
    const start = Number(first);
    const end = Number(last);
    if (source !== 'worksheet' && isPdf && (!Number.isInteger(start) || !Number.isInteger(end)
      || start < 1 || end < start || end > 1000 || end - start >= TEXTBOOK_MAX_PDF_PAGES)) {
      setError('invalidPageRange');
      return;
    }
    setError('');
    onBusy(true);
    const requestOptions = !teaching && outputs.length === 2 ? undefined : options;
    try {
      if (source === 'worksheet' && worksheet) {
        const items = await extractWorksheetMaterials(academy, worksheet.document, requestOptions);
        onDraft({ ...items, title: worksheet.title, options, unitId: worksheet.unitId });
        return;
      }
      const items = await extractTextbook(academy, files, start, end, requestOptions);
      if (teaching && !hasTeachingDraft(items, options)) throw new Error('extractionFailed');
      if (!teaching && !items.words.length && !items.sentences.length) throw new Error(items.unclearPages.length ? 'extractionFailed' : 'noStudyItems');
      onDraft({ ...items, title: files[0].name.replace(/\.[^.]+$/, '') || files[0].name, options,
        original: { files, first: isPdf ? start : 1, unclearPages: items.unclearPages } });
    } catch (err) {
      setError(err instanceof Error && [...extractionErrors, 'noWorksheetText', 'noStudyItems', 'insufficientSource', 'invalidTeachingOptions'].includes(err.message)
        ? err.message : 'extractionFailed');
    } finally {
      onBusy(false);
    }
  }

  return <form className="ai-materials-form" onSubmit={submit}>
    <fieldset className="study-source-picker">
      <legend>{t('aiMaterials.source')}</legend>
      <div className="study-source-options">
        <label className="study-source-option" data-active={source === 'camera' && !!files.length}>
          <StudySourceLabel icon="photo_camera" title={t('textbook.camera')} hint={t('aiMaterials.cameraHint')} />
          <input type="file" accept="image/*" capture="environment" disabled={busy}
            aria-label={t('textbook.camera')}
            onChange={event => {
              const photos = [...(event.target.files ?? [])];
              if (photos.length) choose([...(isPdf ? [] : files), ...photos], 'camera');
              event.target.value = '';
            }} />
        </label>
        <label className="study-source-option" data-active={source === 'file' && !!files.length}>
          <StudySourceLabel icon="upload_file" title={t('textbook.files')} hint={t('aiMaterials.filesHint')} />
          <input type="file" accept={acceptedFiles} multiple disabled={busy} aria-label={t('textbook.files')}
            onChange={event => { choose([...(event.target.files ?? [])], 'file'); event.target.value = ''; }} />
        </label>
        <button type="button" className="study-source-option" disabled={busy} aria-pressed={source === 'worksheet'}
          aria-label={t('aiMaterials.sourceWorksheet')}
          onClick={() => { setSource('worksheet'); setError(''); }}>
          <StudySourceLabel icon="assignment" title={t('aiMaterials.sourceWorksheet')} hint={t('aiMaterials.worksheetHint')} />
        </button>
      </div>
    </fieldset>
    {source !== 'worksheet' ? <>
      <p className="textbook-note">{t('textbook.fileLimits')}</p>
      {!!files.length && <section className="study-source-details" aria-label={t('aiMaterials.selectedFiles')}>
        <strong>{t('aiMaterials.selectedFiles')}</strong>
        <ol className="study-source-files">{files.map((file, index) => <li key={index}>{file.name}</li>)}</ol>
      </section>}
      {isPdf && <div className="textbook-fields">
        <label>{t('textbook.first')}<input type="number" min={1} max={1000} disabled={busy} value={first}
          onChange={event => { setFirst(event.target.value); if (Number(event.target.value) > Number(last)) setLast(event.target.value); }} /></label>
        <label>{t('textbook.last')}<input type="number" min={1} max={1000} disabled={busy} value={last}
          onChange={event => setLast(event.target.value)} /></label>
      </div>}
      <p className="textbook-note">{t(teaching ? 'aiMaterials.fileProvider' : 'textbook.privacy')}</p>
    </> : <>
      <StudyWorksheetPicker academy={academy} owner={owner} busy={busy} onSelect={setWorksheet} />
      <p className="textbook-note">{t('aiMaterials.worksheetPrivacy')}</p>
    </>}
    <TeachingMaterialOptions outputs={outputs} form={settings} disabled={busy}
      onOutputs={next => { setOutputs(next); setError(''); }} onForm={next => { setSettings(next); setError(''); }} />
    {error && <p role="alert" className="textbook-error">
      {t(error === 'extractionFailed' && source === 'worksheet' ? 'aiMaterials.worksheetExtractionFailed'
        : extractionErrors.includes(error) ? 'textbook.' + error : 'aiMaterials.' + error)}
    </p>}
    <button type="submit" className={button + ' textbook-primary'}
      disabled={busy || !outputs.length || (source === 'worksheet' ? !worksheet : !files.length)}>
      <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
      {t(busy ? 'aiMaterials.readingSource' : teaching ? 'aiMaterials.createDrafts' : 'textbook.extract')}
    </button>
  </form>;
}

function StudySourceLabel({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return <>
    <span className="material-symbols-outlined study-source-icon" aria-hidden="true">{icon}</span>
    <span className="study-source-label"><strong>{title}</strong><small>{hint}</small></span>
  </>;
}

function StudyWorksheetPicker({ academy, owner, busy, onSelect }: {
  academy: string;
  owner: string;
  busy: boolean;
  onSelect: (worksheet: SelectedWorksheet | null) => void;
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
          const option = options.find(row => row.id === event.target.value);
          onSelect(option ? { title: option.title, document: option.document, unitId: unit === 'local' ? undefined : unit } : null);
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
