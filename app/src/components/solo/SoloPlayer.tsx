import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from '../../lib/speech';
import type { SoloPublicStep } from '../../lib/soloLessons';

/**
 * 개별수업 플레이어 — 화면이 선생님이 되어 한 단계씩 이끈다. 학생 화면(/s/lesson)과 선생님 미리보기가 같이 쓴다.
 * 채점·기록은 api 가 한다(학생: 서버, 미리보기: 이 브라우저 안).
 *  - 고르기: 한 번 틀리면 "다시 해 볼까요?"(틀린 보기는 흐려짐), 두 번 틀리면 정답을 알려 준다.
 *  - "모르겠어요": 정답을 알려 주고 넘어간다(선생님 현황에 막힌 단계로 보인다).
 */
export interface SoloPlayerApi {
  /** 답 내기 → 맞았는지 */
  answer(step: number, value: string): Promise<boolean>;
  /** 단계를 끝냈다고 알리기(모르겠어요면 unsure) → 정답 글자(모르겠어요일 때) */
  advance(step: number, unsure: boolean): Promise<{ answer: string | null }>;
  /** 두 번 틀린 뒤 정답 보기 */
  reveal(step: number): Promise<string | null>;
}

type Phase = 'ask' | 'right' | 'wrong1' | 'shown';

const btn =
  'min-h-14 rounded-2xl px-5 text-xl font-bold [touch-action:manipulation] disabled:opacity-40';

