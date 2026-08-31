import i18n from '../i18n';

/** 현재 UI 언어에 맞는 날짜 로케일. 영어면 영어식 표기로 바뀐다. */
function locale(): string {
  return i18n.language?.startsWith('en') ? 'en-US' : 'ko-KR';
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(locale(), {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** 오늘 자정(선생님 로컬 시간 기준). 서버는 UTC 로 저장하므로 이 값을 ISO 로 넘겨 비교한다. */
export function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 로컬 기준 YYYY-MM-DD. toISOString() 은 UTC 라 날짜가 밀릴 수 있어 직접 만든다. */
export function dateKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale(), {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

/** 이번 주 월요일 자정 */
export function weekStart(): Date {
  const d = todayStart();
  const dow = (d.getDay() + 6) % 7; // 월=0
  d.setDate(d.getDate() - dow);
  return d;
}

/** 이번 달 1일 자정 */
export function monthStart(): Date {
  const d = todayStart();
  d.setDate(1);
  return d;
}
