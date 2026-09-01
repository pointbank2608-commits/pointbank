import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

interface Tile {
  id: string;
  char: string;
}

type Status = 'playing' | 'wrong' | 'correct';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleWord(word: string): Tile[] {
  const chars = [...word].map((char, i) => ({ id: `${i}-${char}-${Math.random().toString(36).slice(2)}`, char }));
  if (chars.length <= 1) return chars;
  let result = shuffle(chars);
  let guard = 0;
  while (
    result.map((t) => t.char).join('') === word &&
    guard < 10
  ) {
    result = shuffle(chars);
    guard++;
  }
  return result;
}

export default function Anagram({ items }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [pool, setPool] = useState<Tile[]>(() => (items.length && order.length ? shuffleWord(items[order[0]].label) : []));
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [status, setStatus] = useState<Status>('playing');
  const [score, setScore] = useState(0);

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🔤</div>
        <div className="font-body-md text-body-md">{t('gameAnagram.needParticipants')}</div>
      </div>
    );
  }

  const finished = pos >= order.length;

  function loadRound(nextPos: number, nextOrder: number[]) {
    const word = items[nextOrder[nextPos]].label;
    setPool(shuffleWord(word));
    setPlaced([]);
    setStatus('playing');
  }

  function restart() {
    const nextOrder = shuffle(items.map((_, i) => i));
    setOrder(nextOrder);
    setPos(0);
    setScore(0);
    loadRound(0, nextOrder);
  }

  function next() {
    const nextPos = pos + 1;
    setPos(nextPos);
    if (nextPos < order.length) loadRound(nextPos, order);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🏆</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameAnagram.finishedTitle')}</div>
        <div className="font-display-lg text-[40px] text-deep-navy mb-6 tabular-nums">
          {t('gameAnagram.scoreLabel', { score, total: order.length })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameAnagram.restartButton')}
        </button>
      </div>
    );
  }

  const target = items[order[pos]].label;

  function pickFromPool(tileId: string) {
    if (status === 'correct') return;
    const idx = pool.findIndex((tl) => tl.id === tileId);
    if (idx === -1) return;
    const tile = pool[idx];
    const nextPool = pool.filter((tl) => tl.id !== tileId);
    const nextPlaced = [...placed, tile];
    setPool(nextPool);
    setPlaced(nextPlaced);
    if (nextPool.length === 0) {
      const assembled = nextPlaced.map((tl) => tl.char).join('');
      if (assembled === target) {
        setStatus('correct');
        setScore((s) => s + 1);
      } else {
        setStatus('wrong');
      }
    }
  }

  function returnFromPlaced(tileId: string) {
    if (status === 'correct') return;
    const idx = placed.findIndex((tl) => tl.id === tileId);
    if (idx === -1) return;
    const tile = placed[idx];
    setPlaced((prev) => prev.filter((tl) => tl.id !== tileId));
    setPool((prev) => [...prev, tile]);
    if (status === 'wrong') setStatus('playing');
  }

  function reshuffleRound() {
    if (status === 'correct') return;
    setPool(shuffleWord(target));
    setPlaced([]);
    setStatus('playing');
  }

  const totalLen = placed.length + pool.length;
  const emptySlots = totalLen - placed.length;

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="font-caption text-caption text-on-surface-variant mb-4 tabular-nums">
        {pos + 1} / {order.length}
      </div>

      <div data-skin-stage="tile-tray" className="flex flex-wrap justify-center gap-1.5 mb-6 max-w-[560px]">
        {placed.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => returnFromPlaced(tile.id)}
            disabled={status === 'correct'}
            data-skin-object="tile-placed"
            className={`w-10 h-11 rounded-lg flex items-center justify-center font-display-lg text-[20px] border-b-4 transition-colors ${
              status === 'correct'
                ? 'bg-secondary-container/40 border-secondary text-on-surface'
                : status === 'wrong'
                  ? 'bg-error-container border-error text-on-error-container'
                  : 'bg-primary-container/50 border-primary text-on-surface hover:opacity-80'
            }`}
          >
            {tile.char === ' ' ? ' ' : tile.char}
          </button>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <div
            key={`empty-${i}`}
            data-skin-object="tile-slot"
            className="w-10 h-11 rounded-lg border-b-4 border-dashed border-outline-variant/50 bg-surface-container-low"
          />
        ))}
      </div>

      <div data-skin-stage="tile-pool" className="flex flex-wrap justify-center gap-1.5 mb-6 max-w-[560px]">
        {pool.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => pickFromPool(tile.id)}
            data-skin-object="tile-pool"
            className="w-10 h-11 rounded-lg flex items-center justify-center font-display-lg text-[20px] bg-surface-container-lowest border-2 border-outline-variant/40 text-on-surface hover:bg-surface-container-low hover:-translate-y-0.5 transition-all"
          >
            {tile.char === ' ' ? '␣' : tile.char}
          </button>
        ))}
      </div>

      {status === 'wrong' && (
        <div className="font-body-md text-body-md text-error mb-3">{t('gameAnagram.wrongHint')}</div>
      )}

      <div className="flex gap-3">
        {status !== 'correct' && (
          <button
            type="button"
            onClick={reshuffleRound}
            className="px-6 py-2.5 rounded-full font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            {t('gameAnagram.reshuffleButton')}
          </button>
        )}
        {status === 'correct' && (
          <button
            onClick={next}
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('gameAnagram.nextButton')}
          </button>
        )}
      </div>
    </div>
  );
}
