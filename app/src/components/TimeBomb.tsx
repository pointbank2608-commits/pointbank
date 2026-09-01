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

const IDLE_SRC = '/skins/bomb-idle.png';
const EXPLODED_SRC = '/skins/bomb-exploded.png';

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
  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  return (
    <div className="flex flex-col items-center pt-3 pb-2">
      <div className="mb-5 flex rounded-full bg-[#f3eee4] p-1">
        <button
          type="button"
          onClick={() => switchMode('pass')}
          className={`rounded-full px-4 py-1.5 font-label-md text-label-md transition-all ${
            mode === 'pass' ? 'bg-white text-secondary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          {t('gameBomb.modePass')}
        </button>
        <button
          type="button"
          onClick={() => switchMode('timer')}
          className={`rounded-full px-4 py-1.5 font-label-md text-label-md transition-all ${
            mode === 'timer' ? 'bg-white text-secondary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          {t('gameBomb.modeTimer')}
        </button>
      </div>

      {blockedForPassMode ? (
        <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
          <img src={IDLE_SRC} alt="" className="mx-auto mb-3 h-24 w-auto" />
          <div className="font-body-md text-body-md">{t('gameBomb.needTwoParticipants')}</div>
        </div>
      ) : (
        <>
          <div className="relative mb-5 flex h-[280px] w-[min(320px,88vw)] items-center justify-center">
            <img
              src={phase === 'exploded' ? EXPLODED_SRC : IDLE_SRC}
              alt=""
              draggable={false}
              className={`pointer-events-none max-h-full max-w-full select-none object-contain ${
                phase === 'active' ? 'bomb-wobble' : phase === 'exploded' ? 'bomb-burst' : ''
              }`}
              style={
                phase === 'active'
                  ? undefined
                  : { filter: 'drop-shadow(0 12px 16px rgba(110, 62, 18, 0.22))' }
              }
            />
          </div>

          {phase === 'idle' && (
            <button onClick={start} className={pill}>
              {t('gameBomb.startButton')}
            </button>
          )}

          {phase === 'active' && mode === 'pass' && (
            <>
              <div className="font-display-lg text-[34px] text-deep-navy mb-4 text-center">
                {t('gameBomb.holderTurn', { name: participants[holderIndex]?.label })}
              </div>
              <button onClick={pass} className={pill}>
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
              <div
                className="result-pop mb-5 rounded-2xl px-9 py-4 text-center"
                style={{
                  backgroundColor: '#f28b73',
                  border: '3px solid #f0d7a8',
                  boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
                }}
              >
                {mode === 'pass' ? (
                  <>
                    <div className="font-caption text-caption font-bold tracking-wider text-white/90 uppercase">
                      {t('gameBomb.explodedCaught')}
                    </div>
                    <div className="font-display-lg mt-0.5 text-[38px] text-[#1e3a5f]">
                      {participants[holderIndex]?.label}
                    </div>
                  </>
                ) : (
                  <div className="font-display-lg text-[38px] text-[#1e3a5f]">{t('gameBomb.explodedTimerOnly')}</div>
                )}
              </div>
              <button onClick={reset} className={pill}>
                {t('gameBomb.resetButton')}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
