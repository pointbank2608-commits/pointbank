import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

const SIZE = 6;
const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const FLICKER_MS = 70;
const FLICKER_COUNT = 8;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 항목이 36개보다 많으면 무작위 36개만, 적으면 부족한 만큼 반복해서 6x6 판을 채운다. */
function pickBoardItems(items: GameItem[]): GameItem[] {
  const pool = shuffle(items);
  return Array.from({ length: SIZE * SIZE }, (_, i) => pool[i % pool.length]);
}

export default function TwoDice({ items }: Props) {
  const { t } = useTranslation();
  const [board, setBoard] = useState<GameItem[]>(() => pickBoardItems(items));
  const [die1, setDie1] = useState<number | null>(null);
  const [die2, setDie2] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<{ key: string; label: string }[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function reshuffleBoard() {
    if (timerRef.current) clearInterval(timerRef.current);
    setBoard(pickBoardItems(items));
    setHighlightIndex(null);
    setDie1(null);
    setDie2(null);
    setHistory([]);
    setRolling(false);
  }

  function roll() {
    if (rolling || items.length === 0) return;
    setRolling(true);
    let ticks = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDie1(1 + Math.floor(Math.random() * SIZE));
      setDie2(1 + Math.floor(Math.random() * SIZE));
      ticks++;
      if (ticks >= FLICKER_COUNT) {
        if (timerRef.current) clearInterval(timerRef.current);
        const d1 = 1 + Math.floor(Math.random() * SIZE);
        const d2 = 1 + Math.floor(Math.random() * SIZE);
        setDie1(d1);
        setDie2(d2);
        const idx = (d1 - 1) * SIZE + (d2 - 1);
        setHighlightIndex(idx);
        const word = board[idx];
        setHistory((prev) => [{ key: `${Date.now()}`, label: word.label }, ...prev].slice(0, 8));
        setRolling(false);
      }
    }, FLICKER_MS);
  }

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🎲</div>
        <div className="font-body-md text-body-md">{t('gameTwoDice.needParticipants')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="flex items-center gap-4 mb-5">
        <span data-skin-object="die" className="text-7xl">{die1 ? DICE_FACES[die1] : '⚀'}</span>
        <span data-skin-object="die" className="text-7xl">{die2 ? DICE_FACES[die2] : '⚀'}</span>
      </div>

      <button
        onClick={roll}
        disabled={rolling}
        className="mb-6 px-10 py-3 rounded-full bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary font-title-md text-title-md shadow-sm transition-colors"
      >
        {rolling ? t('gameTwoDice.rolling') : t('gameTwoDice.rollButton')}
      </button>

      <div className="w-full max-w-[520px] overflow-x-auto mb-4">
        <div data-skin-stage="board" className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(48px, 1fr))`, width: '100%' }}>
          {board.map((item, i) => (
            <div
              key={i}
              data-skin-object="cell"
              className={`aspect-square rounded-md flex items-center justify-center text-center px-0.5 font-label-md text-[10px] sm:text-[12px] leading-tight [word-break:keep-all] border transition-all ${
                i === highlightIndex
                  ? 'bg-warm-yellow/30 border-warm-yellow text-tertiary-container scale-105 font-bold'
                  : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface'
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={reshuffleBoard}
        className="font-label-md text-label-md text-primary hover:underline mb-4"
      >
        {t('gameTwoDice.reshuffleButton')}
      </button>

      {history.length > 0 && (
        <div className="w-full max-w-[420px]">
          <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameTwoDice.recentResults')}</div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((h, i) => (
              <span
                key={h.key}
                className="px-3 py-1 rounded-full font-label-md text-label-md bg-surface-container-low text-on-surface"
              >
                {i === 0 && '🎉 '}
                {h.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
