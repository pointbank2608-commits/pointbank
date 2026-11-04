// 이 반에서 오늘 빠지는(결석) 학생. 도구줄 "반 설정"과 "팀·순서 정하기" 창이 같은 목록을 쓴다 — 반마다 이 브라우저에 기억한다.
export const ABSENT_EVENT = 'classbank:absent';
const key = (classId: string) => `classbank.absent.${classId}`;

export function loadAbsent(classId: string): string[] {
  if (!classId) return [];
  try {
    const raw = localStorage.getItem(key(classId));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveAbsent(classId: string, ids: string[]): void {
  if (!classId) return;
  try {
    localStorage.setItem(key(classId), JSON.stringify([...new Set(ids)]));
  } catch {
    // 저장이 막힌 브라우저에서는 이번 화면에서만 적용된다
  }
  window.dispatchEvent(new Event(ABSENT_EVENT));
}
