import { useEffect, useState } from 'react';
import TodayLessons from '../components/TodayLessons';
import { PENDING_SHARE_KEY } from './SharedLessonPage';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import OnboardingChecklist from '../components/OnboardingChecklist';
import {
  fetchAcademyAttendanceOn,
  fetchAcademyTransactionsSince,
  fetchClasses,
  fetchStudentsOfAcademy,
} from '../lib/api';
import { dateKey, fmtDay, signed, todayStart } from '../lib/format';

export default function DashboardPage() {
  const navigateTo = useNavigate();
  // 로그인 전에 공유받은 수업 링크를 열었으면, 로그인 뒤 그 링크로 다시 보낸다(2026-09-27).
  useEffect(() => {
    try {
      const pending = localStorage.getItem(PENDING_SHARE_KEY);
      if (pending) {
        localStorage.removeItem(PENDING_SHARE_KEY);
        navigateTo(`/share/${pending}`, { replace: true });
      }
    } catch {
      /* 무시 */
    }
  }, [navigateTo]);
  const { academy, pointUnit } = useAuth();
  const { notify } = useToast();
  const { t } = useTranslation();

  const [classCount, setClassCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [rewardedCount, setRewardedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = dateKey();

  useEffect(() => {
    if (!academy?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchClasses(academy.id),
      fetchStudentsOfAcademy(academy.id),
      fetchAcademyAttendanceOn(academy.id, today),
      fetchAcademyTransactionsSince(academy.id, todayStart()),
    ])
      .then(([classes, students, attendance, txs]) => {
        if (cancelled) return;
        setClassCount(classes.length);
        setStudentCount(students.length);
        setPresentCount(attendance.filter((a) => a.checked_in_at).length);
        setTodayTotal(txs.reduce((sum, t) => sum + t.delta, 0));
        setRewardedCount(new Set(txs.map((t) => t.student_id)).size);
      })
      .catch((err) => {
        if (!cancelled) notify(err instanceof Error ? err.message : String(err), 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [academy?.id, today, notify]);

  const amountGiven = `${signed(todayTotal)}${pointUnit}`;

  return (
    <div className="space-y-gutter">
      {academy?.id && (
        <TodayLessons
          academyId={academy.id}
          stats={{ studentCount, presentCount, pointsText: amountGiven, rewardedCount }}
          heading={
            <div className="pb-1 pt-1">
              <h1 className="font-display-lg text-[clamp(1.7rem,3vw,2.4rem)] font-black leading-tight tracking-[-0.02em] text-deep-navy">{t('dashV2.title')}</h1>
              <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
                {loading ? t('dashboard.loadingToday') : t('dashV2.sub', { date: fmtDay(today), classes: classCount, students: studentCount })}
              </p>
            </div>
          }
        />
      )}

      {academy?.id && <OnboardingChecklist academyId={academy.id} />}

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
        {/* 오늘 할 일 */}
        <div className="rounded-[20px] border border-outline-variant bg-white p-6 shadow-card md:col-span-8">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-title-md text-title-md text-on-surface">{t('dashboard.todo')}</h3>
            <Link to="/results" className="rounded-full px-3 py-1 font-label-md text-label-md text-primary transition-colors hover:bg-primary-fixed">
              {t('dashboard.viewResults')}
            </Link>
          </div>

          <div className="space-y-4">
            <div className="flex items-center rounded-lg border border-outline-variant bg-surface-container-low p-4">
              <div className="mr-4 flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-[#e8f7ef] text-[#1f9d63]">
                <span className="font-title-md text-title-md">{presentCount}</span>
                <span className="font-caption text-caption">{t('dashboard.attendanceLabel')}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-title-md text-title-md text-on-surface">{t('dashboard.attendanceCheck')}</h4>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {t('dashboard.attendanceDesc', {
                    present: presentCount,
                    total: studentCount,
                    remaining: Math.max(studentCount - presentCount, 0),
                  })}
                </p>
              </div>
              <Link to="/attendance" className="ml-2 whitespace-nowrap font-label-md text-label-md text-primary">
                {t('dashboard.openAttendance')}
              </Link>
            </div>

            <div className="flex items-center rounded-lg border border-outline-variant bg-surface-container-low p-4">
              <div className="mr-4 flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-[#fff6dc] text-[#b07d00]">
                <span className="font-title-md text-title-md">{signed(todayTotal)}</span>
                <span className="font-caption text-caption">{pointUnit}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-title-md text-title-md text-on-surface">{t('dashboard.classBoard')}</h4>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {t('dashboard.classBoardDesc', { count: rewardedCount, amount: amountGiven })}
                </p>
              </div>
              <Link to="/board" className="ml-2 whitespace-nowrap font-label-md text-label-md text-primary">
                {t('dashboard.openBoard')}
              </Link>
            </div>
          </div>
        </div>

        {/* 알림 */}
        <div className="rounded-[20px] border border-outline-variant bg-white p-6 shadow-card md:col-span-4">
          <h3 className="mb-4 font-title-md text-title-md text-on-surface">{t('dashboard.notifications')}</h3>
          {classCount === 0 ? (
            <div className="rounded-lg bg-error-container p-4 text-on-error-container">
              <strong className="mb-1 block font-title-md text-title-md">{t('dashboard.noClassTitle')}</strong>
              <p className="font-body-md text-body-md">
                {t('dashboard.noClassDescBefore')}
                <Link to="/settings" className="underline">
                  {t('nav.settings')}
                </Link>
                {t('dashboard.noClassDescAfter')}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-primary-fixed p-4 text-deep-navy">
              <strong className="mb-1 block font-title-md text-title-md">{t('dashboard.todayGivenTitle')}</strong>
              <p className="font-body-md text-body-md">{t('dashboard.todayGivenDesc', { count: rewardedCount, amount: amountGiven })}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
