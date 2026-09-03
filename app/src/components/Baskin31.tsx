import { forwardRef, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import type { GameItem, UndoHandle } from '../lib/types';

interface Props {
  items: GameItem[];
  targetCount: number;
}

type Team = 'blue' | 'red';

const PICK_OPTIONS = [1, 2, 3];
const CONE_SRC = '/skins/baskin-cone.png';
const COUNTER_SRC = '/skins/baskin-counter.png';
const CARD_SRC = '/skins/miss-card.png';

/** 스킨 이미지에서 측정한 화면 구멍. 값은 이미지 너비/높이 대비 비율. */
const SCREEN = { left: 0.12, top: 0.25, width: 0.75, height: 0.5 };
const SCREEN_FILL = { left: 0.095, top: 0.195, width: 0.805, height: 0.615 };

interface Snapshot {
  count: number;
  turn: Team;
  wordIndex: number;
  lastWords: string[];
  loser: Team | null;
}

const Baskin31 = forwardRef<UndoHandle, Props>(function Baskin31({ items, targetCount }, ref) {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const [turn, setTurn] = useState<Team>('blue');
  const [wordIndex, setWordIndex] = useState(0);
  const [lastWords, setLastWords] = useState<string[]>([]);
  const [loser, setLoser] = useState<Team | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<Snapshot | null>(null);

  function pick(n: number) {
    if (loser || items.length === 0) return;
    setPrevSnapshot({ count, turn, wordIndex, lastWords, loser });
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
    setPrevSnapshot(null);
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!prevSnapshot) return;
      setCount(prevSnapshot.count);
      setTurn(prevSnapshot.turn);
      setWordIndex(prevSnapshot.wordIndex);
      setLastWords(prevSnapshot.lastWords);
      setLoser(prevSnapshot.loser);
      setPrevSnapshot(null);
    },
  }));

  const pill =
    'px-6 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={CONE_SRC} alt="" className="mx-auto mb-3 h-16 w-auto" />
        <div className="font-body-md text-body-md">{t('gameBaskin31.needParticipants')}</div>
      </div>
    );
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameBaskin31.teamBlue') : t('gameBaskin31.teamRed'));

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <img
        src={CONE_SRC}
        alt=""
        data-skin-object="scoop"
        draggable={false}
        className={`mb-4 h-[min(168px,38vw)] w-auto select-none transition-all ${
          loser ? 'scale-90 grayscale opacity-40' : ''
        }`}
        style={{ filter: loser ? undefined : 'drop-shadow(0 8px 12px rgba(90, 50, 18, 0.22))' }}
      />

      <div
        className="relative mb-4 w-[min(280px,86vw)]"
        style={{ filter: 'drop-shadow(0 8px 12px rgba(90, 50, 18, 0.28))' }}
      >
        <div
          className="absolute z-0 bg-[#1a2430]"
          style={{
            left: `${SCREEN_FILL.left * 100}%`,
            top: `${SCREEN_FILL.top * 100}%`,
            width: `${SCREEN_FILL.width * 100}%`,
            height: `${SCREEN_FILL.height * 100}%`,
          }}
        />
        <img src={COUNTER_SRC} alt="" draggable={false} className="pointer-events-none relative z-10 w-full select-none" />
        <div
          className="absolute z-20 flex items-center justify-center"
          style={{
            left: `${SCREEN.left * 100}%`,
            top: `${SCREEN.top * 100}%`,
            width: `${SCREEN.width * 100}%`,
            height: `${SCREEN.height * 100}%`,
          }}
        >
          <span className="font-mono text-[clamp(22px,7vw,36px)] font-bold tabular-nums tracking-wide text-[#e8fbf6]">
            {count}
            <span className="text-[0.62em] text-[#9adfd4]"> / {targetCount}</span>
          </span>
        </div>
      </div>

      {!loser && (
        <div
          className={`mb-4 rounded-full px-6 py-2 font-label-md text-label-md shadow-sm ${
            turn === 'blue' ? 'bg-secondary text-on-secondary' : 'text-white'
          }`}
          style={turn === 'red' ? { backgroundColor: '#f28b73' } : undefined}
        >
          {t('gameBaskin31.turnLabel', { team: teamLabel(turn) })}
        </div>
      )}

      {lastWords.length > 0 && (
        <div className="mb-5 flex flex-wrap justify-center gap-2">
          {lastWords.map((w, i) => (
            <div
              key={`${w}-${i}`}
              className="relative w-[min(118px,30vw)]"
              style={{ filter: 'drop-shadow(0 5px 7px rgba(90, 50, 18, 0.16))' }}
            >
              <img src={CARD_SRC} alt="" draggable={false} className="pointer-events-none w-full select-none" />
              <div
                className="absolute flex items-center justify-center px-1"
                style={{ left: '10%', top: '13%', width: '81%', height: '75%' }}
              >
                <span className="block h-full w-full min-h-0">
                  <GameFitText text={w} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loser ? (
        <div className="flex flex-wrap justify-center gap-2.5">
          {PICK_OPTIONS.map((n) => (
            <button key={n} onClick={() => pick(n)} className={pill}>
              {t('gameBaskin31.pickButton', { n })}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div
            className="result-pop rounded-2xl px-8 py-4 text-center"
            style={{
              backgroundColor: '#f28b73',
              border: '3px solid #f0d7a8',
              boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
            }}
          >
            <div className="font-title-md text-[20px] font-bold text-white">
              {t('gameBaskin31.loseMessage', { team: teamLabel(loser), target: targetCount })}
            </div>
          </div>
          <button onClick={resetAll} className={`${pill} px-10`}>
            {t('gameBaskin31.playAgainButton')}
          </button>
        </div>
      )}
    </div>
  );
});

export default Baskin31;
