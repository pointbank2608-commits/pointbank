import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import type { GameItem } from '../lib/types';

export type RankOrderStyle = 'podium' | 'plates';

interface Props {
  items: GameItem[];
  boardStyle?: RankOrderStyle;
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

export default function RankOrder({ items, boardStyle = 'podium' }: Props) {
  const { t } = useTranslation();
  const plates = boardStyle === 'plates';
  const [order, setOrder] = useState<GameItem[]>(() => shuffleUntilDifferent(items));
  const [moveCount, setMoveCount] = useState(0);
  const itemKey = items.map((it) => it.id).join(',');

  useEffect(() => {
    setOrder(shuffleUntilDifferent(items));
    setMoveCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  if (items.length < 2) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center">
          <div className="ro-step pointer-events-none w-[160px]">
            <span className="ro-num">1</span>
            <span className="ro-label">Aa</span>
          </div>
        </div>
        <div className="font-body-md text-body-md">{t('gameRankOrder.needParticipants')}</div>
      </div>
    );
  }

  if (order.length === 0) {
    return null;
  }

  const finished = order.length === items.length && order.every((it, i) => it.id === items[i].id);

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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameRankOrder.finishedTitle')}</div>
            <div className="font-display-lg text-[28px] tabular-nums text-deep-navy">
              {t('gameRankOrder.moveCountLabel', { count: moveCount })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameRankOrder.restartButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 font-caption text-caption text-on-surface-variant">{t('gameRankOrder.hint')}</div>
      <div data-skin-stage="board" className="ro-list">
        {order.map((item, i) => {
          const correct = item.id === items[i]?.id;
          const tone = i % 4;
          return (
            <div key={item.id} data-skin-object="row" className="ro-row">
              {plates ? (
                <div className="ro-plate-wrap">
                  <span className="ro-tag">{i + 1}</span>
                  <div className={`ro-plate ro-clay-${tone} ${correct ? 'is-ok' : ''}`}>
                    <GameFitText text={item.label} fit="block" />
                  </div>
                </div>
              ) : (
                <div className={`ro-step ${correct ? 'is-ok' : ''}`}>
                  <span className="ro-num">{i + 1}</span>
                  <span className="ro-label">
                    <GameFitText text={item.label} fit="block" />
                  </span>
                </div>
              )}
              <div className="ro-arrows">
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  aria-label={t('gameRankOrder.moveUpLabel')}
                  className={`ro-chev ${plates ? 'wood' : 'up'}`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === order.length - 1}
                  aria-label={t('gameRankOrder.moveDownLabel')}
                  className={`ro-chev ${plates ? 'wood' : 'down'}`}
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
