/**
 * 글상자 안의 일부 글자만 색을 바꾸기(2026-10-14).
 * 글상자 글(`text`)은 그대로 한 줄 글이고, 색이 다른 구간만 `runs`(글자 위치 범위)로 따로 둔다 —
 * 글을 고치면 구간도 같이 밀리거나 줄어든다. 구간이 없으면(기본) 예전 글상자와 똑같다.
 */
export interface TextRun {
  /** 글자 위치(포함) */
  start: number;
  /** 글자 위치(미포함) */
  end: number;
  color: string;
}

const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** 범위를 글 길이 안으로 자르고, 겹침·빈 구간·기본색과 같은 구간을 정리한다 */
export function normalizeRuns(runs: TextRun[] | undefined, len: number, base?: string): TextRun[] {
  const clean = (runs ?? [])
    .map((r) => ({ start: Math.max(0, Math.min(len, Math.floor(r.start))), end: Math.max(0, Math.min(len, Math.floor(r.end))), color: r.color }))
    .filter((r) => r.end > r.start && (!base || !sameColor(r.color, base)))
    .sort((a, b) => a.start - b.start);
  const out: TextRun[] = [];
  for (const r of clean) {
    const last = out[out.length - 1];
    const start = last ? Math.max(r.start, last.end) : r.start;
    if (r.end <= start) continue;
    if (last && last.end === start && sameColor(last.color, r.color)) last.end = r.end;
    else out.push({ start, end: r.end, color: r.color });
  }
  return out;
}

/** [start, end) 구간을 color 로 칠한다(기본색을 고르면 그 구간의 색이 지워져 기본색으로 돌아간다) */
export function paintRuns(runs: TextRun[] | undefined, start: number, end: number, color: string, len: number, base: string): TextRun[] {
  const a = Math.min(start, end);
  const b = Math.max(start, end);
  const kept: TextRun[] = [];
  for (const r of runs ?? []) {
    if (r.end <= a || r.start >= b) kept.push(r);
    else {
      if (r.start < a) kept.push({ ...r, end: a });
      if (r.end > b) kept.push({ ...r, start: b });
    }
  }
  kept.push({ start: a, end: b, color });
  return normalizeRuns(kept, len, base);
}

/** 글이 바뀌었을 때 구간을 따라 옮긴다 — 바뀐 자리(공통 앞·뒤를 뺀 가운데)만 바꾸고, 구간 안에 글을 더하면 같은 색으로 이어진다 */
export function shiftRuns(runs: TextRun[] | undefined, oldText: string, newText: string): TextRun[] {
  if (!runs || runs.length === 0 || oldText === newText) return runs ?? [];
  const max = Math.min(oldText.length, newText.length);
  let p = 0;
  while (p < max && oldText[p] === newText[p]) p++;
  let s = 0;
  while (s < max - p && oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++;
  const oldEnd = oldText.length - s;
  const delta = newText.length - oldText.length;
  const out: TextRun[] = [];
  for (const r of runs) {
    if (r.end <= p) out.push(r);
    else if (r.start >= oldEnd) out.push({ ...r, start: r.start + delta, end: r.end + delta });
    else if (p === oldEnd && r.start < p && r.end > p) out.push({ ...r, end: r.end + delta }); // 구간 안에 글을 더함
    else {
      if (r.start < p) out.push({ ...r, end: p });
      if (r.end > oldEnd) out.push({ ...r, start: oldEnd + delta, end: r.end + delta });
    }
  }
  return normalizeRuns(out, newText.length);
}

/** 글을 색 조각으로 나눈다(color 가 null 이면 기본색) */
export function colorSegments(text: string, runs: TextRun[] | undefined): { text: string; color: string | null }[] {
  const rs = normalizeRuns(runs, text.length);
  if (rs.length === 0) return [{ text, color: null }];
  const out: { text: string; color: string | null }[] = [];
  let pos = 0;
  for (const r of rs) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start), color: null });
    out.push({ text: text.slice(r.start, r.end), color: r.color });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), color: null });
  return out;
}
