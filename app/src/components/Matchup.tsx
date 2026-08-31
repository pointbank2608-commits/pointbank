import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatchPair } from '../lib/types';

interface Props {
  pairs: MatchPair[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Matchup({ pairs }: Props) {
  const { t } = useTranslation();
  const [leftOrder, setLeftOrder] = useState<MatchPair[]>(() => shuffle(pairs));
  const [rightOrder, setRightOrder] = useState<MatchPair[]>(() => shuffle(pairs));
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [locked, setLocked] = useState(false);

  if (pairs.length < 2) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🔗</div>
        <div className="font-body-md text-body-md">{t('gameMatchup.needPairs')}</div>
      </div>
    );
  }

  const finished = matchedIds.size === pairs.length;

  function restart() {
    setLeftOrder(shuffle(pairs));
    setRightOrder(shuffle(pairs));
    setMatchedIds(new Set());
    setSelectedLeft(null);
    setSelectedRight(null);
    setWrongPair(null);
    setWrongCount(0);
    setLocked(false);
  }

  function resolve(leftId: string, rightId: string) {
    if (leftId === rightId) {
      setMatchedIds((prev) => new Set(prev).add(leftId));
      setSelectedLeft(null);
      setSelectedRight(null);
      return;
    }
    setWrongCount((c) => c + 1);
    setWrongPair({ left: leftId, right: rightId });
    setLocked(true);
    setTimeout(() => {
      setWrongPair(null);
      setSelectedLeft(null);
      setSelectedRight(null);
      setLocked(false);
    }, 500);
  }

  function clickLeft(id: string) {
    if (locked || matchedIds.has(id)) return;
    if (selectedRight) {
      resolve(id, selectedRight);
      return;
    }
    setSelectedLeft((prev) => (prev === id ? null : id));
  }

  function clickRight(id: string) {
    if (locked || matchedIds.has(id)) return;
    if (selectedLeft) {
      resolve(selectedLeft, id);
      return;
    }
    setSelectedRight((prev) => (prev === id ? null : id));
  }

  function chipClass(id: string, side: 'left' | 'right') {
    if (matchedIds.has(id)) return 'bg-secondary-container/40 border-secondary text-on-surface cursor-default opacity-70';
    if (wrongPair && ((side === 'left' && wrongPair.left === id) || (side === 'right' && wrongPair.right === id))) {
      return 'bg-error-container border-error text-on-error-container';
    }
    const isSelected = side === 'left' ? selectedLeft === id : selectedRight === id;
    if (isSelected) return 'bg-primary-container border-primary text-on-primary-container';
    return 'bg-surface-container-lowest border-outline-variant/40 text-on-surface hover:bg-surface-container-low';
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🎉</div>
        <div className="font-title-md text-title-md text-on-surface mb-2">{t('gameMatchup.finishedTitle')}</div>
        <div className="font-display-lg text-[32px] text-deep-navy mb-6 tabular-nums">
          {t('gameMatchup.wrongCountLabel', { count: wrongCount })}
        </div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameMatchup.restartButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="font-caption text-caption text-on-surface-variant mb-4 tabular-nums">
        {t('gameMatchup.wrongCountLabel', { count: wrongCount })}
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-[560px]">
        <div className="flex flex-col gap-2">
          {leftOrder.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={matchedIds.has(p.id)}
              onClick={() => clickLeft(p.id)}
              className={`px-4 py-3 rounded-xl font-label-md text-label-md text-left transition-all border-2 ${chipClass(p.id, 'left')}`}
            >
              {p.left}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {rightOrder.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={matchedIds.has(p.id)}
              onClick={() => clickRight(p.id)}
              className={`px-4 py-3 rounded-xl font-label-md text-label-md text-left transition-all border-2 ${chipClass(p.id, 'right')}`}
            >
              {p.right}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
