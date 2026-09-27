import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useNotices } from '../components/NoticeCenter';
import { FAQ, FAQ_CATEGORIES, type FaqCategory } from '../data/faq';
import {
  createTicket,
  fetchMyTickets,
  fetchTicketMessages,
  markTicketSeen,
  sendTicketMessage,
  setTicketStatus,
  supportAttachmentUrl,
  TICKET_CATEGORIES,
  uploadSupportAttachment,
  type SupportMessage,
  type SupportTicket,
  type TicketCategory,
} from '../lib/support';

/**
 * 도움말·문의(/help, 2026-09-27) — 자주 묻는 질문을 먼저(검색) → 안 풀리면 문의하기 → 내 문의(답변 대화).
 * 문의에는 보던 페이지·브라우저가 자동으로 붙어 오류를 다시 확인하기 쉽다. 캡처는 비공개로 저장.
 */
export default function HelpPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'ko';
  const [params, setParams] = useSearchParams();
  const openTicketId = params.get('ticket');
  const notices = useNotices();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<FaqCategory | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [writing, setWriting] = useState(false);

  const reload = () =>
    fetchMyTickets()
      .then(setTickets)
      .catch(() => setTickets([]));
  useEffect(() => {
    void reload();
  }, []);

  const q = query.trim().toLowerCase();
  const faqs = useMemo(
    () => FAQ.filter((f) => (!cat || f.category === cat) && (!q || f.q[lang].toLowerCase().includes(q) || f.a[lang].toLowerCase().includes(q))),
    [cat, q, lang],
  );

  const current = tickets?.find((tk) => tk.id === openTicketId) ?? null;
  if (openTicketId && current) {
    return (
      <TicketThread
        ticket={current}
        onBack={() => {
          setParams({});
          void reload();
          notices?.refresh();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">{t('help.title')}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('help.subtitle')}</p>
      </div>

      {/* 자주 묻는 질문 */}
      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <div className="relative">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('help.searchPlaceholder')}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low py-3 pl-10 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setCat(null)} className={chip(!cat)}>
            {t('help.catAll')}
          </button>
          {FAQ_CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={chip(cat === c)}>
              {t(`help.cat_${c}`)}
            </button>
          ))}
        </div>
        <div className="divide-y divide-outline-variant/30">
          {faqs.length === 0 && <p className="py-4 text-center font-body-md text-body-md text-on-surface-variant">{t('help.noFaq')}</p>}
          {faqs.map((f) => {
            const open = openFaq === f.id;
            return (
              <div key={f.id}>
                <button type="button" onClick={() => setOpenFaq(open ? null : f.id)} className="flex w-full items-center gap-2 py-3 text-left">
                  <span className="material-symbols-outlined text-[20px] text-primary">help</span>
                  <span className="min-w-0 flex-1 font-label-md text-label-md text-on-surface">{f.q[lang]}</span>
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">{open ? 'expand_less' : 'expand_more'}</span>
                </button>
                {open && (
                  <div className="space-y-2 pb-4 pl-7">
                    <p className="whitespace-pre-wrap font-body-md text-body-md text-on-surface-variant">{f.a[lang]}</p>
                    {f.link && (
                      <Link to={f.link} className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline">
                        {t('help.goThere')}
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 문의 */}
      <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-primary">support_agent</span>
          <h2 className="flex-1 font-title-md text-title-md text-deep-navy">{t('help.contactTitle')}</h2>
          {!writing && (
            <button type="button" onClick={() => setWriting(true)} className="rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container">
              {t('help.newTicket')}
            </button>
          )}
        </div>
        <p className="font-caption text-caption text-on-surface-variant">{t('help.contactHint')}</p>
        {writing && (
          <TicketForm
            onDone={(tk) => {
              setWriting(false);
              if (tk) {
                void reload();
                setParams({ ticket: tk.id });
              }
            }}
          />
        )}
        <div className="space-y-2">
          <div className="font-label-md text-label-md text-on-surface-variant">{t('help.myTickets')}</div>
          {tickets === null && <p className="text-on-surface-variant">{t('common.loading')}</p>}
          {tickets?.length === 0 && <p className="font-caption text-caption text-on-surface-variant">{t('help.noTickets')}</p>}
          {tickets?.map((tk) => (
            <button
              key={tk.id}
              type="button"
              onClick={() => setParams({ ticket: tk.id })}
              className="flex w-full items-center gap-3 rounded-xl border border-outline-variant/40 px-4 py-3 text-left hover:border-primary"
            >
              <StatusPill status={tk.status} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-label-md text-label-md text-on-surface">{tk.subject}</span>
                <span className="block font-caption text-caption text-on-surface-variant">
                  {t(`help.category_${tk.category}`)} · {new Date(tk.updated_at).toLocaleString()}
                </span>
              </span>
              {tk.user_unread && <span className="h-2.5 w-2.5 rounded-full bg-error" />}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const chip = (on: boolean) =>
  `rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`;

export function StatusPill({ status }: { status: SupportTicket['status'] }) {
  const { t } = useTranslation();
  const cls = status === 'answered' ? 'bg-secondary-container text-on-secondary-container' : status === 'closed' ? 'bg-surface-container text-on-surface-variant' : 'bg-warm-yellow/40 text-on-surface';
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-caption text-caption font-bold ${cls}`}>{t(`help.status_${status}`)}</span>;
}

function TicketForm({ onDone }: { onDone: (tk: SupportTicket | null) => void }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<TicketCategory>('howto');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!subject.trim() || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const path = file ? await uploadSupportAttachment(file) : null;
      const tk = await createTicket({ category, subject: subject.trim(), body: body.trim(), attachmentPath: path });
      onDone(tk);
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      setError(/support_tickets|relation|function/i.test(msg) ? t('help.needSetup') : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="space-y-3 rounded-xl border border-outline-variant/50 bg-surface-container-low p-4"
      onPaste={(e) => {
        // 캡처(스크린샷)를 바로 붙여넣기
        const img = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
        if (img) setFile(img);
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {TICKET_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)} className={chip(category === c)}>
            {t(`help.category_${c}`)}
          </button>
        ))}
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value.slice(0, 120))}
        placeholder={t('help.subjectPlaceholder')}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 4000))}
        rows={5}
        placeholder={t(category === 'bug' ? 'help.bodyPlaceholderBug' : 'help.bodyPlaceholder')}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1 rounded-full border border-outline-variant px-3 py-1.5 font-label-md text-label-md text-on-surface-variant hover:border-primary">
          <span className="material-symbols-outlined text-[18px]">attach_file</span>
          {file ? file.name.slice(0, 24) : t('help.attach')}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <span className="font-caption text-caption text-on-surface-variant">{t('help.attachHint')}</span>
      </div>
      {error && <p className="font-caption text-caption text-error">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !subject.trim() || !body.trim()}
          onClick={() => void submit()}
          className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary shadow-sm disabled:opacity-40"
        >
          {busy ? t('common.loading') : t('help.send')}
        </button>
        <button type="button" onClick={() => onDone(null)} className="rounded-full px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

/** 문의 한 건의 대화(선생님·관리자 화면이 같이 쓴다) */
export function TicketThread({ ticket, onBack, side = 'user' }: { ticket: SupportTicket; onBack: () => void; side?: 'user' | 'admin' }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const load = () =>
    fetchTicketMessages(ticket.id).then(async (list) => {
      setMessages(list);
      const out: Record<string, string> = {};
      for (const m of list) {
        if (m.attachment_path) {
          const u = await supportAttachmentUrl(m.attachment_path);
          if (u) out[m.attachment_path] = u;
        }
      }
      setUrls(out);
    });

  useEffect(() => {
    void load();
    void markTicketSeen(ticket.id, side);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  async function send() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await sendTicketMessage(ticket.id, side, reply.trim());
      setReply('');
      setStatus(side === 'admin' ? 'answered' : 'open');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    await setTicketStatus(ticket.id, 'closed');
    setStatus('closed');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {t('help.back')}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={status} />
        <h1 className="min-w-0 flex-1 font-title-md text-title-md font-bold text-deep-navy">{ticket.subject}</h1>
        {status !== 'closed' && (
          <button type="button" onClick={() => void close()} className="rounded-full border border-outline-variant px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:border-primary">
            {side === 'admin' ? t('help.closeAdmin') : t('help.resolved')}
          </button>
        )}
      </div>
      <div className="space-y-3">
        {messages === null && <p className="text-on-surface-variant">{t('common.loading')}</p>}
        {messages?.map((m) => {
          const mine = m.sender === side;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] space-y-2 rounded-2xl px-4 py-3 ${mine ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface shadow-sm'}`}>
                <div className="font-caption text-caption opacity-75">
                  {m.sender === 'admin' ? t('help.fromAdmin') : t('help.fromUser')} · {new Date(m.created_at).toLocaleString()}
                </div>
                <p className="whitespace-pre-wrap font-body-md text-body-md">{m.body}</p>
                {m.attachment_path && urls[m.attachment_path] && (
                  <a href={urls[m.attachment_path]} target="_blank" rel="noreferrer">
                    <img src={urls[m.attachment_path]} alt="" className="max-h-64 rounded-lg bg-white" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {status !== 'closed' || side === 'user' ? (
        <div className="space-y-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, 4000))}
            rows={3}
            placeholder={side === 'admin' ? t('help.replyPlaceholderAdmin') : t('help.replyPlaceholder')}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button type="button" disabled={busy || !reply.trim()} onClick={() => void send()} className="rounded-full bg-primary px-5 py-2 font-label-md text-label-md text-on-primary disabled:opacity-40">
            {busy ? t('common.loading') : t('help.sendReply')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
