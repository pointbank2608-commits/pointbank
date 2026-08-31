import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
  maxAttempts: number;
}

type Status = 'playing' | 'won' | 'lost';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Hangman({ items, maxAttempts }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [wrongCount, setWrongCount] = useState(0);
  const [status, setStatus] = useState<Status>('playing');
  const [score, setScore] = useState(0);
  const [inputValue, setInputValue] = useState('');

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🔤</div>
        <div className="font-body-md text-body-md">{t('gameHangman.needParticipants')}</div>
      </div>
    );
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(items.map((_, i) => i)));
    setPos(0);
    setGuessed(new Set());
    setWrongCount(0);
    setStatus('playing');
    setScore(0);
    setInputValue('');
  }

  function next() {
    setPos((p) => p + 1);
    setGuessed(new Set());
    setWrongCount(0);
    setStatus('playing');
    setInputValue('');
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🏆</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameHangman.finishedTitle')}</div>
        <div className="font-display-lg text-[40px] text-deep-navy mb-6 tabular-nums">
          {t('gameHangman.scoreLabel', { score, total: order.length })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameHangman.restartButton')}
        </button>
      </div>
    );
  }

  const word = items[order[pos]].label;
  const revealAll = status !== 'playing';
  const livesLeft = Math.max(0, maxAttempts - wrongCount);
  const wrongLetters = [...guessed].filter((ch) => !word.toLowerCase().includes(ch));

  function submitGuess() {
    const ch = inputValue.trim().slice(0, 1);
    setInputValue('');
    if (!ch || status !== 'playing') return;
    const key = ch.toLowerCase();
    if (guessed.has(key)) return;
    const nextGuessed = new Set(guessed).add(key);
    setGuessed(nextGuessed);

    if (!word.toLowerCase().includes(key)) {
      const nextWrong = wrongCount + 1;
      setWrongCount(nextWrong);
      if (nextWrong >= maxAttempts) setStatus('lost');
      return;
    }
    const allRevealed = [...word].every((c) => c === ' ' || nextGuessed.has(c.toLowerCase()));
    if (allRevealed) {
      setStatus('won');
      setScore((s) => s + 1);
    }
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="font-caption text-caption text-on-surface-variant mb-3 tabular-nums">
        {pos + 1} / {order.length}
      </div>

      <div className="flex items-center gap-1 mb-5" aria-label={t('gameHangman.livesLabel')}>
        {Array.from({ length: maxAttempts }, (_, i) => (
          <span key={i} className="text-xl">
            {i < livesLeft ? '❤️' : '🤍'}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-[560px]">
        {[...word].map((ch, i) => {
          if (ch === ' ') return <div key={i} className="w-4" />;
          const isGuessedChar = guessed.has(ch.toLowerCase());
          const shown = revealAll || isGuessedChar;
          let boxClass = 'bg-surface-container-low border-outline-variant text-deep-navy';
          if (status === 'won') boxClass = 'bg-secondary-container/40 border-secondary text-on-surface';
          else if (status === 'lost' && !isGuessedChar) boxClass = 'bg-error-container border-error text-on-error-container';
          else if (status === 'lost') boxClass = 'bg-secondary-container/40 border-secondary text-on-surface';
          return (
            <div
              key={i}
              className={`w-10 h-12 flex items-center justify-center rounded-lg border-b-4 font-display-lg text-[24px] transition-colors ${boxClass}`}
            >
              {shown ? ch : ''}
            </div>
          );
        })}
      </div>

      {wrongLetters.length > 0 && status === 'playing' && (
        <div className="font-caption text-caption text-on-surface-variant mb-4">
          {t('gameHangman.wrongLettersLabel')}: {wrongLetters.join(', ')}
        </div>
      )}

      {status === 'playing' ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            maxLength={1}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitGuess();
            }}
            placeholder={t('gameHangman.guessPlaceholder')}
            className="w-28 text-center bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <button
            onClick={submitGuess}
            className="px-6 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('gameHangman.guessButton')}
          </button>
        </div>
      ) : (
        <div className="result-pop flex flex-col items-center gap-4">
          <div
            className={`px-6 py-2.5 rounded-full font-title-md text-title-md shadow-sm ${
              status === 'won' ? 'bg-secondary-container/50 text-on-surface' : 'bg-error-container text-on-error-container'
            }`}
          >
            {status === 'won' ? t('gameHangman.wonFeedback') : t('gameHangman.lostFeedback', { word })}
          </div>
          <button
            onClick={next}
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('gameHangman.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
}
