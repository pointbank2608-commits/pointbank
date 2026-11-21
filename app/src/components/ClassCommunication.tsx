import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { applicationServerKey, iosNeedsInstall, type Inquiry, type ParentChannel } from '../lib/parentPortal';
import InquiryBoard from './InquiryBoard';

const labels: Record<ParentChannel, [string, string]> = {
  published: ['숙제 발행', 'Homework assigned'], started: ['숙제 시작', 'Homework started'],
  completed: ['숙제 완료', 'Homework completed'], overdue: ['숙제 미완료', 'Homework incomplete'],
  attendance: ['출석·하원', 'Attendance'], feedback: ['피드백', 'Feedback'], inquiry: ['문의', 'Inquiries'],
};
type ClassInfo = {
  settings: Record<ParentChannel, boolean>; teacher: string | null; teachers: { id: string; name: string }[];
  threads: Inquiry[]; push_key: string | null; subscribed: boolean;
};
async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}
export default function ClassCommunication({ classId, userId, owner }: { classId: string; userId: string; owner: boolean }) {
  const { i18n } = useTranslation();
  const en = i18n.resolvedLanguage === 'en';
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('classId') === classId);
  const [data, setData] = useState<ClassInfo>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [candidate, setCandidate] = useState('');
  const [worker, setWorker] = useState<ServiceWorkerRegistration>();
  const seq = useRef(0);
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && !iosNeedsInstall();
  useEffect(() => {
    if (!open || !supported) return;
    let live = true;
    navigator.serviceWorker.register('/teacher-inquiry-sw.js', { scope: '/attendance' })
      .then(reg => {
        const worker = reg.installing ?? reg.waiting;
        if (!worker || reg.active) { if (live) setWorker(reg); return; }
        worker.addEventListener('statechange', () => {
          if (live && worker.state === 'activated') setWorker(reg);
        });
      })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [open, supported]);
  const refresh = useCallback(async () => {
    const id = ++seq.current;
    const sub = await worker?.pushManager.getSubscription();
    const next = await rpc('class_communication', { p_class: classId, p_endpoint: sub?.endpoint ?? null }) as ClassInfo;
    if (id === seq.current) { setData(next); setError(false); }
  }, [classId, worker]);
  useEffect(() => {
    if (!open) return;
    const load = () => { if (!document.hidden) void refresh().catch(() => setError(true)); };
    load();
    const timer = window.setInterval(load, 45000);
    document.addEventListener('visibilitychange', load);
    return () => { ++seq.current; clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [open, refresh]);
  async function act(action: () => Promise<unknown>) {
    setBusy(true); setError(false);
    try { await action(); await refresh(); } catch { setError(true); } finally { setBusy(false); }
  }
  const teacher = candidate || data?.teacher || userId;
  const change = (channel: ParentChannel, enabled: boolean, target = teacher) =>
    act(() => rpc('class_set_channel', { p_class: classId, p_channel: channel, p_enabled: enabled, p_teacher: target }));
  async function togglePush() {
    if (!worker || !data?.push_key) return;
    const sub = data.subscribed ? await worker.pushManager.getSubscription() : await worker.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: applicationServerKey(data.push_key),
    });
    if (!sub) return;
    const keys = sub.toJSON().keys;
    await rpc('teacher_set_inquiry_push', { p_endpoint: sub.endpoint, p_enabled: !data.subscribed,
      p_p256dh: keys?.p256dh, p_auth: keys?.auth, p_lang: en ? 'en' : 'ko' });
    if (data.subscribed) await sub.unsubscribe();
  }
  return <details open={open} onToggle={e => setOpen(e.currentTarget.open)} className="space-y-4 rounded-2xl border border-outline-variant bg-white p-4">
    <summary className="cursor-pointer font-bold">{en ? 'Class communication and parent inquiries' : '이 반의 학부모 소통 설정·문의'}</summary>
    {error && <p role="alert">{en ? 'Could not complete the request.' : '처리하지 못했어요.'} <button className="underline" onClick={() => void act(refresh)}>{en ? 'Retry' : '다시 불러오기'}</button></p>}
    {open && data && <>
      <fieldset disabled={busy} className="flex flex-wrap gap-3">
        {Object.entries(labels).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-2 rounded-lg bg-background px-3">
          <input type="checkbox" checked={data.settings[key as ParentChannel]} onChange={e => void change(key as ParentChannel, e.target.checked)} />
          {label[en ? 1 : 0]}
        </label>)}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">{en ? 'Teacher for inquiries' : '문의 담당 선생님'}
        <select value={teacher} disabled={busy || !owner} className="rounded-lg border p-2" onChange={e => {
          setCandidate(e.target.value);
          if (data.settings.inquiry) void change('inquiry', true, e.target.value);
        }}>{data.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </label>
      {data.settings.inquiry && data.teacher === userId && <>
        <button disabled={busy || !worker || !data.push_key} className="min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50"
          onClick={() => void act(togglePush)}>{data.subscribed ? (en ? 'Turn off inquiry push' : '이 기기 문의 푸시 끄기') : (en ? 'Enable inquiry push' : '이 기기 문의 푸시 켜기')}</button>
        {iosNeedsInstall() && <p>{en ? 'Open the teacher app from your Home Screen to enable push.' : '교사용 페이지를 홈 화면에 추가한 뒤 열어서 푸시를 켜 주세요.'}</p>}
        <InquiryBoard threads={data.threads} onAnswer={async (id, answer) => {
          await rpc('parent_answer', { p_class: classId, p_thread: id, p_answer: answer }); await refresh();
        }} />
      </>}
    </>}
  </details>;
}
