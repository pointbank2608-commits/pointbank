/** Guided homework stores the selected calendar day as the last millisecond in Korea time. */
export function guidedDeadline(day: string): string {
  return day ? day + 'T23:59:59.999+09:00' : '';
}

export function formatHomeworkDeadline(value: string): string {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return '';
  const dateOnly = due.toISOString().endsWith('T14:59:59.999Z');
  return dateOnly
    ? due.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' })
    : due.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}