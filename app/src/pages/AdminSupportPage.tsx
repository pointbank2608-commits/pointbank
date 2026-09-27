import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { adminTickets, type AdminTicketRow, type SupportTicket, type TicketStatus } from '../lib/support';
import { StatusPill, TicketThread } from './HelpPage';

/**
 * 관리자 문의함(2026-09-27) — 새로 온 것부터. 문의를 열면 학원·보낸 사람·보던 페이지·브라우저가 함께 보이고,
 * 자주 쓰는 답변(템플릿)을 눌러 바로 넣는다(템플릿은 이 브라우저에 저장, 직접 추가 가능).
 */
const TEMPLATE_KEY = 'classbank.admin.replyTemplates';

export default function AdminSupportPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const openId = params.get('ticket');
  const [status, setStatus] = useState<TicketStatus | null>(null);
  const [rows, setRows] = useState<AdminTicketRow[] | null>(null);

  const load = () =>
    adminTickets(status)
      .then(setRows)
      .catch(() => setRows([]));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const open = rows?.find((r) => r.id === openId) ?? null;
  if (openId && open) {
    const ticket: SupportTicket = {
      id: open.id,
      academy_id: open.academy_id,
      user_id: '',
      category: open.category,
      subject: open.subject,
      status: open.status,
      page_url: open.page_url,
      user_agent: open.user_agent,
      user_unread: false,
      admin_unread: open.admin_unread,
      created_at: open.created_at,
      updated_at: open.updated_at,
    };
    return (
      <div className="space-y-4">
        <div className="mx-auto max-w-3xl space-y-1 rounded-xl bg-surface-container-lowest p-4 font-caption text-caption text-on-surface-variant shadow-sm">
          <div>
            {open.academy_id ? (
              <Link to={`/admin/academies/${open.academy_id}`} className="font-bold text-primary hover:underline">
                {open.academy_name}
              </Link>
            ) : (
              '–'
            )}{' '}
            · {open.user_name} · <a href={`mailto:${open.user_email}`} className="text-primary hover:underline">{open.user_email}</a> ·{' '}
            {t(`help.category_${open.category}`)}
          </div>
          {open.page_url && <div>{t('adminOps.page')}: {open.page_url}</div>}
          {open.user_agent && <div className="truncate">{t('adminOps.browser')}: {open.user_agent}</div>}
        </div>
        <ReplyTemplates />
        <TicketThread
          ticket={ticket}
          side="admin"
          onBack={() => {
            setParams({});
            void load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">{t('adminOps.supportTitle')}</h1>
      <div className="flex flex-wrap gap-1.5">
        {([null, 'open', 'answered', 'closed'] as const).map((s) => (
          <button
            key={s ?? 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 font-label-md text-label-md ${status === s ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'}`}
          >
            {s ? t(`help.status_${s}`) : t('help.catAll')}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        {rows === null && <p className="p-4 text-on-surface-variant">{t('common.loading')}</p>}
        {rows?.length === 0 && <p className="p-4 text-on-surface-variant">{t('adminOps.noneNow')}</p>}
        {rows?.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setParams({ ticket: r.id })}
            className={`flex w-full items-center gap-3 border-b border-outline-variant/20 px-4 py-3 text-left hover:bg-surface-container-low ${r.admin_unread ? 'bg-primary-fixed/20' : ''}`}
          >
            {r.admin_unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-error" />}
            <StatusPill status={r.status} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-label-md text-label-md text-on-surface">{r.subject}</span>
              <span className="block truncate font-caption text-caption text-on-surface-variant">
                {r.academy_name} · {r.user_name} · {t(`help.category_${r.category}`)}
              </span>
            </span>
            <span className="shrink-0 font-caption text-caption text-on-surface-variant">{new Date(r.updated_at).toLocaleString()}</span>
          </button>
        ))}
      </div>
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
    <div className="mx-auto max-w-3xl space-y-2 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
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
            <button type="button" onClick={() => save(list.filter((_, j) => j !== i))} className="rounded-full p-0.5 text-on-surface-variant hover:text-error" aria-label="remove">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('adminOps.templatePlaceholder')}
          className="min-w-0 flex-1 rounded-lg border border-outline-variant px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => {
            save([...list, draft.trim()]);
            setDraft('');
          }}
          className="rounded-full border border-primary px-3 py-1 font-label-md text-label-md text-primary disabled:opacity-40"
        >
          {t('adminOps.addTemplate')}
        </button>
      </div>
    </div>
  );
}
