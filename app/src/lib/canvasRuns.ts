import type { CSSProperties } from 'react';

/**
 * 글상자 안의 일부 글자만 서식(색·굵게·기울임·밑줄)을 바꾸기(2026-10-14).
 * 글상자 글(`text`)은 그대로 한 줄 글이고, 서식이 다른 구간만 `runs`(글자 위치 범위)로 따로 둔다 —
 * 글을 고치면 구간도 같이 밀리거나 줄어든다. 구간이 없으면(기본) 예전 글상자와 똑같다.
 * 구간의 칸은 모두 선택이다: 없으면 글상자 전체 서식을 따른다(bold: false 는 "이 부분만 굵게 끄기").
 */
export interface TextRun {
  /** 글자 위치(포함) */
  start: number;
  /** 글자 위치(미포함) */
  end: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** 글상자 글자 크기에 곱하는 배수(1 = 같은 크기, 2026-10-14) */
  size?: number;
}

export const RUN_SIZE_MIN = 0.4;
export const RUN_SIZE_MAX = 4;

export type RunField = 'color' | 'bold' | 'italic' | 'underline' | 'size';
export type RunPatch = Partial<Pick<TextRun, RunField>>;
/** 글상자 전체 서식(구간이 이 값과 같으면 구간이 필요 없다) */
export interface RunBase {
  color: string;
  bold: boolean;
  italic: boolean;
  underline?: boolean;
}

const FIELDS: RunField[] = ['color', 'bold', 'italic', 'underline', 'size'];
const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** 구간에서 글상자 전체 서식과 같은 칸을 지운다 */
function stripToBase(r: TextRun, base?: RunBase): TextRun {
  const out: TextRun = { start: r.start, end: r.end };
  if (r.color !== undefined && !(base && sameColor(r.color, base.color))) out.color = r.color;
  if (r.bold !== undefined && !(base && r.bold === base.bold)) out.bold = r.bold;
  if (r.italic !== undefined && !(base && r.italic === base.italic)) out.italic = r.italic;
  if (r.underline !== undefined && !(base && r.underline === !!base.underline)) out.underline = r.underline;
  if (r.size !== undefined && Math.abs(r.size - 1) > 0.001) out.size = Math.max(RUN_SIZE_MIN, Math.min(RUN_SIZE_MAX, +r.size.toFixed(3)));
  return out;
}

const hasFormat = (r: TextRun) => FIELDS.some((f) => r[f] !== undefined);
const sameFormat = (a: TextRun, b: TextRun) =>
  FIELDS.every((f) => (f === 'color' ? (a.color ?? '').toLowerCase() === (b.color ?? '').toLowerCase() : a[f] === b[f]));

/** 범위를 글 길이 안으로 자르고, 겹침·빈 구간·글상자 전체 서식과 같은 칸을 정리한다 */
export function normalizeRuns(runs: TextRun[] | undefined, len: number, base?: RunBase): TextRun[] {
  const clean = (runs ?? [])
    .map((r) => stripToBase({ ...r, start: Math.max(0, Math.min(len, Math.floor(r.start))), end: Math.max(0, Math.min(len, Math.floor(r.end))) }, base))
    .filter((r) => r.end > r.start && hasFormat(r))
    .sort((a, b) => a.start - b.start);
  const out: TextRun[] = [];
  for (const r of clean) {
    const last = out[out.length - 1];
    const start = last ? Math.max(r.start, last.end) : r.start;
    if (r.end <= start) continue;
    const cur = { ...r, start };
    if (last && last.end === start && sameFormat(last, cur)) last.end = cur.end;
    else out.push(cur);
  }
  return out;
}

/** [start, end) 구간에 patch(칸 몇 개)를 덮어쓴다 — 이미 있던 다른 칸은 그대로 두고, 바깥 구간은 건드리지 않는다 */
export function paintRuns(runs: TextRun[] | undefined, start: number, end: number, patch: RunPatch, len: number, base: RunBase): TextRun[] {
  const a = Math.min(start, end);
  const b = Math.max(start, end);
  const existing = normalizeRuns(runs, len);
  const points = new Set<number>([0, len, a, b]);
  for (const r of existing) {
    points.add(r.start);
    points.add(r.end);
  }
  const xs = [...points].filter((p) => p >= 0 && p <= len).sort((p, q) => p - q);
  const out: TextRun[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const s = xs[i];
    const e = xs[i + 1];
    if (e <= s) continue;
    const cover = existing.find((r) => r.start <= s && r.end >= e);
    const fmt: TextRun = { start: s, end: e, ...(cover ? Object.fromEntries(FIELDS.filter((f) => cover[f] !== undefined).map((f) => [f, cover[f]])) : {}) };
    if (s >= a && e <= b) Object.assign(fmt, patch);
    out.push(fmt);
  }
  return normalizeRuns(out, len, base);
}

