import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { gameClock } from '../lib/gameClock';
import { gameKeyboardAllowed } from '../lib/gameKeyboard';
import { COMMON_SFX, playSfx, useGameSfx } from '../lib/gameSfx';
import {
  buildTugDeck,
  formatTugClock,
  tugAccuracy,
  tugKnotPercent,
  tugSuddenWinner,
  tugWinner,
  type TugShown,
} from '../lib/tugOfWar';
import type { QuizQuestion } from '../lib/types';

/**
 * 줄다리기 대결(2026-11-08) — 두 팀이 같은 문제 묶음을 각자 따로 풀고, 맞히면 줄이 우리 쪽으로 한 칸 당겨지며
 * 틀리면 그 팀만 얼음(기본 3초) 동안 답할 수 없다. 화면 크기는 전부 루트 폭(cqw)으로 잰다.
 * 시간은 gameClock(교사 일시정지가 멈춰 주는 시계)으로 잰다. 규칙·승패는 lib/tugOfWar.ts.
 * 그림은 구글 AI 점토 화풍(public/skins/tug/*.webp, 만든 법: app/scripts/vocab/out/tug/jobs-*.json → gemini-image.mjs → cut.py).
 */

interface Props {
  questions: QuizQuestion[];
  pull: number;
  freeze: number;
  seconds: number;
}

type Phase = 'ready' | 'playing' | 'done';

interface Flash {
  kind: 'good' | 'bad';
  choice: number;
  key: number;
}

interface Side {
  idx: number;
  removed: number[];
  frozenUntil: number;
  locked: boolean;
  correct: number;
  wrong: number;
  flash: Flash | null;
}

interface Pulse {
  team: 0 | 1;
  key: number;
}

const IMG = '/skins/tug/';
const TEAM_COLORS = ['#2f62d1', '#d64545'];
const TEAM_LIGHT = ['#4d86f0', '#ef6a5e'];
const TEAM_DARK = ['#173a86', '#8e2525'];
/** 줄 매듭에서 각 아이 주먹까지의 거리(cqw) — 안쪽 아이부터 */
const FIST_X = [4.6, 13.2, 21.8];
const KID_BOTTOM = 3.6;
const PULL_H = 13.5;
const CHEER_H = 12.2;
const FALL_H = 10.8;
const FINISH_WIDTH = 44;
const KEY_LABELS = [['1', '2', '3', '4'], ['7', '8', '9', '0']];

