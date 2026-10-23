import { curriculumEntries, unitsForStep, positionsOfPattern, wordBySpelling, PHONICS_RULES } from './phonicsCurriculum';
import legacyRefs from './phonics/legacyWorkbookRefs.json';
// 파닉스 CVC 워크북(2026-10-02): 미리 만들어 둔 워크시트 — 선생님이 단어를 고르지 않고 유닛만 골라 바로 인쇄한다.
// 유닛 하나 = 같은 끝소리(-ad, -ag …) 낱말 2~3개, A4 두 장(Look and Say · Read and Write · Circle the Correct Word /
// Match · Complete the Word · Color). 구성과 낱말 묶음은 사용자가 만든 워크북 그대로다.
export type CvcVowel = 'a' | 'e' | 'i' | 'o' | 'u';

/** Current course: CVC short vowels / magic e. Historical ee/ea pages are resolved separately. */
export type WorkbookId = 'cvc' | 'long';

export interface CvcUnit {
  id: string;
  images?: Record<string, string>;
  lineart?: Record<string, string>;
  targets?: Record<string, { red: number[]; blank: number[] }>;
  book: WorkbookId;
  /** 1부터 — 워크북 머리글의 UNIT 번호 */
  unit: number;
  vowel: CvcVowel;
  /** 끝소리 묶음 이름(-ad 등) */
  family: string;
  words: string[];
}

function curriculumUnit(book: WorkbookId, id: string): CvcUnit {
  const unit = unitsForStep(book === 'cvc' ? 2 : 3).find(u => u.id === id)!;
  const entries = unit.entries;
  const vowel = PHONICS_RULES.find(rule => rule.id === unit.ruleId)?.vowel as CvcVowel;
  if (!vowel) throw new Error(`Missing vowel metadata: ${unit.ruleId}`);
  return { id, book, unit: unit.order, vowel, family: unit.name, words: entries.map(e => e.word),
    targets: Object.fromEntries(entries.map(e => { const red = positionsOfPattern(e.pattern_marked); return [e.word, { red, blank: book === 'long' ? red.slice(0,1) : red }]; })) };
}
export const CVC_UNITS = unitsForStep(2).map(u => curriculumUnit('cvc', u.id));
export const LONG_UNITS = unitsForStep(3).map(u => curriculumUnit('long', u.id));
export const CVC_VOWELS: CvcVowel[] = ['a', 'e', 'i', 'o', 'u'];

/** Frozen historical pages: old saved 23–26 must not open new stage-5 unit numbers. */
export const LONG_LEGACY_UNITS: CvcUnit[] = [
  { id: 'legacy-long-eed', book: 'long', unit: 23, vowel: 'e', family: '-eed', words: ['seed', 'feed', 'weed'] },
  { id: 'legacy-long-eet', book: 'long', unit: 24, vowel: 'e', family: '-eet', words: ['feet', 'meet', 'beet'] },
  { id: 'legacy-long-eep', book: 'long', unit: 25, vowel: 'e', family: '-eep', words: ['jeep', 'deep', 'keep'] },
  { id: 'legacy-long-eat', book: 'long', unit: 26, vowel: 'e', family: '-eat', words: ['seat', 'meat', 'heat'] },
];
export function stableWorkbookRefs(book: WorkbookId, numbers: number[]): string[] {
  const map = legacyRefs[book] as Record<string,string>;
  return numbers.map(n => map[n]).filter((id): id is string => !!id);
}
export function workbookNumbers(book: WorkbookId, ids: string[]): number[] {
  return Object.entries(legacyRefs[book]).filter(([, id]) => ids.includes(id)).map(([number]) => Number(number));
}
export function resolveWorkbookSelection(book: WorkbookId, state: unknown): { units: CvcUnit[]; missing: string[]; requested: boolean } {
  const value = state as { phonicsUnitIds?: unknown; cvcUnits?: unknown } | null;
  const ids = Array.isArray(value?.phonicsUnitIds) ? value.phonicsUnitIds : null;
  const numbers = Array.isArray(value?.cvcUnits) ? value.cvcUnits : null;
  const map = legacyRefs[book] as Record<string,string>;
  const requested = ids ?? numbers?.map(n => typeof n === 'number' ? map[n] ?? `unknown-number:${n}` : 'invalid-reference');
  const available = [...(book === 'cvc' ? CVC_UNITS : LONG_UNITS), ...(book === 'long' ? LONG_LEGACY_UNITS : [])];
  if (!requested) {
    const invalid = value?.phonicsUnitIds !== undefined || value?.cvcUnits !== undefined;
    return { units: [], missing: invalid ? ['invalid-reference'] : [], requested: invalid };
  }
  return { units: requested.map(id => available.find(u => u.id === id)).filter((u): u is CvcUnit => !!u),
    missing: requested.filter(id => !available.some(u => u.id === id)).map(String), requested: true };
}

