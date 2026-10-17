import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

/**
 * 관리자 운영 개선(2026-10-18) — supabase/086*.sql 의 함수를 부르는 얇은 층.
 * 모든 조회는 서버에서 거르고 자르며, 화면은 결과만 받는다(전체 회원을 브라우저로 내려받지 않는다).
 */

/* ---------------- 조회 상태(로딩 / 실패 / 실제 0건을 구분) ---------------- */
export type LoadState<T> =
  | { status: 'loading'; data: T | null }
  | { status: 'error'; error: string; setupNeeded: boolean; data: T | null }
  | { status: 'ready'; data: T };

const SETUP_RE = /function .* does not exist|Could not find the function|schema cache|42883|PGRST202|relation .* does not exist|42P01|column .* does not exist|42703/i;

export function errorText(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

/** 조회 함수를 부르고 로딩·실패·완료를 구분해 돌려준다. 실패는 절대 "0건"으로 바뀌지 않는다. */
export function useAdminQuery<T>(fn: () => Promise<T>, deps: unknown[]): LoadState<T> & { reload: () => void } {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading', data: null });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    setState((s) => ({ status: 'loading', data: s.data }));
    fnRef.current().then(
      (data) => alive && setState({ status: 'ready', data }),
      (e) => {
        if (!alive) return;
        const msg = errorText(e);
        setState((s) => ({ status: 'error', error: msg, setupNeeded: SETUP_RE.test(msg), data: s.data }));
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

/** 삭제 유예가 끝난 학원을 처리한다(관리자 화면을 열 때 같이 부른다 — 실패해도 화면에는 영향 없음) */
export async function adminPurgeDeletionsSafe(): Promise<void> {
  try {
    await supabase.rpc('purge_due_deletions');
  } catch {
    /* 무시 */
  }
}

/* ---------------- 지표 ---------------- */
export interface AdminOverview {
  asof: string;
  today_kst: string;
  exclude_test: boolean;
  test_academies: number;
  academies: number;
  signups_today: number;
  signups_7d: number;
  accounts: number;
  owners: number;
  teachers: number;
  students: number;
  active_7d: number;
  entitlement: { free: number; trial: number; full: number };
  trial_ending_3d: number;
  source: { subscription: number; admin: number; event: number; unclassified: number };
  billing: { normal: number; failed: number; cancel_scheduled: number };
  grants_expiring_7d: number;
}

export const adminOverview = (excludeTest = true) => rpc<AdminOverview | null>('admin_overview', { p_exclude_test: excludeTest });

/* ---------------- 학원·회원 목록 ---------------- */
export type Entitlement = 'free' | 'trial' | 'full';
export type PlanSource = 'subscription' | 'admin' | 'event' | 'unclassified';
export type BillingState = 'normal' | 'failed' | 'cancel_scheduled' | 'none';

export type AcademyFilterKey =
  | 'all' | 'today' | 'new7' | 'active7' | 'free' | 'trial' | 'trial_ending' | 'paid' | 'subscription' | 'grant'
  | 'unclassified' | 'billing' | 'expiring' | 'dormant' | 'tickets' | 'test';
export type AcademySortKey = 'created' | 'name' | 'students' | 'active' | 'trial';

export interface AcademyRow {
  academy_id: string;
  name: string;
  created_at: string;
  is_test: boolean;
  entitlement: Entitlement;
  source: PlanSource | null;
  billing_state: BillingState | null;
  plan_expires_at: string | null;
  trial_ends_at: string | null;
  billing_failure_count: number;
  owner_email: string | null;
  owner_name: string | null;
  owner_count: number;
  teacher_count: number;
  student_count: number;
  class_count: number;
  last_active_at: string | null;
  open_tickets: number;
  total: number;
}

export const ACADEMY_PAGE_SIZE = 50;

export interface AcademyQuery {
  query: string;
  filter: AcademyFilterKey;
  sort: AcademySortKey;
  dir: 'asc' | 'desc';
  excludeTest: boolean;
  page: number;
}

export async function adminAcademySearchV2(q: AcademyQuery): Promise<AcademyRow[]> {
  const rows = await rpc<AcademyRow[]>('admin_academy_search', {
    p_query: q.query,
    p_filter: q.filter,
    p_limit: ACADEMY_PAGE_SIZE,
    p_offset: q.page * ACADEMY_PAGE_SIZE,
    p_sort: q.sort,
    p_dir: q.dir,
    p_exclude_test: q.excludeTest,
  });
  return (rows ?? []).map((r) => ({ ...r, total: Number(r.total) }));
}

/* ---------------- 플랜·테스트·조치 ---------------- */
export const adminChangePlan = (academyId: string, plan: 'free' | 'paid', until: string | null, reason: string, source: 'admin' | 'event' = 'admin') =>
  rpc<void>('admin_change_plan', { p_academy_id: academyId, p_plan: plan, p_until: until, p_reason: reason, p_source: source });

export const adminSetAcademyTest = (academyId: string, isTest: boolean, reason: string) =>
  rpc<void>('admin_set_academy_test', { p_academy_id: academyId, p_is_test: isTest, p_reason: reason });

export const adminRequestDeletion = (academyId: string, reason: string) => rpc<string>('admin_request_deletion', { p_academy_id: academyId, p_reason: reason });
export const adminCancelDeletion = (academyId: string, reason: string) => rpc<void>('admin_cancel_deletion', { p_academy_id: academyId, p_reason: reason });

export interface ActionLogRow {
  id: string;
  created_at: string;
  actor_email: string | null;
  academy_id: string | null;
  academy_name: string | null;
  action: string;
  reason: string | null;
  result: 'success' | 'failed' | 'partial';
  batch_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export const adminActionLog = (academyId: string | null, limit = 30, offset = 0) =>
  rpc<ActionLogRow[]>('admin_action_log', { p_academy: academyId, p_limit: limit, p_offset: offset });
export const adminActionDetail = (id: string) => rpc<Record<string, unknown> | null>('admin_action_detail', { p_id: id });

/* ---------------- 대량 변경 ---------------- */
export interface BulkPreview {
  batch_id: string;
  targets: number;
  will_change: number;
  unchanged: number;
  sample: Array<{ academy: string; before: Record<string, boolean>; after: Record<string, boolean> }>;
}
export interface BulkResult {
  batch_id: string;
  status: string;
  ok: number;
  failed: number;
  repeat: boolean;
}
export interface BulkBatchRow {
  id: string;
  kind: string;
  status: 'running' | 'done' | 'partial' | 'undone';
  scope: Record<string, unknown>;
  params: Record<string, boolean | null>;
  target_count: number;
  changed_count: number;
  ok_count: number;
  failed_count: number;
  reason: string | null;
  created_at: string;
  applied_at: string | null;
}

export const adminBulkFeaturesPreview = (p: {
  query: string; filter: AcademyFilterKey; ids: string[] | null; excludeTest: boolean;
  group: boolean | null; solo: boolean | null; homework: boolean | null;
}) =>
  rpc<BulkPreview>('admin_bulk_features_preview', {
    p_query: p.query, p_filter: p.filter, p_ids: p.ids, p_exclude_test: p.excludeTest, p_group: p.group, p_solo: p.solo, p_homework: p.homework,
  });
export const adminBulkApply = (batch: string, reason: string) => rpc<BulkResult>('admin_bulk_apply', { p_batch: batch, p_reason: reason });
export const adminBulkUndo = (batch: string, reason: string) => rpc<{ restored: number; skipped: number }>('admin_bulk_undo', { p_batch: batch, p_reason: reason });
export const adminBulkRecent = () => rpc<BulkBatchRow[]>('admin_bulk_recent', { p_limit: 10 });

/* ---------------- 저장한 조건 ---------------- */
export interface SavedFilter {
  id: string;
  scope: 'academies' | 'tickets';
  name: string;
  config: Record<string, unknown>;
}
export async function listSavedFilters(scope: 'academies' | 'tickets'): Promise<SavedFilter[]> {
  const { data, error } = await supabase.from('admin_saved_filters').select('id, scope, name, config').eq('scope', scope).order('created_at');
  if (error) throw error;
  return (data ?? []) as SavedFilter[];
}
export async function saveFilter(scope: 'academies' | 'tickets', name: string, config: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('admin_saved_filters').insert({ scope, name: name.trim(), config });
  if (error) throw error;
}
export async function deleteSavedFilter(id: string): Promise<void> {
  const { error } = await supabase.from('admin_saved_filters').delete().eq('id', id);
  if (error) throw error;
}

/* ---------------- 문제 목록(오늘 할 일) ---------------- */
export type IssueStatus = 'open' | 'acknowledged' | 'resolved';
export interface AdminIssue {
  id: string;
  issue_key: string;
  kind: 'error' | 'billing' | 'account' | 'ticket' | 'job' | 'review';
  severity: 1 | 2 | 3 | 4 | 5;
  title: string;
  summary: string | null;
  status: IssueStatus;
  academies_affected: number;
  users_affected: number;
  first_seen: string;
  last_seen: string;
  wait_minutes: number;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  auto_resolved: boolean;
  recurrence_count: number;
  recurred_at: string | null;
  ref: { academy_id?: string; ticket_id?: string; fingerprint?: string; job_key?: string };
}
export const adminIssuesSync = () => rpc<{ new: number; recurred: number; auto_resolved: number }>('admin_issues_sync');
export const adminIssueList = (includeResolved = true) => rpc<AdminIssue[]>('admin_issue_list', { p_include_resolved: includeResolved });
export const adminIssueSet = (id: string, status: IssueStatus, note: string | null) => rpc<void>('admin_issue_set', { p_id: id, p_status: status, p_note: note });

/* ---------------- 문의 ---------------- */
export type TicketState = 'new' | 'in_progress' | 'waiting_customer' | 'waiting_internal' | 'needs_review' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export interface TicketRow {
  id: string;
  academy_id: string | null;
  academy_name: string | null;
  entitlement: Entitlement | null;
  user_email: string | null;
  user_name: string | null;
  category: string;
  subject: string;
  status: string;
  admin_state: TicketState;
  priority: TicketPriority;
  incident_key: string | null;
  created_at: string;
  updated_at: string;
  waiting_since: string | null;
  wait_minutes: number | null;
  sla_hours: number;
  overdue: boolean;
  admin_unread: boolean;
  reopen_count: number;
  first_response_minutes: number | null;
  errors_24h: number;
  same_incident: number;
  total: number;
}
export interface TicketQuery {
  query: string;
  state: TicketState | 'active' | 'all';
  category: string | null;
  priority: TicketPriority | null;
  overdueOnly: boolean;
  incident: string | null;
  sort: 'wait' | 'newest' | 'priority';
  page: number;
}
export const TICKET_PAGE_SIZE = 30;
export async function adminTicketSearch(q: TicketQuery): Promise<TicketRow[]> {
  const rows = await rpc<TicketRow[]>('admin_ticket_search', {
    p_query: q.query, p_state: q.state, p_category: q.category, p_priority: q.priority, p_overdue: q.overdueOnly,
    p_incident: q.incident, p_sort: q.sort, p_limit: TICKET_PAGE_SIZE, p_offset: q.page * TICKET_PAGE_SIZE,
  });
  return (rows ?? []).map((r) => ({ ...r, total: Number(r.total) }));
}
export const adminTicketSet = (id: string, patch: { state?: TicketState; priority?: TicketPriority; incident?: string; clearIncident?: boolean }) =>
  rpc<void>('admin_ticket_set', {
    p_id: id, p_state: patch.state ?? null, p_priority: patch.priority ?? null, p_incident: patch.incident ?? null, p_clear_incident: patch.clearIncident ?? false,
  });

export const adminGetSetting = async <T,>(key: string): Promise<T | null> => {
  const { data, error } = await supabase.from('admin_settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return (data?.value ?? null) as T | null;
};
export const adminSaveSetting = async (key: string, value: unknown): Promise<void> => {
  const { error } = await supabase.from('admin_settings').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
};

/* ---------------- 오류·자동 작업·결제 ---------------- */
export interface ErrorGroup {
  fingerprint: string;
  message: string;
  page: string | null;
  sample_stack: string | null;
  events: number;
  users: number;
  academies: number;
  first_seen: string;
  last_seen: string;
  issue_id: string | null;
  status: IssueStatus;
  recurrence_count: number;
  resolved_at: string | null;
  events_after_resolved: number;
  issue_wait_minutes: number;
}
export const adminErrorGroups = (hours = 168) => rpc<ErrorGroup[]>('admin_error_groups', { p_hours: hours });

export type JobHealth = 'disabled' | 'dry_only' | 'running' | 'failed' | 'retry_wait' | 'stale' | 'no_record' | 'ok';
export interface JobRow {
  job_key: string;
  title: string;
  description: string | null;
  kind: 'lifecycle' | 'billing' | 'maintenance' | 'report';
  managed: 'internal' | 'external';
  enabled: boolean;
  mode: 'dry_run' | 'live';
  channel: 'none' | 'email' | 'in_app';
  schedule: string | null;
  last_run_at: string | null;
  last_success_at: string | null;
  next_run_at: string | null;
  expected_interval_minutes: number | null;
  health: JobHealth;
  last_error: string | null;
  msg_planned: number;
  msg_sent: number;
  msg_failed: number;
}
export const adminJobsStatus = () => rpc<JobRow[]>('admin_jobs_status');
export const adminJobSet = (key: string, enabled: boolean, mode: 'dry_run' | 'live', channel: 'none' | 'email' | 'in_app', reason: string) =>
  rpc<void>('admin_job_set', { p_key: key, p_enabled: enabled, p_mode: mode, p_channel: channel, p_reason: reason });
export interface LifecyclePreview { kind: string; new: number; skipped_duplicate: number; sample: Array<{ academy: string; email: string }> }
export const adminLifecyclePreview = (kind: string) => rpc<LifecyclePreview | null>('admin_lifecycle_preview', { p_kind: kind });
export const adminLifecycleRun = (kind: string, dry: boolean) => rpc<{ dry_run: boolean; targets: number; planned?: number }>('admin_lifecycle_run', { p_kind: kind, p_dry_run: dry });
export const adminLifecycleStop = (kind: string) => rpc<number>('admin_lifecycle_stop', { p_kind: kind });
export const adminLifecycleRetry = (kind: string) => rpc<number>('admin_lifecycle_retry_failed', { p_kind: kind });

export interface BillingOverview {
  billed_ok_30d: number;
  billed_failed_30d: number;
  amount_ok_30d_krw: number;
  amount_ok_month_krw: number;
  refunds_recorded: boolean;
  webhook_events_30d: number;
  failures: Array<{ academy_id: string; name: string; billed_at: string; amount_krw: number; reason: string | null }>;
}
export const adminBillingOverview = () => rpc<BillingOverview | null>('admin_billing_overview');
export interface ReconcileRow { kind: 'paid_without_event' | 'event_without_history'; academy_name: string | null; payment_id: string | null; billed_at: string | null; amount_krw: number | null }
export const adminBillingReconcile = () => rpc<ReconcileRow[]>('admin_billing_reconcile');

/* ---------------- 표시 도우미 ---------------- */
/** 분 → "3시간 20분" 같은 사람이 읽는 대기시간 */
export function fmtWait(minutes: number | null | undefined, lang: string): string {
  if (minutes == null || !Number.isFinite(minutes)) return '–';
  const m = Math.max(0, Math.round(minutes));
  const en = lang.startsWith('en');
  if (m < 60) return en ? `${m}m` : `${m}분`;
  const h = Math.floor(m / 60);
  if (h < 48) return en ? `${h}h ${m % 60}m` : `${h}시간 ${m % 60}분`;
  const d = Math.floor(h / 24);
  return en ? `${d}d ${h % 24}h` : `${d}일 ${h % 24}시간`;
}

/** 한국 날짜 기준 날짜+시각(관리자 화면의 모든 시각은 한국 시간으로 보인다) */
export function fmtKst(iso: string | null | undefined, lang: string): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString(lang.startsWith('en') ? 'en-US' : 'ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
export function fmtKstDate(iso: string | null | undefined, lang: string): string {
  if (!iso) return '–';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00+09:00`) : new Date(iso);
  return d.toLocaleDateString(lang.startsWith('en') ? 'en-US' : 'ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'short', day: 'numeric' });
}
