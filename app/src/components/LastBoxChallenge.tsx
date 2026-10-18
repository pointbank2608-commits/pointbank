import { gameClock } from '../lib/gameClock';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_SFX, GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import { useRemoteActions } from '../lib/remote';
import { buildChallenge, parsePool, type Challenge, type ChallengeSkill } from '../lib/lastBoxChallenges';
import type { GameItem, UndoHandle } from '../lib/types';

/**
 * 마지막 박스 챌린지(2026-10-14) — PPT "Chain Reaction"을 옮긴 학급 대항 게임.
 * 학생에게 번호(1~N)를 붙이고, 번호 차례대로 박스를 1~3개씩 읽다가 마지막 박스를 읽은 학생이 돌림판을 돌려
 * 같은 번호 팀과 함께 듣기·말하기·쓰기 도전을 한다(분홍=마음대로, 주황=건너뛰기). 한 판이 끝나면 그 학생부터 다시 시작.
 */

interface Props {
  items: GameItem[];
  /** 박스 수(15·21·31) */
  boxes: number;
  /** 학생 번호 수 = 팀 수 */
  teams: number;
}

type Phase = 'board' | 'wheel' | 'challenge';
type SliceKind = ChallengeSkill | 'choose' | 'skip';

const SLICES: { kind: SliceKind; color: string }[] = [
  { kind: 'choose', color: '#f472b6' },
  { kind: 'listening', color: '#8b5cf6' },
  { kind: 'speaking', color: '#38bdf8' },
  { kind: 'writing', color: '#4ade80' },
  { kind: 'skip', color: '#fb923c' },
  { kind: 'listening', color: '#8b5cf6' },
  { kind: 'speaking', color: '#38bdf8' },
  { kind: 'writing', color: '#4ade80' },
];
const SKILL_ICON: Record<ChallengeSkill, string> = { listening: 'headphones', speaking: 'bubble', writing: 'pencil' };
const SKILL_COLOR: Record<ChallengeSkill, string> = { listening: '#8b5cf6', speaking: '#0ea5e9', writing: '#22a559' };
const TEAM_COLORS = ['#ef5b5b', '#3b82f6', '#22a559', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5a4', '#78716c'];
const BOX_COLORS = ['#fda4af', '#fcd34d', '#86efac', '#7dd3fc', '#c4b5fd', '#fdba74'];
const IMG = (n: string) => `/skins/chain/${n}.webp`;
const MAX_READ = 3;

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

interface Snapshot {
  cursor: number;
  readNow: number;
  turn: number;
  phase: Phase;
}

const STYLE = `
@keyframes lb-pop { 0%{transform:scale(.3) rotate(-6deg);opacity:0} 60%{transform:scale(1.1) rotate(2deg);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes lb-glow { 0%,100%{box-shadow:0 0 0 0 rgba(250,204,21,.9)} 50%{box-shadow:0 0 0 .7cqw rgba(250,204,21,0)} }
@keyframes lb-read { 0%{transform:scale(1)} 35%{transform:scale(1.25) rotate(-4deg)} 100%{transform:scale(.2) rotate(10deg);opacity:0} }
@keyframes lb-score { 0%{transform:scale(1)} 40%{transform:scale(1.4)} 100%{transform:scale(1)} }
@keyframes lb-star { 0%{transform:translate(0,0) scale(.3) rotate(0);opacity:0} 15%{opacity:1} 100%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(360deg);opacity:0} }
@keyframes lb-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6%)} }
@keyframes lb-shake { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-6deg)} 75%{transform:rotate(6deg)} }
.lb-box { transition: transform .15s; }
.lb-box:hover:not(:disabled) { transform: translateY(-4%) scale(1.04); }
.lb-box:disabled { cursor: default; }
@media (prefers-reduced-motion: reduce) { .lb-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

const LastBoxChallenge = forwardRef<UndoHandle, Props>(function LastBoxChallenge({ items, boxes, teams }, ref) {
  const { t } = useTranslation();
  const teamCount = Math.min(8, Math.max(2, teams));
  const boxCount = Math.max(6, boxes);
  const cols = boxCount <= 15 ? 5 : boxCount <= 21 ? 7 : 8;
  const rows = Math.ceil(boxCount / cols);
  const itemKey = items.map((i) => i.id + i.label).join('|');

  const pool = useMemo(() => parsePool(items.map((i) => i.label)), [itemKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const makeWords = () => {
    if (pool.length === 0) return Array.from({ length: boxCount }, (_, i) => String(i + 1));
    const out: string[] = [];
    while (out.length < boxCount) out.push(...shuffle(pool.map((p) => p.text)));
    return out.slice(0, boxCount);
  };

  const [words, setWords] = useState<string[]>(makeWords);
  const [cursor, setCursor] = useState(0);
  const [readNow, setReadNow] = useState(0);
  const [turn, setTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState<number[]>(() => Array(teamCount).fill(0));
  const [phase, setPhase] = useState<Phase>('board');
  const [lastTaken, setLastTaken] = useState<number | null>(null);
  const [pulse, setPulse] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  // 돌림판
  const [angle, setAngle] = useState(0);
  const [spin, setSpin] = useState<'idle' | 'fast' | 'stopping' | 'done'>('idle');
  const [slice, setSlice] = useState<number | null>(null);
  const angleRef = useRef(0);
  const raf = useRef<number | null>(null);

  // 도전
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [resolved, setResolved] = useState<'win' | 'lose' | 'skip' | null>(null);
  const [needChoose, setNeedChoose] = useState(false);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(gameClock.setTimeout(fn, ms));
  };
  const clearAll = () => {
    timers.current.forEach((id) => gameClock.clearTimeout(id));
    timers.current = [];
    if (raf.current) gameClock.cancelAnimationFrame(raf.current);
    raf.current = null;
  };
  useEffect(() => clearAll, []);

  useEffect(() => {
    clearAll();
    setWords(makeWords());
    setCursor(0);
    setReadNow(0);
    setTurn(0);
    setRound(1);
    setScores(Array(teamCount).fill(0));
    setPhase('board');
    setSnapshot(null);
    setChallenge(null);
    setSpin('idle');
    setSlice(null);
    setResolved(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamCount, boxCount, itemKey]);

  const teamNo = (i: number) => i + 1;

  /* ---------------- 박스 읽기 ---------------- */
  function readBox(idx: number) {
    if (phase !== 'board' || idx !== cursor) return;
    setSnapshot({ cursor, readNow, turn, phase });
    playSfx(GAME_SFX.lastbox.read);
    speak(words[idx]);
    setLastTaken(idx);
    const nextCursor = cursor + 1;
    setCursor(nextCursor);
    if (nextCursor >= boxCount) {
      // 마지막 박스를 읽은 학생 — 돌림판으로
      later(() => {
        playSfx(COMMON_SFX.tryAgain);
        setPhase('wheel');
        setSpin('idle');
        setSlice(null);
      }, 900);
      return;
    }
    const n = readNow + 1;
    if (n >= MAX_READ) {
      setReadNow(0);
      setTurn((v) => (v + 1) % teamCount);
    } else {
      setReadNow(n);
    }
  }

  function passTurn() {
    if (phase !== 'board' || readNow === 0) return;
    setSnapshot({ cursor, readNow, turn, phase });
    setReadNow(0);
    setTurn((v) => (v + 1) % teamCount);
    playSfx(COMMON_SFX.yourTurn);
  }

  /* ---------------- 돌림판 ---------------- */
  function tickFast() {
    angleRef.current = (angleRef.current + 11) % 360;
    setAngle(angleRef.current);
    raf.current = gameClock.requestAnimationFrame(tickFast);
  }

  function clickWheel() {
    if (phase !== 'wheel') return;
    if (spin === 'idle') {
      setSpin('fast');
      playSfx(GAME_SFX.lastbox.spin);
      raf.current = gameClock.requestAnimationFrame(tickFast);
      return;
    }
    if (spin === 'fast') {
      if (raf.current) gameClock.cancelAnimationFrame(raf.current);
      setSpin('stopping');
      const target = Math.floor(Math.random() * SLICES.length);
      const centerDeg = target * 45 + 22.5 + (Math.random() * 20 - 10);
      const start = angleRef.current;
      const want = (((-centerDeg - start) % 360) + 360) % 360;
      const total = want + 360 * 3;
      const dur = 3200;
      const t0 = gameClock.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        angleRef.current = (start + total * e) % 360;
        setAngle(angleRef.current);
        if (p < 1) raf.current = gameClock.requestAnimationFrame(step);
        else {
          setSpin('done');
          setSlice(target);
          playSfx(GAME_SFX.lastbox.stop);
          later(() => handleSlice(target), 900);
        }
      };
      raf.current = gameClock.requestAnimationFrame(step);
    }
  }

  function handleSlice(i: number) {
    const k = SLICES[i].kind;
    if (k === 'skip') {
      setPhase('challenge');
      setChallenge(null);
      setResolved('skip');
      setNeedChoose(false);
      return;
    }
    if (k === 'choose') {
      setPhase('challenge');
      setChallenge(null);
      setResolved(null);
      setNeedChoose(true);
      return;
    }
    openChallenge(k);
  }

  function openChallenge(skill: ChallengeSkill, avoid?: Challenge['kind']) {
    setNeedChoose(false);
    setChallenge(buildChallenge(skill, pool, avoid));
    setShowAnswer(false);
    setHidden(true);
    setResolved(null);
    setPhase('challenge');
    playSfx(GAME_SFX.lastbox.flip);
  }

  function finish(result: 'win' | 'lose') {
    if (resolved) return;
    setResolved(result);
    if (result === 'win') {
      playSfx(GAME_SFX.lastbox.win);
      later(() => playSfx(COMMON_SFX.praise), 600);
      setScores((s) => s.map((v, i) => (i === turn ? v + 1 : v)));
      setPulse(turn);
      later(() => setPulse(null), 700);
    } else {
      playSfx(GAME_SFX.lastbox.lose);
    }
  }

  function nextRound() {
    clearAll();
    setWords(makeWords());
    setCursor(0);
    setReadNow(0);
    setRound((r) => r + 1);
    setPhase('board');
    setChallenge(null);
    setSpin('idle');
    setSlice(null);
    setResolved(null);
    setNeedChoose(false);
    setSnapshot(null);
    setLastTaken(null);
    playSfx(COMMON_SFX.start);
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!snapshot || phase !== 'board') return;
      setCursor(snapshot.cursor);
      setReadNow(snapshot.readNow);
      setTurn(snapshot.turn);
      setSnapshot(null);
    },
  }));

  useRemoteActions(
    phase === 'board'
      ? [
          { id: 'read', label: t('gameLastBox.readNext'), tone: 'primary', run: () => readBox(cursor) },
          ...(readNow > 0 ? [{ id: 'pass', label: t('gameLastBox.pass', { next: teamNo((turn + 1) % teamCount) }), tone: 'neutral' as const, run: passTurn }] : []),
        ]
      : phase === 'wheel'
        ? [{ id: 'spin', label: t('gameLastBox.spinLabel'), tone: 'primary', run: clickWheel }]
        : phase === 'challenge' && needChoose
          ? (['listening', 'speaking', 'writing'] as ChallengeSkill[]).map((k) => ({ id: `skill-${k}`, label: t(`gameLastBox.skill_${k}`), tone: 'primary' as const, run: () => openChallenge(k) }))
          : phase === 'challenge' && challenge && !resolved
            ? [
                { id: 'success', label: t('gameLastBox.success', { n: teamNo(turn) }), tone: 'good', run: () => finish('win') },
                { id: 'fail', label: t('gameLastBox.fail'), tone: 'bad', run: () => finish('lose') },
                { id: 'answer', label: t('gameLastBox.showAnswer'), tone: 'neutral', run: () => setShowAnswer(true) },
                { id: 'another', label: t('gameLastBox.another'), tone: 'neutral', run: () => openChallenge(challenge.skill, challenge.kind) },
              ]
            : phase === 'challenge' && resolved
              ? [{ id: 'nextRound', label: t('gameLastBox.nextRound', { n: teamNo(turn) }), tone: 'primary', run: nextRound }]
              : [],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        {t('gameLastBox.needItems')}
      </div>
    );
  }

  const btn = 'rounded-full px-[1.8cqw] py-[0.7cqw] font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95';
  const bf = { fontSize: 'clamp(12px, 1.8cqw, 26px)' } as const;
  const paper = 'rounded-[1.6cqw] border-[0.35cqw] border-amber-300 bg-[#fffbe8] shadow-xl';
  const remaining = boxCount - cursor;

  /* ---------------- 도전 카드 내용 ---------------- */
  function challengeBody(c: Challenge) {
    const big = (txt: string, size = 'clamp(20px,4.4cqw,60px)') => (
      <div className="break-words text-center font-black text-deep-navy" style={{ fontSize: size, lineHeight: 1.2 }}>
        {txt}
      </div>
    );
    const chips = (arr: string[]) => (
      <div className="flex flex-wrap items-center justify-center gap-[0.8cqw]">
        {arr.map((w, i) => (
          <span key={i} className="rounded-[0.8cqw] border-[0.2cqw] border-amber-300 bg-white px-[1cqw] py-[0.3cqw] font-bold text-deep-navy" style={{ fontSize: 'clamp(15px,3cqw,40px)' }}>
            {w}
          </span>
        ))}
      </div>
    );
    const hear = (txt: string) => (
      <button type="button" onClick={() => speak(txt)} className="rounded-full bg-indigo-50 px-[1.2cqw] py-[0.3cqw] font-bold text-indigo-700 hover:bg-indigo-100" style={{ fontSize: 'clamp(11px,1.5cqw,20px)' }}>
        🔊 {t('gameLastBox.listen')}
      </button>
    );
    const secret = (txt: string, extra?: string) => (
      <div className="flex flex-col items-center gap-[0.8cqw]">
        {hidden ? (
          <button type="button" onClick={() => setHidden(false)} className="rounded-full bg-amber-100 px-[2cqw] py-[0.8cqw] font-bold text-amber-900 hover:bg-amber-200" style={{ fontSize: 'clamp(13px,2cqw,28px)' }}>
            👀 {t('gameLastBox.peek')}
          </button>
        ) : (
          <>
            {big(txt)}
            {extra && <div className="text-on-surface-variant" style={{ fontSize: 'clamp(12px,1.8cqw,24px)' }}>{extra}</div>}
            <button type="button" onClick={() => setHidden(true)} className="font-label-md text-label-md text-on-surface-variant hover:underline">{t('gameLastBox.hide')}</button>
          </>
        )}
      </div>
    );
    switch (c.kind) {
      case 'spell':
      case 'whisperW':
      case 'whisperS':
        return secret(c.main, c.ko);
      case 'fixsent':
        return (
          <div className="flex flex-col items-center gap-[0.8cqw]">
            {big(c.main, 'clamp(18px,3.6cqw,48px)')}
            {hear(c.main)}
          </div>
        );
      case 'code':
        return (
          <div className="flex flex-col items-center gap-[1cqw]">
            <div className="flex flex-wrap justify-center gap-[0.8cqw]">
              {c.parts.map((w, i) => (
                <div key={i} className="flex min-w-[9cqw] flex-col items-center rounded-[1cqw] border-[0.25cqw] border-amber-300 bg-white px-[1cqw] py-[0.5cqw]">
                  <span className="rounded-full bg-indigo-600 px-[0.8cqw] font-black text-white" style={{ fontSize: 'clamp(11px,1.6cqw,22px)' }}>{i + 1}</span>
                  <span className="font-bold text-deep-navy" style={{ fontSize: 'clamp(13px,2.2cqw,30px)' }}>{w}</span>
                </div>
              ))}
            </div>
            <div className="rounded-full bg-amber-100 px-[1.6cqw] py-[0.5cqw] font-black text-amber-900" style={{ fontSize: 'clamp(13px,2.2cqw,30px)' }}>
              {t('gameLastBox.codeOrder')}: {c.main}
            </div>
          </div>
        );
      case 'rebus':
        return <div className="whitespace-pre-wrap">{big(c.main, 'clamp(18px,3.8cqw,52px)')}</div>;
      case 'qchain':
        return (
          <div className="flex flex-col items-center gap-[0.8cqw]">
            {big(c.main)}
            {hear(c.main)}
          </div>
        );
      case 'makesent':
        return (
          <div className="flex flex-col items-center gap-[0.8cqw]">
            {big(c.main, 'clamp(26px,6cqw,80px)')}
            {hear(c.main)}
          </div>
        );
      case 'describe':
        return secret(c.main);
      case 'jumble':
      case 'unscramble':
        return chips(c.parts);
      case 'unscramble2':
        return chips(c.parts);
      case 'write6':
        return big(c.main, 'clamp(26px,6cqw,80px)');
      case 'write3':
      case 'fixwrite':
        return big(c.main, 'clamp(18px,3.6cqw,48px)');
    }
  }

  const needsAnswer = !!challenge && !!challenge.answer && challenge.kind !== 'write6' && challenge.kind !== 'write3';

  return (
    <div className="mx-auto w-full max-w-[1100px] select-none">
      <style>{STYLE}</style>

      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {scores.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-full px-4 py-1.5 font-title-md text-title-md text-white shadow-md transition-transform"
            style={{
              background: TEAM_COLORS[i],
              outline: i === turn ? '4px solid #fde68a' : 'none',
              transform: i === turn ? 'scale(1.1)' : 'none',
            }}
          >
            <span>{t('gameLastBox.teamNo', { n: teamNo(i) })}</span>
            <span className="lb-anim min-w-[1.6em] rounded-full bg-white/90 px-2 text-center font-bold" style={{ color: TEAM_COLORS[i], animation: pulse === i ? 'lb-score .6s' : undefined }}>
              {s}
            </span>
          </div>
        ))}
        <span className="rounded-full bg-amber-100 px-3 py-1 font-label-md text-label-md text-amber-900">{t('gameLastBox.roundLabel', { n: round })}</span>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-[24px] shadow-lg"
        style={{ aspectRatio: '16 / 9', containerType: 'size', background: `#fde68a url(${IMG('scene')}) center / cover no-repeat` }}
      >
        {/* 안내 */}
        <div className="absolute left-0 right-0 top-[2%] z-10 text-center">
          <span className="inline-block rounded-full bg-white/90 px-[2.4cqw] py-[0.6cqw] font-bold text-slate-800 shadow" style={{ fontSize: 'clamp(11px, 1.9cqw, 26px)' }}>
            {phase === 'board' &&
              t('gameLastBox.turnHint', { n: teamNo(turn), read: readNow, max: MAX_READ, left: remaining })}
            {phase === 'wheel' && t('gameLastBox.wheelHint', { n: teamNo(turn) })}
            {phase === 'challenge' && t('gameLastBox.challengeHint', { n: teamNo(turn) })}
          </span>
        </div>

        {/* 박스 판 */}
        {phase === 'board' && (
          <div
            className="absolute"
            style={{
              left: '2%',
              right: '2%',
              top: '11%',
              bottom: readNow > 0 ? '11%' : '3%',
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gap: '0.8cqw',
            }}
          >
            {Array.from({ length: boxCount }, (_, i) => {
              const taken = i < cursor;
              const isNext = i === cursor;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!isNext}
                  onClick={() => readBox(i)}
                  aria-label={t('gameLastBox.boxLabel', { n: i + 1 })}
                  className="lb-box lb-anim relative flex items-center justify-center overflow-hidden rounded-[1.2cqw] border-[0.3cqw] border-white/80 p-[0.3cqw] shadow-md"
                  style={{
                    background: BOX_COLORS[i % BOX_COLORS.length],
                    visibility: taken && lastTaken !== i ? 'hidden' : 'visible',
                    animation: taken ? 'lb-read .7s both' : isNext ? 'lb-glow 1.4s ease-in-out infinite' : undefined,
                    opacity: isNext || taken ? 1 : 0.92,
                  }}
                >
                  <span className="absolute left-[0.5cqw] top-[0.2cqw] rounded-full bg-white/80 px-[0.5cqw] font-black text-slate-600" style={{ fontSize: 'clamp(8px,1.1cqw,15px)' }}>
                    {i + 1}
                  </span>
                  <span
                    className="break-words text-center font-bold leading-tight text-deep-navy"
                    style={{ fontSize: words[i].length > 30 ? 'clamp(8px,1.1cqw,14px)' : words[i].length > 14 ? 'clamp(9px,1.5cqw,20px)' : 'clamp(11px,2.1cqw,30px)' }}
                  >
                    {words[i]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {phase === 'board' && readNow > 0 && (
          <div className="absolute inset-x-0 bottom-[2.5%] z-10 flex justify-center">
            <button type="button" onClick={passTurn} className={btn} style={{ ...bf, background: '#0ea5a4' }}>
              {t('gameLastBox.pass', { next: teamNo((turn + 1) % teamCount) })}
            </button>
          </div>
        )}

        {/* 돌림판 */}
        {phase === 'wheel' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/35">
            <div className="relative" style={{ height: '70%', aspectRatio: '1 / 1' }}>
              <div className="absolute left-1/2 top-[-4%] z-10 -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: '1.6cqw solid transparent', borderRight: '1.6cqw solid transparent', borderTop: '3.4cqw solid #ef4444', filter: 'drop-shadow(0 .3cqw .3cqw rgba(0,0,0,.4))' }} />
              <button
                type="button"
                onClick={clickWheel}
                disabled={spin === 'stopping' || spin === 'done'}
                aria-label={t('gameLastBox.spinLabel')}
                className="relative block h-full w-full rounded-full shadow-2xl"
                style={{ transform: `rotate(${angle}deg)`, border: '0.9cqw solid #92400e', background: '#92400e' }}
              >
                <svg viewBox="-100 -100 200 200" className="h-full w-full">
                  {SLICES.map((s, i) => {
                    const a0 = ((i * 45 - 90) * Math.PI) / 180;
                    const a1 = (((i + 1) * 45 - 90) * Math.PI) / 180;
                    const am = (((i + 0.5) * 45 - 90) * Math.PI) / 180;
                    const R = 96;
                    const d = `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
                    const ix = 62 * Math.cos(am);
                    const iy = 62 * Math.sin(am);
                    const icon = s.kind === 'listening' || s.kind === 'speaking' || s.kind === 'writing' ? IMG(SKILL_ICON[s.kind]) : null;
                    return (
                      <g key={i}>
                        <path d={d} fill={s.color} stroke="#fff" strokeWidth="2.5" />
                        {icon ? (
                          <image href={icon} x={ix - 14} y={iy - 14} width="28" height="28" transform={`rotate(${(i + 0.5) * 45} ${ix} ${iy})`} />
                        ) : (
                          <text x={ix} y={iy + 8} textAnchor="middle" fontSize="26" transform={`rotate(${(i + 0.5) * 45} ${ix} ${iy})`}>
                            {s.kind === 'choose' ? '⭐' : '⏭️'}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  <circle r="14" fill="#fef3c7" stroke="#92400e" strokeWidth="3" />
                </svg>
              </button>
            </div>
            <div className="mt-[1.2cqw] rounded-full bg-white/90 px-[2cqw] py-[0.5cqw] font-bold text-slate-800" style={{ fontSize: 'clamp(12px,1.9cqw,26px)' }}>
              {spin === 'idle' && t('gameLastBox.spinStart')}
              {spin === 'fast' && t('gameLastBox.spinStop')}
              {spin === 'stopping' && t('gameLastBox.spinning')}
              {spin === 'done' && slice !== null && t(`gameLastBox.slice_${SLICES[slice].kind}`)}
            </div>
          </div>
        )}

        {/* 도전 */}
        {phase === 'challenge' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-[2.5%]">
            <div className={`lb-anim ${paper} relative flex max-h-full w-[min(92%,900px)] flex-col items-center gap-[1.2cqw] overflow-auto p-[2.6cqw] text-center`} style={{ animation: 'lb-pop .45s both' }}>
              {needChoose && (
                <>
                  <div className="font-black text-deep-navy" style={{ fontSize: 'clamp(16px,3cqw,40px)' }}>{t('gameLastBox.chooseTitle')}</div>
                  <div className="flex flex-wrap justify-center gap-[1.4cqw]">
                    {(['listening', 'speaking', 'writing'] as ChallengeSkill[]).map((k) => (
                      <button key={k} type="button" onClick={() => openChallenge(k)} className="flex w-[17cqw] flex-col items-center gap-[0.4cqw] rounded-[1.2cqw] border-[0.3cqw] bg-white px-[1cqw] py-[1cqw] font-bold shadow hover:scale-105" style={{ borderColor: SKILL_COLOR[k], color: SKILL_COLOR[k], fontSize: 'clamp(13px,2cqw,28px)' }}>
                        <img src={IMG(SKILL_ICON[k])} alt="" className="h-[7cqw] object-contain" draggable={false} />
                        {t(`gameLastBox.skill_${k}`)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {!needChoose && resolved === 'skip' && !challenge && (
                <>
                  <img src={IMG('gift')} alt="" draggable={false} className="lb-anim h-[14cqw] object-contain" style={{ animation: 'lb-bob 1.6s ease-in-out infinite' }} />
                  <div className="font-black text-deep-navy" style={{ fontSize: 'clamp(18px,3.6cqw,48px)' }}>{t('gameLastBox.skipTitle')}</div>
                  <div className="text-on-surface-variant" style={{ fontSize: 'clamp(12px,1.8cqw,24px)' }}>{t('gameLastBox.skipDesc')}</div>
                </>
              )}

              {challenge && (
                <>
                  <div className="flex items-center gap-[1cqw]">
                    <img src={IMG(SKILL_ICON[challenge.skill])} alt="" draggable={false} className="h-[7cqw] object-contain" />
                    <div className="text-left">
                      <div className="font-black" style={{ color: SKILL_COLOR[challenge.skill], fontSize: 'clamp(16px,3cqw,40px)' }}>
                        {t(`gameLastBox.ch_${challenge.kind}_title`)}
                      </div>
                      <div className="font-bold text-slate-600" style={{ fontSize: 'clamp(11px,1.7cqw,23px)' }}>
                        {t(`gameLastBox.ch_${challenge.kind}_steps`)}
                      </div>
                    </div>
                  </div>
                  <div className="my-[0.6cqw] w-full">{challengeBody(challenge)}</div>

                  {needsAnswer && (
                    <div className="w-full">
                      {showAnswer ? (
                        <div className="lb-anim rounded-[1cqw] bg-emerald-50 px-[1.4cqw] py-[0.8cqw] font-bold text-emerald-800" style={{ animation: 'lb-pop .35s both', fontSize: 'clamp(14px,2.4cqw,32px)' }}>
                          ✓ {challenge.answer}
                          {challenge.ko && <div className="font-normal text-emerald-700" style={{ fontSize: 'clamp(11px,1.6cqw,22px)' }}>{challenge.ko}</div>}
                        </div>
                      ) : (
                        <button type="button" onClick={() => setShowAnswer(true)} className={btn} style={{ ...bf, background: '#f59e0b' }}>
                          {t('gameLastBox.showAnswer')}
                        </button>
                      )}
                    </div>
                  )}

                  {!resolved && (
                    <div className="flex flex-wrap items-center justify-center gap-[1cqw]">
                      <button type="button" onClick={() => finish('win')} className={btn} style={{ ...bf, background: '#10b981' }}>
                        ✓ {t('gameLastBox.success', { n: teamNo(turn) })}
                      </button>
                      <button type="button" onClick={() => finish('lose')} className={btn} style={{ ...bf, background: '#f43f5e' }}>
                        ✗ {t('gameLastBox.fail')}
                      </button>
                      <button type="button" onClick={() => openChallenge(challenge.skill, challenge.kind)} className="font-label-md text-label-md text-on-surface-variant hover:underline">
                        ↻ {t('gameLastBox.another')}
                      </button>
                    </div>
                  )}
                </>
              )}

              {resolved === 'win' && (
                <div className="lb-anim font-black text-emerald-600" style={{ animation: 'lb-pop .4s both', fontSize: 'clamp(18px,3.4cqw,46px)' }}>
                  ⭐ {t('gameLastBox.winBanner', { n: teamNo(turn) })}
                </div>
              )}
              {resolved === 'lose' && (
                <div className="lb-anim font-black text-rose-500" style={{ animation: 'lb-pop .4s both', fontSize: 'clamp(16px,3cqw,40px)' }}>
                  {t('gameLastBox.loseBanner')}
                </div>
              )}
              {resolved && (
                <button type="button" onClick={nextRound} className={btn} style={{ ...bf, background: '#6366f1' }}>
                  {t('gameLastBox.nextRound', { n: teamNo(turn) })}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 text-center font-caption text-caption text-on-surface-variant">{t('gameLastBox.rule')}</div>
    </div>
  );
});

export default LastBoxChallenge;
