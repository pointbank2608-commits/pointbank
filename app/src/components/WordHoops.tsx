import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClock } from '../lib/gameClock';
import { gameKeyboardAllowed } from '../lib/gameKeyboard';
import { COMMON_SFX, playSfx, useGameSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import {
  HOOPS_MAX_MISSES,
  HOOPS_TIMED_POOL,
  buildHoopsQuestions,
  buildHoopsPictureQuestions,
  formatHoopsCountdown,
  formatHoopsTime,
  isHoopsTie,
  pointsForTry,
  rankHoops,
  type HoopsMode,
  type HoopsRule,
  type HoopsResult,
} from '../lib/wordHoops';
import type { MatchPair } from '../lib/types';
import type { PictureWordQuestion } from '../lib/pictureWordQuestions';

/**
 * 단어 농구 대결(2026-11-07) — 두 팀이 같은 문제를 동시에 풀며 정답 공을 눌러 슛하는 단어 게임.
 * 화면 크기는 전부 코트 폭 1/100(--u)로 잰다. 시간은 gameClock(교사 일시정지가 멈춰 주는 시계)으로 잰다.
 * 규칙·점수·승부는 lib/wordHoops.ts.
 */

interface Props {
  pairs: MatchPair[];
  pictureQuestions?: PictureWordQuestion[];
  teams: number;
  shots: number;
  mode: HoopsMode;
  rule: HoopsRule;
  seconds: number;
}

type Phase = 'ready' | 'playing' | 'done';

interface Flash {
  kind: 'good' | 'miss' | 'reveal';
  text: string;
  sub?: string;
  key: number;
}

interface TeamState {
  idx: number;
  misses: number;
  removed: number[];
  points: number;
  firstTry: number;
  made: number;
  doneMs: number | null;
  busy: boolean;
  flash: Flash | null;
  shot: { choice: number; hit: boolean; key: number } | null;
}

const TEAM_COLORS = ['#d64545', '#2f62d1'];
const COURT_W = 49.4; // 루트 폭 대비 코트 한 쪽 폭(%)
const U = (n: number) => `calc(var(--u) * ${n})`;

const STYLE = `
@keyframes wh-hit {
  0% { transform:translate(0,0) scale(1); animation-timing-function:cubic-bezier(.25,.75,.45,1); }
  38% { transform:translate(calc(var(--dx) * .62),-44u) scale(.6); animation-timing-function:cubic-bezier(.45,0,.75,.55); }
  56% { transform:translate(var(--dx),-29.5u) scale(.4); animation-timing-function:linear; }
  70% { transform:translate(var(--dx),-20u) scale(.38); animation-timing-function:cubic-bezier(.5,0,.9,.6); }
  84% { transform:translate(var(--dx),-3u) scale(.62); animation-timing-function:ease-out; }
  91% { transform:translate(var(--dx),-9u) scale(.56); opacity:1; animation-timing-function:ease-in; }
  100% { transform:translate(var(--dx),-3u) scale(.6); opacity:0; }
}
@keyframes wh-miss {
  0% { transform:translate(0,0) scale(1); animation-timing-function:cubic-bezier(.25,.75,.45,1); opacity:1; }
  34% { transform:translate(calc(var(--dx) * .9),-30u) scale(.5); animation-timing-function:cubic-bezier(.2,.6,.4,1); }
  46% { transform:translate(calc(var(--dx) * .9 + var(--side) * 9u),-40u) scale(.5); animation-timing-function:cubic-bezier(.5,0,.9,.6); }
  70% { transform:translate(calc(var(--dx) * .9 + var(--side) * 20u),-8u) scale(.8); animation-timing-function:ease-out; }
  78% { transform:translate(calc(var(--dx) * .9 + var(--side) * 24u),-14u) scale(.78); animation-timing-function:ease-in; }
  86% { transform:translate(calc(var(--dx) * .9 + var(--side) * 26u),-6u) scale(.8); opacity:1; }
  100% { transform:translate(0,0) scale(1); opacity:.28; }
}
@keyframes wh-spin { from{transform:rotate(0)} to{transform:rotate(calc(var(--side) * 700deg))} }
@keyframes wh-swish { 0%,100%{transform:scaleY(1)} 30%{transform:scaleY(1.3)} 60%{transform:scaleY(.9)} 80%{transform:scaleY(1.05)} }
@keyframes wh-rim { 0%,100%{transform:rotate(0)} 22%{transform:rotate(-3deg)} 50%{transform:rotate(2.4deg)} 75%{transform:rotate(-1deg)} }
@keyframes wh-pop { 0%{transform:translateX(-50%) scale(.4);opacity:0} 55%{transform:translateX(-50%) scale(1.1);opacity:1} 100%{transform:translateX(-50%) scale(1);opacity:1} }
@keyframes wh-confetti { 0%{transform:translateY(-10%) rotate(0);opacity:1} 100%{transform:translateY(120%) rotate(540deg);opacity:.9} }
@media (prefers-reduced-motion: reduce) { .wh-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

function blank(): TeamState {
  return { idx: 0, misses: 0, removed: [], points: 0, firstTry: 0, made: 0, doneMs: null, busy: false, flash: null, shot: null };
}

/** u 단위(코트 폭 1/100)를 키프레임 문자열 안에서도 쓰기 위해 치환한다 */
const css = STYLE.replace(/(-?\d+(?:\.\d+)?)u\b/g, (_m, n) => `calc(var(--u) * ${n})`);

function ballFont(text: string): number {
  const len = [...text].length;
  if (len <= 4) return 6.4;
  if (len <= 7) return 5;
  if (len <= 11) return 3.9;
  return 3.1;
}

function Ball({
  label,
  index,
  count,
  removed,
  anim,
  disabled,
  onPick,
  gradId,
}: {
  label: string;
  index: number;
  count: number;
  removed: boolean;
  anim: 'hit' | 'miss' | null;
  disabled: boolean;
  onPick: () => void;
  gradId: string;
}) {
  const centers = count === 2 ? [33, 67] : [20, 50, 80];
  const size = 27;
  // 림 한가운데(코트 폭 50)까지 가로로 가야 하는 거리, 빗나갈 때 튕겨 나가는 쪽
  const dx = 50 - centers[index];
  const side = count === 2 ? (index === 0 ? -1 : 1) : index === 0 ? -1 : 1;
  const style: CSSProperties = {
    ['--dx' as string]: U(dx),
    ['--side' as string]: side,
    position: 'absolute',
    left: U(centers[index] - size / 2),
    top: U(78),
    width: U(size),
    height: U(size),
    opacity: removed && !anim ? 0.28 : 1,
    filter: removed && !anim ? 'grayscale(.7)' : undefined,
    transition: 'opacity .3s',
    animation: anim === 'hit' ? 'wh-hit 1.5s linear forwards' : anim === 'miss' ? 'wh-miss 1.5s linear forwards' : undefined,
    zIndex: 4,
  };
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled || removed}
      aria-label={label}
      className={`wh-anim group ${anim ? '' : 'transition-transform hover:scale-105 active:scale-95'} disabled:cursor-default`}
      style={style}
    >
      <svg
        viewBox="0 0 100 100"
        className="wh-anim absolute inset-0 h-full w-full drop-shadow-[0_6px_6px_rgba(0,0,0,0.3)]"
        style={{ animation: anim ? 'wh-spin 1.2s ease-out forwards' : undefined }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={gradId} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#ffb24d" />
            <stop offset="60%" stopColor="#ee7f1f" />
            <stop offset="100%" stopColor="#bb4f0e" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill={`url(#${gradId})`} stroke="#7a3510" strokeWidth="2.5" />
        <path d="M50 2 V98 M2 50 H98 M17 14 C40 34 40 66 17 86 M83 14 C60 34 60 66 83 86" fill="none" stroke="#7a3510" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <span
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[10px] bg-white/95 px-[6%] text-center font-extrabold leading-tight text-deep-navy shadow"
        style={{ width: '78%', minHeight: '40%', fontSize: U(ballFont(label)), wordBreak: 'keep-all' }}
      >
        {label}
      </span>
    </button>
  );
}

