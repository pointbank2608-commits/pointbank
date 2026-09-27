import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminAcademyRows, type AdminAcademyRow as OpsRow } from '../lib/support';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { adminSetAcademyPlan, changeMyPassword, deleteAcademyAsAdmin, fetchAdminAcademies } from '../lib/api';
import i18n from '../i18n';
import type { AdminAcademyRow } from '../lib/types';

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
  const [rows, setRows] = useState<AdminAcademyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [untilDrafts, setUntilDrafts] = useState<Record<string, string>>({});
  // 검색·필터(오늘 할 일에서 ?filter=billing|new|paid 로 들어올 수 있다)
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>(params.get('filter') ?? 'all');
  const [ops, setOps] = useState<Map<string, OpsRow>>(new Map());
  useEffect(() => {
    adminAcademyRows()
      .then((r) => setOps(new Map(r.map((x) => [x.academy_id, x]))))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAdminAcademies());
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return rows.filter((r) => {
      const o = ops.get(r.academy_id);
      if (q && !(r.name.toLowerCase().includes(q) || (o?.owner_email ?? '').toLowerCase().includes(q) || (o?.owner_name ?? '').toLowerCase().includes(q))) return false;
      if (filter === 'paid') return r.plan === 'paid';
      if (filter === 'free') return r.plan !== 'paid';
      if (filter === 'new') return now - Date.parse(r.created_at) <= 7 * 86_400_000;
      if (filter === 'billing')
        return !!o && (o.billing_failure_count > 0 || o.plan_status === 'pending_cancel' || (o.plan === 'paid' && !!o.plan_expires_at && Date.parse(o.plan_expires_at) - now <= 7 * 86_400_000));
      if (filter === 'dormant') return !o?.last_active_at || now - Date.parse(o.last_active_at) > 14 * 86_400_000;
      return true;
    });
  }, [rows, ops, query, filter]);

  async function handlePlanToggle(row: AdminAcademyRow) {
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

  async function handleDelete(row: AdminAcademyRow) {
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
    if (newPassword.length < 6) {
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

  const totals = rows.reduce(
    (acc, r) => ({
      academies: acc.academies + 1,
      teachers: acc.teachers + r.owner_count + r.teacher_count,
      students: acc.students + r.student_count,
    }),
    { academies: 0, teachers: 0, students: 0 },
  );

  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('admin.pageTitle')}
      </h2>

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('admin.emptyAcademies')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('admin.statAcademies')}</div>
              <div className="font-display-lg text-[28px] text-on-surface">{totals.academies}</div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('admin.statTeachers')}</div>
              <div className="font-display-lg text-[28px] text-on-surface">{totals.teachers}</div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">{t('admin.statStudents')}</div>
              <div className="font-display-lg text-[28px] text-on-surface">{totals.students}</div>
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
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 font-label-md text-label-md ${filter === f ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'}`}
              >
                {t(`adminOps.filter_${f}`)}
              </button>
            ))}
            <span className="font-caption text-caption text-on-surface-variant">{t('adminOps.shownCount', { n: shown.length })}</span>
          </div>
          <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-x-auto">
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
                        {ops.get(r.academy_id)?.owner_email ?? ''}
                        {ops.get(r.academy_id)?.last_active_at
                          ? ` · ${t('adminOps.lastActive', { date: new Date(ops.get(r.academy_id)!.last_active_at!).toLocaleDateString() })}`
                          : ''}
                        {(ops.get(r.academy_id)?.billing_failure_count ?? 0) > 0 ? ` · ⚠ ${t('adminOps.failures', { n: ops.get(r.academy_id)!.billing_failure_count })}` : ''}
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
        </>
      )}

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] max-w-[420px] space-y-4">
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
