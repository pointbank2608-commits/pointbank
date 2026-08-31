import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playMusic } from '../lib/gameMusic';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  participants: GameItem[];
  minSec: number;
  maxSec: number;
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
}

type Phase = 'idle' | 'active' | 'exploded';
type Mode = 'pass' | 'timer';

/**
 * 시한폭탄. min~maxSec 사이의 무작위 시각에 터지도록 숨겨진 타이머를 걸어둔다.
 * - "참가자 순서대로": 화면에서 "다음 사람에게 넘기기"를 누를 때마다 폭탄을 든 사람이 바뀌고,
 *   터지는 순간 그때 들고 있던 사람이 걸린다.
 * - "타이머만": 참가자 없이 카운트다운(숨김)과 폭발 연출만 — 실제 물건(인형/공 등)을 돌릴 때 씀.
 */
export default function TimeBomb({ participants, minSec, maxSec, music, resultSound }: Props) {
  const { t } = useTranslation();
  const n = participants.length;
  const [mode, setMode] = useState<Mode>('pass');
  const [phase, setPhase] = useState<Phase>('idle');
  const [holderIndex, setHolderIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopMusicRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopMusicRef.current();
    };
  }, []);

  function start() {
    if (phase === 'active') return;
    if (mode === 'pass' && n < 2) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMusicRef.current();

    setHolderIndex(0);
    setPhase('active');
    stopMusicRef.current = playMusic(music, { loop: true });

    const span = Math.max(maxSec - minSec, 0);
    const delaySec = minSec + Math.random() * span;
    timerRef.current = setTimeout(() => {
      setPhase('exploded');
      stopMusicRef.current();
      playMusic(resultSound);
    }, delaySec * 1000);
  }

  function pass() {
    if (phase !== 'active' || n === 0) return;
    setHolderIndex((prev) => (prev + 1) % n);
  }

  function reset() {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMusicRef.current();
    setPhase('idle');
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    reset();
    setMode(next);
  }

  const blockedForPassMode = mode === 'pass' && n < 2;

  return (
    <div className="flex flex-col items-center pt-3 pb-2">
      <div className="flex bg-surface-container-low rounded-lg p-1 mb-5">
        <button
          type="button"
          onClick={() => switchMode('pass')}
          className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-all ${
            mode === 'pass' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          {t('gameBomb.modePass')}
        </button>
        <button
          type="button"
          onClick={() => switchMode('timer')}
          className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-all ${
            mode === 'timer' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          {t('gameBomb.modeTimer')}
        </button>
      </div>

      {blockedForPassMode ? (
        <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
          <div className="text-4xl mb-2">💣</div>
          <div className="font-body-md text-body-md">{t('gameBomb.needTwoParticipants')}</div>
        </div>
      ) : (
        <>
          <div className="relative w-[300px] h-[300px] flex items-center justify-center mb-6">
            <div
              className={`text-[200px] leading-none drop-shadow-[0_16px_26px_rgba(39,101,168,0.32)] ${
                phase === 'active' ? 'bomb-shake' : phase === 'exploded' ? 'bomb-burst' : ''
              }`}
            >
              {phase === 'exploded' ? '💥' : '💣'}
            </div>
            {phase === 'active' && (
              <div className="bomb-spark-flicker absolute top-3.5 right-11 text-5xl">✨</div>
            )}
          </div>

          {phase === 'idle' && (
            <button
              onClick={start}
              className="px-10 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
            >
              {t('gameBomb.startButton')}
            </button>
          )}

          {phase === 'active' && mode === 'pass' && (
            <>
              <div className="font-display-lg text-[34px] text-deep-navy mb-4 text-center">
                {t('gameBomb.holderTurn', { name: participants[holderIndex]?.label })}
              </div>
              <button
                onClick={pass}
                className="px-10 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
              >
                {t('gameBomb.passButton')}
              </button>
            </>
          )}

          {phase === 'active' && mode === 'timer' && (
            <div className="font-display-lg text-[34px] text-deep-navy mb-4 text-center">
              {t('gameBomb.timerModeHint')}
            </div>
          )}

          {phase === 'exploded' && (
            <>
              <div className="result-pop text-center bg-secondary-container/30 border border-secondary-container rounded-2xl px-9 py-4.5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] mb-5">
                {mode === 'pass' ? (
                  <>
                    <div className="font-caption text-caption font-bold tracking-wider text-secondary uppercase">
                      {t('gameBomb.explodedCaught')}
                    </div>
                    <div className="font-display-lg text-[38px] text-deep-navy mt-0.5">
                      {participants[holderIndex]?.label}
                    </div>
                  </>
                ) : (
                  <div className="font-display-lg text-[38px] text-deep-navy">{t('gameBomb.explodedTimerOnly')}</div>
                )}
              </div>
              <button
                onClick={reset}
                className="px-10 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
              >
                {t('gameBomb.resetButton')}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
