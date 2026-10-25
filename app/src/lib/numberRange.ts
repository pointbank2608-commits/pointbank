export const NUMBER_RANGE_MAX = 100;

export type NumberRangeError = 'invalid' | 'order' | 'step' | 'tooMany';

/** 시작~끝 숫자를 간격대로 나열한다(끝 숫자 포함). 큰 수에서 작은 수로 가는 범위는 막는다. */
export function buildNumberRange(startRaw: string, endRaw: string, stepRaw: string): { numbers: number[] } | { error: NumberRangeError } {
  const start = Number(startRaw);
  const end = Number(endRaw);
  const step = stepRaw.trim() === '' ? 1 : Number(stepRaw);
  if (startRaw.trim() === '' || endRaw.trim() === '' || !Number.isInteger(start) || !Number.isInteger(end)) return { error: 'invalid' };
  if (!Number.isInteger(step) || step < 1) return { error: 'step' };
  if (start > end) return { error: 'order' };
  if (Math.floor((end - start) / step) + 1 > NUMBER_RANGE_MAX) return { error: 'tooMany' };
  const numbers: number[] = [];
  for (let n = start; n <= end; n += step) numbers.push(n);
  return { numbers };
}
