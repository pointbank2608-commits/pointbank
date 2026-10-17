import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, DataState, PageHead } from '../components/admin/AdminUi';
import { PriorityBadge, TicketStateBadge } from '../components/admin/labels';
import {
  TICKET_PAGE_SIZE, adminGetSetting, adminSaveSetting, adminTicketSearch, adminTicketSet, deleteSavedFilter, errorText, fmtWait,
  listSavedFilters, saveFilter, useAdminQuery,
  type TicketPriority, type TicketRow, type TicketState,
} from '../lib/adminOps';
import { adminTicketLesson, adminTickets, type AttachedLessonSummary, type SupportTicket } from '../lib/support';
import AdminInboxPage from './AdminInboxPage';
import { TicketThread } from './HelpPage';

/**
 * 문의함(2026-10-18) — 승인함을 합쳤다. 목록은 "관리자가 처리해야 하는" 상태 중심(새 문의 / 처리 중 / 고객 답변 대기 / 내부 확인 / 검토 필요 / 해결 / 종료),
 * 응답 기한(SLA)은 우선순위별 시간을 설정에서 정하고 관리자 차례인 문의만 기한 초과로 센다. 같은 원인으로 묶인 문의는 "묶음 이름"으로 모아 본다.
 * "검토 필요" 탭은 FAQ 글자 겹침으로 답변 초안을 미리 채운다(AI가 아니다 — 보내기 전에 읽어 볼 것).
 */
const TEMPLATE_KEY = 'classbank.admin.replyTemplates';
const STATES: Array<TicketState | 'active' | 'all'> = ['active', 'new', 'in_progress', 'waiting_internal', 'needs_review', 'waiting_customer', 'resolved', 'closed', 'all'];
const PRIORITIES: TicketPriority[] = ['urgent', 'high', 'normal', 'low'];
const CATEGORIES = ['howto', 'bug', 'billing', 'idea', 'other'];

