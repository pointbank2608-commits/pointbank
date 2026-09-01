import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleUntilDifferent(items: GameItem[]): GameItem[] {
  if (items.length <= 1) return [...items];
  let result = shuffle(items);
  let guard = 0;
  while (result.every((it, i) => it.id === items[i].id) && guard < 10) {
    result = shuffle(items);
    guard++;
  }
  return result;
}

export default function RankOrder({ items }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<GameItem[]>(() => shuffleUntilDifferent(items));
  const [moveCount, setMoveCount] = useState(0);

  if (items.length < 2) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🔢</div>
        <div className="font-body-md text-body-md">{t('gameRankOrder.needParticipants')}</div>
      </div>
    );
  }

  const finished = order.every((it, i) => it.id === items[i].id);

  function restart() {
    setOrder(shuffleUntilDifferent(items));
    setMoveCount(0);
  }

  function moveUp(index: number) {
    if (index === 0 || finished) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setMoveCount((c) => c + 1);
  }

  function moveDown(index: number) {
    if (index === order.length - 1 || finished) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setMoveCount((c) => c + 1);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🎉</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameRankOrder.finishedTitle')}</div>
        <div className="font-display-lg text-[32px] text-deep-navy mb-6 tabular-nums">
          {t('gameRankOrder.moveCountLabel', { count: moveCount })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameRankOrder.restartButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2 w-full">
      <div className="font-caption text-caption text-on-surface-variant mb-4">{t('gameRankOrder.hint')}</div>
      <div data-skin-stage="board" className="w-full max-w-[420px] space-y-2">
        {order.map((item, i) => {
          const correct = item.id === items[i].id;
          return (
            <div
              key={item.id}
              data-skin-object="row"
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${
                correct ? 'bg-secondary-container/40 border-secondary' : 'bg-surface-container-lowest border-outline-variant/40'
              }`}
            >
              <span className="font-caption text-caption text-on-surface-variant w-6 text-center tabular-nums shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 font-label-md text-label-md text-on-surface">{item.label}</span>
              {correct && <span className="text-secondary shrink-0">✓</span>}
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  aria-label={t('gameRankOrder.moveUpLabel')}
                  className="w-7 h-6 rounded-md bg-surface-container-low hover:bg-surface-container text-on-surface-variant disabled:opacity-30 flex items-center justify-center text-xs"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === order.length - 1}
                  aria-label={t('gameRankOrder.moveDownLabel')}
                  className="w-7 h-6 rounded-md bg-surface-container-low hover:bg-surface-container text-on-surface-variant disabled:opacity-30 flex items-center justify-center text-xs"
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
