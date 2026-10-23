import source from './phonics/curriculum.json';
import wordSource from './phonics/words.json';
import type { PhonicsBankEntry } from '../lib/types';

export type PhonicsTier = 'basic' | 'extension' | 'legacy' | 'candidate';
export interface PhonicsWord {
  word: string; meaning: string | null; imageUrl: string | null; lineartUrl: string | null;
  audio: { provider: string; text: string; recordingUrl: string | null }; meaningSource: string | null;
  reviewFlags?: string[];
  lineartSourceImageUrl?: string;
}
export interface PhonicsUnit {
  id: string; ruleId: string; stageId: string; step: number; name: string; order: number;
  entries: PhonicsBankEntry[]; extensions: PhonicsBankEntry[];
}
export const PHONICS_CURRICULUM_VERSION = source.version;
export const PHONICS_STAGES = source.stages;
export const PHONICS_RULES = source.rules;
export const PHONICS_WORDS: Readonly<Record<string, PhonicsWord>> = wordSource;
export const PHONICS_CANDIDATES = source.candidates;

export function positionsOfPattern(pattern: string): number[] {
  const positions: number[] = []; let marked = false; let index = 0;
  for (const ch of pattern) {
    if (ch === '{') marked = true;
    else if (ch === '}') marked = false;
    else { if (marked) positions.push(index); index++; }
  }
  return positions;
}
function entry(pattern: string, rule: typeof source.rules[number], unitIds: string[], tier: 'basic' | 'extension', order: number): PhonicsBankEntry {
  const spelling = pattern.replace(/[{}]/g, '');
  const wordId = Object.keys(PHONICS_WORDS).find(id => PHONICS_WORDS[id].word === spelling);
  if (!wordId) throw new Error(`Unregistered phonics word: ${spelling}`);
  const word = PHONICS_WORDS[wordId];
  return {
    id: `phonics:${tier === 'basic' ? unitIds[0] : rule.id + ':extension'}:${wordId}`,
    wordId, word: word.word, meaning: word.meaning, image_url: word.imageUrl, lineart_url: word.lineartUrl,
    pattern_marked: pattern, step: rule.step, rule: rule.name, sort_order: order,
    curriculum: true, stageId: rule.stageId, ruleId: rule.id, unitId: unitIds[0], unitIds, tier,
    soundId: rule.sound, targets: positionsOfPattern(pattern),
    audio: word.audio, reviewFlags: word.reviewFlags ?? [],
  };
}
const sizePlan: Record<number, number[]> = { 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3] };
export const PHONICS_UNITS: PhonicsUnit[] = source.rules.flatMap(rule => rule.groups.flatMap(group => {
  const sizes = sizePlan[group.patterns.length];
  if (!sizes || sizes.length !== group.unitIds.length) throw new Error(`Review explicit phonics unit IDs: ${rule.id}`);
  let offset = 0;
  const extensions = group.extensions.map((pattern, i) => entry(pattern, rule, group.unitIds, 'extension', i));
  return sizes.map((size, i) => {
    const id = group.unitIds[i];
    const patterns = group.patterns.slice(offset, offset + size); offset += size;
    return { id, ruleId: rule.id, stageId: rule.stageId, step: rule.step, name: group.name,
      order: group.unitOrders[i], entries: patterns.map((pattern, n) => entry(pattern, rule, [id], 'basic', n)), extensions };
  });
}));

export function curriculumEntries(includeExtensions = true): PhonicsBankEntry[] {
  const seen = new Set<string>();
  return PHONICS_UNITS.flatMap(unit => [...unit.entries, ...(includeExtensions ? unit.extensions : [])])
    .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
}
export function unitsForStep(step: number) { return PHONICS_UNITS.filter(u => u.step === step).sort((a,b) => a.order-b.order); }
export function unitById(id: string) { return PHONICS_UNITS.find(u => u.id === id); }
export function selectPhonicsEntries(entries: PhonicsBankEntry[], step: number, includeExtensions = false, unitId = '', rules: string[] = []): PhonicsBankEntry[] {
  const unit = unitId ? unitById(unitId) : null;
  if (unitId && (!unit || unit.step !== step)) return [];
  const ids = unit ? new Set([...unit.entries, ...(includeExtensions ? unit.extensions : [])].map(e => e.id)) : null;
  return entries.filter(e => e.curriculum && e.step === step && (e.tier === 'basic' || includeExtensions && e.tier === 'extension')
    && (!ids || ids.has(e.id)) && (!rules.length || rules.includes(e.rule)));
}
export function wordBySpelling(word: string): PhonicsWord | undefined {
  return Object.values(PHONICS_WORDS).find(w => w.word === word) ?? Object.values(PHONICS_WORDS).find(w => w.word.toLowerCase() === word.toLowerCase());
}

/** Raw database IDs and fields remain intact. They never enter the new default course. */
export function withLegacyPhonics(raw: PhonicsBankEntry[], includeExtensions = true): PhonicsBankEntry[] {
  return [...curriculumEntries(includeExtensions), ...raw.map(e => ({ ...e, tier: 'legacy' as const }))];
}
