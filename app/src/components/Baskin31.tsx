import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
  targetCount: number;
}

type Team = 'blue' | 'red';

const PICK_OPTIONS = [1, 2, 3];

export default function Baskin31({ items, targetCount }: Props) {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const [turn, setTurn] = useState<Team>('blue');
  const [wordIndex, setWordIndex] = useState(0);
  const [lastWords, setLastWords] = useState<string[]>([]);
  const [loser, setLoser] = useState<Team | null>(null);

  function pick(n: number) {
    if (loser || items.length === 0) return;
    const words = Array.from({ length: n }, (_, i) => items[(wordIndex + i) % items.length].label);
    const nextCount = count + n;
    setLastWords(words);
    setWordIndex((wordIndex + n) % items.length);
    if (nextCount >= targetCount) {
      setCount(targetCount);
      setLoser(turn);
    } else {
      setCount(nextCount);
      setTurn(turn === 'blue' ? 'red' : 'blue');
    }
  }

  function resetAll() {
    setCount(0);
    setTurn('blue');
    setWordIndex(0);
    setLastWords([]);
    setLoser(null);
  }

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🍦</div>
        <div className="font-body-md text-body-md">{t('gameBaskin31.needParticipants')}</div>
      </div>
    );
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameBaskin31.teamBlue') : t('gameBaskin31.teamRed'));

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div data-skin-object="scoop" className={`text-7xl mb-3 transition-all ${loser ? 'grayscale opacity-40 scale-90' : ''}`}>🍦</div>

      <div className="font-display-lg text-[40px] text-deep-navy mb-1 tabular-nums">
        {count} <span className="text-on-surface-variant text-[22px]">/ {targetCount}</span>
      </div>

      {!loser && (
        <div
          className={`mb-4 px-6 py-2 rounded-full font-label-md text-label-md ${
            turn === 'blue' ? 'bg-primary text-on-primary' : 'bg-error text-on-error'
          }`}
        >
          {t('gameBaskin31.turnLabel', { team: teamLabel(turn) })}
        </div>
      )}

      {lastWords.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          {lastWords.map((w, i) => (
            <span
              key={i}
              className="px-3 py-1.5 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface"
            >
              {w}
            </span>
          ))}
        </div>
      )}

      {!loser ? (
        <div className="flex gap-3">
          {PICK_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => pick(n)}
              className="px-6 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
            >
              {t('gameBaskin31.pickButton', { n })}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div
            className={`px-6 py-3 rounded-full font-title-md text-title-md shadow-sm ${
              loser === 'blue' ? 'bg-primary text-on-primary' : 'bg-error text-on-error'
            }`}
          >
            {t('gameBaskin31.loseMessage', { team: teamLabel(loser), target: targetCount })}
          </div>
          <button
            onClick={resetAll}
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('gameBaskin31.playAgainButton')}
          </button>
        </div>
      )}
    </div>
  );
}
