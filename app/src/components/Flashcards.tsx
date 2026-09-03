import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import type { MatchPair } from '../lib/types';

export type FlashcardsStyle = 'wood' | 'clay';

interface Props {
  cards: MatchPair[];
  boardStyle?: FlashcardsStyle;
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

export default function Flashcards({ cards, boardStyle = 'wood' }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(cards.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cardKey = cards.map((c) => c.id).join(',');
  const clay = boardStyle === 'clay';

  useEffect(() => {
    setOrder(shuffle(cards.map((_, i) => i)));
    setPos(0);
    setFlipped(false);
  }, [cardKey]);

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className={`fc-stack mx-auto mb-3 pointer-events-none h-[120px] w-[160px] ${clay ? 'fc-clay fc-clay-1' : 'fc-wood'}`}>
          <div className="fc-behind fc-behind-1" aria-hidden />
          <div className="fc-face h-full">
            <div className="fc-inset text-[22px]">Aa</div>
          </div>
        </div>
        <div className="font-body-md text-body-md">{t('gameFlashcards.needCards')}</div>
      </div>
    );
  }

  if (order.length === 0) {
    return null;
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
            <div className="font-title-md text-title-md text-deep-navy">{t('gameFlashcards.finishedTitle')}</div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameFlashcards.restartButton')}
        </button>
      </div>
    );
  }

  const current = cards[order[pos]];
  const clayTone = pos % 4;

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {pos + 1} / {order.length}
      </div>

      <div
        className={`fc-stack ${clay ? `fc-clay fc-clay-${clayTone}` : 'fc-wood'}`}
        data-skin-stage="board"
      >
        <div className="fc-behind fc-behind-2" aria-hidden />
        <div className="fc-behind fc-behind-1" aria-hidden />
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          data-skin-object="card"
          className={`fc-card ${flipped ? 'is-flipped' : ''}`}
        >
          <span className="fc-face">
            <span className="fc-inset">
              <GameFitText text={current.left} />
            </span>
          </span>
          <span className="fc-face is-back">
            <span className="fc-inset">
              <GameFitText text={current.right} />
            </span>
          </span>
        </button>
      </div>

      <div className="mb-6 font-caption text-caption text-on-surface-variant">
        {flipped ? t('gameFlashcards.backHint') : t('gameFlashcards.frontHint')}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={pos === 0}
          onClick={prev}
          className="px-6 py-2.5 rounded-full font-label-md text-label-md bg-[#fff4e0] text-deep-navy hover:bg-[#ffe8c4] disabled:opacity-40 transition-colors shadow-sm"
        >
          {t('gameFlashcards.prevButton')}
        </button>
        <button type="button" onClick={next} className={pill}>
          {t('gameFlashcards.nextButton')}
        </button>
      </div>
    </div>
  );
}
