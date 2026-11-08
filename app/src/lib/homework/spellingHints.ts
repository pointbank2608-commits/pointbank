export type HintLevel = 0 | 1 | 2;
export interface SpellingHintPolicy {
  defaultLevel: HintLevel;
  overrides: Record<string, HintLevel>;
}
export interface SpellingHint {
  allowed: HintLevel;
  used: HintLevel;
  mask: string;
}

export function hintMask(word: string, level: HintLevel): string {
  if (!level) return '';
  const letters = [...word];
  return letters.map((letter, index) => letter === ' ' || letter === '-' || letter === "'" ||
    index === 0 || (level === 2 && ((letters.length === 3 && index === 1) || (index % 2 === 0 && index < letters.length - 1)))
    ? letter : '_').join(' ');
}

export const HINT_NAMES = [
  ['힌트 없음', 'No hints'],
  ['첫 글자 힌트', 'First-letter hint'],
  ['일부 글자 힌트', 'Partial-letter hint'],
] as const;
