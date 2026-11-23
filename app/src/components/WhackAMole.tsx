import {useGameHistorySnapshot,useGameHistoryEffect,useGameHistoryClock,captureGameRef,restoreGameRef,useGameHistoryState,useGameHistoryRef} from '../context/GameHistoryContext';
import { usePictureWordDeck } from './PictureWordTurn';

import {useMemo, forwardRef, useImperativeHandle} from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import type { MatchPair, UndoHandle } from '../lib/types';
import { COMMON_SFX, GAME_SFX, playSfx, useGameSfx, useStepSounds } from '../lib/gameSfx';

export type WhackMode = 'wordToMeaning' | 'meaningToWord';

interface Props {
  pairs: MatchPair[];
  mode?: WhackMode;
  /** 시간 제한(초). 0·없음 = 제한 없이 문제를 한 바퀴 돌면 끝. 켜면 첫 두더지를 칠 때 시작하고, 문제를 다 풀어도
   * 시간이 남으면 다시 섞어 계속 나온다(2026-09-28). */
  timeLimit?: number;
  /** 개별수업: 한 바퀴(또는 시간)가 끝나면 맞힌 수·놓친 수와 함께 한 번 알린다(다시 하기 버튼은 숨긴다) */
  onComplete?: (hits: number, misses: number) => void;
}

const HOLE_COUNT = 9;
const CHOICE_CAP = 4;
const HIT_MS = 620;
const ANIMALS = ['mole', 'rabbit', 'frog'] as const;
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

function dealHoles(target: MatchPair, all: MatchPair[]): (MatchPair | null)[] {
  const pool = all.filter((p) => p.id !== target.id);
  const n = Math.min(CHOICE_CAP - 1, pool.length);
  const choices = shuffle([target, ...shuffle(pool).slice(0, n)]);
  const holes: (MatchPair | null)[] = Array(HOLE_COUNT).fill(null);
  const spots = shuffle(Array.from({ length: HOLE_COUNT }, (_, i) => i)).slice(0, choices.length);
  spots.forEach((h, i) => {
    holes[h] = choices[i];
  });
  return holes;
}

interface Snapshot {
  pos: number;
  hits: number;
  misses: number;
  holes: (MatchPair | null)[];
}