/** 글자 하나의 실제 서식(구간이 없는 칸은 글상자 전체 서식) */
export function effectiveAt(runs: TextRun[] | undefined, base: RunBase, index: number): Required<RunBase> & { size: number } {
  const r = (runs ?? []).find((x) => x.start <= index && index < x.end);
  return {
    color: r?.color ?? base.color,
    bold: r?.bold ?? base.bold,
    italic: r?.italic ?? base.italic,
    underline: r?.underline ?? !!base.underline,
    size: r?.size ?? 1,
  };
}

/** [start, end) 구간의 글자 크기를 factor 배로 키우거나 줄인다 — 구간마다 이미 다른 크기면 서로의 비율은 그대로 둔다 */
export function scaleRunSize(runs: TextRun[] | undefined, start: number, end: number, factor: number, len: number, base: RunBase): TextRun[] {
  const a = Math.min(start, end);
  const b = Math.max(start, end);
  const existing = normalizeRuns(runs, len);
  const points = new Set<number>([0, len, a, b]);
  for (const r of existing) {
    points.add(r.start);
    points.add(r.end);
  }
  const xs = [...points].filter((p) => p >= 0 && p <= len).sort((p, q) => p - q);
  const out: TextRun[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const s = xs[i];
    const e = xs[i + 1];
    if (e <= s) continue;
    const cover = existing.find((r) => r.start <= s && r.end >= e);
    const fmt: TextRun = { start: s, end: e, ...(cover ? Object.fromEntries(FIELDS.filter((f) => cover[f] !== undefined).map((f) => [f, cover[f]])) : {}) };
    if (s >= a && e <= b) fmt.size = Math.max(RUN_SIZE_MIN, Math.min(RUN_SIZE_MAX, (fmt.size ?? 1) * factor));
    out.push(fmt);
  }
  return normalizeRuns(out, len, base);
}

/** 고른 범위의 모든 글자가 그 서식(굵게 등)이면 true — 토글할 때 "모두 켜져 있으면 끄고, 아니면 켠다" */
export function rangeAll(runs: TextRun[] | undefined, base: RunBase, start: number, end: number, field: 'bold' | 'italic' | 'underline'): boolean {
  for (let i = Math.min(start, end); i < Math.max(start, end); i++) if (!effectiveAt(runs, base, i)[field]) return false;
  return true;
}

/** 글상자 전체 서식을 바꿀 때 — 그 칸의 구간 서식을 지워 전체가 한결같이 바뀌게 한다 */
export function stripField(runs: TextRun[] | undefined, field: RunField): TextRun[] | undefined {
  if (!runs || runs.length === 0) return undefined;
  const next = runs.map((r) => {
    const { [field]: _gone, ...rest } = r;
    return rest as TextRun;
  });
  const kept = next.filter(hasFormat);
  return kept.length > 0 ? kept : undefined;
}

/** 글이 바뀌었을 때 구간을 따라 옮긴다 — 바뀐 자리(공통 앞·뒤를 뺀 가운데)만 바꾸고, 구간 안에 글을 더하면 같은 서식으로 이어진다 */
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

/** 글을 서식 조각으로 나눈다(run 이 null 이면 글상자 전체 서식) */
export function runSegments(text: string, runs: TextRun[] | undefined): { text: string; run: TextRun | null }[] {
  const rs = normalizeRuns(runs, text.length);
  if (rs.length === 0) return [{ text, run: null }];
  const out: { text: string; run: TextRun | null }[] = [];
  let pos = 0;
  for (const r of rs) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start), run: null });
    out.push({ text: text.slice(r.start, r.end), run: r });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), run: null });
  return out;
}

/** 구간 한 조각의 CSS(없는 칸은 글상자 전체 서식을 그대로 물려받는다) */
export function runStyle(run: TextRun, opts: { ignoreSize?: boolean } = {}): CSSProperties {
  const style: CSSProperties = {};
  if (run.color !== undefined) style.color = run.color;
  if (run.bold !== undefined) style.fontWeight = run.bold ? 700 : 400;
  if (run.italic !== undefined) style.fontStyle = run.italic ? 'italic' : 'normal';
  if (run.underline !== undefined) style.textDecoration = run.underline ? 'underline' : 'none';
  if (run.size !== undefined && !opts.ignoreSize) style.fontSize = `${run.size}em`;
  return style;
}
