import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatchPair, UndoHandle } from '../lib/types';

export type MatchupStyle = 'trays' | 'tags';

interface Props {
  pairs: MatchPair[];
  boardStyle?: MatchupStyle;
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

const Matchup = forwardRef<UndoHandle, Props>(function Matchup({ pairs, boardStyle = 'trays' }, ref) {
  const hang = boardStyle === 'tags';
  const { t } = useTranslation();
  const [leftOrder, setLeftOrder] = useState<MatchPair[]>(() => shuffle(pairs));
  const [rightOrder, setRightOrder] = useState<MatchPair[]>(() => shuffle(pairs));
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [prevSnapshot, setPrevSnapshot] = useState<{ matchedIds: Set<string>; wrongCount: number } | null>(null);
  const pairKey = pairs.map((p) => p.id).join(',');
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    setLeftOrder(shuffle(pairs));
    setRightOrder(shuffle(pairs));
    setMatchedIds(new Set());
    setSelectedLeft(null);
    setSelectedRight(null);
    setWrongPair(null);
    setWrongCount(0);
    setLocked(false);
    setPrevSnapshot(null);
  }, [pairKey]);

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    undo() {
      if (!prevSnapshot) return;
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      setMatchedIds(prevSnapshot.matchedIds);
      setWrongCount(prevSnapshot.wrongCount);
      setSelectedLeft(null);
      setSelectedRight(null);
      setWrongPair(null);
      setLocked(false);
      setPrevSnapshot(null);
    },
  }));

  if (pairs.length < 2) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center gap-2">
          <span className="mu-tile mu-tile-0 pointer-events-none w-[72px] justify-center px-0">A</span>
          <span className="mu-tile mu-tile-2 pointer-events-none w-[72px] justify-center px-0">가</span>
        </div>
        <div className="font-body-md text-body-md">{t('gameMatchup.needPairs')}</div>
      </div>
    );
  }

  if (leftOrder.length === 0) {
    return null;
  }

  const finished = matchedIds.size === pairs.length;

  function restart() {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setLeftOrder(shuffle(pairs));
    setRightOrder(shuffle(pairs));
    setMatchedIds(new Set());
    setSelectedLeft(null);
    setSelectedRight(null);
    setWrongPair(null);
    setWrongCount(0);
    setLocked(false);
    setPrevSnapshot(null);
  }

  function resolve(leftId: string, rightId: string) {
    setPrevSnapshot({ matchedIds: new Set(matchedIds), wrongCount });
    if (leftId === rightId) {
      setMatchedIds((prev) => new Set(prev).add(leftId));
      setSelectedLeft(null);
      setSelectedRight(null);
      return;
    }
    setWrongCount((c) => c + 1);
    setWrongPair({ left: leftId, right: rightId });
    setLocked(true);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      setWrongPair(null);
      setSelectedLeft(null);
      setSelectedRight(null);
      setLocked(false);
      flashTimer.current = null;
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

  function tileState(id: string, side: 'left' | 'right') {
    if (matchedIds.has(id)) return 'is-ok';
    if (wrongPair && ((side === 'left' && wrongPair.left === id) || (side === 'right' && wrongPair.right === id))) {
      return 'is-no';
    }
    const isSelected = side === 'left' ? selectedLeft === id : selectedRight === id;
    if (isSelected) return 'is-sel';
    return '';
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameMatchup.finishedTitle')}</div>
            <div className="font-display-lg text-[32px] tabular-nums text-deep-navy">
              {t('gameMatchup.wrongCountLabel', { count: wrongCount })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameMatchup.restartButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {t('gameMatchup.wrongCountLabel', { count: wrongCount })}
      </div>

      <div data-skin-stage="board" className="grid w-full max-w-[580px] grid-cols-2 gap-3 sm:gap-5">
        {hang ? (
          <>
            <div className="mu-hang">
              <div className="mu-hang-bar" aria-hidden />
              <div className="mu-hang-list">
                {leftOrder.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={matchedIds.has(p.id)}
                    onClick={() => clickLeft(p.id)}
                    data-skin-object="chip"
                    className={`mu-tag ${tileState(p.id, 'left')}`}
                  >
                    {p.left}
                  </button>
                ))}
              </div>
            </div>
            <div className="mu-hang">
              <div className="mu-hang-bar" aria-hidden />
              <div className="mu-hang-list">
                {rightOrder.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={matchedIds.has(p.id)}
                    onClick={() => clickRight(p.id)}
                    data-skin-object="chip"
                    className={`mu-tag ${tileState(p.id, 'right')}`}
                  >
                    {p.right}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mu-tray">
              {leftOrder.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={matchedIds.has(p.id)}
                  onClick={() => clickLeft(p.id)}
                  data-skin-object="chip"
                  className={`mu-tile mu-tile-${i % 4} ${tileState(p.id, 'left')}`}
                >
                  {p.left}
                </button>
              ))}
            </div>
            <div className="mu-tray">
              {rightOrder.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={matchedIds.has(p.id)}
                  onClick={() => clickRight(p.id)}
                  data-skin-object="chip"
                  className={`mu-tile mu-tile-${(i + 2) % 4} ${tileState(p.id, 'right')}`}
                >
                  {p.right}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default Matchup;
