import type { GameItem } from "./types";

export const SPLASH_TIMES = [30, 45, 60, 90] as const;
export const SPLASH_SAMPLES = [
  "These monkeys love to eat fruits.",
  "Would you like to feed them?",
  "He'd never fed a monkey before.",
  "They also love to play.",
  "We have to go home soon.",
  "Come down from that tree.",
  "Look what I found.",
];
export const splashSeconds = (value?: number) =>
  SPLASH_TIMES.includes(value as 30) ? value! : 45;
export const sentenceWords = (sentence: string) =>
  sentence.trim().split(/\s+/u).filter(Boolean);
export const splashSampleItems = (): GameItem[] =>
  SPLASH_SAMPLES.map((label, i) => ({ id: `splash-sample-${i}`, label }));
export interface SplashBrick {
  id: string;
  word: string;
  position: number;
}
export function makeSplashBricks(
  item: GameItem,
  random = Math.random,
): SplashBrick[] {
  const bricks = sentenceWords(item.label).map((word, position) => ({
    id: `${item.id}:${position}`,
    word,
    position,
  }));
  for (let i = bricks.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bricks[i], bricks[j]] = [bricks[j], bricks[i]];
  }
  return bricks;
}
/** Identical words are interchangeable; each physical brick can only be used once. */
export function canClaimBrick(
  words: string[],
  picked: string[],
  brick: SplashBrick,
  bricks: SplashBrick[],
) {
  return (
    !picked.includes(brick.id) &&
    brick.word === words[picked.length] &&
    bricks.some((b) => b.id === brick.id)
  );
}
export const splashProgress = (
  startedAt: number,
  now: number,
  seconds: number,
) => Math.min(1, Math.max(0, (now - startedAt) / (seconds * 1000)));

/** Pack measured words into rows. All rows fall the same distance, so they never overlap.
 * Long sentences grow vertically instead of shrinking touch targets or clipping words. */
export function layoutSplashBricks(
  bricks: SplashBrick[],
  width: number,
  measure: (s: string) => number,
) {
  const usable = Math.max(48, width - 20);
  let x = 10,
    y = 20,
    rowHeight = 52;
  const positions = bricks.map((brick) => {
    const measured = measure(brick.word);
    const w = Math.min(usable, Math.max(64, measured + 32));
    const h = Math.max(52, Math.ceil(measured / Math.max(1, w - 32)) * 25 + 24);
    if (x > 10 && x + w > width - 10) {
      x = 10;
      y += rowHeight + 16;
      rowHeight = 52;
    }
    const position = { ...brick, x, y, width: w, height: h };
    x += w + 12;
    rowHeight = Math.max(rowHeight, h);
    return position;
  });
  const bottom = Math.max(72, ...positions.map((p) => p.y + p.height));
  const height = Math.max(360, bottom + 230);
  return { positions, height, fall: height - 90 - bottom };
}
