/**
 * 사다리타기(아미다쿠지) 로직.
 * 각 행(row)에서 인접한 두 세로줄 사이에 가로줄(rung)을 놓되,
 * 같은 행에서 가로줄끼리 겹치지 않게(gap, gap+1 동시 사용 금지) 배치하면
 * 위에서 아래로 내려가는 경로가 항상 1:1 대응(순열)이 되는 성질을 이용한다.
 */

export interface LadderGrid {
  /** columns[row][gap] === true 면 gap 번째와 gap+1 번째 세로줄 사이에 가로줄이 있다. */
  rungs: boolean[][];
  rows: number;
  cols: number;
}

export function generateLadder(cols: number, rows?: number): LadderGrid {
  const rowCount = rows ?? Math.max(8, cols * 3);
  const rungs: boolean[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const row = new Array(Math.max(cols - 1, 0)).fill(false);
    let gap = 0;
    while (gap < cols - 1) {
      if (Math.random() < 0.38) {
        row[gap] = true;
        gap += 2; // 같은 행에서 바로 옆 gap 은 건너뛰어 겹침 방지
      } else {
        gap += 1;
      }
    }
    rungs.push(row);
  }
  return { rungs, rows: rowCount, cols };
}

/** 가로줄이 하나도 없는 빈 사다리 틀. 게임 시작 전 세로줄 + 이름 칸만 미리 보여줄 때 쓴다. */
export function emptyLadder(cols: number, rows: number): LadderGrid {
  return {
    rungs: Array.from({ length: rows }, () => new Array(Math.max(cols - 1, 0)).fill(false)),
    rows,
    cols,
  };
}

/** startCol 에서 출발해 사다리를 타고 내려갔을 때 도착하는 열 번호. */
export function traceColumn(grid: LadderGrid, startCol: number): number {
  let col = startCol;
  for (let r = 0; r < grid.rows; r++) {
    const row = grid.rungs[r];
    if (col > 0 && row[col - 1]) col -= 1;
    else if (col < grid.cols - 1 && row[col]) col += 1;
  }
  return col;
}

/** 각 시작 열이 도착하는 열을 한번에 계산 (permutation). */
export function traceAll(grid: LadderGrid): number[] {
  return Array.from({ length: grid.cols }, (_, i) => traceColumn(grid, i));
}

/**
 * startCol 경로를 (row, col) 좌표 목록으로 반환한다 (0=맨 위, grid.rows=맨 아래).
 * 렌더링 쪽에서 이 점들을 x,y 픽셀로 변환해 선을 그린다.
 *
 * 가로줄(rung) 그림은 항상 그 행의 "중간"(row + 0.5)에 그려지므로, 경로도 그 지점에서
 * 꺾여야 실제 가로줄과 겹쳐 보인다 — row 경계(정수)에서 꺾으면 그림이 어긋난다.
 */
export function tracePath(grid: LadderGrid, startCol: number): { row: number; col: number }[] {
  const path: { row: number; col: number }[] = [{ row: 0, col: startCol }];
  let col = startCol;
  for (let r = 0; r < grid.rows; r++) {
    const row = grid.rungs[r];
    let next = col;
    if (col > 0 && row[col - 1]) next = col - 1;
    else if (col < grid.cols - 1 && row[col]) next = col + 1;
    if (next !== col) {
      path.push({ row: r + 0.5, col }); // 가로줄 위치까지 세로로 내려온다
      path.push({ row: r + 0.5, col: next }); // 가로줄을 타고 옆 칸으로 건너간다
    }
    path.push({ row: r + 1, col: next }); // 다음 행 경계까지 계속 내려간다
    col = next;
  }
  return path;
}
