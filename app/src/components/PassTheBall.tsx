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

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">⚽</div>
        <div className="font-body-md text-body-md">{t('gamePassBall.needParticipants')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-3 pb-2">
      <div data-skin-object="ball" className={`text-[140px] leading-none drop-shadow-[0_16px_26px_rgba(39,101,168,0.32)] mb-6 ${phase === 'active' ? 'animate-bounce' : ''}`}>
        ⚽
      </div>

      {phase === 'idle' && (
        <button
          onClick={start}
          className="px-10 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gamePassBall.startButton')}
        </button>
      )}

      {phase === 'active' && (
        <div className="font-display-lg text-[28px] text-deep-navy text-center [word-break:keep-all]">
          {t('gamePassBall.playingHint')}
        </div>
      )}

      {phase === 'revealed' && missionWord && (
        <>
          <div className="result-pop text-center bg-secondary-container/30 border border-secondary-container rounded-2xl px-9 py-4.5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] mb-5">
            <div className="font-caption text-caption font-bold tracking-wider text-secondary uppercase">
              {t('gamePassBall.missionLabel')}
            </div>
            <div className="font-display-lg text-[38px] text-deep-navy mt-0.5">{missionWord.label}</div>
          </div>
          <button
            onClick={reset}
            className="px-10 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
          >
            {t('gamePassBall.resetButton')}
          </button>
        </>
      )}
    </div>
  );
}
