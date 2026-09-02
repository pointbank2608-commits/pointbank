import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

export type AnagramStyle = 'rack' | 'tags';

interface Props {
  items: GameItem[];
  boardStyle?: AnagramStyle;
}

interface Tile {
  id: string;
  char: string;
  tone: number;
}

type Status = 'playing' | 'wrong' | 'correct';

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

function shuffleWord(word: string): Tile[] {
  const chars = [...word].map((char, i) => ({
    id: `${i}-${char}-${Math.random().toString(36).slice(2)}`,
    char,
    tone: i % 4,
  }));
  if (chars.length <= 1) return chars;
  let result = shuffle(chars);
  let guard = 0;
  while (result.map((t) => t.char).join('') === word && guard < 10) {
    result = shuffle(chars);
    guard++;
  }
  return result;
}

function tileLabel(char: string, inPool: boolean) {
  if (char === ' ') return inPool ? '␣' : '\u00a0';
  return char;
}

export default function Anagram({ items, boardStyle = 'rack' }: Props) {
  const { t } = useTranslation();
  const hang = boardStyle === 'tags';
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [pool, setPool] = useState<Tile[]>(() =>
    items.length && order.length ? shuffleWord(items[order[0]].label) : [],
  );
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [status, setStatus] = useState<Status>('playing');
  const [score, setScore] = useState(0);
  const itemKey = items.map((it) => it.id).join(',');

  useEffect(() => {
    const nextOrder = shuffle(items.map((_, i) => i));
    setOrder(nextOrder);
    setPos(0);
    setScore(0);
    if (items.length > 0 && nextOrder.length > 0) {
      setPool(shuffleWord(items[nextOrder[0]].label));
      setPlaced([]);
      setStatus('playing');
    } else {
      setPool([]);
      setPlaced([]);
    }
  }, [itemKey]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center gap-1.5">
          <span className="ag-clay ag-clay-0 pointer-events-none">A</span>
          <span className="ag-clay ag-clay-2 pointer-events-none">N</span>
        </div>
        <div className="font-body-md text-body-md">{t('gameAnagram.needParticipants')}</div>
      </div>
    );
  }

  if (order.length === 0) {
    return null;
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameAnagram.finishedTitle')}</div>
            <div className="font-display-lg text-[32px] tabular-nums text-deep-navy">
              {t('gameAnagram.scoreLabel', { score, total: order.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
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
  const mark = status === 'correct' ? 'is-ok' : status === 'wrong' ? 'is-no' : '';

  function placedTile(tile: Tile) {
    if (hang) {
      return (
        <button
          key={tile.id}
          type="button"
          onClick={() => returnFromPlaced(tile.id)}
          disabled={status === 'correct'}
          data-skin-object="tile-placed"
          className={`ag-tag ${mark}`}
        >
          {tileLabel(tile.char, false)}
        </button>
      );
    }
    return (
      <button
        key={tile.id}
        type="button"
        onClick={() => returnFromPlaced(tile.id)}
        disabled={status === 'correct'}
        data-skin-object="tile-placed"
        className={`ag-clay ag-clay-${tile.tone} ${mark}`}
      >
        {tileLabel(tile.char, false)}
      </button>
    );
  }

  function poolTile(tile: Tile) {
    if (hang) {
      return (
        <button
          key={tile.id}
          type="button"
          onClick={() => pickFromPool(tile.id)}
          data-skin-object="tile-pool"
          className="ag-tag"
        >
          {tileLabel(tile.char, true)}
        </button>
      );
    }
    return (
      <button
        key={tile.id}
        type="button"
        onClick={() => pickFromPool(tile.id)}
        data-skin-object="tile-pool"
        className={`ag-clay ag-clay-${tile.tone}`}
      >
        {tileLabel(tile.char, true)}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {pos + 1} / {order.length}
      </div>

      {hang ? (
        <div data-skin-stage="tile-tray" className="ag-hang mb-5">
          <div className="ag-hang-bar" aria-hidden />
          <div className="ag-hang-row">
            {placed.map(placedTile)}
            {Array.from({ length: emptySlots }, (_, i) => (
              <span key={`empty-${i}`} data-skin-object="tile-slot" className="ag-tag is-empty" />
            ))}
          </div>
        </div>
      ) : (
        <div data-skin-stage="tile-tray" className="ag-rack mb-5">
          {placed.map(placedTile)}
          {Array.from({ length: emptySlots }, (_, i) => (
            <div key={`empty-${i}`} data-skin-object="tile-slot" className="ag-slot" />
          ))}
        </div>
      )}

      {hang ? (
        pool.length > 0 && (
          <div data-skin-stage="tile-pool" className="ag-tray mb-5">
            {pool.map(poolTile)}
          </div>
        )
      ) : (
        <div data-skin-stage="tile-pool" className="ag-pool mb-5">
          {pool.map(poolTile)}
        </div>
      )}

      {status === 'wrong' && (
        <div className="mb-3 rounded-full bg-[#f28b73] px-4 py-1 font-title-md text-[14px] font-bold text-white">
          {t('gameAnagram.wrongHint')}
        </div>
      )}

      <div className="flex gap-3">
        {status !== 'correct' && (
          <button
            type="button"
            onClick={reshuffleRound}
            className="px-6 py-2.5 rounded-full font-label-md text-label-md bg-[#fff4e0] text-deep-navy hover:bg-[#ffe8c4] transition-colors shadow-sm"
          >
            {t('gameAnagram.reshuffleButton')}
          </button>
        )}
        {status === 'correct' && (
          <button onClick={next} className={pill}>
            {t('gameAnagram.nextButton')}
          </button>
        )}
      </div>
    </div>
  );
}
