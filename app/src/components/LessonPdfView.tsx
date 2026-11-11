import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfSlide } from '../lib/types';

export function LessonPdfThumbnail({ slide }: { slide: PdfSlide }) {
  const [image, setImage] = useState('');
  useEffect(() => {
    let active = true;
    void import('../lib/lessonPdf').then(m => m.lessonPdfThumbnail(slide.thumbnailPath))
      .then(url => { if (active) setImage(url); }).catch(() => {});
    return () => { active = false; };
  }, [slide.thumbnailPath]);
  return image
    ? <img src={image} alt={slide.title} onError={() => setImage('')} className="h-full w-full object-contain" />
    : <span className="material-symbols-outlined" aria-hidden>picture_as_pdf</span>;
}

export default function LessonPdfView({ slide, fill = false }: { slide: PdfSlide; fill?: boolean }) {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    let destroy: (() => Promise<void>) | undefined;
    void import('../lib/lessonPdf').then(async ({ downloadLessonPdf, openLessonPdf }) => {
      const bytes = await downloadLessonPdf(slide.pdfPath);
      if (!active) return;
      const task = openLessonPdf(bytes);
      destroy = () => task.destroy();
      const pdf = await task.promise;
      if (active) setDoc(pdf);
    }).catch(() => { if (active) setError('lessonUx.pdfOpenError'); });
    return () => { active = false; void destroy?.(); };
  }, [slide.pdfPath]);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !width || !canvas.current) return;
    const target = canvas.current;
    let active = true;
    let cancel: (() => void) | undefined;
    void doc.getPage(page).then(pdfPage => {
      if (!active) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const base = pdfPage.getViewport({ scale: 1 });
      const cssWidth = Math.max(1, Math.min(width - 24, 1000) * zoom);
      const view = pdfPage.getViewport({ scale: cssWidth * ratio / base.width });
      target.width = Math.ceil(view.width);
      target.height = Math.ceil(view.height);
      target.style.width = `${cssWidth}px`;
      const render = pdfPage.render({ canvas: target, viewport: view });
      cancel = () => render.cancel();
      return render.promise;
    }).catch(() => { if (active) setError('lessonUx.pdfOpenError'); });
    return () => { active = false; cancel?.(); };
  }, [doc, page, width, zoom]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  async function toggleFullscreen() {
    try {
      if (fullscreen) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch { setError('lessonUx.pdfFullscreenError'); }
  }

  return <div ref={root} className={`${fill ? 'absolute inset-0' : 'h-[65vh]'} flex min-h-0 flex-col overflow-hidden rounded-xl bg-slate-100 text-deep-navy`} data-lesson-pdf-view>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-outline-variant bg-white p-3">
      <strong className="min-w-0 flex-1 break-all">{slide.title}</strong>
      {doc && <>
        <button type="button" className={control} disabled={page === 1} onClick={() => setPage(n => n - 1)}>{t('lessonUx.previousPage')}</button>
        <span aria-live="polite">{page} / {doc.numPages}</span>
        <button type="button" className={control} disabled={page === doc.numPages} onClick={() => setPage(n => n + 1)}>{t('lessonUx.nextPage')}</button>
        <button type="button" className={control} disabled={zoom <= .5} onClick={() => setZoom(n => n - .25)}>{t('lessonUx.pdfZoomOut')}</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" className={control} disabled={zoom >= 2} onClick={() => setZoom(n => n + .25)}>{t('lessonUx.pdfZoomIn')}</button>
      </>}
      <button type="button" className={control} disabled={!doc} onClick={() => void toggleFullscreen()}>{t(fullscreen ? 'lessonUx.pdfExitFullscreen' : 'lessonUx.pdfFullscreen')}</button>
    </div>
    {error && <p role="alert" className="p-3 text-error">{t(error)}</p>}
    {!doc && !error && <p role="status" className="p-3">{t('lessonUx.pdfLoading')}</p>}
    <div ref={viewport} className="min-h-0 flex-1 overflow-auto p-3">
      <canvas ref={canvas} hidden={!doc} className="mx-auto block h-auto max-w-none bg-white shadow" aria-label={`${slide.title} · ${page}`} />
    </div>
  </div>;
}

const control = 'min-h-10 rounded-lg border border-outline-variant px-3 font-bold text-primary disabled:opacity-50';
