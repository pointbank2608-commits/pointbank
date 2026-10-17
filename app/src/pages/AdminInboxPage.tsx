import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FAQ, FAQ_CATEGORIES, type FaqCategory } from '../data/faq';
import { useToast } from '../context/ToastContext';
import {
  adminBulkReply,
  adminCreateFaq,
  adminInbox,
  fetchFaqEntries,
  sendTicketMessage,
  type AdminInboxRow,
} from '../lib/support';
import { clusterTickets, suggestFaq, type FaqCandidate } from '../lib/ticketMatch';

/**
 * 승인함(2026-10-16, 관리자 자동화 2단계) — 하루 한 번 이 목록만 비우면 된다.
 *  ① 비슷한 문의 묶음: 답 하나를 써서 한꺼번에 보내고, 반복되면 FAQ로 올린다.
 *  ② 답변 초안이 있는 문의: FAQ에서 가장 비슷한 답을 찾아 미리 채워 둔다(고쳐서 보내기).
 *  ③ 초안이 없는 문의: 직접 답한다.
 * 초안은 AI가 아니라 글자 겹침으로 찾는다(lib/ticketMatch.ts) — 틀릴 수 있으니 보내기 전에 읽어 볼 것.
 */
export default function AdminInboxPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [rows, setRows] = useState<AdminInboxRow[] | null>(null);
  const [extra, setExtra] = useState<FaqCandidate[]>([]);

  const load = useCallback(() => {
    adminInbox()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);
  useEffect(() => {
    load();
    void fetchFaqEntries().then((list) => setExtra(list.map((e) => ({ id: e.id, q: e.q_ko, a: e.a_ko, link: e.link ?? undefined }))));
  }, [load]);

  const faqs = useMemo<FaqCandidate[]>(
    () => [...FAQ.map((f) => ({ id: f.id, q: f.q.ko, a: f.a.ko, link: f.link })), ...extra],
    [extra],
  );

  const { clusters, singles } = useMemo(() => {
    const list = (rows ?? []).map((r) => ({ ...r, body: r.first_body ?? '' }));
    const cl = clusterTickets(list);
    const inCluster = new Set(cl.flat().map((x) => x.id));
    return { clusters: cl, singles: list.filter((r) => !inCluster.has(r.id)) };
  }, [rows]);

  if (rows === null) return <p className="text-on-surface-variant">{t('common.loading')}</p>;

  const withDraft = singles
    .map((r) => ({ row: r, sug: suggestFaq(`${r.subject} ${r.body}`, faqs) }))
    .filter((x) => x.sug);
  const withoutDraft = singles.filter((r) => !suggestFaq(`${r.subject} ${r.body}`, faqs));

  return (
    <div className="space-y-6">
      {!embedded && (
      <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">{t('adminInbox.title')}</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{t('adminInbox.hint')}</p>
        </div>
      )}

      {rows.length === 0 && <p className="rounded-xl bg-surface-container-lowest p-6 text-center text-on-surface-variant shadow-sm">{t('adminInbox.empty')}</p>}

      {clusters.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-title-md text-title-md text-deep-navy">{t('adminInbox.clusters', { n: clusters.length })}</h2>
          {clusters.map((c) => (
            <ClusterCard
              key={c[0].id}
              items={c}
              draft={suggestFaq(`${c[0].subject} ${c[0].body}`, faqs)?.faq ?? null}
              onSent={(msg) => {
                notify(msg);
                load();
              }}
            />
          ))}
        </section>
      )}

      {withDraft.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-title-md text-title-md text-deep-navy">{t('adminInbox.drafts', { n: withDraft.length })}</h2>
          {withDraft.map(({ row, sug }) => (
            <DraftCard
              key={row.id}
              row={row}
              faq={sug!.faq}
              onSent={() => {
                notify(t('adminInbox.sent'));
                load();
              }}
            />
          ))}
        </section>
      )}

      {withoutDraft.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-title-md text-title-md text-deep-navy">{t('adminInbox.manual', { n: withoutDraft.length })}</h2>
          <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
            {withoutDraft.map((r) => (
              <Link
                key={r.id}
                to={`/admin/support?ticket=${r.id}`}
                className="flex items-center gap-3 border-b border-outline-variant/20 px-4 py-3 hover:bg-surface-container-low"
              >
                <span className="min-w-0 flex-1 truncate font-label-md text-label-md">{r.subject}</span>
                {r.has_lesson && <span className="shrink-0 rounded-full bg-primary-fixed/40 px-2 py-0.5 font-caption text-caption">{t('adminInbox.hasLesson')}</span>}
                <span className="shrink-0 font-caption text-caption text-on-surface-variant">{r.academy_name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const box = 'space-y-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm';

function DraftCard({ row, faq, onSent }: { row: AdminInboxRow; faq: FaqCandidate; onSent: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(faq.a);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await sendTicketMessage(row.id, 'admin', text.trim());
      onSent();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={box}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-label-md text-label-md font-bold">{row.subject}</span>
        <span className="font-caption text-caption text-on-surface-variant">
          {row.academy_name} · {row.user_name}
        </span>
        {row.has_lesson && <span className="rounded-full bg-primary-fixed/40 px-2 py-0.5 font-caption text-caption">{t('adminInbox.hasLesson')}</span>}
      </div>
      <p className="whitespace-pre-wrap rounded-lg bg-surface-container-low p-3 font-body-sm text-body-sm">{row.first_body}</p>
      <div className="font-caption text-caption text-on-surface-variant">{t('adminInbox.draftFrom', { q: faq.q })}</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !text.trim()} onClick={() => void send()} className="rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-40">
          {t('adminInbox.sendDraft')}
        </button>
        <Link to={`/admin/support?ticket=${row.id}`} className="rounded-full border border-outline-variant px-4 py-1.5 font-label-md text-label-md text-on-surface-variant hover:border-primary">
          {t('adminInbox.openTicket')}
        </Link>
      </div>
    </div>
  );
}

function ClusterCard({
  items,
  draft,
  onSent,
}: {
  items: Array<AdminInboxRow & { body: string }>;
  draft: FaqCandidate | null;
  onSent: (msg: string) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [text, setText] = useState(draft?.a ?? '');
  const [busy, setBusy] = useState(false);
  const [promote, setPromote] = useState(false);
  const [question, setQuestion] = useState(items[0].subject);
  const [category, setCategory] = useState<FaqCategory>('start');

  async function sendAll() {
    setBusy(true);
    try {
      const n = await adminBulkReply(
        items.map((i) => i.id),
        text.trim(),
      );
      onSent(t('adminInbox.sentMany', { n }));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      await adminCreateFaq({ category, q_ko: question.trim(), a_ko: text.trim(), source_ticket: items[0].id });
      notify(t('adminInbox.faqCreated'));
      setPromote(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={box}>
      <div className="font-label-md text-label-md font-bold">{t('adminInbox.similar', { n: items.length })}</div>
      <ul className="space-y-0.5 font-body-sm text-body-sm text-on-surface-variant">
        {items.map((i) => (
          <li key={i.id} className="truncate">
            · {i.subject} <span className="text-caption">— {i.academy_name}</span>
          </li>
        ))}
      </ul>
      {draft && <div className="font-caption text-caption text-on-surface-variant">{t('adminInbox.draftFrom', { q: draft.q })}</div>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={t('adminInbox.writeAnswer')}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
      />
      {promote && (
        <div className="space-y-2 rounded-lg bg-surface-container-low p-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('adminInbox.faqQuestion')}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <div className="flex flex-wrap gap-1.5">
            {FAQ_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 font-label-md text-label-md ${category === c ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'}`}
              >
                {t(`help.cat_${c}`)}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy || !question.trim() || !text.trim()} onClick={() => void publish()} className="rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-40">
            {t('adminInbox.publishFaq')}
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !text.trim()} onClick={() => void sendAll()} className="rounded-full bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary disabled:opacity-40">
          {t('adminInbox.sendAll', { n: items.length })}
        </button>
        <button type="button" onClick={() => setPromote((v) => !v)} className="rounded-full border border-primary px-4 py-1.5 font-label-md text-label-md text-primary">
          {t('adminInbox.toFaq')}
        </button>
      </div>
    </div>
  );
}
