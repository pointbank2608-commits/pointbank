import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GradeSettings } from './grammar/WorkshopEditor';
import { schoolOf } from '../../../supabase/functions/_shared/grammarWorkshop';
import type { SourceMaterialDraft } from '../lib/aiMaterials';
import type { SourceMaterialOptions } from '../lib/teachingMaterials';
import {
  extractTextbook, TEXTBOOK_FILE_TYPES, TEXTBOOK_MAX_BYTES, TEXTBOOK_MAX_FILES, TEXTBOOK_MAX_PDF_PAGES,
} from '../lib/textbooks';

const button = 'textbook-button';
const fileTypes: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};
const acceptedFiles = [...TEXTBOOK_FILE_TYPES, ...Object.keys(fileTypes).map(extension => '.' + extension)].join(',');
const extractionErrors = ['accessDenied', 'invalidFiles', 'invalidPageRange', 'pdfOpenFailed', 'extractionFailed', 'extractionUnavailable', 'rateLimited'];

const studyOutputs = ['words', 'sentences'] as const;
export type StudyListSourceDraft = SourceMaterialDraft & {
  title: string;
  options?: SourceMaterialOptions;
  unitId?: string;
  original?: { files: File[]; first: number; unclearPages: number[] };
};

export default function StudyListSourceForm({ academy, busy, onBusy, onDraft, onGrammar }: {
  academy: string;
  busy: boolean;
  onBusy: (busy: boolean) => void;
 } & ({ onDraft: (draft: StudyListSourceDraft) => void; onGrammar?: never } |
    { onDraft?: never; onGrammar: (files: File[], first: number, last: number, audience: string, grade:number, count:number, countsByGrade:Record<number,number>) => Promise<void> })) {
  const { t } = useTranslation();
  const [source, setSource] = useState<'camera' | 'file'>('file');
  const [files, setFiles] = useState<File[]>([]);
  const [first, setFirst] = useState('1');
  const [grade,setGrade]=useState(7);
  const [counts,setCounts]=useState<Record<number,number>>({});
  const [last, setLast] = useState('1');
  const [outputs, setOutputs] = useState<(typeof studyOutputs[number])[]>(['words', 'sentences']);
  const [error, setError] = useState('');
  const isPdf = files[0]?.type === 'application/pdf';

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
    setFiles(next);
    setError('');
    setFirst('1');
    setLast('1');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !files.length || !outputs.length) return;
    const options: SourceMaterialOptions = { outputs };
    const start = Number(first);
    const end = Number(last);
    if (isPdf && (!Number.isInteger(start) || !Number.isInteger(end)
      || start < 1 || end < start || end > 1000 || end - start >= TEXTBOOK_MAX_PDF_PAGES)) {
      setError('invalidPageRange');
      return;
    }
    setError('');
    onBusy(true);
    const requestOptions = outputs.length === 2 ? undefined : options;
    try {
      if (onGrammar) {
        await onGrammar(files, start, end, schoolOf(grade),grade,counts[grade]??5,counts);
        return;
      }
      const items = await extractTextbook(academy, files, start, end, requestOptions);
      if (!items.words.length && !items.sentences.length) throw new Error(items.unclearPages.length ? 'extractionFailed' : 'noStudyItems');
      onDraft({ words: items.words, sentences: items.sentences,
        title: files[0].name.replace(/\.[^.]+$/, '') || files[0].name, options,
        original: { files, first: isPdf ? start : 1, unclearPages: items.unclearPages } });
    } catch (err) {
      setError(err instanceof Error && [...extractionErrors, 'noStudyItems','noGrammarSource','incompleteGrammar'].includes(err.message)
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
      </div>
    </fieldset>
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
    <p className="textbook-note">{t(onGrammar ? 'aiMaterials.grammarPhotoNotice' : 'textbook.privacy')}</p>
    {onGrammar ? <GradeSettings disabled={busy} grade={grade} count={counts[grade]??5} max={25}
      onChange={(g,n)=>{if(g===grade)setCounts(old=>({...old,[g]:n}));setGrade(g);}}/> : <fieldset disabled={busy} className="teaching-output-picker">
      <legend>{t('aiMaterials.outputs')}</legend>
      <div className="teaching-output-options">
        {studyOutputs.map(output => <label className="teaching-output" key={output}>
          <input type="checkbox" checked={outputs.includes(output)} onChange={event => {
            setOutputs(current => studyOutputs.filter(kind => kind === output ? event.target.checked : current.includes(kind)));
            setError('');
          }} />
          <span className="material-symbols-outlined" aria-hidden="true">{output === 'words' ? 'library_books' : 'notes'}</span>
          <span>{t(`textbook.${output}`)}</span>
        </label>)}
      </div>
    </fieldset>}
    {error && <p role="alert" className="textbook-error">
      {t(extractionErrors.includes(error) ? 'textbook.' + error : 'aiMaterials.' + error)}
    </p>}
    <button type="submit" className={button + ' textbook-primary'}
      disabled={busy || !outputs.length || !files.length}>
      <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
      {t(busy ? onGrammar ? 'aiMaterials.readingGrammar' : 'aiMaterials.readingSource' : onGrammar ? 'myGrammar.generateAndSave' : 'textbook.extract')}
    </button>
  </form>;
}

function StudySourceLabel({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return <>
    <span className="material-symbols-outlined study-source-icon" aria-hidden="true">{icon}</span>
    <span className="study-source-label"><strong>{title}</strong><small>{hint}</small></span>
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