export interface Workbook {
  id: WorkbookId;
  /** 머리글: "UNIT 3. SHORT VOWEL A" */
  heading: string;
  /** 자료실 목록(materialsCatalog)의 id */
  materialId: string;
  /** 유닛 고르기에서 모음을 묶는 순서 */
  vowels: CvcVowel[];
  units: CvcUnit[];
}
export const WORKBOOKS: Record<WorkbookId, Workbook> = {
  cvc: { id: 'cvc', heading: 'SHORT VOWEL', materialId: 'cvcworkbook', vowels: CVC_VOWELS, units: CVC_UNITS },
  long: { id: 'long', heading: 'LONG VOWEL', materialId: 'longvowelworkbook', vowels: ['a', 'i', 'o', 'u'], units: LONG_UNITS },
};
export function workbookOfMaterial(materialId: string): Workbook | null {
  return Object.values(WORKBOOKS).find((b) => b.materialId === materialId) ?? null;
}

/**
 * 낱말에서 소리 규칙 글자의 자리 — red 빨갛게 칠할 글자, blank "Complete the Word"에서 비울 글자.
 * 단모음: 모음 하나 · 매직 e: 모음과 끝의 e 를 칠하고 모음만 비운다(c_ke) · ee/ea: 두 글자를 칠하고 둘 다 비운다.
 */
export function soundMarks(unit: CvcUnit, word: string): { red: number[]; blank: number[] } {
  if (unit.targets?.[word]) return unit.targets[word];
  const w = word.toLowerCase();
  if (unit.book === 'cvc') {
    const i = w.indexOf(unit.vowel);
    return { red: [i], blank: [i] };
  }
  const team = ['ee', 'ea'].find((t) => unit.family.includes(t));
  if (team) {
    const i = w.indexOf(team);
    return { red: [i, i + 1], blank: [i, i + 1] };
  }
  const v = w.length - 3;
  return { red: [v, w.length - 1], blank: [v] };
}

/** The same verified asset reference is used by cards and both kinds of worksheets. */
export function cvcImage(word: string): string { return wordBySpelling(word)?.imageUrl ?? ''; }
export function cvcLineart(word: string): string { return wordBySpelling(word)?.lineartUrl ?? ''; }

/** 고정 난수(유닛마다 늘 같은 보기·순서가 나오게 — 미리보기와 인쇄가 같다). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Circle the Correct Word: 낱말마다 [정답 + 같은 모음의 다른 낱말 둘]을 섞은 보기 세 개. */
export function cvcCircleRows(unit: CvcUnit): { word: string; choices: string[] }[] {
  const rand = rng(unit.unit * 7919 + (unit.book === 'cvc' ? 0 : 101));
  const pool = unit.book === 'long' && unit.unit > 22
    ? curriculumEntries(false).filter(e => e.step === 5 && e.ruleId === (unit.family.includes('ea') ? 'vowel-ea' : 'vowel-ee')).map(e => e.word)
    : WORKBOOKS[unit.book].units.filter((u) => u.vowel === unit.vowel).flatMap((u) => u.words);
  return unit.words.map((word) => {
    const others = shuffled(pool.filter((w) => w !== word), rand).slice(0, 2);
    return { word, choices: shuffled([word, ...others], rand) };
  });
}

/** Match: 오른쪽 그림 순서 — 제자리에 오는 그림이 없게 한 칸씩 민다. */
export function cvcMatchOrder(unit: Pick<CvcUnit, 'unit' | 'words'>): string[] {
  const shift = unit.words.length > 2 ? (unit.unit % 2) + 1 : 1;
  return unit.words.map((_, i) => unit.words[(i + shift) % unit.words.length]);
}
