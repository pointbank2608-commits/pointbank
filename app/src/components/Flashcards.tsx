import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatchPair } from '../lib/types';

interface Props {
  cards: MatchPair[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Flashcards({ cards }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(cards.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (cards.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🗂️</div>
        <div className="font-body-md text-body-md">{t('gameFlashcards.needCards')}</div>
      </div>
    );
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(cards.map((_, i) => i)));
    setPos(0);
    setFlipped(false);
  }

  function next() {
    setPos((p) => p + 1);
    setFlipped(false);
  }

  function prev() {
    setPos((p) => Math.max(0, p - 1));
    setFlipped(false);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🎉</div>
        <div className="font-title-md text-title-md text-on-surface mb-6">{t('gameFlashcards.finishedTitle')}</div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameFlashcards.restartButton')}
        </button>
      </div>
    );
  }

  const current = cards[order[pos]];

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="font-caption text-caption text-on-surface-variant mb-3 tabular-nums">
        {pos + 1} / {order.length}
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        data-skin-object="card"
        className="w-full max-w-[420px] h-56 rounded-2xl border-2 border-outline-variant/40 bg-surface-container-lowest shadow-md flex items-center justify-center px-6 mb-4 transition-colors hover:bg-surface-container-low"
      >
        <div className="font-display-lg text-[28px] text-deep-navy text-center [word-break:keep-all]">
          {flipped ? current.right : current.left}
        </div>
      </button>

      <div className="font-caption text-caption text-on-surface-variant mb-6">
        {flipped ? t('gameFlashcards.backHint') : t('gameFlashcards.frontHint')}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={pos === 0}
          onClick={prev}
          className="px-6 py-2.5 rounded-full font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container disabled:opacity-40 transition-colors"
        >
          {t('gameFlashcards.prevButton')}
        </button>
        <button
          type="button"
          onClick={next}
          className="px-8 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
        >
          {t('gameFlashcards.nextButton')}
        </button>
      </div>
    </div>
  );
}
