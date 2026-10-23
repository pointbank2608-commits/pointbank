import type { PhonicsWorkbookUnit } from './phonicsWorkbook';

/** Pure tasks shared by the renderer; no database or image-manifest dependency. */
export function phonicsCircleRows(unit: Pick<PhonicsWorkbookUnit, 'words'>) {
  return unit.words.map((word, i) => {
    const choices = [...unit.words];
    const shift = (i * 2 + 1) % choices.length;
    return { word, choices: [...choices.slice(shift), ...choices.slice(0, shift)] };
  });
}

/** A reversible rotation preserves repeated letters and never prints the answer order. */
export function workbookLetterOrder(word: string): string[] {
  const letters = [...word];
  for (let n = 1; n < letters.length; n++) {
    const rotated = [...letters.slice(n), ...letters.slice(0, n)];
    if (rotated.join('') !== word) return rotated;
  }
  return letters;
}
