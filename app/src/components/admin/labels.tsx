import { useTranslation } from 'react-i18next';
import type { BillingState, Entitlement, IssueStatus, JobHealth, PlanSource, TicketPriority, TicketState } from '../../lib/adminOps';
import { Badge, type Tone } from './AdminUi';

/** 상태 배지 모음 — 이용 권한 / 제공 근거 / 결제 상태를 따로 보여 준다(유료 권한 = 매출 고객이 아니다). */

export function EntitlementBadge({ value }: { value: Entitlement }) {
  const { t } = useTranslation();
  const tone: Tone = value === 'full' ? 'info' : value === 'trial' ? 'warn' : 'mute';
  return <Badge tone={tone}>{t(`adminV2.entitlement.${value}`)}</Badge>;
}

export function SourceBadge({ value }: { value: PlanSource | null }) {
  const { t } = useTranslation();
  if (!value) return <span className="text-on-surface-variant">–</span>;
  const tone: Tone = value === 'subscription' ? 'ok' : value === 'unclassified' ? 'warn' : 'info';
  return <Badge tone={tone}>{t(`adminV2.source.${value}`)}</Badge>;
}

export function BillingBadge({ value }: { value: BillingState | null }) {
  const { t } = useTranslation();
  if (!value) return <span className="text-on-surface-variant">–</span>;
  const tone: Tone = value === 'normal' ? 'ok' : value === 'failed' ? 'bad' : value === 'cancel_scheduled' ? 'warn' : 'mute';
  return <Badge tone={tone}>{t(`adminV2.billingState.${value}`)}</Badge>;
}

export function TicketStateBadge({ value }: { value: TicketState }) {
  const { t } = useTranslation();
  const tone: Tone = value === 'new' ? 'bad' : value === 'resolved' || value === 'closed' ? 'ok' : value === 'waiting_customer' ? 'mute' : 'warn';
  return <Badge tone={tone}>{t(`adminV2.ticketState.${value}`)}</Badge>;
}

export function PriorityBadge({ value }: { value: TicketPriority }) {
  const { t } = useTranslation();
  const tone: Tone = value === 'urgent' ? 'bad' : value === 'high' ? 'warn' : 'mute';
  return <Badge tone={tone}>{t(`adminV2.priority.${value}`)}</Badge>;
}

export function IssueStatusBadge({ value, recurred }: { value: IssueStatus; recurred?: boolean }) {
  const { t } = useTranslation();
  if (recurred && value !== 'resolved') return <Badge tone="bad">{t('adminV2.issue.recurred')}</Badge>;
  const tone: Tone = value === 'open' ? 'bad' : value === 'acknowledged' ? 'warn' : 'ok';
  return <Badge tone={tone}>{t(`adminV2.issue.status_${value}`)}</Badge>;
}

export function JobHealthBadge({ value }: { value: JobHealth }) {
  const { t } = useTranslation();
  const tone: Tone = value === 'ok' ? 'ok' : value === 'failed' || value === 'stale' ? 'bad' : value === 'retry_wait' || value === 'no_record' ? 'warn' : value === 'running' ? 'info' : 'mute';
  return <Badge tone={tone}>{t(`adminV2.jobHealth.${value}`)}</Badge>;
}
