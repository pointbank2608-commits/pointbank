import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchMyStudentRow, fetchRankingSummary } from '../lib/api';
import { monthStart, todayStart, weekStart } from '../lib/format';
import { useClasses } from '../lib/useClasses';
import type { SummaryRow } from '../lib/types';

type Period = 'today' | 'week' | 'month' | 'all';
type Scope = 'class' | 'academy';

const PERIODS: { key: Period; label: string; since: () => Date | null }[] = [
  { key: 'today', label: '오늘', since: todayStart },
  { key: 'week', label: '이번 주', since: weekStart },
  { key: 'month', label: '이번 달', since: monthStart },
  { key: 'all', label: '전체', since: () => null },
];

export default function ResultsPage() {
  const { academy, session, pointUnit, isStaff } = useAuth();
  const { notify } = useToast();
  const { classes, selectedId, select } = useClasses(academy?.id);

  const [period, setPeriod] = useState<Period>('all');
  const [scope, setScope] = useState<Scope>('class');
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [myStudentId, setMyStudentId] = useState<string | null>(null);

  // 학생이면 본인 행을 강조하기 위해 자기 students.id 를 알아둔다.
  useEffect(() => {
    if (isStaff || !session?.user.id) return;
    fetchMyStudentRow(session.user.id)
      .then((s) => setMyStudentId(s?.id ?? null))
      .catch(() => setMyStudentId(null));
  }, [isStaff, session?.user.id]);

  const load = useCallback(async () => {
    if (scope === 'class' && !selectedId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const since = PERIODS.find((p) => p.key === period)!.since();
      setRows(await fetchRankingSummary(scope === 'class' ? selectedId : null, since));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [scope, selectedId, period, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  // 기간 내 활동이 아예 없는 학생은 순위 아래로 밀어두되 목록에는 남긴다.
  const ranked = rows.filter((r) => r.tx_count > 0);
  const idle = rows.filter((r) => r.tx_count === 0);

  const top3 = ranked.slice(0, 3);
  const podiumOrder = [1, 0, 2].filter((i) => top3[i]);

  const totalEarned = rows.reduce((s, r) => s + r.earned, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <>
      <div className="ranking-scope">
        <button
          className={`scope-btn ${scope === 'class' ? 'active' : ''}`}
          onClick={() => setScope('class')}
        >
          반별
        </button>
        <button
          className={`scope-btn ${scope === 'academy' ? 'active' : ''}`}
          onClick={() => setScope('academy')}
        >
          학원 전체
        </button>
      </div>

      {scope === 'class' && (
        <div className="class-tabs">
          {classes.map((c) => (
            <button
              key={c.id}
              className={`class-tab ${c.id === selectedId ? 'active' : ''}`}
              onClick={() => select(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="period-tabs">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={`period-btn ${period === p.key ? 'active' : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-hint">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="empty-hint">학생이 없습니다.</div>
      ) : (
        <>
          <div className="stat-strip">
            <div className="stat">
              <div className="stat-label">총 적립</div>
              <div className="stat-num plus">
                +{totalEarned}
                <span>{pointUnit}</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">총 차감</div>
              <div className="stat-num minus">
                −{totalSpent}
                <span>{pointUnit}</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">참여 학생</div>
              <div className="stat-num">
                {ranked.length}
                <span>명</span>
              </div>
            </div>
          </div>

          {ranked.length === 0 ? (
            <div className="empty-hint">이 기간에는 적립 기록이 없습니다.</div>
          ) : (
            <>
              <div className="podium">
                {podiumOrder.map((i) => {
                  const p = top3[i];
                  return (
                    <div key={p.student_id} className={`podium-slot p${i + 1}`}>
                      <div className="medal">{i + 1}</div>
                      <div className="pname">{p.name}</div>
                      <div className="pscore">
                        {p.balance}
                        {pointUnit}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rank-list">
                <div className="rank-row head">
                  <div className="rank-num">#</div>
                  <div className="rgrow">이름</div>
                  <div className="rcol">적립</div>
                  <div className="rcol">차감</div>
                  <div className="rscore">합계</div>
                </div>
                {ranked.map((r, i) => (
                  <div
                    key={r.student_id}
                    className={`rank-row ${r.student_id === myStudentId ? 'me' : ''}`}
                  >
                    <div className="rank-num">{i + 1}</div>
                    <div className="rgrow">
                      <div className="rname">{r.name}</div>
                      <div className="rclass">{r.class_name}</div>
                    </div>
                    <div className="rcol plus">+{r.earned}</div>
                    <div className="rcol minus">{r.spent > 0 ? `−${r.spent}` : '–'}</div>
                    <div className="rscore">
                      {r.balance}
                      {pointUnit}
                    </div>
                  </div>
                ))}
                {idle.map((r) => (
                  <div key={r.student_id} className="rank-row idle">
                    <div className="rank-num">–</div>
                    <div className="rgrow">
                      <div className="rname">{r.name}</div>
                      <div className="rclass">{r.class_name}</div>
                    </div>
                    <div className="rcol" style={{ gridColumn: 'span 2' }}>
                      기록 없음
                    </div>
                    <div className="rscore">–</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
