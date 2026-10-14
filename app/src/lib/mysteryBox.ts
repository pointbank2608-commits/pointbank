/**
 * 미스터리 박스(2026-10-14, PPT "Super Mario Mystery Box" — 방식만 참고, 이름·그림은 우리 것).
 * 28칸의 상자마다 보상이 하나씩 숨어 있다. 보상 구성은 PPT 슬라이드 28장 그대로:
 * +100×2 +200×2 +300×2 +400 +500 / −100×2 −200×2 −300×2 −400 −500 / 점수 바꾸기×2 / 점수 2배×2 / 훔치기 200·300 / 몽땅 잃기×2 / +1000×2 / 점수 반 토막×2
 */

export type Reward =
  | { kind: 'add'; pts: number }
  | { kind: 'sub'; pts: number }
  | { kind: 'swap' }
  | { kind: 'double' }
  | { kind: 'half' }
  | { kind: 'steal'; pts: number }
  | { kind: 'lose' };

export function rewardDeck(): Reward[] {
  const d: Reward[] = [];
  const add = (pts: number, n = 1) => {
    for (let i = 0; i < n; i++) d.push({ kind: 'add', pts });
  };
  const sub = (pts: number, n = 1) => {
    for (let i = 0; i < n; i++) d.push({ kind: 'sub', pts });
  };
  add(100, 2); add(200, 2); add(300, 2); add(400); add(500); add(1000, 2);
  sub(100, 2); sub(200, 2); sub(300, 2); sub(400); sub(500);
  d.push({ kind: 'swap' }, { kind: 'swap' }, { kind: 'double' }, { kind: 'double' }, { kind: 'half' }, { kind: 'half' });
  d.push({ kind: 'steal', pts: 200 }, { kind: 'steal', pts: 300 }, { kind: 'lose' }, { kind: 'lose' });
  return d;
}

export function isGood(r: Reward): boolean {
  return r.kind === 'add' || r.kind === 'double' || r.kind === 'steal' || r.kind === 'swap';
}

/** 칸 번호 → 라벨(A~Z, 이후 AA, AB …) */
export function blockLabel(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + (i - 26));
}

/** 점수 효과(받는 팀 하나 기준). swap·steal 은 대상 팀을 따로 받는다. */
export function applyReward(scores: number[], to: number, r: Reward, target?: number): number[] {
  const s = [...scores];
  const me = s[to];
  switch (r.kind) {
    case 'add':
      s[to] = me + r.pts;
      break;
    case 'sub':
      s[to] = me - r.pts;
      break;
    case 'double':
      s[to] = me > 0 ? me * 2 : me + 100;
      break;
    case 'half':
      s[to] = me > 0 ? Math.floor(me / 2) : me - 100;
      break;
    case 'lose':
      s[to] = me > 0 ? 0 : me - 200;
      break;
    case 'steal':
      if (target !== undefined && target !== to) {
        s[target] = s[target] - r.pts;
        s[to] = me + r.pts;
      }
      break;
    case 'swap':
      if (target !== undefined && target !== to) {
        s[to] = s[target];
        s[target] = me;
      }
      break;
  }
  return s;
}
