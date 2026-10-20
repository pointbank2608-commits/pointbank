import { gameClock } from '../lib/gameClock';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LotteryMachine, { LOTTERY_FLY_MS } from './LotteryMachine';
import { playMusic } from '../lib/gameMusic';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  pool: GameItem[];
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
}

type Phase = 'idle' | 'mixing';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 실제 로또·빙고 기계처럼: "섞기"를 누르면 공이 계속 돌아가고, 그 사이 언제든 "뽑기"를
 * 눌러 하나씩 꺼낼 수 있다(기계는 뽑는 동안에도 계속 섞인다) — 뽑힌 것들은 아래에 당첨
 * 번호처럼 계속 쌓인다. 다 뽑으면 기계가 멈추고 버튼이 다시 "섞기"로 바뀌어 새 라운드를
 * 시작할 수 있다. 몇 개만 뽑고 멈춰도 되므로 로또 놀이·빙고 숫자 부르기·상품 추첨 등
 * 어디에든 쓸 수 있다.
 */
export default function OrderPicker({ pool, music, resultSound }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [order, setOrder] = useState<GameItem[] | null>(null);
  const [drawnCount, setDrawnCount] = useState(0);
  const [flying, setFlying] = useState(false);
  const timersRef = useRef<ReturnType<typeof gameClock.setTimeout>[]>([]);

  const canMix = pool.length >= 2;
  const drawnList = order ? order.slice(0, drawnCount) : [];
  const remaining = order ? order.length - drawnCount : pool.length;

  // 배경음악(선생님이 고른 "섞기" 사운드)도 기계가 도는 내내(뽑는 도중까지) 반복 재생하고,
  // 기계가 멈추는 순간(phase가 idle로 돌아가는 순간) 같이 멈춘다.
  useEffect(() => {
    if (phase !== 'mixing') return;
    const stop = playMusic(music, { loop: true });
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function mix() {
    if (!canMix || phase === 'mixing') return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setOrder(shuffle(pool));
    setDrawnCount(0);
    setPhase('mixing');
  }

  function drawOne() {
    if (phase !== 'mixing' || flying || !order || drawnCount >= order.length) return;
    const nextCount = drawnCount + 1;
    setFlying(true);
    setDrawnCount(nextCount);
    if (nextCount >= order.length) setPhase('idle');
    playMusic(resultSound);
    const timer = gameClock.setTimeout(() => setFlying(false), LOTTERY_FLY_MS);
    timersRef.current.push(timer);
  }

  if (!canMix) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🎱</div>
        <div className="font-body-md text-body-md">{t('gameOrder.needTwoParticipants')}</div>
      </div>
    );
  }

  const drawReady = phase === 'mixing' && remaining > 0;
  const buttonLabel = drawReady ? t('gameOrder.drawButton') : t('gameOrder.mixButton');

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <LotteryMachine pool={pool} drawnList={drawnList} active={phase === 'mixing'} />

      <button
        onClick={drawReady ? drawOne : mix}
        disabled={flying}
        className="mt-1 px-12 py-3.5 rounded-full bg-secondary hover:bg-on-secondary-container disabled:opacity-60 text-on-secondary font-title-md text-title-md shadow-sm transition-colors"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
