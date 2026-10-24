import type { GameItem, GameTemplate, GameTemplateConfig } from "./types";

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
export const isSplashSampleItems = (items: GameItem[]) =>
  items.length === SPLASH_SAMPLES.length &&
  items.every((item, i) => item.label === SPLASH_SAMPLES[i]);

/** Preview, saved copies and lesson imports must carry the same current sentences. */
export function editedSplashConfig(
  template: Pick<GameTemplate, 'id' | 'name' | 'config'>,
  items: GameItem[],
  seconds: number,
): GameTemplateConfig {
  const source = template.config.classroomSource;
  return {
    ...template.config,
    splashSeconds: splashSeconds(seconds),
    classroomSource: {
      id: source?.id || `splash:${template.id}`,
      version: source?.version || '',
      name: source?.name || template.name,
      kind: 'sentence',
      cards: items.map(i => ({ id: i.id, word: i.label, meaning: '', imageUrl: null })),
    },
  };
}
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
  minHeight = 0,
) {
  const usable = Math.max(48, width - 20);
  // 1) 줄 나누기: 왼쪽부터 채워 가며 넘치면 다음 줄로
  let x = 10,
    y = 20,
    rowHeight = 52;
  const rows: Array<Array<SplashBrick & { x: number; y: number; width: number; height: number }>> = [[]];
  for (const brick of bricks) {
    const measured = measure(brick.word);
    const w = Math.min(usable, Math.max(64, measured + 32));
    const h = Math.max(52, Math.ceil(measured / Math.max(1, w - 32)) * 25 + 24);
    if (x > 10 && x + w > width - 10) {
      x = 10;
      y += rowHeight + 16;
      rowHeight = 52;
      rows.push([]);
    }
    rows[rows.length - 1].push({ ...brick, x, y, width: w, height: h });
    x += w + 12;
    rowHeight = Math.max(rowHeight, h);
  }
  // 2) 줄마다 화면 가로 전체에 고르게 펼친다(넓은 화면에서 벽돌이 왼쪽에만 몰리지 않게).
  //    줄 높이(y)는 그대로라 모든 줄이 같은 거리만큼 떨어지는 성질과 겹치지 않는 보장은 변하지 않는다.
  for (const row of rows) {
    const n = row.length;
    if (n === 0) continue;
    const total = row.reduce((sum, b) => sum + b.width, 0);
    const free = Math.max(0, width - 20 - total);
    if (n === 1) {
      row[0].x = 10 + free / 2;
      continue;
    }
    const roomy = free / (n + 1);
    const gap = roomy >= 12 ? roomy : free / (n - 1);
    let cursor = roomy >= 12 ? 10 + gap : 10;
    for (const b of row) {
      b.x = Math.round(cursor);
      cursor += b.width + gap;
    }
  }
  const positions = rows.flat();
  const bottom = Math.max(72, ...positions.map((p) => p.y + p.height));
  const height = Math.max(360, bottom + 230, minHeight);
  return { positions, height, fall: height - 90 - bottom };
}
