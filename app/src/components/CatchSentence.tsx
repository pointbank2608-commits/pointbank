import CatchSentenceSettings, {type CatchLevel} from './CatchSentenceSettings';
export {CATCH_DEFAULT_SECONDS, type CatchLevel} from './CatchSentenceSettings';
import { gameClock } from '../lib/gameClock';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_SFX, GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import { useRemoteActions } from '../lib/remote';
import type { GameItem, UndoHandle } from '../lib/types';

/**
 * 문장 잡기(2026-10-14) — PPT "Catch the Sentence" 5단계를 그대로 옮긴 모둠 게임.
 * 문장(또는 낱말)이 잠깐 나타났다 사라지면 모둠이 종이에 받아 쓰고, 선생님이 정답을 보여 주면 맞은 팀이 점수를 얻는다.
 *  1단계 문장이 잠깐 나타났다 사라짐 / 2단계 섞인 낱말이 잠깐 나타났다 사라짐 / 3단계 섞인 낱말이 화면을 떠다니다 사라짐
 *  4단계 문장이 화면을 가로질러 지나감(오른쪽→왼쪽, 아래→위로 흔들, 빙글 돌며) / 5단계 섞인 낱말이 날아서 지나감
 */


interface Props {
  items: GameItem[];
  teams: number;
  level: CatchLevel;
  seconds: number;
  /** 단계·시간을 게임 화면에서 바로 바꾼다(저장은 페이지가) */
  onChange?: (patch: { level?: CatchLevel; seconds?: number }) => void;
}

