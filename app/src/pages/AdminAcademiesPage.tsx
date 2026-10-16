import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ADMIN_PAGE_SIZE, adminAcademySearch, adminTotals, type AdminAcademyFilter, type AdminSearchRow, type AdminTotals } from '../lib/support';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import {
  adminAcademiesFeaturesFor,
  adminSetAcademyFeatures,
  adminSetAcademyPlan,
  adminSetFeaturesBulk,
  changeMyPassword,
  deleteAcademyAsAdmin,
  type AcademyFeatures,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import i18n from '../i18n';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-US' : 'ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function AdminAcademiesPage() {
  const { t } = useTranslation();
  const { notify, run } = useToast();
  const { academy: myAcademy } = useAuth();
  const [rows, setRows] = useState<AdminSearchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totals, setTotals] = useState<AdminTotals | null>(null);
  /** 학원별 기능 열기·닫기(075 전이면 비어 있고 칸을 숨긴다) */
  const [feat, setFeat] = useState<Map<string, AcademyFeatures>>(new Map());
  const loadFeat = useCallback((ids: string[]) => {
    adminAcademiesFeaturesFor(ids)
      .then(setFeat)
      .catch(() => setFeat(new Map()));
  }, []);
  async function toggleFeat(academyId: string, key: keyof AcademyFeatures) {
    const cur = feat.get(academyId);
    if (!cur) return;
    const next = { ...cur, [key]: !cur[key] };
    setFeat((m) => new Map(m).set(academyId, next));
    try {
      await adminSetAcademyFeatures(academyId, next);
    } catch (err) {
      setFeat((m) => new Map(m).set(academyId, cur));
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  }
  async function bulk(open: boolean) {
    const msg = open ? t('admin.featBulkOpenConfirm') : t('admin.featBulkCloseConfirm');
    if (!confirm(msg)) return;
    try {
      const n = await adminSetFeaturesBulk(open, open, myAcademy?.id ?? null);
      notify(t('admin.featBulkDone', { count: n }));
      loadFeat(rows.map((r) => r.academy_id));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  }
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [untilDrafts, setUntilDrafts] = useState<Record<string, string>>({});
  // 검색·필터(오늘 할 일에서 ?filter=billing|new|paid 로 들어올 수 있다)
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<AdminAcademyFilter>((params.get('filter') as AdminAcademyFilter) ?? 'all');

  useEffect(() => {
    const h = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(h);
  }, [query]);
  useEffect(() => {
    setPage(0);
  }, [debounced, filter]);
  useEffect(() => {
    void adminTotals().then(setTotals);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminAcademySearch(debounced, filter, page);
      setRows(list);
      setTotal(list[0]?.total ?? 0);
      loadFeat(list.map((r) => r.academy_id));
    } catch (err) {
      notify(err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err), 'error');
    } finally {
      setLoading(false);
    }
  }, [debounced, filter, page, notify, loadFeat]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = rows;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  async function handlePlanToggle(row: AdminSearchRow) {
    const nextPlan = row.plan === 'paid' ? 'free' : 'paid';
    const until = nextPlan === 'paid' ? (untilDrafts[row.academy_id] || null) : null;
    setBusyId(row.academy_id);
    const ok = await run(
      () => adminSetAcademyPlan(row.academy_id, nextPlan, until),
      nextPlan === 'paid' ? t('admin.setPaidToast', { name: row.name }) : t('admin.setFreeToast', { name: row.name }),
    );
    setBusyId(null);
    if (ok) {
      setRows((prev) =>
        prev.map((r) => (r.academy_id === row.academy_id ? { ...r, plan: nextPlan, plan_expires_at: until } : r)),
      );
      setUntilDrafts((prev) => ({ ...prev, [row.academy_id]: '' }));
    }
  }

  async function handleDelete(row: AdminSearchRow) {
    const typed = prompt(t('admin.deleteConfirmPrompt', { name: row.name }));
    if (typed !== row.name) {
      if (typed !== null) notify(t('admin.deleteMismatch'), 'error');
      return;
    }
    setBusyId(row.academy_id);
    const ok = await run(
      () => deleteAcademyAsAdmin(row.academy_id),
      t('admin.deletedToast', { name: row.name }),
    );
    setBusyId(null);
    if (ok) setRows((prev) => prev.filter((r) => r.academy_id !== row.academy_id));
  }

  async function handleChangePassword() {
    if (newPassword.length < 12 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      notify(t('admin.passwordTooShort'), 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify(t('admin.passwordMismatch'), 'error');
      return;
    }
    setPwBusy(true);
    const ok = await run(() => changeMyPassword(newPassword), t('admin.passwordChangedToast'));
    setPwBusy(false);
    if (ok) {
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('admin.pageTitle')}
      </h2>

      {(
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-card">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('admin.statAcademies')}</div>
              <div className="font-display-lg text-[28px] text-on-surface">{totals?.academies ?? '–'}</div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-card">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('admin.statTeachers')}</div>
              <div className="font-display-lg text-[28px] text-on-surface">{totals?.teachers ?? '–'}</div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-card">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('admin.statStudents')}</div>
              <div className="font-display-lg text-[28px] text-on-surface">{totals?.students ?? '–'}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('adminOps.searchAcademy')}
              className="min-w-[220px] flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {['all', 'paid', 'free', 'new', 'billing', 'dormant'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f as AdminAcademyFilter)}
                className={`rounded-full px-3 py-1.5 font-label-md text-label-md ${filter === f ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'}`}
              >
                {t(`adminOps.filter_${f}`)}
              </button>
            ))}
            <span className="font-caption text-caption text-on-surface-variant">{loading ? t('common.loading') : t('adminOps.shownCount', { n: total })}</span>
          </div>
          {feat.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-lowest px-4 py-3 shadow-card">
              <span className="font-label-md text-label-md font-bold text-on-surface">{t('admin.featBulkTitle')}</span>
              <button type="button" onClick={() => void bulk(false)} className="rounded-full border border-error px-3 py-1 font-label-md text-label-md text-error hover:bg-error/5">
                {t('admin.featBulkClose')}
              </button>
              <button type="button" onClick={() => void bulk(true)} className="rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary hover:bg-primary/5">
                {t('admin.featBulkOpen')}
              </button>
              <span className="font-caption text-caption text-on-surface-variant">{t('admin.featBulkHint')}</span>
            </div>
          )}
          <div className="bg-surface-container-lowest rounded-xl shadow-card overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="font-caption text-caption text-on-surface-variant border-b border-surface-container">
                  <th className="px-4 md:px-6 py-3 font-medium">{t('admin.colName')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colUnit')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colOwner')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colTeacher')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colStudent')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colJoinedAt')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.colPlan')}</th>
                  {feat.size > 0 && <th className="px-4 py-3 font-medium">{t('admin.colFeatures')}</th>}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.academy_id} className="border-b border-surface-container last:border-0">
                    <td className="px-4 md:px-6 py-3 font-label-md text-label-md text-on-surface whitespace-nowrap">
                      <Link to={`/admin/academies/${r.academy_id}`} className="text-primary hover:underline">
                        {r.name}
                      </Link>
                      <div className="font-caption text-caption text-on-surface-variant">
                        {r.owner_email ?? ''}
                        {r.last_active_at ? ` · ${t('adminOps.lastActive', { date: new Date(r.last_active_at).toLocaleDateString() })}` : ''}
                        {r.billing_failure_count > 0 ? ` · ⚠ ${t('adminOps.failures', { n: r.billing_failure_count })}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.point_unit}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.owner_count}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.teacher_count}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.student_count}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant whitespace-nowrap">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 font-caption text-caption ${
                            r.plan === 'paid'
                              ? 'bg-primary-container text-on-primary-container'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {r.plan === 'paid' ? t('admin.planPaid') : t('admin.planFree')}
                        </span>
                        {r.plan === 'paid' && (
                          <span className="font-caption text-caption text-on-surface-variant">
                            {r.plan_expires_at ? t('admin.planUntil', { date: fmtDate(r.plan_expires_at) }) : t('admin.planNoExpiry')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        {r.plan !== 'paid' && (
                          <input
                            type="date"
                            value={untilDrafts[r.academy_id] ?? ''}
                            onChange={(e) =>
                              setUntilDrafts((prev) => ({ ...prev, [r.academy_id]: e.target.value }))
                            }
                            title={t('admin.planUntilInputHint')}
                            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 font-caption text-caption text-on-surface outline-none focus:border-primary"
                          />
                        )}
                        <button
                          type="button"
                          disabled={busyId === r.academy_id}
                          onClick={() => void handlePlanToggle(r)}
                          className="font-label-md text-label-md text-primary hover:underline disabled:opacity-50"
                        >
                          {r.plan === 'paid' ? t('admin.setFreeButton') : t('admin.setPaidButton')}
                        </button>
                      </div>
                    </td>
                    {feat.size > 0 && (
                      <td className="px-4 py-3">
                        {feat.get(r.academy_id) ? (
                          <div className="flex gap-1.5">
                            {([['group', 'featShortGroup'], ['solo', 'featShortSolo'], ['homework', 'featShortHomework']] as const).map(([k, label]) => {
                              const on = feat.get(r.academy_id)![k];
                              return (
                                <button
                                  key={k}
                                  type="button"
                                  role="switch"
                                  aria-checked={on}
                                  title={t(`adminOps.feature_${k}`)}
                                  onClick={() => void toggleFeat(r.academy_id, k)}
                                  className={`rounded-full px-2.5 py-1 font-label-md text-label-md transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant line-through'}`}
                                >
                                  {t(`admin.${label}`)}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-on-surface-variant">–</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <button
                        disabled={busyId === r.academy_id}
                        onClick={() => void handleDelete(r)}
                        className="font-label-md text-label-md text-error hover:underline disabled:opacity-50"
                      >
                        {t('admin.deleteButton')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-full border border-outline-variant px-4 py-1.5 font-label-md text-label-md disabled:opacity-40"
            >
              {t('adminOps.prevPage')}
            </button>
            <span className="font-caption text-caption tabular-nums text-on-surface-variant">
              {page + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page + 1 >= pageCount || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-outline-variant px-4 py-1.5 font-label-md text-label-md disabled:opacity-40"
            >
              {t('adminOps.nextPage')}
            </button>
          </div>
        </>
      )}

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-card max-w-[420px] space-y-4">
        <h4 className="font-title-md text-title-md text-on-surface">{t('admin.changePasswordTitle')}</h4>
        <div>
          <label htmlFor="new-pw" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
            {t('admin.newPasswordLabel')}
          </label>
          <input
            id="new-pw"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('admin.newPasswordPlaceholder')}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label htmlFor="confirm-pw" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
            {t('admin.confirmPasswordLabel')}
          </label>
          <input
            id="confirm-pw"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <button
          disabled={pwBusy}
          onClick={() => void handleChangePassword()}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 hover:bg-primary-container transition-colors"
        >
          {pwBusy ? t('admin.changingPassword') : t('admin.changePasswordButton')}
        </button>
      </div>
    </div>
  );
}
