import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { supabase } from './supabase';

GlobalWorkerOptions.workerSrc = workerUrl;
const bucket = () => supabase.storage.from('lesson-pdfs');
export const openLessonPdf = (data: ArrayBuffer) => getDocument({ data, isEvalSupported: false, useWasm: false });

export async function uploadLessonPdf(academyId: string, file: File) {
  if (!/\.pdf$/i.test(file.name) || !file.size || file.size > 25 * 1024 * 1024) throw new Error('lessonUx.pdfFileError');
  const task = openLessonPdf(await file.arrayBuffer());
  let thumbnail: Blob;
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 420 / Math.max(original.width, original.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    thumbnail = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob?.type === 'image/webp' ? resolve(blob) : reject(new Error('lessonUx.pdfOpenError')), 'image/webp', .8);
    });
  } catch {
    throw new Error('lessonUx.pdfOpenError');
  } finally {
    await task.destroy();
  }
  const base = `${academyId}/${crypto.randomUUID()}`;
  const pdfPath = base + '.pdf';
  const thumbnailPath = base + '.webp';
  const pdf = await bucket().upload(pdfPath, file, { contentType: 'application/pdf' });
  if (pdf.error) throw new Error('lessonUx.pdfUploadError');
  const cover = await bucket().upload(thumbnailPath, thumbnail, { contentType: 'image/webp' });
  if (cover.error) {
    await bucket().remove([pdfPath]);
    throw new Error('lessonUx.pdfUploadError');
  }
  return { title: file.name, pdfPath, thumbnailPath };
}

export async function downloadLessonPdf(path: string) {
  const { data, error } = await bucket().download(path);
  if (error || !data) throw new Error('lessonUx.pdfOpenError');
  return data.arrayBuffer();
}

export async function lessonPdfThumbnail(path: string) {
  const { data } = await bucket().createSignedUrl(path, 3600);
  return data?.signedUrl ?? '';
}
