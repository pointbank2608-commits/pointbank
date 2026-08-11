import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchMyBalance, fetchMyStudentRow, fetchTransactions } from '../lib/api';
import { fmtDay, fmtTime, dateKey, signed, todayStart } from '../lib/format';
import type { Student, Transaction } from '../lib/types';

export default function StudentPage() {
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
      .filter((t) => new Date(t.created_at).getTime() >= start)
      .reduce((sum, t) => sum + t.delta, 0);
  }, [history]);

  const todayTx = useMemo(() => {
    const start = todayStart().getTime();
    return history.filter((t) => new Date(t.created_at).getTime() >= start);
  }, [history]);

  if (loading) return <div className="empty-hint">불러오는 중…</div>;

  if (!me) {
    return (
      <div className="empty-hint">
        연결된 학생 통장을 찾을 수 없습니다. 선생님께 학생 코드를 다시 확인해 주세요.
      </div>
    );
  }

  const tone = today > 0 ? 'plus' : today < 0 ? 'minus' : 'zero';

  return (
    <>
      <div className="my-passbook">
        <div className="mp-cover">
          <div className="mp-owner">
            <div className="mp-name">{profile?.display_name ?? me.name}</div>
            <div className="mp-academy">{academy?.name}</div>
          </div>
          <div className="mp-seal">통장</div>
        </div>

        <div className="mp-body">
          <div className="mp-today">
            <div className="mp-label">오늘 적립</div>
            <div className={`mp-today-num ${tone}`}>
              {today > 0 ? '+' : ''}
              {today}
              <span className="mp-unit">{pointUnit}</span>
            </div>
          </div>

          <div className="mp-divider" />

          <div className="mp-total">
            <div className="mp-label">지금까지 모은 {pointUnit}</div>
            <div className="mp-total-num">
              {total}
              <span className="mp-unit">{pointUnit}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">
        오늘 내역 <span className="badge">{fmtDay(dateKey())}</span>
      </div>
      <div className="rank-list plain">
        {todayTx.length === 0 ? (
          <div className="history-empty" style={{ padding: '14px 16px' }}>
            오늘은 아직 적립된 {pointUnit}이 없어요.
          </div>
        ) : (
          todayTx.map((t) => (
            <div className="history-line" key={t.id}>
              <span>
                {fmtTime(t.created_at)} · {t.reason}
              </span>
              <span className={`delta ${t.delta > 0 ? 'plus' : 'minus'}`}>{signed(t.delta)}</span>
            </div>
          ))
        )}
      </div>

      <div className="section-title" style={{ marginTop: 24 }}>
        전체 거래 내역 <span className="badge">{history.length}건</span>
      </div>
      <div className="rank-list plain">
        {history.length === 0 ? (
          <div className="history-empty" style={{ padding: '14px 16px' }}>
            아직 지급 내역이 없어요.
          </div>
        ) : (
          history.map((t) => (
            <div className="history-line" key={t.id}>
              <span>
                {fmtTime(t.created_at)} · {t.reason}
                {t.created_by_name ? ` · ${t.created_by_name}` : ''}
              </span>
              <span className={`delta ${t.delta > 0 ? 'plus' : 'minus'}`}>{signed(t.delta)}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
