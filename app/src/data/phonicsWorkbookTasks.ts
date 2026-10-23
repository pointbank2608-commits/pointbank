import type { PhonicsWorkbookUnit } from './phonicsWorkbook';

/** Pure tasks shared by the renderer; no database or image-manifest dependency. */
export function phonicsCircleRows(unit: Pick<PhonicsWorkbookUnit, 'words'>) {
  return unit.words.map((word, i) => {
    const choices = [...unit.words];
    const shift = (i * 2 + 1) % choices.length;
    return { word, choices: [...choices.slice(shift), ...choices.slice(0, shift)] };
  });
}
