import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { changeMyPassword, deleteAcademyAsAdmin, fetchAdminAcademies } from '../lib/api';
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
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.academy_id} className="border-b border-surface-container last:border-0">
                    <td className="px-4 md:px-6 py-3 font-label-md text-label-md text-on-surface whitespace-nowrap">
                      {r.name}
                    </td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.point_unit}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.owner_count}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.teacher_count}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.student_count}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant whitespace-nowrap">
                      {fmtDate(r.created_at)}
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
