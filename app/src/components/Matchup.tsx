import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './matchup-clay.css';
import type { MatchPair, UndoHandle } from '../lib/types';

export type MatchupStyle = 'trays' | 'tags';

interface Props {
  pairs: MatchPair[];
  boardStyle?: MatchupStyle;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Matchup = forwardRef<UndoHandle, Props>(function Matchup({ pairs, boardStyle = 'trays' }, ref) {
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
  const [round, setRound] = useState(0);
  const pairKey = JSON.stringify(pairs);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setRound(0);
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
    return <div className="matchup-clay matchup-clay__finish">
      <img src="/skins/matchup-clay-guide.png" alt="" width="240" height="165" />
      <p>{t('gameMatchup.needPairs')}</p>
    </div>;
  }

  if (leftOrder.length === 0) {
    return null;
  }

  const finished = matchedIds.size === pairs.length;
  const roundCount = Math.ceil(pairs.length / 6);
  const visibleLeft = leftOrder.slice(round * 6, (round + 1) * 6);
  const visibleIds = new Set(visibleLeft.map((pair) => pair.id));
  const visibleRight = rightOrder.filter((pair) => visibleIds.has(pair.id));
  const roundComplete = visibleLeft.length > 0 && visibleLeft.every((pair) => matchedIds.has(pair.id));

  function nextRound() {
    setRound((value) => value + 1);
    setSelectedLeft(null);
    setSelectedRight(null);
    setPrevSnapshot(null);
  }

  function restart() {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setRound(0);
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
    return <div className="matchup-clay matchup-clay__finish">
      <img src="/skins/matchup-clay-guide.png" alt="" width="240" height="165" />
      <h2>{t('gameMatchup.finishedTitle')}</h2>
      <p>{t('classroomUx.matchProgress', { matched: matchedIds.size, total: pairs.length })}</p>
      <p>{t('gameMatchup.wrongCountLabel', { count: wrongCount })}</p>
      <button type="button" onClick={restart} className="matchup-clay__action">{t('gameMatchup.restartButton')}</button>
    </div>;
  }

  function renderTile(pair: MatchPair, index: number, side: 'left' | 'right') {
    const state = tileState(pair.id, side);
    const selected = side === 'left' ? selectedLeft === pair.id : selectedRight === pair.id;
    const text = side === 'left' ? pair.left : pair.right;
    const color = (index + (side === 'right' ? 2 : 0)) % 4;
    return <button key={pair.id} type="button" disabled={matchedIds.has(pair.id)} aria-pressed={selected}
      aria-label={matchedIds.has(pair.id) ? t('classroomUx.matchedCard', { text }) : text}
      onClick={() => side === 'left' ? clickLeft(pair.id) : clickRight(pair.id)}
      className={`matchup-clay__tile matchup-clay__tile--${color} ${state}`} data-skin-object="chip">
      <span>{text}</span>
      <span className="matchup-clay__mark" aria-hidden>{state === 'is-ok' ? '✓' : state === 'is-no' ? '×' : selected ? '●' : ''}</span>
    </button>;
  }

  const feedback = wrongPair ? t('classroomUx.tryAnotherPair')
    : roundComplete ? t('classroomUx.roundComplete')
    : selectedLeft || selectedRight ? t('classroomUx.pickPartner') : t('classroomUx.matchHint');

  return (
    <div className={`matchup-clay ${boardStyle === 'tags' ? 'matchup-clay--tags' : ''}`}>
      <div className="matchup-clay__intro">
        <div>
          <h2>{t('classroomUx.matchTitle')}</h2>
          <p>{t('classroomUx.matchHint')}</p>
        </div>
        <img className="matchup-clay__mascot" src="/skins/matchup-clay-guide.png" alt="" width="126" height="92" />
      </div>
      <div className="matchup-clay__stats">
        <strong aria-live="polite">{t('classroomUx.matchProgress', { matched: matchedIds.size, total: pairs.length })}</strong>
        <span className="matchup-clay__round">{t('classroomUx.matchRound', { current: round + 1, total: roundCount })}</span>
        <span>{t('gameMatchup.wrongCountLabel', { count: wrongCount })}</span>
      </div>
      <progress className="matchup-clay__progress" value={matchedIds.size} max={pairs.length} aria-label={t('classroomUx.matchProgress', { matched: matchedIds.size, total: pairs.length })} />
      <div className="matchup-clay__board" data-skin-stage="board">
        <div className="matchup-clay__column">
          <h3 className="matchup-clay__column-title">{t('classroomUx.leftCards')}</h3>
          {visibleLeft.map((pair, index) => renderTile(pair, index, 'left'))}
        </div>
        <div className="matchup-clay__column">
          <h3 className="matchup-clay__column-title">{t('classroomUx.rightCards')}</h3>
          {visibleRight.map((pair, index) => renderTile(pair, index, 'right'))}
        </div>
      </div>
      <div className="matchup-clay__footer">
        <span role="status">{feedback}</span>
        {roundComplete && <button type="button" className="matchup-clay__action" onClick={nextRound}>
          {t('classroomUx.nextRound')} <span aria-hidden>→</span>
        </button>}
      </div>
    </div>
  );
});

export default Matchup;
