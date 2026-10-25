import type { PhonicsBankEntry } from '../lib/types';
import { PHONICS_RULES, unitsForStep } from './phonicsCurriculum';
import { isImageReference } from './phonicsMedia';
export { phonicsCircleRows } from './phonicsWorkbookTasks';

export interface WorkbookIssue { type: 'count' | 'target' | 'color' | 'lineart' | 'duplicate' | 'meaning'; word?: string }
export interface PhonicsWorkbookUnit {
  id: string;
  ruleId: string;
  kind: 'phonics';
  unit: number;
  step: 1 | 4 | 5;
  family: string;
  heading: string;
  words: string[];
  entryIds: string[];
  targets: Record<string, { red: number[]; blank: number[] }>;
  images: Record<string, string>;
  lineart: Record<string, string>;
  meanings: Record<string, string>;
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

function colorFor(entry: PhonicsBankEntry): string | null {
  const path = entry.image_url;
  return isImageReference(path) ? path : null;
}

/** Keep full rule identity: oo short/long and ow long-o/diphthong never merge. */
export function buildPhonicsWorkbook(entries: PhonicsBankEntry[], step: 1 | 4 | 5): PhonicsWorkbookUnit[] {
  return unitsForStep(step).map(source => {
      const rule = PHONICS_RULES.find(r => r.id === source.ruleId)!;
      const part = source.entries.map(e => entries.find(row => row.id === e.id) ?? e);
      const unit: PhonicsWorkbookUnit = {
        id: source.id, ruleId: rule.id,
        kind: 'phonics', unit: source.order, step, family: step===1?source.name+source.name.toLowerCase():rule.name,
        heading: step===1?source.name+source.name.toLowerCase():rule.name.toUpperCase(),
        words: part.map(e => e.word), entryIds: part.map(e => e.id), targets: {}, images: {}, lineart: {}, meanings: {}, issues: [],
      };
      if (part.length < 2 || part.length > 3 || part.some(e => !e.word.trim())) unit.issues.push({ type: 'count' });
      for (const entry of part) {
        const canonicalMarks = patternTargets(entry.word, entry.pattern_marked);
        // Alphabet print practice targets the letter itself; the shared Q sound rule remains {qu}.
        const marks = step===1?canonicalMarks?.filter(index=>entry.word[index].toLowerCase()===source.name.toLowerCase()):canonicalMarks;
        if (entry.meaning?.trim()) unit.meanings[entry.word] = entry.meaning;
        if (!marks?.length) unit.issues.push({ type: 'target', word: entry.word });
        else unit.targets[entry.word] = { red: marks, blank: marks };
        const image = colorFor(entry);
        const lineart = isImageReference(entry.lineart_url) ? entry.lineart_url : null;
        if (image) unit.images[entry.word] = image;
        else unit.issues.push({ type: 'color', word: entry.word });
        if (lineart) unit.lineart[entry.word] = lineart;
        else unit.issues.push({ type: 'lineart', word: entry.word });
        if (part.filter(e => e.word === entry.word).length > 1) unit.issues.push({ type: 'duplicate', word: entry.word });
      }
      return unit;
  });
}

/** Every finished workbook requires all six picture activities. */
export function workbookHasPictures(unit: PhonicsWorkbookUnit) {
  return unit.words.every(word => !!unit.images[word]);
}
export function workbookHasLineart(unit: PhonicsWorkbookUnit) {
  return unit.words.every(word => !!unit.lineart[word]);
}
export function workbookBlockingIssues(unit: PhonicsWorkbookUnit): WorkbookIssue[] {
  const issues = [...unit.issues];
  if (unit.words.length < 2 || unit.words.length > 3 || unit.words.some(w => !w.trim())) issues.push({ type: 'count' });
  for (const word of unit.words) {
    const target = unit.targets[word];
    if (!target?.red.length || !target.blank.length || [...target.red, ...target.blank].some(i => !Number.isInteger(i) || i < 0 || i >= word.length)) issues.push({ type: 'target', word });
  }
  for (const word of unit.words) {
    if (!unit.images[word]) issues.push({ type: 'color', word });
    if (!unit.lineart[word]) issues.push({ type: 'lineart', word });
  }
  return issues.filter((issue, i) => issues.findIndex(other => other.type === issue.type && other.word === issue.word) === i);
}
export function workbookPrintable(unit: PhonicsWorkbookUnit) { return workbookBlockingIssues(unit).length === 0; }

/** A failed image never appears as a broken icon in a finished workbook. */
export function withVerifiedWorkbookAssets(unit: PhonicsWorkbookUnit, checked: Record<string, boolean>): PhonicsWorkbookUnit {
  const images = Object.fromEntries(Object.entries(unit.images).filter(([, src]) => checked[src] !== false));
  const lineart = Object.fromEntries(Object.entries(unit.lineart).filter(([, src]) => checked[src] !== false));
  const issues = unit.issues.filter(i => i.type !== 'color' && i.type !== 'lineart');
  for (const word of unit.words) {
    if (!images[word]) issues.push({ type: 'color', word });
    if (!lineart[word]) issues.push({ type: 'lineart', word });
  }
  return { ...unit, images, lineart, issues };
}
