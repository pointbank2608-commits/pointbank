// 파닉스 CVC 워크북(2026-10-02): 미리 만들어 둔 워크시트 — 선생님이 단어를 고르지 않고 유닛만 골라 바로 인쇄한다.
// 유닛 하나 = 같은 끝소리(-ad, -ag …) 낱말 2~3개, A4 두 장(Look and Say · Read and Write · Circle the Correct Word /
// Match · Complete the Word · Color). 구성과 낱말 묶음은 사용자가 만든 워크북 그대로다.
export type CvcVowel = 'a' | 'e' | 'i' | 'o' | 'u';

/** 워크북 종류 — cvc 단모음(Short vowel) · long 장모음(Long vowel: 매직 e 와 ee·ea) */
export type WorkbookId = 'cvc' | 'long';

export interface CvcUnit {
  book: WorkbookId;
  /** 1부터 — 워크북 머리글의 UNIT 번호 */
  unit: number;
  vowel: CvcVowel;
  /** 끝소리 묶음 이름(-ad 등) */
  family: string;
  words: string[];
}

const SETS: [CvcVowel, string, string[]][] = [
  ['a', '-ad', ['dad', 'bad', 'sad']],
  ['a', '-ag', ['bag', 'tag', 'wag']],
  ['a', '-am', ['jam', 'ram', 'ham']],
  ['a', '-an', ['fan', 'can', 'man']],
  ['a', '-ap', ['map', 'cap', 'tap']],
  ['a', '-at', ['cat', 'fat', 'hat']],
  ['e', '-ed', ['red', 'bed', 'Ted']],
  ['e', '-en', ['hen', 'ten', 'pen']],
  ['e', '-et', ['jet', 'wet', 'pet']],
  ['i', '-ig', ['pig', 'big', 'wig']],
  ['i', '-in', ['bin', 'win', 'pin']],
  ['i', '-ip', ['lip', 'hip', 'rip']],
  ['i', '-it', ['kit', 'sit', 'hit']],
  ['i', '-ix', ['mix', 'fix', 'six']],
  ['i', '-id', ['lid', 'kid']],
  ['o', '-og', ['dog', 'log', 'jog']],
  ['o', '-ot', ['pot', 'hot', 'dot']],
  ['o', '-ox', ['fox', 'box', 'ox']],
  ['u', '-ug', ['bug', 'hug', 'rug']],
  ['u', '-un', ['sun', 'bun', 'run']],
  ['u', '-ut', ['nut', 'hut', 'cut']],
  ['u', '-ub', ['tub', 'cub']],
  ['u', '-ud', ['mud', 'bud']],
  ['u', '-up', ['cup', 'pup']],
];

/** 장모음(2026-10-03): 매직 e(a_e · i_e · o_e · u_e) 22유닛 + ee·ea 4유닛. 낱말 묶음은 끝소리가 같은 것끼리. */
const LONG_SETS: [CvcVowel, string, string[]][] = [
  ['a', '-ake', ['cake', 'lake', 'bake']],
  ['a', '-ame', ['game', 'name', 'same']],
  ['a', '-ate', ['gate', 'date', 'late']],
  ['a', '-ave', ['cave', 'wave', 'save']],
  ['a', '-ane', ['cane', 'mane', 'lane']],
  ['a', '-ape', ['cape', 'tape']],
  ['i', '-ike', ['bike', 'hike', 'like']],
  ['i', '-ine', ['nine', 'line', 'pine']],
  ['i', '-ite', ['kite', 'bite', 'site']],
  ['i', '-ide', ['hide', 'ride', 'side']],
  ['i', '-ime', ['time', 'lime', 'dime']],
  ['i', '-ive', ['five', 'dive', 'hive']],
  ['o', '-one', ['bone', 'cone', 'zone']],
  ['o', '-ose', ['nose', 'rose', 'hose']],
  ['o', '-ole', ['hole', 'pole', 'mole']],
  ['o', '-ope', ['rope', 'hope']],
  ['o', '-ote', ['note', 'vote']],
  ['o', '-ome', ['home', 'dome']],
  ['u', '-une', ['tune', 'June', 'dune']],
  ['u', '-ube', ['cube', 'tube']],
  ['u', '-ute', ['cute', 'mute']],
  ['u', '-ule', ['mule', 'rule']],
  ['e', '-eed', ['seed', 'feed', 'weed']],
  ['e', '-eet', ['feet', 'meet', 'beet']],
  ['e', '-eep', ['jeep', 'deep', 'keep']],
  ['e', '-eat', ['seat', 'meat', 'heat']],
];

const toUnits = (book: WorkbookId, sets: [CvcVowel, string, string[]][]): CvcUnit[] => sets.map(([vowel, family, words], i) => ({ book, unit: i + 1, vowel, family, words }));
export const CVC_UNITS: CvcUnit[] = toUnits('cvc', SETS);
export const LONG_UNITS: CvcUnit[] = toUnits('long', LONG_SETS);
export const CVC_VOWELS: CvcVowel[] = ['a', 'e', 'i', 'o', 'u'];

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
  long: { id: 'long', heading: 'LONG VOWEL', materialId: 'longvowelworkbook', vowels: ['a', 'i', 'o', 'u', 'e'], units: LONG_UNITS },
};
export function workbookOfMaterial(materialId: string): Workbook | null {
  return Object.values(WORKBOOKS).find((b) => b.materialId === materialId) ?? null;
}

/**
 * 낱말에서 소리 규칙 글자의 자리 — red 빨갛게 칠할 글자, blank "Complete the Word"에서 비울 글자.
 * 단모음: 모음 하나 · 매직 e: 모음과 끝의 e 를 칠하고 모음만 비운다(c_ke) · ee/ea: 두 글자를 칠하고 둘 다 비운다.
 */
export function soundMarks(unit: CvcUnit, word: string): { red: number[]; blank: number[] } {
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

/** 파닉스 그림이 없어 사전 그림을 쓰는 낱말(그 밖에는 public/phonics-images/<낱말>.webp). */
const FROM_DICTIONARY = new Set([
  'dad', 'sad', 'man', 'hip', 'kit', 'mix', 'fix', 'lid', 'kid', 'bug', 'hug',
  'date', 'lane', 'hike', 'site', 'dive', 'hope', 'rule', 'feed', 'meet', 'deep', 'keep', 'seat', 'heat',
]);

export function cvcImage(word: string): string {
  const w = word.toLowerCase();
  return `/${FROM_DICTIONARY.has(w) ? 'word-bank-images' : 'phonics-images'}/${w}.webp`;
}

/** 색칠용 선화 */
export function cvcLineart(word: string): string {
  return `/word-bank-lineart/${word.toLowerCase()}.webp`;
}

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
  const pool = WORKBOOKS[unit.book].units.filter((u) => u.vowel === unit.vowel).flatMap((u) => u.words);
  return unit.words.map((word) => {
    const others = shuffled(pool.filter((w) => w !== word), rand).slice(0, 2);
    return { word, choices: shuffled([word, ...others], rand) };
  });
}

/** Match: 오른쪽 그림 순서 — 제자리에 오는 그림이 없게 한 칸씩 민다. */
export function cvcMatchOrder(unit: CvcUnit): string[] {
  const shift = unit.words.length > 2 ? (unit.unit % 2) + 1 : 1;
  return unit.words.map((_, i) => unit.words[(i + shift) % unit.words.length]);
}