const WhackAMole = forwardRef<UndoHandle, Props>(function WhackAMole({ pairs: sourcePairs, mode = 'wordToMeaning', timeLimit = 0, onComplete }, ref) {
 /* game-history-adapter */
 const historyClock=useGameHistoryClock();
 useGameHistorySnapshot('src/components/WhackAMole.tsx:WhackAMole',()=>({state:{order,pos,holes,hits,misses,locked,hitHole,hitKind,prevSnapshot,timerOn,timeLeft,timeUp},refs:{flashTimer:captureGameRef(flashTimer.current),endAt:captureGameRef(endAt.current),doneRef:captureGameRef(doneRef.current)}}),(snapshot,elapsed)=>{setOrder(()=>snapshot.state.order);setPos(()=>snapshot.state.pos);setHoles(()=>snapshot.state.holes);setHits(()=>snapshot.state.hits);setMisses(()=>snapshot.state.misses);setLocked(()=>snapshot.state.locked);setHitHole(()=>snapshot.state.hitHole);setHitKind(()=>snapshot.state.hitKind);setPrevSnapshot(()=>snapshot.state.prevSnapshot);setTimerOn(()=>snapshot.state.timerOn);setTimeLeft(()=>snapshot.state.timeLeft);setTimeUp(()=>snapshot.state.timeUp);restoreGameRef(flashTimer,snapshot.refs.flashTimer,elapsed,false);restoreGameRef(endAt,snapshot.refs.endAt,elapsed,false);restoreGameRef(doneRef,snapshot.refs.doneRef,elapsed,false);});

  const { t } = useTranslation();
  const deck = usePictureWordDeck();
  const pairs = useMemo(() => deck.length ? deck.map(row => ({ id: row.id, left: row.choices[row.correctIndex], right: '' })) : sourcePairs, [deck, sourcePairs]);
  const pictureHoles = useMemo(() => new Map(deck.map(row => [row.id, row.choices.map((left, i) => ({ id: i === row.correctIndex ? row.id : row.id + ':' + i, left, right: '' }))])), [deck]);
  function makeHoles(target: MatchPair) { return dealHoles(target, pictureHoles.get(target.id) ?? pairs); }
  const [order, setOrder] = useGameHistoryState<MatchPair[]>("app/src/components/WhackAMole.tsx:WhackAMole:order",() => shuffle(pairs));
  const [pos, setPos] = useGameHistoryState("app/src/components/WhackAMole.tsx:WhackAMole:pos",0);
  const [holes, setHoles] = useGameHistoryState<(MatchPair | null)[]>("app/src/components/WhackAMole.tsx:WhackAMole:holes",() =>
    pairs[0] ? makeHoles(pairs[0]) : Array(HOLE_COUNT).fill(null),
  );
  const [hits, setHits] = useGameHistoryState("app/src/components/WhackAMole.tsx:WhackAMole:hits",0);
  const [misses, setMisses] = useGameHistoryState("app/src/components/WhackAMole.tsx:WhackAMole:misses",0);
  const [locked, setLocked] = useGameHistoryState("app/src/components/WhackAMole.tsx:WhackAMole:locked",false);
  const [hitHole, setHitHole] = useGameHistoryState<number | null>("app/src/components/WhackAMole.tsx:WhackAMole:hitHole",null);
  const [hitKind, setHitKind] = useGameHistoryState<'ok' | 'no' | null>("app/src/components/WhackAMole.tsx:WhackAMole:hitKind",null);
  const [prevSnapshot, setPrevSnapshot] = useGameHistoryState<Snapshot | null>("app/src/components/WhackAMole.tsx:WhackAMole:prevSnapshot",null);
  const pairKey = `${mode}|${timeLimit}|${pairs.map((p) => p.id).join(',')}`;
  const flashTimer = useGameHistoryRef<number | null>("app/src/components/WhackAMole.tsx:WhackAMole:flashTimer",null);
  const timed = timeLimit > 0;
  const [timerOn, setTimerOn] = useGameHistoryState("app/src/components/WhackAMole.tsx:WhackAMole:timerOn",false);
  const [timeLeft, setTimeLeft] = useGameHistoryState("app/src/components/WhackAMole.tsx:WhackAMole:timeLeft",timeLimit);
  const [timeUp, setTimeUp] = useGameHistoryState("app/src/components/WhackAMole.tsx:WhackAMole:timeUp",false);
  const endAt = useGameHistoryRef("app/src/components/WhackAMole.tsx:WhackAMole:endAt",0);

  function resetTimer() {
    setTimerOn(false);
    setTimeUp(false);
    setTimeLeft(timeLimit);
  }

  useGameHistoryEffect(() => {
    if (!timerOn || timeUp) return;
    const id = historyClock.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - historyClock.dateNow()) / 1000));
      setTimeLeft(left);
      if (left <= 0) {
        setTimeUp(true);
        if (flashTimer.current !== null) historyClock.clearTimeout(flashTimer.current);
      }
    }, 200);
    return () => historyClock.clearInterval(id);
  }, [timerOn, timeUp], false, "app/src/components/WhackAMole.tsx:effect1");

  // 시간 끝: "Time's up!" → 끝 멜로디 → "Great job!"
  useGameHistoryEffect(() => {
    if (!timeUp) return;
    playSfx(GAME_SFX.whackamole.timeUp);
    const a = historyClock.setTimeout(() => playSfx(GAME_SFX.whackamole.finish), 1000);
    const b = historyClock.setTimeout(() => playSfx(COMMON_SFX.praise), 2100);
    return () => {
      historyClock.clearTimeout(a);
      historyClock.clearTimeout(b);
    };
  }, [timeUp], false, "app/src/components/WhackAMole.tsx:effect2");

  useGameHistoryEffect(() => {
    if (flashTimer.current !== null) historyClock.clearTimeout(flashTimer.current);
    const next = shuffle(pairs);
    setOrder(next);
    setPos(0);
    setHits(0);
    setMisses(0);
    setLocked(false);
    setHitHole(null);
    setHitKind(null);
    setHoles(next[0] ? makeHoles(next[0]) : Array(HOLE_COUNT).fill(null));
    setPrevSnapshot(null);
    resetTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey], false, "app/src/components/WhackAMole.tsx:effect3");

  useGameHistoryEffect(() => {
    return () => {
      if (flashTimer.current !== null) historyClock.clearTimeout(flashTimer.current);
    };
  }, [], false, "app/src/components/WhackAMole.tsx:effect4");

  useImperativeHandle(ref, () => ({
    undo() {
      if (!prevSnapshot) return;
      if (flashTimer.current !== null) {
        historyClock.clearTimeout(flashTimer.current);
        flashTimer.current = null;
      }
      setPos(prevSnapshot.pos);
      setHits(prevSnapshot.hits);
      setMisses(prevSnapshot.misses);
      setHoles(prevSnapshot.holes);
      setHitHole(null);
      setHitKind(null);
      setLocked(false);
      setPrevSnapshot(null);
    },
  }));

  const sfx = useGameSfx('whackamole');
  // 새 두더지들이 튀어나올 때(문제마다) 뿅, 다 끝나면 결과 소리
  const roundDone = timed ? timeUp : order.length > 0 && pos >= order.length;
  useStepSounds(pos, pairs.length >= 2 && roundDone, sfx.popUp, timed ? undefined : sfx.finish);

  const doneRef = useGameHistoryRef("app/src/components/WhackAMole.tsx:WhackAMole:doneRef",false);
  useGameHistoryEffect(() => {
    if (!onComplete) return;
    if (roundDone) {
      if (!doneRef.current) {
        doneRef.current = true;
        onComplete(hits, misses);
      }
    } else {
      doneRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundDone], false, "app/src/components/WhackAMole.tsx:effect5");

  if (pairs.length < 2) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center">
          <span className="wm-well wm-well-2 pointer-events-none w-[88px]">
            <span className="wm-hole">
              <span className="wm-mole is-up">
                <span className="wm-sign">A</span>
                <img className="wm-critter" src="/skins/wm-mole.png" alt="" draggable={false} />
              </span>
            </span>
          </span>
        </div>
        <div className="font-body-md text-body-md">{t('gameWhackamole.needPairs')}</div>
      </div>
    );
  }

  if (order.length === 0) {
    return null;
  }

  const finished = timed ? timeUp : pos >= order.length;
  const target = !finished ? order[pos] : null;
  const prompt = target ? (mode === 'wordToMeaning' ? target.left : target.right) : '';

  function choiceLabel(p: MatchPair) {
    if (deck.length) return p.left;
    return mode === 'wordToMeaning' ? p.right : p.left;
  }

  function restart() {
    if (flashTimer.current !== null) historyClock.clearTimeout(flashTimer.current);
    const next = shuffle(pairs);
    setOrder(next);
    setPos(0);
    setHits(0);
    setMisses(0);
    setLocked(false);
    setHitHole(null);
    setHitKind(null);
    setHoles(next[0] ? makeHoles(next[0]) : Array(HOLE_COUNT).fill(null));
    setPrevSnapshot(null);
    resetTimer();
  }

  function goNext() {
    setHitHole(null);
    setHitKind(null);
    setLocked(false);
    let nextPos = pos + 1;
    let nextOrder = order;
    // 시간 제한이 있으면 한 바퀴 돈 뒤 다시 섞어서 계속
    if (timed && nextPos >= order.length) {
      nextOrder = shuffle(pairs);
      nextPos = 0;
      setOrder(nextOrder);
    }
    const nextTarget = nextOrder[nextPos];
    setHoles(nextTarget ? makeHoles(nextTarget) : Array(HOLE_COUNT).fill(null));
    setPos(nextPos);
  }

  function whack(hole: number) {
    const choice = holes[hole];
    if (!choice || locked || !target) return;
    if (timed && !timerOn) {
      endAt.current = historyClock.dateNow() + timeLimit * 1000;
      setTimeLeft(timeLimit);
      setTimerOn(true);
    }
    setPrevSnapshot({ pos, hits, misses, holes: [...holes] });
    const ok = choice.id === target.id;
    playSfx(ok ? sfx.hit : sfx.miss);
    if (ok) setHits((h) => h + 1);
    else setMisses((m) => m + 1);
    setHitHole(hole);
    setHitKind(ok ? 'ok' : 'no');
    setLocked(true);
    if (flashTimer.current !== null) historyClock.clearTimeout(flashTimer.current);
    flashTimer.current = historyClock.setTimeout(() => {
      flashTimer.current = null;
      goNext();
    }, HIT_MS);
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">
              {timed ? t('gameWhackamole.timeUpTitle') : t('gameWhackamole.finishedTitle')}
            </div>
            <div className="font-display-lg text-[28px] tabular-nums text-deep-navy">
              {t('gameWhackamole.resultLabel', { hits, misses })}
            </div>
          </div>
        </div>
        {!onComplete && (
          <button onClick={restart} className={pill}>
            {t('gameWhackamole.restartButton')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        <span className="rounded-full bg-secondary px-3 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
          {t('gameWhackamole.hitsLabel', { count: hits })}
        </span>
        <span className="rounded-full bg-[#f28b73] px-3 py-1 font-title-md text-[14px] font-bold tabular-nums text-white">
          {t('gameWhackamole.missesLabel', { count: misses })}
        </span>
        {timed && (
          <span
            className={`flex items-center gap-1 rounded-full px-3 py-1 font-title-md text-[14px] font-bold tabular-nums ${
              timerOn && timeLeft <= 10 ? 'animate-pulse bg-error text-on-error' : 'bg-deep-navy text-white'
            }`}
          >
            <span aria-hidden className="material-symbols-outlined text-[18px]">timer</span>
            {t('gameWhackamole.secondsLeft', { count: timeLeft })}
          </span>
        )}
      </div>
      {timed && !timerOn && (
        <div className="mb-3 font-caption text-caption text-on-surface-variant">{t('gameWhackamole.timerStartHint')}</div>
      )}

      <div className="wm-prompt mb-4 w-full max-w-[420px]">
        <div className="wm-prompt-inner">
          {target && deck.length ? <img data-picture-word src={deck.find(row => row.id === target.id)?.imageUrl} alt={t('gameWordHoops.askWord')} className="mx-auto h-16 max-w-full object-contain" /> : <GameFitText text={prompt} fit="block" />}
        </div>
      </div>

      <div data-skin-stage="board" className="wm-board w-full max-w-[420px]">
        {holes.map((choice, i) => {
          const liveIndex = holes.slice(0, i).filter(Boolean).length;
          const animal = ANIMALS[liveIndex % ANIMALS.length];
          const isHit = hitHole === i;
          return (
            <div key={i} className={`wm-well wm-well-${i % 4}`}>
              <button
                type="button"
                onClick={() => whack(i)}
                data-skin-object="hole"
                className={`wm-hole ${choice ? 'is-live' : ''} ${isHit && hitKind === 'ok' ? 'is-ok' : ''} ${isHit && hitKind === 'no' ? 'is-no' : ''}`}
              >
                {choice ? (
                  <span className={`wm-mole ${isHit ? 'is-hit' : 'is-up'}`}>
                    <span className="wm-sign">{choiceLabel(choice)}</span>
                    <img
                      className="wm-critter"
                      src={isHit ? `/skins/wm-${animal}-hurt.png` : `/skins/wm-${animal}.png`}
                      alt=""
                      draggable={false}
                    />
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default WhackAMole;
