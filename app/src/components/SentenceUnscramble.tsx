import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

export type UnscrambleStyle = 'rack' | 'tags';

interface Props {
  items: GameItem[];
  boardStyle?: UnscrambleStyle;
}

interface Tile {
  id: string;
  word: string;
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

function tokenize(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

function shuffleSentence(sentence: string): Tile[] {
  const words = tokenize(sentence).map((word, i) => ({
    id: `${i}-${word}-${Math.random().toString(36).slice(2)}`,
    word,
    tone: i % 4,
  }));
  if (words.length <= 1) return words;
  const original = words.map((t) => t.word).join(' ');
  let result = shuffle(words);
  let guard = 0;
  while (result.map((t) => t.word).join(' ') === original && guard < 10) {
    result = shuffle(words);
    guard++;
  }
  return result;
}

export default function SentenceUnscramble({ items, boardStyle = 'rack' }: Props) {
  const { t } = useTranslation();
  const hang = boardStyle === 'tags';
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [pool, setPool] = useState<Tile[]>(() =>
    items.length && order.length ? shuffleSentence(items[order[0]].label) : [],
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
      setPool(shuffleSentence(items[nextOrder[0]].label));
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
        <div className="mx-auto mb-3 flex justify-center gap-2">
          <span className="su-clay su-clay-0 pointer-events-none">I</span>
          <span className="su-clay su-clay-2 pointer-events-none">like</span>
        </div>
        <div className="font-body-md text-body-md">{t('gameUnscramble.needParticipants')}</div>
      </div>
    );
  }

  if (order.length === 0) {
    return null;
  }

  const finished = pos >= order.length;

  function loadRound(nextPos: number, nextOrder: number[]) {
    const sentence = items[nextOrder[nextPos]].label;
    setPool(shuffleSentence(sentence));
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameUnscramble.finishedTitle')}</div>
            <div className="font-display-lg text-[32px] tabular-nums text-deep-navy">
              {t('gameUnscramble.scoreLabel', { score, total: order.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameUnscramble.restartButton')}
        </button>
      </div>
    );
  }

  const target = tokenize(items[order[pos]].label).join(' ');

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
      const assembled = nextPlaced.map((tl) => tl.word).join(' ');
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
    setPool(shuffleSentence(items[order[pos]].label));
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
          className={`su-tag ${mark}`}
        >
          {tile.word}
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
        className={`su-clay su-clay-${tile.tone} ${mark}`}
      >
        {tile.word}
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
          className="su-tag"
        >
          {tile.word}
        </button>
      );
    }
    return (
      <button
        key={tile.id}
        type="button"
        onClick={() => pickFromPool(tile.id)}
        data-skin-object="tile-pool"
        className={`su-clay su-clay-${tile.tone}`}
      >
        {tile.word}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2 w-full">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {pos + 1} / {order.length}
      </div>

      {hang ? (
        <div data-skin-stage="tile-tray" className="su-hang mb-5">
          <div className="su-hang-bar" aria-hidden />
          <div className="su-hang-row">
            {placed.map(placedTile)}
            {Array.from({ length: emptySlots }, (_, i) => (
              <span key={`empty-${i}`} data-skin-object="tile-slot" className="su-tag is-empty" />
            ))}
          </div>
        </div>
      ) : (
        <div data-skin-stage="tile-tray" className="su-rack mb-5">
          {placed.map(placedTile)}
          {Array.from({ length: emptySlots }, (_, i) => (
            <div key={`empty-${i}`} data-skin-object="tile-slot" className="su-slot" />
          ))}
        </div>
      )}

      {hang ? (
        pool.length > 0 && (
          <div data-skin-stage="tile-pool" className="su-tray mb-5">
            {pool.map(poolTile)}
          </div>
        )
      ) : (
        <div data-skin-stage="tile-pool" className="su-pool mb-5">
          {pool.map(poolTile)}
        </div>
      )}

      {status === 'wrong' && (
        <div className="mb-3 rounded-full bg-[#f28b73] px-4 py-1 font-title-md text-[14px] font-bold text-white">
          {t('gameUnscramble.wrongHint')}
        </div>
      )}

      <div className="flex gap-3">
        {status !== 'correct' && (
          <button
            type="button"
            onClick={reshuffleRound}
            className="px-6 py-2.5 rounded-full font-label-md text-label-md bg-[#fff4e0] text-deep-navy hover:bg-[#ffe8c4] transition-colors shadow-sm"
          >
            {t('gameUnscramble.reshuffleButton')}
          </button>
        )}
        {status === 'correct' && (
          <button onClick={next} className={pill}>
            {t('gameUnscramble.nextButton')}
          </button>
        )}
      </div>
    </div>
  );
}
