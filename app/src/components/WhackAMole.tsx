import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

const HOLE_COUNT = 9;
const MIN_MS = 1200;
const MAX_MS = 2600;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function WhackAMole({ items }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [activeHole, setActiveHole] = useState<number | null>(null);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const timerRef = useRef<number | null>(null);

  const finished = pos >= order.length;

  useEffect(() => {
    if (items.length === 0 || finished) return;
    const hole = Math.floor(Math.random() * HOLE_COUNT);
    setActiveHole(hole);
    const delay = MIN_MS + Math.random() * (MAX_MS - MIN_MS);
    timerRef.current = window.setTimeout(() => {
      setMisses((m) => m + 1);
      setActiveHole(null);
      setPos((p) => p + 1);
    }, delay);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, finished, items.length]);

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🐹</div>
        <div className="font-body-md text-body-md">{t('gameWhackamole.needParticipants')}</div>
      </div>
    );
  }

  function whack(hole: number) {
    if (hole !== activeHole || finished) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setHits((h) => h + 1);
    setActiveHole(null);
    window.setTimeout(() => setPos((p) => p + 1), 150);
  }

  function restart() {
    setOrder(shuffle(items.map((_, i) => i)));
    setPos(0);
    setActiveHole(null);
    setHits(0);
    setMisses(0);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🏆</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameWhackamole.finishedTitle')}</div>
        <div className="font-display-lg text-[32px] text-deep-navy mb-6 tabular-nums">
          {t('gameWhackamole.resultLabel', { hits, misses })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameWhackamole.restartButton')}
        </button>
      </div>
    );
  }

  const currentWord = items[order[pos]]?.label ?? '';

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="font-caption text-caption text-on-surface-variant mb-4 tabular-nums">
        {t('gameWhackamole.resultLabel', { hits, misses })}
      </div>

      <div data-skin-stage="board" className="grid grid-cols-3 gap-3 w-full max-w-[420px]">
        {Array.from({ length: HOLE_COUNT }, (_, i) => {
          const isActive = i === activeHole;
          return (
            <button
              key={i}
              type="button"
              onClick={() => whack(i)}
              data-skin-object="hole"
              className={`h-20 sm:h-24 rounded-full flex items-center justify-center px-2 text-center font-label-md text-label-md transition-all border-2 ${
                isActive
                  ? 'bg-warm-yellow text-deep-navy border-primary shadow-md scale-105'
                  : 'bg-surface-container-low text-on-surface-variant/50 border-outline-variant/30 cursor-default'
              }`}
            >
              {isActive ? currentWord : '⛰️'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
