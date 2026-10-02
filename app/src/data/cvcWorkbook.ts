// 파닉스 CVC 워크북(2026-10-02): 미리 만들어 둔 워크시트 — 선생님이 단어를 고르지 않고 유닛만 골라 바로 인쇄한다.
// 유닛 하나 = 같은 끝소리(-ad, -ag …) 낱말 2~3개, A4 두 장(Look and Say · Read and Write · Circle the Correct Word /
// Match · Complete the Word · Color). 구성과 낱말 묶음은 사용자가 만든 워크북 그대로다.
export type CvcVowel = 'a' | 'e' | 'i' | 'o' | 'u';

export interface CvcUnit {
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

export const CVC_UNITS: CvcUnit[] = SETS.map(([vowel, family, words], i) => ({ unit: i + 1, vowel, family, words }));
export const CVC_VOWELS: CvcVowel[] = ['a', 'e', 'i', 'o', 'u'];

/** 파닉스 그림이 없어 사전 그림을 쓰는 낱말(그 밖에는 public/phonics-images/<낱말>.webp). */
const FROM_DICTIONARY = new Set(['dad', 'sad', 'man', 'hip', 'kit', 'mix', 'fix', 'lid', 'kid', 'bug', 'hug']);

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
  const rand = rng(unit.unit * 7919);
  const pool = CVC_UNITS.filter((u) => u.vowel === unit.vowel).flatMap((u) => u.words);
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
