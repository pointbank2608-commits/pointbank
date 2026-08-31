import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MathOperation } from '../lib/types';

interface Props {
  operations: MathOperation[];
  min: number;
  max: number;
  questionCount: number;
}

interface Problem {
  question: string;
  answer: number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProblem(operations: MathOperation[], min: number, max: number): Problem {
  const op = operations[Math.floor(Math.random() * operations.length)];
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);

  if (op === 'add') {
    const a = randInt(lo, hi);
    const b = randInt(lo, hi);
    return { question: `${a} + ${b}`, answer: a + b };
  }
  if (op === 'sub') {
    let a = randInt(lo, hi);
    let b = randInt(lo, hi);
    if (a < b) [a, b] = [b, a];
    return { question: `${a} - ${b}`, answer: a - b };
  }
  if (op === 'mul') {
    const a = randInt(lo, hi);
    const b = randInt(lo, hi);
    return { question: `${a} × ${b}`, answer: a * b };
  }
  const divisor = randInt(Math.max(1, lo), Math.max(1, hi));
  const quotient = randInt(Math.max(1, lo), Math.max(1, hi));
  const dividend = divisor * quotient;
  return { question: `${dividend} ÷ ${divisor}`, answer: quotient };
}

export default function MathGenerator({ operations, min, max, questionCount }: Props) {
  const { t } = useTranslation();
  const [round, setRound] = useState(0);
  const [problem, setProblem] = useState<Problem>(() => generateProblem(operations, min, max));
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong'>('playing');
  const [score, setScore] = useState(0);

  if (operations.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🧮</div>
        <div className="font-body-md text-body-md">{t('gameMathGen.needOperation')}</div>
      </div>
    );
  }

  const finished = round >= questionCount;

  function restart() {
    setRound(0);
    setProblem(generateProblem(operations, min, max));
    setInputValue('');
    setStatus('playing');
    setScore(0);
  }

  function next() {
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound < questionCount) setProblem(generateProblem(operations, min, max));
    setInputValue('');
    setStatus('playing');
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🏆</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameMathGen.finishedTitle')}</div>
        <div className="font-display-lg text-[40px] text-deep-navy mb-6 tabular-nums">
          {t('gameMathGen.scoreLabel', { score, total: questionCount })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameMathGen.restartButton')}
        </button>
      </div>
    );
  }

  const revealed = status !== 'playing';

  function submit() {
    if (revealed) return;
    const ok = inputValue.trim() !== '' && Number(inputValue) === problem.answer;
    setStatus(ok ? 'correct' : 'wrong');
    if (ok) setScore((s) => s + 1);
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="font-caption text-caption text-on-surface-variant mb-4 tabular-nums">
        {round + 1} / {questionCount}
      </div>

      <div className="font-display-lg text-[42px] text-deep-navy mb-6 tabular-nums">{problem.question} = ?</div>

      <input
        type="number"
        value={inputValue}
        disabled={revealed}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder={t('gameMathGen.answerPlaceholder')}
        className={`w-full max-w-[220px] text-center bg-surface-container-lowest border-b-2 px-3 py-2.5 font-display-lg text-[22px] text-on-surface focus:outline-none mb-6 ${
          revealed ? (status === 'correct' ? 'border-secondary text-secondary' : 'border-error text-error') : 'border-primary'
        }`}
      />

      {!revealed ? (
        <button
          onClick={submit}
          className="px-8 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
        >
          {t('gameMathGen.submitButton')}
        </button>
      ) : (
        <div className="result-pop flex flex-col items-center gap-3">
          <div
            className={`px-6 py-2.5 rounded-full font-title-md text-title-md shadow-sm ${
              status === 'correct'
                ? 'bg-secondary-container/50 text-on-surface'
                : 'bg-error-container text-on-error-container'
            }`}
          >
            {status === 'correct'
              ? t('gameMathGen.correctFeedback')
              : t('gameMathGen.wrongFeedback', { answer: problem.answer })}
          </div>
          <button
            onClick={next}
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('gameMathGen.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
}
