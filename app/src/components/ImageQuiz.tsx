import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import type { ImageQuizItem } from '../lib/types';

export type ImageQuizStyle = 'wood' | 'clay';

interface Props {
  items: ImageQuizItem[];
  revealSeconds: number;
  boardStyle?: ImageQuizStyle;
}

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';
const pill =
  'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdsKey]);

  useEffect(() => {
    setPhase('revealing');
    setBlurred(true);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setBlurred(false));
    });
    return () => cancelAnimationFrame(raf);
  }, [pos]);

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
    setPos(0);
    setScore(0);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div
          className="mb-6 w-[min(360px,92%)] px-2 py-2 text-center"
          style={{
            borderRadius: 22,
            background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
            boxShadow: woodShadow,
          }}
        >
          <div
            className="px-4 py-5"
            style={{
              borderRadius: 16,
              background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
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
    setPos((p) => p + 1);
  }

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div className="mb-3 rounded-full bg-secondary px-3 py-1 font-title-md text-[13px] font-bold tabular-nums text-on-secondary">
        {pos + 1} / {order.length}
      </div>

      <div data-skin-stage="frame" className={`iq-frame mb-5 w-full max-w-[560px] ${clay ? 'iq-clay' : ''}`}>
        <div className="iq-photo">
          <img
            src={current.imageUrl}
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
