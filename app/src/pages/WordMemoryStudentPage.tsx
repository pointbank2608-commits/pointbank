import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QuestionCard from '../components/homework/QuestionCard';
import WordMemoryCollection from '../components/wordMemory/WordMemoryCollection';
import type { HwQuestion } from '../lib/homework/types';
import { speak } from '../lib/speech';
import { wmAck, wmAnswer, wmCollection, wmHint, wmOpen, wmToday, WmError, toWmError } from '../lib/wordMemory/api';
import type { WmAnswerResult, WmCollectionWord, WmHint, WmItem, WmOpen, WmStageCounts, WmToday } from '../lib/wordMemory/types';

type View = 'loading' | 'error' | 'home' | 'run' | 'done' | 'ended' | 'collection';

const toQuestion = (sessionId: string, it: WmItem): HwQuestion => ({
  id: `${sessionId}:${it.i}`,
  qtype: it.qtype ?? 'choice',
  style: it.style,
  prompt: it.prompt ?? '',
  sub: it.sub,
  imageUrl: it.imageUrl ?? null,
  speak: it.speak ?? null,
  choices: it.choices,
  tokens: it.tokens,
  joiner: it.joiner,
  skill: '',
  word: '',
  gen: 'wm',
});

/**
 * 학생의 단어암기숙제(/wm/:열쇠, 로그인 없음). 오늘 학습은 서버가 정하고(복습·어려운 단어·새 단어), 이 화면은 하나씩 보여 주고 답만 보낸다.
 * 새로고침·재접속하면 서버에 저장된 오늘 학습을 이어서 한다. 답은 요청 번호로 한 번만 기록되고, 네트워크가 끊기면 같은 번호로 다시 보낸다.
 */
