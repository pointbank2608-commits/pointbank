import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImageQuizItem } from '../lib/types';

interface Props {
  items: ImageQuizItem[];
  revealSeconds: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ImageQuiz({ items, revealSeconds }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<'revealing' | 'revealed'>('revealing');
  const [score, setScore] = useState(0);
  const [blurred, setBlurred] = useState(true);

  // 편집 중인 선생님 화면에서 사진을 추가/삭제하면 미리보기를 처음부터 다시 섞는다.
  // items 배열은 매 렌더마다 새 참조로 넘어오므로, 내용(아이디 목록)이 실제로 바뀔 때만 반응한다.
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
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🖼️</div>
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
        <div className="text-5xl mb-3">🏆</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameImageQuiz.finishedTitle')}</div>
        <div className="font-display-lg text-[40px] text-deep-navy mb-6 tabular-nums">
          {t('gameImageQuiz.scoreLabel', { score, total: order.length })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameImageQuiz.restartButton')}
        </button>
      </div>
    );
  }

  const current = items[order[pos]];

  function reveal() {
    setPhase('revealed');
    setBlurred(false);
  }

  function next(correct: boolean) {
    if (correct) setScore((s) => s + 1);
    setPos((p) => p + 1);
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="font-caption text-caption text-on-surface-variant mb-4 tabular-nums">
        {pos + 1} / {order.length}
      </div>

      <div
        data-skin-stage="frame"
        className="relative w-full max-w-[420px] aspect-[4/3] rounded-2xl overflow-hidden border-2 border-outline-variant/40 mb-5 bg-surface-container-low"
      >
        <img
          src={current.imageUrl}
          alt=""
          data-skin-object="photo"
          className="w-full h-full object-cover"
          style={{
            filter: phase === 'revealed' ? 'blur(0px)' : blurred ? 'blur(28px)' : 'blur(0px)',
            transition: phase === 'revealed' ? 'none' : `filter ${revealSeconds}s linear`,
          }}
        />
      </div>

      {phase === 'revealing' ? (
        <button
          onClick={reveal}
          className="px-8 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
        >
          {t('gameImageQuiz.revealButton')}
        </button>
      ) : (
        <div className="result-pop flex flex-col items-center gap-4">
          <div className="font-display-lg text-[28px] text-deep-navy text-center [word-break:keep-all]">{current.answer}</div>
          <div className="flex gap-3">
            <button
              onClick={() => next(true)}
              className="px-6 py-2.5 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-label-md text-label-md shadow-sm transition-colors"
            >
              {t('gameImageQuiz.correctButton')}
            </button>
            <button
              onClick={() => next(false)}
              className="px-6 py-2.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-label-md text-label-md transition-colors"
            >
              {t('gameImageQuiz.wrongButton')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
