import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cancelBilling, fetchBillingHistory, fetchStudentsOfAcademy, registerBillingKey } from '../lib/api';
import { BASE_FEE_KRW } from '../lib/planLimits';
import { issueBillingKey } from '../lib/portone';
import type { BillingHistoryRow } from '../lib/types';

function formatKrw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BillingPage() {
  const { t } = useTranslation();
  const { academy, profile, isPaid, refresh } = useAuth();
  const { notify, run } = useToast();
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [history, setHistory] = useState<BillingHistoryRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!academy?.id) return;
    try {
      const [students, rows] = await Promise.all([
        fetchStudentsOfAcademy(academy.id),
        fetchBillingHistory(academy.id),
      ]);
      setStudentCount(students.length);
      setHistory(rows);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  }, [academy?.id, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOwner = profile?.role === 'owner';

  async function handleRegisterCard() {
    if (!academy) return;
    setBusy(true);
    const ok = await run(async () => {
      const billingKey = await issueBillingKey(academy.name);
      await registerBillingKey(billingKey);
    }, t('billing.cardRegisteredToast'));
    setBusy(false);
    if (ok) {
      await refresh();
      await load();
    }
  }

  async function handleCancel() {
    if (!confirm(t('billing.cancelConfirm'))) return;
    const ok = await run(() => cancelBilling('cancel'), t('billing.cancelScheduledToast'));
    if (ok) await refresh();
  }

  async function handleResume() {
    const ok = await run(() => cancelBilling('resume'), t('billing.resumeToast'));
    if (ok) await refresh();
  }

  if (!isOwner) {
    return (
      <div className="text-center py-16 font-body-md text-on-surface-variant">{t('billing.ownerOnly')}</div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        {t('billing.backToSettings')}
      </Link>

      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('settings.billingTitle')}
      </h2>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-title-md text-title-md text-on-surface">{t('billing.currentPlanTitle')}</h4>
          <span
            className={`shrink-0 rounded-full px-3 py-1 font-label-md text-label-md ${
              isPaid ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {isPaid ? t('settings.planPaidBadge') : t('settings.planFreeBadge')}
          </span>
        </div>

        {studentCount !== null && (
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t('billing.studentCountLabel', { count: studentCount })}
          </p>
        )}

        {isPaid ? (
          <div className="space-y-2 font-body-md text-body-md text-on-surface-variant">
            {academy?.card_brand && academy?.card_last4 && (
              <p>{t('billing.cardOnFile', { brand: academy.card_brand, last4: academy.card_last4 })}</p>
            )}
            {academy?.next_billing_at && (
              <p>{t('billing.nextBillingDate', { date: formatDate(academy.next_billing_at) })}</p>
            )}
            <p>{t('billing.estimatedAmount', { amount: formatKrw(BASE_FEE_KRW) })}</p>
          </div>
        ) : (
          <div className="space-y-2 font-body-md text-body-md text-on-surface-variant">
            <p>{t('billing.freePlanPitch', { base: formatKrw(BASE_FEE_KRW) })}</p>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-tertiary-container/40 px-3 py-2.5 font-caption text-caption text-on-surface">
          <span aria-hidden="true">⚠️</span>
          <span>{t('billing.bcCardNotice')}</span>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => void handleRegisterCard()}
            disabled={busy}
            className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 hover:bg-primary-container transition-colors"
          >
            {isPaid ? t('billing.changeCardButton') : t('billing.registerCardButton')}
          </button>

          {isPaid && academy?.plan_status === 'active' && (
            <button
              type="button"
              onClick={() => void handleCancel()}
              className="px-5 py-2.5 rounded-lg font-label-md text-label-md text-error hover:bg-surface-container-low transition-colors"
            >
              {t('billing.cancelButton')}
            </button>
          )}
          {isPaid && academy?.plan_status === 'pending_cancel' && (
            <button
              type="button"
              onClick={() => void handleResume()}
              className="px-5 py-2.5 rounded-lg font-label-md text-label-md text-primary hover:bg-surface-container-low transition-colors"
            >
              {t('billing.resumeButton')}
            </button>
          )}
        </div>
        {isPaid && academy?.plan_status === 'pending_cancel' && (
          <p className="font-caption text-caption text-error">{t('billing.pendingCancelNotice')}</p>
        )}
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
        <h4 className="mb-3 font-title-md text-title-md text-on-surface">{t('billing.historyTitle')}</h4>
        {history.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">{t('billing.historyEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/60 text-on-surface-variant">
                  <th className="py-2 pr-4 font-label-md text-label-md">{t('billing.colDate')}</th>
                  <th className="py-2 pr-4 font-label-md text-label-md">{t('billing.colStudents')}</th>
                  <th className="py-2 pr-4 font-label-md text-label-md">{t('billing.colAmount')}</th>
                  <th className="py-2 pr-4 font-label-md text-label-md">{t('billing.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-outline-variant/30">
                    <td className="py-2 pr-4">{formatDate(row.billed_at)}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.student_count}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatKrw(row.amount_krw)}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 font-caption text-caption ${
                          row.status === 'success'
                            ? 'bg-primary-container text-on-primary-container'
                            : 'bg-error-container text-on-error-container'
                        }`}
                      >
                        {row.status === 'success' ? t('billing.statusSuccess') : t('billing.statusFailed')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
