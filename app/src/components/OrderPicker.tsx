import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LotteryMachine, { LOTTERY_FLY_MS } from './LotteryMachine';
import { playMusic } from '../lib/gameMusic';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  pool: GameItem[];
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
  onAdd?: (label: string) => void;
}

type Phase = 'idle' | 'mixing' | 'ready';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MIX_MS = 1100;

/**
 * 로또 기계처럼: "섞기"를 누르면 공이 잠깐 마구 섞이고, 그 자리 버튼이 "뽑기"로 바뀐다.
 * "뽑기"를 누를 때마다 공이 하나씩 나와 등록해둔 단어·숫자를 보여주고, 뽑힌 것들은
 * 아래에 당첨 번호처럼 계속 쌓인다. 다 뽑으면 버튼이 다시 "섞기"로 바뀌어 새 라운드를
 * 시작할 수 있다. 몇 개만 뽑고 멈춰도 되므로 로또 놀이·빙고 숫자 부르기·상품 추첨 등
 * 어디에든 쓸 수 있다.
 */
export default function OrderPicker({ pool, music, resultSound, onAdd }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [order, setOrder] = useState<GameItem[] | null>(null);
  const [drawnCount, setDrawnCount] = useState(0);
  const [flying, setFlying] = useState(false);
  const stopMusicRef = useRef<() => void>(() => {});
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const canMix = pool.length >= 2;
  const drawnList = order ? order.slice(0, drawnCount) : [];
  const remaining = order ? order.length - drawnCount : pool.length;

  function mix() {
    if (!canMix || phase === 'mixing' || flying) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    stopMusicRef.current();

    setOrder(null);
    setDrawnCount(0);
    setPhase('mixing');
    stopMusicRef.current = playMusic(music, { loop: true });

    const timer = setTimeout(() => {
      setOrder(shuffle(pool));
      setPhase('ready');
      stopMusicRef.current();
    }, MIX_MS);
    timersRef.current.push(timer);
  }

  function drawOne() {
    if (phase !== 'ready' || flying || !order || drawnCount >= order.length) return;
    setFlying(true);
    setDrawnCount((c) => c + 1);
    playMusic(resultSound);
    const timer = setTimeout(() => setFlying(false), LOTTERY_FLY_MS);
    timersRef.current.push(timer);
  }

  // 빠른 추가 입력란이 없는 경우(학생 화면 등)엔 항목이 부족하면 손쓸 방법이 없으니
  // 예전처럼 안내 문구만 보여준다. 입력란이 있으면(선생님 화면) 0~1개인 상태에서도
  // 기계와 입력란을 그대로 보여줘서 그 자리에서 채워 넣을 수 있게 한다.
  if (!canMix && !onAdd) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🎱</div>
        <div className="font-body-md text-body-md">{t('gameOrder.needTwoParticipants')}</div>
      </div>
    );
  }

  const drawReady = phase === 'ready' && remaining > 0;
  const buttonLabel = phase === 'mixing' ? t('gameOrder.mixing') : drawReady ? t('gameOrder.drawButton') : t('gameOrder.mixButton');

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <LotteryMachine pool={pool} drawnList={drawnList} active={phase === 'mixing'} onAdd={onAdd} />

      {canMix ? (
        <button
          onClick={drawReady ? drawOne : mix}
          disabled={phase === 'mixing' || flying}
          className="mt-1 px-12 py-3.5 rounded-full bg-secondary hover:bg-on-secondary-container disabled:opacity-60 text-on-secondary font-title-md text-title-md shadow-sm transition-colors"
        >
          {buttonLabel}
        </button>
      ) : (
        <div className="mt-3 font-caption text-caption text-on-surface-variant">{t('gameOrder.needTwoParticipants')}</div>
      )}
    </div>
  );
}
