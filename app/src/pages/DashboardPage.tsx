import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchAcademyAttendanceOn,
  fetchAcademyTransactionsSince,
  fetchClasses,
  fetchStudentsOfAcademy,
} from '../lib/api';
import { dateKey, fmtDay, signed, todayStart } from '../lib/format';

function hello(hour: number): string {
  if (hour < 12) return '좋은 아침입니다';
  if (hour < 18) return '좋은 오후입니다';
  return '좋은 저녁입니다';
}

export default function DashboardPage() {
  const { academy, profile, pointUnit } = useAuth();
  const { notify } = useToast();

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

  const name = profile?.display_name ?? '선생님';
  const hour = new Date().getHours();
  const sun = hour < 18 ? '☀️' : '🌙';
  const attendanceRate = studentCount > 0 ? Math.round((presentCount / studentCount) * 100) : 0;

  return (
    <div className="space-y-gutter">
      {/* 웰컴 배너 */}
      <div className="bg-primary text-on-primary rounded-xl p-6 md:p-8 relative overflow-hidden shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <div className="relative z-10">
          <h2 className="font-headline-lg-mobile md:font-headline-lg">
            {hello(hour)}, {name}! {sun}
          </h2>
          <p className="font-body-lg text-primary-fixed opacity-90 mt-1">
            {loading ? '오늘 현황을 불러오는 중…' : `${fmtDay(today)} · 반 ${classCount}개 · 학생 ${studentCount}명`}
          </p>
        </div>
        <div
          className="absolute right-0 top-0 w-64 h-full opacity-20 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #FFD54F 0%, transparent 60%)' }}
        />
      </div>

      {/* bento 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        {/* 오늘 할 일 */}
        <div className="md:col-span-8 bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-title-md text-title-md text-on-surface">오늘 할 일</h3>
            <Link to="/results" className="text-primary font-label-md text-label-md hover:bg-surface-container-low px-3 py-1 rounded-full transition-colors">
              결과 보기
            </Link>
          </div>

          <div className="space-y-4">
            <div className="flex items-center p-4 rounded-lg bg-surface-container-low border border-surface-variant">
              <div className="w-16 h-16 rounded-lg bg-soft-mint/30 flex flex-col items-center justify-center text-secondary mr-4 shrink-0">
                <span className="font-title-md text-title-md">{presentCount}</span>
                <span className="font-caption text-caption">등원</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-title-md text-title-md text-on-surface">출석 체크</h4>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  오늘 {presentCount}명이 등원했고, 전체 {studentCount}명 중 아직{' '}
                  {Math.max(studentCount - presentCount, 0)}명이 남아 있습니다.
                </p>
              </div>
              <Link to="/attendance" className="text-primary font-label-md text-label-md whitespace-nowrap ml-2">
                출석부 열기
              </Link>
            </div>

            <div className="flex items-center p-4 rounded-lg bg-surface-bright border border-surface-variant">
              <div className="w-16 h-16 rounded-lg bg-warm-yellow/20 flex flex-col items-center justify-center text-tertiary-container mr-4 shrink-0">
                <span className="font-title-md text-title-md">{signed(todayTotal)}</span>
                <span className="font-caption text-caption">{pointUnit}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-title-md text-title-md text-on-surface">반별 통장</h4>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  오늘 {rewardedCount}명에게 {signed(todayTotal)}
                  {pointUnit}를 지급했습니다.
                </p>
              </div>
              <Link to="/board" className="text-primary font-label-md text-label-md whitespace-nowrap ml-2">
                통장 열기
              </Link>
            </div>
          </div>
        </div>

        {/* 학급 통계 */}
        <div className="md:col-span-4 bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_20px_rgba(39,101,168,0.08)] flex flex-col">
          <h3 className="font-title-md text-title-md text-on-surface mb-6">학급 통계</h3>
          <div className="flex-1 flex flex-col justify-center items-center py-4">
            <div
              className="relative w-32 h-32 rounded-full mb-6 flex items-center justify-center"
              style={{
                background: `conic-gradient(#90f1dd ${attendanceRate * 3.6}deg, #e8eff7 0deg)`,
              }}
            >
              <div className="absolute inset-[10px] rounded-full bg-surface-container-lowest flex items-center justify-center">
                <div className="text-center">
                  <span className="block font-display-lg text-[28px] text-on-surface">{attendanceRate}%</span>
                  <span className="font-caption text-caption text-on-surface-variant">출석률</span>
                </div>
              </div>
            </div>
            <div className="w-full space-y-3">
              <div className="flex justify-between items-center text-body-md">
                <span className="text-on-surface-variant flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-secondary-container inline-block" /> 출석
                </span>
                <span className="font-bold text-on-surface">{presentCount}명</span>
              </div>
              <div className="flex justify-between items-center text-body-md">
                <span className="text-on-surface-variant flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-error-container inline-block" /> 미등원
                </span>
                <span className="font-bold text-on-surface">{Math.max(studentCount - presentCount, 0)}명</span>
              </div>
            </div>
          </div>
        </div>

        {/* 알림 */}
        <div className="md:col-span-6 bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
          <h3 className="font-title-md text-title-md text-on-surface mb-4">알림</h3>
          {classCount === 0 ? (
            <div className="bg-error-container text-on-error-container rounded-lg p-4">
              <strong className="font-title-md text-title-md block mb-1">반이 아직 없어요</strong>
              <p className="font-body-md text-body-md">
                <Link to="/settings" className="underline">
                  설정
                </Link>
                에서 반을 추가하면 출석부와 통장을 쓸 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="bg-secondary-container text-on-secondary-container rounded-lg p-4">
              <strong className="font-title-md text-title-md block mb-1">오늘 지급 현황</strong>
              <p className="font-body-md text-body-md">
                {rewardedCount}명에게 {signed(todayTotal)}
                {pointUnit}를 지급했습니다. 수업이 끝나면 통장에서 오늘을 마감해 주세요.
              </p>
            </div>
          )}
        </div>

        {/* 바로가기 */}
        <div className="md:col-span-6 grid grid-cols-2 gap-4">
          <Link
            to="/attendance"
            className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] flex flex-col items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-soft-mint text-deep-navy flex items-center justify-center">
              <span className="material-symbols-outlined">calendar_today</span>
            </div>
            <span className="font-title-md text-title-md text-on-surface text-center">출석부 열기</span>
          </Link>
          <Link
            to="/games"
            className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] flex flex-col items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-warm-yellow/30 text-tertiary-container flex items-center justify-center">
              <span className="material-symbols-outlined">sports_esports</span>
            </div>
            <span className="font-title-md text-title-md text-on-surface text-center">게임 시작</span>
          </Link>
          <Link
            to="/board"
            className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] flex flex-col items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <span className="font-title-md text-title-md text-on-surface text-center">포인트 지급</span>
          </Link>
          <Link
            to="/settings"
            className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] flex flex-col items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center">
              <span className="material-symbols-outlined">settings</span>
            </div>
            <span className="font-title-md text-title-md text-on-surface text-center">설정</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