const HOOP_BOX = (): CSSProperties => ({ left: U(20), top: U(36), width: U(60), height: U(37) });

/** 골대 뒤쪽(백보드·기둥·림 뒤쪽 반) — 공보다 아래에 그린다 */
function HoopBack() {
  return (
    <svg viewBox="0 0 100 62" className="absolute z-[3]" style={HOOP_BOX()} aria-hidden="true">
      <rect x="22" y="2" width="56" height="34" rx="3" fill="#fff" stroke="#8a97a8" strokeWidth="2" />
      <rect x="39" y="14" width="22" height="16" fill="none" stroke="#e0533d" strokeWidth="2.4" />
      <rect x="47" y="36" width="6" height="8" fill="#9aa5b4" />
      <path d="M33 43 A17 4.2 0 0 1 67 43" fill="none" stroke="#b83a1c" strokeWidth="3.2" />
    </svg>
  );
}

/** 골대 앞쪽(림 앞쪽 반·그물) — 공보다 위에 그려서 공이 림을 "통과"해 그물로 떨어지는 것처럼 보이게 한다 */
function HoopFront({ hit, k }: { hit: 'good' | 'miss' | null; k: number }) {
  return (
    <svg viewBox="0 0 100 62" className="pointer-events-none absolute z-[5]" style={HOOP_BOX()} aria-hidden="true">
      <g
        key={k}
        className="wh-anim"
        style={{
          transformOrigin: '50px 43px',
          animation: hit === 'good' ? 'wh-swish .8s ease-out .62s both' : hit === 'miss' ? 'wh-rim .55s ease-out .4s both' : undefined,
        }}
      >
        <path d="M33 44 L39 62 M41 44 L44 62 M50 44 L50 62 M59 44 L56 62 M67 44 L61 62 M33 49 H67 M36 55 H64" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".95" />
        <path d="M33 43 A17 4.2 0 0 0 67 43" fill="none" stroke="#e8542c" strokeWidth="3.6" />
      </g>
    </svg>
  );
}

