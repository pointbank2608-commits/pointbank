import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { studentStamps, type PortalStamp } from '../../lib/studentPortal';
import { HomeworkStamp } from './HomeworkStamp';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 학생 홈의 "내 도장 달력" — 숙제를 끝낸 날마다 도장이 찍혀 있다(선생님 숙제 캘린더와 같은 도장).
 * 도장 수는 이번 달 숫자로 크게 보여 주고, 지난달도 넘겨 볼 수 있다. 서버 함수 student_stamps(068)가 없으면 조용히 숨는다.
 */
export default function StudentStampCalendar({ token }: { token: string }) {
  const { t } = useTranslation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [stamps, setStamps] = useState<PortalStamp[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const daysInMonth = new Date(year, month, 0).getDate();
  const from = `${year}-${pad(month)}-01`;
  const to = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  useEffect(() => {
    let cancelled = false;
    setStamps(null);
    studentStamps(token, from, to)
      .then((r) => !cancelled && setStamps(r))
      .catch(() => !cancelled && setUnavailable(true));
    return () => {
      cancelled = true;
    };
  }, [token, from, to]);

  const byDay = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of stamps ?? []) m.set(Number(s.day.slice(8, 10)), (m.get(Number(s.day.slice(8, 10))) ?? 0) + 1);
    return m;
  }, [stamps]);

  if (unavailable) return null;
  const first = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [...Array.from({ length: first }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const total = (stamps ?? []).length;

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  return (
    <section className="mx-auto w-full max-w-xl rounded-3xl bg-white p-5 text-deep-navy">
      <div className="mb-3 flex items-center gap-2">
        <HomeworkStamp size={36} label="OK" />
        <h2 className="min-w-0 flex-1 text-xl font-bold">{t('studentHw.stampCalendarTitle')}</h2>
        <button type="button" onClick={() => shift(-1)} aria-label={t('homework.prevMonth')} className="flex h-10 w-10 items-center justify-center rounded-full bg-deep-navy/10">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <span className="min-w-[5.5rem] text-center text-base font-bold">{t('homework.monthLabel', { year, month })}</span>
        <button type="button" onClick={() => shift(1)} aria-label={t('homework.nextMonth')} className="flex h-10 w-10 items-center justify-center rounded-full bg-deep-navy/10">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
      <p className="mb-3 text-base text-deep-navy/70">{stamps && total === 0 ? t('studentHw.stampCalendarEmpty') : t('studentHw.stampCount', { count: total })}</p>
      <div className="grid grid-cols-7 gap-1.5">
        {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
          <div key={w} className={`text-center text-sm font-bold ${i === 0 ? 'text-[#e5484d]' : i === 6 ? 'text-[#4dabf7]' : 'text-deep-navy/60'}`}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <div key={`e${i}`} />;
          const has = byDay.has(d);
          const isToday = `${year}-${pad(month)}-${pad(d)}` === todayKey;
          return (
            <div
              key={d}
              className={`relative flex aspect-square items-center justify-center rounded-xl text-sm ${isToday ? 'border-2 border-[#4dabf7] bg-[#e7f5ff]' : 'bg-deep-navy/5'}`}
            >
              <span className={`absolute left-1 top-0.5 text-xs ${isToday ? 'font-bold text-[#1971c2]' : 'text-deep-navy/50'}`}>{d}</span>
              {has && <HomeworkStamp size={44} label="OK" className="hw-stamp-drop" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
