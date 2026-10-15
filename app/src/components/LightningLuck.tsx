import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import { useRemoteActions } from '../lib/remote';
import type { GameItem, UndoHandle } from '../lib/types';
import Character, { CHARS, type CharKind } from './LightningChars';

/**
 * 번개 피하기(2026-10-16) — PPT "Bad Luck Billy" 방식만 참고한 학급 서바이벌 게임(캐릭터·그림·소리는 우리 것).
 * 모두 일어선다 → 한 명이 화면의 낱말·문장을 읽고 다음 사람이 같은 글을 읽는다 → 선생님이 먹구름을 보내고(스페이스바)
 * 구름이 걷히기 전 아무 때나 번개가 친다 → 번개가 칠 때 읽고 있던 학생이 아웃(앉는다) → 마지막까지 서 있는 학생이 승리.
 * 번개가 언제 칠지는 선생님도 모른다(설정한 범위 안에서 무작위, PPT는 슬라이드마다 고정 시간이라 외워지는 문제가 있었다).
 */

export const LIGHTNING_DEFAULTS = { players: 8, min: 4, max: 12 };

interface Props {
  items: GameItem[];
  players: number;
  minSec: number;
  maxSec: number;
  /** 번개를 맞을 캐릭터 — 게임 시작 전에 고른다(저장은 페이지가) */
  char?: CharKind;
  onChar?: (c: CharKind) => void;
}

type Phase = 'ready' | 'clouds' | 'struck' | 'won';
const CLOUD_IN_MS = 2200;

