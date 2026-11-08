/** Guided homework stores the selected calendar day as the last millisecond in Korea time. */
export function guidedDeadline(day: string): string {
  return day ? day + 'T23:59:59.999+09:00' : '';
}

export function formatHomeworkDeadline(value: string, locale?: string): string {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return '';
  return due.toLocaleDateString(locale, { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
}
