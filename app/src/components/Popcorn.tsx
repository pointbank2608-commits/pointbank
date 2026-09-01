import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

type Team = 'blue' | 'red';
type Card = GameItem | 'pop';

const POP_RATIO = 0.25;
const KETTLE_SRC = '/skins/popcorn-kettle.png?v=2';
const KERNEL_SRC = '/skins/popcorn-kernel.png';

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

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';

export default function Popcorn({ items }: Props) {
  const { t } = useTranslation();
  const [deck, setDeck] = useState<Card[]>(() => buildDeck(items));
  const [deckIndex, setDeckIndex] = useState(0);
  const [turn, setTurn] = useState<Team>('blue');
  const [scores, setScores] = useState<Record<Team, number>>({ blue: 0, red: 0 });
  const [lastCard, setLastCard] = useState<Card | null>(null);
  const [poppedTeam, setPoppedTeam] = useState<Team | null>(null);
  const [hop, setHop] = useState(0);

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
    setHop((n) => n + 1);

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
    setHop(0);
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gamePopcorn.teamBlue') : t('gamePopcorn.teamRed'));
  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={KETTLE_SRC} alt="" className="mx-auto mb-3 h-16 w-auto" />
        <div className="font-body-md text-body-md">{t('gamePopcorn.needParticipants')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5">
        <div
          data-skin-object="score-card"
          className="min-w-[92px] rounded-2xl px-5 py-2.5 text-center text-on-secondary"
          style={{ backgroundColor: '#3dbea8', boxShadow: woodShadow }}
        >
          <div className="font-caption text-[13px] font-bold opacity-90">{teamLabel('blue')}</div>
          <div className="font-title-md text-[26px] font-bold tabular-nums leading-none">{scores.blue}</div>
        </div>
        <div
          className={`rounded-full px-7 py-2.5 font-title-md text-[18px] font-bold shadow-sm ${
            turn === 'blue' ? 'bg-secondary text-on-secondary' : 'text-white'
          }`}
          style={turn === 'red' ? { backgroundColor: '#f28b73' } : undefined}
        >
          {t('gamePopcorn.turnLabel', { team: teamLabel(turn) })}
        </div>
        <div
          data-skin-object="score-card"
          className="min-w-[92px] rounded-2xl px-5 py-2.5 text-center text-white"
          style={{ backgroundColor: '#f28b73', boxShadow: woodShadow }}
        >
          <div className="font-caption text-[13px] font-bold opacity-90">{teamLabel('red')}</div>
          <div className="font-title-md text-[26px] font-bold tabular-nums leading-none">{scores.red}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={draw}
        data-skin-object="popcorn"
        aria-label={t('gamePopcorn.drawButton')}
        className="relative mb-4 max-w-[min(440px,92%)] overflow-visible transition-transform hover:scale-[1.03] active:scale-[0.98]"
      >
        <img
          key={`kettle-${hop}`}
          src={KETTLE_SRC}
          alt=""
          draggable={false}
          className={`w-full select-none ${hop > 0 ? 'pc-hop' : ''}`}
          style={{ filter: 'drop-shadow(0 10px 14px rgba(90, 50, 18, 0.26))' }}
        />
        {hop > 0 && (
          <img
            key={`kernel-${hop}`}
            src={KERNEL_SRC}
            alt=""
            draggable={false}
            className="pc-kernel select-none"
            style={
              {
                ['--pc-x']: `${hop % 3 === 0 ? 78 : hop % 3 === 1 ? -72 : 58}px`,
              } as CSSProperties
            }
          />
        )}
      </button>

      {lastCard && (
        <div key={hop} className="result-pop mb-5 w-[min(420px,92%)] text-center">
          {lastCard === 'pop' ? (
            <div
              className="rounded-[22px] px-7 py-4"
              style={{
                backgroundColor: '#f28b73',
                border: '3px solid #f0d7a8',
                boxShadow: woodShadow,
              }}
            >
              <div className="font-title-md text-[22px] font-bold leading-snug text-white">
                {t('gamePopcorn.popMessage', { team: teamLabel(poppedTeam ?? turn) })}
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-center px-2 py-2"
              style={{
                borderRadius: 22,
                background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
                boxShadow: woodShadow,
              }}
            >
              <span
                className="flex min-h-[64px] w-full items-center justify-center px-4 py-2"
                style={{
                  borderRadius: 16,
                  background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
                  boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
                }}
              >
                <span className="text-center font-bold leading-tight text-deep-navy [word-break:keep-all] text-[clamp(22px,4.2vw,34px)]">
                  {lastCard.label}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={draw} className={pill}>
        {t('gamePopcorn.drawButton')}
      </button>

      <button
        type="button"
        onClick={resetAll}
        className="mt-6 font-caption text-caption text-on-surface-variant hover:text-error transition-colors"
      >
        {t('gamePopcorn.resetButton')}
      </button>
    </div>
  );
}
