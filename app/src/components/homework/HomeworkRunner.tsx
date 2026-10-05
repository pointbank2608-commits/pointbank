import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSfx } from '../../lib/gameSfx';
import type { HwItem } from '../../lib/homework/types';
import MatchupGame from './MatchupGame';
import QuestionCard from './QuestionCard';
import { answerKey, type AnswerResult, type RunnerApi, type SaveState } from './runnerTypes';
import ShadowingActivity from './ShadowingActivity';

const SFX_CORRECT = 4015;
const SFX_WRONG = 4025;
const SFX_FINISH = 5037;

type Phase = { k: 'intro' } | { k: 'item'; i: number; sub: 'lines' | 'questions' } | { k: 'finishing'; error?: boolean } | { k: 'done'; score: number; total: number } | { k: 'retry'; keys: string[]; pos: number };

/**
 * 숙제 한 개를 처음부터 끝까지(학생 화면·선생님 미리보기 공용). 활동을 차례로: 쉐도잉 → 퀴즈 → 워크시트 → 게임.
 * 답은 하나씩 api.submit 으로 보내고(서버 채점), 맞히면 저절로 다음, 틀리면 정답을 보여 주고 "다음".
 * 이미 낸 답·끝낸 활동은 건너뛰어 이어 푼다. 끝나면 점수·틀린 낱말·"틀린 것 다시 풀기"(점수는 그대로, 따로 기록).
 */
