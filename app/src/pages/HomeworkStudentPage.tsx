import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { CHOICE_STYLES } from '../components/QuizShowHost';
import { playSfx } from '../lib/gameSfx';
import {
  forgetHomeworkToken,
  hwAnswer,
  hwErrorKey,
  hwFinish,
  hwLogin,
  hwOpen,
  hwState,
  readHomeworkToken,
  textIsCorrect,
  type HomeworkOpenInfo,
  type HomeworkQuestion,
  type HomeworkState,
} from '../lib/homework';
import { speak } from '../lib/speech';
import { TextAnswer } from './LiveJoinPage';

const SFX_CORRECT = 4015;
const SFX_WRONG = 4025;
const SFX_FINISH = 5037;

type Step = 'code' | 'loading' | 'name' | 'pin' | 'play' | 'done';

/**
 * 학생 숙제(/hw/:code, 2026-10-04 Classbank Student ②) — 가입·로그인 없이 숙제 번호 → 내 이름 → PIN 4자리 → 문제.
 * 문제마다 바로 정답을 알려 주고(연습), 답은 하나씩 저장돼 창을 닫아도 이어서 푼다. 끝나면 점수·별·틀린 낱말,
 * "틀린 것 다시 풀기"(기록 안 함). 화면은 대회 퀴즈쇼 학생 휴대폰과 같은 남색 화면.
 */
export default function HomeworkStudentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { code = '' } = useParams();
  const [step, setStep] = useState<Step>(code ? 'loading' : 'code');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<HomeworkOpenInfo | null>(null);
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<HomeworkState | null>(null);

  const load = useCallback(
    async (tok: string) => {
      const s = await hwState(tok);
      setState(s);
      setToken(tok);
      setStep(s.finished ? 'done' : 'play');
    },
    [],
  );

  useEffect(() => {
    if (!code) return;
    let alive = true;
    (async () => {
      const saved = readHomeworkToken(code);
      if (saved) {
        try {
          await load(saved);
          return;
        } catch {
          forgetHomeworkToken(code);
        }
      }
      try {
        const i = await hwOpen(code);
        if (!alive) return;
        setInfo(i);
        setStep('name');
      } catch (e) {
        if (!alive) return;
        setError(t(hwErrorKey(e)));
        setStep('code');
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, load, t]);

  const shell = 'flex min-h-[100dvh] flex-col bg-[#16213e] text-white';

  if (step === 'code') return <CodeStep initialError={error} onGo={(c) => navigate(`/hw/${c}`)} />;
  if (step === 'loading') return <div className={`${shell} items-center justify-center text-white/70`}>{t('common.loading')}</div>;

  if (step === 'name' && info) {
    return (
      <div className={shell}>
        <Header title={info.title || t('studentHw.defaultTitle')} sub={[info.class_name, t('studentHw.questionCount', { count: info.count })].filter(Boolean).join(' · ')} />
        <div className="flex-1 space-y-4 p-5">
          <div className="text-center text-xl font-bold">{t('studentHw.whoAreYou')}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {info.students.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setStudent(s);
                  setError(null);
                  setStep('pin');
                }}
                className="relative rounded-2xl bg-white px-3 py-4 text-lg font-bold text-deep-navy shadow-[0_4px_0_#9aa3b5] active:translate-y-0.5 active:shadow-none"
              >
                {s.name}
                {s.done && <span className="material-symbols-outlined absolute right-2 top-2 text-[20px] text-emerald-600">check_circle</span>}
              </button>
            ))}
          </div>
          {info.students.length === 0 && <p className="text-center text-white/70">{t('studentHw.noStudents')}</p>}
        </div>
      </div>
    );
  }

  if (step === 'pin' && student) {
    return (
      <PinStep
        name={student.name}
        error={error}
        onBack={() => setStep('name')}
        onSubmit={async (pin) => {
          try {
            setError(null);
            const tok = await hwLogin(code, student.id, pin);
            await load(tok);
          } catch (e) {
            setError(t(hwErrorKey(e)));
          }
        }}
      />
    );
  }

  if ((step === 'play' || step === 'done') && state && token) {
    return <PlayStep state={state} token={token} startDone={step === 'done'} onLogout={() => { forgetHomeworkToken(code); window.location.reload(); }} />;
  }
  return <div className={`${shell} items-center justify-center`}>{error}</div>;
}

