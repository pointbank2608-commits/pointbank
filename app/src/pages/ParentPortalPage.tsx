import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import InquiryBoard from '../components/InquiryBoard';
import BrandMark from '../components/BrandMark';
import {
  askTeacher, applicationServerKey, connectParent, inviteFromHash, inviteFromText, iosNeedsInstall, loadParent,
  logoutParent, ParentError, parentSessions, pushKey, readParentNotices, setFamilyPush, storeParentSessions,
  loginParent, type ParentHome, type ParentSession, type ParentNotice,
} from '../lib/parentPortal';
import { formatPhone } from '../lib/studentPortal';

const card = 'rounded-2xl border border-outline-variant bg-white p-4 shadow-card sm:p-6';
const primary = 'min-h-11 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50';
const secondary = 'min-h-11 rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-deep-navy disabled:opacity-50';

export default function ParentPortalPage() {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState(parentSessions);
  const [chosen, setChosen] = useState(() => new URLSearchParams(location.hash.slice(1)).get('child') ?? '');
  const [homes, setHomes] = useState<Record<string, ParentHome>>({});
  const [invite, setInvite] = useState(() => inviteFromHash() ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(() => !!inviteFromHash());
  const [installedRequired] = useState(iosNeedsInstall);
  const [selectedView, setView] = useState<'homework' | 'attendance' | 'notices' | 'inquiry'>(() =>
    new URLSearchParams(location.search).has('inquiry') ? 'inquiry' :
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
  const channels = home?.settings;
  const view = (selectedView === 'homework' && channels?.published === false) ||
    (selectedView === 'attendance' && channels?.attendance === false) ||
    (selectedView === 'inquiry' && !channels?.inquiry) ? 'notices' : selectedView;
  const en = i18n.resolvedLanguage === 'en';
  const applicationKey = home?.push_key ?? pushKey;
  const supportsPush = !installedRequired && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const hasSessions = sessions.length > 0;
  const familyReady = hasSessions && sessions.every((session) => !!homes[session.id]);
  const familyPushEnabled = familyReady && sessions.every((session) => homes[session.id].push_enabled);
  const formOpen = adding || !hasSessions;

  useEffect(() => {
    function acceptFragment() {
      const child = new URLSearchParams(location.hash.slice(1)).get('child');
      if (child) { setChosen(child); setView(new URLSearchParams(location.search).has('inquiry') ? 'inquiry' : 'notices'); }
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

  async function login() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await loginParent(name, phone);
      await Promise.allSettled(sessions.map((session) => logoutParent(session.token)));
      setSessions(result.sessions);
      setChosen(result.sessions[0]?.id ?? '');
      setHomes({});
      setName('');
      setPhone('');
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
    void forActive(async () => {
      let sub = subscription;
      if (!sub && !familyPushEnabled) {
        try {
          sub = await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(key) });
        } catch (error) {
          if (Notification.permission === 'denied') { setMessage('denied'); return; }
          throw error;
        }
      }
      if (!sub) return;
      await setFamilyPush(sessions, sub, !familyPushEnabled, i18n.resolvedLanguage ?? 'ko');
      setSubscription(sub);
      setRefresh((x) => x + 1);
    });
  }

  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ko-KR';
  function date(iso: string) {
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(iso));
  }
  const notices: ParentNotice[] = home?.notices ?? (home?.homework ?? []).flatMap((item): ParentNotice[] => [
    { source: item.source, assignment_id: item.assignment_id, title: item.title, body: null, details: {}, happened_at: item.published_at, kind: 'published' },
    ...(item.completed_at ? [{ source: item.source, assignment_id: item.assignment_id, title: item.title, body: null, details: {}, happened_at: item.completed_at, kind: 'completed' as const }] : []),
  ]).sort((a, b) => Date.parse(b.happened_at) - Date.parse(a.happened_at));
  const unread = (time: string) => !!home && Date.parse(time) > Date.parse(home.read_through);
  const unreadCount = notices.filter((notice) => unread(notice.happened_at)).length;
  function time(iso: string) {
    return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(iso));
  }

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
          <form className={`${card} space-y-3`} onSubmit={(e) => { e.preventDefault(); void login(); }}>
            <h2 className="text-lg font-bold">{t('parentPortal.loginTitle')}</h2>
            <p className="text-sm text-on-surface-variant">{t('parentPortal.loginHint')}</p>
            <label className="block space-y-1">
              <span className="text-sm font-bold">{t('parentPortal.guardianName')}</span>
              <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name"
                className="min-h-12 w-full rounded-xl border border-outline-variant px-3 py-3" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-bold">{t('parentPortal.guardianPhone')}</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} autoComplete="tel"
                className="min-h-12 w-full rounded-xl border border-outline-variant px-3 py-3" />
            </label>
            <div className="flex gap-2">
              <button className={primary} disabled={busy || !name.trim() || phone.replace(/\D/g, '').length < 10}>{t('parentPortal.login')}</button>
              {hasSessions && <button type="button" className={secondary} onClick={() => setAdding(false)}>{t('common.cancel')}</button>}
            </div>
            {installedRequired && <p className="rounded-xl bg-primary-fixed p-3 text-sm">{t('parentPortal.installLogin')}</p>}
          </form>
        )}
        {formOpen && !!invite && (
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
              onClick={() => void forActive(async () => {
                const results = await Promise.allSettled(sessions.map(async (session) => {
                  await logoutParent(session.token);
                  return session.id;
                }));
                const removed = new Set(results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []));
                setSessions((prev) => prev.filter((session) => !removed.has(session.id)));
                if (results.some((result) => result.status === 'rejected')) throw new ParentError('failed');
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
                        : familyPushEnabled ? t('parentPortal.pushOn') : t('parentPortal.pushHint')}</p>
              </div>
              {supportsPush && applicationKey && !workerFailed && <button type="button" className={familyPushEnabled ? secondary : primary}
                disabled={!worker || busy || !familyReady} onClick={togglePush}>{t(familyPushEnabled ? 'parentPortal.disable' : 'parentPortal.enable')}</button>}
            </section>
            <nav className="flex flex-wrap gap-2" aria-label={t('parentPortal.title')}>
              {channels?.published !== false && <button type="button" className={view === 'homework' ? primary : secondary}
                aria-pressed={view === 'homework'} onClick={() => setView('homework')}>{t('parentPortal.homework')}</button>}
              {channels?.attendance !== false && <button type="button" className={view === 'attendance' ? primary : secondary}
                aria-pressed={view === 'attendance'} onClick={() => setView('attendance')}>{t('parentPortal.attendance')}</button>}
              <button type="button" className={view === 'notices' ? primary : secondary}
                aria-pressed={view === 'notices'} onClick={() => setView('notices')}>
                {t('parentPortal.notices')}{unreadCount > 0 ? ` · ${unreadCount}` : ''}
              </button>
              {channels?.inquiry && <button className={view === 'inquiry' ? primary : secondary} aria-pressed={view === 'inquiry'}
                onClick={() => setView('inquiry')}>{en ? 'Ask your teacher' : '선생님께 문의하기'}</button>}
            </nav>
            {view === 'inquiry' ? <InquiryBoard key={active.id} threads={home.threads ?? []} onAsk={async (question, request) => {
              await askTeacher(active.token, request, question);
              setRefresh(x => x + 1);
            }} /> : view === 'homework' ? (
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
                      {item.daily && (item.daily.completed_at || channels?.started !== false) && item.status !== 'closed' && <p className="mt-1 text-sm font-bold text-primary">
                        {t(item.daily.completed_at ? 'parentPortal.dailyDone' : item.daily.started ? 'parentPortal.dailyStarted' : 'parentPortal.dailyPending', { day: item.daily.day })}
                      </p>}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === 'completed' ? 'bg-[#ddf6e8] text-[#155438]' : 'bg-primary-fixed text-deep-navy'}`}>
                      {t(`parentPortal.state_${item.status}`)}
                    </span>
                  </li>)}
                </ul>
              </section>
            ) : view === 'attendance' ? (
              <section className={card}>
                <h2 className="text-lg font-bold">{t('parentPortal.attendance')}</h2>
                <p className="mt-1 text-sm text-on-surface-variant">{t('parentPortal.attendanceHint')}</p>
                {!home.attendance?.length && <p className="mt-4 text-sm">{t('parentPortal.noAttendance')}</p>}
                <ul className="divide-y divide-outline-variant">
                  {home.attendance?.map((row) => <li key={row.id} className="space-y-1 py-4 text-sm">
                    <p className="font-bold">{date(row.day + 'T12:00:00+09:00')}</p>
                    <p>{row.present ? (row.checked_in_at ? t('parentPortal.arrivedAt', { time: time(row.checked_in_at) }) : t('parentPortal.presentRecorded')) : t('parentPortal.noArrival')}</p>
                    {row.checked_out_at && <p>{t('parentPortal.leftAt', { time: time(row.checked_out_at) })}</p>}
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
                  {notices.map((notice) => <li key={`${notice.source}:${notice.assignment_id}:${notice.kind}`} className="py-4">
                    <p className="font-bold">{t(`parentPortal.notice_${notice.kind}`)} {unread(notice.happened_at) && <span className="ml-1 text-xs font-bold text-primary">{t('parentPortal.new')}</span>}</p>
                    <p className="mt-1 break-words text-sm text-on-surface-variant">
                      {notice.title ? `${notice.title} · ` : ''}{date(notice.happened_at)}
                      {notice.details.day ? ` · ${t('parentPortal.recordDay', { day: notice.details.day })}` : ''}
                    </p>
                    {notice.kind === 'answered' && <button className="min-h-11 text-primary underline" onClick={() => {
                      const url = new URL(location.href);
                      url.searchParams.set('inquiry', notice.assignment_id);
                      history.replaceState(history.state, '', url);
                      setView('inquiry');
                    }}>{en ? 'View reply' : '답변 보기'}</button>}
                    {notice.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{notice.body}</p>}
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
