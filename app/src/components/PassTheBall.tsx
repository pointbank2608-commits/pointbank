import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playMusic } from '../lib/gameMusic';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  items: GameItem[];
  minSec: number;
  maxSec: number;
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
}

type Phase = 'idle' | 'active' | 'revealed';

const BALL_SRC = '/skins/passball.png';
const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';

/**
 * 공 돌리기. 음악이 흐르는 동안(min~maxSec 사이 무작위 시각에 멈춤) 화면 밖에서 실제 공을
 * 돌리다가, 음악이 멈추면 무작위 "오늘의 미션 단어"가 공개된다 — 그 순간 공을 든 학생이 읽는다.
 */
export default function PassTheBall({ items, minSec, maxSec, music, resultSound }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [missionWord, setMissionWord] = useState<GameItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopMusicRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopMusicRef.current();
    };
  }, []);

  function start() {
    if (phase === 'active' || items.length === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMusicRef.current();

    setMissionWord(null);
    setPhase('active');
    stopMusicRef.current = playMusic(music, { loop: true });

    const span = Math.max(maxSec - minSec, 0);
    const delaySec = minSec + Math.random() * span;
    timerRef.current = setTimeout(() => {
      const word = items[Math.floor(Math.random() * items.length)];
      setMissionWord(word);
      setPhase('revealed');
      stopMusicRef.current();
      playMusic(resultSound);
    }, delaySec * 1000);
  }

  function reset() {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMusicRef.current();
    setPhase('idle');
    setMissionWord(null);
  }

  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={BALL_SRC} alt="" className="mx-auto mb-3 h-16 w-auto" />
        <div className="font-body-md text-body-md">{t('gamePassBall.needParticipants')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-3 pb-2">
      <img
        src={BALL_SRC}
        alt=""
        data-skin-object="ball"
        draggable={false}
        className={`mb-5 w-[min(280px,62vw)] select-none ${phase === 'active' ? 'pb-pass' : ''}`}
        style={{ filter: 'drop-shadow(0 12px 16px rgba(90, 50, 18, 0.22))' }}
      />

      {phase === 'idle' && (
        <button type="button" onClick={start} className={pill}>
          {t('gamePassBall.startButton')}
        </button>
      )}

      {phase === 'active' && (
        <div className="px-4 text-center font-title-md text-[22px] font-bold text-deep-navy [word-break:keep-all]">
          {t('gamePassBall.playingHint')}
        </div>
      )}

      {phase === 'revealed' && missionWord && (
        <>
          <div className="result-pop mb-5 w-[min(420px,92%)] text-center">
            <div className="mb-2 font-title-md text-[15px] font-bold text-secondary">
              {t('gamePassBall.missionLabel')}
            </div>
            <div
              className="flex items-center justify-center px-2 py-2"
              style={{
                borderRadius: 22,
                background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
                boxShadow: woodShadow,
              }}
            >
              <span
                className="flex min-h-[72px] w-full items-center justify-center px-4 py-2"
                style={{
                  borderRadius: 16,
                  background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
                  boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
                }}
              >
                <span className="text-center font-bold leading-tight text-deep-navy [word-break:keep-all] text-[clamp(24px,4.4vw,36px)]">
                  {missionWord.label}
                </span>
              </span>
            </div>
          </div>
          <button type="button" onClick={reset} className={pill}>
            {t('gamePassBall.resetButton')}
          </button>
        </>
      )}
    </div>
  );
}
