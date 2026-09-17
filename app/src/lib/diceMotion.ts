export const DICE_ROLL_MS = 1280;
export type DiceRotation = { rx: number; ry: number };
export const DICE_FACES: Record<number, DiceRotation> = {
  1: { rx: 0, ry: 0 }, 2: { rx: -90, ry: 0 },
  3: { rx: 0, ry: -90 }, 4: { rx: 0, ry: 90 },
  5: { rx: 90, ry: 0 }, 6: { rx: 0, ry: 180 },
};
const mod = (n: number) => ((n % 360) + 360) % 360;
/** Continue from the last landing, with two full turns and no reversal or snap. */
export function nextDiceRotation(previous: DiceRotation, value: number, direction: 1 | -1): DiceRotation {
  const face = DICE_FACES[value] ?? DICE_FACES[1];
  const angle = (from: number, to: number) => from + direction * (720 + mod(direction * (to - from)));
  return { rx: angle(previous.rx, face.rx), ry: angle(previous.ry, face.ry) };
}
