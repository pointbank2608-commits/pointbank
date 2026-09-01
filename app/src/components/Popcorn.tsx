import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

type Team = 'blue' | 'red';
type Card = GameItem | 'pop';

const POP_RATIO = 0.25;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 항목 카드 사이사이에 'POP!' 카드를 섞어 넣은 뽑기 더미를 만든다. */
function buildDeck(items: GameItem[]): Card[] {
  const popCount = Math.max(1, Math.round(items.length * POP_RATIO));
  const deck: Card[] = [...items, ...Array<Card>(popCount).fill('pop')];
  return shuffle(deck);
}

export default function Popcorn({ items }: Props) {
  const { t } = useTranslation();
  const [deck, setDeck] = useState<Card[]>(() => buildDeck(items));
  const [deckIndex, setDeckIndex] = useState(0);
  const [turn, setTurn] = useState<Team>('blue');
  const [scores, setScores] = useState<Record<Team, number>>({ blue: 0, red: 0 });
  const [lastCard, setLastCard] = useState<Card | null>(null);
  const [poppedTeam, setPoppedTeam] = useState<Team | null>(null);

  function draw() {
    if (items.length === 0) return;
    let currentDeck = deck;
    let index = deckIndex;
    if (index >= currentDeck.length) {
      currentDeck = buildDeck(items);
      index = 0;
      setDeck(currentDeck);
    }
    const card = currentDeck[index];
    setDeckIndex(index + 1);
    setLastCard(card);

    if (card === 'pop') {
      setPoppedTeam(turn);
      setScores((prev) => ({ ...prev, [turn]: 0 }));
    } else {
      setPoppedTeam(null);
      setScores((prev) => ({ ...prev, [turn]: prev[turn] + 1 }));
    }
    setTurn((prev) => (prev === 'blue' ? 'red' : 'blue'));
  }

  function resetAll() {
    setDeck(buildDeck(items));
    setDeckIndex(0);
    setTurn('blue');
    setScores({ blue: 0, red: 0 });
    setLastCard(null);
    setPoppedTeam(null);
  }

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🍿</div>
        <div className="font-body-md text-body-md">{t('gamePopcorn.needParticipants')}</div>
      </div>
    );
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gamePopcorn.teamBlue') : t('gamePopcorn.teamRed'));

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="flex gap-3 mb-5">
        <div data-skin-object="score-card" className="px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-center">
          <div className="font-caption text-caption text-primary">{teamLabel('blue')}</div>
          <div className="font-title-md text-title-md text-primary tabular-nums">{scores.blue}</div>
        </div>
        <div data-skin-object="score-card" className="px-5 py-2.5 rounded-xl bg-error/10 border border-error/30 text-center">
          <div className="font-caption text-caption text-error">{teamLabel('red')}</div>
          <div className="font-title-md text-title-md text-error tabular-nums">{scores.red}</div>
        </div>
      </div>

      <div
        className={`mb-4 px-6 py-2 rounded-full font-label-md text-label-md ${
          turn === 'blue' ? 'bg-primary text-on-primary' : 'bg-error text-on-error'
        }`}
      >
        {t('gamePopcorn.turnLabel', { team: teamLabel(turn) })}
      </div>

      <button
        type="button"
        onClick={draw}
        data-skin-object="popcorn"
        className={`text-8xl mb-5 transition-transform hover:scale-105 active:scale-95 ${
          poppedTeam ? 'result-pop' : ''
        }`}
        aria-label={t('gamePopcorn.drawButton')}
      >
        🍿
      </button>

      {lastCard && (
        <div className="result-pop mb-5 text-center">
          {lastCard === 'pop' ? (
            <div className="bg-error-container text-on-error-container rounded-2xl px-8 py-4 font-display-lg text-[34px]">
              {t('gamePopcorn.popMessage', { team: teamLabel(poppedTeam ?? turn) })}
            </div>
          ) : (
            <div className="bg-secondary-container/30 border border-secondary-container rounded-2xl px-9 py-4 font-display-lg text-[34px] text-deep-navy">
              {lastCard.label}
            </div>
          )}
        </div>
      )}

      <button
        onClick={draw}
        className="px-10 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
      >
        {t('gamePopcorn.drawButton')}
      </button>

      <button
        onClick={resetAll}
        className="mt-6 font-caption text-caption text-on-surface-variant hover:text-error transition-colors"
      >
        {t('gamePopcorn.resetButton')}
      </button>
    </div>
  );
}
