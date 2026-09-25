import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import type { ImageQuizItem } from '../lib/types';

export type ImageQuizStyle = 'wood' | 'clay';

interface Props {
  items: ImageQuizItem[];
  revealSeconds: number;
  boardStyle?: ImageQuizStyle;
}

const woodShadow = 'var(--game-wood-shadow, 0 4px 0 #c6a982)';
const pill =
  'game-clay-action px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ImageQuizEmptyMotif() {
  return (
    <div className="iq-frame pointer-events-none mx-auto w-[148px] p-2">
      <div className="iq-photo is-empty" />
    </div>
  );
}

export default function ImageQuiz({ items, revealSeconds, boardStyle = 'wood' }: Props) {
  const { t } = useTranslation();
  const clay = boardStyle === 'clay';
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<'revealing' | 'revealed'>('revealing');
  const [score, setScore] = useState(0);
  const [blurred, setBlurred] = useState(true);

  const itemIdsKey = items.map((it) => it.id).join('|');
  useEffect(() => {
    setOrder(shuffle(items.map((_, i) => i)));
    setPos(0);
    setScore(0);
    setPhase('revealing');
    setBlurred(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdsKey]);

  // 새 문제로 넘어갈 때 흐림을 "같은 렌더"에서 다시 켜야 한다 — 예전엔 useEffect 로 나중에 켜서, 이전
  // 문제의 선명한 <img>가 그대로 재사용된 채 0→28px로 흐려지다 곧바로 다시 선명해지는 전환이
  // 겹쳐, 두 번째 사진부터는 흐림이 거의 안 보였다(2026-09-25 사용자 제보). 이제 문제마다 <img>를
  // key 로 새로 만들고, 사진이 실제로 다 불러와진 뒤에 선명해지기 시작한다.
  function goToPos(nextPos: number) {
    setPhase('revealing');
    setBlurred(true);
    setPos(nextPos);
  }

  // 사진이 불러와진 시점엔 이미 blur(28px) 로 그려져 있으니, 잠깐 뒤 흐림을 풀면 거기서부터 서서히
  // 선명해진다. 그 사이 다음 문제로 넘어갔으면(늦게 도착한 타이머) 새 사진을 건드리지 않는다.
  const posRef = useRef(pos);
  posRef.current = pos;
  function startUnblur(forPos: number) {
    window.setTimeout(() => {
      if (posRef.current === forPos) setBlurred(false);
    }, 30);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mb-3">
          <ImageQuizEmptyMotif />
        </div>
        <div className="font-body-md text-body-md">{t('gameImageQuiz.needSetup')}</div>
      </div>
    );
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(items.map((_, i) => i)));
    setScore(0);
    goToPos(0);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div
          className="mb-6 w-[min(360px,92%)] px-2 py-2 text-center"
          style={{
            borderRadius: 22,
            background: 'var(--game-wood, linear-gradient(115deg, #f3e3c8, #e9d0ac))',
            boxShadow: woodShadow,
          }}
        >
          <div
            className="px-4 py-5"
            style={{
              borderRadius: 16,
              background: 'var(--game-paper, #fffdf6)',
              boxShadow: 'var(--game-paper-shadow, inset 0 1px 0 #fff)',
            }}
          >
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameImageQuiz.finishedTitle')}</div>
            <div className="font-title-md text-[22px] font-bold tabular-nums text-deep-navy">
              {t('gameImageQuiz.scoreLabel', { score, total: order.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameImageQuiz.restartButton')}
        </button>
      </div>
    );
  }

  const current = items[order[pos]];
  if (!current) return null;

  function reveal() {
    setPhase('revealed');
    setBlurred(false);
  }

  function next(correct: boolean) {
    if (correct) setScore((s) => s + 1);
    goToPos(pos + 1);
  }

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div className="mb-3 rounded-full bg-secondary px-3 py-1 font-title-md text-[13px] font-bold tabular-nums text-on-secondary">
        {pos + 1} / {order.length}
      </div>

      <div data-skin-stage="frame" className={`iq-frame mb-5 w-full max-w-[560px] ${clay ? 'iq-clay' : ''}`}>
        <div className="iq-photo">
          <img
            key={`${pos}:${current.id}`}
            src={current.imageUrl}
            onLoad={() => startUnblur(pos)}
            alt=""
            data-skin-object="photo"
            className="h-full w-full object-cover"
            style={{
              filter: phase === 'revealed' ? 'blur(0px)' : blurred ? 'blur(28px)' : 'blur(0px)',
              transition: phase === 'revealed' ? 'none' : `filter ${revealSeconds}s linear`,
            }}
          />
        </div>
      </div>

      {phase === 'revealing' ? (
        <button type="button" onClick={reveal} className="iq-btn iq-reveal">
          {t('gameImageQuiz.revealButton')}
        </button>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className={`iq-answer ${clay ? 'iq-clay' : ''}`}>
            <GameFitText text={current.answer} fit="block" />
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => next(true)} className="iq-btn iq-yes">
              {t('gameImageQuiz.correctButton')}
            </button>
            <button type="button" onClick={() => next(false)} className="iq-btn iq-no">
              {t('gameImageQuiz.wrongButton')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
