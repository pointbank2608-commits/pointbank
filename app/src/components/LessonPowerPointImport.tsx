import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from './AccessibleDialog';
import { PowerPointImportError, PPTX_LIMITS, renderLessonPowerPoint, storeLessonPowerPoint } from '../lib/lessonPowerPoint';
import type { ImageSlide } from '../lib/types';

export default function LessonPowerPointImport({ academyId, onClose, onInsert }: {
  academyId: string;
  onClose: () => void;
  onInsert: (slides: ImageSlide[]) => void;
}) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<{ file: File; url: string }[]>([]);
  const [status, setStatus] = useState<{ phase: 'rendering' | 'uploading'; done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const operation = useRef<AbortController | null>(null);
  const insert = useRef(onInsert);
  insert.current = onInsert;

  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => () => preview.forEach(page => URL.revokeObjectURL(page.url)), [preview]);

  async function run(phase: NonNullable<typeof status>['phase'], file?: File) {
    if (operation.current) return;
    const controller = new AbortController();
    const { signal } = controller;
    operation.current = controller;
    setError('');
    setStatus({ phase, done: 0, total: phase === 'uploading' ? preview.length : 0 });
    const progress = (done: number, total: number) => {
      if (!signal.aborted) setStatus({ phase, done, total });
    };
    try {
      if (file) {
        setPreview([]);
        const pages = await renderLessonPowerPoint(file, signal, progress);
        signal.throwIfAborted();
        setPreview(pages.map(page => ({ file: page, url: URL.createObjectURL(page) })));
      } else {
        await storeLessonPowerPoint(academyId, preview.map(page => page.file), signal, progress, inserted => insert.current(inserted));
      }
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof PowerPointImportError ? cause.reason : phase === 'rendering' ? 'renderError' : 'uploadError');
    } finally {
      operation.current = null;
      if (!signal.aborted) setStatus(null);
    }
  }

  return (
    <AccessibleDialog label={t('lessonPpt.title')} onClose={onClose}>
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{t('lessonPpt.title')}</h2>
          <button type="button" className="min-h-11 px-3" onClick={onClose}>{t('common.close')}</button>
        </div>
        <p className="text-sm">{t('lessonPpt.help', PPTX_LIMITS)} {t('lessonPpt.storage')}</p>
        <label className="block font-bold">
          {t('lessonPpt.choose')}
          <input type="file" accept=".pptx" className="mt-2 block w-full text-sm" disabled={!!status} onChange={event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void run('rendering', file);
          }} />
        </label>
        {status && <p role="status">{t(`lessonPpt.${status.phase}`)} {status.total > 0 && `${status.done}/${status.total}`}</p>}
        {error && <p role="alert" className="text-error">{t(`lessonPpt.${error}`, PPTX_LIMITS)}</p>}
        {preview.length > 0 && <>
          <ol className="grid max-h-[40vh] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">
            {preview.map((page, index) => (
              <li key={page.url} className="rounded-lg border border-outline-variant p-2 text-center">
                <img src={page.url} alt={t('lessonPpt.page', { number: index + 1 })} className="aspect-video w-full object-contain" />
                <span aria-hidden="true" className="text-sm">{index + 1}</span>
              </li>
            ))}
          </ol>
          <button type="button" disabled={!!status} onClick={() => void run('uploading')} className="min-h-11 rounded-full bg-primary px-5 font-bold text-white disabled:opacity-50">
            {t('lessonPpt.insert', { count: preview.length })}
          </button>
        </>}
      </div>
    </AccessibleDialog>
  );
}
