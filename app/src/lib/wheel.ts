/**
 * 룰렛 조각 색 팔레트.
 * 초등학생도 보는 화면이라 채도 높은 사탕색(캔디 팔레트)으로 구성했다.
 * 인접 조각끼리 색이 붙지 않도록 색상환을 고르게 돌아가며 배치.
 */
export const WHEEL_COLORS = [
  '#FF6B8B', // 딸기 핑크
  '#4FC3F7', // 하늘
  '#FFC93C', // 해바라기 옐로우
  '#5FD68F', // 민트그린
  '#B18CFF', // 라벤더
  '#FF9F5A', // 귤색 오렌지
  '#5AD1C6', // 청록
  '#FF7A9E', // 로즈
  '#8FD650', // 라임
  '#7EA8FF', // 코발트 블루
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
