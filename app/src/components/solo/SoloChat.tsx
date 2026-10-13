import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STUDENT_QUICK,
  openPingChannel,
  studentChannelName,
  studentChatSend,
  studentChatState,
  teacherChannelName,
  type ChatMessage,
  type ChatMode,
} from '../../lib/soloChat';

/**
 * 학생 화면의 선생님 채팅(1차) — 위쪽 말풍선 버튼 + 안 읽은 점. 새 메시지가 오면 작은 띠로만 알리고(문제 풀이를 끊지 않는다),
 * 버튼을 눌러야 아래에서 올라오는 작은 창이 열린다. 반이 "끔"이면 아무것도 그리지 않는다.
 * 빠른 문장만 되는 반(유치원)은 문장 버튼만 보이고 입력칸이 없다.
 */
export default function SoloChat({ token, assignment }: { token: string; assignment: string }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ChatMode>('off');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openRef = useRef(false);
  const academyRef = useRef<string | null>(null);
  const teacherPing = useRef<ReturnType<typeof openPingChannel> | null>(null);
  const lastSeen = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  openRef.current = open;

  const refresh = useCallback(
    async (mark = false) => {
      try {
        const st = await studentChatState(token, assignment, mark);
        if (st.error) {
          setMode('off');
          return;
        }
        setMode(st.mode);
        if (st.academy_id) academyRef.current = st.academy_id;
        const list = st.messages ?? [];
        setMessages(list);
        setUnread(st.unread ?? 0);
        const newest = list.filter((m) => m.sender === 'teacher').reduce((n, m) => Math.max(n, m.id), 0);
        if (newest > lastSeen.current && lastSeen.current !== 0 && !openRef.current) {
          setToast(true);
          window.setTimeout(() => setToast(false), 6000);
        }
        if (newest > 0) lastSeen.current = Math.max(lastSeen.current, newest);
        else if (lastSeen.current === 0) lastSeen.current = -1;
      } catch {
        /* 072 전이거나 네트워크 문제 — 채팅만 조용히 숨긴다 */
        setMode('off');
      }
    },
    [token, assignment],
  );

  // 처음 읽기 + 신호 구독 + 느린 예비 확인(30초)
  useEffect(() => {
    void refresh();
    const ch = openPingChannel(studentChannelName(assignment), () => void refresh(openRef.current));
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(openRef.current);
    }, 30000);
    return () => {
      ch.close();
      teacherPing.current?.close();
      teacherPing.current = null;
      window.clearInterval(timer);
    };
  }, [assignment, refresh]);

  useEffect(() => {
    if (open) {
      setToast(false);
      void refresh(true);
    }
  }, [open, refresh]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  async function send(body: string, quick: boolean) {
    const b = body.trim();
    if (!b || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await studentChatSend(token, assignment, b, quick);
      if (r.error) {
        setError(t(`solo.chat_err_${r.error}`, { defaultValue: t('solo.chat_err_unknown') }));
        return;
      }
      setText('');
      await refresh(true);
      // 선생님 쪽에 "새 메시지" 신호(글은 보내지 않는다)
      if (academyRef.current) {
        if (!teacherPing.current) teacherPing.current = openPingChannel(teacherChannelName(academyRef.current), () => undefined);
        const ping = teacherPing.current;
        window.setTimeout(() => ping.send(), 400);
      }
    } catch {
      setError(t('solo.chat_err_unknown'));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'off') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('solo.chat_open')}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white/90 hover:bg-white/10"
      >
        <span className="material-symbols-outlined text-[20px]">chat</span>
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#16213e] bg-rose-500" aria-hidden="true" />}
      </button>

      {toast && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed left-1/2 top-16 z-[60] -translate-x-1/2 rounded-full bg-warm-yellow px-5 py-2 text-base font-bold text-deep-navy shadow-lg"
        >
          {t('solo.chat_new')}
        </button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-[65] mx-auto flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white text-deep-navy shadow-[0_-8px_30px_rgba(0,0,0,0.35)]" role="dialog" aria-label={t('solo.chat_title')}>
          <div className="flex items-center gap-2 border-b border-deep-navy/10 px-4 py-3">
            <span className="material-symbols-outlined text-primary">chat</span>
            <h3 className="flex-1 text-lg font-bold">{t('solo.chat_title')}</h3>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-deep-navy/10">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div ref={listRef} className="min-h-[8rem] flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {messages.length === 0 && <p className="py-6 text-center text-base text-deep-navy/60">{t('solo.chat_empty')}</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === 'student' ? 'justify-end' : 'justify-start'}`}>
                <span className={`max-w-[80%] rounded-2xl px-4 py-2 text-lg ${m.sender === 'student' ? 'bg-primary text-on-primary' : 'bg-[#fff3c4] text-deep-navy'}`}>{m.body}</span>
              </div>
            ))}
          </div>
          {error && <p className="px-4 text-sm font-bold text-rose-600">{error}</p>}
          <div className="space-y-2 border-t border-deep-navy/10 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {STUDENT_QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(q, true)}
                  className="min-h-11 rounded-full border border-primary/40 bg-primary/5 px-4 text-base font-bold text-primary disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            {mode === 'free' && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(text, false);
                }}
              >
                <input
                  value={text}
                  maxLength={200}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t('solo.chat_placeholder')}
                  className="min-h-12 min-w-0 flex-1 rounded-full border border-deep-navy/20 px-4 text-lg outline-none focus:border-primary"
                />
                <button type="submit" disabled={busy || !text.trim()} className="min-h-12 rounded-full bg-primary px-5 text-lg font-bold text-on-primary disabled:opacity-40">
                  {t('solo.chat_send')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
