import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import BulkFeaturesPanel from '../components/admin/BulkFeaturesPanel';
import { Badge, DataState, PageHead } from '../components/admin/AdminUi';
import { BillingBadge, EntitlementBadge, SourceBadge } from '../components/admin/labels';
import {
  ACADEMY_PAGE_SIZE, adminAcademySearchV2, deleteSavedFilter, errorText, fmtKstDate, listSavedFilters, saveFilter, useAdminQuery,
  type AcademyFilterKey, type AcademySortKey,
} from '../lib/adminOps';

/**
 * 학원·회원(2026-10-18) — 검색·필터·정렬을 모두 서버에서 처리한다(학원 1만 곳에서도 한 번에 50곳만 읽음).
 * 학원 이름·원장/선생님 이메일·이름으로 찾고, 자주 쓰는 조건은 저장한다. 목록의 줄 수 = 오늘 할 일 카드의 숫자(같은 서버 조건).
 * 요금제 변경·삭제 같은 개별 조치는 학원 상세에서 사유와 함께 한다(목록에서 바로 누르지 않는다).
 */
const FILTERS: AcademyFilterKey[] = [
  'all', 'today', 'new7', 'active7', 'trial', 'trial_ending', 'free', 'paid', 'subscription', 'grant',
  'unclassified', 'billing', 'expiring', 'dormant', 'tickets', 'test',
];
const SORTS: AcademySortKey[] = ['created', 'name', 'students', 'active', 'trial'];

