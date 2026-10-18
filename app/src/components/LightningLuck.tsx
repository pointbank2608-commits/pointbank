import { gameClock } from '../lib/gameClock';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import { useRemoteActions } from '../lib/remote';
import type { GameItem, UndoHandle } from '../lib/types';
import { CHARS, LT_IMG, charImage, type CharKind } from './LightningChars';

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
    timers.current.push(gameClock.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((id) => gameClock.clearTimeout(id));
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
              <img src={charImage(c.id, false)} alt="" draggable={false} className="mr-1.5 inline-block h-7 w-auto align-middle" />
              {t(`gameLightning.char_${c.id}`)}
            </button>
          ))}
        </div>
      )}

      <div
        className="relative w-full overflow-hidden rounded-[24px] shadow-lg"
        style={{
          aspectRatio: '16 / 9',
          containerType: 'size',
          background: `#8fd3ff url(${LT_IMG('scene-day')}) center / cover no-repeat`,
        }}
      >
        {/* 폭풍 장면은 맑은 장면 위에서 서서히 짙어진다 */}
        <div
          className="absolute inset-0"
          style={{ background: `#2b2f4a url(${LT_IMG('scene-storm')}) center / cover no-repeat`, opacity: stormy ? 1 : 0, transition: 'opacity .9s' }}
        />

        {/* 몰려오는 먹구름 */}
        {stormy && (
          <div key={runId} className="absolute inset-x-0 top-[-4%] h-[34%]">
            {[
              { l: '-8%', w: 34, dir: 'l', d: 0, img: 'cloud-dark-1' },
              { l: '20%', w: 32, dir: 'r', d: 0.2, img: 'cloud-dark-2' },
              { l: '44%', w: 36, dir: 'l', d: 0.1, img: 'cloud-dark-1' },
              { l: '68%', w: 34, dir: 'r', d: 0.3, img: 'cloud-dark-2' },
            ].map((c, i) => (
              <div
                key={i}
                className="lt-anim absolute top-0"
                style={{ left: c.l, width: `${c.w}cqw`, animation: `lt-in-${c.dir} ${CLOUD_IN_MS / 1000}s ${c.d}s ease-out both` }}
              >
                <img src={LT_IMG(c.img)} alt="" draggable={false} className="lt-anim w-full" style={{ animation: 'lt-rumble .5s linear infinite', filter: 'drop-shadow(0 1.2cqw 1cqw rgba(0,0,0,.35))' }} />
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
            <img
              key={`b-${runId}`}
              src={LT_IMG('bolt')}
              alt=""
              draggable={false}
              className="lt-anim absolute z-20"
              style={{ left: '43%', top: '6%', height: '62%', transformOrigin: 'top', animation: 'lt-bolt 1.1s both', filter: 'drop-shadow(0 0 1.6cqw #fde047)' }}
            />
            <div key={`f-${runId}`} className="lt-anim pointer-events-none absolute inset-0 z-30 bg-white" style={{ animation: 'lt-flash .9s both' }} />
          </>
        )}

        {/* 캐릭터 — 평소 모습과 번개 맞은 모습이 따로 있다 */}
        <div className="absolute bottom-[3%] left-1/2 z-10 -translate-x-1/2" style={{ height: '50cqh' }}>
          <img
            key={`${char}-${phase === 'struck'}`}
            src={charImage(char, phase === 'struck')}
            alt=""
            draggable={false}
            className="lt-anim h-full w-auto object-contain"
            style={{
              filter: 'drop-shadow(0 1.2cqw 1.2cqw rgba(0,0,0,.3))',
              animation:
                phase === 'struck' ? 'lt-shake .7s both' : phase === 'clouds' ? 'lt-worry .6s ease-in-out infinite' : phase === 'won' ? 'lt-hop .8s ease-in-out infinite' : undefined,
            }}
          />
          {phase === 'struck' &&
            [0, 1, 2].map((i) => (
              <img
                key={i}
                src={LT_IMG('smoke')}
                alt=""
                draggable={false}
                className="lt-anim absolute top-[2%] w-[4.5cqw]"
                style={{ left: `${22 + i * 22}%`, animation: `lt-smoke 1.8s ${i * 0.3}s ease-out infinite` }}
              />
            ))}
        </div>

        {/* 승리 */}
        {phase === 'won' && (
          <div className="lt-anim absolute left-1/2 top-[26%] z-20 -translate-x-1/2 text-center" style={{ animation: 'lt-pop .6s both' }}>
            <img src={LT_IMG('trophy')} alt="" draggable={false} className="mx-auto h-[16cqw] w-auto" style={{ filter: 'drop-shadow(0 1cqw 1cqw rgba(0,0,0,.3))' }} />
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
