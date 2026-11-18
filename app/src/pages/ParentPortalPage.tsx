import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BrandMark from '../components/BrandMark';
import {
  applicationServerKey, connectParent, inviteFromHash, inviteFromText, iosNeedsInstall, loadParent,
  logoutParent, ParentError, parentSessions, pushKey, readParentNotices, setParentPush, storeParentSessions,
  type ParentHome, type ParentSession,
} from '../lib/parentPortal';

const card = 'rounded-2xl border border-outline-variant bg-white p-4 shadow-card sm:p-6';
const primary = 'min-h-11 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50';
const secondary = 'min-h-11 rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-deep-navy disabled:opacity-50';

export default function ParentPortalPage() {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState(parentSessions);
  const [chosen, setChosen] = useState(() => new URLSearchParams(location.hash.slice(1)).get('child') ?? '');
  const [homes, setHomes] = useState<Record<string, ParentHome>>({});
  const [invite, setInvite] = useState(() => inviteFromHash() ?? '');
  const [adding, setAdding] = useState(() => !!inviteFromHash());
  const [installedRequired] = useState(iosNeedsInstall);
  const [view, setView] = useState<'homework' | 'notices'>(() =>
    new URLSearchParams(location.search).get('view') === 'notices' ? 'notices' : 'homework');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [worker, setWorker] = useState<ServiceWorkerRegistration>();
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [workerFailed, setWorkerFailed] = useState(false);
  const active = sessions.find((s) => s.id === chosen) ?? sessions[0];
  const home = active && homes[active.id];
  const applicationKey = home?.push_key ?? pushKey;
  const supportsPush = !installedRequired && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const hasSessions = sessions.length > 0;
  const formOpen = adding || !hasSessions;

  useEffect(() => {
    function acceptFragment() {
      const child = new URLSearchParams(location.hash.slice(1)).get('child');
      if (child) { setChosen(child); setView('notices'); }
      const incomingInvite = inviteFromHash();
      if (incomingInvite) { setInvite(incomingInvite); setAdding(true); }
      if (/^#(invite|child)=/.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
    }
    acceptFragment();
    window.addEventListener('hashchange', acceptFragment);
    return () => window.removeEventListener('hashchange', acceptFragment);
  }, []);

  useEffect(() => { storeParentSessions(sessions); }, [sessions]);

  useEffect(() => {
    if (!hasSessions || !supportsPush || !applicationKey) return;
    let cancelled = false;
    navigator.serviceWorker.register('/parent-sw.js', { scope: '/p' })
      .then(async (reg) => {
        if (!reg.active) await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) { setSubscription(sub); setWorker(reg); setWorkerFailed(false); }
      })
      .catch(() => { if (!cancelled) setWorkerFailed(true); });
    return () => { cancelled = true; };
  }, [applicationKey, hasSessions, supportsPush]);

  useEffect(() => {
    if (!sessions.length) return;
    let cancelled = false;
    let loading = false;
    async function load() {
      if (loading || document.visibilityState !== 'visible') return;
      loading = true;
      const results = await Promise.allSettled(sessions.map((s) => loadParent(s.token, subscription?.endpoint)));
      if (cancelled) return;
      const expired = new Set<string>();
      const updates: Record<string, ParentHome> = {};
      let errors = false;
      results.forEach((result, i) => {
        const id = sessions[i].id;
        if (result.status === 'fulfilled') updates[id] = result.value;
        else if (result.reason instanceof ParentError && result.reason.kind === 'expired') expired.add(id);
        else errors = true;
      });
      if (expired.size) {
        setSessions((prev) => prev.filter((s) => !expired.has(s.id)));
        setMessage('expired');
      }
      setHomes((prev) => ({ ...prev, ...updates }));
      setFailed(errors);
      loading = false;
    }
    void load();
    const timer = window.setInterval(() => void load(), 45_000);
    document.addEventListener('visibilitychange', load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [sessions, subscription, refresh]);

  async function connect() {
    const secret = inviteFromText(invite);
    if (!secret || busy) { setMessage('invalid_invite'); return; }
    setBusy(true);
    setMessage('');
    try {
      const next = await connectParent(secret);
      const old = sessions.find((s) => s.student_id === next.student_id);
      if (old) await logoutParent(old.token).catch(() => {});
      setSessions((prev) => [...prev.filter((s) => s.student_id !== next.student_id), next]);
      setChosen(next.id);
      setInvite('');
      setAdding(false);
    } catch (error) { setMessage(error instanceof ParentError ? error.kind : 'failed'); }
    finally { setBusy(false); }
  }

  async function forActive(action: (session: ParentSession) => Promise<unknown>) {
    if (!active || busy) return;
    setBusy(true);
    setMessage('');
    try { await action(active); }
    catch (error) { setMessage(error instanceof ParentError ? error.kind : 'failed'); }
    finally { setBusy(false); }
  }

  function togglePush() {
    const key = applicationKey;
    if (!worker || !key || !home) return;
    void forActive(async ({ token }) => {
      let sub = subscription;
      if (!sub && !home.push_enabled) {
        try {
          sub = await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(key) });
        } catch (error) {
          if (Notification.permission === 'denied') { setMessage('denied'); return; }
          throw error;
        }
      }
      if (!sub) return;
      await setParentPush(token, sub, !home.push_enabled, i18n.resolvedLanguage ?? 'ko');
      setSubscription(sub);
      setRefresh((x) => x + 1);
    });
  }

  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ko-KR';
  function date(iso: string) {
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(iso));
  }
  const notices = (home?.homework ?? []).flatMap((item) => [
    { item, time: item.published_at, kind: 'published' },
    ...(item.completed_at ? [{ item, time: item.completed_at, kind: 'completed' }] : []),
  ]).sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  const unread = (time: string) => !!home && Date.parse(time) > Date.parse(home.read_through);
  const unreadCount = notices.filter((notice) => unread(notice.time)).length;

  return (
    <main className="min-h-[100dvh] bg-background px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))] text-deep-navy">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center gap-2 pb-2 font-bold"><BrandMark className="h-8 w-8" />{t('parentPortal.brand')}</header>
        <div className="rounded-2xl bg-deep-navy p-5 text-white sm:p-7">
          <p className="text-sm font-bold text-[#b9d8ff]">{t('parentPortal.brand')}</p>
          <h1 className="mt-2 break-words text-2xl font-black sm:text-3xl">{t('parentPortal.title')}</h1>
          <p className="mt-2 text-sm text-white/90">{t('parentPortal.subtitle')}</p>
        </div>
        {message && <p role="status" className="rounded-xl bg-primary-fixed p-3 text-sm">{t(`parentPortal.${message}`)}</p>}
        {formOpen && (
          <form className={`${card} space-y-3`} onSubmit={(e) => { e.preventDefault(); void connect(); }}>
            <h2 className="text-lg font-bold">{t('parentPortal.connectTitle')}</h2>
            <p className="text-sm text-on-surface-variant">{t('parentPortal.connectHint')}</p>
            {installedRequired && (
              <div className="space-y-2 rounded-xl bg-primary-fixed p-3 text-sm">
                <p>{t('parentPortal.install')}</p>
                {!!inviteFromText(invite) && <button type="button" className={secondary} onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${location.origin}/p#invite=${inviteFromText(invite)}`);
                    setMessage('copied');
                  } catch { setMessage('copyManually'); }
                }}>{t('parentPortal.copyInvite')}</button>}
              </div>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-bold">{t('parentPortal.inviteLabel')}</span>
              <input type="text" value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off"
                spellCheck={false} maxLength={350} className="w-full rounded-xl border border-outline-variant px-3 py-3" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className={installedRequired ? secondary : primary} disabled={busy || !invite.trim()}>
                {t(installedRequired ? 'parentPortal.connectHere' : 'parentPortal.connect')}
              </button>
              {hasSessions && <button type="button" className={secondary} onClick={() => setAdding(false)}>{t('common.cancel')}</button>}
            </div>
          </form>
        )}
        {active && <>
          <div className="flex flex-wrap items-center gap-2">
            <select value={active.id} aria-label={t('parentPortal.child')} className={secondary}
              onChange={(e) => { setChosen(e.target.value); setMessage(''); }} disabled={busy}>
              {sessions.map((s, i) => <option key={s.id} value={s.id}>
                {homes[s.id] ? `${homes[s.id].name} · ${homes[s.id].academy}` : t('parentPortal.childNumber', { n: i + 1 })}
              </option>)}
            </select>
            {!formOpen && <button type="button" className={secondary} onClick={() => setAdding(true)}>{t('parentPortal.addChild')}</button>}
            <button type="button" className="ml-auto min-h-11 px-2 text-sm underline" disabled={busy}
              onClick={() => void forActive(async (s) => {
                await logoutParent(s.token);
                setSessions((prev) => prev.filter((p) => p.id !== s.id));
              })}>{t('parentPortal.signOut')}</button>
          </div>
          {failed && <div role="alert" className={card}>
            {t('parentPortal.refreshFailed')} <button type="button" className="min-h-11 px-2 underline"
              onClick={() => setRefresh((x) => x + 1)}>{t('parentPortal.retry')}</button>
          </div>}
          {!home && !failed && <p role="status">{t('common.loading')}</p>}
          {home && <>
            <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
              <div className="max-w-md">
                <h2 className="font-bold">{t('parentPortal.pushTitle')}</h2>
                <p className="text-sm text-on-surface-variant">{installedRequired ? t('parentPortal.installConnected')
                  : !applicationKey ? t('parentPortal.pushUnconfigured')
                    : !supportsPush ? t('parentPortal.unsupported')
                      : workerFailed ? t('parentPortal.pushSetupFailed')
                        : home.push_enabled ? t('parentPortal.pushOn') : t('parentPortal.pushHint')}</p>
              </div>
              {supportsPush && applicationKey && !workerFailed && <button type="button" className={home.push_enabled ? secondary : primary}
                disabled={!worker || busy} onClick={togglePush}>{t(home.push_enabled ? 'parentPortal.disable' : 'parentPortal.enable')}</button>}
            </section>
            <nav className="flex gap-2" aria-label={t('parentPortal.title')}>
              <button type="button" className={view === 'homework' ? primary : secondary}
                aria-pressed={view === 'homework'} onClick={() => setView('homework')}>{t('parentPortal.homework')}</button>
              <button type="button" className={view === 'notices' ? primary : secondary}
                aria-pressed={view === 'notices'} onClick={() => setView('notices')}>
                {t('parentPortal.notices')}{unreadCount > 0 ? ` · ${unreadCount}` : ''}
              </button>
            </nav>
            {view === 'homework' ? (
              <section className={card}>
                <h2 className="text-lg font-bold">{t('parentPortal.homework')}</h2>
                <p className="mt-1 text-sm text-on-surface-variant">{t('parentPortal.historyHint')}</p>
                {!home.homework.length && <p className="mt-4 rounded-xl bg-background p-4 text-sm">{t('parentPortal.empty')}</p>}
                <ul className="divide-y divide-outline-variant">
                  {home.homework.map((item) => <li key={`${item.source}:${item.assignment_id}`} className="flex flex-wrap items-start justify-between gap-2 py-4">
                    <div className="min-w-0">
                      <p className="break-words font-bold">{item.title || t('parentPortal.homework')}</p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {t('parentPortal.publishedDate', { date: date(item.published_at) })}
                        {item.due_at ? ` · ${t('parentPortal.dueDate', { date: date(item.due_at) })}` : ''}
                      </p>
                      {item.completed_at && <p className="text-sm text-on-surface-variant">{t('parentPortal.completedDate', { date: date(item.completed_at) })}</p>}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === 'completed' ? 'bg-[#ddf6e8] text-[#155438]' : 'bg-primary-fixed text-deep-navy'}`}>
                      {t(`parentPortal.state_${item.status}`)}
                    </span>
                  </li>)}
                </ul>
              </section>
            ) : (
              <section className={card}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">{t('parentPortal.notices')}</h2>
                  {!!unreadCount && <button type="button" className={secondary} disabled={busy} onClick={() => void forActive(async (s) => {
                    await readParentNotices(s.token, home.snapshot);
                    setHomes((prev) => prev[s.id] ? { ...prev, [s.id]: { ...prev[s.id], read_through: home.snapshot } } : prev);
                    setRefresh((x) => x + 1);
                  })}>{t('parentPortal.markRead')}</button>}
                </div>
                {!notices.length && <p className="mt-4 rounded-xl bg-background p-4 text-sm">{t('parentPortal.emptyNotices')}</p>}
                <ul className="divide-y divide-outline-variant">
                  {notices.map(({ item, time, kind }) => <li key={`${item.source}:${item.assignment_id}:${kind}`} className="py-4">
                    <p className="font-bold">{t(`parentPortal.${kind}`)} {unread(time) && <span className="ml-1 text-xs font-bold text-primary">{t('parentPortal.new')}</span>}</p>
                    <p className="mt-1 break-words text-sm text-on-surface-variant">{item.title || t('parentPortal.homework')} · {date(time)}</p>
                  </li>)}
                </ul>
              </section>
            )}
          </>}
        </>}
      </div>
    </main>
  );
}
