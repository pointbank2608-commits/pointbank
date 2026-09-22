import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchClasses, fetchMyBalance, fetchStudentById, fetchTransactions } from '../lib/api';
import { dateKey, fmtDay, signed } from '../lib/format';
import type { ClassRow, Student, StudentBalance, Transaction } from '../lib/types';

/** 이 학생의 전체 통장 내역(전 기간) — /results 목록의 아이콘에서 들어온다.
 * ClassBoardPage/PassbookCard 는 "오늘" 기록만 보여주고, ResultsPage 는 기간 합계만 보여줘서,
 * 선생님이 "이 학생이 언제 왜 적립·차감됐는지"를 한 줄씩 훑어볼 화면이 따로 없었다(사용자 피드백,
 * 2026-09-22). 같은 데이터를 학생 본인 화면(StudentPage.tsx)은 이미 보여주고 있지만 학생 로그인은
 * 베타에서 잠겨 있어(CLAUDE.md 룰 1) 선생님은 볼 방법이 없었다 — 그 목록을 선생님 라우트로 옮기고
 * 날짜별로 묶어 통장처럼 보이게 한다. */
export default function StudentHistoryPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { academy, pointUnit } = useAuth();
  const { notify } = useToast();
  const { t, i18n } = useTranslation();

  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [balance, setBalance] = useState<StudentBalance | null>(null);
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
    setLoading(true);
    Promise.all([fetchStudentById(studentId), fetchMyBalance(studentId), fetchTransactions(studentId, 1000)])
      .then(([s, bal, t]) => {
        setStudent(s);
        setBalance(bal);
        setTxs(t);
      })
      .catch((err) => notify(err instanceof Error ? err.message : String(err), 'error'))
      .finally(() => setLoading(false));
  }, [studentId, notify]);

  const className = classes.find((c) => c.id === student?.class_id)?.name ?? '';
  const totalEarned = txs.filter((tx) => tx.delta > 0).reduce((s, tx) => s + tx.delta, 0);
  const totalSpent = txs.filter((tx) => tx.delta < 0).reduce((s, tx) => s - tx.delta, 0);

  // 날짜별로 묶어서 통장 내역처럼 보여준다(최신 날짜가 위).
  const groups = useMemo(() => {
    const byDay = new Map<string, Transaction[]>();
    for (const tx of txs) {
      const key = dateKey(new Date(tx.created_at));
      const list = byDay.get(key);
      if (list) list.push(tx);
      else byDay.set(key, [tx]);
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [txs]);

  function timeOf(iso: string): string {
    return new Date(iso).toLocaleTimeString(i18n.language?.startsWith('en') ? 'en-US' : 'ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
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
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
              {t('studentHistory.title', { name: student.name })}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">{className}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('results.totalEarned')}</div>
              <div className="font-display-lg text-[28px] text-secondary">
                +{totalEarned}
                <span className="font-caption text-caption text-on-surface-variant ml-1">{pointUnit}</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('results.totalSpent')}</div>
              <div className="font-display-lg text-[28px] text-error">
                −{totalSpent}
                <span className="font-caption text-caption text-on-surface-variant ml-1">{pointUnit}</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('studentHistory.balance')}</div>
              <div className="font-display-lg text-[28px] text-on-surface">
                {balance?.balance ?? 0}
                <span className="font-caption text-caption text-on-surface-variant ml-1">{pointUnit}</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-hidden">
            {loading ? (
              <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
            ) : groups.length === 0 ? (
              <div className="text-center py-16 font-body-md text-on-surface-variant">{t('studentHistory.empty')}</div>
            ) : (
              groups.map(([day, list]) => (
                <div key={day} className="border-b border-surface-container last:border-0">
                  <div className="sticky top-0 bg-surface-container-low px-4 md:px-6 py-2 font-label-md text-label-md text-on-surface-variant">
                    {fmtDay(day)}
                  </div>
                  {list.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex justify-between items-center gap-3 px-4 md:px-6 py-3 border-t border-surface-container/60 first:border-t-0"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="font-caption text-caption text-on-surface-variant shrink-0 tabular-nums">
                          {timeOf(tx.created_at)}
                        </span>
                        {tx.is_homework && (
                          <span className="material-symbols-outlined text-[16px] text-on-surface-variant shrink-0" title={t('passbook.homeworkTitle')}>
                            calendar_month
                          </span>
                        )}
                        <span className="font-body-md text-body-md text-on-surface truncate">{tx.reason}</span>
                        {tx.created_by_name && (
                          <span className="font-caption text-caption text-on-surface-variant shrink-0">
                            · {tx.created_by_name}
                          </span>
                        )}
                      </div>
                      <span className={`font-title-md text-title-md shrink-0 ${tx.delta > 0 ? 'text-secondary' : 'text-error'}`}>
                        {signed(tx.delta)}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