export default function AdminSupportPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const openId = params.get('ticket');
  const view = params.get('view') === 'review' ? 'review' : 'list';

  if (openId) return <TicketDetail id={openId} onBack={() => setParams({})} />;

  return (
    <div className="space-y-5">
      <PageHead title={t('adminV2.support.title')} desc={t('adminV2.support.desc')} />
      <div role="tablist" aria-label={t('adminV2.support.title')} className="flex gap-2">
        {(['list', 'review'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setParams(v === 'list' ? {} : { view: v })}
            className={`rounded-full px-4 py-1.5 font-label-md text-label-md ${view === v ? 'bg-primary font-bold text-white' : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            {t(`adminV2.support.tab_${v}`)}
          </button>
        ))}
      </div>
      {view === 'review' ? (
        <div>
          <p className="mb-3 rounded-lg bg-[#fff1c2] px-3 py-2 font-caption text-[13px] text-[#7a5400]">{t('adminV2.support.reviewNotAi')}</p>
          <AdminInboxPage embedded />
        </div>
      ) : (
        <TicketList onOpen={(id) => setParams({ ticket: id })} />
      )}
    </div>
  );
}

function TicketList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'ko';
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [state, setState] = useState<TicketState | 'active' | 'all'>('active');
  const [category, setCategory] = useState<string | null>(null);
  const [priority, setPriority] = useState<TicketPriority | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [incident, setIncident] = useState<string | null>(null);
  const [sort, setSort] = useState<'wait' | 'newest' | 'priority'>('wait');
  const [page, setPage] = useState(0);
  const [saveName, setSaveName] = useState('');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => { setQuery(input.trim()); setPage(0); }, 300);
    return () => window.clearTimeout(id);
  }, [input]);

  const result = useAdminQuery(
    () => adminTicketSearch({ query, state, category, priority, overdueOnly, incident, sort, page }),
    [query, state, category, priority, overdueOnly, incident, sort, page],
  );
  const saved = useAdminQuery(() => listSavedFilters('tickets'), [saveMsg]);
  const total = result.data?.[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / TICKET_PAGE_SIZE));
  const reset = () => setPage(0);

  const chip = (active: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1 font-label-md text-[13px] ${active ? 'bg-primary font-bold text-white' : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-outline-variant bg-white p-4 shadow-card">
        <label className="block">
          <span className="sr-only">{t('adminV2.support.searchLabel')}</span>
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('adminV2.support.searchPlaceholder')}
            className="w-full rounded-full border border-outline-variant px-4 py-2 font-body-md text-body-md outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('adminV2.support.stateLabel')}>
          {STATES.map((s) => <span key={s}>{chip(state === s, t(`adminV2.support.s_${s}`), () => { setState(s); reset(); })}</span>)}
        </div>
        <div className="flex flex-wrap items-center gap-3 font-caption text-[13px]">
          <label className="flex items-center gap-1.5">
            {t('adminV2.support.category')}
            <select value={category ?? ''} onChange={(e) => { setCategory(e.target.value || null); reset(); }} className="rounded-lg border border-outline-variant px-2 py-1">
              <option value="">{t('adminV2.support.any')}</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`help.category_${c}`)}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            {t('adminV2.support.priority')}
            <select value={priority ?? ''} onChange={(e) => { setPriority((e.target.value || null) as TicketPriority | null); reset(); }} className="rounded-lg border border-outline-variant px-2 py-1">
              <option value="">{t('adminV2.support.any')}</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{t(`adminV2.priority.${p}`)}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            {t('adminV2.support.sort')}
            <select value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); reset(); }} className="rounded-lg border border-outline-variant px-2 py-1">
              {(['wait', 'priority', 'newest'] as const).map((s) => <option key={s} value={s}>{t(`adminV2.support.sort_${s}`)}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={overdueOnly} onChange={(e) => { setOverdueOnly(e.target.checked); reset(); }} className="h-4 w-4 accent-primary" />
            {t('adminV2.support.overdueOnly')}
          </label>
          {incident && (
            <button type="button" onClick={() => { setIncident(null); reset(); }} className="rounded-full bg-primary-fixed px-3 py-1 font-bold text-[#0a47a6]">
              {t('adminV2.support.incidentFilter', { key: incident })} ×
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/50 pt-3">
          <span className="font-label-md text-[13px] font-bold text-deep-navy">{t('adminV2.academies.savedTitle')}</span>
          {saved.data?.map((s) => (
            <span key={s.id} className="inline-flex items-center overflow-hidden rounded-full border border-outline-variant">
              <button
                type="button"
                className="px-3 py-1 font-label-md text-[13px] hover:bg-primary-fixed"
                onClick={() => {
                  const c = s.config;
                  setInput(String(c.query ?? '')); setQuery(String(c.query ?? ''));
                  setState((c.state as typeof state) ?? 'active'); setCategory((c.category as string) ?? null);
                  setPriority((c.priority as TicketPriority) ?? null); setOverdueOnly(c.overdueOnly === true);
                  setIncident((c.incident as string) ?? null); setSort((c.sort as typeof sort) ?? 'wait'); reset();
                }}
              >
                {s.name}
              </button>
              <button type="button" aria-label={t('adminV2.academies.savedDelete', { name: s.name })} onClick={() => void deleteSavedFilter(s.id).then(() => setSaveMsg(t('adminV2.academies.savedDeleted')))} className="px-2 py-1 text-on-surface-variant hover:bg-error-container">×</button>
            </span>
          ))}
          <input value={saveName} onChange={(e) => setSaveName(e.target.value)} maxLength={30} placeholder={t('adminV2.academies.savedName')} aria-label={t('adminV2.academies.savedName')} className="w-40 rounded-full border border-outline-variant px-3 py-1 text-[13px]" />
          <button
            type="button"
            disabled={!saveName.trim()}
            onClick={() => void saveFilter('tickets', saveName, { query, state, category, priority, overdueOnly, incident, sort }).then(() => { setSaveName(''); setSaveMsg(t('adminV2.academies.savedOk')); }).catch((e) => setSaveMsg(errorText(e)))}
            className="rounded-full border border-primary px-3 py-1 font-label-md text-[13px] font-bold text-primary disabled:opacity-40"
          >
            {t('adminV2.academies.savedSave')}
          </button>
          {saveMsg && <span role="status" className="font-caption text-[12px] text-on-surface-variant">{saveMsg}</span>}
        </div>
      </div>

      <div className="font-label-md text-[15px] font-bold text-deep-navy" role="status">{t('adminV2.support.count', { n: total })}</div>
      <DataState state={result} empty={t('adminV2.support.empty')}>
        {(rows) => (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-white px-4 py-3 text-left shadow-card hover:bg-primary-fixed/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${r.overdue ? 'border-error/50' : 'border-outline-variant'}`}
                >
                  {r.admin_unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-error" aria-label={t('adminV2.support.unread')} />}
                  <TicketStateBadge value={r.admin_state} />
                  <PriorityBadge value={r.priority} />
                  {r.overdue && <Badge tone="bad">{t('adminV2.support.overdue')}</Badge>}
                  <span className="min-w-[12rem] flex-1">
                    <span className="block break-words font-label-md text-[15px] font-bold text-deep-navy">{r.subject}</span>
                    <span className="block break-words font-caption text-[12px] text-on-surface-variant">
                      {r.academy_name ?? '–'} · {r.user_name ?? r.user_email ?? '–'} · {t(`help.category_${r.category}`)}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5 font-caption text-[12px] text-on-surface-variant">
                    {r.admin_state !== 'resolved' && r.admin_state !== 'closed' && <span className="font-bold text-deep-navy">{t('adminV2.support.waitFor', { time: fmtWait(r.wait_minutes, lang) })}</span>}
                    <span>{t('adminV2.support.sla', { h: r.sla_hours })}</span>
                    {r.errors_24h > 0 && <span className="text-error">{t('adminV2.support.errors24', { n: r.errors_24h })}</span>}
                    {r.incident_key && (
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setIncident(r.incident_key); reset(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setIncident(r.incident_key); reset(); } }}
                        className="text-primary underline"
                      >
                        {t('adminV2.support.sameIncident', { key: r.incident_key, n: r.same_incident })}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DataState>
      {total > TICKET_PAGE_SIZE && (
        <nav aria-label={t('adminV2.academies.pager')} className="flex items-center justify-center gap-3">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-full border border-outline-variant px-4 py-1.5 font-label-md text-label-md disabled:opacity-40">{t('adminOps.prevPage')}</button>
          <span className="font-label-md text-label-md tabular-nums">{page + 1} / {pages}</span>
          <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded-full border border-outline-variant px-4 py-1.5 font-label-md text-label-md disabled:opacity-40">{t('adminOps.nextPage')}</button>
        </nav>
      )}
    </div>
  );
}

function TicketDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation();
  const [version, setVersion] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [incident, setIncident] = useState('');

  // 목록 검색 함수로 같은 문서를 한 번에 읽는다(상태·우선순위·기한 정보 포함) + 보던 페이지·브라우저는 기존 관리자 목록에서 가져온다.
  const info = useAdminQuery(async () => {
    const [rows, old] = await Promise.all([adminTicketSearch({ query: '', state: 'all', category: null, priority: null, overdueOnly: false, incident: null, sort: 'newest', page: 0 }), adminTickets(null)]);
    const row = rows.find((r) => r.id === id) ?? null;
    const o = old.find((r) => r.id === id) ?? null;
    return { row, o };
  }, [id, version]);

  async function patch(p: Parameters<typeof adminTicketSet>[1]) {
    setErr(null);
    try {
      await adminTicketSet(id, p);
      setVersion((v) => v + 1);
    } catch (e) {
      setErr(errorText(e));
    }
  }

  return (
    <div className="space-y-4">
      <DataState state={info} empty="" isEmpty={(d) => !d.o && !d.row}>
        {({ row, o }) => {
          const base = o ?? null;
          const ticket: SupportTicket | null = base
            ? { id: base.id, academy_id: base.academy_id, user_id: '', category: base.category, subject: base.subject, status: base.status, page_url: base.page_url, user_agent: base.user_agent, user_unread: false, admin_unread: base.admin_unread, created_at: base.created_at, updated_at: base.updated_at }
            : null;
          return (
            <>
              <div className="mx-auto max-w-3xl space-y-3 rounded-xl border border-outline-variant bg-white p-4 shadow-card">
                <div className="font-caption text-[13px] text-on-surface-variant">
                  {base?.academy_id ? <Link to={`/admin/academies/${base.academy_id}`} className="font-bold text-primary hover:underline">{base.academy_name}</Link> : '–'} · {base?.user_name} ·{' '}
                  {base?.user_email && <a href={`mailto:${base.user_email}`} className="text-primary hover:underline">{base.user_email}</a>} · {base && t(`help.category_${base.category}`)}
                </div>
                {base?.page_url && <div className="break-all font-caption text-[12px] text-on-surface-variant">{t('adminOps.page')}: {base.page_url}</div>}
                {base?.user_agent && <div className="truncate font-caption text-[12px] text-on-surface-variant">{t('adminOps.browser')}: {base.user_agent}</div>}
                {row && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/50 pt-3 font-caption text-[13px]">
                    <label className="flex items-center gap-1.5">
                      {t('adminV2.support.stateLabel')}
                      <select value={row.admin_state} onChange={(e) => void patch({ state: e.target.value as TicketState })} className="rounded-lg border border-outline-variant px-2 py-1">
                        {STATES.filter((s) => s !== 'active' && s !== 'all').map((s) => <option key={s} value={s}>{t(`adminV2.ticketState.${s}`)}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      {t('adminV2.support.priority')}
                      <select value={row.priority} onChange={(e) => void patch({ priority: e.target.value as TicketPriority })} className="rounded-lg border border-outline-variant px-2 py-1">
                        {PRIORITIES.map((p) => <option key={p} value={p}>{t(`adminV2.priority.${p}`)}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      {t('adminV2.support.incident')}
                      <input value={incident || row.incident_key || ''} onChange={(e) => setIncident(e.target.value)} maxLength={40} placeholder={t('adminV2.support.incidentPlaceholder')} className="w-40 rounded-lg border border-outline-variant px-2 py-1" />
                    </label>
                    <button type="button" onClick={() => void patch({ incident: incident.trim() })} disabled={!incident.trim()} className="rounded-full border border-primary px-3 py-1 font-bold text-primary disabled:opacity-40">{t('adminV2.support.incidentSet')}</button>
                    {row.incident_key && <button type="button" onClick={() => void patch({ clearIncident: true })} className="rounded-full border border-outline-variant px-3 py-1 text-on-surface-variant">{t('adminV2.support.incidentClear')}</button>}
                    {row.errors_24h > 0 && <Badge tone="bad">{t('adminV2.support.errors24', { n: row.errors_24h })}</Badge>}
                  </div>
                )}
                {err && <p role="alert" className="font-caption text-[13px] text-error">{err}</p>}
              </div>
              <AttachedLesson ticketId={id} />
              <ReplyTemplates />
              {ticket && <TicketThread ticket={ticket} side="admin" onBack={onBack} />}
            </>
          );
        }}
      </DataState>
      <button type="button" onClick={onBack} className="rounded-full border border-outline-variant px-4 py-1.5 font-label-md text-label-md">{t('adminV2.support.backToList')}</button>
    </div>
  );
}

/** 자주 쓰는 답변 — 누르면 복사(답장 칸에 붙여넣기). 이 브라우저에 저장. */
function ReplyTemplates() {
  const { t } = useTranslation();
  const defaults = [t('adminOps.tpl1'), t('adminOps.tpl2'), t('adminOps.tpl3')];
  const [list, setList] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(TEMPLATE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : defaults;
    } catch {
      return defaults;
    }
  });
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState<number | null>(null);
  function save(next: string[]) {
    setList(next);
    try {
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next));
    } catch {
      /* 무시 */
    }
  }
  return (
    <div className="mx-auto max-w-3xl space-y-2 rounded-xl border border-outline-variant bg-white p-4 shadow-card">
      <div className="font-label-md text-label-md text-on-surface-variant">{t('adminOps.templates')}</div>
      <div className="flex flex-wrap gap-1.5">
        {list.map((tx, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full bg-surface-container-low py-1 pl-3 pr-1 font-caption text-caption">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(tx);
                setCopied(i);
                window.setTimeout(() => setCopied(null), 1500);
              }}
              className="max-w-[260px] truncate text-left hover:text-primary"
              title={tx}
            >
              {copied === i ? t('adminOps.copied') : tx}
            </button>
            <button type="button" onClick={() => save(list.filter((_, j) => j !== i))} className="rounded-full p-0.5 text-on-surface-variant hover:text-error" aria-label={t('adminV2.support.templateRemove')}>
              <span className="material-symbols-outlined text-[14px]" aria-hidden>close</span>
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('adminOps.templatePlaceholder')} aria-label={t('adminOps.templatePlaceholder')} className="min-w-0 flex-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm outline-none focus:border-primary" />
        <button type="button" disabled={!draft.trim()} onClick={() => { save([...list, draft.trim()]); setDraft(''); }} className="rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary disabled:opacity-40">
          {t('adminOps.addTemplate')}
        </button>
      </div>
    </div>
  );
}

