import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchClasses, fetchHomeworkTransactions, fetchStudentById } from '../lib/api';
import { dateKey } from '../lib/format';
import type { ClassRow, Student, Transaction } from '../lib/types';

const WEEKDAY_KEYS = [
  'homework.weekdaySun',
  'homework.weekdayMon',
  'homework.weekdayTue',
  'homework.weekdayWed',
  'homework.weekdayThu',
  'homework.weekdayFri',
  'homework.weekdaySat',
];

type DayStatus = 'done' | 'missing' | 'none';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function HomeworkCalendarPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { academy } = useAuth();
  const { notify } = useToast();
  const { t } = useTranslation();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1~12

  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!academy?.id) return;
    fetchClasses(academy.id)
      .then(setClasses)
      .catch(() => {
        /* 반 이름은 부가 정보라 실패해도 조용히 무시 */
      });
  }, [academy?.id]);

  useEffect(() => {
    if (!studentId) return;
    fetchStudentById(studentId)
      .then(setStudent)
      .catch((err) => notify(err instanceof Error ? err.message : String(err), 'error'));
  }, [studentId, notify]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const from = `${year}-${pad(month)}-01`;
  const to = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    fetchHomeworkTransactions(studentId, from, to)
      .then(setTxs)
      .catch((err) => notify(err instanceof Error ? err.message : String(err), 'error'))
      .finally(() => setLoading(false));
  }, [studentId, from, to, notify]);

  const statusByDay = useMemo(() => {
    const m = new Map<number, DayStatus>();
    for (const t of txs) {
      const day = new Date(t.created_at).getDate();
      const current = m.get(day);
      if (t.delta > 0) m.set(day, 'done');
      else if (t.delta < 0 && current !== 'done') m.set(day, 'missing');
    }
    return m;
  }, [txs]);

  const doneDays = [...statusByDay.values()].filter((s) => s === 'done').length;
  const missingDays = [...statusByDay.values()].filter((s) => s === 'missing').length;
  const completionRate =
    doneDays + missingDays > 0 ? Math.round((doneDays / (doneDays + missingDays)) * 100) : null;

  const className = classes.find((c) => c.id === student?.class_id)?.name ?? '';
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=일
  const today = dateKey();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
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
    <div className="space-y-6">
      <Link
        to="/results"
        className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        {t('homework.backToResults')}
      </Link>

      {!student ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
                {t('homework.title', { name: student.name })}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">{className}</p>
            </div>
            <div className="flex items-center bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm px-2 py-1.5">
              <button
                onClick={() => shiftMonth(-1)}
                className="p-1.5 rounded-md hover:bg-surface-container-low text-on-surface-variant transition-colors"
                aria-label={t('homework.prevMonth')}
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="font-title-md text-title-md text-on-surface px-3">
                {t('homework.monthLabel', { year, month })}
              </span>
              <button
                onClick={() => shiftMonth(1)}
                className="p-1.5 rounded-md hover:bg-surface-container-low text-on-surface-variant transition-colors"
                aria-label={t('homework.nextMonth')}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('homework.completionRate')}</div>
              <div className="font-display-lg text-[28px] text-secondary">
                {completionRate == null ? '–' : `${completionRate}%`}
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('homework.done')}</div>
              <div className="font-display-lg text-[28px] text-on-surface">
                {doneDays}
                {t('homework.daySuffix')}
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('homework.missing')}</div>
              <div className="font-display-lg text-[28px] text-error">
                {missingDays}
                {t('homework.daySuffix')}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
            <div className="flex items-center gap-4 mb-5 font-caption text-caption text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                </span>
                {t('homework.done')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-error-container text-on-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </span>
                {t('homework.missing')}
              </span>
            </div>

            {loading ? (
              <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
            ) : (
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {WEEKDAY_KEYS.map((key, i) => (
                  <div
                    key={key}
                    className={`text-center font-label-md text-label-md py-1.5 ${
                      i === 0 ? 'text-error' : i === 6 ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {t(key)}
                  </div>
                ))}
                {cells.map((day, i) => {
                  if (day == null) return <div key={`empty-${i}`} />;
                  const status = statusByDay.get(day) ?? 'none';
                  const isToday = `${year}-${pad(month)}-${pad(day)}` === today;
                  return (
                    <div
                      key={day}
                      className={`aspect-square rounded-lg border p-1.5 flex flex-col items-center justify-between ${
                        isToday ? 'border-2 border-primary bg-primary-container/10' : 'border-surface-container'
                      }`}
                    >
                      <span
                        className={`font-caption text-caption self-end ${
                          isToday ? 'text-primary font-bold' : 'text-on-surface-variant'
                        }`}
                      >
                        {day}
                      </span>
                      {status !== 'none' && (
                        <span
                          className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                            status === 'done'
                              ? 'bg-secondary-container text-on-secondary-container'
                              : 'bg-error-container text-on-error-container'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px] sm:text-[20px]">
                            {status === 'done' ? 'check' : 'close'}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