export default function AdminAcademiesPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'ko';
  const [sp, setSp] = useSearchParams();
  const initialFilter = (FILTERS as string[]).includes(sp.get('filter') ?? '') ? (sp.get('filter') as AcademyFilterKey) : 'all';
  const [input, setInput] = useState(sp.get('q') ?? '');
  const [query, setQuery] = useState(sp.get('q') ?? '');
  const [filter, setFilter] = useState<AcademyFilterKey>(initialFilter);
  const [sort, setSort] = useState<AcademySortKey>('created');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [excludeTest, setExcludeTest] = useState(true);
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // 검색어 입력은 0.3초 뒤에 반영
  useEffect(() => {
    const id = window.setTimeout(() => { setQuery(input.trim()); setPage(0); }, 300);
    return () => window.clearTimeout(id);
  }, [input]);
  // 주소와 조건을 맞춘다(오늘 할 일 카드에서 넘어오고, 새로 고침해도 유지)
  useEffect(() => {
    const next: Record<string, string> = {};
    if (filter !== 'all') next.filter = filter;
    if (query) next.q = query;
    setSp(next, { replace: true });
  }, [filter, query, setSp]);

  const result = useAdminQuery(
    () => adminAcademySearchV2({ query, filter, sort, dir, excludeTest: filter === 'test' ? false : excludeTest, page }),
    [query, filter, sort, dir, excludeTest, page],
  );
  const saved = useAdminQuery(() => listSavedFilters('academies'), [saveMsg]);

  const total = result.data?.[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / ACADEMY_PAGE_SIZE));
  const pageIds = useMemo(() => (result.data ?? []).map((r) => r.academy_id), [result.data]);
  const allOnPage = pageIds.length > 0 && pageIds.every((i) => picked.has(i));

  function toggle(id: string) {
    setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function togglePage() {
    setPicked((s) => { const n = new Set(s); pageIds.forEach((i) => (allOnPage ? n.delete(i) : n.add(i))); return n; });
  }
  async function saveCurrent() {
    if (!saveName.trim()) return;
    try {
      await saveFilter('academies', saveName, { query, filter, sort, dir, excludeTest });
      setSaveName('');
      setSaveMsg(t('adminV2.academies.savedOk'));
    } catch (e) {
      setSaveMsg(errorText(e));
    }
  }
  function applySaved(c: Record<string, unknown>) {
    setInput(String(c.query ?? ''));
    setQuery(String(c.query ?? ''));
    setFilter(((FILTERS as string[]).includes(String(c.filter)) ? c.filter : 'all') as AcademyFilterKey);
    setSort(((SORTS as string[]).includes(String(c.sort)) ? c.sort : 'created') as AcademySortKey);
    setDir(c.dir === 'asc' ? 'asc' : 'desc');
    setExcludeTest(c.excludeTest !== false);
    setPage(0);
  }
  const headBtn = (key: AcademySortKey, label: string) => (
    <button
      type="button"
      onClick={() => { if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDir('desc'); } setPage(0); }}
      className="inline-flex items-center gap-0.5 font-bold hover:text-primary"
      aria-label={t('adminV2.academies.sortBy', { name: label })}
    >
      {label}
      {sort === key && <span aria-hidden>{dir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  );

  return (
    <div className="space-y-5">
      <PageHead title={t('adminV2.academies.title')} desc={t('adminV2.academies.desc')} />

      <div className="space-y-3 rounded-xl border border-outline-variant bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-[16rem] flex-1">
            <span className="sr-only">{t('adminV2.academies.searchLabel')}</span>
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('adminV2.academies.searchPlaceholder')}
              className="w-full rounded-full border border-outline-variant bg-white px-4 py-2 font-body-md text-body-md outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </label>
          <label className="flex items-center gap-2 font-caption text-[13px] text-on-surface-variant">
            <input type="checkbox" checked={excludeTest} onChange={(e) => { setExcludeTest(e.target.checked); setPage(0); }} className="h-4 w-4 accent-primary" />
            {t('adminV2.academies.excludeTest')}
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('adminV2.academies.filterLabel')}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => { setFilter(f); setPage(0); }}
              className={`rounded-full px-3 py-1 font-label-md text-[13px] ${filter === f ? 'bg-primary font-bold text-white' : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'}`}
            >
              {t(`adminV2.academies.f_${f}`)}
            </button>
          ))}
        </div>
        <p className="font-caption text-[12px] text-on-surface-variant">{t(`adminV2.academies.fHint_${filter}`)}</p>

        <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/50 pt-3">
          <span className="font-label-md text-[13px] font-bold text-deep-navy">{t('adminV2.academies.savedTitle')}</span>
          {saved.data?.map((s) => (
            <span key={s.id} className="inline-flex items-center overflow-hidden rounded-full border border-outline-variant">
              <button type="button" onClick={() => applySaved(s.config)} className="px-3 py-1 font-label-md text-[13px] hover:bg-primary-fixed">{s.name}</button>
              <button type="button" aria-label={t('adminV2.academies.savedDelete', { name: s.name })} onClick={() => void deleteSavedFilter(s.id).then(() => setSaveMsg(t('adminV2.academies.savedDeleted')))} className="px-2 py-1 text-on-surface-variant hover:bg-error-container">×</button>
            </span>
          ))}
          {saved.status === 'error' && <span className="font-caption text-[12px] text-on-surface-variant">{t('adminV2.common.setupNeeded')}</span>}
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            maxLength={30}
            placeholder={t('adminV2.academies.savedName')}
            aria-label={t('adminV2.academies.savedName')}
            className="w-40 rounded-full border border-outline-variant px-3 py-1 font-body-md text-[13px]"
          />
          <button type="button" disabled={!saveName.trim()} onClick={() => void saveCurrent()} className="rounded-full border border-primary px-3 py-1 font-label-md text-[13px] font-bold text-primary disabled:opacity-40">
            {t('adminV2.academies.savedSave')}
          </button>
          {saveMsg && <span role="status" className="font-caption text-[12px] text-on-surface-variant">{saveMsg}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-label-md text-[15px] font-bold text-deep-navy" role="status">
          {result.status === 'loading' && !result.data ? t('adminV2.common.loading') : t('adminV2.academies.count', { n: total })}
        </div>
        <button type="button" onClick={() => setShowBulk((v) => !v)} aria-expanded={showBulk} className="rounded-full border border-primary px-4 py-1.5 font-label-md text-label-md font-bold text-primary hover:bg-primary-fixed">
          {showBulk ? t('adminV2.bulk.hide') : t('adminV2.bulk.show')}
        </button>
      </div>
      {showBulk && (
        <BulkFeaturesPanel query={query} filter={filter} excludeTest={filter === 'test' ? false : excludeTest} total={total} selectedIds={[...picked]} onDone={() => result.reload()} />
      )}

      <DataState state={result} empty={t('adminV2.academies.empty')}>
        {(rows) => (
          <div className="overflow-x-auto rounded-xl border border-outline-variant bg-white shadow-card">
            <table className="w-full min-w-[920px] text-left font-body-md text-[14px]">
              <caption className="sr-only">{t('adminV2.academies.title')}</caption>
              <thead className="bg-surface-container-low text-[13px] text-on-surface-variant">
                <tr>
                  <th scope="col" className="w-10 px-3 py-2">
                    <input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label={t('adminV2.academies.pickPage')} className="h-4 w-4 accent-primary" />
                  </th>
                  <th scope="col" className="px-3 py-2">{headBtn('name', t('adminV2.academies.colName'))}</th>
                  <th scope="col" className="px-3 py-2">{t('adminV2.academies.colOwner')}</th>
                  <th scope="col" className="px-3 py-2">{t('adminV2.academies.colEntitlement')}</th>
                  <th scope="col" className="px-3 py-2">{t('adminV2.academies.colSource')}</th>
                  <th scope="col" className="px-3 py-2">{t('adminV2.academies.colBilling')}</th>
                  <th scope="col" className="px-3 py-2 text-right">{headBtn('students', t('adminV2.academies.colStudents'))}</th>
                  <th scope="col" className="px-3 py-2">{headBtn('active', t('adminV2.academies.colActive'))}</th>
                  <th scope="col" className="px-3 py-2">{headBtn('created', t('adminV2.academies.colCreated'))}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.academy_id} className="border-t border-outline-variant/50 hover:bg-primary-fixed/30">
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={picked.has(r.academy_id)} onChange={() => toggle(r.academy_id)} aria-label={t('adminV2.academies.pickOne', { name: r.name })} className="h-4 w-4 accent-primary" />
                    </td>
                    <td className="max-w-[16rem] px-3 py-2">
                      <Link to={`/admin/academies/${r.academy_id}`} className="break-words font-bold text-deep-navy hover:text-primary hover:underline">{r.name}</Link>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {r.is_test && <Badge tone="info">{t('adminV2.detail.testBadge')}</Badge>}
                        {r.open_tickets > 0 && <Badge tone="warn">{t('adminV2.academies.openTickets', { n: r.open_tickets })}</Badge>}
                      </div>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2">
                      <div className="truncate">{r.owner_name ?? '–'}</div>
                      <div className="truncate font-caption text-[12px] text-on-surface-variant">{r.owner_email ?? '–'}</div>
                      <div className="font-caption text-[12px] text-on-surface-variant">{t('adminV2.academies.members', { owners: r.owner_count, teachers: r.teacher_count })}</div>
                    </td>
                    <td className="px-3 py-2">
                      <EntitlementBadge value={r.entitlement} />
                      {r.entitlement === 'trial' && r.trial_ends_at && <div className="mt-0.5 font-caption text-[12px] text-on-surface-variant">~{fmtKstDate(r.trial_ends_at, lang)}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <SourceBadge value={r.entitlement === 'full' ? r.source : null} />
                      {r.entitlement === 'full' && r.source !== 'subscription' && r.plan_expires_at && (
                        <div className="mt-0.5 font-caption text-[12px] text-on-surface-variant">~{fmtKstDate(r.plan_expires_at, lang)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2"><BillingBadge value={r.billing_state} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.student_count}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtKstDate(r.last_active_at, lang)}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtKstDate(r.created_at, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      {total > ACADEMY_PAGE_SIZE && (
        <nav aria-label={t('adminV2.academies.pager')} className="flex items-center justify-center gap-3">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-full border border-outline-variant px-4 py-1.5 font-label-md text-label-md disabled:opacity-40">{t('adminOps.prevPage')}</button>
          <span className="font-label-md text-label-md tabular-nums">{page + 1} / {pages}</span>
          <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded-full border border-outline-variant px-4 py-1.5 font-label-md text-label-md disabled:opacity-40">{t('adminOps.nextPage')}</button>
        </nav>
      )}
    </div>
  );
}
