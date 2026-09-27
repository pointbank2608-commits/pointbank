import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { adminSetAcademyPlan } from '../lib/api';
import { adminAcademyDetail, adminLog, adminSaveNote, type AdminAcademyDetail } from '../lib/support';
import { StatusPill } from './HelpPage';

/**
 * 관리자 학원 상세(2026-09-27) — 원장·선생님 연락처, 사용량, 결제, 관리자 메모(학원은 못 봄), 요금제 조치,
 * 문의, 조치 기록을 한 화면에. 요금제를 바꾸면 조치 기록(admin_actions)에 남는다.
 */
export default function AdminAcademyDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [d, setD] = useState<AdminAcademyDetail | null>(null);
  const [note, setNote] = useState('');
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    adminAcademyDetail(id)
      .then((x) => {
        setD(x);
        setNote(x?.note ?? '');
      })
      .catch((e) => setMsg(String((e as { message?: string })?.message ?? e)));
  }, [id]);
  useEffect(load, [load]);

  async function setPlan(plan: 'free' | 'paid', untilDate: string | null) {
    if (!d) return;
    setBusy(true);
    try {
      await adminSetAcademyPlan(id, plan, untilDate);
      await adminLog(id, plan === 'paid' ? 'set_paid' : 'set_free', { until: untilDate });
      setMsg(t('adminOps.saved'));
      load();
    } catch (e) {
      setMsg(String((e as { message?: string })?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function extend30() {
    const base = d?.academy.plan_expires_at ? new Date(d.academy.plan_expires_at) : new Date();
    const next = new Date(Math.max(base.getTime(), Date.now()) + 30 * 86_400_000);
    void setPlan('paid', next.toISOString().slice(0, 10));
  }

  async function saveNote() {
    setBusy(true);
    try {
      await adminSaveNote(id, note);
      setMsg(t('adminOps.saved'));
    } finally {
      setBusy(false);
    }
  }

  if (!d) return <p className="text-on-surface-variant">{msg ?? t('common.loading')}</p>;
  const a = d.academy;
  const box = 'rounded-xl bg-surface-container-lowest p-4 shadow-sm space-y-2';

  return (
    <div className="space-y-5">
      <Link to="/admin/academies" className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {t('adminOps.academies')}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">{a.name}</h1>
        <span className={`rounded-full px-3 py-1 font-label-md text-label-md ${a.plan === 'paid' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface-variant'}`}>
          {a.plan === 'paid' ? t('admin.planPaid') : t('admin.planFree')}
        </span>
        {a.billing_failure_count > 0 && (
          <span className="rounded-full bg-error px-3 py-1 font-label-md text-label-md text-on-error">{t('adminOps.failures', { n: a.billing_failure_count })}</span>
        )}
        {msg && <span className="font-caption text-caption text-primary">{msg}</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={box}>
          <h2 className="font-title-md text-title-md">{t('adminOps.people')}</h2>
          {d.members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 font-body-sm text-body-sm">
              <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption">{m.role === 'owner' ? t('adminOps.owner') : t('adminOps.teacher')}</span>
              <span className="font-bold">{m.display_name}</span>
              <a href={`mailto:${m.email}`} className="text-primary hover:underline">
                {m.email}
              </a>
              <span className="text-on-surface-variant">
                {m.last_sign_in_at ? t('adminOps.lastActive', { date: new Date(m.last_sign_in_at).toLocaleDateString() }) : t('adminOps.neverActive')}
              </span>
            </div>
          ))}
          <div className="font-caption text-caption text-on-surface-variant">
            {t('adminOps.joined', { date: new Date(a.created_at).toLocaleDateString() })} · {t('adminOps.inviteCode')} {a.invite_code}
          </div>
        </section>

        <section className={box}>
          <h2 className="font-title-md text-title-md">{t('adminOps.usage')}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-body-sm text-body-sm">
            {Object.entries(d.usage).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-on-surface-variant">{t(`adminOps.usage_${k}`)}</span>
                <span className="font-bold tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={box}>
          <h2 className="font-title-md text-title-md">{t('adminOps.billing')}</h2>
          <div className="space-y-1 font-body-sm text-body-sm text-on-surface-variant">
            <div>{t('adminOps.expires', { date: a.plan_expires_at ?? '–' })}</div>
            <div>{t('adminOps.nextBilling', { date: a.next_billing_at ?? '–' })}</div>
            <div>{a.card_last4 ? t('adminOps.card', { brand: a.card_brand ?? '', last4: a.card_last4 }) : t('adminOps.noCard')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" disabled={busy} onClick={extend30} className="rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-50">
              {t('adminOps.extend30')}
            </button>
            <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="rounded-lg border border-outline-variant px-2 py-1 text-sm" />
            <button type="button" disabled={busy || !until} onClick={() => void setPlan('paid', until)} className="rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary disabled:opacity-40">
              {t('adminOps.paidUntil')}
            </button>
            {a.plan === 'paid' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => confirm(t('adminOps.toFreeConfirm')) && void setPlan('free', null)}
                className="rounded-full border border-error px-3 py-1 font-label-md text-label-md text-error disabled:opacity-40"
              >
                {t('admin.setFreeButton')}
              </button>
            )}
          </div>
        </section>

        <section className={box}>
          <h2 className="font-title-md text-title-md">{t('adminOps.note')}</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder={t('adminOps.notePlaceholder')}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button type="button" disabled={busy} onClick={() => void saveNote()} className="rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-50">
            {t('common.save')}
          </button>
        </section>

        <section className={box}>
          <h2 className="font-title-md text-title-md">{t('adminOps.tickets')}</h2>
          {d.tickets.length === 0 && <p className="font-caption text-caption text-on-surface-variant">{t('adminOps.noneNow')}</p>}
          {d.tickets.map((tk) => (
            <Link key={tk.id} to={`/admin/support?ticket=${tk.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low">
              <StatusPill status={tk.status} />
              <span className="min-w-0 flex-1 truncate font-body-sm text-body-sm">{tk.subject}</span>
            </Link>
          ))}
        </section>

        <section className={box}>
          <h2 className="font-title-md text-title-md">{t('adminOps.actions')}</h2>
          {d.actions.length === 0 && <p className="font-caption text-caption text-on-surface-variant">{t('adminOps.noneNow')}</p>}
          {d.actions.map((x, i) => (
            <div key={i} className="flex gap-2 font-caption text-caption text-on-surface-variant">
              <span>{new Date(x.created_at).toLocaleString()}</span>
              <span className="font-bold text-on-surface">{t(`adminOps.action_${x.action}`, { defaultValue: x.action })}</span>
              {x.detail && Object.keys(x.detail).length > 0 && <span>{JSON.stringify(x.detail)}</span>}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