const CHIP_COLORS = ['#ef5b5b', '#3b82f6', '#22a559', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5a4', '#78716c'];

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function parseItem(raw: string): { text: string; ko: string } {
  const cut = raw.indexOf(' | ');
  return cut >= 0 ? { text: raw.slice(0, cut).trim(), ko: raw.slice(cut + 3).trim() } : { text: raw.trim(), ko: '' };
}

interface Snapshot {
  alive: boolean[];
  cur: number;
  pos: number;
  round: number;
}

const STYLE = `
@keyframes lt-drift { 0%{transform:translateX(-4cqw)} 50%{transform:translateX(4cqw)} 100%{transform:translateX(-4cqw)} }
@keyframes lt-in-l { from{transform:translateX(-60cqw)} to{transform:translateX(0)} }
@keyframes lt-in-r { from{transform:translateX(60cqw)} to{transform:translateX(0)} }
@keyframes lt-rumble { 0%,100%{transform:translate(0,0)} 25%{transform:translate(.25cqw,.15cqw)} 75%{transform:translate(-.25cqw,-.1cqw)} }
@keyframes lt-flash { 0%{opacity:0} 6%{opacity:.95} 22%{opacity:.15} 34%{opacity:.7} 100%{opacity:0} }
@keyframes lt-bolt { 0%{opacity:0;transform:scaleY(.1)} 10%{opacity:1;transform:scaleY(1)} 70%{opacity:1} 100%{opacity:.0} }
@keyframes lt-shake { 0%,100%{transform:translate(0,0) rotate(0)} 20%{transform:translate(-1cqw,0) rotate(-4deg)} 40%{transform:translate(1cqw,0) rotate(4deg)} 60%{transform:translate(-.8cqw,0) rotate(-3deg)} 80%{transform:translate(.8cqw,0) rotate(3deg)} }
@keyframes lt-worry { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-.6cqw)} }
@keyframes lt-hop { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-3cqw)} }
@keyframes lt-pop { 0%{transform:scale(.4) rotate(-6deg);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
@keyframes lt-smoke { 0%{transform:translateY(0) scale(.5);opacity:.9} 100%{transform:translateY(-8cqw) scale(1.4);opacity:0} }
@keyframes lt-rain { from{transform:translateY(-10cqh)} to{transform:translateY(110cqh)} }
@keyframes lt-chip { 0%{transform:scale(1)} 50%{transform:scale(1.18)} 100%{transform:scale(1)} }
@media (prefers-reduced-motion: reduce) { .lt-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

function Cloud({ fill, className, style }: { fill: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 160 90" className={className} style={style} aria-hidden="true">
      <g fill={fill}>
        <circle cx="40" cy="52" r="26" />
        <circle cx="78" cy="38" r="34" />
        <circle cx="118" cy="52" r="26" />
        <rect x="36" y="52" width="86" height="26" rx="13" />
      </g>
    </svg>
  );
}

type Mood = 'happy' | 'worried' | 'shocked' | 'cheer';

/** 빌리 — 폭신한 양 친구. 표정 넷: 웃음 / 걱정 / 감전(까맣게 그을림) / 환호 */
function Billy({ mood, className, style }: { mood: Mood; className?: string; style?: React.CSSProperties }) {
  const shocked = mood === 'shocked';
  const wool = shocked ? '#4b4b55' : '#fffaf0';
  const face = shocked ? '#1f1f26' : '#7a5a45';
  return (
    <svg viewBox="0 0 140 160" className={className} style={style} aria-hidden="true">
      {/* 다리 */}
      <rect x="48" y="118" width="12" height="30" rx="6" fill={face} />
      <rect x="80" y="118" width="12" height="30" rx="6" fill={face} />
      {/* 몸 털뭉치 */}
      <g fill={wool} stroke={shocked ? '#2a2a33' : '#e7dcc6'} strokeWidth="2">
        <circle cx="38" cy="86" r="24" />
        <circle cx="102" cy="86" r="24" />
        <circle cx="52" cy="108" r="24" />
        <circle cx="88" cy="108" r="24" />
        <circle cx="70" cy="90" r="34" />
        {shocked && (
          <>
            <path d="M22 62 L10 40 L34 54Z" />
            <path d="M118 62 L130 40 L106 54Z" />
            <path d="M56 54 L50 28 L70 50Z" />
            <path d="M84 54 L92 28 L74 50Z" />
          </>
        )}
      </g>
      {/* 얼굴 */}
      <ellipse cx="70" cy="62" rx="26" ry="28" fill={face} />
      <ellipse cx="42" cy="58" rx="9" ry="14" fill={face} transform="rotate(-25 42 58)" />
      <ellipse cx="98" cy="58" rx="9" ry="14" fill={face} transform="rotate(25 98 58)" />
      {shocked ? (
        <>
          <circle cx="60" cy="58" r="8" fill="#fff" />
          <circle cx="80" cy="58" r="8" fill="#fff" />
          <circle cx="60" cy="58" r="3" fill="#111" />
          <circle cx="80" cy="58" r="3" fill="#111" />
          <ellipse cx="70" cy="78" rx="7" ry="9" fill="#fff" />
        </>
      ) : (
        <>
          <circle cx="60" cy="58" r="5" fill="#fff" />
          <circle cx="80" cy="58" r="5" fill="#fff" />
          <circle cx={mood === 'worried' ? 61 : 60} cy="59" r="2.6" fill="#222" />
          <circle cx={mood === 'worried' ? 81 : 80} cy="59" r="2.6" fill="#222" />
          {mood === 'worried' ? (
            <>
              <path d="M52 47 L66 51" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              <path d="M88 47 L74 51" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              <path d="M60 78 Q65 72 70 78 T80 78" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              <path d="M104 40 q6 10 0 16 q-6 -6 0 -16Z" fill="#8bd3ff" />
            </>
          ) : (
            <path d="M58 74 Q70 88 82 74" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
          )}
        </>
      )}
    </svg>
  );
}

const LightningLuck = forwardRef<UndoHandle, Props>(function LightningLuck({ items, players, minSec, maxSec, char = 'sheep', onChar }, ref) {
  const { t } = useTranslation();
  const n = Math.min(40, Math.max(2, players));
  const lo = Math.max(2, Math.min(minSec, maxSec));
  const hi = Math.max(lo, maxSec);
  const itemKey = items.map((i) => i.id).join(',');
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [round, setRound] = useState(1);
  const [alive, setAlive] = useState<boolean[]>(() => Array(n).fill(true));
  const [cur, setCur] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [runId, setRunId] = useState(0);
  const [reading, setReading] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  // 타이머 안에서 최신 읽는 사람을 알기 위한 ref
  const curRef = useRef(0);
  curRef.current = cur;
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  useEffect(() => {
    clearTimers();
    setOrder(shuffle(items.map((_, i) => i)));
    setPos(0);
    setRound(1);
    setAlive(Array(n).fill(true));
    setCur(0);
    setPhase('ready');
    setReading(false);
    setSnapshot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, itemKey]);

  const current = items.length > 0 && order.length > 0 ? parseItem(items[order[pos % order.length]]?.label ?? '') : { text: '', ko: '' };
  const aliveCount = alive.filter(Boolean).length;
  const winner = alive.findIndex(Boolean);

  const nextAlive = (from: number, a: boolean[]) => {
    for (let k = 1; k <= a.length; k++) {
      const i = (from + k) % a.length;
      if (a[i]) return i;
    }
    return from;
  };

  function sendClouds() {
    if (phase !== 'ready') return;
    clearTimers();
    setSnapshot({ alive: [...alive], cur, pos, round });
    setRunId((r) => r + 1);
    setReading(false);
    setPhase('clouds');
    playSfx(GAME_SFX.lightning.clouds);
    later(() => {
      setReading(true);
      playSfx(GAME_SFX.lightning.go);
    }, CLOUD_IN_MS);
    const wait = CLOUD_IN_MS + (lo + Math.random() * (hi - lo)) * 1000;
    later(() => strike(), wait);
  }

  function strike() {
    setPhase('struck');
    setReading(false);
    playSfx(GAME_SFX.lightning.strike);
    // 읽고 있던 학생이 아웃
    setAlive((a) => {
      const na = [...a];
      na[curRef.current] = false;
      return na;
    });
  }

  function nextReader() {
    if (phase !== 'clouds') return;
    playSfx(GAME_SFX.lightning.pass);
    setCur((c) => nextAlive(c, alive));
  }

  function nextRound() {
    if (phase !== 'struck') return;
    const left = alive.filter(Boolean).length;
    if (left <= 1) {
      setPhase('won');
      playSfx(GAME_SFX.lightning.win);
      return;
    }
    let np = pos + 1;
    if (np >= order.length) {
      setOrder(shuffle(items.map((_, i) => i)));
      np = 0;
    }
    setPos(np);
    setRound((r) => r + 1);
    setCur((c) => nextAlive(c, alive));
    setPhase('ready');
  }

  // 번개로 남은 학생이 한 명이면 바로 승리 화면으로
  useEffect(() => {
    if (phase === 'struck' && aliveCount <= 1) {
      later(() => {
        setPhase('won');
        playSfx(GAME_SFX.lightning.win);
      }, 1800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, aliveCount]);

  function pickReader(i: number) {
    if (phase === 'won' || phase === 'struck') return;
    if (alive[i]) setCur(i);
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!snapshot) return;
      clearTimers();
      setAlive(snapshot.alive);
      setCur(snapshot.cur);
      setPos(snapshot.pos);
      setRound(snapshot.round);
      setPhase('ready');
      setReading(false);
      setSnapshot(null);
    },
  }));

  // 스페이스·엔터: 구름 보내기 → 다음 사람 → 다음 문제 (PPT의 스페이스바 진행과 같다)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (phase === 'ready') sendClouds();
      else if (phase === 'clouds') nextReader();
      else if (phase === 'struck') nextRound();
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  useRemoteActions(
    phase === 'ready'
      ? [{ id: 'clouds', label: t('gameLightning.sendClouds'), tone: 'primary', run: sendClouds }]
      : phase === 'clouds'
        ? [{ id: 'pass', label: t('gameLightning.nextReader'), tone: 'primary', run: nextReader }]
        : phase === 'struck'
          ? [{ id: 'next', label: t('gameLightning.nextRound'), tone: 'primary', run: nextRound }]
          : [],
  );

  const raindrops = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 6) * 0.15, dur: 0.7 + (i % 4) * 0.12 })),
    [],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        {t('gameLightning.needItems')}
      </div>
    );
  }

  const stormy = phase === 'clouds' || phase === 'struck';
  const mood: Mood = phase === 'struck' ? 'shocked' : phase === 'clouds' ? 'worried' : phase === 'won' ? 'cheer' : 'happy';
  const paper =
    'rounded-[1.6cqw] border-[0.35cqw] border-amber-300 bg-[#fffbe8] px-[2cqw] py-[1cqw] font-bold text-deep-navy shadow-xl';
  const fs = (len: number) => (len > 60 ? 'clamp(14px,2.6cqw,34px)' : len > 36 ? 'clamp(16px,3.4cqw,46px)' : len > 18 ? 'clamp(20px,4.6cqw,60px)' : 'clamp(26px,7cqw,92px)');
  const btn = 'rounded-full px-6 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95';

  return (
    <div className="mx-auto w-full max-w-[1100px] select-none">
      <style>{STYLE}</style>

      {phase === 'ready' && round === 1 && onChar && (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <span className="font-label-md text-label-md text-on-surface-variant">{t('gameLightning.charLabel')}</span>
          {CHARS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChar(c.id)}
              className={`rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${
                char === c.id ? 'bg-indigo-600 text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {c.emoji} {t(`gameLightning.char_${c.id}`)}
            </button>
          ))}
        </div>
      )}

      <div
        className="relative w-full overflow-hidden rounded-[24px] shadow-lg"
        style={{
          aspectRatio: '16 / 9',
          containerType: 'size',
          background: stormy ? 'linear-gradient(#2b2f4a 0%, #4a4f73 55%, #6b7099 100%)' : 'linear-gradient(#8fd3ff 0%, #c8ecff 60%, #e9f8d7 100%)',
          transition: 'background .6s',
        }}
      >
        {/* 땅 */}
        <div className="absolute inset-x-0 bottom-0 h-[16%]" style={{ background: stormy ? '#3c5a3a' : '#7ccf6a' }} />

        {/* 구름 */}
        {!stormy && (
          <>
            <Cloud fill="#fff" className="lt-anim absolute left-[8%] top-[4%] w-[16cqw]" style={{ animation: 'lt-drift 9s ease-in-out infinite' }} />
            <Cloud fill="#fff" className="lt-anim absolute right-[10%] top-[10%] w-[12cqw]" style={{ animation: 'lt-drift 11s ease-in-out infinite reverse' }} />
          </>
        )}
        {stormy && (
          <div key={runId} className="absolute inset-x-0 top-0 h-[34%]">
            {[
              { l: '-4%', w: 30, dir: 'l', d: 0 },
              { l: '22%', w: 28, dir: 'r', d: 0.2 },
              { l: '46%', w: 32, dir: 'l', d: 0.1 },
              { l: '70%', w: 30, dir: 'r', d: 0.3 },
            ].map((c, i) => (
              <div
                key={i}
                className="lt-anim absolute top-0"
                style={{ left: c.l, width: `${c.w}cqw`, animation: `lt-in-${c.dir} ${CLOUD_IN_MS / 1000}s ${c.d}s ease-out both` }}
              >
                <Cloud fill={i % 2 ? '#3a3e5e' : '#2e3150'} className="lt-anim w-full" style={{ animation: 'lt-rumble .5s linear infinite' }} />
              </div>
            ))}
          </div>
        )}

        {/* 비 */}
        {stormy &&
          raindrops.map((r, i) => (
            <span
              key={i}
              className="lt-anim absolute top-0 h-[6cqh] w-[0.25cqw] rounded-full bg-sky-200/60"
              style={{ left: `${r.left}%`, animation: `lt-rain ${r.dur}s ${r.delay}s linear infinite` }}
            />
          ))}

        {/* 읽을 글 */}
        {phase !== 'won' && (
          <div className="absolute left-[6%] right-[6%] z-10 flex flex-col items-center gap-[0.8cqw]" style={{ top: '22%' }}>
            <div className={`lt-anim ${paper} text-center`} style={{ fontSize: fs(current.text.length), animation: 'lt-pop .4s both', maxWidth: '100%' }}>
              {current.text}
            </div>
            {current.ko && phase !== 'clouds' && (
              <div className="rounded-full bg-black/25 px-[1.4cqw] py-[0.2cqw] text-white" style={{ fontSize: 'clamp(12px,2cqw,26px)' }}>
                {current.ko}
              </div>
            )}
          </div>
        )}

        {/* 상태 띠 */}
        <div className="absolute left-0 right-0 top-[2.5%] z-20 text-center">
          <span className="inline-block rounded-full bg-white/85 px-[2.4cqw] py-[0.6cqw] font-bold text-slate-800 shadow" style={{ fontSize: 'clamp(11px, 1.9cqw, 26px)' }}>
            {phase === 'ready' && t('gameLightning.readyTitle')}
            {phase === 'clouds' && (reading ? t('gameLightning.startReading') : t('gameLightning.cloudsComing'))}
            {phase === 'struck' && t('gameLightning.outLine', { n: cur + 1 })}
            {phase === 'won' && t('gameLightning.winnerLine', { n: winner + 1 })}
          </span>
        </div>

        {/* 번개 */}
        {phase === 'struck' && (
          <>
            <svg
              key={`b-${runId}`}
              viewBox="0 0 100 200"
              className="lt-anim absolute z-20 h-[62%] w-[10cqw]"
              style={{ left: '45%', top: '8%', transformOrigin: 'top', animation: 'lt-bolt 1.1s both' }}
              aria-hidden="true"
            >
              <polygon points="62,0 24,92 50,92 30,200 86,70 58,70 80,0" fill="#fde047" stroke="#fff" strokeWidth="3" />
            </svg>
            <div key={`f-${runId}`} className="lt-anim pointer-events-none absolute inset-0 z-30 bg-white" style={{ animation: 'lt-flash .9s both' }} />
          </>
        )}

        {/* 빌리 */}
        <div className="absolute bottom-[3%] left-1/2 z-10 w-[17cqw] -translate-x-1/2">
          {(() => {
            const figProps = {
              mood,
              className: 'lt-anim w-full',
              style: {
                animation:
                  phase === 'struck' ? 'lt-shake .7s both' : phase === 'clouds' ? 'lt-worry .6s ease-in-out infinite' : phase === 'won' ? 'lt-hop .8s ease-in-out infinite' : undefined,
              } as React.CSSProperties,
            };
            return char === 'sheep' ? <Billy {...figProps} /> : <Character kind={char} {...figProps} />;
          })()}
          {phase === 'struck' &&
            [0, 1, 2].map((i) => (
              <span
                key={i}
                className="lt-anim absolute top-[8%] h-[2.4cqw] w-[2.4cqw] rounded-full bg-slate-400/80"
                style={{ left: `${30 + i * 18}%`, animation: `lt-smoke 1.6s ${i * 0.25}s ease-out infinite` }}
              />
            ))}
        </div>

        {/* 승리 */}
        {phase === 'won' && (
          <div className="lt-anim absolute left-1/2 top-[26%] z-20 -translate-x-1/2 text-center" style={{ animation: 'lt-pop .6s both' }}>
            <div className="text-[9cqw] leading-none">🏆</div>
            <div className="mt-[0.6cqw] rounded-full bg-amber-300 px-[3cqw] py-[0.8cqw] font-black text-amber-950 shadow-xl" style={{ fontSize: 'clamp(18px,4.4cqw,60px)' }}>
              {t('gameLightning.winnerLine', { n: winner + 1 })}
            </div>
          </div>
        )}
      </div>

      {/* 학생 번호 칩 */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {alive.map((ok, i) => {
          const isCur = i === cur && phase !== 'won';
          return (
            <button
              key={i}
              type="button"
              onClick={() => pickReader(i)}
              disabled={!ok}
              className="lt-anim flex h-10 min-w-10 items-center justify-center rounded-full px-2 font-bold text-white shadow-md transition-transform"
              style={{
                background: ok ? CHIP_COLORS[i % CHIP_COLORS.length] : '#cbd5e1',
                outline: isCur ? '4px solid #facc15' : undefined,
                textDecoration: ok ? undefined : 'line-through',
                color: ok ? '#fff' : '#64748b',
                animation: isCur ? 'lt-chip .8s ease-in-out infinite' : undefined,
              }}
              title={ok ? t('gameLightning.chipAlive', { n: i + 1 }) : t('gameLightning.chipOut', { n: i + 1 })}
            >
              {ok ? i + 1 : `✕ ${i + 1}`}
            </button>
          );
        })}
      </div>
      <div className="mt-1 text-center font-label-md text-label-md text-on-surface-variant">
        {t('gameLightning.survivors', { n: aliveCount, total: alive.length })} · {t('gameLightning.roundLabel', { n: round })}
      </div>

      {/* 조작 */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => current.text && speak(current.text)}
          className="rounded-full border-2 border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 shadow-sm"
          title={t('gameLightning.speak')}
        >
          🔊
        </button>
        {phase === 'ready' && (
          <button type="button" onClick={sendClouds} className={btn} style={{ background: '#4f46e5' }}>
            ⛈ {t('gameLightning.sendClouds')}
          </button>
        )}
        {phase === 'clouds' && (
          <button type="button" onClick={nextReader} className={btn} style={{ background: '#0ea5a4' }}>
            ▶ {t('gameLightning.nextReader')}
          </button>
        )}
        {phase === 'struck' && aliveCount > 1 && (
          <button type="button" onClick={nextRound} className={btn} style={{ background: '#f59e0b' }}>
            {t('gameLightning.nextRound')}
          </button>
        )}
      </div>
      <div className="mt-2 text-center font-caption text-caption text-on-surface-variant">{t('gameLightning.rule')}</div>
    </div>
  );
});

export default LightningLuck;
