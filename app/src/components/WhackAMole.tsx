import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatchPair } from '../lib/types';

export type WhackMode = 'wordToMeaning' | 'meaningToWord';

interface Props {
  pairs: MatchPair[];
  mode?: WhackMode;
}

const HOLE_COUNT = 9;
const CHOICE_CAP = 4;
const HIT_MS = 620;
const ANIMALS = ['mole', 'rabbit', 'frog'] as const;
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

export default function WhackAMole({ pairs, mode = 'wordToMeaning' }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<MatchPair[]>(() => shuffle(pairs));
  const [pos, setPos] = useState(0);
  const [holes, setHoles] = useState<(MatchPair | null)[]>(() =>
    pairs[0] ? dealHoles(pairs[0], pairs) : Array(HOLE_COUNT).fill(null),
  );
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [locked, setLocked] = useState(false);
  const [hitHole, setHitHole] = useState<number | null>(null);
  const [hitKind, setHitKind] = useState<'ok' | 'no' | null>(null);
  const pairKey = `${mode}|${pairs.map((p) => p.id).join(',')}`;
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    const next = shuffle(pairs);
    setOrder(next);
    setPos(0);
    setHits(0);
    setMisses(0);
    setLocked(false);
    setHitHole(null);
    setHitKind(null);
    setHoles(next[0] ? dealHoles(next[0], pairs) : Array(HOLE_COUNT).fill(null));
  }, [pairKey]);

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    };
  }, []);

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

  const finished = pos >= order.length;
  const target = !finished ? order[pos] : null;
  const prompt = target ? (mode === 'wordToMeaning' ? target.left : target.right) : '';

  function choiceLabel(p: MatchPair) {
    return mode === 'wordToMeaning' ? p.right : p.left;
  }

  function restart() {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    const next = shuffle(pairs);
    setOrder(next);
    setPos(0);
    setHits(0);
    setMisses(0);
    setLocked(false);
    setHitHole(null);
    setHitKind(null);
    setHoles(next[0] ? dealHoles(next[0], pairs) : Array(HOLE_COUNT).fill(null));
  }

  function goNext() {
    setHitHole(null);
    setHitKind(null);
    setLocked(false);
    const nextPos = pos + 1;
    const nextTarget = order[nextPos];
    setHoles(nextTarget ? dealHoles(nextTarget, pairs) : Array(HOLE_COUNT).fill(null));
    setPos(nextPos);
  }

  function whack(hole: number) {
    const choice = holes[hole];
    if (!choice || locked || !target) return;
    const ok = choice.id === target.id;
    if (ok) setHits((h) => h + 1);
    else setMisses((m) => m + 1);
    setHitHole(hole);
    setHitKind(ok ? 'ok' : 'no');
    setLocked(true);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameWhackamole.finishedTitle')}</div>
            <div className="font-display-lg text-[28px] tabular-nums text-deep-navy">
              {t('gameWhackamole.resultLabel', { hits, misses })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameWhackamole.restartButton')}
        </button>
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
      </div>

      <div className="wm-prompt mb-4 w-full max-w-[420px]">
        <div className="wm-prompt-inner">{prompt}</div>
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
}
