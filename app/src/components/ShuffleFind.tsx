import {useNativeGameTurn} from '../context/GameTurnContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClock } from '../lib/gameClock';
import { gameKeyboardAllowed } from '../lib/gameKeyboard';
import { GAME_SFX, playSfx } from '../lib/gameSfx';
import { useRemoteActions } from '../lib/remote';
import { speak } from '../lib/speech';
import {
  SHUFFLE_CUPS, SHUFFLE_SPEED, buildRound, cupWidth, drawLabels, parseShuffleLabel, rankTeams, scoreRound, shuffled, slotCenters, usableCups,
  type ShuffleRound, type ShuffleScore, type ShuffleSpeed,
} from '../lib/shuffleFind';
import type { GameItem } from '../lib/types';

/**
 * 컵 속 친구 찾기(2026-10-20) — PPT "Pokemon Shuffle" 방식만 참고(그림·소리는 우리 것).
 * 보여 주기 → 컵이 덮이고 → 섞이고 → 팀이 컵 아래(고정된) 글을 읽으며 컵을 고르고 → 열어서 확인.
 * 모든 시간은 gameClock(교사 일시정지가 멈춰 주는 시계)으로 잰다.
 */

interface Props {
  items: GameItem[];
  teams: number;
  cups: number;
  speed: ShuffleSpeed;
  rounds: number;
}

type Phase = 'ready' | 'show' | 'hide' | 'shuffle' | 'pick' | 'reveal' | 'done';

const IMG = '/skins/shuffle/';
const STYLE = `
@keyframes sf-hop { 0%,100%{transform:translate(-50%,0)} 40%{transform:translate(-50%,-2.2cqw)} }
@keyframes sf-pop { 0%{transform:scale(.3);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
@keyframes sf-shake { 0%,100%{margin-left:0} 20%{margin-left:-1cqw} 40%{margin-left:1cqw} 60%{margin-left:-.8cqw} 80%{margin-left:.8cqw} }
@keyframes sf-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(8,102,255,.45)} 50%{box-shadow:0 0 0 .8cqw rgba(8,102,255,0)} }
@media (prefers-reduced-motion: reduce) { .sf-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } .sf-move { transition-duration:.01s !important; } }
`;

const TEAM_COLORS = ['#ef5b5b', '#3b82f6', '#22a559', '#f59e0b'];

