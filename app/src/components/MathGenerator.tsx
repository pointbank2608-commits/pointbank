import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MathOperation } from '../lib/types';

export type MathGenStyle = 'slate' | 'blocks';

interface Props {
  operations: MathOperation[];
  min: number;
  max: number;
  questionCount: number;
  boardStyle?: MathGenStyle;
}

interface Problem {
  question: string;
  answer: number;
}

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';
const pill =
  'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'check'] as const;
const MAX_DIGITS = 8;

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

function isEditorTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export default function MathGenerator({
  operations,
  min,
  max,
  questionCount,
  boardStyle = 'slate',
}: Props) {
  const { t } = useTranslation();
  const blocks = boardStyle === 'blocks';
  const [round, setRound] = useState(0);
  const [problem, setProblem] = useState<Problem>(() =>
    operations.length > 0 ? generateProblem(operations, min, max) : { question: '', answer: 0 },
  );
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong'>('playing');
  const [score, setScore] = useState(0);
  const settingsKey = `${operations.join('|')}|${min}|${max}|${questionCount}`;
  const playRef = useRef({ status, inputValue, answer: problem.answer });
  playRef.current = { status, inputValue, answer: problem.answer };

  useEffect(() => {
    if (operations.length === 0) return;
    setRound(0);
    setProblem(generateProblem(operations, min, max));
    setInputValue('');
    setStatus('playing');
    setScore(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey]);

  function typeDigit(d: string) {
    if (playRef.current.status !== 'playing') return;
    setInputValue((v) => (v.length >= MAX_DIGITS ? v : v + d));
  }

  function typeBackspace() {
    if (playRef.current.status !== 'playing') return;
    setInputValue((v) => v.slice(0, -1));
  }

  function submit() {
    const snap = playRef.current;
    if (snap.status !== 'playing') return;
    if (snap.inputValue.trim() === '') return;
    const ok = Number(snap.inputValue) === snap.answer;
    setStatus(ok ? 'correct' : 'wrong');
    if (ok) setScore((s) => s + 1);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditorTarget(e.target)) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        typeBackspace();
        return;
      }
      if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        typeDigit(e.key);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (operations.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center">
          <div className="mg-slate pointer-events-none w-[160px] p-2">
            <div className="mg-face min-h-[64px] gap-1 py-3">
              <span className="mg-token text-[16px]">1</span>
              <span className="mg-token text-[16px]">+</span>
              <span className="mg-token text-[16px]">1</span>
            </div>
          </div>
        </div>
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
        <div
          className="mb-6 w-[min(360px,92%)] px-2 py-2 text-center"
          style={{
            borderRadius: 22,
            background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
            boxShadow: woodShadow,
          }}
        >
          <div
            className="px-4 py-5"
            style={{
              borderRadius: 16,
              background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
            }}
          >
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameMathGen.finishedTitle')}</div>
            <div className="font-title-md text-[22px] font-bold tabular-nums text-deep-navy">
              {t('gameMathGen.scoreLabel', { score, total: questionCount })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameMathGen.restartButton')}
        </button>
      </div>
    );
  }

  const revealed = status !== 'playing';
  const tokens = problem.question.split(/\s+/);
  const wellMark = status === 'correct' ? 'is-ok' : status === 'wrong' ? 'is-no' : '';
  const wellEmpty = inputValue === '' && !revealed;

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {round + 1} / {questionCount}
      </div>

      <div data-skin-stage="board" className={`mg-slate mb-5 ${blocks ? 'mg-blocks' : ''}`}>
        <div className="mg-face">
          {tokens.map((tok, i) => (
            <span key={`${tok}-${i}`} className={`mg-token ${blocks ? `mg-clay-${i % 4}` : ''}`}>
              {tok}
            </span>
          ))}
          <span className={`mg-token ${blocks ? 'mg-clay-3' : ''}`}>=</span>
          <div
            data-skin-object="answer-input"
            className={`mg-well ${wellEmpty ? 'is-empty' : ''} ${wellMark}`}
          >
            {wellEmpty ? t('gameMathGen.answerPlaceholder') : inputValue}
          </div>
        </div>
      </div>

      {!revealed ? (
        <div className={`mg-pad ${blocks ? 'mg-blocks' : ''}`} role="group" aria-label={t('gameMathGen.keyboardLabel')}>
          <div className="mg-pad-grid">
            {PAD_KEYS.map((key, i) => {
              if (key === 'back') {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={typeBackspace}
                    className={`mg-key is-back ${blocks ? `mg-clay-${i % 4}` : ''}`}
                  >
                    {t('gameMathGen.backspaceLabel')}
                  </button>
                );
              }
              if (key === 'check') {
                return (
                  <button key={key} type="button" onClick={submit} className="mg-key is-check">
                    {t('gameMathGen.submitButton')}
                  </button>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => typeDigit(key)}
                  className={`mg-key ${blocks ? `mg-clay-${i % 4}` : ''}`}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="result-pop flex flex-col items-center gap-3">
          <div
            className={`rounded-full px-6 py-2.5 font-title-md text-title-md shadow-sm ${
              status === 'correct' ? 'bg-secondary text-on-secondary' : 'bg-[#f28b73] text-white'
            }`}
          >
            {status === 'correct'
              ? t('gameMathGen.correctFeedback')
              : t('gameMathGen.wrongFeedback', { answer: problem.answer })}
          </div>
          <button onClick={next} className={pill}>
            {t('gameMathGen.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
}