/** 선생님이 문의에 직접 첨부한 수업만 읽기 전용 요약으로 본다(눌렀을 때만 읽고 조치 기록에 남음) */
function AttachedLesson({ ticketId }: { ticketId: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'loading' | 'none' | AttachedLessonSummary>('idle');

  async function load() {
    setState('loading');
    try {
      setState((await adminTicketLesson(ticketId)) ?? 'none');
    } catch {
      setState('none');
    }
  }

  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-outline-variant bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-label-md text-label-md font-bold">{t('adminInbox.attachedLesson')}</span>
        {state === 'idle' && (
          <button type="button" onClick={() => void load()} className="rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary">
            {t('adminInbox.viewLesson')}
          </button>
        )}
        {state === 'loading' && <span className="text-on-surface-variant">{t('common.loading')}</span>}
        {state === 'none' && <span className="font-caption text-caption text-on-surface-variant">{t('adminInbox.noLesson')}</span>}
      </div>
      {typeof state === 'object' && (
        <div className="mt-2 space-y-1 font-body-sm text-body-sm">
          <div className="font-bold">{state.name}{state.level ? ` · ${state.level}` : ''}</div>
          <div className="text-on-surface-variant">{t('adminInbox.wordList')}: {state.word_list ?? '-'} · {t('adminInbox.slideCount', { n: state.slides.length })}</div>
          <ol className="list-decimal space-y-0.5 pl-5">
            {state.slides.map((sl, i) => (
              <li key={i}>
                <span className="font-label-md text-label-md">{sl.kind}</span>
                {sl.title ? <span className="text-on-surface-variant"> · {sl.title}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// 설정 화면에서 쓰는 기한(SLA) 편집 도우미 — 같은 파일에 두어 키 이름을 한 곳에서 관리한다.
export const SLA_KEY = 'support_sla_hours';
export type SlaHours = Record<TicketPriority, number>;
export const loadSla = () => adminGetSetting<SlaHours>(SLA_KEY);
export const saveSla = (v: SlaHours) => adminSaveSetting(SLA_KEY, v);
export type { TicketRow };