export default function WordHoops({ pairs, pictureQuestions, teams, shots, mode, rule, seconds }: Props) {
  const timed = rule === 'timed';
  const limitMs = seconds * 1000;
  const { t } = useTranslation();
  const sfx = useGameSfx('wordhoops');
  const [seed, setSeed] = useState(0);
  const pairsKey = mode === 'picture' ? JSON.stringify(pictureQuestions) : pairs.map((p) => `${p.id}:${p.left}:${p.right}`).join('|');
  const count = timed ? HOOPS_TIMED_POOL : shots;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const questions = useMemo(() => mode === 'picture' ? buildHoopsPictureQuestions(pictureQuestions ?? [], count) : buildHoopsQuestions(pairs, count, mode), [pairsKey, count, mode, seed]);
  const total = questions.length;

  const [phase, setPhase] = useState<Phase>('ready');
  const [ts, setTs] = useState<TeamState[]>(() => Array.from({ length: teams }, blank));
  const [ms, setMs] = useState(0);
  const tsRef = useRef(ts);
  const phaseRef = useRef<Phase>('ready');
  const startAt = useRef(0);
  const ticker = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const keyRef = useRef(0);

  const later = (fn: () => void, wait: number) => {
    timers.current.push(gameClock.setTimeout(fn, wait));
  };
  const clearAll = () => {
    timers.current.forEach((id) => gameClock.clearTimeout(id));
    timers.current = [];
    if (ticker.current !== null) gameClock.clearInterval(ticker.current);
    ticker.current = null;
  };
  useEffect(() => clearAll, []);

  function commit(next: TeamState[]) {
    tsRef.current = next;
    setTs(next);
  }
  function patch(team: number, p: Partial<TeamState>) {
    commit(tsRef.current.map((s, i) => (i === team ? { ...s, ...p } : s)));
  }
  function setPhaseBoth(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function reset() {
    clearAll();
    setSeed((s) => s + 1);
    commit(Array.from({ length: teams }, blank));
    setMs(0);
    setPhaseBoth('ready');
  }
  // 낱말·설정이 바뀌면 처음부터 다시 준비한다
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairsKey, teams, shots, mode, rule, seconds]);

  function start() {
    if (phaseRef.current !== 'ready' || total === 0) return;
    playSfx(COMMON_SFX.start);
    startAt.current = gameClock.now();
    setMs(0);
    setPhaseBoth('playing');
    ticker.current = gameClock.setInterval(() => {
      const elapsed = Math.round(gameClock.now() - startAt.current);
      if (timed && elapsed >= limitMs) {
        // 제한 시간이 끝나면 모든 팀이 한꺼번에 멈춘다(이미 들어간 슛은 점수에 남는다)
        if (ticker.current !== null) gameClock.clearInterval(ticker.current);
        ticker.current = null;
        setMs(limitMs);
        commit(tsRef.current.map((x) => (x.doneMs === null ? { ...x, doneMs: limitMs, busy: true } : x)));
        return;
      }
      setMs(elapsed);
    }, 100);
  }

  function advance(team: number) {
    const st = tsRef.current[team];
    const nextIdx = st.idx + 1;
    if (nextIdx >= total) {
      patch(team, { idx: nextIdx, busy: true, flash: null, shot: null, removed: [], misses: 0, doneMs: Math.round(gameClock.now() - startAt.current) });
    } else {
      patch(team, { idx: nextIdx, busy: false, flash: null, shot: null, removed: [], misses: 0 });
    }
  }

  function pick(team: number, ci: number) {
    if (phaseRef.current !== 'playing') return;
    const st = tsRef.current[team];
    if (!st || st.busy || st.doneMs !== null) return;
    const q = questions[st.idx];
    if (!q || ci >= q.choices.length || st.removed.includes(ci)) return;
    const key = ++keyRef.current;
    if (ci === q.correctIndex) {
      const pts = pointsForTry(st.misses + 1);
      later(() => playSfx(sfx.correct), 600);
      patch(team, {
        busy: true,
        points: st.points + pts,
        made: st.made + 1,
        firstTry: st.firstTry + (st.misses === 0 ? 1 : 0),
        shot: { choice: ci, hit: true, key },
        flash: { kind: 'good', text: pts >= 2 ? t('gameWordHoops.nice', { n: pts }) : t('gameWordHoops.goodRetry', { n: pts }), sub: q.explain, key },
      });
      later(() => advance(team), 2100);
      return;
    }
    const misses = st.misses + 1;
    later(() => playSfx(sfx.wrong), 420);
    if (misses >= HOOPS_MAX_MISSES) {
      patch(team, {
        busy: true,
        misses,
        removed: [...st.removed, ci],
        shot: { choice: ci, hit: false, key },
        flash: { kind: 'reveal', text: t('gameWordHoops.reveal', { a: q.choices[q.correctIndex] }), sub: q.explain, key },
      });
      later(() => advance(team), 2700);
      return;
    }
    patch(team, {
      misses,
      removed: [...st.removed, ci],
      shot: { choice: ci, hit: false, key },
      flash: { kind: 'miss', text: t('gameWordHoops.miss'), key },
    });
    later(() => {
      const cur = tsRef.current[team];
      if (cur.shot?.key === key) patch(team, { shot: null });
    }, 1550);
  }

  // 모든 팀이 끝나면 결과를 보여 준다
  useEffect(() => {
    if (phase !== 'playing' || total === 0) return;
    if (ts.length > 0 && ts.every((s) => s.doneMs !== null)) {
      if (ticker.current !== null) gameClock.clearInterval(ticker.current);
      ticker.current = null;
      later(() => {
        playSfx(sfx.finish);
        setPhaseBoth('done');
      }, 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ts, phase, total]);

  // 키보드: 빨강 팀 1·2·3, 파랑 팀 8·9·0, 시작은 Space/Enter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!gameKeyboardAllowed(e) || e.repeat) return;
      if (phaseRef.current === 'ready' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        start();
        return;
      }
      const red = ['1', '2', '3'].indexOf(e.key);
      const blue = ['8', '9', '0'].indexOf(e.key);
      if (red >= 0) pick(0, red);
      else if (blue >= 0 && teams > 1) pick(1, blue);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, teams, total]);

  const teamName = (i: number) => (teams === 1 ? t('gameWordHoops.solo') : i === 0 ? t('gameWordHoops.teamRed') : t('gameWordHoops.teamBlue'));

  const results: HoopsResult[] = ts.map((s, i) => ({ team: i, points: s.points, firstTry: s.firstTry, made: s.made, shots: total, ms: s.doneMs ?? ms }));
  const ranked = rankHoops(results, rule);
  const tie = isHoopsTie(results, rule);

  if (total === 0) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-2xl bg-surface-container-low p-8 text-center font-body-md text-on-surface-variant">
        {t('gameWordHoops.notEnough')}
      </div>
    );
  }

  return (
    <div
      className="relative w-full select-none overflow-hidden rounded-[2.4cqw] shadow-xl"
      style={{ containerType: 'inline-size', aspectRatio: '16 / 9', background: 'linear-gradient(180deg,#e9f1ea,#d3e3d6)' }}
    >
      <style>{css}</style>
      <div className="absolute inset-0 flex items-center justify-center" style={{ gap: '1.2cqw' }}>
        {ts.map((s, ti) => {
          const q = questions[Math.min(s.idx, total - 1)];
          const finished = s.doneMs !== null;
          const color = TEAM_COLORS[ti] ?? TEAM_COLORS[0];
          const elapsed = s.doneMs ?? ms;
          const promptSize = [...q.prompt].length <= 8 ? 9.5 : [...q.prompt].length <= 14 ? 7.2 : 5.4;
          return (
            <section
              key={ti}
              className="relative overflow-hidden"
              style={{ ['--u' as string]: `${COURT_W / 100}cqw`, width: `${COURT_W}cqw`, height: '56.25cqw', borderRadius: U(3), boxShadow: '0 .6cqw 1.6cqw rgba(0,0,0,.25)', border: `${'0.35cqw'} solid ${color}` } as CSSProperties}
              aria-label={teamName(ti)}
            >
              {/* 머리줄 */}
              <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between" style={{ height: U(11), background: color, padding: `0 ${U(3)}` }}>
                <span className="font-extrabold text-white" style={{ fontSize: U(5.4) }}>{teamName(ti)}</span>
                <span className="flex items-center" style={{ gap: U(2) }}>
                  {[
                    `${s.points}${t('gameWordHoops.pointsUnit')}`,
                    timed ? formatHoopsCountdown(limitMs - elapsed) : formatHoopsTime(elapsed),
                    timed ? t('gameWordHoops.madeChip', { n: s.made }) : t('gameWordHoops.shotOf', { n: Math.min(s.idx + 1, total), total }),
                  ].map((chip, ci) => (
                    <span key={ci} className={`rounded-full font-bold tabular-nums ${timed && ci === 1 && limitMs - elapsed <= 10000 ? 'bg-warm-yellow text-[#b3261e]' : 'bg-white/92 text-deep-navy'}`} style={{ fontSize: U(3.8), padding: `${U(0.7)} ${U(2)}` }}>
                      {chip}
                    </span>
                  ))}
                </span>
              </div>

              {/* 체육관 장면 */}
              <div className="absolute inset-x-0 bottom-0" style={{ top: U(11), background: 'linear-gradient(180deg,#a9cfb2 0%,#8fbd9c 100%)' }}>
                <div className="absolute inset-x-0" style={{ top: 0, height: U(60), background: 'repeating-linear-gradient(90deg,rgba(255,255,255,.12) 0 6%,rgba(0,0,0,0) 6% 12%)' }} />
                <div className="absolute inset-x-0 bottom-0" style={{ top: U(59), background: 'linear-gradient(180deg,#eacb90,#d6a65c)', borderTop: `${U(0.8)} solid #fff7e6` }} />
                <div className="absolute rounded-[50%]" style={{ left: U(14), right: U(14), top: U(62), height: U(52), border: `${U(0.8)} solid rgba(255,255,255,.85)` }} />
              </div>

              <HoopBack />
              <HoopFront hit={s.shot ? (s.shot.hit ? 'good' : 'miss') : null} k={s.shot?.key ?? 0} />

              {/* 문제 카드 */}
              {!finished && (
                <div
                  className="absolute z-[5] flex flex-col items-center justify-center bg-white text-center shadow-lg"
                  style={{ left: U(6), right: U(6), top: U(14.5), height: U(22), borderRadius: U(3) }}
                >
                  <span className="font-semibold text-on-surface-variant" style={{ fontSize: U(3.2) }}>
                    {q.dir === 'toMeaning' ? t('gameWordHoops.askMeaning') : t('gameWordHoops.askWord')}
                  </span>
                  {q.imageUrl ? (
                    <img data-picture-word src={q.imageUrl} alt={t('gameWordHoops.askWord')} draggable={false} className="object-contain" style={{ width: '88%', height: U(16) }} />
                  ) : <span className="flex items-center justify-center" style={{ gap: U(2) }}>
                    <span className="font-extrabold leading-tight text-deep-navy" style={{ fontSize: U(promptSize), wordBreak: 'keep-all' }}>{q.prompt}</span>
                    <button
                      type="button"
                      onClick={() => speak(q.speak)}
                      aria-label={t('gameWordHoops.listen')}
                      className="flex shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary hover:bg-primary hover:text-on-primary"
                      style={{ width: U(7.4), height: U(7.4), fontSize: U(4) }}
                    >
                      🔊
                    </button>
                  </span>}
                </div>
              )}

              {/* 말풍선 */}
              {s.flash && (
                <div
                  key={s.flash.key}
                  className="wh-anim pointer-events-none absolute z-[7] text-center font-extrabold shadow-lg"
                  style={{
                    left: '50%',
                    top: U(39),
                    transform: 'translateX(-50%)',
                    animation: `wh-pop .35s ease-out ${s.flash.kind === 'good' ? 0.95 : 0.55}s both`,
                    borderRadius: U(2.6),
                    padding: `${U(1.2)} ${U(3)}`,
                    maxWidth: U(92),
                    background: s.flash.kind === 'good' ? '#1f9d55' : s.flash.kind === 'miss' ? '#f08a24' : '#334155',
                    color: '#fff',
                    fontSize: U(5),
                  }}
                >
                  <div>{s.flash.text}</div>
                  {s.flash.sub && <div className="font-semibold opacity-90" style={{ fontSize: U(3.4) }}>{s.flash.sub}</div>}
                </div>
              )}

              {/* 공 */}
              {!finished &&
                q.choices.map((c, ci) => {
                  const isShot = s.shot && s.shot.choice === ci;
                  return (
                    <Ball
                      key={`${s.idx}-${ci}-${isShot ? s.shot?.key : 0}`}
                      label={c}
                      index={ci}
                      count={q.choices.length}
                      removed={s.removed.includes(ci)}
                      anim={isShot ? (s.shot?.hit ? 'hit' : 'miss') : null}
                      disabled={phase !== 'playing' || s.busy}
                      onPick={() => pick(ti, ci)}
                      gradId={`wh-ball-${ti}`}
                    />
                  );
                })}

              {finished && (
                <div className="absolute inset-0 z-[8] flex flex-col items-center justify-center bg-white/55 text-center font-extrabold text-deep-navy" style={{ paddingTop: U(11) }}>
                  <span style={{ fontSize: U(9) }}>🏀</span>
                  <span style={{ fontSize: U(6.4) }}>{timed ? t('gameWordHoops.timeUp') : t('gameWordHoops.teamDone')}</span>
                  <span className="font-semibold" style={{ fontSize: U(4) }}>{s.points}{t('gameWordHoops.pointsUnit')} · {timed ? t('gameWordHoops.madeChip', { n: s.made }) : formatHoopsTime(s.doneMs ?? 0)}</span>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {phase === 'ready' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-deep-navy/55 text-center text-white" style={{ gap: '1.4cqw' }}>
          <span style={{ fontSize: '7cqw' }}>🏀</span>
          <span className="font-extrabold" style={{ fontSize: '3.8cqw' }}>{t('gameWordHoops.readyTitle')}</span>
          <span className="max-w-[70%] font-semibold opacity-95" style={{ fontSize: '1.9cqw' }}>{timed ? t('gameWordHoops.readyHintTimed', { time: formatHoopsCountdown(limitMs) }) : teams > 1 ? t('gameWordHoops.readyHintTeams') : t('gameWordHoops.readyHintSolo')}</span>
          <button
            type="button"
            data-initial-game-start onClick={start}
            className="rounded-full bg-warm-yellow font-extrabold text-deep-navy shadow-xl transition-transform hover:scale-105 active:scale-95"
            style={{ fontSize: '3cqw', padding: '1cqw 5cqw' }}
          >
            {t('flow.start')}
          </button>
          <span className="font-medium opacity-80" style={{ fontSize: '1.4cqw' }}>{t('gameWordHoops.keys')}</span>
        </div>
      )}

      {phase === 'done' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden bg-[#fff8e6]/96 text-center" style={{ gap: '1.4cqw' }}>
          {Array.from({ length: 24 }, (_, i) => (
            <span
              key={i}
              className="wh-anim pointer-events-none absolute top-0"
              style={{
                left: `${(i * 37) % 100}%`,
                width: '1cqw',
                height: '1.6cqw',
                background: ['#ef5b5b', '#3b82f6', '#fbbf24', '#22a559'][i % 4],
                animation: `wh-confetti ${2.6 + (i % 5) * 0.4}s linear ${(i % 7) * 0.25}s infinite`,
              }}
            />
          ))}
          <span style={{ fontSize: '5cqw' }}>🏅</span>
          <span className="font-extrabold text-deep-navy" style={{ fontSize: '4cqw' }}>
            {teams === 1 ? t('gameWordHoops.soloDone') : tie ? t('gameWordHoops.tie') : t('gameWordHoops.winner', { team: teamName(ranked[0].team) })}
          </span>
          <span className="font-semibold text-on-surface-variant" style={{ fontSize: '1.9cqw' }}>
            {teams === 1 ? t('gameWordHoops.soloCheer') : t('gameWordHoops.cheer')}
          </span>
          <div className="flex" style={{ gap: '2cqw' }}>
            {ts.map((_s, i) => {
              const r = results[i];
              const top = teams > 1 && !tie && ranked[0].team === i;
              return (
                <div key={i} className="overflow-hidden bg-white text-left shadow-lg" style={{ width: '24cqw', borderRadius: '1.4cqw', border: `.3cqw solid ${top ? '#f5b301' : '#e5e7eb'}` }}>
                  <div className="font-extrabold text-white" style={{ background: TEAM_COLORS[i], fontSize: '2cqw', padding: '.7cqw 1.6cqw' }}>
                    {teamName(i)} {top && '🏆'}
                  </div>
                  <div className="font-extrabold tabular-nums text-deep-navy" style={{ fontSize: '4.2cqw', padding: '.6cqw 1.6cqw 0' }}>
                    {r.points}
                    <span className="font-semibold text-on-surface-variant" style={{ fontSize: '1.8cqw' }}>{timed ? t('gameWordHoops.pointsUnit') : ` / ${total * pointsForTry(1)}${t('gameWordHoops.pointsUnit')}`}</span>
                  </div>
                  <div className="text-on-surface-variant" style={{ fontSize: '1.55cqw', padding: '.4cqw 1.6cqw 1.2cqw' }}>
                    {timed ? (
                      <>
                        <div>{t('gameWordHoops.madeLabel')}: <b className="text-deep-navy">{t('gameWordHoops.madeCount', { n: r.made })}</b></div>
                        <div>{t('gameWordHoops.firstTryLabel')}: <b className="text-deep-navy">{r.firstTry}{t('gameWordHoops.countUnit')}</b></div>
                      </>
                    ) : (
                      <>
                        <div>{t('gameWordHoops.accuracy')}: <b className="text-deep-navy">{Math.round((r.firstTry / total) * 100)}%</b> ({r.firstTry}/{total})</div>
                        <div>{t('gameWordHoops.time')}: <b className="text-deep-navy tabular-nums">{formatHoopsTime(r.ms)}</b></div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-primary font-extrabold text-on-primary shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ fontSize: '2.2cqw', padding: '.8cqw 3.4cqw' }}
          >
            {t('gameWordHoops.playAgain')}
          </button>
        </div>
      )}
    </div>
  );
}
