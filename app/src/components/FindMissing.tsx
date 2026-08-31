import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
  revealCount: number;
}

type Phase = 'idle' | 'showing' | 'hidden' | 'done';

const SHOW_MS = 3000;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 카드가 너무 많으면(8개 초과) 무작위 8개만 골라 판을 구성한다. */
function pickBoard(items: GameItem[]): GameItem[] {
  return shuffle(items).slice(0, Math.min(items.length, 8));
}

export default function FindMissing({ items, revealCount }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [board, setBoard] = useState<GameItem[]>([]);
  const [missingIndices, setMissingIndices] = useState<Set<number>>(new Set());
  const [foundIndices, setFoundIndices] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function start() {
    const nextBoard = pickBoard(items);
    setBoard(nextBoard);
    setFoundIndices(new Set());
    setPhase('showing');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const n = Math.min(Math.max(revealCount, 1), nextBoard.length - 1);
      const shuffledIndices = shuffle(Array.from({ length: nextBoard.length }, (_, i) => i));
      setMissingIndices(new Set(shuffledIndices.slice(0, n)));
      setPhase('hidden');
    }, SHOW_MS);
  }

  function reveal(index: number) {
    if (!missingIndices.has(index) || foundIndices.has(index)) return;
    const nextFound = new Set(foundIndices).add(index);
    setFoundIndices(nextFound);
    if (nextFound.size === missingIndices.size) {
      setPhase('done');
    }
  }

  if (items.length < 2) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🔍</div>
        <div className="font-body-md text-body-md">{t('gameFindMissing.needParticipants')}</div>
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <div className="flex flex-col items-center py-10">
        <div className="text-5xl mb-4">🔍</div>
        <button
          onClick={start}
          className="px-10 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameFindMissing.startButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      {phase === 'showing' && (
        <div className="mb-4 font-body-lg text-body-lg text-on-surface-variant">{t('gameFindMissing.memorizeHint')}</div>
      )}
      {phase === 'hidden' && (
        <div className="mb-4 font-display-lg text-[28px] text-deep-navy text-center">
          {t('gameFindMissing.missingPrompt')}
        </div>
      )}
      {phase === 'done' && (
        <div className="mb-4 font-display-lg text-[28px] text-deep-navy text-center">
          {t('gameFindMissing.allFoundMessage')}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-[520px]">
        {board.map((item, i) => {
          const isMissing = missingIndices.has(i);
          const isFound = foundIndices.has(i);
          const showQuestion = phase !== 'showing' && isMissing && !isFound;
          return (
            <button
              key={item.id}
              type="button"
              disabled={phase === 'showing' || !isMissing || isFound}
              onClick={() => reveal(i)}
              className={`aspect-[4/3] rounded-2xl flex items-center justify-center text-center px-2 font-title-md text-title-md [word-break:keep-all] transition-all border-2 ${
                showQuestion
                  ? 'bg-warm-yellow/20 border-warm-yellow text-tertiary-container cursor-pointer hover:bg-warm-yellow/30'
                  : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface'
              }`}
            >
              {showQuestion ? '?' : item.label}
            </button>
          );
        })}
      </div>

      {phase === 'hidden' && (
        <div className="mt-4 font-caption text-caption text-on-surface-variant">{t('gameFindMissing.tapToRevealHint')}</div>
      )}

      {phase === 'done' && (
        <button
          onClick={start}
          className="mt-6 px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
        >
          {t('gameFindMissing.playAgainButton')}
        </button>
      )}
    </div>
  );
}