const STYLE = `
@keyframes tw-strain { 0%{transform:translateX(0) rotate(0)} 50%{transform:translateX(-.3cqw) rotate(-1.4deg)} 100%{transform:translateX(.1cqw) rotate(.6deg)} }
@keyframes tw-yank-win { 0%{transform:rotate(0) translateX(0)} 28%{transform:rotate(-7deg) translateX(-1cqw)} 100%{transform:rotate(0) translateX(0)} }
@keyframes tw-yank-lose { 0%{transform:rotate(0) translateX(0)} 28%{transform:rotate(6deg) translateX(1cqw)} 100%{transform:rotate(0) translateX(0)} }
@keyframes tw-puff { 0%{transform:translate(0,0) scale(.3);opacity:.9} 100%{transform:translate(var(--dx),-3.4cqw) scale(1.8);opacity:0} }
@keyframes tw-blade { 0%{transform:translate(0,0) rotate(0);opacity:1} 100%{transform:translate(var(--dx),-5cqw) rotate(var(--rot));opacity:0} }
@keyframes tw-rise { 0%{transform:translate(-50%,0) scale(.5);opacity:0} 22%{transform:translate(-50%,-1.2cqw) scale(1.18);opacity:1} 100%{transform:translate(-50%,-6.5cqw) scale(1);opacity:0} }
@keyframes tw-bump { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-.4cqw)} 60%{transform:translateX(.32cqw)} }
@keyframes tw-rope { 0%,100%{transform:translateY(0)} 50%{transform:translateY(.14cqw)} }
@keyframes tw-taut { 0%{transform:scaleY(1)} 22%{transform:scaleY(.7)} 100%{transform:scaleY(1)} }
@keyframes tw-ribbon { 0%,100%{transform:rotate(-6deg)} 50%{transform:rotate(6deg)} }
@keyframes tw-flagwave { 0%,100%{transform:skewY(0) scaleX(1)} 50%{transform:skewY(-3.5deg) scaleX(.95)} }
@keyframes tw-hop { 0%,100%{transform:translateY(0) scaleY(1)} 18%{transform:translateY(0) scaleY(.92)} 55%{transform:translateY(-3.2cqw) scaleY(1.04)} }
@keyframes tw-drop { 0%{transform:translateY(-4cqw) rotate(-12deg);opacity:0} 50%{transform:translateY(0) rotate(4deg);opacity:1} 72%{transform:translateY(-1cqw) rotate(-1deg)} 100%{transform:translateY(0) rotate(0)} }
@keyframes tw-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-.7cqw)} 40%{transform:translateX(.7cqw)} 60%{transform:translateX(-.5cqw)} 80%{transform:translateX(.4cqw)} }
@keyframes tw-pop { 0%{transform:translateX(-50%) scale(.4);opacity:0} 60%{transform:translateX(-50%) scale(1.1);opacity:1} 100%{transform:translateX(-50%) scale(1);opacity:1} }
@keyframes tw-trophy { 0%{transform:translateX(-50%) translateY(3cqw) scale(.2);opacity:0} 65%{transform:translateX(-50%) translateY(-1cqw) scale(1.15);opacity:1} 100%{transform:translateX(-50%) translateY(0) scale(1);opacity:1} }
@keyframes tw-confetti { 0%{transform:translateY(-10%) rotate(0);opacity:1} 100%{transform:translateY(130%) rotate(540deg);opacity:.9} }
@keyframes tw-spin { to{transform:rotate(360deg)} }
@keyframes tw-wobble { 0%,100%{transform:rotate(-6deg) scale(1)} 50%{transform:rotate(6deg) scale(1.06)} }
@keyframes tw-ice-in { 0%{opacity:0;transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
.tw-root img { max-width: none; }
@media (prefers-reduced-motion: reduce) { .tw-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

function blank(): Side {
  return { idx: 0, removed: [], frozenUntil: 0, locked: false, correct: 0, wrong: 0, flash: null };
}

type KidMode = 'pull' | 'cheer' | 'fall';

/**
 * 줄을 잡은 아이(점토 그림). 팀 0은 오른쪽(줄 쪽)을 보고 서고, 팀 1은 같은 그림을 좌우로 뒤집어 왼쪽을 본다.
 * 층: 위치·기울기(wrapper) > 좌우 뒤집기(flip) > 당길 때 반동(jerk) > 그림(strain)
 */
function Kid({ team, n, lean, mode, pulse }: { team: 0 | 1; n: number; lean: number; mode: KidMode; pulse: Pulse | null }) {
  const id = `${team === 0 ? 'b' : 'r'}${n + 1}`;
  const x = FIST_X[n];
  const h = mode === 'cheer' ? CHEER_H : mode === 'fall' ? FALL_H : PULL_H;
  const src = `${IMG}${mode}-${id}.webp`;
  const wrapper: CSSProperties = {
    position: 'absolute',
    bottom: `${KID_BOTTOM}cqw`,
    transformOrigin: '50% 100%',
    transform: mode === 'pull' ? `rotate(${team === 0 ? -lean : lean}deg)` : undefined,
    transition: 'transform .5s cubic-bezier(.3,1.4,.5,1)',
    zIndex: 3 - n,
  };
  if (mode === 'cheer') {
    const c = x - 4.45;
    wrapper.left = `calc(${team === 0 ? -c : c}cqw - ${(h * 0.86) / 2}cqw)`;
  } else {
    const edge = mode === 'fall' ? x - 1.5 : x;
    if (team === 0) wrapper.right = `${edge}cqw`;
    else wrapper.left = `${edge}cqw`;
  }
  const yank = mode === 'pull' && pulse ? (pulse.team === team ? 'tw-yank-win' : 'tw-yank-lose') : undefined;
  const imgAnim =
    mode === 'pull'
      ? `tw-strain ${0.8 + n * 0.13}s ease-in-out ${n * 0.17}s infinite alternate`
      : mode === 'cheer'
        ? `tw-hop .75s ease-in-out ${n * 0.13}s infinite`
        : `tw-drop .8s ease-out ${n * 0.12}s both`;
  return (
    <div className="tw-anim" style={wrapper}>
      <div style={{ transform: team === 1 && mode !== 'cheer' ? 'scaleX(-1)' : undefined }}>
        <div key={pulse?.key ?? 0} className="tw-anim" style={{ transformOrigin: '50% 100%', animation: yank ? `${yank} .5s ease-out` : undefined }}>
          <div
            className="absolute left-1/2 rounded-[50%]"
            style={{ bottom: '-.7cqw', width: `${h * 0.62}cqw`, height: '1.6cqw', marginLeft: `${-h * 0.31}cqw`, background: 'rgba(30,60,20,.28)', filter: 'blur(.25cqw)' }}
          />
          <img
            src={src}
            alt=""
            draggable={false}
            className="tw-anim relative block"
            style={{ height: `${h}cqw`, width: 'auto', transformOrigin: '50% 100%', animation: imgAnim, filter: 'drop-shadow(0 .45cqw .35cqw rgba(0,0,0,.22))' }}
          />
        </div>
      </div>
    </div>
  );
}

function TeamChip({ team, name, pulls }: { team: 0 | 1; name: string; pulls: string }) {
  return (
    <div
      className="flex items-center rounded-full font-extrabold text-white shadow-lg"
      style={{ background: `linear-gradient(180deg,${TEAM_LIGHT[team]},${TEAM_COLORS[team]})`, fontSize: '2cqw', padding: '.5cqw 1.8cqw', gap: '1.2cqw', border: '.2cqw solid rgba(255,255,255,.55)' }}
    >
      <span>{name}</span>
      <span className="rounded-full bg-white/95 tabular-nums" style={{ color: TEAM_DARK[team], fontSize: '1.8cqw', padding: '.1cqw 1.1cqw' }}>
        {pulls}
      </span>
    </div>
  );
}

function fontFor(text: string, big: number, mid: number, small: number): number {
  const len = [...text].length;
  return len <= 12 ? big : len <= 28 ? mid : small;
}

export default function TugOfWar({ questions, pull, freeze, seconds }: Props) {
  const { t } = useTranslation();
  const sfx = useGameSfx('tugofwar');
  const timed = seconds > 0;
  const limitMs = seconds * 1000;
  const [seed, setSeed] = useState(0);
  const qKey = questions.map((q) => `${q.id}:${q.question}:${q.choices.join('/')}:${q.correctIndex}`).join('|');
  // 팀마다 따로 만든 문제 순서·보기 배치
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const decks = useMemo<TugShown[][]>(() => [buildTugDeck(questions), buildTugDeck(questions)], [qKey, seed]);
  const playable = decks[0].length > 0;

  const [phase, setPhase] = useState<Phase>('ready');
  const [sides, setSides] = useState<Side[]>([blank(), blank()]);
  const [pos, setPos] = useState(0);
  const [tick, setTick] = useState(0);
  const [sudden, setSudden] = useState(false);
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const phaseRef = useRef<Phase>('ready');
  const sidesRef = useRef(sides);
  const posRef = useRef(0);
  const suddenRef = useRef(false);
  const winnerRef = useRef<0 | 1 | null>(null);
  const startAt = useRef(0);
  const ticker = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const keyRef = useRef(0);
  const tickFn = useRef<() => void>(() => undefined);

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

  function commitSides(next: Side[]) {
    sidesRef.current = next;
    setSides(next);
  }
  function patchSide(team: number, p: Partial<Side>) {
    commitSides(sidesRef.current.map((s, i) => (i === team ? { ...s, ...p } : s)));
  }
  function setPhaseBoth(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  function reset() {
    clearAll();
    setSeed((s) => s + 1);
    commitSides([blank(), blank()]);
    posRef.current = 0;
    setPos(0);
    suddenRef.current = false;
    setSudden(false);
    winnerRef.current = null;
    setWinner(null);
    setPulse(null);
    setTick(0);
    setPhaseBoth('ready');
  }
  // 문제·설정이 바뀌면 처음부터 다시 준비한다
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey, pull, freeze, seconds]);

  function finish(w: 0 | 1) {
    if (winnerRef.current !== null) return;
    winnerRef.current = w;
    setWinner(w);
    if (ticker.current !== null) gameClock.clearInterval(ticker.current);
    ticker.current = null;
    later(() => {
      playSfx(sfx.finish);
      setPhaseBoth('done');
    }, 2000);
  }

  tickFn.current = () => {
    const now = gameClock.now();
    setTick(now);
    if (timed && !suddenRef.current && winnerRef.current === null && now - startAt.current >= limitMs) {
      const w = tugWinner(posRef.current, pull, true);
      if (w !== null) finish(w);
      else {
        suddenRef.current = true;
        setSudden(true);
        playSfx(COMMON_SFX.yourTurn);
      }
    }
  };

  function start() {
    if (phaseRef.current !== 'ready' || !playable) return;
    playSfx(COMMON_SFX.start);
    startAt.current = gameClock.now();
    setTick(startAt.current);
    setPhaseBoth('playing');
    ticker.current = gameClock.setInterval(() => tickFn.current(), 100);
  }

  function advance(team: number) {
    patchSide(team, { idx: sidesRef.current[team].idx + 1, removed: [], locked: false, flash: null });
  }

  function choose(team: 0 | 1, ci: number) {
    if (phaseRef.current !== 'playing' || winnerRef.current !== null) return;
    const side = sidesRef.current[team];
    const now = gameClock.now();
    if (side.locked || now < side.frozenUntil) return;
    const q = decks[team][side.idx % decks[team].length];
    if (!q || ci >= q.choices.length || side.removed.includes(ci)) return;
    const key = ++keyRef.current;
    if (ci === q.correctIndex) {
      playSfx(sfx.pull);
      const next = posRef.current + (team === 0 ? 1 : -1);
      posRef.current = next;
      setPos(next);
      setPulse({ team, key });
      patchSide(team, { correct: side.correct + 1, locked: true, flash: { kind: 'good', choice: ci, key } });
      const w = suddenRef.current ? tugSuddenWinner(next) : tugWinner(next, pull, false);
      if (w !== null) finish(w);
      else later(() => advance(team), 520);
      return;
    }
    playSfx(sfx.wrong);
    patchSide(team, {
      wrong: side.wrong + 1,
      removed: [...side.removed, ci],
      frozenUntil: now + freeze * 1000,
      flash: { kind: 'bad', choice: ci, key },
    });
    later(() => {
      const cur = sidesRef.current[team];
      if (cur.flash?.key === key) patchSide(team, { flash: null });
    }, 700);
  }

  // 키보드: 파랑 팀 1·2·3·4, 빨강 팀 7·8·9·0, 시작은 Space/Enter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!gameKeyboardAllowed(e) || e.repeat) return;
      if (phaseRef.current === 'ready' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        start();
        return;
      }
      const blue = ['1', '2', '3', '4'].indexOf(e.key);
      const red = ['7', '8', '9', '0'].indexOf(e.key);
      if (blue >= 0) choose(0, blue);
      else if (red >= 0) choose(1, red);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks, pull, freeze, playable]);

  const teamName = (i: number) => (i === 0 ? t('gameTugOfWar.teamBlue') : t('gameTugOfWar.teamRed'));
  const knot = tugKnotPercent(pos, pull, FINISH_WIDTH);
  const remainingMs = phase === 'ready' ? limitMs : limitMs - Math.max(0, tick - startAt.current);
  const urgent = timed && phase === 'playing' && remainingMs <= 10000;

  if (!playable) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-2xl bg-surface-container-low p-8 text-center font-body-md text-on-surface-variant">
        {t('gameTugOfWar.notEnough')}
      </div>
    );
  }

  return (
    <div
      className="tw-root relative w-full select-none overflow-hidden rounded-[2.4cqw] shadow-xl"
      style={{ containerType: 'inline-size', aspectRatio: '16 / 9', background: 'linear-gradient(180deg,#14284d,#0e1c38)' }}
    >
      <style>{STYLE}</style>

      {/* 줄다리기 장면(운동장 그림 위에서 줄과 아이들이 매듭을 따라 함께 움직인다) */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: '1cqw',
          right: '1cqw',
          top: 0,
          height: '26.2cqw',
          borderRadius: '0 0 2cqw 2cqw',
          backgroundImage: `url(${IMG}scene.webp)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 63%',
          boxShadow: '0 .5cqw 1.4cqw rgba(0,0,0,.35)',
        }}
      >
        <div key={`bump-${pulse?.key ?? 0}`} className="tw-anim absolute inset-0" style={{ animation: pulse ? 'tw-bump .36s ease-out' : undefined }}>
          {/* 양쪽 끝 응원 깃발 */}
          {[0, 1].map((i) => (
            <img
              key={`flag-${i}`}
              src={`${IMG}${i === 0 ? 'flag-blue' : 'flag-red'}.webp`}
              alt=""
              draggable={false}
              className="tw-anim absolute block"
              style={{
                left: i === 0 ? '1.2%' : undefined,
                right: i === 1 ? '1.2%' : undefined,
                bottom: '5.6cqw',
                height: '11cqw',
                width: 'auto',
                transform: i === 1 ? 'scaleX(-1)' : undefined,
                transformOrigin: '50% 100%',
                filter: 'drop-shadow(0 .4cqw .3cqw rgba(0,0,0,.25))',
              }}
            />
          ))}

          {/* 승리 선: 매듭이 여기까지 오면 그 팀이 이긴다 */}
          {[0, 1].map((i) => (
            <div key={`goal-${i}`} className="absolute" style={{ left: `${i === 0 ? 50 - FINISH_WIDTH / 2 : 50 + FINISH_WIDTH / 2}%`, bottom: 0, width: 0, height: '9.2cqw' }}>
              <div
                className="absolute"
                style={{ left: '-.4cqw', width: '.8cqw', top: 0, bottom: 0, background: `linear-gradient(180deg,${TEAM_COLORS[i]}cc,${TEAM_COLORS[i]}55)`, borderRadius: '.4cqw' }}
              />
              <span
                className="absolute font-extrabold text-white"
                style={{ bottom: '.5cqw', left: '50%', transform: 'translateX(-50%)', background: TEAM_COLORS[i], fontSize: '1.2cqw', padding: '.15cqw .8cqw', borderRadius: '.6cqw', whiteSpace: 'nowrap', border: '.15cqw solid rgba(255,255,255,.75)', zIndex: 5 }}
              >
                {t('gameTugOfWar.goal')}
              </span>
            </div>
          ))}

          <div className="absolute inset-y-0" style={{ left: `${knot}%`, width: 0, transition: 'left .6s cubic-bezier(.3,1.45,.5,1)' }}>
            {/* 줄 */}
            <div key={`taut-${pulse?.key ?? 0}`} className="tw-anim absolute" style={{ left: '-27cqw', width: '54cqw', height: '2.4cqw', bottom: '9.15cqw', zIndex: 1, animation: pulse ? 'tw-taut .5s ease-out' : undefined }}>
              <img
                src={`${IMG}rope.webp`}
                alt=""
                draggable={false}
                className="tw-anim block h-full w-full"
                style={{ objectFit: 'fill', animation: 'tw-rope 1.5s ease-in-out infinite', filter: 'drop-shadow(0 .35cqw .2cqw rgba(0,0,0,.28))' }}
              />
            </div>
            {/* 줄 가운데 리본 */}
            <img
              src={`${IMG}ribbon.webp`}
              alt=""
              draggable={false}
              className="tw-anim absolute block"
              style={{ left: '-1.75cqw', width: '3.5cqw', height: 'auto', bottom: '4.4cqw', zIndex: 4, transformOrigin: '50% 6%', animation: 'tw-ribbon 1.6s ease-in-out infinite', filter: 'drop-shadow(0 .3cqw .2cqw rgba(0,0,0,.25))' }}
            />
            {[0, 1].map((team) =>
              [2, 1, 0].map((n) => {
                const lead = team === 0 ? pos : -pos;
                const lean = Math.max(-3, Math.min(14, 3 + lead * 2.4));
                const mode: KidMode = winner === null ? 'pull' : winner === team ? 'cheer' : 'fall';
                return <Kid key={`${team}-${n}`} team={team as 0 | 1} n={n} lean={lean} mode={mode} pulse={pulse} />;
              }),
            )}

            {/* 당길 때 먼지·풀잎·+1 */}
            {pulse && (
              <div key={pulse.key} className="pointer-events-none absolute inset-0" style={{ zIndex: 6 }}>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <span
                    key={d}
                    className="tw-anim absolute rounded-full"
                    style={{
                      left: `${(pulse.team === 0 ? -1 : 1) * (7 + d * 3.6)}cqw`,
                      bottom: `${KID_BOTTOM - 0.6}cqw`,
                      width: `${1.5 + (d % 3) * 0.5}cqw`,
                      height: `${1.5 + (d % 3) * 0.5}cqw`,
                      background: 'radial-gradient(circle at 35% 35%,#fffaf0,#e6d6b0 70%,rgba(230,214,176,0))',
                      ['--dx' as string]: `${(pulse.team === 0 ? -1 : 1) * (1 + d * 0.45)}cqw`,
                      animation: `tw-puff .75s ease-out ${d * 0.04}s both`,
                    }}
                  />
                ))}
                {[0, 1, 2, 3].map((d) => (
                  <span
                    key={`g${d}`}
                    className="tw-anim absolute"
                    style={{
                      left: `${(pulse.team === 0 ? -1 : 1) * (9 + d * 5)}cqw`,
                      bottom: `${KID_BOTTOM}cqw`,
                      width: '.5cqw',
                      height: '1.1cqw',
                      background: '#4fa741',
                      borderRadius: '.3cqw',
                      ['--dx' as string]: `${(pulse.team === 0 ? -1 : 1) * (1.5 + d)}cqw`,
                      ['--rot' as string]: `${(d % 2 ? 1 : -1) * (120 + d * 40)}deg`,
                      animation: `tw-blade .8s ease-out ${d * 0.05}s both`,
                    }}
                  />
                ))}
                <span
                  className="tw-anim absolute rounded-full font-extrabold text-white"
                  style={{
                    left: `${(pulse.team === 0 ? -1 : 1) * 13}cqw`,
                    bottom: '12.5cqw',
                    background: TEAM_COLORS[pulse.team],
                    fontSize: '2.6cqw',
                    padding: '.2cqw 1.4cqw',
                    border: '.25cqw solid #fff',
                    boxShadow: '0 .3cqw .8cqw rgba(0,0,0,.35)',
                    animation: 'tw-rise .9s ease-out both',
                  }}
                >
                  +1
                </span>
              </div>
            )}
          </div>

          {/* 이긴 팀 트로피와 색종이 */}
          {winner !== null && (
            <>
              <img
                src={`${IMG}trophy.webp`}
                alt=""
                draggable={false}
                className="tw-anim absolute block"
                style={{ left: `${winner === 0 ? 14 : 86}%`, bottom: '14.5cqw', height: '8cqw', width: 'auto', animation: 'tw-trophy .7s ease-out .3s both', filter: 'drop-shadow(0 .5cqw .4cqw rgba(0,0,0,.3))', zIndex: 8 }}
              />
              {Array.from({ length: 18 }, (_, i) => (
                <span
                  key={i}
                  className="tw-anim pointer-events-none absolute top-0"
                  style={{
                    left: `${(winner === 0 ? 2 : 52) + ((i * 29) % 46)}%`,
                    width: '.9cqw',
                    height: '1.5cqw',
                    background: ['#ef5b5b', '#3b82f6', '#fbbf24', '#22a559'][i % 4],
                    animation: `tw-confetti ${2.2 + (i % 5) * 0.35}s linear ${(i % 6) * 0.2}s infinite`,
                  }}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* 위쪽 줄: 팀 이름·당긴 횟수·남은 시간 */}
      <div
        className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between"
        style={{ height: '6cqw', padding: '0 1.8cqw', background: 'linear-gradient(180deg,rgba(14,28,56,.82),rgba(14,28,56,0))' }}
      >
        <TeamChip team={0} name={teamName(0)} pulls={t('gameTugOfWar.pulls', { n: sides[0].correct })} />
        <div
          className={`rounded-full font-extrabold tabular-nums shadow-lg ${urgent || sudden ? 'bg-warm-yellow text-[#b3261e]' : 'bg-white/95 text-deep-navy'}`}
          style={{ fontSize: '2.2cqw', padding: '.4cqw 2.4cqw', border: '.2cqw solid rgba(255,255,255,.7)' }}
        >
          {sudden ? t('gameTugOfWar.suddenChip') : timed ? formatTugClock(remainingMs) : t('gameTugOfWar.noLimit')}
        </div>
        <TeamChip team={1} name={teamName(1)} pulls={t('gameTugOfWar.pulls', { n: sides[1].correct })} />
      </div>

      {/* 팀 패널 */}
      {[0, 1].map((team) => {
        const side = sides[team];
        const deck = decks[team];
        const q = deck[side.idx % deck.length];
        const remaining = Math.max(0, side.frozenUntil - tick);
        const frozen = phase === 'playing' && remaining > 0;
        return (
          <section
            key={team}
            className="absolute overflow-hidden"
            style={{
              top: '27.4cqw',
              [team === 0 ? 'left' : 'right']: '1cqw',
              width: '48.4cqw',
              height: '28.2cqw',
              borderRadius: '1.8cqw',
              background: `linear-gradient(180deg,${TEAM_LIGHT[team]},${TEAM_DARK[team]})`,
              boxShadow: '0 .5cqw 1.4cqw rgba(0,0,0,.4), inset 0 .25cqw 0 rgba(255,255,255,.4)',
            }}
            aria-label={teamName(team)}
          >
            <div className="absolute left-[1.6cqw] top-[.9cqw] font-extrabold text-white" style={{ fontSize: '1.8cqw', textShadow: '0 .15cqw .3cqw rgba(0,0,0,.35)' }}>
              {teamName(team)}
            </div>
            <div className="absolute right-[1.6cqw] top-[1.1cqw] font-bold tabular-nums text-white/85" style={{ fontSize: '1.4cqw' }}>
              {t('gameTugOfWar.keysHint', { keys: KEY_LABELS[team].join('·') })}
            </div>
            <div
              className="absolute flex items-center justify-center bg-white text-center"
              style={{ left: '1.6cqw', right: '1.6cqw', top: '3.6cqw', height: '9.4cqw', borderRadius: '1.4cqw', padding: '0 1.6cqw', boxShadow: '0 .45cqw 0 rgba(0,0,0,.18), 0 .7cqw 1.2cqw rgba(0,0,0,.18)' }}
            >
              <span className="font-extrabold leading-tight text-deep-navy" style={{ fontSize: `${fontFor(q.question, 3.4, 2.7, 2.1)}cqw`, wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>
                {q.question}
              </span>
            </div>
            <div className="absolute grid grid-cols-2" style={{ left: '1.6cqw', right: '1.6cqw', top: '13.9cqw', bottom: '1.3cqw', gap: '.9cqw' }}>
              {q.choices.map((c, ci) => {
                const removed = side.removed.includes(ci);
                const flashed = side.flash && side.flash.choice === ci ? side.flash : null;
                const bg = flashed?.kind === 'good' ? '#1f9d55' : flashed?.kind === 'bad' ? '#e0533d' : '#ffffff';
                const fg = flashed ? '#fff' : '#102b50';
                return (
                  <button
                    key={`${side.idx}-${ci}`}
                    type="button"
                    disabled={phase !== 'playing' || removed || side.locked || frozen}
                    onClick={() => choose(team as 0 | 1, ci)}
                    className="tw-anim relative flex items-center justify-center font-extrabold leading-tight transition-transform enabled:hover:-translate-y-[.15cqw] enabled:active:translate-y-[.3cqw]"
                    style={{
                      background: bg,
                      color: fg,
                      borderRadius: '1.2cqw',
                      fontSize: `${fontFor(c, 2.5, 2, 1.55)}cqw`,
                      opacity: removed && !flashed ? 0.38 : 1,
                      textDecoration: removed && !flashed ? 'line-through' : undefined,
                      animation: flashed?.kind === 'bad' ? 'tw-shake .45s ease-in-out' : undefined,
                      padding: '0 .8cqw 0 3.3cqw',
                      wordBreak: 'keep-all',
                      boxShadow: flashed ? '0 .25cqw 0 rgba(0,0,0,.25)' : '0 .4cqw 0 #c3cfe6, 0 .6cqw .9cqw rgba(0,0,0,.18)',
                    }}
                  >
                    <span
                      className="absolute flex items-center justify-center rounded-full font-extrabold text-white"
                      style={{ left: '.8cqw', top: '50%', marginTop: '-1.2cqw', width: '2.4cqw', height: '2.4cqw', fontSize: '1.4cqw', background: flashed ? 'rgba(255,255,255,.3)' : TEAM_COLORS[team] }}
                    >
                      {flashed?.kind === 'good' ? '✓' : flashed?.kind === 'bad' ? '✕' : KEY_LABELS[team][ci]}
                    </span>
                    {c}
                  </button>
                );
              })}
            </div>

            {frozen && (
              <div
                className="absolute inset-0 z-[6] flex flex-col items-center justify-center overflow-hidden text-center"
                style={{ background: 'radial-gradient(circle at 30% 18%,rgba(244,252,255,.97),rgba(132,196,243,.94))', animation: 'tw-ice-in .25s ease-out', boxShadow: 'inset 0 0 3cqw rgba(255,255,255,.9)' }}
              >
                <img src={`${IMG}ice.webp`} alt="" draggable={false} className="tw-anim absolute" style={{ left: '-2.4cqw', top: '-2.6cqw', width: '11cqw', opacity: 0.5, animation: 'tw-spin 16s linear infinite' }} />
                <img src={`${IMG}ice.webp`} alt="" draggable={false} className="tw-anim absolute" style={{ right: '-3cqw', bottom: '-3.4cqw', width: '13cqw', opacity: 0.45, animation: 'tw-spin 20s linear infinite reverse' }} />
                <img src={`${IMG}ice.webp`} alt="" draggable={false} className="tw-anim absolute" style={{ right: '5cqw', top: '2cqw', width: '4cqw', opacity: 0.6, animation: 'tw-wobble 2.2s ease-in-out infinite' }} />
                <img src={`${IMG}ice.webp`} alt="" draggable={false} className="tw-anim relative" style={{ width: '5.4cqw', animation: 'tw-wobble 1.4s ease-in-out infinite', filter: 'drop-shadow(0 .4cqw .4cqw rgba(20,80,140,.35))' }} />
                <span className="relative font-extrabold text-[#17558f]" style={{ fontSize: '3cqw', textShadow: '0 .2cqw 0 #fff' }}>{t('gameTugOfWar.frozen')}</span>
                <span className="relative font-extrabold tabular-nums text-[#0d3d6b]" style={{ fontSize: '8cqw', lineHeight: 1, textShadow: '0 .3cqw 0 #fff, 0 0 1.2cqw rgba(255,255,255,.9)' }}>{Math.ceil(remaining / 1000)}</span>
                <span className="relative font-semibold text-[#17558f]" style={{ fontSize: '1.6cqw' }}>{t('gameTugOfWar.frozenHint', { n: freeze })}</span>
                <div className="absolute bottom-[1.4cqw] left-[4cqw] right-[4cqw] overflow-hidden rounded-full bg-white/60" style={{ height: '.9cqw' }}>
                  <div className="h-full rounded-full bg-[#3b9cf0]" style={{ width: `${Math.min(100, (remaining / (freeze * 1000)) * 100)}%`, transition: 'width .1s linear' }} />
                </div>
              </div>
            )}
          </section>
        );
      })}

      {phase === 'ready' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-deep-navy/60 text-center text-white" style={{ gap: '1.4cqw' }}>
          <span style={{ fontSize: '7cqw' }}>🪢</span>
          <span className="font-extrabold" style={{ fontSize: '3.8cqw' }}>{t('gameTugOfWar.readyTitle')}</span>
          <span className="max-w-[70%] font-semibold opacity-95" style={{ fontSize: '1.9cqw' }}>
            {t('gameTugOfWar.readyHint', { pull, freeze })}
          </span>
          <button
            type="button"
            data-initial-game-start onClick={start}
            className="rounded-full bg-warm-yellow font-extrabold text-deep-navy shadow-xl transition-transform hover:scale-105 active:scale-95"
            style={{ fontSize: '3cqw', padding: '1cqw 5cqw' }}
          >
            {t('flow.start')}
          </button>
          <span className="font-medium opacity-80" style={{ fontSize: '1.4cqw' }}>{t('gameTugOfWar.keys')}</span>
        </div>
      )}

      {winner !== null && phase === 'playing' && (
        <div className="tw-anim pointer-events-none absolute left-1/2 top-[8cqw] z-20 rounded-full bg-white/95 font-extrabold shadow-xl" style={{ fontSize: '3.4cqw', padding: '.8cqw 3.4cqw', color: TEAM_COLORS[winner], animation: 'tw-pop .4s ease-out both' }}>
          {t('gameTugOfWar.winner', { team: teamName(winner) })}
        </div>
      )}

      {phase === 'done' && winner !== null && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden bg-[#fff8e6]/96 text-center" style={{ gap: '1.4cqw' }}>
          {Array.from({ length: 24 }, (_, i) => (
            <span
              key={i}
              className="tw-anim pointer-events-none absolute top-0"
              style={{
                left: `${(i * 37) % 100}%`,
                width: '1cqw',
                height: '1.6cqw',
                background: ['#ef5b5b', '#3b82f6', '#fbbf24', '#22a559'][i % 4],
                animation: `tw-confetti ${2.6 + (i % 5) * 0.4}s linear ${(i % 7) * 0.25}s infinite`,
              }}
            />
          ))}
          <img src={`${IMG}trophy.webp`} alt="" draggable={false} style={{ height: '8cqw', width: 'auto', filter: 'drop-shadow(0 .5cqw .5cqw rgba(0,0,0,.25))' }} />
          <span className="font-extrabold" style={{ fontSize: '4cqw', color: TEAM_COLORS[winner] }}>
            {t('gameTugOfWar.winner', { team: teamName(winner) })}
          </span>
          <span className="font-semibold text-on-surface-variant" style={{ fontSize: '1.9cqw' }}>{t('gameTugOfWar.cheer')}</span>
          <div className="flex" style={{ gap: '2cqw' }}>
            {[0, 1].map((i) => (
              <div key={i} className="overflow-hidden bg-white text-left shadow-lg" style={{ width: '24cqw', borderRadius: '1.4cqw', border: `.3cqw solid ${winner === i ? '#f5b301' : '#e5e7eb'}` }}>
                <div className="font-extrabold text-white" style={{ background: TEAM_COLORS[i], fontSize: '2cqw', padding: '.7cqw 1.6cqw' }}>
                  {teamName(i)} {winner === i && '🏆'}
                </div>
                <div className="font-extrabold tabular-nums text-deep-navy" style={{ fontSize: '4.2cqw', padding: '.6cqw 1.6cqw 0' }}>
                  {sides[i].correct}
                  <span className="font-semibold text-on-surface-variant" style={{ fontSize: '1.8cqw' }}> {t('gameTugOfWar.pullsUnit')}</span>
                </div>
                <div className="text-on-surface-variant" style={{ fontSize: '1.55cqw', padding: '.4cqw 1.6cqw 1.2cqw' }}>
                  <div>{t('gameTugOfWar.accuracy')}: <b className="text-deep-navy">{tugAccuracy(sides[i])}%</b> ({sides[i].correct}/{sides[i].correct + sides[i].wrong})</div>
                  <div>{t('gameTugOfWar.frozenCount')}: <b className="text-deep-navy">{sides[i].wrong}{t('gameTugOfWar.countUnit')}</b></div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-primary font-extrabold text-on-primary shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ fontSize: '2.2cqw', padding: '.8cqw 3.4cqw' }}
          >
            {t('gameTugOfWar.playAgain')}
          </button>
        </div>
      )}
    </div>
  );
}
