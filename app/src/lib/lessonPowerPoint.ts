import { deleteLessonSlideImage, uploadLessonSlideImage } from './api';
import type { ImageSlide } from './types';

export const PPTX_LIMITS = { mb: 25, pages: 50 };

export class PowerPointImportError extends Error {
  readonly reason: 'format' | 'size' | 'pages';

  constructor(reason: PowerPointImportError['reason']) {
    super(reason);
    this.reason = reason;
  }
}

export async function renderLessonPowerPoint(file: File, signal: AbortSignal, progress: (done: number, total: number) => void) {
  if (!/\.pptx$/i.test(file.name)) throw new PowerPointImportError('format');
  if (file.size > PPTX_LIMITS.mb * 1024 * 1024) throw new PowerPointImportError('size');
  const { PptxRenderer } = await import('pptx-browser');
  const renderer = new PptxRenderer();
  const canvas = document.createElement('canvas');
  try {
    signal.throwIfAborted();
    await renderer.load(file);
    const total = renderer.slideCount;
    if (!total || total > PPTX_LIMITS.pages) throw new PowerPointImportError('pages');
    const ratio = renderer.getInfo().aspectRatio;
    if (!Number.isFinite(ratio) || ratio < 0.1 || ratio > 10) throw new PowerPointImportError('format');
    const width = Math.round(1600 * Math.min(1, ratio));
    const pages: File[] = [];
    for (let index = 0; index < total; index++) {
      signal.throwIfAborted();
      await renderer.renderSlide(index, canvas, width);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(result => result ? resolve(result) : reject(new Error('Slide rendering failed')), 'image/webp', 0.92);
      });
      const extension = blob.type === 'image/webp' ? 'webp' : 'png';
      pages.push(new File([blob], `slide-${index + 1}.${extension}`, { type: blob.type }));
      progress(pages.length, total);
    }
    signal.throwIfAborted();
    return pages;
  } finally {
    renderer.destroy();
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function storeLessonPowerPoint(
  academyId: string, pages: File[], signal: AbortSignal,
  progress: (done: number, total: number) => void, insert: (slides: ImageSlide[]) => void,
) {
  const slides: ImageSlide[] = [];
  try {
    for (const page of pages) {
      signal.throwIfAborted();
      const image = await uploadLessonSlideImage(academyId, page);
      slides.push({ id: crypto.randomUUID(), kind: 'image', imagePath: image.path, imageUrl: image.url });
      progress(slides.length, pages.length);
    }
    signal.throwIfAborted();
    insert(slides);
  } catch (error) {
    await Promise.allSettled(slides.map(slide => deleteLessonSlideImage(slide.imagePath)));
    throw error;
  }
}
