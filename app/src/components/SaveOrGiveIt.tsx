import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem, SaveOrGiveReward } from '../lib/types';

interface Props {
  items: GameItem[];
  rewardPool: SaveOrGiveReward[];
}

type Team = 'blue' | 'red';
type Phase = 'prompt' | 'choose' | 'mixing' | 'reveal';

const MIX_MS = 900;

function formatReward(r: SaveOrGiveReward, t: (key: string) => string): string {
  if (r.kind === 'swap') return t('gameSaveOrGive.swapReward');
  const v = r.value ?? 0;
  return v > 0 ? `+${v}` : `${v}`;
}

export default function SaveOrGiveIt({ items, rewardPool }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('prompt');
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
  const currentItem = items[wordIndex % items.length];

  function advanceTurn() {
    setWordIndex((i) => i + 1);
    setTurn((tm) => (tm === 'blue' ? 'red' : 'blue'));
    setPhase('prompt');
  }

  function choose(choice: 'save' | 'give') {
    setPhase('mixing');
    const reward = rewardPool[Math.floor(Math.random() * rewardPool.length)];
    timerRef.current = setTimeout(() => {
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
    }, MIX_MS);
  }

  function nextRound() {
    setLastReward(null);
    setAppliedTeam(null);
    advanceTurn();
  }

  function resetAll() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('prompt');
    setTurn('blue');
    setScores({ blue: 0, red: 0 });
    setWordIndex(0);
    setLastReward(null);
    setAppliedTeam(null);
  }

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🎁</div>
        <div className="font-body-md text-body-md">{t('gameSaveOrGive.needParticipants')}</div>
      </div>
    );
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameSaveOrGive.teamBlue') : t('gameSaveOrGive.teamRed'));

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="flex gap-3 mb-5">
        <div className="px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-center">
          <div className="font-caption text-caption text-primary">{teamLabel('blue')}</div>
          <div className="font-title-md text-title-md text-primary tabular-nums">{scores.blue}</div>
        </div>
        <div className="px-5 py-2.5 rounded-xl bg-error/10 border border-error/30 text-center">
          <div className="font-caption text-caption text-error">{teamLabel('red')}</div>
          <div className="font-title-md text-title-md text-error tabular-nums">{scores.red}</div>
        </div>
      </div>

      {(phase === 'prompt' || phase === 'choose') && (
        <div
          className={`mb-4 px-6 py-2 rounded-full font-label-md text-label-md ${
            turn === 'blue' ? 'bg-primary text-on-primary' : 'bg-error text-on-error'
          }`}
        >
          {t('gameSaveOrGive.turnLabel', { team: teamLabel(turn) })}
        </div>
      )}

      {phase === 'prompt' && (
        <>
          <div className="font-display-lg text-[34px] text-deep-navy mb-6 text-center [word-break:keep-all]">
            {currentItem.label}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('choose')}
              className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
            >
              {t('gameSaveOrGive.correctButton')}
            </button>
            <button
              onClick={advanceTurn}
              className="px-6 py-3 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-label-md text-label-md transition-colors"
            >
              {t('gameSaveOrGive.skipButton')}
            </button>
          </div>
        </>
      )}

      {phase === 'choose' && (
        <>
          <div className="font-body-lg text-body-lg text-on-surface-variant mb-4">{t('gameSaveOrGive.chooseSavePrompt')}</div>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[420px]">
            <button
              onClick={() => choose('save')}
              className="flex-1 px-6 py-4 rounded-2xl bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
            >
              {t('gameSaveOrGive.saveButton')}
            </button>
            <button
              onClick={() => choose('give')}
              className="flex-1 px-6 py-4 rounded-2xl bg-error hover:brightness-95 text-on-error font-title-md text-title-md shadow-sm transition-colors"
            >
              {t('gameSaveOrGive.giveButton')}
            </button>
          </div>
        </>
      )}

      {phase === 'mixing' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="text-6xl lottery-box-shake">🎁</div>
          <div className="font-body-md text-body-md text-on-surface-variant">{t('gameSaveOrGive.openingBox')}</div>
        </div>
      )}

      {phase === 'reveal' && lastReward && (
        <div className="result-pop flex flex-col items-center gap-4">
          <div className="text-center bg-secondary-container/30 border border-secondary-container rounded-2xl px-9 py-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
            {lastReward.kind === 'swap' ? (
              <div className="font-display-lg text-[28px] text-deep-navy">{t('gameSaveOrGive.swapMessage')}</div>
            ) : (
              <div className="font-display-lg text-[38px] text-deep-navy">
                {t('gameSaveOrGive.rewardResultLabel', {
                  team: appliedTeam ? teamLabel(appliedTeam) : '',
                  reward: formatReward(lastReward, t),
                })}
              </div>
            )}
          </div>
          <button
            onClick={nextRound}
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
          >
            {t('gameSaveOrGive.nextRoundButton')}
          </button>
        </div>
      )}

      {phase === 'prompt' && (
        <button
          onClick={resetAll}
          className="mt-6 font-caption text-caption text-on-surface-variant hover:text-error transition-colors"
        >
          {t('gameSaveOrGive.resetButton')}
        </button>
      )}
    </div>
  );
}
