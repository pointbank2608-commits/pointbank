import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge, DataState, PageHead, ReasonDialog, StatCard } from '../components/admin/AdminUi';
import { IssueStatusBadge } from '../components/admin/labels';
import {
  adminIssueList, adminIssueSet, adminIssuesSync, adminOverview, adminPurgeDeletionsSafe, fmtKst, fmtWait, useAdminQuery,
  type AdminIssue,
} from '../lib/adminOps';

/**
 * 관리자 "오늘 할 일"(2026-10-18) — 위쪽은 지금 처리해야 하는 문제(우선순위순), 아래쪽은 가입·활동·구독 지표(처리할 일이 아니다).
 * 문제 우선순위: 1 수업 진행을 막는 장애 → 2 결제·계정 상태 이상 → 3 응답 기한 지난 문의·확인할 오류 → 4 실패한 자동 작업 → 5 확인이 필요한 신규·체험 계정.
 */
function issueHref(i: AdminIssue): string {
  switch (i.kind) {
    case 'error': return '/admin/system#errors';
    case 'billing': return i.ref.academy_id ? `/admin/academies/${i.ref.academy_id}` : '/admin/billing';
    case 'ticket': return i.ref.ticket_id ? `/admin/support?ticket=${i.ref.ticket_id}` : '/admin/support';
    case 'job': return '/admin/system#jobs';
    case 'account': return '/admin/academies?filter=unclassified';
    default: return '/admin/academies?filter=trial';
  }
}

