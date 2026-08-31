import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchMyBalance, fetchMyStudentRow, fetchTransactions } from '../lib/api';
import { fmtDay, fmtTime, dateKey, signed, todayStart } from '../lib/format';
import type { Student, Transaction } from '../lib/types';

export default function StudentPage() {
  const { t } = useTranslation();
  const { session, profile, pointUnit, academy } = useAuth();
  const { notify } = useToast();

  const [me, setMe] = useState<Student | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    (async () => {
      try {
        const student = await fetchMyStudentRow(userId);
        setMe(student);
        if (student) {
          const [txs, bal] = await Promise.all([
            fetchTransactions(student.id, 200),
            fetchMyBalance(student.id),
          ]);
          setHistory(txs);
          setTotal(bal?.balance ?? 0);
        }
      } catch (err) {
        notify(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user.id, notify]);

  const today = useMemo(() => {
    const start = todayStart().getTime();
    return history
      .filter((tx) => new Date(tx.created_at).getTime() >= start)
      .reduce((sum, tx) => sum + tx.delta, 0);
  }, [history]);

  const todayTx = useMemo(() => {
    const start = todayStart().getTime();
    return history.filter((tx) => new Date(tx.created_at).getTime() >= start);
  }, [history]);

  if (loading) {
    return <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>;
  }

  if (!me) {
    return (
      <div className="text-center py-16 font-body-md text-on-surface-variant">
        {t('student.notFound')}
      </div>
    );
  }

  const toneClass = today > 0 ? 'text-secondary-fixed' : today < 0 ? 'text-error-container' : 'text-primary-fixed';

  return (
    <div className="space-y-6">
      <div className="bg-primary text-on-primary rounded-xl p-6 md:p-8 relative overflow-hidden shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="font-title-md text-title-md">{profile?.display_name ?? me.name}</div>
              <div className="font-caption text-caption opacity-80">{academy?.name}</div>
            </div>
            <div className="font-caption text-caption bg-white/15 rounded-full px-3 py-1">{t('student.passbookBadge')}</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1">
              <div className="font-caption text-caption opacity-80 mb-1">{t('student.todayEarned')}</div>
              <div className={`font-display-lg text-[40px] ${toneClass}`}>
                {today > 0 ? '+' : ''}
                {today}
                <span className="font-caption text-caption ml-1">{pointUnit}</span>
              </div>
            </div>
            <div className="hidden sm:block w-px bg-white/20" />
            <div className="flex-1">
              <div className="font-caption text-caption opacity-80 mb-1">{t('student.totalEarned', { unit: pointUnit })}</div>
              <div className="font-display-lg text-[40px]">
                {total}
                <span className="font-caption text-caption ml-1">{pointUnit}</span>
              </div>
            </div>
          </div>
        </div>
        <div
          className="absolute right-0 top-0 w-64 h-full opacity-20 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #FFD54F 0%, transparent 60%)' }}
        />
      </div>

      <div>
        <h3 className="font-title-md text-title-md text-on-surface mb-3">
          {t('student.todayHistory')}{' '}
          <span className="font-caption text-caption bg-surface-container-low text-on-surface-variant rounded-full px-2.5 py-1 align-middle ml-1">
            {fmtDay(dateKey())}
          </span>
        </h3>
        <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-hidden">
          {todayTx.length === 0 ? (
            <div className="text-center py-8 font-body-md text-on-surface-variant">
              {t('student.noTodayHistory', { unit: pointUnit })}
            </div>
          ) : (
            todayTx.map((tx) => (
              <div
                key={tx.id}
                className="flex justify-between items-center px-4 md:px-6 py-3 border-b border-surface-container last:border-0"
              >
                <span className="font-body-md text-body-md text-on-surface-variant truncate mr-2">
                  {fmtTime(tx.created_at)} · {tx.reason}
                </span>
                <span
                  className={`font-title-md text-title-md shrink-0 ${tx.delta > 0 ? 'text-secondary' : 'text-error'}`}
                >
                  {signed(tx.delta)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="font-title-md text-title-md text-on-surface mb-3">
          {t('student.allHistory')}{' '}
          <span className="font-caption text-caption bg-surface-container-low text-on-surface-variant rounded-full px-2.5 py-1 align-middle ml-1">
            {t('student.countSuffix', { count: history.length })}
          </span>
        </h3>
        <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-hidden">
          {history.length === 0 ? (
            <div className="text-center py-8 font-body-md text-on-surface-variant">{t('student.noHistory')}</div>
          ) : (
            history.map((tx) => (
              <div
                key={tx.id}
                className="flex justify-between items-center px-4 md:px-6 py-3 border-b border-surface-container last:border-0"
              >
                <span className="font-body-md text-body-md text-on-surface-variant truncate mr-2">
                  {fmtTime(tx.created_at)} · {tx.reason}
                  {tx.created_by_name ? ` · ${tx.created_by_name}` : ''}
                </span>
                <span
                  className={`font-title-md text-title-md shrink-0 ${tx.delta > 0 ? 'text-secondary' : 'text-error'}`}
                >
                  {signed(tx.delta)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
