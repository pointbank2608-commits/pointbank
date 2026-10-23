import type { PhonicsBankEntry } from '../lib/types';
import { wordBySpelling } from './phonicsCurriculum';

export function isImageReference(value: unknown): value is string {
  return typeof value === 'string' && (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value));
}

/** Media updates never change the approved word, meaning, rule, order or saved snapshot. */
export function withPhonicsMediaUpdates(base: PhonicsBankEntry[], stored: PhonicsBankEntry[]): PhonicsBankEntry[] {
  return base.map(entry => {
    const matches = stored.filter(row => row.word.trim().toLowerCase() === entry.word.toLowerCase());
    // Historical generated paths are not uploads. A different explicit path/URL is an update.
    const slug = entry.word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const oldDefaults = ['phonics-images', 'word-bank-images'].flatMap(folder => ['png', 'webp'].map(ext => `/${folder}/${slug}.${ext}`));
    const updates = matches.filter(row => isImageReference(row.image_url) && !oldDefaults.includes(row.image_url));
    const urls = [...new Set(updates.map(row => row.image_url!))];
    if (urls.length !== 1) return entry; // Conflicting records need review, never array-position guessing.
    const image = urls[0];
    const outlines = [...new Set(updates.filter(row => row.image_url === image && isImageReference(row.lineart_url)).map(row => row.lineart_url!))];
    const word = wordBySpelling(entry.word);
    const lineart = outlines.length === 1 ? outlines[0]
      : image === entry.image_url || word?.lineartSourceImageUrl === image ? entry.lineart_url : null;
    return { ...entry, image_url: image, lineart_url: lineart };
  });
}

/** Used by every finished workbook, including CVC and historical magic-e references. */
export function workbookWordMedia(word: string, entries: PhonicsBankEntry[]) {
  const entry = entries.find(e => e.curriculum && e.word.toLowerCase() === word.toLowerCase());
  const metadata = wordBySpelling(word);
  return { image: entry ? entry.image_url : metadata?.imageUrl ?? null,
    lineart: entry ? entry.lineart_url ?? null : metadata?.lineartUrl ?? null };
}

export function withWorkbookWordMedia<T extends { words: string[] }>(unit: T, entries: PhonicsBankEntry[]) {
  const media = unit.words.map(word => ({ word, ...workbookWordMedia(word, entries) }));
  return { ...unit,
    images: Object.fromEntries(media.filter(m => isImageReference(m.image)).map(m => [m.word, m.image!])),
    lineart: Object.fromEntries(media.filter(m => isImageReference(m.lineart)).map(m => [m.word, m.lineart!])),
  };
}
