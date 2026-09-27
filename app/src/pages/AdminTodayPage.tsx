import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { adminAcademyRows, adminTickets, adminToday, type AdminAcademyRow, type AdminTicketRow, type AdminToday } from '../lib/support';
import { StatusPill } from './HelpPage';

/**
 * 관리자 "오늘 할 일"(2026-09-27) — 혼자 운영하려면 모든 학원을 훑는 게 아니라 손봐야 할 것만 먼저.
 * 새 문의 · 결제 문제(실패·해지 예정·곧 만료) · 새 학원 · 오래 안 들어온 유료 학원.
 */
export default function AdminTodayPage() {
  const { t } = useTranslation();
  const [today, setToday] = useState<AdminToday | null>(null);
  const [rows, setRows] = useState<AdminAcademyRow[]>([]);
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([adminToday(), adminAcademyRows(), adminTickets('open')])
      .then(([td, r, tk]) => {
        setToday(td);
        setRows(r);
        setTickets(tk);
      })
      .catch((e) => {
        const msg = String((e as { message?: string })?.message ?? e);
        setError(/admin_today|function/i.test(msg) ? t('adminOps.needSetup') : msg);
      });
  }, [t]);

  const now = Date.now();
  const billing = rows.filter(
    (r) =>
      r.billing_failure_count > 0 ||
      r.plan_status === 'pending_cancel' ||
      (r.plan === 'paid' && r.plan_expires_at && Date.parse(r.plan_expires_at) - now <= 7 * 86_400_000),
  );
  const fresh = rows.filter((r) => now - Date.parse(r.created_at) <= 7 * 86_400_000);
  const dormantPaid = rows.filter((r) => r.plan === 'paid' && (!r.last_active_at || now - Date.parse(r.last_active_at) > 14 * 86_400_000));

  const card = (label: string, value: number | undefined, to: string, alert = false) => (
    <Link
      to={to}
      className={`rounded-xl p-4 shadow-sm transition-transform hover:-translate-y-0.5 ${alert && value ? 'bg-error-container/50 ring-1 ring-error/40' : 'bg-surface-container-lowest'}`}
    >
      <div className="font-caption text-caption text-on-surface-variant">{label}</div>
      <div className="text-[28px] font-bold tabular-nums text-on-surface">{value ?? '–'}</div>
    </Link>
  );

  return (
    <div className="space-y-6">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">{t('adminOps.todayTitle')}</h1>
      {error && <p className="rounded-xl bg-error-container p-4 text-on-error-container">{error}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {card(t('adminOps.newTickets'), today?.new_tickets, '/admin/support', true)}
        {card(t('adminOps.billingIssues'), billing.length, '/admin/academies?filter=billing', true)}
        {card(t('adminOps.signupsToday'), today?.signups_today, '/admin/academies?filter=new')}
        {card(t('adminOps.paidCount'), today?.paid, '/admin/academies?filter=paid')}
        {card(t('adminOps.active7d'), today?.active_7d, '/admin/academies')}
      </div>
      <p className="font-caption text-caption text-on-surface-variant">
        {t('adminOps.summary', { academies: today?.academies ?? 0, signups7d: today?.signups_7d ?? 0 })}
      </p>

      <Section title={t('adminOps.waitingTickets')} empty={t('adminOps.noneNow')} count={tickets.length}>
        {tickets.slice(0, 8).map((tk) => (
          <Link key={tk.id} to={`/admin/support?ticket=${tk.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-container-low">
            <StatusPill status={tk.status} />
            <span className="min-w-0 flex-1 truncate font-label-md text-label-md">{tk.subject}</span>
            <span className="shrink-0 font-caption text-caption text-on-surface-variant">{tk.academy_name}</span>
          </Link>
        ))}
      </Section>

      <Section title={t('adminOps.billingTitle')} empty={t('adminOps.noneNow')} count={billing.length}>
        {billing.map((r) => (
          <AcademyLine key={r.academy_id} row={r}>
            {r.billing_failure_count > 0
              ? t('adminOps.failures', { n: r.billing_failure_count })
              : r.plan_status === 'pending_cancel'
                ? t('adminOps.pendingCancel')
                : t('adminOps.expiresOn', { date: r.plan_expires_at })}
          </AcademyLine>
        ))}
      </Section>

      <Section title={t('adminOps.newAcademies')} empty={t('adminOps.noneNow')} count={fresh.length}>
        {fresh.map((r) => (
          <AcademyLine key={r.academy_id} row={r}>
            {t('adminOps.newLine', { students: r.student_count, lessons: r.lesson_count })}
          </AcademyLine>
        ))}
      </Section>

      <Section title={t('adminOps.dormantPaid')} empty={t('adminOps.noneNow')} count={dormantPaid.length}>
        {dormantPaid.map((r) => (
          <AcademyLine key={r.academy_id} row={r}>
            {r.last_active_at ? t('adminOps.lastActive', { date: new Date(r.last_active_at).toLocaleDateString() }) : t('adminOps.neverActive')}
          </AcademyLine>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-title-md text-title-md text-deep-navy">{title}</h2>
        <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption tabular-nums">{count}</span>
      </div>
      {count === 0 ? <p className="font-caption text-caption text-on-surface-variant">{empty}</p> : <div className="space-y-0.5">{children}</div>}
    </section>
  );
}

function AcademyLine({ row, children }: { row: AdminAcademyRow; children: React.ReactNode }) {
  return (
    <Link to={`/admin/academies/${row.academy_id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-container-low">
      <span className="min-w-0 flex-1 truncate font-label-md text-label-md">{row.name}</span>
      <span className="shrink-0 font-caption text-caption text-on-surface-variant">{children}</span>
    </Link>
  );
}