export default function WordMemoryStudentPage() {
  const { access = '' } = useParams();
  const { t } = useTranslation();
  const [view, setView] = useState<View>('loading');
  const [error, setError] = useState<WmError | null>(null);
  const [info, setInfo] = useState<WmOpen | null>(null);
  const [today, setToday] = useState<WmToday | null>(null);
  const [feedback, setFeedback] = useState<WmAnswerResult | null>(null);
  const [hint, setHint] = useState<{ q: number; hint: WmHint } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [collection, setCollection] = useState<{ stages: WmStageCounts; words: WmCollectionWord[] } | null>(null);
  const pending = useRef<{ q: number; response: string; clientId: string } | null>(null);

  const fail = useCallback((e: unknown) => {
    const err = e instanceof WmError ? e : toWmError(e);
    setError(err);
    setView('error');
  }, []);

  const refresh = useCallback(async () => {
    const day = await wmToday(access);
    setToday(day);
    return day;
  }, [access]);

  const settle = useCallback((day: WmToday): View => (day.ended ? 'ended' : day.items.some((i) => i.state === 'todo') ? 'run' : 'done'), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [o, d] = await Promise.all([wmOpen(access), wmToday(access)]);
        if (!alive) return;
        setInfo(o);
        setToday(d);
        setView(d.ended ? 'ended' : d.items.some((i) => i.state === 'todo') ? 'home' : 'done');
      } catch (e) {
        if (alive) fail(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [access, fail]);

  const items = today?.items ?? [];
  const current = items.find((i) => i.state === 'todo') ?? null;
  const doneCount = items.filter((i) => i.state === 'done').length;
  const asksLeft = items.filter((i) => i.state === 'todo' && i.kind === 'ask').length;
  const studyCount = items.filter((i) => i.kind === 'study').length;

  const next = useCallback(async () => {
    setFeedback(null);
    setHint(null);
    setSendError(false);
    pending.current = null;
    try {
      const day = await refresh();
      setView(settle(day));
    } catch (e) {
      if (e instanceof WmError && e.kind === 'stale') return;
      fail(e);
    }
  }, [refresh, settle, fail]);

  async function send(q: number, response: string, clientId: string) {
    if (!today) return;
    setBusy(true);
    setSendError(false);
    try {
      const r = await wmAnswer(access, today.session_id, q, response, clientId);
      pending.current = null;
      setFeedback(r);
    } catch (e) {
      const err = toWmError(e);
      if (err.kind === 'network' || err.kind === 'unknown') {
        setSendError(true); // 같은 요청 번호로 다시 보낸다
      } else if (err.kind === 'stale') {
        await next();
      } else {
        fail(err);
      }
    } finally {
      setBusy(false);
    }
  }

  function onAnswer(response: string) {
    if (!current || busy || feedback) return;
    pending.current = { q: current.i, response, clientId: crypto.randomUUID() };
    void send(current.i, response, pending.current.clientId);
  }

  async function onAck() {
    if (!current || !today || busy) return;
    setBusy(true);
    try {
      await wmAck(access, today.session_id, current.i, crypto.randomUUID());
      await next();
    } catch (e) {
      const err = toWmError(e);
      if (err.kind === 'network' || err.kind === 'unknown') setSendError(true);
      else fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onHint() {
    if (!current || !today || busy) return;
    try {
      const h = await wmHint(access, today.session_id, current.i);
      setHint({ q: current.i, hint: h });
      await refresh();
    } catch (e) {
      const err = toWmError(e);
      if (err.kind !== 'network') fail(err);
    }
  }

  async function openCollection() {
    try {
      setCollection(await wmCollection(access));
      setView('collection');
    } catch (e) {
      fail(e);
    }
  }

  const eliminated = useMemo(() => {
    if (!current) return [];
    const fromHint = hint && hint.q === current.i && hint.hint.type === 'eliminate' && typeof hint.hint.index === 'number' ? [hint.hint.index] : [];
    return [...new Set([...(current.elim ?? []), ...fromHint])];
  }, [current, hint]);
  const hintText = current ? (hint && hint.q === current.i && hint.hint.text ? hint.hint.text : current.hint) : undefined;
  const canHint = !!current && current.kind === 'ask' && !feedback && !(current.qtype === 'choice' && eliminated.length >= (current.choices?.length ?? 0) - 2);

  const shell = 'mx-auto flex min-h-dvh w-full max-w-xl flex-col break-keep bg-[#16213e] text-white';
  const big = 'min-h-14 rounded-full bg-warm-yellow px-8 text-xl font-bold text-deep-navy shadow-lg disabled:opacity-60';

  if (view === 'loading') {
    return (
      <div className={shell} data-wm-view="loading">
        <p className="m-auto text-lg">{t('wordMemory.loading')}</p>
      </div>
    );
  }
  if (view === 'error') {
    const key = ({ not_found: 'errNotFound', closed: 'errClosed', feature_closed: 'stErrFeatureClosed', network: 'stErrNetwork', stale: 'errStale' } as Record<string, string>)[error?.kind ?? ''] ?? 'stErrUnknown';
    return (
      <div className={shell} data-wm-view="error">
        <div className="m-auto flex flex-col items-center gap-4 p-6 text-center">
          <span className="material-symbols-outlined text-[56px] text-warm-yellow" aria-hidden>
            info
          </span>
          <p role="alert" className="text-xl font-bold">
            {t(`wordMemory.${key}`)}
          </p>
          {(error?.kind === 'network' || error?.kind === 'unknown') && (
            <button type="button" className={big} onClick={() => window.location.reload()}>
              {t('wordMemory.retry')}
            </button>
          )}
        </div>
      </div>
    );
  }
  if (view === 'collection' && collection) {
    return (
      <div className={shell} data-wm-view="collection">
        <WordMemoryCollection words={collection.words} stages={collection.stages} onBack={() => setView(today && settle(today) === 'run' ? 'home' : today?.ended ? 'ended' : 'done')} />
      </div>
    );
  }
  if (view === 'ended') {
    return (
      <div className={shell} data-wm-view="ended">
        <div className="m-auto flex flex-col items-center gap-4 p-6 text-center">
          <span className="material-symbols-outlined text-[64px] text-warm-yellow" aria-hidden>
            emoji_events
          </span>
          <h1 className="text-2xl font-bold">{t('wordMemory.endedTitle')}</h1>
          <p className="text-lg text-white/80">{t('wordMemory.endedBody')}</p>
          <button type="button" className={big} onClick={() => void openCollection()}>
            {t('wordMemory.collection')}
          </button>
        </div>
      </div>
    );
  }
  if (view === 'home' && today && info) {
    const started = doneCount > 0;
    const c = today.counts;
    return (
      <div className={shell} data-wm-view="home">
        <div className="flex flex-1 flex-col gap-5 p-5">
          <div className="text-center">
            <div className="text-lg text-white/80">{t('wordMemory.hello', { name: info.student_name })}</div>
            <h1 className="mt-1 text-2xl font-bold">{info.title || t('wordMemory.title')}</h1>
          </div>
          <ul className="grid grid-cols-3 gap-2 text-center" aria-label={t('wordMemory.title')}>
            {([['todayReview', c.review], ['todayHard', c.hard], ['todayNew', c.new]] as const).map(([k, n]) => (
              <li key={k} className="rounded-2xl bg-white/10 p-3">
                <div className="text-3xl font-bold tabular-nums">{n}</div>
                <div className="break-keep text-sm text-white/80">{t(`wordMemory.${k}`)}</div>
              </li>
            ))}
          </ul>
          <p className="text-center text-base text-white/80">{t('wordMemory.startNote', { asks: today.counts.asks, study: studyCount })}</p>
          {c.review + c.hard === 0 && info.stages.seen + info.stages.practicing + info.stages.alone + info.stages.kept === 0 && <p className="rounded-2xl bg-white/10 p-3 text-center text-base">{t('wordMemory.firstDays')}</p>}
          {started && <p className="text-center text-base text-emerald-200">{t('wordMemory.remaining', { count: asksLeft })}</p>}
          <button type="button" className={`${big} mt-auto`} onClick={() => setView('run')} data-wm-start>
            {started ? t('wordMemory.resume') : t('wordMemory.start')}
          </button>
          <button type="button" className="min-h-12 rounded-full bg-white/15 text-base font-bold" onClick={() => void openCollection()}>
            {t('wordMemory.collection')}
          </button>
        </div>
      </div>
    );
  }
  if (view === 'done' && today) {
    const empty = today.items.length === 0;
    return (
      <div className={shell} data-wm-view="done">
        <div className="m-auto flex w-full flex-col items-center gap-4 p-6 text-center">
          <span className="material-symbols-outlined text-[64px] text-warm-yellow" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>
            {empty ? 'bedtime' : 'celebration'}
          </span>
          <h1 className="text-2xl font-bold">{empty ? t('wordMemory.nothingToday') : t('wordMemory.doneTitle')}</h1>
          {!empty && <p className="text-lg text-white/80">{t('wordMemory.doneBody')}</p>}
          <ul className="flex flex-col gap-1 text-base text-white/85">
            {today.waiting_review > 0 && <li>{t('wordMemory.waitingReview', { count: today.waiting_review })}</li>}
            {today.unseen > 0 && <li>{t('wordMemory.unseenLeft', { count: today.unseen })}</li>}
            {today.next_due && <li>{t('wordMemory.nextDue', { date: today.next_due.slice(5).replace('-', '/') })}</li>}
          </ul>
          <button type="button" className={big} onClick={() => void openCollection()} data-wm-open-collection>
            {t('wordMemory.collection')}
          </button>
        </div>
      </div>
    );
  }

  /* ---- run ---- */
  if (!today || !current) return <div className={shell} />;
  const total = items.length;
  return (
    <div className={shell} data-wm-view="run" data-wm-kind={current.kind} data-wm-q={current.i}>
      <div className="sticky top-0 z-10 bg-[#16213e]/95 px-4 pb-2 pt-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={total}>
            <div className="h-full rounded-full bg-warm-yellow transition-all" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
          </div>
          <span className="text-base font-bold tabular-nums">{t('wordMemory.progress', { done: doneCount, total })}</span>
        </div>
      </div>

      {current.kind === 'study' ? (
        <div className="flex flex-1 flex-col items-center gap-4 p-6 text-center" data-wm-study>
          <div className="rounded-full bg-sky-400/25 px-4 py-1 text-base font-bold text-sky-100">{t('wordMemory.newWord')}</div>
          {current.imageUrl && <img src={current.imageUrl} alt="" className="h-40 w-40 rounded-2xl bg-white object-contain p-2" />}
          <div lang="en" className="text-5xl font-bold">
            {current.word}
          </div>
          <div className="text-3xl">{current.meaning}</div>
          {current.pos && <div className="text-base text-white/70">({current.pos})</div>}
          <button type="button" onClick={() => speak(current.speak || current.word || '')} className="flex min-h-12 items-center gap-2 rounded-full bg-warm-yellow px-5 text-lg font-bold text-deep-navy">
            <span className="material-symbols-outlined" aria-hidden>
              volume_up
            </span>
            {t('wordMemory.listen')}
          </button>
          {current.example && (
            <p lang="en" className="max-w-sm text-xl text-white/90">
              {current.example}
            </p>
          )}
          {sendError && (
            <p role="alert" className="text-base text-warm-yellow">
              {t('wordMemory.saveFailedRetry')}
            </p>
          )}
          <button type="button" className={`${big} mt-auto w-full`} disabled={busy} onClick={() => void onAck()} data-wm-ack>
            {t('wordMemory.gotIt')}
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          {current.retry && <div className="mx-4 mt-2 rounded-xl bg-white/10 px-3 py-1.5 text-center text-sm">{t('wordMemory.requeued')}</div>}
          <QuestionCard key={`${today.session_id}:${current.i}`} q={toQuestion(today.session_id, current)} onAnswer={onAnswer} disabled={busy || !!feedback} eliminated={eliminated} />
          {hintText && !feedback && (
            <p className="px-5 text-center text-lg font-bold text-warm-yellow" aria-live="polite" data-wm-hint>
              {current.qtype === 'order' ? t('wordMemory.hintFirst', { text: hintText }) : t('wordMemory.hintLetters', { text: hintText })}
            </p>
          )}
          {canHint && (
            <div className="flex flex-col items-center gap-1 px-5 pb-3">
              <button type="button" className="min-h-11 rounded-full bg-white/15 px-5 text-base font-bold" onClick={() => void onHint()} disabled={busy} data-wm-hint-btn>
                {t('wordMemory.hint')}
              </button>
              <span className="text-xs text-white/60">{t('wordMemory.hintUsed')}</span>
            </div>
          )}
          {sendError && (
            <div className="flex flex-col items-center gap-2 px-5 pb-4" role="alert">
              <p className="text-base text-warm-yellow">{t('wordMemory.saveFailedRetry')}</p>
              <button type="button" className={big} onClick={() => pending.current && void send(pending.current.q, pending.current.response, pending.current.clientId)} data-wm-resend>
                {t('wordMemory.retry')}
              </button>
            </div>
          )}
          {feedback && (
            <div className={`mx-4 mb-4 flex flex-col gap-2 rounded-2xl p-4 text-center ${feedback.correct ? 'bg-emerald-600/80' : 'bg-rose-700/80'}`} role="status" data-wm-feedback={feedback.correct ? 'right' : 'wrong'}>
              <div className="flex items-center justify-center gap-2 break-keep text-xl font-bold">
                <span className="material-symbols-outlined" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>
                  {feedback.correct ? 'check_circle' : 'info'}
                </span>
                {feedback.correct ? t('wordMemory.correct') : t('wordMemory.wrong', { answer: feedback.answer })}
              </div>
              {!feedback.correct && <p className="text-base">{feedback.requeued ? t('wordMemory.requeued') : t('wordMemory.tomorrow')}</p>}
              {feedback.example && (
                <p lang="en" className="text-lg">
                  {feedback.example}
                </p>
              )}
              <button type="button" className="min-h-12 rounded-full bg-white text-lg font-bold text-deep-navy" onClick={() => void next()} data-wm-next>
                {t('wordMemory.next')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
