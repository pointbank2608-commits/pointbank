import { openLessonPdf } from './lessonPdf';

export async function renderTextbookPdf(file: File, first: number, last: number): Promise<File[]> {
  const task = openLessonPdf(await file.arrayBuffer());
  const images: File[] = [];
  try {
    const pdf = await task.promise;
    if (last > pdf.numPages) throw new Error('invalidPageRange');
    for (let number = first; number <= last; number++) {
      const page = await pdf.getPage(number);
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 2048 / Math.max(original.width, original.height) });
      const canvas = document.createElement('canvas');
      try {
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport, background: '#ffffff' }).promise;
        const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          blob => blob?.type === 'image/jpeg' ? resolve(blob) : reject(new Error('pdfOpenFailed')), 'image/jpeg', .9));
        images.push(new File([image], `textbook-page-${number}.jpg`, { type: 'image/jpeg' }));
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    }
    return images;
  } catch (error) {
    throw new Error(error instanceof Error && error.message === 'invalidPageRange' ? error.message : 'pdfOpenFailed');
  } finally {
    await task.destroy();
  }
}
