import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SoloPlayerApi } from './SoloPlayer';
import {
  isGameLearningUnavailable,
  type GameCheckAnswer,
  type GameCheckState,
  type GameCheckSummary,
} from '../../lib/gameLearning';
import { speak } from '../../lib/speech';

const button =
  'min-h-12 rounded-2xl bg-white px-5 py-3 text-lg font-bold text-deep-navy disabled:opacity-50';
/** 게임 성적과 별개인 서버 채점 확인. 재시도 요청 ID를 유지해 통신 재전송을 중복 채점하지 않는다. */
export default function GameLearningCheck({
  api,
  step,
  onDone,
  preview = false,
}: {
  api: SoloPlayerApi;
  step: number;
  onDone: (summary?: GameCheckSummary) => void;
  preview?: boolean;
}) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const [state, setState] = useState<GameCheckState | null>(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [question, setQuestion] = useState(0);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<GameCheckAnswer | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let alive = true;
    if (!api.gameCheckOpen) {
      setMissing(true);
      return;
    }
    setError('');
    api.gameCheckOpen(step).then(
      (s) => {
        if (alive) {
          setState(s);
          setQuestion(
            (s.questions || []).findIndex((_, i) => !s.responses[String(i)]),
          );
        }
      },
      (e) => {
        if (!alive) return;
        if (isGameLearningUnavailable(e)) setMissing(true);
        else
          setError(
            en
              ? 'Could not load the learning check. Please retry.'
              : '학습 확인을 불러오지 못했습니다. 다시 시도해 주세요.',
          );
      },
    );
    return () => {
      alive = false;
    };
  }, [api, step, revision, en]);
  async function submit(answer: string) {
    if (lock.current || !api.gameCheckAnswer) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const key = `${question}:${answer}`;
    if (request.current?.key !== key)
      request.current = { key, id: crypto.randomUUID() };
    try {
      const result = await api.gameCheckAnswer(
        step,
        question,
        answer,
        request.current.id,
      );
      setFeedback(result);
      request.current = null;
      setState((old) =>
        old
          ? {
              ...old,
              responses: {
                ...old.responses,
                [question]: {
                  correct: result.first,
                  last_correct: result.correct,
                  attempts: 1,
                  answer: result.answer,
                },
              },
            }
          : old,
      );
    } catch {
      setError(
        en
          ? 'Your answer was not saved. Retry to continue.'
          : '답을 저장하지 못했습니다. 다시 눌러 저장한 뒤 진행해 주세요.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const done =
    state &&
    (state.disabled ||
      !state.questions?.length ||
      question < 0 ||
      question >= state.questions.length);
  if (missing)
    return (
      <div className="space-y-3 text-center">
        <p>
          {preview
            ? en
              ? 'Preview: students get a short server-graded learning check after this game.'
              : '미리보기에서는 기록하지 않습니다. 학생 실행 시 게임 뒤 짧은 학습 확인이 나옵니다.'
            : en
              ? 'Learning checks are not available yet. This game only records completion.'
              : '아직 학습 확인이 준비되지 않았어요. 이번 게임은 완료만 기록하고 스탯 점수에는 넣지 않습니다.'}
        </p>
        <button className={button} onClick={() => onDone()}>
          {en ? 'Next' : '다음으로'}
        </button>
      </div>
    );
  if (done) {
    const responses = Object.values(state.responses || {});
    const firstRight = responses.filter((r) => r.correct).length;
    const summary: GameCheckSummary = {
      right: firstRight,
      total: responses.length,
      missed: (state.questions || [])
        .flatMap((q, i) => {
          const r = state.responses?.[i];
          return r && !r.correct
            ? [('word' in q ? q.word : r.answer) || '']
            : [];
        })
        .filter(Boolean),
    };
    return (
      <div className="space-y-3 text-center">
        <h3 className="text-2xl font-bold">
          {en ? 'Learning check complete' : '학습 확인 완료'}
        </h3>
        {responses.length > 0 ? (
          <p>
            {en
              ? `First answers: ${firstRight}/${responses.length}. Saved to your learning record.`
              : `처음 답 ${responses.length}개 중 ${firstRight}개 정답 · 학습 기록에 저장했어요.`}
          </p>
        ) : (
          <p>
            {en
              ? 'This game records completion only.'
              : '이 게임은 완료만 기록합니다.'}
          </p>
        )}
        <button className={button} onClick={() => onDone(summary)}>
          {en ? 'Next' : '다음으로'}
        </button>
      </div>
    );
  }
  const q = state?.questions[question];
  return (
    <section
      className="space-y-4 rounded-3xl bg-white/10 p-5"
      aria-label={en ? 'Learning check' : '혼자 확인하기'}
    >
      <h3 className="text-center text-2xl font-bold">
        {en ? 'One more challenge!' : '마지막, 혼자 확인하기!'}
      </h3>
      <p className="text-center text-white/80">
        {en
          ? 'Game points and speed do not affect your learning score.'
          : '게임 점수·속도 대신, 지금 혼자 풀 수 있는 것을 확인해요.'}
      </p>
      {error && (
        <p role="alert" className="text-warm-yellow">
          {error}
        </p>
      )}
      {!state && (
        <button className={button} onClick={() => setRevision((n) => n + 1)}>
          {error
            ? en
              ? 'Retry'
              : '다시 불러오기'
            : en
              ? 'Loading…'
              : '불러오는 중…'}
        </button>
      )}
      {q && (
        <>
          <p>
            {question + 1} / {state.questions.length}
          </p>
          {q.t === 'pickMeaning' ? (
            <>
              <p className="text-center text-3xl font-bold">{q.word}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((choice, i) => (
                  <button
                    key={i}
                    className={button}
                    disabled={busy || !!feedback}
                    onClick={() => void submit(String(i))}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </>
          ) : (
            (q.t === 'typeWord' || q.t === 'dictation') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(value.trim());
                }}
                className="space-y-3 text-center"
              >
                {q.t === 'dictation' ? (
                  <button
                    type="button"
                    className={button}
                    onClick={() => speak(q.word)}
                  >
                    {en ? 'Listen' : '소리 듣기'}
                  </button>
                ) : (
                  <p className="text-2xl font-bold">{q.meaning}</p>
                )}
                <input
                  aria-label={en ? 'Answer' : '정답 입력'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={busy || !!feedback}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="min-h-14 w-full rounded-xl bg-white px-4 text-xl text-deep-navy"
                />
                <button
                  className={button}
                  disabled={!value.trim() || busy || !!feedback}
                >
                  {en ? 'Check' : '확인'}
                </button>
              </form>
            )
          )}
          {feedback && (
            <div
              role="status"
              className="space-y-3 rounded-2xl bg-deep-navy p-4 text-center"
            >
              <p>
                {feedback.correct
                  ? en
                    ? 'Correct!'
                    : '맞았어요!'
                  : en
                    ? `Answer: ${feedback.answer}`
                    : `정답은 ${feedback.answer}예요. 다음에 다시 만나 봐요.`}
              </p>
              <button
                className={button}
                onClick={() => {
                  setQuestion((n) => n + 1);
                  setFeedback(null);
                  setValue('');
                }}
              >
                {en ? 'Next' : '다음'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