export default function ShuffleFind({ items, teams, cups: wantCups, speed, rounds }: Props) {
  const { t } = useTranslation();
  const cups = usableCups(items.length, wantCups);
  const itemKey = items.map((i) => i.id).join(',');
  const centers = useMemo(() => slotCenters(cups), [cups]);
  const cw = cupWidth(cups);
  const cupH = cw * 1.04;
  const ms = SHUFFLE_SPEED[speed].ms;

  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [rd, setRd] = useState<ShuffleRound | null>(null);
  const [cupAtSlot, setCupAtSlot] = useState<number[]>(() => Array.from({ length: cups }, (_, i) => i));
  const [lifted, setLifted] = useState<number[]>([]);
  const [dy, setDy] = useState<Record<number, number>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [found, setFound] = useState<boolean | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState<ShuffleScore>({ scores: Array(Math.max(1, teams)).fill(0), turn: 0 });
  const [turnPlayed, setTurnPlayed] = useState(0);
  const deck = useRef<number[]>([]);
  const prevAnimal = useRef<string | undefined>(undefined);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, wait: number) => {
    timers.current.push(gameClock.setTimeout(fn, wait));
  };
  const clearTimers = () => {
    timers.current.forEach((id) => gameClock.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  function resetAll() {
    clearTimers();
    deck.current = shuffled(items.map((_, i) => i));
    prevAnimal.current = undefined;
    setPhase('ready');
    setRound(0);
    setRd(null);
    setCupAtSlot(Array.from({ length: cups }, (_, i) => i));
    setLifted([]);
    setDy({});
    setPicked(null);
    setFound(null);
    setShowAnswer(false);
    setScore({ scores: Array(Math.max(1, teams)).fill(0), turn: 0 });
  }
  useEffect(() => {
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, cups, teams, rounds]);

  const slotOfCup = (cup: number) => cupAtSlot.indexOf(cup);

  function startRound() {
    if (items.length === 0 || (phase !== 'ready' && phase !== 'reveal')) return;
    if (phase === 'reveal' && round >= rounds) {
      setPhase('done');
      playSfx(GAME_SFX.shufflefind.finish);
      return;
    }
    clearTimers();
    const drawn = drawLabels(deck.current, items.length, cups);
    deck.current = drawn.deck;
    const next = buildRound(drawn.labels, speed, prevAnimal.current);
    prevAnimal.current = next.animal;
    const identity = Array.from({ length: cups }, (_, i) => i);
    setRd(next);
    setRound((r) => r + 1);
    setCupAtSlot(identity);
    setPicked(null);
    setFound(null);
    setShowAnswer(false);
    setDy({});
    // 1) 컵을 들어 올려 친구를 보여 준다
    setLifted(identity);
    setPhase('show');
    playSfx(GAME_SFX.shufflefind.show);
    const SHOW = 1600;
    const DROP = 800;
    // 2) 컵을 덮는다
    later(() => {
      setLifted([]);
      setPhase('hide');
    }, SHOW);
    // 3) 섞는다
    let cur = identity;
    const gap = Math.round(ms * 0.2);
    next.swaps.forEach(([a, b], k) => {
      later(() => {
        const arr = [...cur];
        const ca = arr[a];
        const cb = arr[b];
        [arr[a], arr[b]] = [arr[b], arr[a]];
        cur = arr;
        setPhase('shuffle');
        setCupAtSlot(arr);
        setDy({ [ca]: -3.2, [cb]: 3.2 });
        playSfx(GAME_SFX.shufflefind.swap, 0.5);
        later(() => setDy({}), Math.round(ms * 0.5));
      }, SHOW + DROP + k * (ms + gap));
    });
    // 4) 고르기
    later(() => {
      setDy({});
      setPhase('pick');
    }, SHOW + DROP + next.swaps.length * (ms + gap) + 150);
  }

  function pick(slot: number) {
    if (phase !== 'pick' || !rd) return;
    const hit = slot === rd.answerSlot;
    setPicked(slot);
    setFound(hit);
    setLifted([cupAtSlot[slot]]);
    setPhase('reveal');
    setScore((s) => scoreRound(s, hit));
    setTurnPlayed(score.turn);
    playSfx(hit ? GAME_SFX.shufflefind.hit : GAME_SFX.shufflefind.miss);
    if (!hit) {
      later(() => {
        setShowAnswer(true);
        setLifted((l) => [...l, cupAtSlot[rd.answerSlot]]);
      }, 1100);
    }
  }

  const advance = () => {
    if (phase === 'ready') startRound();
    else if (phase === 'reveal') startRound();
  };

  // 스페이스·엔터: 시작 / 다음 판, 숫자 키: 컵 고르기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!gameKeyboardAllowed(e)) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (phase === 'ready' || phase === 'reveal') {
          e.preventDefault();
          advance();
        }
        return;
      }
      if (phase === 'pick' && /^[1-5]$/.test(e.key) && Number(e.key) <= cups) {
        e.preventDefault();
        pick(Number(e.key) - 1);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  useRemoteActions(
    phase === 'ready'
      ? [{ id: 'start', label: t('gameShuffle.start'), tone: 'primary', run: startRound }]
      : phase === 'pick'
        ? Array.from({ length: cups }, (_, i) => ({ id: `cup${i}`, label: t('gameShuffle.cupN', { n: i + 1 }), tone: 'neutral' as const, run: () => pick(i) }))
        : phase === 'reveal'
          ? [{ id: 'next', label: round >= rounds ? t('gameShuffle.seeResult') : t('gameShuffle.nextRound'), tone: 'primary', run: advance }]
          : [],
  );

  useNativeGameTurn({current:t('gameShuffle.teamLabel',{n:score.turn+1}),next:t('gameShuffle.teamLabel',{n:(score.turn+1)%Math.max(1,teams)+1}),index:score.turn,total:Math.max(1,teams),enabled:items.length>0&&phase!=='done'});
  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        {t('gameShuffle.needItems')}
      </div>
    );
  }

  const btn = 'rounded-full px-6 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 focus-visible:outline-4 focus-visible:outline-primary';
  const canPick = phase === 'pick';
  const status =
    phase === 'ready'
      ? t('gameShuffle.readyTitle')
      : phase === 'show'
        ? t('gameShuffle.watch')
        : phase === 'hide'
          ? t('gameShuffle.hiding')
          : phase === 'shuffle'
            ? t('gameShuffle.shuffling')
            : phase === 'pick'
              ? t('gameShuffle.pickPrompt')
              : phase === 'reveal'
                ? found
                  ? t('gameShuffle.found')
                  : t('gameShuffle.missed')
                : '';
  const ranking = rankTeams(score.scores);
  const solo = score.scores.length === 1;
  const hitCount = score.scores[0] ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1100px] select-none" data-testid="shuffle-find">
      <style>{STYLE}</style>

      {/* 팀 점수 */}
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2" aria-label={t('gameShuffle.scoreboard')}>
        {solo ? (
          <div className="rounded-full bg-white px-4 py-1.5 font-bold text-deep-navy shadow">{t('gameShuffle.soloScore', { n: hitCount, total: Math.max(round - (phase === 'reveal' || phase === 'done' ? 0 : 1), 0) })}</div>
        ) : (
          score.scores.map((s, i) => {
            const active = phase === 'reveal' ? i === turnPlayed : i === score.turn;
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 font-bold shadow ${active ? 'bg-white text-deep-navy' : 'bg-white/70 text-on-surface-variant'}`}
                style={{ borderColor: active ? TEAM_COLORS[i] : 'transparent' }}
              >
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: TEAM_COLORS[i] }} aria-hidden />
                <span>{t('gameShuffle.teamLabel', { n: i + 1 })}</span>
                <span className="tabular-nums">{t('gameShuffle.points', { n: s })}</span>
                {active && phase !== 'reveal' && phase !== 'ready' && <span className="text-xs text-primary">{t('gameShuffle.turnMark')}</span>}
              </div>
            );
          })
        )}
        <div className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-on-surface-variant shadow">{t('gameShuffle.roundOf', { n: Math.max(round, 1), total: rounds })}</div>
      </div>

      {/* 무대 */}
      <div
        className="relative w-full overflow-hidden rounded-[2.4cqw] bg-cover bg-center shadow-xl"
        style={{ containerType: 'inline-size', aspectRatio: '16 / 9', backgroundImage: `url(${IMG}scene.webp)` }}
      >
        {/* 숨은 친구 — 컵 아래(컵보다 뒤)에서 컵과 같이 움직인다 */}
        {rd && (
          <img
            src={`${IMG}a-${rd.animal}.webp`}
            alt=""
            draggable={false}
            className={`sf-move absolute z-[2] ${found && showAnswer === false && phase === 'reveal' ? 'sf-anim' : ''}`}
            style={{
              left: `${centers[slotOfCup(rd.hideCup)]}%`,
              // 컵(종 모양)보다 작게 — 컵 안에 완전히 가려지고, 들어 올리면 또렷이 보이는 크기
              top: `${49.5 - cupH * 0.66 - 1.6}cqw`,
              height: `${cupH * 0.66}cqw`,
              width: `${cw * 0.6}cqw`,
              objectFit: 'contain',
              objectPosition: 'center bottom',
              transform: `translateX(-50%) translateY(${(dy[rd.hideCup] ?? 0)}cqw)`,
              transition: `left ${ms}ms ease-in-out, transform ${Math.round(ms * 0.5)}ms ease-in-out`,
              animation: found && phase === 'reveal' ? 'sf-hop 0.7s ease-in-out 3' : undefined,
              filter: 'drop-shadow(0 .5cqw .4cqw rgba(0,0,0,.25))',
            }}
          />
        )}

        {/* 컵 */}
        {Array.from({ length: cups }, (_, cup) => {
          const slot = slotOfCup(cup);
          const up = lifted.includes(cup);
          const isPickedCup = picked !== null && cupAtSlot[picked] === cup;
          return (
            <button
              key={cup}
              type="button"
              disabled={!canPick}
              aria-label={t('gameShuffle.cupN', { n: slot + 1 })}
              onClick={() => pick(slot)}
              className={`sf-move absolute z-[3] border-0 bg-transparent p-0 ${canPick ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
              style={{
                left: `${centers[slot]}%`,
                top: `${49.5 - cupH}cqw`,
                width: `${cw}cqw`,
                transform: `translateX(-50%) translateY(${(up ? -cupH * 0.82 : 0) + (dy[cup] ?? 0)}cqw) rotate(${up ? (isPickedCup ? -10 : -6) : 0}deg)`,
                transition: `left ${ms}ms ease-in-out, transform ${up ? 600 : Math.round(ms * 0.5)}ms ease-in-out`,
                animation: isPickedCup && phase === 'reveal' && found === false && !showAnswer ? 'sf-shake .5s ease-in-out' : undefined,
                filter: 'drop-shadow(0 .6cqw .5cqw rgba(0,0,0,.28))',
              }}
            >
              <img src={`${IMG}cup-${SHUFFLE_CUPS[cup % SHUFFLE_CUPS.length]}.webp`} alt="" draggable={false} className="block h-auto w-full" />
            </button>
          );
        })}

        {/* 맞혔을 때 반짝이 */}
        {phase === 'reveal' && found && picked !== null && (
          <img
            src={`${IMG}spark.webp`}
            alt=""
            className="sf-anim pointer-events-none absolute z-[4]"
            style={{ left: `${centers[picked]}%`, top: `${49.5 - cupH * 1.6}cqw`, width: `${cw * 0.9}cqw`, transform: 'translateX(-50%)', animation: 'sf-pop .5s ease-out both' }}
          />
        )}

        {/* 상태 말풍선 */}
        <div className="pointer-events-none absolute left-1/2 top-[3cqw] z-[5] -translate-x-1/2 rounded-full bg-white/92 px-[2.4cqw] py-[0.9cqw] text-center font-extrabold text-deep-navy shadow-lg" style={{ fontSize: 'clamp(13px, 2.1cqw, 28px)', maxWidth: '92%' }} role="status">
          {status}
        </div>

        {phase === 'done' && (
          <div className="absolute inset-0 z-[6] flex flex-col items-center justify-center gap-[1.4cqw] bg-white/90 p-[3cqw] text-center">
            <img src="/skins/lightning/trophy.webp" alt="" className="h-[14cqw] w-auto" />
            <div className="font-extrabold text-deep-navy" style={{ fontSize: 'clamp(20px, 4cqw, 52px)' }}>{t('gameShuffle.resultTitle')}</div>
            {solo ? (
              <div className="font-bold text-on-surface" style={{ fontSize: 'clamp(16px, 2.8cqw, 36px)' }}>{t('gameShuffle.soloResult', { n: hitCount, total: rounds })}</div>
            ) : (
              <ol className="space-y-1">
                {ranking.map((r) => (
                  <li key={r.team} className="flex items-center justify-center gap-2 font-bold text-deep-navy" style={{ fontSize: 'clamp(15px, 2.6cqw, 34px)' }}>
                    <span className="w-8 text-center">{r.rank}</span>
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: TEAM_COLORS[r.team] }} aria-hidden />
                    <span>{t('gameShuffle.teamLabel', { n: r.team + 1 })}</span>
                    <span className="tabular-nums">{t('gameShuffle.points', { n: r.score })}</span>
                    {r.rank === 1 && <span aria-hidden>🏆</span>}
                  </li>
                ))}
              </ol>
            )}
            <button type="button" onClick={resetAll} className={`${btn} bg-primary`}>{t('gameShuffle.playAgain')}</button>
          </div>
        )}
      </div>

      {/* 컵 아래 낱말·문장 — 컵이 섞여도 이 자리는 그대로다. 읽은 칸을 누르면 그 자리의 컵을 연다 */}
      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${cups}, minmax(0, 1fr))` }}>
        {Array.from({ length: cups }, (_, slot) => {
          const idx = rd?.labels[slot];
          const label = idx !== undefined ? parseShuffleLabel(items[idx]?.label ?? '') : null;
          const isPicked = picked === slot;
          const isAnswer = phase === 'reveal' && rd?.answerSlot === slot && (found || showAnswer);
          return (
            <div
              key={slot}
              className={`relative flex min-h-[5.5rem] flex-col items-center justify-center rounded-2xl border-[3px] bg-[#fffbe8] px-3 pb-2 pt-7 text-center shadow-md ${
                isPicked ? (found ? 'border-green-500' : 'border-red-400') : isAnswer ? 'border-amber-400' : canPick ? 'sf-anim border-primary' : 'border-amber-200'
              }`}
              style={canPick ? { animation: 'sf-pulse 1.4s ease-in-out infinite' } : undefined}
            >
              <button
                type="button"
                disabled={!canPick || !label}
                onClick={() => pick(slot)}
                className="w-full disabled:cursor-default"
                aria-label={label ? t('gameShuffle.pickLabel', { n: slot + 1, text: label.text }) : t('gameShuffle.slotN', { n: slot + 1 })}
              >
                <span className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-deep-navy text-xs font-extrabold text-white" aria-hidden>{slot + 1}</span>
                <span className="font-extrabold text-deep-navy" style={{ fontSize: label && label.text.length > 24 ? 'clamp(14px, 1.9vw, 22px)' : 'clamp(18px, 2.8vw, 36px)' }}>
                  {label ? label.text : '?'}
                </span>
                {label?.ko && <span className="mt-0.5 block text-sm text-on-surface-variant">{label.ko}</span>}
              </button>
              {label && (
                <button
                  type="button"
                  onClick={() => speak(label.text)}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm shadow hover:bg-white"
                  aria-label={t('gameShuffle.speak')}
                  title={t('gameShuffle.speak')}
                >
                  🔊
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 진행 버튼 */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {phase === 'ready' && (
          <button type="button" data-initial-game-start onClick={startRound} className={`${btn} bg-primary`}>{t('gameShuffle.start')}</button>
        )}
        {phase === 'reveal' && (
          <button type="button" onClick={advance} className={`${btn} bg-primary`}>{round >= rounds ? t('gameShuffle.seeResult') : t('gameShuffle.nextRound')}</button>
        )}
        {(phase === 'ready' || phase === 'pick') && <span className="text-sm text-on-surface-variant">{t('gameShuffle.rule')}</span>}
      </div>
    </div>
  );
}
