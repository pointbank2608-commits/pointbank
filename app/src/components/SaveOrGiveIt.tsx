import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem, SaveOrGiveReward } from '../lib/types';

interface Props {
  items: GameItem[];
  rewardPool: SaveOrGiveReward[];
}

type Team = 'blue' | 'red';
type Phase = 'closed' | 'opening' | 'open' | 'reveal';

const CLOSED_SRC = '/skins/gift-closed.png';
const OPEN_SRC = '/skins/gift-open.png';
const SAVE_SRC = '/skins/gift-save.png';
const GIVE_SRC = '/skins/gift-give.png';
/** 열린 상자 스킨에서 측정한 단어 보드. 값은 이미지 너비/높이 대비 비율. */
const WORD_BOARD = { left: 0.175, top: 0.295, width: 0.65, height: 0.26 };
const OPEN_MS = 520;

function formatReward(r: SaveOrGiveReward, t: (key: string) => string): string {
  if (r.kind === 'swap') return t('gameSaveOrGive.swapReward');
  const v = r.value ?? 0;
  return v > 0 ? `+${v}` : `${v}`;
}

export default function SaveOrGiveIt({ items, rewardPool }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('closed');
  const [turn, setTurn] = useState<Team>('blue');
  const [scores, setScores] = useState<Record<Team, number>>({ blue: 0, red: 0 });
  const [wordIndex, setWordIndex] = useState(0);
  const [lastReward, setLastReward] = useState<SaveOrGiveReward | null>(null);
  const [appliedTeam, setAppliedTeam] = useState<Team | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const opponent: Team = turn === 'blue' ? 'red' : 'blue';
  const currentItem = items[wordIndex % Math.max(items.length, 1)];

  function openBox() {
    if (phase !== 'closed') return;
    setPhase('opening');
    timerRef.current = setTimeout(() => setPhase('open'), OPEN_MS);
  }

  function choose(choice: 'save' | 'give') {
    if (phase !== 'open' || rewardPool.length === 0) return;
    const reward = rewardPool[Math.floor(Math.random() * rewardPool.length)];
    setLastReward(reward);
    if (reward.kind === 'swap') {
      setScores((prev) => ({ blue: prev.red, red: prev.blue }));
      setAppliedTeam(null);
    } else {
      const target = choice === 'save' ? turn : opponent;
      setAppliedTeam(target);
      setScores((prev) => ({ ...prev, [target]: prev[target] + (reward.value ?? 0) }));
    }
    setPhase('reveal');
  }

  function nextRound() {
    setLastReward(null);
    setAppliedTeam(null);
    setWordIndex((i) => i + 1);
    setTurn((tm) => (tm === 'blue' ? 'red' : 'blue'));
    setPhase('closed');
  }

  function resetAll() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('closed');
    setTurn('blue');
    setScores({ blue: 0, red: 0 });
    setWordIndex(0);
    setLastReward(null);
    setAppliedTeam(null);
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameSaveOrGive.teamBlue') : t('gameSaveOrGive.teamRed'));
  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={CLOSED_SRC} alt="" className="mx-auto mb-3 h-20 w-auto" />
        <div className="font-body-md text-body-md">{t('gameSaveOrGive.needParticipants')}</div>
      </div>
    );
  }

  const scorePlaque = (team: Team) => (
    <div
      data-skin-object="score-card"
      className="min-w-[108px] rounded-2xl px-5 py-2.5 text-center"
      style={{
        backgroundColor: team === 'blue' ? '#3dbea8' : '#f28b73',
        border: '3px solid #f0d7a8',
        boxShadow: '0 3px 0 #c4925c, 0 6px 12px rgba(110,62,18,0.12)',
      }}
    >
      <div className="font-caption text-caption font-bold text-white/90">{teamLabel(team)}</div>
      <div className="font-title-md text-[22px] tabular-nums text-white">{scores[team]}</div>
    </div>
  );

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 flex gap-3">
        {scorePlaque('blue')}
        {scorePlaque('red')}
      </div>

      {phase !== 'reveal' && (
        <div
          className={`mb-3 rounded-full px-6 py-2 font-label-md text-label-md shadow-sm ${
            turn === 'blue' ? 'bg-secondary text-on-secondary' : 'text-white'
          }`}
          style={turn === 'red' ? { backgroundColor: '#f28b73' } : undefined}
        >
          {t('gameSaveOrGive.turnLabel', { team: teamLabel(turn) })}
        </div>
      )}

      {(phase === 'closed' || phase === 'opening') && (
        <>
          <button
            type="button"
            onClick={openBox}
            disabled={phase === 'opening'}
            aria-label={t('gameSaveOrGive.openBoxButton')}
            className={`relative mb-3 w-[min(280px,78vw)] bg-transparent p-0 ${
              phase === 'opening' ? 'lottery-box-shake' : ''
            }`}
            style={phase === 'closed' ? { filter: 'drop-shadow(0 10px 14px rgba(90, 50, 18, 0.28))' } : undefined}
          >
            <img src={CLOSED_SRC} alt="" draggable={false} className="pointer-events-none w-full select-none" />
          </button>
          <div className="mb-1 font-caption text-caption text-on-surface-variant">{t('gameSaveOrGive.openHint')}</div>
        </>
      )}

      {(phase === 'open' || phase === 'reveal') && (
        <div
          data-skin-object="gift-box"
          className={`relative mb-3 w-[min(250px,72vw)] ${phase === 'open' ? 'gift-lid-pop' : ''}`}
          style={{ filter: 'drop-shadow(0 10px 14px rgba(90, 50, 18, 0.28))' }}
        >
          <img src={OPEN_SRC} alt="" draggable={false} className="pointer-events-none w-full select-none" />
          <div
            className="absolute flex items-center justify-center px-2 text-center"
            style={{
              left: `${WORD_BOARD.left * 100}%`,
              top: `${WORD_BOARD.top * 100}%`,
              width: `${WORD_BOARD.width * 100}%`,
              height: `${WORD_BOARD.height * 100}%`,
            }}
          >
            <span className="max-w-full font-title-md text-[clamp(18px,5.4vw,28px)] leading-tight text-deep-navy [word-break:keep-all]">
              {currentItem?.label}
            </span>
          </div>
        </div>
      )}

      {phase === 'open' && (
        <>
          <div className="mb-4 font-body-md text-body-md text-on-surface-variant">{t('gameSaveOrGive.chooseAfterRead')}</div>
          <div className="flex w-full max-w-[420px] items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => choose('save')}
              aria-label={t('gameSaveOrGive.saveButton')}
              className="h-[72px] w-[min(190px,44vw)] bg-transparent p-0 transition-[filter] hover:brightness-105 active:brightness-95"
              style={{ filter: 'drop-shadow(0 6px 10px rgba(90, 50, 18, 0.22))' }}
            >
              <img src={SAVE_SRC} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-contain" />
            </button>
            <button
              type="button"
              onClick={() => choose('give')}
              aria-label={t('gameSaveOrGive.giveButton')}
              className="h-[72px] w-[min(190px,44vw)] bg-transparent p-0 transition-[filter] hover:brightness-105 active:brightness-95"
              style={{ filter: 'drop-shadow(0 6px 10px rgba(90, 50, 18, 0.22))' }}
            >
              <img src={GIVE_SRC} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-contain" />
            </button>
          </div>
        </>
      )}

      {phase === 'reveal' && lastReward && (
        <div className="result-pop mt-1 flex flex-col items-center gap-4">
          <div
            className="rounded-2xl px-9 py-4 text-center"
            style={{
              backgroundColor: '#f28b73',
              border: '3px solid #f0d7a8',
              boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
            }}
          >
            {lastReward.kind === 'swap' ? (
              <div className="font-title-md text-[22px] font-bold text-white">{t('gameSaveOrGive.swapMessage')}</div>
            ) : (
              <div className="font-title-md text-[22px] font-bold text-white">
                {t('gameSaveOrGive.rewardResultLabel', {
                  team: appliedTeam ? teamLabel(appliedTeam) : '',
                  reward: formatReward(lastReward, t),
                })}
              </div>
            )}
          </div>
          <button onClick={nextRound} className={pill}>
            {t('gameSaveOrGive.nextRoundButton')}
          </button>
        </div>
      )}

      {phase === 'closed' && (
        <button
          onClick={resetAll}
          className="mt-5 font-caption text-caption text-on-surface-variant transition-colors hover:text-error"
        >
          {t('gameSaveOrGive.resetButton')}
        </button>
      )}
    </div>
  );
}
