/**
 * 룰렛 조각 색 팔레트.
 * 브랜드 컬러(남색/골드/세이지/브릭)를 기본으로 하고,
 * 조각이 여러 개일 때도 화면이 밋밋해지지 않도록 어울리는 톤을 더 섞었다.
 */
export const WHEEL_COLORS = [
  '#233a63', // navy
  '#c69a3c', // gold
  '#3f7a5c', // sage
  '#ad3d30', // brick
  '#6b5b95', // plum
  '#2f8f9d', // teal
  '#d98a3d', // amber
  '#7a9e3f', // olive
  '#8a4f7d', // orchid
  '#4a6fa5', // sky
];

export function colorFor(index: number): string {
  return WHEEL_COLORS[index % WHEEL_COLORS.length];
}

/** 조각이 좁을 때(항목이 많을 때) 라벨이 겹치지 않도록 줄인다. */
export function shortenLabel(label: string, sliceDeg: number): string {
  const max = sliceDeg < 20 ? 6 : sliceDeg < 35 ? 10 : 16;
  return label.length > max ? label.slice(0, max - 1) + '…' : label;
}

/** 항목 수에 따라 라벨 글자 크기를 정한다. 항목이 적을수록 크게. */
export function fontSizeFor(count: number): number {
  return Math.max(11, Math.min(20, 280 / Math.max(count, 1)));
}

/**
 * 화면 12시 방향을 0도로 두고 시계 방향으로 재는 각도계 기준,
 * targetIndex 조각이 포인터(12시) 밑에 오도록 필요한 "새 누적 회전각"을 계산한다.
 *
 * currentRotation 은 이전까지 누적된 회전각(계속 더해나가는 값)이라,
 * 여러 번 돌려도 매번 자연스럽게 이어서 돈다 (0으로 스냅되지 않음).
 */
export function computeSpinRotation(params: {
  targetIndex: number;
  itemCount: number;
  currentRotation: number;
  extraTurns?: number;
}): number {
  const { targetIndex, itemCount, currentRotation, extraTurns = 5 } = params;
  const slice = 360 / itemCount;

  // 조각 한가운데가 아니라 그 안에서 살짝 무작위 위치에 멈추게 해서 매번 똑같아 보이지 않게 한다.
  const jitter = (Math.random() - 0.5) * slice * 0.6;
  const theta = ((targetIndex * slice + slice / 2 + jitter) % 360 + 360) % 360;

  const desiredMod = ((360 - theta) % 360 + 360) % 360;
  const currentMod = ((currentRotation % 360) + 360) % 360;

  let delta = desiredMod - currentMod;
  if (delta <= 0) delta += 360;

  return currentRotation + extraTurns * 360 + delta;
}

/** 균등 확률로 인덱스 하나를 뽑는다. */
export function pickRandomIndex(count: number): number {
  return Math.floor(Math.random() * count);
}