function Header({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="border-b border-white/10 px-5 py-4 text-center">
      <div className="flex items-center justify-center gap-2 text-sm text-white/60">
        <span className="material-symbols-outlined text-[18px]">edit_note</span>
        Classbank
      </div>
      <div className="mt-1 text-2xl font-bold">{title}</div>
      {sub && <div className="mt-0.5 text-sm text-white/70">{sub}</div>}
    </div>
  );
}

function CodeStep({ initialError, onGo }: { initialError: string | null; onGo: (code: string) => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#16213e] p-6 text-white">
      <div className="text-3xl font-bold">{t('studentHw.enterCodeTitle')}</div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        placeholder="000000"
        className="w-64 rounded-2xl bg-white px-4 py-4 text-center text-4xl font-bold tracking-[0.3em] text-deep-navy outline-none"
      />
      {initialError && <div className="text-warm-yellow">{initialError}</div>}
      <button type="button" disabled={value.length !== 6} onClick={() => onGo(value)} className="rounded-full bg-warm-yellow px-10 py-4 text-xl font-bold text-deep-navy disabled:opacity-40">
        {t('studentHw.start')}
      </button>
    </div>
  );
}

function PinStep({ name, error, onBack, onSubmit }: { name: string; error: string | null; onBack: () => void; onSubmit: (pin: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (pin.length !== 4 || busy) return;
    setBusy(true);
    void onSubmit(pin).finally(() => {
      setBusy(false);
      setPin('');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);
  const press = (d: string) => setPin((p) => (p.length < 4 ? p + d : p));
  const key = 'flex h-16 items-center justify-center rounded-2xl bg-white text-3xl font-bold text-deep-navy shadow-[0_4px_0_#9aa3b5] active:translate-y-0.5 active:shadow-none [touch-action:manipulation]';
  return (
    <div className="flex min-h-[100dvh] flex-col items-center gap-5 bg-[#16213e] p-6 text-white">
      <button type="button" onClick={onBack} className="self-start text-white/70">
        ← {t('studentHw.notMe')}
      </button>
      <div className="text-center">
        <div className="text-2xl font-bold">{t('studentHw.hello', { name })}</div>
        <div className="mt-1 text-white/70">{t('studentHw.enterPin')}</div>
      </div>
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-5 w-5 rounded-full ${i < pin.length ? 'bg-warm-yellow' : 'bg-white/25'}`} />
        ))}
      </div>
      {error && <div className="text-center text-warm-yellow">{error}</div>}
      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className={key} onClick={() => press(d)} disabled={busy}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" className={key} onClick={() => press('0')} disabled={busy}>
          0
        </button>
        <button type="button" className={key} onClick={() => setPin((p) => p.slice(0, -1))} disabled={busy} aria-label={t('studentHw.erase')}>
          <span className="material-symbols-outlined">backspace</span>
        </button>
      </div>
    </div>
  );
}

function PlayStep({ state, token, startDone, onLogout }: { state: HomeworkState; token: string; startDone: boolean; onLogout: () => void }) {
  const { t } = useTranslation();
  const qs = state.questions;
  const [answers, setAnswers] = useState<Map<number, { correct: boolean; response: string | null }>>(
    () => new Map(state.answers.map((a) => [a.q_index, { correct: a.correct, response: a.response }])),
  );
  const firstOpen = qs.findIndex((_, i) => !answers.has(i));
  const [idx, setIdx] = useState(firstOpen < 0 ? qs.length : firstOpen);
  const [feedback, setFeedback] = useState<{ correct: boolean; right: string } | null>(null);
  const [done, setDone] = useState(startDone || firstOpen < 0);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  // 틀린 것 다시 풀기(기록하지 않는 연습)
  const [practice, setPractice] = useState<number[] | null>(null);
  const [practicePos, setPracticePos] = useState(0);
  const shownAt = useRef(performance.now());

  const curIndex = practice ? practice[practicePos] : idx;
  const q = qs[curIndex];

  useEffect(() => {
    shownAt.current = performance.now();
    if (q && !feedback && (q.roundType === 'listen' || q.style === 'listen') && q.speak) speak(q.speak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curIndex, practice]);

  useEffect(() => {
    if (!done || result || practice) return;
    void hwFinish(token)
      .then((r) => {
        setResult(r);
        playSfx(SFX_FINISH);
      })
      .catch(() => {
        const score = [...answers.values()].filter((a) => a.correct).length;
        setResult({ score, total: qs.length });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function rightAnswer(question: HomeworkQuestion): string {
    if (question.kind === 'ox') return question.correctIndex === 0 ? 'O' : 'X';
    if (question.kind === 'choice') return question.choices?.[question.correctIndex ?? 0] ?? '';
    return (question.answer ?? '').split('/')[0];
  }

  async function submit(correct: boolean, response: string) {
    if (!q || feedback) return;
    playSfx(correct ? SFX_CORRECT : SFX_WRONG);
    setFeedback({ correct, right: rightAnswer(q) });
    if (!practice && !answers.has(curIndex)) {
      setAnswers((m) => new Map(m).set(curIndex, { correct, response }));
      const ms = performance.now() - shownAt.current;
      // 한 번 실패하면 한 번 더(인터넷이 잠깐 끊긴 경우)
      await hwAnswer(token, curIndex, q, correct, response, ms).catch(() => hwAnswer(token, curIndex, q, correct, response, ms).catch(() => undefined));
    }
  }

  function next() {
    setFeedback(null);
    if (practice) {
      if (practicePos + 1 < practice.length) setPracticePos((p) => p + 1);
      else setPractice(null);
      return;
    }
    const n = qs.findIndex((_, i) => i > idx && !answers.has(i));
    if (n < 0) setDone(true);
    else setIdx(n);
  }

  // 맞히면 잠깐 뒤 저절로 다음 문제로
  useEffect(() => {
    if (!feedback?.correct) return;
    const id = window.setTimeout(next, 1100);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  const wrongIdx = useMemo(() => qs.map((_, i) => i).filter((i) => answers.get(i)?.correct === false), [answers, qs]);

  if (done && !practice) {
    const score = result?.score ?? [...answers.values()].filter((a) => a.correct).length;
    const total = result?.total ?? qs.length;
    const ratio = total ? score / total : 0;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1;
    return (
      <div className="flex min-h-[100dvh] flex-col items-center gap-5 bg-[#16213e] p-6 text-center text-white">
        <Header title={state.title || t('studentHw.defaultTitle')} sub={state.name} />
        <div className="flex gap-2 pt-4">
          {[1, 2, 3].map((s) => (
            <span key={s} className="material-symbols-outlined text-[56px]" style={{ color: s <= stars ? '#fcd34d' : 'rgba(255,255,255,0.2)', fontVariationSettings: "'FILL' 1" }}>
              star
            </span>
          ))}
        </div>
        <div className="text-2xl font-bold">{t('studentHw.doneTitle')}</div>
        <div className="text-5xl font-bold tabular-nums">
          {score} <span className="text-2xl text-white/60">/ {total}</span>
        </div>
        {wrongIdx.length > 0 && (
          <div className="w-full max-w-md space-y-2 rounded-2xl bg-white/10 p-4 text-left">
            <div className="font-bold">{t('studentHw.wrongList')}</div>
            {wrongIdx.map((i) => (
              <div key={i} className="flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-sm">
                <span className="truncate">{qs[i].word || qs[i].prompt}</span>
                {/* 철자·그림 문제는 정답이 낱말 자체라 뜻(문제 글)을 대신 보여 준다 */}
                <span className="shrink-0 font-bold text-warm-yellow">
                  {rightAnswer(qs[i]).toLowerCase() === (qs[i].word || '').toLowerCase() && qs[i].kind === 'text' ? qs[i].prompt : rightAnswer(qs[i])}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setPractice(wrongIdx);
                setPracticePos(0);
              }}
              className="mt-2 w-full rounded-full bg-warm-yellow py-3 font-bold text-deep-navy"
            >
              {t('studentHw.retryWrong')}
            </button>
          </div>
        )}
        <button type="button" onClick={onLogout} className="text-sm text-white/60 underline">
          {t('studentHw.switchUser')}
        </button>
      </div>
    );
  }

  if (!q) return null;
  const answeredCount = answers.size;
  const imageUrl = q.revealImage ?? q.imageUrl ?? null;
  const isListen = q.roundType === 'listen' || q.style === 'listen';
  const isScramble = q.roundType === 'scramble' || q.style === 'scramble';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#16213e] text-white">
      <div className="flex items-center gap-3 px-4 pt-4">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-warm-yellow transition-all" style={{ width: `${(answeredCount / qs.length) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-white/70">{practice ? t('studentHw.practice') : `${Math.min(idx + 1, qs.length)} / ${qs.length}`}</span>
      </div>
      {q.round && <div className="px-4 pt-2 text-center text-sm text-white/60">{q.round.replace(/^\d+\S*\s*·\s*/, '')}</div>}

      <div className="flex flex-col items-center gap-3 px-5 py-4 text-center">
        {imageUrl && <img src={imageUrl} alt="" className="h-40 w-40 rounded-2xl bg-white object-contain p-2" />}
        {isListen ? (
          <button type="button" onClick={() => q.speak && speak(q.speak)} className="flex h-24 w-24 items-center justify-center rounded-full bg-warm-yellow text-deep-navy shadow-lg">
            <span className="material-symbols-outlined text-[52px]">volume_up</span>
          </button>
        ) : (
          <div className={`font-bold leading-snug ${isScramble ? 'text-3xl tracking-[0.25em]' : q.prompt.length > 40 ? 'text-xl' : 'text-3xl'}`}>{q.prompt}</div>
        )}
        {isListen && <div className="text-white/70">{q.prompt}</div>}
      </div>

      {feedback ? (
        <div className={`mx-4 flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center ${feedback.correct ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <span className="material-symbols-outlined text-[64px]">{feedback.correct ? 'check_circle' : 'cancel'}</span>
          <div className="text-3xl font-bold">{feedback.correct ? t('studentHw.correct') : t('studentHw.wrong')}</div>
          {!feedback.correct && (
            <div className="text-xl">
              {t('studentHw.answerIs')} <b className="text-warm-yellow">{feedback.right}</b>
            </div>
          )}
          {!feedback.correct && (
            <button type="button" onClick={next} className="mt-2 rounded-full bg-white px-10 py-3 text-xl font-bold text-deep-navy">
              {t('studentHw.next')}
            </button>
          )}
        </div>
      ) : q.kind === 'ox' ? (
        <div className="grid flex-1 grid-cols-2 gap-3 p-4">
          {['O', 'X'].map((m, i) => (
            <button key={m} type="button" onClick={() => void submit(i === q.correctIndex, m)} className="rounded-3xl text-7xl font-bold shadow-lg" style={{ background: i === 0 ? '#2f6fdb' : '#e5484d' }}>
              {m}
            </button>
          ))}
        </div>
      ) : q.kind === 'choice' ? (
        <div className="grid flex-1 content-start gap-3 p-4">
          {(q.choices ?? []).map((c, i) => {
            const st = CHOICE_STYLES[i % CHOICE_STYLES.length];
            return (
              <button
                key={i}
                type="button"
                onClick={() => void submit(i === q.correctIndex, c)}
                className="flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-left text-xl font-bold shadow-lg active:scale-[0.98]"
                style={{ background: st.bg }}
              >
                <span className="material-symbols-outlined">{st.icon}</span>
                {c}
              </button>
            );
          })}
        </div>
      ) : (
        <TextQuestion key={curIndex} onSubmit={(text) => void submit(textIsCorrect(q.answer, text), text)} />
      )}
    </div>
  );
}

function TextQuestion({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState('');
  return <TextAnswer text={text} setText={setText} disabled={false} onSubmit={() => text.trim() && onSubmit(text)} />;
}
