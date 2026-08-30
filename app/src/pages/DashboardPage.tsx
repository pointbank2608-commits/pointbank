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
import './DashboardPage.css';

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

  return (
    <section className="dash" aria-label="선생님 홈">
      <div className="dash-blob dash-blob-a" />
      <div className="dash-blob dash-blob-b" />

      <div className="dash-inner">
        <header className="dash-hello">
          <h1>
            {hello(hour)}, {name}! {sun}
          </h1>
          <p>
            {loading
              ? '오늘 현황을 불러오는 중…'
              : `${fmtDay(today)} · 반 ${classCount}개 · 학생 ${studentCount}명`}
          </p>
        </header>

        <div className="dash-grid">
          <section className="dash-panel">
            <div className="dash-accent" />
            <div className="dash-panel-head">
              <h2 className="dash-h2">오늘 할 일</h2>
              <Link to="/results" className="dash-ghost">
                결과 보기
              </Link>
            </div>

            <div className="dash-rows">
              <article className="dash-row is-now">
                <div className="dash-row-main">
                  <div className="dash-time">
                    <strong>{presentCount}</strong>
                    <span>등원</span>
                  </div>
                  <div>
                    <h3>출석 체크</h3>
                    <p>
                      오늘 {presentCount}명이 등원했고, 전체 {studentCount}명 중 아직{' '}
                      {Math.max(studentCount - presentCount, 0)}명이 남아 있습니다.
                    </p>
                    <div className="dash-tags">
                      <span className="dash-tag">출석부</span>
                      <span className="dash-tag is-gold">{studentCount}명</span>
                    </div>
                  </div>
                </div>
                <Link to="/attendance" className="dash-go">
                  출석부 열기
                </Link>
              </article>

              <article className="dash-row is-next">
                <div className="dash-row-main">
                  <div className="dash-time">
                    <strong>{signed(todayTotal)}</strong>
                    <span>{pointUnit}</span>
                  </div>
                  <div>
                    <h3>반별 통장</h3>
                    <p>
                      오늘 {rewardedCount}명에게 {signed(todayTotal)}
                      {pointUnit}를 지급했습니다.
                    </p>
                    <div className="dash-tags">
                      <span className="dash-tag">포인트</span>
                      <span className="dash-tag is-gold">반 {classCount}개</span>
                    </div>
                  </div>
                </div>
                <Link to="/board" className="dash-ready">
                  통장 열기
                </Link>
              </article>
            </div>
          </section>

          <aside className="dash-side">
            <div className="dash-tiles">
              <Link to="/attendance" className="dash-tile is-sky">
                <span className="dash-tile-emoji">📋</span>
                출석부 열기
              </Link>
              <Link to="/games" className="dash-tile is-gold">
                <span className="dash-tile-emoji">🎮</span>
                게임 시작
              </Link>
            </div>

            <section className="dash-panel">
              <div className="dash-panel-head">
                <h2 className="dash-h2">알림</h2>
                {classCount === 0 ? <span className="dash-badge">1</span> : null}
              </div>
              <div className="dash-notes">
                {classCount === 0 ? (
                  <div className="dash-note is-warn">
                    <strong>반이 아직 없어요</strong>
                    <p>
                      <Link to="/settings">설정</Link>에서 반을 추가하면 출석부와 통장을 쓸 수
                      있습니다.
                    </p>
                  </div>
                ) : (
                  <div className="dash-note is-ok">
                    <strong>오늘 지급 현황</strong>
                    <p>
                      {rewardedCount}명에게 {signed(todayTotal)}
                      {pointUnit}를 지급했습니다. 수업이 끝나면 통장에서 오늘을 마감해 주세요.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
