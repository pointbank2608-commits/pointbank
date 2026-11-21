import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Inquiry } from '../lib/parentPortal';

type Props = {
  threads: Inquiry[];
  onAsk?: (question: string, request: string) => Promise<void>;
  onAnswer?: (id: string, answer: string) => Promise<void>;
};

const inputStyle = 'w-full rounded-xl border border-outline-variant p-3';
const button = 'min-h-11 rounded-xl bg-primary px-4 font-bold text-white disabled:opacity-50';

export default function InquiryBoard({ threads, onAsk, onAnswer }: Props) {
  const { i18n } = useTranslation();
  const en = i18n.resolvedLanguage === 'en';
  const [question, setQuestion] = useState('');
  const [request, setRequest] = useState(() => crypto.randomUUID());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const target = new URLSearchParams(location.search).get('inquiry');
  const targetLoaded = threads.some(thread => thread.id === target);
  useEffect(() => {
    if (targetLoaded) document.getElementById('inquiry-' + target)?.focus();
  }, [target, targetLoaded]);
  async function send(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(false);
    try { await action(); } catch { setError(true); } finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-2xl border border-outline-variant bg-white p-4">
    <h2 className="font-bold">{onAsk ? (en ? 'Ask your teacher' : '선생님께 문의하기') : (en ? 'Parent inquiries' : '학부모 문의')}</h2>
    {onAsk && <form className="space-y-2" onSubmit={e => {
      e.preventDefault();
      void send(async () => { await onAsk(question.trim(), request); setQuestion(''); setRequest(crypto.randomUUID()); });
    }}>
      <textarea className={inputStyle} aria-label={en ? 'Question' : '문의 내용'} placeholder={en ? 'Write a private question' : '담당 선생님께 보낼 문의를 작성하세요'}
        maxLength={2000} value={question} disabled={busy} onChange={e => { setQuestion(e.target.value); setRequest(crypto.randomUUID()); }} />
      <button className={button} disabled={busy || !question.trim()}>{en ? 'Send question' : '문의 보내기'}</button>
    </form>}
    {error && <p role="alert">{en ? 'Could not send. Check your connection and class settings.' : '전송하지 못했어요. 연결 상태와 반의 문의 설정을 확인해 주세요.'}</p>}
    {!threads.length && <p className="text-sm text-on-surface-variant">{en ? 'No inquiries yet.' : '아직 문의가 없어요.'}</p>}
    {threads.map(i => <article id={'inquiry-' + i.id} tabIndex={-1} key={i.id} className="space-y-2 border-t border-outline-variant pt-3">
      <p className="text-sm font-bold">{i.name} {new Date(i.created_at).toLocaleDateString(en ? 'en' : 'ko-KR')} · {i.answer ? (en ? 'Answered' : '답변 완료') : (en ? 'Awaiting reply' : '답변 대기')}</p>
      <p className="whitespace-pre-wrap break-words">{i.question}</p>
      {i.answer && <p className="whitespace-pre-wrap break-words rounded-xl bg-background p-3"><strong>{en ? 'Teacher reply' : '선생님 답변'}</strong><br />{i.answer}</p>}
      {onAnswer && !i.answer && <form className="space-y-2" onSubmit={e => {
        e.preventDefault(); void send(() => onAnswer(i.id, drafts[i.id].trim()));
      }}>
        <textarea className={inputStyle} aria-label={en ? 'Reply' : '답변 내용'} disabled={busy} maxLength={2000} value={drafts[i.id] ?? ''}
          onChange={e => setDrafts({ ...drafts, [i.id]: e.target.value })} />
        <button className={button} disabled={busy || !drafts[i.id]?.trim()}>{en ? 'Send reply' : '답변 보내기'}</button>
      </form>}
    </article>)}
  </section>;
}
