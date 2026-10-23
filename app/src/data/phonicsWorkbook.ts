import type { PhonicsBankEntry } from '../lib/types';
import { WORKBOOK_COLOR_PATHS } from '../lib/workbookImageManifest';
import { PHONICS_RULES, unitsForStep, wordBySpelling } from './phonicsCurriculum';
export { phonicsCircleRows } from './phonicsWorkbookTasks';

export interface WorkbookIssue { type: 'count' | 'target' | 'color' | 'lineart' | 'duplicate' | 'meaning'; word?: string }
export interface PhonicsWorkbookUnit {
  id: string;
  ruleId: string;
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

const colorPaths = new Set(WORKBOOK_COLOR_PATHS);
function colorFor(entry: PhonicsBankEntry): string | null {
  // Local assets are checked at build time; don't silently print a broken DB URL.
  const path = entry.image_url;
  return path && colorPaths.has(path) ? path : null;
}

/** Keep full rule identity: oo short/long and ow long-o/diphthong never merge. */
export function buildPhonicsWorkbook(entries: PhonicsBankEntry[], step: 4 | 5): PhonicsWorkbookUnit[] {
  return unitsForStep(step).map(source => {
      const rule = PHONICS_RULES.find(r => r.id === source.ruleId)!;
      const part = source.entries.map(e => entries.find(row => row.id === e.id) ?? e);
      const unit: PhonicsWorkbookUnit = {
        id: source.id, ruleId: rule.id,
        kind: 'phonics', unit: source.order, step, family: rule.name,
        heading: rule.name.toUpperCase(),
        words: part.map(e => e.word), entryIds: part.map(e => e.id), targets: {}, images: {}, lineart: {}, meanings: {}, issues: [],
      };
      if (part.length < 2 || part.length > 3 || part.some(e => !e.word.trim())) unit.issues.push({ type: 'count' });
      for (const entry of part) {
        const marks = patternTargets(entry.word, entry.pattern_marked);
        if (entry.meaning?.trim()) unit.meanings[entry.word] = entry.meaning;
        if (!marks) unit.issues.push({ type: 'target', word: entry.word });
        else unit.targets[entry.word] = { red: marks, blank: marks };
        const image = colorFor(entry);
        const lineart = wordBySpelling(entry.word)?.lineartUrl;
        if (image) unit.images[entry.word] = image;
        else unit.issues.push({ type: 'color', word: entry.word });
        if (lineart) unit.lineart[entry.word] = lineart;
        else unit.issues.push({ type: 'lineart', word: entry.word });
        if (part.filter(e => e.word === entry.word).length > 1) unit.issues.push({ type: 'duplicate', word: entry.word });
      }
      return unit;
  });
}

/** Missing pictures change activities, while invalid content still blocks printing. */
export function workbookHasPictures(unit: PhonicsWorkbookUnit) {
  return unit.words.every(word => !!unit.images[word]);
}
export function workbookHasLineart(unit: PhonicsWorkbookUnit) {
  return unit.words.every(word => !!unit.lineart[word]);
}
export function workbookBlockingIssues(unit: PhonicsWorkbookUnit): WorkbookIssue[] {
  const issues = unit.issues.filter(i => i.type !== 'color' && i.type !== 'lineart');
  if (unit.words.length < 2 || unit.words.length > 3 || unit.words.some(w => !w.trim())) issues.push({ type: 'count' });
  for (const word of unit.words) {
    const target = unit.targets[word];
    if (!target?.red.length || !target.blank.length || [...target.red, ...target.blank].some(i => !Number.isInteger(i) || i < 0 || i >= word.length)) issues.push({ type: 'target', word });
  }
  if (!workbookHasPictures(unit)) for (const word of unit.words) {
    if (!unit.meanings[word]?.trim()) issues.push({ type: 'meaning', word });
  }
  return issues;
}
export function workbookPrintable(unit: PhonicsWorkbookUnit) { return workbookBlockingIssues(unit).length === 0; }
export function workbookUsesText(unit: PhonicsWorkbookUnit) { return !workbookHasPictures(unit) || !workbookHasLineart(unit); }

/** Runtime decode failures follow the same activity policy as absent local assets. */
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
