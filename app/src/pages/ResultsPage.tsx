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

const PODIUM_STYLE: Record<number, { bg: string; text: string; order: string; height: string }> = {
  0: { bg: 'bg-warm-yellow/30', text: 'text-tertiary-container', order: 'order-2', height: 'pt-0' },
  1: { bg: 'bg-surface-container-low', text: 'text-on-surface-variant', order: 'order-1', height: 'pt-6' },
  2: { bg: 'bg-soft-mint/30', text: 'text-deep-navy', order: 'order-3', height: 'pt-8' },
};

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
  const maxBalance = Math.max(1, ...ranked.map((r) => r.balance));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
          리포트
        </h2>
        <div className="flex bg-surface-container-low rounded-lg p-1">
          <button
            onClick={() => setScope('class')}
            className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              scope === 'class' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            반별
          </button>
          <button
            onClick={() => setScope('academy')}
            className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              scope === 'academy' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            학원 전체
          </button>
        </div>
      </div>

      {scope === 'class' && (
        <div className="flex flex-wrap gap-2">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => select(c.id)}
              className={`px-4 py-2 rounded-full font-label-md text-label-md transition-all ${
                c.id === selectedId
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-all ${
              period === p.key
                ? 'bg-secondary-container text-on-secondary-container'
                : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">학생이 없습니다.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">총 적립</div>
              <div className="font-display-lg text-[28px] text-secondary">
                +{totalEarned}
                <span className="font-caption text-caption text-on-surface-variant ml-1">{pointUnit}</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">총 차감</div>
              <div className="font-display-lg text-[28px] text-error">
                −{totalSpent}
                <span className="font-caption text-caption text-on-surface-variant ml-1">{pointUnit}</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">참여 학생</div>
              <div className="font-display-lg text-[28px] text-on-surface">
                {ranked.length}
                <span className="font-caption text-caption text-on-surface-variant ml-1">명</span>
              </div>
            </div>
          </div>

          {ranked.length === 0 ? (
            <div className="text-center py-16 font-body-md text-on-surface-variant">
              이 기간에는 적립 기록이 없습니다.
            </div>
          ) : (
            <>
              <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <h3 className="font-title-md text-title-md text-on-surface mb-6">우수 학생</h3>
                <div className="flex items-end justify-center gap-3">
                  {podiumOrder.map((i) => {
                    const p = top3[i];
                    const style = PODIUM_STYLE[i];
                    return (
                      <div
                        key={p.student_id}
                        className={`flex flex-col items-center gap-2 w-28 ${style.order} ${style.height}`}
                      >
                        <div
                          className={`w-14 h-14 rounded-full ${style.bg} ${style.text} flex items-center justify-center font-title-md text-title-md shrink-0`}
                        >
                          {i + 1}
                        </div>
                        <div className="font-label-md text-label-md text-on-surface truncate max-w-full">
                          {p.name}
                        </div>
                        <div className="font-title-md text-title-md text-primary">
                          {p.balance}
                          {pointUnit}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-hidden">
                <div className="grid grid-cols-[32px_1fr_70px_70px_90px] gap-2 px-4 md:px-6 py-3 font-caption text-caption text-on-surface-variant border-b border-surface-container">
                  <div>#</div>
                  <div>이름</div>
                  <div className="text-right">적립</div>
                  <div className="text-right">차감</div>
                  <div className="text-right">합계</div>
                </div>
                {ranked.map((r, i) => (
                  <div
                    key={r.student_id}
                    className={`relative grid grid-cols-[32px_1fr_70px_70px_90px] gap-2 px-4 md:px-6 py-3 items-center border-b border-surface-container last:border-0 ${
                      r.student_id === myStudentId ? 'bg-secondary-container/30' : ''
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/5 pointer-events-none"
                      style={{ width: `${(r.balance / maxBalance) * 100}%` }}
                    />
                    <div className="relative font-body-md text-body-md text-on-surface-variant">{i + 1}</div>
                    <div className="relative min-w-0">
                      <div className="font-label-md text-label-md text-on-surface truncate">{r.name}</div>
                      <div className="font-caption text-caption text-on-surface-variant truncate">
                        {r.class_name}
                      </div>
                    </div>
                    <div className="relative text-right font-body-md text-body-md text-secondary">
                      +{r.earned}
                    </div>
                    <div className="relative text-right font-body-md text-body-md text-error">
                      {r.spent > 0 ? `−${r.spent}` : '–'}
                    </div>
                    <div className="relative text-right font-title-md text-title-md text-on-surface">
                      {r.balance}
                      {pointUnit}
                    </div>
                  </div>
                ))}
                {idle.map((r) => (
                  <div
                    key={r.student_id}
                    className="grid grid-cols-[32px_1fr_90px] gap-2 px-4 md:px-6 py-3 items-center border-b border-surface-container last:border-0 opacity-60"
                  >
                    <div className="font-body-md text-body-md text-on-surface-variant">–</div>
                    <div className="min-w-0">
                      <div className="font-label-md text-label-md text-on-surface truncate">{r.name}</div>
                      <div className="font-caption text-caption text-on-surface-variant truncate">
                        {r.class_name} · 기록 없음
                      </div>
                    </div>
                    <div className="text-right font-body-md text-body-md text-on-surface-variant">–</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
