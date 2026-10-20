import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClock } from '../lib/gameClock';
import { gameKeyboardAllowed } from '../lib/gameKeyboard';
import { GAME_SFX, playSfx } from '../lib/gameSfx';
import { useRemoteActions } from '../lib/remote';
import { speak } from '../lib/speech';
import { shuffled } from '../lib/shuffleFind';
import { addRoundScores, buildTelepathyRound, parseTelepathyLabel, rankTeams, usableChoices, type TelepathyRound } from '../lib/telepathy';
import type { GameItem } from '../lib/types';

/**
 * 텔레파시 게임(2026-10-20) — PPT "Pokemon Telepathy Game" 방식만 참고(그림·소리는 우리 것).
 * 후보 보여 주기 → 팀마다 종이에 "나올 친구"를 적기(제한 시간) → 알이 흔들리고 열리며 하나가 나온다 → 맞힌 팀에 점수.
 * 시간은 gameClock(교사 일시정지가 멈춰 주는 시계)으로 잰다. 나오는 친구는 매번 무작위다.
 */

interface Props {
  items: GameItem[];
  teams: number;
  choices: number;
  rounds: number;
  seconds: number;
}

type Phase = 'ready' | 'predict' | 'shake' | 'open' | 'reveal' | 'done';

const IMG = '/skins/telepathy/';
const ANIMAL = '/skins/shuffle/';
const TEAM_COLORS = ['#ef5b5b', '#3b82f6', '#22a559', '#f59e0b', '#8b5cf6', '#0ea5a4'];
const STYLE = `
@keyframes tp-wobble { 0%,100%{transform:translateX(-50%) rotate(0)} 15%{transform:translateX(-50%) rotate(-9deg)} 35%{transform:translateX(-50%) rotate(8deg)} 55%{transform:translateX(-50%) rotate(-7deg)} 75%{transform:translateX(-50%) rotate(6deg)} }
@keyframes tp-lift { 0%{transform:translateX(-50%) translateY(0) rotate(0);opacity:1} 100%{transform:translateX(-50%) translateY(-9cqw) rotate(-24deg);opacity:0} }
@keyframes tp-pop { 0%{transform:translateX(-50%) scale(.2);opacity:0} 55%{transform:translateX(-50%) scale(1.18);opacity:1} 100%{transform:translateX(-50%) scale(1);opacity:1} }
@keyframes tp-hop { 0%,100%{transform:translateX(-50%) translateY(0)} 40%{transform:translateX(-50%) translateY(-2.4cqw)} }
@keyframes tp-flash { 0%{opacity:0;transform:translateX(-50%) scale(.3)} 40%{opacity:.95} 100%{opacity:0;transform:translateX(-50%) scale(1.6)} }
@keyframes tp-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(8,102,255,.5)} 50%{box-shadow:0 0 0 .9cqw rgba(8,102,255,0)} }
@media (prefers-reduced-motion: reduce) { .tp-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

export default function Telepathy({ items, teams, choices: wantChoices, rounds, seconds }: Props) {
  const { t } = useTranslation();
  const choices = usableChoices(items.length, wantChoices);
  const itemKey = items.map((i) => i.id).join(',');
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [rd, setRd] = useState<TelepathyRound | null>(null);
  const [scores, setScores] = useState<number[]>(() => Array(teams).fill(0));
  const [won, setWon] = useState<boolean[]>(() => Array(teams).fill(false));
  const [left, setLeft] = useState(seconds);
  const deck = useRef<number[]>([]);
  const timers = useRef<number[]>([]);
  const ticker = useRef<number | null>(null);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(gameClock.setTimeout(fn, ms));
  };
  const stopTicker = () => {
    if (ticker.current !== null) gameClock.clearInterval(ticker.current);
    ticker.current = null;
  };
  const clearTimers = () => {
    timers.current.forEach((id) => gameClock.clearTimeout(id));
    timers.current = [];
    stopTicker();
  };
  useEffect(() => clearTimers, []);

  function resetAll() {
    clearTimers();
    deck.current = shuffled(items.map((_, i) => i));
    setPhase('ready');
    setRound(0);
    setRd(null);
    setScores(Array(teams).fill(0));
    setWon(Array(teams).fill(false));
    setLeft(seconds);
  }
  useEffect(() => {
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, choices, teams, rounds, seconds]);

  function startRound() {
    if (items.length === 0) return;
    if (phase === 'reveal') {
      const next = addRoundScores(scores, won);
      setScores(next);
      if (round >= rounds) {
        setPhase('done');
        playSfx(GAME_SFX.telepathy.finish);
        return;
      }
    } else if (phase !== 'ready') return;
    clearTimers();
    const built = buildTelepathyRound(deck.current, items.length, choices);
    deck.current = built.deck;
    setRd(built.round);
    setRound((r) => r + 1);
    setWon(Array(teams).fill(false));
    setPhase('predict');
    setLeft(seconds);
    playSfx(GAME_SFX.telepathy.show);
    if (seconds > 0) {
      const t0 = gameClock.now();
      ticker.current = gameClock.setInterval(() => {
        const remain = Math.max(0, seconds - (gameClock.now() - t0) / 1000);
        setLeft(Math.ceil(remain));
        if (remain <= 0) {
          stopTicker();
          playSfx(GAME_SFX.telepathy.timeUp);
        }
      }, 200);
    }
  }

  function reveal() {
    if (phase !== 'predict' || !rd) return;
    stopTicker();
    setPhase('shake');
    playSfx(GAME_SFX.telepathy.shake);
    later(() => {
      setPhase('open');
      playSfx(GAME_SFX.telepathy.pop);
    }, 1700);
    later(() => setPhase('reveal'), 2500);
  }

  function toggleWon(i: number) {
    if (phase !== 'reveal') return;
    setWon((w) => w.map((v, k) => (k === i ? !v : v)));
  }

  const advance = () => {
    if (phase === 'ready' || phase === 'reveal') startRound();
    else if (phase === 'predict') reveal();
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!gameKeyboardAllowed(e)) return;
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (phase === 'ready' || phase === 'predict' || phase === 'reveal') {
        e.preventDefault();
        advance();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  useRemoteActions(
    phase === 'ready'
      ? [{ id: 'start', label: t('gameTelepathy.start'), tone: 'primary', run: startRound }]
      : phase === 'predict'
        ? [{ id: 'reveal', label: t('gameTelepathy.reveal'), tone: 'primary', run: reveal }]
        : phase === 'reveal'
          ? [
              ...Array.from({ length: teams }, (_, i) => ({ id: `team${i}`, label: t('gameTelepathy.teamRight', { n: i + 1 }), tone: 'neutral' as const, run: () => toggleWon(i) })),
              { id: 'next', label: round >= rounds ? t('gameTelepathy.seeResult') : t('gameTelepathy.nextRound'), tone: 'primary' as const, run: advance },
            ]
          : [],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        {t('gameTelepathy.needItems')}
      </div>
    );
  }

  const btn = 'rounded-full px-6 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 focus-visible:outline-4 focus-visible:outline-primary';
  const status =
    phase === 'ready'
      ? t('gameTelepathy.readyTitle')
      : phase === 'predict'
        ? left === 0 && seconds > 0
          ? t('gameTelepathy.timeUp')
          : t('gameTelepathy.predict')
        : phase === 'shake'
          ? t('gameTelepathy.shaking')
          : phase === 'open'
            ? t('gameTelepathy.opening')
            : phase === 'reveal'
              ? t('gameTelepathy.revealed')
              : '';
  const ranking = rankTeams(scores);
  const eggUp = phase === 'open' || phase === 'reveal';
  const answerAnimal = rd ? rd.animals[rd.answer] : null;

  return (
    <div className="mx-auto w-full max-w-[1100px] select-none" data-testid="telepathy">
      <style>{STYLE}</style>

      {/* 팀 점수 */}
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2" aria-label={t('gameTelepathy.scoreboard')}>
        {scores.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 rounded-full border-2 bg-white px-3 py-1 font-bold text-deep-navy shadow" style={{ borderColor: phase === 'reveal' && won[i] ? TEAM_COLORS[i] : 'transparent' }}>
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: TEAM_COLORS[i] }} aria-hidden />
            <span>{t('gameTelepathy.teamLabel', { n: i + 1 })}</span>
            <span className="tabular-nums">{t('gameTelepathy.points', { n: s + (phase === 'reveal' && won[i] ? 1 : 0) })}</span>
          </div>
        ))}
        <div className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-on-surface-variant shadow">{t('gameTelepathy.roundOf', { n: Math.max(round, 1), total: rounds })}</div>
      </div>

      {/* 무대 */}
      <div className="relative w-full overflow-hidden rounded-[2.4cqw] bg-cover bg-center shadow-xl" style={{ containerType: 'inline-size', aspectRatio: '16 / 9', backgroundImage: 'url(/skins/shuffle/scene.webp)' }}>
        {/* 알 */}
        {phase !== 'done' && (
          <>
            {!eggUp && (
              <img
                src={`${IMG}egg.webp`}
                alt=""
                draggable={false}
                className={`absolute z-[3] ${phase === 'shake' ? 'tp-anim' : ''}`}
                style={{ left: '50%', top: '27cqw', width: '19cqw', transform: 'translateX(-50%)', transformOrigin: '50% 90%', animation: phase === 'shake' ? 'tp-wobble 0.55s ease-in-out 3' : undefined, filter: 'drop-shadow(0 .6cqw .5cqw rgba(0,0,0,.28))' }}
              />
            )}
            {eggUp && (
              <>
                <img src={`${IMG}egg-bottom.webp`} alt="" draggable={false} className="absolute z-[3]" style={{ left: '50%', top: '37cqw', width: '19cqw', transform: 'translateX(-50%)', filter: 'drop-shadow(0 .6cqw .5cqw rgba(0,0,0,.28))' }} />
                <img src={`${IMG}egg-top.webp`} alt="" draggable={false} className="tp-anim absolute z-[5]" style={{ left: '50%', top: '27cqw', width: '19cqw', animation: 'tp-lift .7s ease-out both' }} />
                {rd && answerAnimal && (
                  <img
                    src={`${ANIMAL}a-${answerAnimal}.webp`}
                    alt=""
                    draggable={false}
                    className="tp-anim absolute z-[4]"
                    style={{ left: '50%', top: '17cqw', height: '22cqw', width: 'auto', animation: phase === 'open' ? 'tp-pop .7s ease-out both' : 'tp-hop .8s ease-in-out 3', filter: 'drop-shadow(0 .6cqw .5cqw rgba(0,0,0,.28))' }}
                  />
                )}
                {phase === 'open' && <img src={`${ANIMAL}spark.webp`} alt="" className="tp-anim pointer-events-none absolute z-[6]" style={{ left: '50%', top: '18cqw', width: '16cqw', animation: 'tp-flash .9s ease-out both' }} />}
              </>
            )}
          </>
        )}

        {phase === 'predict' && seconds > 0 && (
          <div className="absolute left-[2.4cqw] top-[2.4cqw] z-[5] flex h-[7cqw] w-[7cqw] items-center justify-center rounded-full bg-white/92 font-extrabold tabular-nums text-deep-navy shadow-lg" style={{ fontSize: 'clamp(16px, 3.4cqw, 44px)', color: left <= 5 ? '#d92d20' : undefined }} role="timer" aria-label={t('gameTelepathy.timerLabel', { n: left })}>
            {left}
          </div>
        )}

        <div className="pointer-events-none absolute left-1/2 top-[3cqw] z-[5] -translate-x-1/2 rounded-full bg-white/92 px-[2.4cqw] py-[0.9cqw] text-center font-extrabold text-deep-navy shadow-lg" style={{ fontSize: 'clamp(13px, 2.1cqw, 28px)', maxWidth: '78%' }} role="status">
          {status}
        </div>

        {phase === 'done' && (
          <div className="absolute inset-0 z-[6] flex flex-col items-center justify-center gap-[1.4cqw] bg-white/90 p-[3cqw] text-center">
            <img src="/skins/lightning/trophy.webp" alt="" className="h-[14cqw] w-auto" />
            <div className="font-extrabold text-deep-navy" style={{ fontSize: 'clamp(20px, 4cqw, 52px)' }}>{t('gameTelepathy.resultTitle')}</div>
            <ol className="space-y-1">
              {ranking.map((r) => (
                <li key={r.team} className="flex items-center justify-center gap-2 font-bold text-deep-navy" style={{ fontSize: 'clamp(15px, 2.6cqw, 34px)' }}>
                  <span className="w-8 text-center">{r.rank}</span>
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: TEAM_COLORS[r.team] }} aria-hidden />
                  <span>{t('gameTelepathy.teamLabel', { n: r.team + 1 })}</span>
                  <span className="tabular-nums">{t('gameTelepathy.points', { n: r.score })}</span>
                  {r.rank === 1 && <span aria-hidden>🏆</span>}
                </li>
              ))}
            </ol>
            <button type="button" onClick={resetAll} className={`${btn} bg-primary`}>{t('gameTelepathy.playAgain')}</button>
          </div>
        )}
      </div>

      {/* 후보: 동물 친구 + 낱말·문장 */}
      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${choices}, minmax(0, 1fr))` }}>
        {Array.from({ length: choices }, (_, slot) => {
          const idx = rd?.labels[slot];
          const label = idx !== undefined ? parseTelepathyLabel(items[idx]?.label ?? '') : null;
          const isAnswer = phase === 'reveal' && rd?.answer === slot;
          const dim = phase === 'reveal' && !isAnswer;
          return (
            <div key={slot} className={`relative flex min-h-[7.5rem] flex-col items-center justify-center gap-1 rounded-2xl border-[3px] bg-[#fffbe8] px-3 pb-2 pt-7 text-center shadow-md transition-opacity ${isAnswer ? 'border-green-500' : 'border-amber-200'} ${dim ? 'opacity-45' : ''}`}>
              {rd && <img src={`${ANIMAL}a-${rd.animals[slot]}.webp`} alt="" draggable={false} className="h-14 w-auto" />}
              <span className="font-extrabold text-deep-navy" style={{ fontSize: label && label.text.length > 24 ? 'clamp(14px, 1.9vw, 22px)' : 'clamp(18px, 2.8vw, 36px)' }}>
                {label ? label.text : '?'}
              </span>
              {label?.ko && <span className="block text-sm text-on-surface-variant">{label.ko}</span>}
              {isAnswer && <span className="absolute left-2 top-1.5 rounded-full bg-green-500 px-2 py-0.5 text-xs font-extrabold text-white">{t('gameTelepathy.answerTag')}</span>}
              {label && (
                <button type="button" onClick={() => speak(label.text)} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm shadow hover:bg-white" aria-label={t('gameTelepathy.speak')} title={t('gameTelepathy.speak')}>
                  🔊
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 진행 */}
      <div className="mt-4 flex flex-col items-center gap-3">
        {phase === 'reveal' && (
          <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label={t('gameTelepathy.whoRight')}>
            <span className="text-sm font-bold text-on-surface-variant">{t('gameTelepathy.whoRight')}</span>
            {Array.from({ length: teams }, (_, i) => (
              <button key={i} type="button" aria-pressed={won[i]} onClick={() => toggleWon(i)} className={`rounded-full border-2 px-4 py-1.5 font-bold shadow ${won[i] ? 'text-white' : 'bg-white text-deep-navy'}`} style={{ borderColor: TEAM_COLORS[i], background: won[i] ? TEAM_COLORS[i] : undefined }}>
                {t('gameTelepathy.teamLabel', { n: i + 1 })} {won[i] ? '✓' : ''}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {phase === 'ready' && <button type="button" onClick={startRound} className={`${btn} bg-primary`}>{t('gameTelepathy.start')}</button>}
          {phase === 'predict' && (
            <button type="button" onClick={reveal} className={`${btn} bg-primary ${left === 0 && seconds > 0 ? 'tp-anim' : ''}`} style={left === 0 && seconds > 0 ? { animation: 'tp-pulse 1.2s ease-in-out infinite' } : undefined}>
              {t('gameTelepathy.reveal')}
            </button>
          )}
          {phase === 'reveal' && <button type="button" onClick={advance} className={`${btn} bg-primary`}>{round >= rounds ? t('gameTelepathy.seeResult') : t('gameTelepathy.nextRound')}</button>}
          {(phase === 'ready' || phase === 'predict') && <span className="text-sm text-on-surface-variant">{t(phase === 'ready' ? 'gameTelepathy.ruleReady' : 'gameTelepathy.rulePredict')}</span>}
        </div>
      </div>
    </div>
  );
}
