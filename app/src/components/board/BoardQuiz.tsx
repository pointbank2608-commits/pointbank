import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildBoardQuiz, quizScoreText } from '../../lib/boardMaterial';
import { playSfx, useGameSfx } from '../../lib/gameSfx';
import { speak } from '../../lib/speech';
import type { FullCardItem } from '../../lib/types';

const COUNTS = [5, 8, 10, 15];

/** 간단 퀴즈: 영어를 보고 우리말 뜻 고르기. 점수만 보여 주고 어디에도 저장하지 않는다. */
export default function BoardQuiz({ cards, onClose }: { cards: FullCardItem[]; onClose: () => void }) {
  const { t } = useTranslation();
  const sfx = useGameSfx('quiz');
  const [count, setCount] = useState(8);
  const [round, setRound] = useState(0);
  const [started, setStarted] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const questions = useMemo(() => (started ? buildBoardQuiz(cards, count) : []), [cards, count, started, round]);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const done = started && pos >= questions.length;
  const q = questions[pos];
  const possible = useMemo(() => buildBoardQuiz(cards, 1).length > 0, [cards]);

  function start() {
    setRound((r) => r + 1);
    setPos(0);
    setPicked(null);
    setScore(0);
    setStarted(true);
    playSfx(sfx.question);
  }
  function pick(i: number) {
    if (picked !== null || !q) return;
    setPicked(i);
    const ok = i === q.correct;
    if (ok) setScore((s) => s + 1);
    playSfx(ok ? sfx.correct : sfx.wrong);
  }
  function next() {
    setPicked(null);
    const n = pos + 1;
    setPos(n);
    playSfx(n >= questions.length ? sfx.finish : sfx.question);
  }

  const big = 'min-h-16 rounded-2xl border-2 px-6 py-4 text-2xl font-bold shadow focus-visible:outline-4 focus-visible:outline-primary';
  if (!possible) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-2xl font-bold text-deep-navy">{t('whiteboard.quizNeed')}</p>
        <button type="button" className={`${big} border-outline-variant bg-white`} onClick={onClose}>
          {t('whiteboard.backToBoard')}
        </button>
      </div>
    );
  }
  if (!started) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center" data-board-quiz="intro">
        <h2 className="text-4xl font-black text-deep-navy">{t('whiteboard.quizTitle')}</h2>
        <div className="flex items-center gap-2" role="group" aria-label={t('whiteboard.quizCount')}>
          <span className="font-bold text-on-surface-variant">{t('whiteboard.quizCount')}</span>
          {COUNTS.map((n) => (
            <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={`min-h-12 min-w-12 rounded-xl border-2 px-3 text-xl font-bold ${count === n ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-white text-deep-navy'}`}>
              {n}
            </button>
          ))}
        </div>
        <button type="button" className={`${big} border-primary bg-primary text-white`} onClick={start}>
          {t('whiteboard.quizStart')}
        </button>
      </div>
    );
  }
  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center" data-board-quiz="result">
        <h2 className="text-4xl font-black text-deep-navy">{t('whiteboard.quizResult')}</h2>
        <p className="text-7xl font-black text-primary" aria-live="polite">
          {quizScoreText(score, questions.length)}
        </p>
        <div className="flex gap-3">
          <button type="button" className={`${big} border-primary bg-primary text-white`} onClick={start}>
            {t('whiteboard.quizAgain')}
          </button>
          <button type="button" className={`${big} border-outline-variant bg-white text-deep-navy`} onClick={onClose}>
            {t('whiteboard.backToBoard')}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center" data-board-quiz="question">
      <div className="text-lg font-bold text-on-surface-variant">{t('whiteboard.quizQ', { n: pos + 1, total: questions.length })}</div>
      <button type="button" lang="en" className="max-w-[92vw] text-5xl font-extrabold text-deep-navy sm:text-7xl" onClick={() => speak(q.prompt)} aria-label={`${q.prompt} 🔊`}>
        {q.prompt} <span aria-hidden>🔊</span>
      </button>
      <p className="text-lg text-on-surface-variant">{t('whiteboard.quizPick')}</p>
      <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2">
        {q.choices.map((c, i) => {
          const state = picked === null ? 'idle' : i === q.correct ? 'right' : i === picked ? 'wrong' : 'dim';
          const cls =
            state === 'right'
              ? 'border-green-600 bg-green-100 text-green-900'
              : state === 'wrong'
                ? 'border-red-500 bg-red-100 text-red-900'
                : state === 'dim'
                  ? 'border-outline-variant bg-white opacity-50'
                  : 'border-outline-variant bg-white text-deep-navy hover:border-primary';
          return (
            <button key={`${c}-${i}`} type="button" disabled={picked !== null} className={`${big} ${cls}`} onClick={() => pick(i)} data-choice={i} data-state={state}>
              {c}
            </button>
          );
        })}
      </div>
      <p className="min-h-8 text-xl font-bold" role="status" aria-live="polite">
        {picked === null ? '' : picked === q.correct ? t('whiteboard.quizCorrect') : t('whiteboard.quizWrong', { answer: q.choices[q.correct] })}
      </p>
      {picked !== null && (
        <button type="button" className={`${big} border-primary bg-primary text-white`} onClick={next}>
          {t('whiteboard.quizNext')}
        </button>
      )}
    </div>
  );
}