export default function HomeworkRunner({
  title,
  studentName,
  items,
  initialAnswers,
  finishedItems,
  shadowLinesDone,
  alreadyFinished,
  api,
  saveState,
  preview = false,
}: {
  title: string;
  studentName?: string;
  items: HwItem[];
  initialAnswers: Map<string, AnswerResult>;
  finishedItems: Set<string>;
  shadowLinesDone: Map<string, number>;
  alreadyFinished: boolean;
  api: RunnerApi;
  saveState: SaveState;
  preview?: boolean;
}) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState(initialAnswers);
  const [doneItems, setDoneItems] = useState(finishedItems);
  const [phase, setPhase] = useState<Phase>(() => (alreadyFinished ? { k: 'finishing' } : { k: 'intro' }));
  const [feedback, setFeedback] = useState<(AnswerResult & { key: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(performance.now());

  const total = useMemo(() => items.reduce((n, it) => n + it.content.questions.length, 0), [items]);
  const answeredCount = useMemo(() => items.reduce((n, it) => n + it.content.questions.filter((_, qi) => answers.has(answerKey(it.id, qi))).length, 0), [items, answers]);

  // 이미 끝난 숙제를 다시 열면 결과 화면으로
  useEffect(() => {
    if (phase.k === 'finishing' && !phase.error) void doFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstOpenItem = () => items.findIndex((it) => !doneItems.has(it.id));

  function openItem(i: number) {
    if (i < 0 || i >= items.length) {
      void doFinish();
      return;
    }
    const it = items[i];
    const linesLeft = it.kind === 'shadowing' && (shadowLinesDone.get(it.id) ?? 0) < (it.content.lines?.length ?? 0);
    setPhase({ k: 'item', i, sub: linesLeft ? 'lines' : 'questions' });
    shownAt.current = performance.now();
  }

  async function completeItem(i: number) {
    const it = items[i];
    setBusy(true);
    try {
      await api.progress(it.id, 'item_complete', {});
    } catch {
      setBusy(false);
      return;
    }
    setBusy(false);
    const next = new Set(doneItems).add(it.id);
    setDoneItems(next);
    const n = items.findIndex((x) => !next.has(x.id));
    if (n < 0) void doFinish();
    else openItem(n);
  }

  async function doFinish() {
    setPhase({ k: 'finishing' });
    try {
      const r = await api.finish();
      if (r.answers) setAnswers(r.answers);
      playSfx(SFX_FINISH);
      setPhase({ k: 'done', score: r.score, total: r.total });
    } catch {
      setPhase({ k: 'finishing', error: true });
    }
  }

  async function answer(itemId: string, qi: number, response: string) {
    if (busy) return;
    setBusy(true);
    const ms = performance.now() - shownAt.current;
    try {
      const res = await api.submit(itemId, qi, response, ms);
      const key = answerKey(itemId, qi);
      if (phase.k !== 'retry') setAnswers((m) => new Map(m).set(key, m.get(key) ?? res));
      if (res.correct !== null) playSfx(res.correct ? SFX_CORRECT : SFX_WRONG);
      setFeedback({ ...res, key });
    } catch {
      /* 숙제가 닫혔거나 저장 실패 — 바깥 화면이 안내한다 */
    } finally {
      setBusy(false);
    }
  }

  function afterFeedback() {
    setFeedback(null);
    shownAt.current = performance.now();
    if (phase.k === 'retry') {
      if (phase.pos + 1 < phase.keys.length) setPhase({ ...phase, pos: phase.pos + 1 });
      else void doFinish();
      return;
    }
    if (phase.k !== 'item') return;
    const it = items[phase.i];
    const nextQ = it.content.questions.findIndex((_, qi) => !answers.has(answerKey(it.id, qi)));
    if (nextQ < 0) void completeItem(phase.i);
  }

  // 맞히면 잠깐 뒤 저절로 다음
  useEffect(() => {
    if (feedback?.correct !== true) return;
    const id = window.setTimeout(afterFeedback, 900);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  const header = (
    <div className="sticky top-0 z-10 bg-[#16213e]/95 px-4 pb-2 pt-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={answeredCount} aria-valuemin={0} aria-valuemax={total}>
          <div className="h-full rounded-full bg-warm-yellow transition-all" style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }} />
        </div>
        <span className="text-base font-bold tabular-nums">
          {answeredCount} / {total}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm text-white/70">
        <span className="truncate">{phase.k === 'item' ? itemLabel(items[phase.i]) : title}</span>
        <SaveBadge state={preview ? 'saved' : saveState} preview={preview} />
      </div>
    </div>
  );

  function itemLabel(it: HwItem) {
    return it.title || t(`studentHw.kind_${it.kind}`);
  }

  // ---------- 화면 ----------
  if (phase.k === 'intro') {
    const started = answeredCount > 0 || doneItems.size > 0;
    return (
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="text-center">
          {studentName && <div className="text-lg text-white/80">{t('studentHw.hello', { name: studentName })}</div>}
          <div className="mt-1 text-2xl font-bold">{title || t('studentHw.defaultTitle')}</div>
          {started && <div className="mt-2 rounded-full bg-emerald-600/80 px-4 py-1.5 text-base">{t('studentHw.resumeNote')}</div>}
        </div>
        <ol className="flex flex-col gap-2">
          {items.map((it, i) => (
            <li key={it.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/10 px-4">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold ${doneItems.has(it.id) ? 'bg-emerald-500' : 'bg-white/20'}`}>
                {doneItems.has(it.id) ? '✓' : i + 1}
              </span>
              <span className="flex-1 text-lg">{itemLabel(it)}</span>
              <span className="text-sm text-white/60">{it.kind === 'shadowing' ? t('studentHw.linesN', { n: it.content.lines?.length ?? 0 }) : t('studentHw.questionCount', { count: it.content.questions.length })}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => openItem(firstOpenItem())} className="mt-auto min-h-14 rounded-full bg-warm-yellow text-xl font-bold text-deep-navy shadow-lg">
          {started ? t('studentHw.continue') : t('studentHw.start')}
        </button>
      </div>
    );
  }

  if (phase.k === 'finishing') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        {phase.error ? (
          <>
            <span className="material-symbols-outlined text-[56px] text-warm-yellow">wifi_off</span>
            <p className="text-xl font-bold">{t('studentHw.finishOffline')}</p>
            <button type="button" onClick={() => void doFinish()} className="min-h-14 rounded-full bg-warm-yellow px-8 text-lg font-bold text-deep-navy">
              {t('studentHw.tryAgain')}
            </button>
          </>
        ) : (
          <p className="text-lg text-white/80">{t('studentHw.finishing')}</p>
        )}
      </div>
    );
  }

  if (phase.k === 'done') {
    const ratio = phase.total ? phase.score / phase.total : 1;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1;
    const wrongKeys = items.flatMap((it) => it.content.questions.map((_, qi) => answerKey(it.id, qi)).filter((k) => answers.get(k)?.correct === false));
    const qOf = (k: string) => {
      const [id, qi] = k.split(':');
      return items.find((x) => x.id === id)?.content.questions[Number(qi)];
    };
    return (
      <div className="flex flex-1 flex-col items-center gap-4 p-5 text-center">
        <div className="flex gap-2 pt-2" aria-label={t('studentHw.starsN', { n: stars })}>
          {[1, 2, 3].map((s) => (
            <span key={s} className="material-symbols-outlined text-[52px]" style={{ color: s <= stars ? '#fcd34d' : 'rgba(255,255,255,0.2)', fontVariationSettings: "'FILL' 1" }}>
              star
            </span>
          ))}
        </div>
        <div className="text-2xl font-bold">{t('studentHw.doneTitle')}</div>
        {phase.total > 0 && (
          <div className="text-5xl font-bold tabular-nums">
            {phase.score} <span className="text-2xl text-white/60">/ {phase.total}</span>
          </div>
        )}
        {wrongKeys.length > 0 && (
          <div className="w-full max-w-md space-y-2 rounded-2xl bg-white/10 p-4 text-left">
            <div className="text-lg font-bold">{t('studentHw.wrongList')}</div>
            {wrongKeys.map((k) => {
              const q = qOf(k);
              const ans = answers.get(k)?.answer ?? '';
              const left = q?.word || q?.prompt || '';
              // 정답이 낱말 그대로면(듣기·철자·글자 순서) 뜻을 대신 보여 준다
              const right = ans.trim().toLowerCase() === left.trim().toLowerCase() ? (q?.card?.meaning ?? '') : ans;
              return (
                <div key={k} className="flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-base">
                  <span className="truncate">{left}</span>
                  <span className="min-w-0 truncate text-right font-bold text-warm-yellow">{right}</span>
                </div>
              );
            })}
            <button type="button" onClick={() => setPhase({ k: 'retry', keys: wrongKeys, pos: 0 })} className="mt-2 min-h-12 w-full rounded-full bg-warm-yellow text-lg font-bold text-deep-navy">
              {t('studentHw.retryWrong')}
            </button>
            <p className="text-sm text-white/60">{t('studentHw.retryNote')}</p>
          </div>
        )}
      </div>
    );
  }

  // 문제 화면(활동 안 · 다시 풀기)
  let content: React.ReactNode = null;
  if (phase.k === 'retry') {
    const [id, qiStr] = phase.keys[phase.pos].split(':');
    const it = items.find((x) => x.id === id)!;
    const qi = Number(qiStr);
    content = <QuestionCard key={`r-${phase.pos}`} q={it.content.questions[qi]} disabled={busy || !!feedback} onAnswer={(r) => void answer(it.id, qi, r)} />;
  } else if (phase.k === 'item') {
    const it = items[phase.i];
    if (it.kind === 'shadowing' && phase.sub === 'lines') {
      content = (
        <ShadowingActivity
          item={it}
          startLine={shadowLinesDone.get(it.id) ?? 0}
          onLineDone={(line, listens, repeats) => void api.progress(it.id, 'shadow_line', { line, listens, repeats }).catch(() => undefined)}
          onLinesFinished={() => {
            if (it.content.questions.length === 0) void completeItem(phase.i);
            else setPhase({ ...phase, sub: 'questions' });
          }}
        />
      );
    } else if (it.config.game === 'matchup') {
      const answered = new Map<number, AnswerResult>();
      it.content.questions.forEach((_, qi) => {
        const a = answers.get(answerKey(it.id, qi));
        if (a) answered.set(qi, a);
      });
      content = (
        <MatchupGame
          item={it}
          answered={answered}
          onSubmit={async (qi, r) => {
            const res = await api.submit(it.id, qi, r, performance.now() - shownAt.current).catch((): AnswerResult => ({ correct: false, answer: null }));
            const key = answerKey(it.id, qi);
            setAnswers((m) => new Map(m).set(key, m.get(key) ?? res));
            if (res.correct !== null) playSfx(res.correct ? SFX_CORRECT : SFX_WRONG);
            return res;
          }}
          onDone={() => void completeItem(phase.i)}
        />
      );
    } else {
      const qi = it.content.questions.findIndex((_, i) => !answers.has(answerKey(it.id, i)));
      const showQi = feedback ? Number(feedback.key.split(':')[1]) : qi;
      if (showQi < 0) {
        content = (
          <div className="flex flex-1 items-center justify-center">
            <button type="button" onClick={() => void completeItem(phase.i)} className="min-h-14 rounded-full bg-warm-yellow px-8 text-lg font-bold text-deep-navy">
              {t('studentHw.next')}
            </button>
          </div>
        );
      } else {
        content = <QuestionCard key={`${it.id}-${showQi}`} q={it.content.questions[showQi]} disabled={busy || !!feedback} onAnswer={(r) => void answer(it.id, showQi, r)} />;
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {header}
      {content}
      {feedback && <FeedbackBar result={feedback} onNext={afterFeedback} />}
    </div>
  );
}

function SaveBadge({ state, preview }: { state: SaveState; preview: boolean }) {
  const { t } = useTranslation();
  if (preview) return <span className="rounded-full bg-white/15 px-2 py-0.5">{t('studentHw.previewBadge')}</span>;
  const map: Record<SaveState, { icon: string; cls: string }> = {
    saved: { icon: 'cloud_done', cls: 'text-emerald-300' },
    saving: { icon: 'cloud_sync', cls: 'text-white/70' },
    offline: { icon: 'cloud_off', cls: 'text-warm-yellow' },
    error: { icon: 'error', cls: 'text-rose-300' },
  };
  return (
    <span className={`flex items-center gap-1 ${map[state].cls}`} aria-live="polite">
      <span className="material-symbols-outlined text-[18px]">{map[state].icon}</span>
      {t(`studentHw.save_${state}`)}
    </span>
  );
}

function FeedbackBar({ result, onNext }: { result: AnswerResult; onNext: () => void }) {
  const { t } = useTranslation();
  const color = result.correct === null ? 'bg-slate-600' : result.correct ? 'bg-emerald-600' : 'bg-rose-600';
  return (
    <div className={`sticky bottom-0 mx-3 mb-3 flex flex-col items-center gap-2 rounded-3xl p-4 text-center shadow-2xl ${color}`} role="status">
      <div className="flex items-center gap-2 text-2xl font-bold">
        <span className="material-symbols-outlined text-[32px]">{result.correct === null ? 'cloud_upload' : result.correct ? 'check_circle' : 'cancel'}</span>
        {result.correct === null ? t('studentHw.savedForLater') : result.correct ? t('studentHw.correct') : t('studentHw.wrong')}
      </div>
      {result.correct === false && result.answer && (
        <div className="text-lg">
          {t('studentHw.answerIs')} <b className="text-warm-yellow">{result.answer}</b>
        </div>
      )}
      {result.correct !== true && (
        <button type="button" onClick={onNext} autoFocus className="min-h-12 rounded-full bg-white px-10 text-lg font-bold text-deep-navy">
          {t('studentHw.next')}
        </button>
      )}
    </div>
  );
}