export default function AdminTodayPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'ko';
  const [showResolved, setShowResolved] = useState(false);
  const [excludeTest, setExcludeTest] = useState(true);
  const [resolving, setResolving] = useState<AdminIssue | null>(null);

  const issues = useAdminQuery(async () => {
    void adminPurgeDeletionsSafe();
    await adminIssuesSync();
    return adminIssueList(true);
  }, []);
  const stats = useAdminQuery(() => adminOverview(excludeTest), [excludeTest]);

  const asof = stats.data?.asof ? fmtKst(stats.data.asof, lang) : '';

  async function ack(i: AdminIssue) {
    await adminIssueSet(i.id, 'acknowledged', null);
    issues.reload();
  }
  async function reopen(i: AdminIssue) {
    await adminIssueSet(i.id, 'open', null);
    issues.reload();
  }

  const row = (i: AdminIssue) => (
    <li key={i.id} className="rounded-xl border border-outline-variant bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start gap-3">
        <Badge tone={i.severity === 1 ? 'bad' : i.severity <= 3 ? 'warn' : 'mute'} title={t(`adminV2.issue.sev_${i.severity}_desc`)}>
          {t(`adminV2.issue.sev_${i.severity}`)}
        </Badge>
        <div className="min-w-[14rem] flex-1">
          <div className="break-words font-label-md text-[16px] font-bold text-deep-navy">{i.title}</div>
          {i.summary && <div className="mt-0.5 break-words font-caption text-[13px] text-on-surface-variant">{i.summary}</div>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-caption text-[12px] text-on-surface-variant">
            {(i.academies_affected > 0 || i.users_affected > 0) && (
              <span>{t('adminV2.issue.impact', { academies: i.academies_affected, users: i.users_affected })}</span>
            )}
            <span>{t('adminV2.issue.firstSeen')} {fmtKst(i.first_seen, lang)}</span>
            <span>{t('adminV2.issue.lastSeen')} {fmtKst(i.last_seen, lang)}</span>
            <span className="font-bold text-deep-navy">{t('adminV2.issue.waiting')} {fmtWait(i.wait_minutes, lang)}</span>
            {i.recurrence_count > 0 && <span className="font-bold text-error">{t('adminV2.issue.recurCount', { n: i.recurrence_count })}</span>}
          </div>
          {i.status === 'resolved' && (
            <div className="mt-1.5 font-caption text-[12px] text-on-surface-variant">
              {i.auto_resolved ? t('adminV2.issue.autoResolved') : t('adminV2.issue.resolvedNote')}
              {i.resolution_note && !i.auto_resolved ? `: ${i.resolution_note}` : ''} · {fmtKst(i.resolved_at, lang)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <IssueStatusBadge value={i.status} recurred={i.recurrence_count > 0 && i.status === 'open'} />
          <div className="flex flex-wrap justify-end gap-1.5">
            <Link to={issueHref(i)} className="rounded-full border border-primary px-3 py-1 font-label-md text-[13px] font-bold text-primary hover:bg-primary-fixed">
              {t('adminV2.issue.open')}
            </Link>
            {i.status === 'open' && (
              <button type="button" onClick={() => void ack(i)} className="rounded-full border border-outline-variant px-3 py-1 font-label-md text-[13px] text-on-surface-variant hover:bg-surface-container-low">
                {t('adminV2.issue.ack')}
              </button>
            )}
            {i.status !== 'resolved' && (
              <button type="button" onClick={() => setResolving(i)} className="rounded-full bg-primary px-3 py-1 font-label-md text-[13px] font-bold text-white hover:bg-primary-container">
                {t('adminV2.issue.resolve')}
              </button>
            )}
            {i.status === 'resolved' && (
              <button type="button" onClick={() => void reopen(i)} className="rounded-full border border-outline-variant px-3 py-1 font-label-md text-[13px] text-on-surface-variant hover:bg-surface-container-low">
                {t('adminV2.issue.reopen')}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );

  const card = (label: string, value: number | undefined, to: string, opts?: { hint?: string; bad?: boolean }) => (
    <StatCard label={label} value={stats.data ? (value ?? 0) : stats.status === 'error' ? '!' : '…'} to={to} hint={opts?.hint} tone={opts?.bad && value ? 'bad' : 'mute'} />
  );
  const o = stats.data;

  return (
    <div className="space-y-8">
      <PageHead
        title={t('adminV2.today.title')}
        desc={t('adminV2.today.desc')}
        right={
          <button type="button" onClick={() => { issues.reload(); stats.reload(); }} className="flex items-center gap-1 rounded-full border border-outline-variant bg-white px-4 py-2 font-label-md text-label-md text-primary hover:bg-primary-fixed">
            <span className="material-symbols-outlined text-[18px]" aria-hidden>refresh</span>
            {t('adminV2.common.refresh')}
          </button>
        }
      />

      <section aria-labelledby="issues-h" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="issues-h" className="font-display-lg text-[22px] font-black text-deep-navy">{t('adminV2.today.issuesTitle')}</h2>
          <label className="flex items-center gap-2 font-caption text-[13px] text-on-surface-variant">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="h-4 w-4 accent-primary" />
            {t('adminV2.today.showResolved')}
          </label>
        </div>
        <DataState state={issues} empty={t('adminV2.today.issuesEmpty')} isEmpty={(d) => d.filter((i) => showResolved || i.status !== 'resolved').length === 0}>
          {(list) => <ul className="space-y-2.5">{list.filter((i) => showResolved || i.status !== 'resolved').map(row)}</ul>}
        </DataState>
      </section>

      <section aria-labelledby="stats-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="stats-h" className="font-display-lg text-[22px] font-black text-deep-navy">{t('adminV2.today.statsTitle')}</h2>
            <p className="font-caption text-[12px] text-on-surface-variant">
              {t('adminV2.today.statsBasis')} {asof && `· ${t('adminV2.common.asOf', { time: asof })}`}
            </p>
          </div>
          <label className="flex items-center gap-2 font-caption text-[13px] text-on-surface-variant">
            <input type="checkbox" checked={excludeTest} onChange={(e) => setExcludeTest(e.target.checked)} className="h-4 w-4 accent-primary" />
            {t('adminV2.today.excludeTest', { n: o?.test_academies ?? 0 })}
          </label>
        </div>
        {stats.status === 'error' && !stats.data ? (
          <DataState state={stats} empty="" isEmpty={() => false}>{() => null}</DataState>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {card(t('adminV2.today.signupsToday'), o?.signups_today, '/admin/academies?filter=today', { hint: t('adminV2.today.signupsTodayHint') })}
              {card(t('adminV2.today.signups7d'), o?.signups_7d, '/admin/academies?filter=new7', { hint: t('adminV2.today.signups7dHint') })}
              {card(t('adminV2.today.academies'), o?.academies, '/admin/academies')}
              {card(t('adminV2.today.accounts'), o?.accounts, '/admin/academies', { hint: t('adminV2.today.accountsHint', { owners: o?.owners ?? 0, teachers: o?.teachers ?? 0 }) })}
              {card(t('adminV2.today.students'), o?.students, '/admin/academies')}
              {card(t('adminV2.today.active7d'), o?.active_7d, '/admin/academies?filter=active7', { hint: t('adminV2.today.active7dHint') })}
              {card(t('adminV2.entitlement.trial'), o?.entitlement.trial, '/admin/academies?filter=trial', { hint: t('adminV2.today.trialEnding', { n: o?.trial_ending_3d ?? 0 }) })}
              {card(t('adminV2.entitlement.full'), o?.entitlement.full, '/admin/academies?filter=paid', {
                hint: t('adminV2.today.fullSplit', { sub: o?.source.subscription ?? 0, grant: (o?.source.admin ?? 0) + (o?.source.event ?? 0), un: o?.source.unclassified ?? 0 }),
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {card(t('adminV2.source.subscription'), o?.source.subscription, '/admin/academies?filter=subscription', { hint: t('adminV2.today.subscriptionHint') })}
              {card(t('adminV2.today.grants'), (o?.source.admin ?? 0) + (o?.source.event ?? 0), '/admin/academies?filter=grant', { hint: t('adminV2.today.grantsHint', { n: o?.grants_expiring_7d ?? 0 }) })}
              {card(t('adminV2.billingState.failed'), o?.billing.failed, '/admin/academies?filter=billing', { bad: true })}
              {card(t('adminV2.billingState.cancel_scheduled'), o?.billing.cancel_scheduled, '/admin/academies?filter=billing')}
            </div>
          </>
        )}
      </section>

      {resolving && (
        <ReasonDialog
          title={t('adminV2.issue.resolveTitle')}
          body={<span className="break-words">{resolving.title}</span>}
          confirmLabel={t('adminV2.issue.resolve')}
          label={t('adminV2.issue.resolveReason')}
          onClose={() => setResolving(null)}
          onConfirm={async (note) => {
            await adminIssueSet(resolving.id, 'resolved', note);
            setResolving(null);
            issues.reload();
          }}
        />
      )}
    </div>
  );
}
