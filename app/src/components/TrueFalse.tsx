import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrueFalseStatement } from '../lib/types';

interface Props {
  statements: TrueFalseStatement[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TrueFalse({ statements }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(statements.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [selected, setSelected] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);

  if (statements.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">⭕</div>
        <div className="font-body-md text-body-md">{t('gameTrueFalse.needStatements')}</div>
      </div>
    );
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(statements.map((_, i) => i)));
    setPos(0);
    setSelected(null);
    setScore(0);
  }

  function selectAnswer(answer: boolean) {
    if (selected !== null || finished) return;
    setSelected(answer);
    const current = statements[order[pos]];
    if (answer === current.isTrue) setScore((s) => s + 1);
  }

  function next() {
    setPos((p) => p + 1);
    setSelected(null);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🏁</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameTrueFalse.finishedTitle')}</div>
        <div className="font-display-lg text-[40px] text-deep-navy mb-6 tabular-nums">
          {t('gameTrueFalse.scoreLabel', { score, total: order.length })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameTrueFalse.restartButton')}
        </button>
      </div>
    );
  }

  const current = statements[order[pos]];
  const revealed = selected !== null;

  function btnClass(value: boolean) {
    if (!revealed) {
      return 'bg-surface-container-lowest border-outline-variant/40 text-on-surface hover:bg-surface-container-low';
    }
    const isCorrect = value === current.isTrue;
    const isSelected = value === selected;
    if (isCorrect) return 'bg-secondary-container/40 border-secondary text-on-surface';
    if (isSelected) return 'bg-error-container border-error text-on-error-container';
    return 'bg-surface-container-lowest border-outline-variant/40 text-on-surface opacity-50';
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="font-caption text-caption text-on-surface-variant mb-3 tabular-nums">
        {pos + 1} / {order.length}
      </div>

      <div className="font-display-lg text-[30px] text-deep-navy mb-8 text-center [word-break:keep-all] max-w-[520px]">
        {current.text}
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-[420px] mb-5">
        <button
          type="button"
          disabled={revealed}
          onClick={() => selectAnswer(true)}
          className={`px-5 py-5 rounded-xl font-title-md text-title-md text-center transition-all border-2 ${btnClass(true)}`}
        >
          ⭕ {t('gameTrueFalse.trueLabel')}
        </button>
        <button
          type="button"
          disabled={revealed}
          onClick={() => selectAnswer(false)}
          className={`px-5 py-5 rounded-xl font-title-md text-title-md text-center transition-all border-2 ${btnClass(false)}`}
        >
          ❌ {t('gameTrueFalse.falseLabel')}
        </button>
      </div>

      {revealed && (
        <div className="result-pop flex flex-col items-center gap-4">
          <div
            className={`px-6 py-2.5 rounded-full font-title-md text-title-md shadow-sm ${
              selected === current.isTrue
                ? 'bg-secondary-container/50 text-on-surface'
                : 'bg-error-container text-on-error-container'
            }`}
          >
            {selected === current.isTrue ? t('gameTrueFalse.correctFeedback') : t('gameTrueFalse.wrongFeedback')}
          </div>
          <button
            onClick={next}
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('gameTrueFalse.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
}
