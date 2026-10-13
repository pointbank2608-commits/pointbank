import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { TEACHER_QUICK, fetchChatMessages, openPingChannel, postChatMessage, studentChannelName, type ChatMessage } from '../../lib/soloChat';

/**
 * 선생님 쪽 대화창 — "지금 수업 현황"에서 학생 카드의 말풍선을 누르면 오른쪽에서 열린다(모달이 아니라 수업을 가리지 않는 옆 창).
 * 열려 있는 동안 학생이 쓰면 신호로 바로 새로 읽고, 열 때 학생이 보낸 메시지는 읽음 처리된다.
 */
export default function ChatDrawer({ assignmentId, name, onClose, onChanged }: { assignmentId: string; name: string; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const channel = useRef<ReturnType<typeof openPingChannel> | null>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await fetchChatMessages(assignmentId));
      onChanged();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    }
  }, [assignmentId, notify, onChanged]);

  useEffect(() => {
    void load();
    // 학생과 같은 채널: 학생이 보내면 선생님 학원 채널로도 신호가 오지만, 이 창은 학생별 채널로 다시 읽는다
    const ch = openPingChannel(studentChannelName(assignmentId), () => void load());
    channel.current = ch;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15000);
    return () => {
      ch.close();
      channel.current = null;
      window.clearInterval(timer);
    };
  }, [assignmentId, load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(body: string) {
    const b = body.trim();
    if (!b || busy) return;
    setBusy(true);
    try {
      await postChatMessage(assignmentId, b);
      setText('');
      await load();
      // 학생 화면에 "새 메시지" 신호(글은 보내지 않는다)
      channel.current?.send();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="fixed bottom-0 right-0 top-0 z-[60] flex w-full max-w-sm flex-col border-l border-outline-variant bg-surface-container-lowest shadow-2xl" role="complementary" aria-label={t('solo.chat_teacherTitle', { name })}>
      <div className="flex items-center gap-2 border-b border-outline-variant/50 px-4 py-3">
        <span className="material-symbols-outlined text-primary">forum</span>
        <h3 className="min-w-0 flex-1 truncate font-title-md text-title-md font-bold text-deep-navy">{t('solo.chat_teacherTitle', { name })}</h3>
        <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && <p className="py-8 text-center font-body-md text-body-md text-on-surface-variant">{t('solo.chat_teacherEmpty')}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.sender === 'teacher' ? 'items-end' : 'items-start'}`}>
            <span className={`max-w-[85%] rounded-2xl px-3 py-2 text-base ${m.sender === 'teacher' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'}`}>{m.body}</span>
            <span className="mt-0.5 font-caption text-caption text-on-surface-variant">{new Date(m.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t border-outline-variant/50 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {TEACHER_QUICK.map((q) => (
            <button key={q} type="button" disabled={busy} onClick={() => void send(q)} className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 font-label-md text-label-md text-primary disabled:opacity-50">
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <input
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('solo.chat_teacherPlaceholder')}
            className="min-h-11 min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-container-low px-4 text-base outline-none focus:border-primary"
          />
          <button type="submit" disabled={busy || !text.trim()} className="min-h-11 rounded-full bg-primary px-5 font-label-md text-label-md text-on-primary disabled:opacity-40">
            {t('solo.chat_send')}
          </button>
        </form>
      </div>
    </aside>
  );
}
