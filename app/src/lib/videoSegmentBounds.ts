/** A segment ends exclusively; seeking to its end must never show the next story. */
export function segmentSeekTime(time: number, start: number, end: number) {
  const last = Math.max(start, end - Math.min(0.05, (end - start) / 2));
  return Math.max(start, Math.min(time, last));
}
