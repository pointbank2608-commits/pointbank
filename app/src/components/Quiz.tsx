import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuizQuestion } from '../lib/types';

interface Props {
  questions: QuizQuestion[];
}

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';
const pill =
  'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Quiz({ questions }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(questions.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const questionKey = questions.map((q) => q.id).join(',');

  useEffect(() => {
    setOrder(shuffle(questions.map((_, i) => i)));
    setPos(0);
    setSelectedChoice(null);
    setScore(0);
  }, [questionKey]);

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="qz-block qz-block-0 mx-auto mb-3 w-[72px] justify-center px-0 py-3">
          <span className="qz-letter">A</span>
        </div>
        <div className="font-body-md text-body-md">{t('gameQuiz.needQuestions')}</div>
      </div>
    );
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(questions.map((_, i) => i)));
    setPos(0);
    setSelectedChoice(null);
    setScore(0);
  }

  function selectChoice(choiceIndex: number) {
    if (selectedChoice !== null || finished) return;
    setSelectedChoice(choiceIndex);
    const current = questions[order[pos]];
    if (choiceIndex === current.correctIndex) setScore((s) => s + 1);
  }

  function next() {
    setPos((p) => p + 1);
    setSelectedChoice(null);
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameQuiz.finishedTitle')}</div>
            <div className="font-display-lg text-[40px] tabular-nums text-deep-navy">
              {t('gameQuiz.scoreLabel', { score, total: order.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameQuiz.restartButton')}
        </button>
      </div>
    );
  }

  const current = questions[order[pos]];
  const revealed = selectedChoice !== null;
  const gotItRight = selectedChoice === current.correctIndex;

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {pos + 1} / {order.length}
      </div>

      <div
        data-skin-stage="board"
        className="mb-5 w-full max-w-[520px] px-2 py-2"
        style={{
          borderRadius: 22,
          background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
          boxShadow: woodShadow,
        }}
      >
        <div
          className="flex min-h-[88px] items-center justify-center px-4 py-3"
          style={{
            borderRadius: 16,
            background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
          }}
        >
          <div className="text-center font-bold leading-snug text-deep-navy [word-break:keep-all] text-[clamp(20px,3.6vw,30px)]">
            {current.question}
          </div>
        </div>
      </div>

      <div className="mb-5 grid w-full max-w-[560px] grid-cols-1 gap-3 sm:grid-cols-2">
        {current.choices.map((choice, i) => {
          const isCorrect = i === current.correctIndex;
          const isSelected = i === selectedChoice;
          const state = revealed
            ? isCorrect
              ? 'is-ok'
              : isSelected
                ? 'is-no'
                : 'is-dim'
            : '';
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() => selectChoice(i)}
              data-skin-object="choice"
              className={`qz-block qz-block-${i % 4} ${state}`}
            >
              <span className="qz-letter">{String.fromCharCode(65 + i)}</span>
              <span className="min-w-0 flex-1 text-left font-bold leading-snug [word-break:keep-all]">{choice}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="result-pop flex flex-col items-center gap-4">
          <div
            className="rounded-full px-6 py-2.5 font-title-md text-title-md font-bold text-white shadow-sm"
            style={{ backgroundColor: gotItRight ? '#3dbea8' : '#f28b73', boxShadow: woodShadow }}
          >
            {gotItRight ? t('gameQuiz.correctFeedback') : t('gameQuiz.wrongFeedback')}
          </div>
          <button onClick={next} className={pill}>
            {t('gameQuiz.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
}
