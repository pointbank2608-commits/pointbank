import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWatchSummary, type WatchSummaryRow } from '../../../lib/homework';

const POLL_MS = 15000;

/**
 * 영상 보기 숙제의 시청 현황(093) — 학생 × 영상별로 몇 번 봤는지, 마지막으로 본 날, 지금 보는 중인 정도.
 * 영상 숙제가 아니거나 093 전이면 아무것도 그리지 않는다. 화면이 보일 때만 15초마다 다시 읽는다.
 */
export default function WatchResults({ assignmentId, itemTitles }: { assignmentId: string; itemTitles: Map<string, string> }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<WatchSummaryRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void fetchWatchSummary(assignmentId).then(
        (r) => alive && setRows(r),
        () => alive && setRows([]),
      );
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [assignmentId]);

  // 학생 한 줄 = 영상 여러 칸
  const byStudent = useMemo(() => {
    const m = new Map<string, { name: string; cells: WatchSummaryRow[] }>();
    for (const r of rows ?? []) {
      const e = m.get(r.student_id) ?? { name: r.name, cells: [] };
      e.cells.push(r);
      m.set(r.student_id, e);
    }
    return [...m.values()];
  }, [rows]);
  const itemIds = useMemo(() => [...new Set((rows ?? []).map((r) => r.item_id))], [rows]);

  if (!rows || rows.length === 0) return null;

  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }) : null);

  return (
    <div className="space-y-2">
      <div className="font-label-md text-label-md text-on-surface">{t('studentHw.watchResultsTitle')}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-base">
          <thead>
            <tr className="text-left text-sm text-on-surface-variant">
              <th className="py-2 pr-3 font-label-md">{t('studentHw.watchColStudent')}</th>
              {itemIds.map((id, i) => (
                <th key={id} className="py-2 pr-3 font-label-md">
                  {itemTitles.get(id) || `${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byStudent.map((s) => (
              <tr key={s.name} className="border-t border-outline-variant/30 align-top">
                <td className="py-2 pr-3 font-bold text-on-surface">{s.name}</td>
                {itemIds.map((id) => {
                  const c = s.cells.find((x) => x.item_id === id);
                  if (!c) return <td key={id} className="py-2 pr-3 text-on-surface-variant">–</td>;
                  const done = c.views >= c.target;
                  return (
                    <td key={id} className="py-2 pr-3">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${done ? 'bg-emerald-100 text-emerald-800' : c.views > 0 || c.partial_pct ? 'bg-amber-100 text-amber-800' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        {c.views} / {c.target}
                      </span>
                      <div className="mt-0.5 text-xs text-on-surface-variant">
                        {c.last_at ? `${t('studentHw.watchColLast')} ${day(c.last_at)}` : t('studentHw.watchNone')}
                        {!done && c.partial_pct ? ` · ${t('studentHw.watchColNow')} ${c.partial_pct}%` : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
