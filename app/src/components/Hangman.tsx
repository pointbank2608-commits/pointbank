import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem, UndoHandle } from '../lib/types';

interface Props {
  items: GameItem[];
  maxAttempts: number;
}

type Status = 'playing' | 'won' | 'lost';

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';
const pill =
  'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isLatinLetter(ch: string): boolean {
  return /^[a-zA-Z]$/.test(ch);
}

interface Snapshot {
  guessed: Set<string>;
  wrongCount: number;
  status: Status;
  score: number;
}

const Hangman = forwardRef<UndoHandle, Props>(function Hangman({ items, maxAttempts }, ref) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [wrongCount, setWrongCount] = useState(0);
  const [status, setStatus] = useState<Status>('playing');
  const [score, setScore] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [prevSnapshot, setPrevSnapshot] = useState<Snapshot | null>(null);
  const [keyCase, setKeyCase] = useState<'upper' | 'lower'>('upper');
  const itemKey = items.map((item) => item.id).join(',');

  const word =
    items.length > 0 && order.length > 0 && pos < order.length ? items[order[pos]].label : '';

  const playRef = useRef({ status, guessed, word, wrongCount, maxAttempts, score });
  playRef.current = { status, guessed, word, wrongCount, maxAttempts, score };

  useEffect(() => {
    setOrder(shuffle(items.map((_, i) => i)));
    setPos(0);
    setGuessed(new Set());
    setWrongCount(0);
    setStatus('playing');
    setScore(0);
    setInputValue('');
    setPrevSnapshot(null);
  }, [itemKey]);

  function applyGuess(raw: string) {
    const ch = raw.trim().slice(0, 1);
    if (!ch) return;
    const key = ch.toLowerCase();
    const play = playRef.current;
    if (play.status !== 'playing' || !play.word || play.guessed.has(key)) return;

    setPrevSnapshot({ guessed: new Set(play.guessed), wrongCount: play.wrongCount, status: play.status, score: play.score });

    const nextGuessed = new Set(play.guessed).add(key);
    play.guessed = nextGuessed;
    setGuessed(nextGuessed);

    if (!play.word.toLowerCase().includes(key)) {
      const nextWrong = play.wrongCount + 1;
      play.wrongCount = nextWrong;
      setWrongCount(nextWrong);
      if (nextWrong >= play.maxAttempts) {
        play.status = 'lost';
        setStatus('lost');
      }
      return;
    }
    const allRevealed = [...play.word].every((c) => c === ' ' || nextGuessed.has(c.toLowerCase()));
    if (allRevealed) {
      play.status = 'won';
      setStatus('won');
      setScore((s) => s + 1);
    }
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!prevSnapshot) return;
      setGuessed(prevSnapshot.guessed);
      setWrongCount(prevSnapshot.wrongCount);
      setStatus(prevSnapshot.status);
      setScore(prevSnapshot.score);
      setPrevSnapshot(null);
    },
  }));

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key.length === 1 && isLatinLetter(e.key)) {
        e.preventDefault();
        applyGuess(e.key);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="hm-tile hm-tile-0 mx-auto mb-3 flex h-14 w-12 items-center justify-center text-[22px]">A</div>
        <div className="font-body-md text-body-md">{t('gameHangman.needParticipants')}</div>
      </div>
    );
  }

  if (order.length === 0) {
    return null;
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
    setPrevSnapshot(null);
  }

  function next() {
    setPos((p) => p + 1);
    setGuessed(new Set());
    setWrongCount(0);
    setStatus('playing');
    setInputValue('');
    setPrevSnapshot(null);
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameHangman.finishedTitle')}</div>
            <div className="font-display-lg text-[40px] tabular-nums text-deep-navy">
              {t('gameHangman.scoreLabel', { score, total: order.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameHangman.restartButton')}
        </button>
      </div>
    );
  }

  const revealAll = status !== 'playing';
  const livesLeft = Math.max(0, maxAttempts - wrongCount);
  const needsOtherInput = [...word].some((c) => c !== ' ' && !isLatinLetter(c));
  const wordLower = word.toLowerCase();

  function submitTyped() {
    applyGuess(inputValue);
    setInputValue('');
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {pos + 1} / {order.length}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-center gap-1" aria-label={t('gameHangman.livesLabel')}>
        {Array.from({ length: maxAttempts }, (_, i) => (
          <span
            key={i}
            data-skin-object="life-icon"
            className={`hm-heart ${i < livesLeft ? '' : 'is-gone'}`}
          />
        ))}
      </div>

      <div
        data-skin-stage="board"
        className={`hm-rack mb-5 ${status === 'won' ? 'is-won' : ''} ${status === 'lost' ? 'is-lost' : ''}`}
      >
        {[...word].map((ch, i) => {
          if (ch === ' ') return <div key={i} className="hm-space" />;
          const isGuessedChar = guessed.has(ch.toLowerCase());
          const shown = revealAll || isGuessedChar;
          const miss = status === 'lost' && !isGuessedChar;
          return (
            <div key={i} data-skin-object="letter-box" className="hm-slot">
              {shown ? (
                <div className={`hm-tile hm-tile-${i % 4} ${miss ? 'is-miss' : ''} ${isGuessedChar || status === 'won' ? 'is-in' : ''}`}>
                  {ch}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {status === 'playing' ? (
        <>
          <div className="mb-2 flex bg-surface-container-lowest rounded-lg p-1 w-fit">
            <button
              type="button"
              onClick={() => setKeyCase('upper')}
              className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                keyCase === 'upper' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('gameHangman.keyCaseUpper')}
            </button>
            <button
              type="button"
              onClick={() => setKeyCase('lower')}
              className={`px-3 py-1 rounded-md font-label-md text-label-md transition-all ${
                keyCase === 'lower' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('gameHangman.keyCaseLower')}
            </button>
          </div>
          <div className="hm-kb" role="group" aria-label={t('gameHangman.keyboardLabel')}>
            {KEY_ROWS.map((row) => (
              <div key={row} className="hm-kb-row">
                {[...row].map((letter) => {
                  const key = letter.toLowerCase();
                  const used = guessed.has(key);
                  const hit = used && wordLower.includes(key);
                  const miss = used && !hit;
                  const shown = keyCase === 'upper' ? letter : key;
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={used}
                      aria-pressed={used}
                      aria-label={letter}
                      className={`hm-key ${hit ? 'is-ok' : ''} ${miss ? 'is-no' : ''}`}
                      onClick={() => applyGuess(letter)}
                    >
                      {shown}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {needsOtherInput && (
            <div className="mt-4 flex items-center gap-3">
              <div className="hm-guess-wrap">
                <input
                  type="text"
                  value={inputValue}
                  maxLength={1}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitTyped();
                  }}
                  placeholder={t('gameHangman.guessPlaceholder')}
                  className="hm-guess"
                />
              </div>
              <button type="button" onClick={submitTyped} className={pill}>
                {t('gameHangman.guessButton')}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="result-pop flex flex-col items-center gap-4">
          <div
            className="rounded-full px-6 py-2.5 font-title-md text-title-md font-bold text-white shadow-sm"
            style={{ backgroundColor: status === 'won' ? '#3dbea8' : '#f28b73', boxShadow: woodShadow }}
          >
            {status === 'won' ? t('gameHangman.wonFeedback') : t('gameHangman.lostFeedback', { word })}
          </div>
          <button onClick={next} className={pill}>
            {t('gameHangman.nextButton')}
          </button>
        </div>
      )}
    </div>
  );
});

export default Hangman;
