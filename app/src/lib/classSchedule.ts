import type { ClassRow } from './types';

export type ClassSchedule = NonNullable<ClassRow['schedule']>;

/** 오늘 요일(0=일~6=토)에 수업이 있는 반을 시간순으로. */
export function classesToday(classes: ClassRow[], now = new Date()): ClassRow[] {
  const dow = now.getDay();
  return classes
    .filter((c) => c.schedule?.days?.includes(dow))
    .sort((a, b) => (a.schedule?.time ?? '99:99').localeCompare(b.schedule?.time ?? '99:99'));
}

/** "15:30" → "3:30" 같은 짧은 표시 */
export function shortTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return time;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m ?? 0).padStart(2, '0')}`;
}