export default function SoloPlayer({
  steps,
  startAt = 0,
  api,
  onExit,
  preview = false,
}: {
  steps: SoloPublicStep[];
  startAt?: number;
  api: SoloPlayerApi;
  onExit: () => void;
  preview?: boolean;
}) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(() => Math.min(startAt, Math.max(0, steps.length - 1)));
  const [phase, setPhase] = useState<Phase>('ask');
  const [wrong, setWrong] = useState<number[]>([]);
  const [shownAnswer, setShownAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(startAt >= steps.length && steps.length > 0);
  const [stats, setStats] = useState({ right: 0, unsure: 0 });
  const [error, setError] = useState(false);
  const [typed, setTyped] = useState<number[]>([]);
  const [heard, setHeard] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const attempts = useRef(0);

  const step = steps[idx];

  // 새 단계로 올 때: 상태 비우고, 소리 나는 단계는 자동으로 읽어 준다
  useEffect(() => {
    setPhase('ask');
    setWrong([]);
    setShownAnswer(null);
    setTyped([]);
    setHeard(false);
    setAdvanced(false);
    setError(false);
    attempts.current = 0;
    if (!step) return;
    if (step.t === 'meet') speak(step.word);
    if (step.t === 'listenPick') speak(step.word);
    if (step.t === 'pickMeaning') speak(step.word);
  }, [idx, step]);

  const guard = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      setBusy(true);
      setError(false);
      try {
        return await fn();
      } catch {
        setError(true);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  async function next(unsure = false) {
    const r = await guard(() => api.advance(idx, unsure));
    if (r === null) return;
    if (unsure) {
      setStats((s) => ({ ...s, unsure: s.unsure + 1 }));
      setAdvanced(true);
      setShownAnswer(r.answer);
      setPhase('shown');
      return;
    }
    goOn();
  }

  function goOn() {
    if (idx + 1 >= steps.length) setFinished(true);
    else setIdx(idx + 1);
  }

  async function choose(i: number) {
    if (busy || phase === 'right' || phase === 'shown' || wrong.includes(i)) return;
    const ok = await guard(() => api.answer(idx, String(i)));
    if (ok === null) return;
    attempts.current += 1;
    if (ok) {
      setPhase('right');
      setStats((s) => ({ ...s, right: s.right + 1 }));
      return;
    }
    setWrong((w) => [...w, i]);
    if (attempts.current >= 2) await showAnswer();
    else setPhase('wrong1');
  }

  async function showAnswer() {
    const a = await guard(() => api.reveal(idx));
    if (a === null) return;
    setShownAnswer(a);
    setPhase('shown');
  }

  async function checkSpell() {
    if (!step || step.t !== 'spell') return;
    const value = typed.map((n) => step.letters[n]).join('');
    const ok = await guard(() => api.answer(idx, value));
    if (ok === null) return;
    attempts.current += 1;
    if (ok) {
      setPhase('right');
      setStats((s) => ({ ...s, right: s.right + 1 }));
      return;
    }
    setTyped([]);
    if (attempts.current >= 2) await showAnswer();
    else setPhase('wrong1');
  }

  const percent = useMemo(() => (steps.length ? Math.round((Math.min(idx, steps.length) / steps.length) * 100) : 0), [idx, steps.length]);

  if (finished) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#16213e] p-6 text-center text-white">
        <div className="text-7xl">🎉</div>
        <h1 className="text-4xl font-bold">{t('solo.finishTitle')}</h1>
        <p className="text-xl text-white/80">{t('solo.finishStats', { right: stats.right, unsure: stats.unsure })}</p>
        <button type="button" onClick={onExit} className={`${btn} bg-warm-yellow text-deep-navy`}>
          {preview ? t('solo.closePreview') : t('solo.backHome')}
        </button>
      </div>
    );
  }
  if (!step) return null;

  const isQuestion = step.t === 'pickWord' || step.t === 'pickMeaning' || step.t === 'listenPick' || step.t === 'spell';
  const answered = phase === 'right' || phase === 'shown';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#16213e] text-white">
      <header className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onExit} aria-label={t('solo.exit')} className="rounded-full p-2 text-white/70 hover:bg-white/10">
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-warm-yellow transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-sm tabular-nums text-white/70">
          {idx + 1}/{steps.length}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-5 px-5 pb-6 pt-2">
        {step.t === 'intro' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="text-6xl">📚</div>
            <h1 className="text-3xl font-bold">{step.title}</h1>
            <p className="max-w-sm text-xl text-white/85">{t('solo.introText', { count: Number(step.text) || 0 })}</p>
            <button type="button" disabled={busy} onClick={() => void next()} className={`${btn} bg-warm-yellow px-10 text-deep-navy`}>
              {t('solo.start')}
            </button>
          </div>
        )}

        {step.t === 'meet' && (
          <>
            <p className="text-lg text-white/70">{t('solo.meetPrompt')}</p>
            <Picture url={step.imageUrl} />
            <button type="button" onClick={() => { speak(step.word); setHeard(true); }} className="flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-3 text-5xl font-bold">
              <span className="material-symbols-outlined text-[40px] text-warm-yellow">volume_up</span>
              {step.word}
            </button>
            <p className="text-2xl text-white/85">{step.meaning}</p>
            {step.example && (
              <button type="button" onClick={() => speak(step.example ?? '')} className="rounded-xl bg-white/5 px-4 py-2 text-lg text-white/75">
                🔊 {step.example}
              </button>
            )}
            <p className="mt-1 text-center text-lg text-warm-yellow">{t('solo.sayIt')}</p>
            <button type="button" disabled={busy} onClick={() => void next()} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
              {heard ? t('solo.saidIt') : t('solo.saidItFirst')}
            </button>
          </>
        )}

        {step.t === 'pickWord' && (
          <>
            <p className="text-xl font-bold">{t('solo.pickWordQ')}</p>
            <Picture url={step.imageUrl} />
            {!step.imageUrl && <p className="text-3xl font-bold">{step.meaning}</p>}
            <Options options={step.options} wrong={wrong} phase={phase} onPick={(i) => void choose(i)} />
          </>
        )}

        {step.t === 'pickMeaning' && (
          <>
            <p className="text-xl font-bold">{t('solo.pickMeaningQ')}</p>
            <button type="button" onClick={() => speak(step.word)} className="flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-3 text-5xl font-bold">
              <span className="material-symbols-outlined text-[40px] text-warm-yellow">volume_up</span>
              {step.word}
            </button>
            <Options options={step.options} wrong={wrong} phase={phase} onPick={(i) => void choose(i)} />
          </>
        )}

        {step.t === 'listenPick' && (
          <>
            <p className="text-xl font-bold">{t('solo.listenQ')}</p>
            <button type="button" onClick={() => speak(step.word)} className="flex items-center gap-2 rounded-full bg-warm-yellow px-6 py-3 text-xl font-bold text-deep-navy">
              <span className="material-symbols-outlined">volume_up</span>
              {t('solo.listenAgain')}
            </button>
            <div className="grid w-full grid-cols-2 gap-3">
              {step.options.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={wrong.includes(i) || answered}
                  onClick={() => void choose(i)}
                  className={`flex min-h-32 flex-col items-center justify-center gap-1 rounded-2xl p-2 ${wrong.includes(i) ? 'bg-white/10 opacity-40' : 'bg-white text-deep-navy'} [touch-action:manipulation]`}
                >
                  {step.images[i] ? <img src={step.images[i] ?? ''} alt="" className="h-24 w-24 object-contain" /> : <span className="text-2xl font-bold">{o}</span>}
                  {answered && <span className="text-base font-bold">{o}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step.t === 'spell' && (
          <>
            <p className="text-xl font-bold">{t('solo.spellQ')}</p>
            <Picture url={step.imageUrl} />
            <p className="text-2xl text-white/85">{step.meaning}</p>
            <div className="flex min-h-16 flex-wrap items-center justify-center gap-2" aria-live="polite">
              {step.letters.map((_, slot) => (
                <span key={slot} className="flex h-14 w-12 items-center justify-center rounded-xl border-2 border-white/40 bg-white/10 text-3xl font-bold">
                  {typed[slot] !== undefined ? step.letters[typed[slot]] : ''}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {step.letters.map((l, n) => (
                <button
                  key={n}
                  type="button"
                  disabled={typed.includes(n) || answered || busy}
                  onClick={() => setTyped((a) => [...a, n])}
                  className="h-14 w-12 rounded-xl bg-white text-3xl font-bold text-deep-navy shadow-[0_4px_0_#9aa3b5] [touch-action:manipulation] disabled:opacity-30"
                >
                  {l}
                </button>
              ))}
            </div>
            {!answered && (
              <div className="flex w-full gap-3">
                <button type="button" onClick={() => setTyped((a) => a.slice(0, -1))} disabled={typed.length === 0} className={`${btn} flex-1 bg-white/15`}>
                  {t('solo.erase')}
                </button>
                <button type="button" onClick={() => void checkSpell()} disabled={typed.length !== step.letters.length || busy} className={`${btn} flex-1 bg-warm-yellow text-deep-navy`}>
                  {t('solo.check')}
                </button>
              </div>
            )}
          </>
        )}

        {/* 결과 말풍선 */}
        {isQuestion && phase === 'wrong1' && <Banner tone="try">{t('solo.tryAgain')}</Banner>}
        {isQuestion && phase === 'right' && <Banner tone="ok">{t('solo.great')}</Banner>}
        {isQuestion && phase === 'shown' && (
          <Banner tone="show">
            {t('solo.answerIs')} <span className="font-bold">{shownAnswer ?? ''}</span>
          </Banner>
        )}
        {error && <p className="text-center text-lg text-warm-yellow" role="alert">{t('solo.error')}</p>}

        {isQuestion && answered && (
          <button type="button" disabled={busy} onClick={() => (phase === 'right' || !advanced ? void next() : goOn())} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
            {t('solo.next')}
          </button>
        )}

        {step.t !== 'intro' && !answered && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void next(true)}
            className="mt-auto rounded-full border border-white/30 px-5 py-2 text-base text-white/80 hover:bg-white/10"
          >
            {t('solo.dontKnow')}
          </button>
        )}
        {step.t === 'meet' && phase === 'shown' && (
          <button type="button" onClick={goOn} className={`${btn} w-full bg-warm-yellow text-deep-navy`}>
            {t('solo.next')}
          </button>
        )}
        {preview && <p className="text-sm text-white/50">{t('solo.previewNote')}</p>}
      </main>
    </div>
  );
}

function Picture({ url }: { url: string | null }) {
  if (!url) return null;
  return <img src={url} alt="" className="h-52 w-52 rounded-3xl bg-white object-contain p-2 sm:h-60 sm:w-60" />;
}

function Options({ options, wrong, phase, onPick }: { options: string[]; wrong: number[]; phase: Phase; onPick: (i: number) => void }) {
  return (
    <div className="grid w-full gap-3">
      {options.map((o, i) => (
        <button
          key={i}
          type="button"
          disabled={wrong.includes(i) || phase === 'right' || phase === 'shown'}
          onClick={() => onPick(i)}
          className={`min-h-16 rounded-2xl px-4 text-2xl font-bold [touch-action:manipulation] ${wrong.includes(i) ? 'bg-white/10 text-white/40 line-through' : 'bg-white text-deep-navy shadow-[0_4px_0_#9aa3b5] active:translate-y-0.5 active:shadow-none'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Banner({ tone, children }: { tone: 'ok' | 'try' | 'show'; children: React.ReactNode }) {
  const cls = tone === 'ok' ? 'bg-emerald-500/25 text-emerald-100' : tone === 'try' ? 'bg-warm-yellow/25 text-warm-yellow' : 'bg-sky-400/25 text-sky-100';
  return <div className={`w-full rounded-2xl px-4 py-3 text-center text-xl ${cls}`}>{children}</div>;
}