type Phase = 'ready' | 'show' | 'hidden' | 'reveal';
const TEAM_COLORS = ['#ef5b5b', '#3b82f6', '#22a559', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5a4', '#78716c'];
const TEAM_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const IMG = (n: string) => `/skins/catch/${n}.webp`;

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

/** 낱말 순서를 섞는다 — 원래 순서와 달라질 때까지 */
function scramble(words: string[]): string[] {
  if (words.length < 2) return words;
  for (let k = 0; k < 8; k++) {
    const s = shuffle(words);
    if (s.join(' ') !== words.join(' ')) return s;
  }
  return [...words].reverse();
}

interface Snapshot {
  scores: number[];
  pos: number;
  round: number;
}

const STYLE = `
@keyframes cs-appear { 0%{transform:scale(.6);opacity:0} 18%{transform:scale(1.06);opacity:1} 30%{transform:scale(1)} 85%{opacity:1} 100%{opacity:0;transform:scale(.96)} }
@keyframes cs-wander { 0%{transform:translate(var(--x0),var(--y0)) rotate(var(--r0));opacity:0} 8%{opacity:1}
  35%{transform:translate(var(--x1),var(--y1)) rotate(var(--r1))} 65%{transform:translate(var(--x2),var(--y2)) rotate(var(--r0))}
  92%{opacity:1} 100%{transform:translate(var(--x3),var(--y3)) rotate(var(--r1));opacity:0} }
@keyframes cs-fly { 0%{transform:translate(var(--x0),var(--y0)) rotate(var(--r0));opacity:0} 8%{opacity:1} 92%{opacity:1}
  100%{transform:translate(var(--x1),var(--y1)) rotate(var(--r1));opacity:0} }
@keyframes cs-teeter { 0%{transform:translate(0,120cqh) rotate(-7deg);opacity:0} 8%{opacity:1} 25%{transform:translate(0,70cqh) rotate(7deg)}
  50%{transform:translate(0,20cqh) rotate(-7deg)} 75%{transform:translate(0,-25cqh) rotate(7deg)} 92%{opacity:1} 100%{transform:translate(0,-60cqh) rotate(-5deg);opacity:0} }
@keyframes cs-spin { 0%{transform:translate(-120cqw,0) rotate(0);opacity:0} 8%{opacity:1} 92%{opacity:1} 100%{transform:translate(120cqw,0) rotate(1080deg);opacity:0} }
@keyframes cs-rtl { 0%{transform:translate(120cqw,0);opacity:0} 6%{opacity:1} 94%{opacity:1} 100%{transform:translate(-120cqw,0);opacity:0} }
@keyframes cs-pop { 0%{transform:scale(.3) rotate(-6deg);opacity:0} 60%{transform:scale(1.1) rotate(2deg);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes cs-glow { 0%,100%{transform:scale(1);filter:drop-shadow(0 0 1cqw #fde047)} 50%{transform:scale(1.08);filter:drop-shadow(0 0 2cqw #fde047)} }
@keyframes cs-star { 0%{transform:translate(0,0) scale(.3) rotate(0);opacity:0} 15%{opacity:1} 100%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(360deg);opacity:0} }
@keyframes cs-score { 0%{transform:scale(1)} 40%{transform:scale(1.4)} 100%{transform:scale(1)} }
@keyframes cs-bar { from{width:100%} to{width:0} }
@media (prefers-reduced-motion: reduce) { .cs-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

const CatchSentence = forwardRef<UndoHandle, Props>(function CatchSentence({ items, teams, level: levelProp, seconds: secondsProp, onChange: onChangeProp }, ref) {
  const { t } = useTranslation();
  // 저장할 곳이 없는 시범 화면(템플릿 만들기 전)에서도 단계·시간 칩이 보이고, 그 자리에서만 바뀐다
  const [demo, setDemo] = useState<{ level?: CatchLevel; seconds?: number }>({});
  const level = onChangeProp ? levelProp : (demo.level ?? levelProp);
  const seconds = onChangeProp ? secondsProp : (demo.seconds ?? secondsProp);
  const onChange = onChangeProp ?? ((patch: { level?: CatchLevel; seconds?: number }) => setDemo((d) => ({ ...d, ...patch })));
  const teamCount = Math.min(8, Math.max(2, teams));
  const itemKey = items.map((i) => i.id).join(',');
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState<number[]>(() => Array(teamCount).fill(0));
  const [phase, setPhase] = useState<Phase>('ready');
  const [runId, setRunId] = useState(0);
  const [pulse, setPulse] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
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
    setScores(Array(teamCount).fill(0));
    setPhase('ready');
    setSnapshot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamCount, itemKey]);
  useEffect(()=>{clearTimers();setPhase('ready');setSnapshot(null);},[level,seconds]);


  const current = items.length > 0 && order.length > 0 ? parseItem(items[order[pos % order.length]]?.label ?? '') : { text: '', ko: '' };
  const words = useMemo(() => current.text.split(/\s+/).filter(Boolean), [current.text]);
  // 섞은 순서는 문장이 바뀌거나 다시 보기를 누를 때 새로 만든다
  const scrambled = useMemo(() => scramble(words), [words, runId]);
  const teamName = (i: number) => t('gameCatchSentence.teamName', { name: TEAM_NAMES[i] });

  /** 낱말 칸의 위치·경로 값 — 한 번 보여 줄 때마다 새로(runId) */
  const paths = useMemo(() => {
    const n = scrambled.length;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    return scrambled.map((_, i) => {
      const slot = n > 1 ? i / (n - 1) : 0.5;
      const mode = round % 3; // 5단계는 3가지 날아오는 방식을 돌아가며
      let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
      if (level === 5) {
        if (mode === 1) {
          // 아래 → 위
          x0 = x1 = -34 + slot * 68; y0 = 60 + rnd(0, 14); y1 = -60 - rnd(0, 10);
        } else if (mode === 2) {
          // 왼쪽 아래 모서리 → 오른쪽 위 모서리
          x0 = -70 + rnd(-6, 6); y0 = 50 + rnd(0, 12); x1 = 70 + rnd(-6, 6); y1 = -55 - rnd(0, 8);
        } else {
          // 사방에서
          const side = i % 4;
          x0 = side === 0 ? -80 : side === 1 ? 80 : rnd(-40, 40);
          y0 = side === 2 ? -62 : side === 3 ? 62 : rnd(-30, 30);
          x1 = -x0 * 0.9 + rnd(-8, 8); y1 = -y0 * 0.9 + rnd(-8, 8);
        }
      }
      return {
        x0, y0, x1, y1,
        // 3단계 떠다니기용 중간 지점
        wx: [rnd(-36, 36), rnd(-30, 30), rnd(-36, 36), rnd(-36, 36)],
        wy: [rnd(-26, 18), rnd(-26, 18), rnd(-26, 18), rnd(-26, 18)],
        r0: rnd(-12, 12), r1: rnd(-12, 12),
        delay: level === 5 ? i * 0.35 : level === 3 ? i * 0.1 : 0,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrambled, level, round, runId]);

  const mode4 = (['rtl', 'teeter', 'spin'] as const)[(round - 1) % 3];
  const totalMs = Math.round((level === 5 ? seconds + scrambled.length * 0.35 : seconds) * 1000);

  function startShow() {
    if (phase !== 'ready' && phase !== 'hidden') return;
    clearTimers();
    setRunId((r) => r + 1);
    setPhase('show');
    playSfx(GAME_SFX.catchsentence.show);
    later(() => {
      setPhase('hidden');
      playSfx(GAME_SFX.catchsentence.hide);
    }, totalMs + 150);
  }

  function reveal() {
    if (phase !== 'hidden' && phase !== 'ready') return;
    clearTimers();
    setPhase('reveal');
    playSfx(GAME_SFX.catchsentence.reveal);
    if (current.text) speak(current.text);
  }

  function giveTeam(i: number) {
    if (phase !== 'reveal') return;
    setSnapshot({ scores: [...scores], pos, round });
    playSfx(GAME_SFX.catchsentence.correct);
    setScores((s) => s.map((v, k) => (k === i ? v + 1 : v)));
    setPulse(i);
    later(() => setPulse(null), 700);
  }

  function next() {
    if (phase !== 'reveal') return;
    setSnapshot({ scores: [...scores], pos, round });
    let np = pos + 1;
    if (np >= order.length) {
      setOrder(shuffle(items.map((_, i) => i)));
      np = 0;
    }
    setPos(np);
    setRound((r) => r + 1);
    setPhase('ready');
    playSfx(COMMON_SFX.yourTurn);
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!snapshot) return;
      clearTimers();
      setScores(snapshot.scores);
      setPos(snapshot.pos);
      setRound(snapshot.round);
      setPhase('ready');
      setSnapshot(null);
    },
  }));

  useRemoteActions(
    phase === 'ready'
      ? [{ id: 'show', label: t('gameCatchSentence.show'), tone: 'primary', run: startShow }]
      : phase === 'hidden'
        ? [
            { id: 'again', label: t('gameCatchSentence.again'), tone: 'neutral', run: startShow },
            { id: 'reveal', label: t('gameCatchSentence.reveal'), tone: 'primary', run: reveal },
          ]
        : phase === 'reveal'
          ? [
              ...scores.map((_, i) => ({ id: `t${i}`, label: `${teamName(i)} +1`, tone: 'team' as const, color: TEAM_COLORS[i], run: () => giveTeam(i) })),
              { id: 'next', label: t('gameCatchSentence.next'), tone: 'primary' as const, run: next },
            ]
          : [],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        {t('gameCatchSentence.needItems')}
      </div>
    );
  }

  const paper =
    'rounded-[1.4cqw] border-[0.3cqw] border-amber-300 bg-[#fffbe8] px-[1.4cqw] py-[0.6cqw] font-bold text-deep-navy shadow-xl';
  const fs = (len: number) => (len > 60 ? 'clamp(14px,2.6cqw,34px)' : len > 36 ? 'clamp(16px,3.2cqw,44px)' : len > 18 ? 'clamp(20px,4.2cqw,56px)' : 'clamp(26px,6cqw,80px)');
  const btn = 'rounded-full px-[1.8cqw] py-[0.7cqw] font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95';
  const bf = { fontSize: 'clamp(12px, 1.8cqw, 26px)' } as const;
  const levelHint = t(`gameCatchSentence.levelHint_${level}`);

  return (
    <div className="mx-auto w-full max-w-[1100px] select-none">
      <style>{STYLE}</style>

      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {scores.map((s, i) => (
          <div key={i} className="flex items-center gap-2 rounded-full px-4 py-1.5 font-title-md text-title-md text-white shadow-md" style={{ background: TEAM_COLORS[i] }}>
            <span>{teamName(i)}</span>
            <span
              className="cs-anim min-w-[1.6em] rounded-full bg-white/90 px-2 text-center font-bold"
              style={{ color: TEAM_COLORS[i], animation: pulse === i ? 'cs-score .6s' : undefined }}
            >
              {s}
            </span>
          </div>
        ))}
        <span className="rounded-full bg-amber-100 px-3 py-1 font-label-md text-label-md text-amber-900">
          {t('gameCatchSentence.roundLabel', { n: round })}
        </span>
      </div>

      <CatchSentenceSettings level={level} seconds={seconds} disabled={phase==='show'} onChange={onChange}/>

      <div
        className="relative w-full overflow-hidden rounded-[24px] shadow-lg"
        style={{ aspectRatio: '16 / 9', containerType: 'size', background: `#322a6b url(${IMG('scene')}) center / cover no-repeat` }}
      >
        <div className="absolute left-0 right-0 top-[2.5%] z-10 text-center">
          <span className="inline-block rounded-full bg-white/85 px-[2.4cqw] py-[0.6cqw] font-bold text-slate-800 shadow" style={{ fontSize: 'clamp(11px, 1.9cqw, 26px)' }}>
            {t('gameCatchSentence.levelTitle', { n: level })} · {levelHint}
          </span>
        </div>

        {/* 무대 한가운데 */}
        <div className="absolute overflow-hidden" style={{ left: '4%', right: '4%', top: '12%', height: '58%' }}>
          {phase === 'ready' && (
            <div className="cs-anim flex h-full flex-col items-center justify-center gap-[1cqw] text-center" style={{ animation: 'cs-pop .4s both' }}>
              <img src={IMG('net')} alt="" draggable={false} className="h-[46%] object-contain" style={{ animation: 'cs-glow 2s ease-in-out infinite' }} />
              <div className="font-bold text-white drop-shadow" style={{ fontSize: 'clamp(16px,3cqw,40px)' }}>
                {t('gameCatchSentence.readyTitle')}
              </div>
              <div className="rounded-full bg-black/30 px-[1.4cqw] py-[0.3cqw] text-amber-100" style={{ fontSize: 'clamp(11px,1.6cqw,22px)' }}>
                {t('gameCatchSentence.wordCount', { n: words.length })}
              </div>
            </div>
          )}

          {phase === 'show' && (
            <div key={runId} className="relative h-full w-full">
              {/* 1단계: 문장이 잠깐 나타난다 */}
              {level === 1 && (
                <div className="absolute inset-0 flex items-center justify-center p-[3cqw]">
                  <div className={`cs-anim ${paper} text-center`} style={{ fontSize: fs(current.text.length), animation: `cs-appear ${seconds}s both` }}>
                    {current.text}
                  </div>
                </div>
              )}
              {/* 2단계: 섞인 낱말이 줄지어 나타난다 */}
              {level === 2 && (
                <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-[1.2cqw] p-[3cqw]">
                  {scrambled.map((w, i) => (
                    <span key={i} className={`cs-anim ${paper}`} style={{ fontSize: fs(w.length * 3), animation: `cs-appear ${seconds}s ${i * 0.05}s both` }}>
                      {w}
                    </span>
                  ))}
                </div>
              )}
              {/* 3단계: 섞인 낱말이 떠다닌다 */}
              {level === 3 &&
                scrambled.map((w, i) => {
                  const p = paths[i];
                  return (
                    <span
                      key={i}
                      className={`cs-anim absolute left-1/2 top-1/2 ${paper}`}
                      style={{
                        fontSize: 'clamp(16px,3.4cqw,46px)',
                        ['--x0' as string]: `${p.wx[0]}cqw`, ['--y0' as string]: `${p.wy[0]}cqh`,
                        ['--x1' as string]: `${p.wx[1]}cqw`, ['--y1' as string]: `${p.wy[1]}cqh`,
                        ['--x2' as string]: `${p.wx[2]}cqw`, ['--y2' as string]: `${p.wy[2]}cqh`,
                        ['--x3' as string]: `${p.wx[3]}cqw`, ['--y3' as string]: `${p.wy[3]}cqh`,
                        ['--r0' as string]: `${p.r0}deg`, ['--r1' as string]: `${p.r1}deg`,
                        marginLeft: '-4cqw',
                        animation: `cs-wander ${seconds}s ${p.delay}s ease-in-out both`,
                      }}
                    >
                      {w}
                    </span>
                  );
                })}
              {/* 4단계: 문장이 화면을 가로질러 간다 */}
              {level === 4 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`cs-anim ${paper} whitespace-nowrap`}
                    style={{
                      fontSize: fs(current.text.length),
                      animation: `${mode4 === 'rtl' ? 'cs-rtl' : mode4 === 'teeter' ? 'cs-teeter' : 'cs-spin'} ${seconds}s ${mode4 === 'rtl' ? 'linear' : 'ease-in-out'} both`,
                    }}
                  >
                    {current.text}
                  </div>
                </div>
              )}
              {/* 5단계: 섞인 낱말이 날아서 지나간다 */}
              {level === 5 &&
                scrambled.map((w, i) => {
                  const p = paths[i];
                  return (
                    <span
                      key={i}
                      className={`cs-anim absolute left-1/2 top-1/2 ${paper}`}
                      style={{
                        fontSize: 'clamp(16px,3.4cqw,46px)',
                        ['--x0' as string]: `${p.x0}cqw`, ['--y0' as string]: `${p.y0}cqh`,
                        ['--x1' as string]: `${p.x1}cqw`, ['--y1' as string]: `${p.y1}cqh`,
                        ['--r0' as string]: `${p.r0 * 3}deg`, ['--r1' as string]: `${p.r1 * 5}deg`,
                        marginLeft: '-4cqw',
                        animation: `cs-fly ${seconds}s ${p.delay}s ease-in-out both`,
                      }}
                    >
                      {w}
                    </span>
                  );
                })}
            </div>
          )}

          {phase === 'hidden' && (
            <div className="cs-anim flex h-full flex-col items-center justify-center gap-[1cqw] text-center" style={{ animation: 'cs-pop .4s both' }}>
              <img src={IMG('bulb')} alt="" draggable={false} className="h-[42%] object-contain" style={{ animation: 'cs-glow 2s ease-in-out infinite' }} />
              <div className="font-bold text-white drop-shadow" style={{ fontSize: 'clamp(16px,3cqw,40px)' }}>
                {t(level === 1 || level === 4 ? 'gameCatchSentence.writeSentence' : 'gameCatchSentence.writeOrder')}
              </div>
            </div>
          )}

          {phase === 'reveal' && (
            <div className="relative flex h-full flex-col items-center justify-center gap-[1cqw] text-center">
              {Array.from({ length: 10 }, (_, p) => (
                <span
                  key={p}
                  className="cs-anim pointer-events-none absolute left-1/2 top-1/2 text-[2.2cqw] text-amber-300"
                  style={{
                    ['--dx' as string]: `${Math.cos((p / 10) * Math.PI * 2) * (16 + (p % 3) * 5)}cqw`,
                    ['--dy' as string]: `${Math.sin((p / 10) * Math.PI * 2) * (9 + (p % 4) * 3)}cqw`,
                    animation: `cs-star 1.5s ${(p % 5) * 0.06}s both`,
                  }}
                >
                  ★
                </span>
              ))}
              <div className={`cs-anim ${paper} relative text-center`} style={{ fontSize: fs(current.text.length), animation: 'cs-pop .5s both', maxWidth: '92%' }}>
                {current.text}
              </div>
              {current.ko && <div className="text-amber-100 drop-shadow" style={{ fontSize: 'clamp(13px,2.2cqw,30px)' }}>{current.ko}</div>}
            </div>
          )}

          {/* 보이는 시간 막대 */}
          {phase === 'show' && (
            <div className="absolute bottom-0 left-[10%] right-[10%] h-[0.8cqw] overflow-hidden rounded-full bg-white/20">
              <div className="cs-anim h-full rounded-full bg-amber-300" style={{ animation: `cs-bar ${totalMs / 1000}s linear both` }} />
            </div>
          )}
        </div>

        {/* 조작 줄 */}
        <div className="absolute inset-x-0 bottom-[3%] z-10 flex flex-wrap items-center justify-center gap-[1cqw]">
          {phase === 'ready' && (
            <button type="button" data-initial-game-start onClick={startShow} className={btn} style={{ ...bf, background: '#6366f1' }}>
              ▶ {t('gameCatchSentence.show')}
            </button>
          )}
          {phase === 'hidden' && (
            <>
              <button type="button" onClick={startShow} className={btn} style={{ ...bf, background: '#6366f1' }}>
                ↻ {t('gameCatchSentence.again')}
              </button>
              <button type="button" onClick={reveal} className={btn} style={{ ...bf, background: '#f59e0b' }}>
                {t('gameCatchSentence.reveal')}
              </button>
            </>
          )}
          {phase === 'reveal' && (
            <>
              {scores.map((_, i) => (
                <button key={i} type="button" onClick={() => giveTeam(i)} className={btn} style={{ ...bf, background: TEAM_COLORS[i] }}>
                  {teamName(i)} +1
                </button>
              ))}
              <button type="button" onClick={next} className={btn} style={{ ...bf, background: '#0ea5a4' }}>
                {t('gameCatchSentence.next')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 text-center font-caption text-caption text-on-surface-variant">{t('gameCatchSentence.rule')}</div>
    </div>
  );
});

export default CatchSentence;
