/**
 * CSS `cubic-bezier(x1,y1,x2,y2)` 이징을 JS에서 그대로 계산한다(뉴턴-랩슨법,
 * 브라우저 내부 구현과 같은 방식). 돌림판 회전에 쓰는 CSS transition과 똑같은
 * 곡선을 오디오 스케줄링에도 써서, 소리가 실제 화면 회전 속도와 어긋나지 않게 한다.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const A = (a1: number, a2: number) => 1.0 - 3.0 * a2 + 3.0 * a1;
  const B = (a1: number, a2: number) => 3.0 * a2 - 6.0 * a1;
  const C = (a1: number) => 3.0 * a1;

  const calcBezier = (t: number, a1: number, a2: number) => ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  const calcSlope = (t: number, a1: number, a2: number) => 3.0 * A(a1, a2) * t * t + 2.0 * B(a1, a2) * t + C(a1);

  function getTForX(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const slope = calcSlope(t, x1, x2);
      if (slope === 0) return t;
      const currentX = calcBezier(t, x1, x2) - x;
      t -= currentX / slope;
    }
    return t;
  }

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    if (x1 === y1 && x2 === y2) return x;
    return calcBezier(getTForX(x), y1, y2);
  };
}
