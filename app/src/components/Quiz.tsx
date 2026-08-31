import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuizQuestion } from '../lib/types';

interface Props {
  questions: QuizQuestion[];
}

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

  if (questions.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">📝</div>
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
        <div className="text-5xl mb-3">🏁</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameQuiz.finishedTitle')}</div>
        <div className="font-display-lg text-[40px] text-deep-navy mb-6 tabular-nums">
          {t('gameQuiz.scoreLabel', { score, total: order.length })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameQuiz.restartButton')}
        </button>
      </div>
    );
  }

  const current = questions[order[pos]];

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="font-caption text-caption text-on-surface-variant mb-3 tabular-nums">
        {pos + 1} / {order.length}
      </div>

      <div className="font-display-lg text-[30px] text-deep-navy mb-6 text-center [word-break:keep-all] max-w-[520px]">
        {current.question}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-[560px] mb-5">
        {current.choices.map((choice, i) => {
          const isCorrect = i === current.correctIndex;
          const isSelected = i === selectedChoice;
          const revealed = selectedChoice !== null;
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() => selectChoice(i)}
              className={`px-5 py-3.5 rounded-xl font-label-md text-label-md text-left transition-all border-2 ${
                revealed && isCorrect
                  ? 'bg-secondary-container/40 border-secondary text-on-surface'
                  : revealed && isSelected
                    ? 'bg-error-container border-error text-on-error-container'
                    : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface hover:bg-surface-container-low'
              }`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {selectedChoice !== null && (
        <div className="result-pop flex flex-col items-center gap-4">
          <div
            className={`px-6 py-2.5 rounded-full font-title-md text-title-md shadow-sm ${
              selectedChoice === current.correctIndex
                ? 'bg-secondary-container/50 text-on-surface'
                : 'bg-error-container text-on-error-container'
            }`}
          >
            {selectedChoice === current.correctIndex ? t('gameQuiz.correctFeedback') : t('gameQuiz.wrongFeedback')}
          </div>
          <button
            onClick={next}
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('gameQuiz.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
}
