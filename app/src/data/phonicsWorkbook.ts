import type { PhonicsBankEntry } from '../lib/types';
import { lineartUrlForWord, wordSlug } from '../lib/lineart';
import { WORKBOOK_COLOR_PATHS } from '../lib/workbookImageManifest';
export { phonicsCircleRows } from './phonicsWorkbookTasks';

export interface WorkbookIssue { type: 'count' | 'target' | 'color' | 'lineart' | 'duplicate'; word?: string }
export interface PhonicsWorkbookUnit {
  kind: 'phonics';
  unit: number;
  step: 4 | 5;
  family: string;
  heading: string;
  words: string[];
  entryIds: string[];
  targets: Record<string, { red: number[]; blank: number[] }>;
  images: Record<string, string>;
  lineart: Record<string, string>;
  issues: WorkbookIssue[];
}

/** Offsets come from the same explicit {target} annotation shown on /phonics. */
export function patternTargets(word: string, pattern: string): number[] | null {
  let plain = '';
  const positions: number[] = [];
  let marked = false;
  for (const ch of pattern) {
    if (ch === '{') { if (marked) return null; marked = true; }
    else if (ch === '}') { if (!marked) return null; marked = false; }
    else { if (marked) positions.push(plain.length); plain += ch; }
  }
  return !marked && plain === word && positions.length > 0 ? positions : null;
}

const colorPaths = new Set(WORKBOOK_COLOR_PATHS);
function colorFor(entry: PhonicsBankEntry): string | null {
  const slug = wordSlug(entry.word);
  // Local assets are checked at build time; don't silently print a broken DB URL.
  return [entry.image_url?.replace(/\.png$/, '.webp'), `/phonics-images/${slug}.webp`, `/word-bank-images/${slug}.webp`]
    .find((path): path is string => !!path && colorPaths.has(path)) ?? null;
}

/** Keep full rule identity: oo short/long and ow long-o/diphthong never merge. */
export function buildPhonicsWorkbook(entries: PhonicsBankEntry[], step: 4 | 5): PhonicsWorkbookUnit[] {
  const groups = new Map<string, PhonicsBankEntry[]>();
  for (const entry of [...entries].filter(e => e.step === step).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))) {
    const group = groups.get(entry.rule) ?? [];
    group.push(entry);
    groups.set(entry.rule, group);
  }
  const units: PhonicsWorkbookUnit[] = [];
  // Reviewed SH sample is first; only ordering/grouping is workbook-specific.
  const rules = [...groups.keys()].sort((a, b) => Number(b === 'Digraph (sh)') - Number(a === 'Digraph (sh)'));
  for (const rule of rules) {
    const rows = [...groups.get(rule)!];
    if (rule === 'Digraph (sh)') {
      const preferred = ['ship', 'shell', 'fish'];
      rows.sort((a, b) => {
        const rank = (w: string) => preferred.includes(w) ? preferred.indexOf(w) : 3;
        return rank(a.word) - rank(b.word);
      });
    }
    while (rows.length) {
      // Four words become 2+2, never 3+1. One-word source rules remain visibly incomplete.
      const part = rows.splice(0, rows.length === 4 ? 2 : Math.min(3, rows.length));
      const unit: PhonicsWorkbookUnit = {
        kind: 'phonics', unit: units.length + 1, step, family: rule,
        heading: rule === 'Digraph (sh)' ? 'CONSONANT DIGRAPH SH' : rule.toUpperCase(),
        words: part.map(e => e.word), entryIds: part.map(e => e.id), targets: {}, images: {}, lineart: {}, issues: [],
      };
      if (part.length < 2) unit.issues.push({ type: 'count' });
      for (const entry of part) {
        const marks = patternTargets(entry.word, entry.pattern_marked);
        if (!marks) unit.issues.push({ type: 'target', word: entry.word });
        else unit.targets[entry.word] = { red: marks, blank: marks };
        const image = colorFor(entry);
        const lineart = lineartUrlForWord(entry.word);
        if (image) unit.images[entry.word] = image;
        else unit.issues.push({ type: 'color', word: entry.word });
        if (lineart) unit.lineart[entry.word] = lineart;
        else unit.issues.push({ type: 'lineart', word: entry.word });
        if (part.filter(e => e.word === entry.word).length > 1) unit.issues.push({ type: 'duplicate', word: entry.word });
      }
      units.push(unit);
    }
  }
  return units;
}
