import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_SFX, GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import { useRemoteActions, useRemoteSecret } from '../lib/remote';
import type { GameItem, UndoHandle } from '../lib/types';

/**
 * 단서 네 개(2026-10-14) — PPT "4 Words 1 Question"의 방식(단서를 하나씩 보고 비밀 낱말을 맞히고, 그 낱말로 질문을 만든다)만
 * 참고한 모둠 대결. 단서는 사전(주제·예문·그림·우리말 뜻)과 글자 정보로 자동으로 만든다. 단서를 적게 쓸수록 높은 점수.
 */

export interface ClueInfo {
  meaning?: string | null;
  example?: string | null;
  pos?: string | null;
  category?: string | null;
  imageUrl?: string | null;
}

interface Props {
  items: GameItem[];
  teams: number;
  /** 소문자 낱말 → 사전 정보 */
  info: Record<string, ClueInfo>;
}

type Phase = 'play' | 'bonus' | 'reveal';
type ClueKind = 'topic' | 'sentence' | 'picture' | 'length' | 'pattern' | 'first' | 'last' | 'meaning';

interface Clue {
  kind: ClueKind;
  text: string;
  image?: string;
}

const TEAM_COLORS = ['#ef5b5b', '#3b82f6', '#22a559', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5a4', '#78716c'];
const TEAM_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const IMG = (n: string) => `/skins/clues/${n}.webp`;
const MAX_CLUES = 4;
const BONUS_POINTS = 1;
/** 단서를 n개 열었을 때 맞히면 받는 점수 */
const pointsFor = (open: number) => MAX_CLUES + 1 - open;

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 낱말 하나의 단서 네 개 — 어려운 것부터 쉬운 순서. 정보가 없는 낱말도 글자 단서로 항상 네 개가 나온다. */
export function buildClues(word: string, info: ClueInfo | undefined, t: (k: string, o?: Record<string, unknown>) => string): Clue[] {
  const w = word.trim();
  const letters = [...w.replace(/\s+/g, '')];
  const avail: Partial<Record<ClueKind, Clue>> = {};
  const topic = [info?.category, info?.pos].filter(Boolean).join(' · ');
  if (topic) avail.topic = { kind: 'topic', text: topic };
  if (info?.example) {
    const re = new RegExp(`\\b${escapeRe(w)}\\b`, 'i');
    if (re.test(info.example)) avail.sentence = { kind: 'sentence', text: info.example.replace(re, '_____') };
  }
  if (info?.imageUrl) avail.picture = { kind: 'picture', text: '', image: info.imageUrl };
  avail.length = { kind: 'length', text: t('gameFourClues.lengthClue', { n: letters.length }) };
  if (letters.length >= 3) {
    const pat = [...w].map((c, i) => (c === ' ' ? '  ' : i === 0 || i === w.length - 1 ? c.toUpperCase() : '＿')).join(' ');
    avail.pattern = { kind: 'pattern', text: pat };
  }
  avail.first = { kind: 'first', text: t('gameFourClues.firstClue', { c: letters[0]?.toUpperCase() ?? '' }) };
  avail.last = { kind: 'last', text: t('gameFourClues.lastClue', { c: letters[letters.length - 1]?.toUpperCase() ?? '' }) };
  if (info?.meaning) avail.meaning = { kind: 'meaning', text: info.meaning };
  const order: ClueKind[] = ['topic', 'sentence', 'picture', 'length', 'first', 'pattern', 'last', 'meaning'];
  const picked = order.filter((k) => avail[k]).slice(0, MAX_CLUES);
  // 우리말 뜻은 가장 쉬운 단서라 있으면 마지막 칸에 둔다
  if (avail.meaning && !picked.includes('meaning')) picked[MAX_CLUES - 1] = 'meaning';
  return picked.map((k) => avail[k] as Clue);
}

interface Snapshot {
  scores: number[];
  turn: number;
  openCount: number;
  locked: number[];
  pos: number;
  phase: Phase;
  round: number;
  guesser: number | null;
}

const STYLE = `
@keyframes fcl-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4%)} }
@keyframes fcl-shake { 0%,100%{transform:translateX(0) rotate(0)} 20%{transform:translateX(-6%) rotate(-3deg)} 40%{transform:translateX(6%) rotate(3deg)}
  60%{transform:translateX(-4%) rotate(-2deg)} 80%{transform:translateX(3%) rotate(2deg)} }
@keyframes fcl-pop { 0%{transform:scale(.2);opacity:0} 60%{transform:scale(1.18);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes fcl-rays { from{transform:translate(-50%,-50%) rotate(0)} to{transform:translate(-50%,-50%) rotate(360deg)} }
@keyframes fcl-star { 0%{transform:translate(0,0) scale(.3) rotate(0);opacity:0} 15%{opacity:1}
  100%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(360deg);opacity:0} }
@keyframes fcl-score { 0%{transform:scale(1)} 40%{transform:scale(1.4)} 100%{transform:scale(1)} }
@keyframes fcl-letter { 0%{transform:translateY(60%) scale(.3);opacity:0} 70%{transform:translateY(-12%) scale(1.15);opacity:1} 100%{transform:none;opacity:1} }
.fcl-card { perspective: 900px; }
.fcl-card-inner { position:relative; width:100%; height:100%; transition: transform .6s cubic-bezier(.3,1.3,.5,1); transform-style: preserve-3d; }
.fcl-card.fcl-open .fcl-card-inner { transform: rotateY(180deg); }
.fcl-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; }
.fcl-front { transform: rotateY(180deg); }
@media (prefers-reduced-motion: reduce) {
  .fcl-anim, .fcl-card-inner { animation-duration:.01s !important; transition-duration:.01s !important; animation-iteration-count:1 !important; }
}
`;

const FOUR = [0, 1, 2, 3];

const FourClues = forwardRef<UndoHandle, Props>(function FourClues({ items, teams, info }, ref) {
  const { t } = useTranslation();
  const teamCount = Math.min(8, Math.max(2, teams));
  const itemKey = items.map((i) => i.id).join(',');
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState<number[]>(() => Array(teamCount).fill(0));
  const [turn, setTurn] = useState(0);
  const [openCount, setOpenCount] = useState(1);
  const [locked, setLocked] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('play');
  const [guesser, setGuesser] = useState<number | null>(null);
  const [boxOpen, setBoxOpen] = useState(false);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  const [pulse, setPulse] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [peek, setPeek] = useState(false);
  // 새 낱말은 첫 카드도 물음표로 시작해 잠깐 뒤 뒤집어 보여 준다(선생님 제안 2026-10-16)
  const [firstShown, setFirstShown] = useState(false);
  useEffect(() => {
    setFirstShown(false);
    const id = window.setTimeout(() => {
      setFirstShown(true);
      playSfx(GAME_SFX.fourclues.flip);
    }, 800);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, round, itemKey]);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  useEffect(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setOrder(shuffle(items.map((_, i) => i)));
    setPos(0);
    setRound(1);
    setScores(Array(teamCount).fill(0));
    setTurn(0);
    setOpenCount(1);
    setLocked([]);
    setPhase('play');
    setGuesser(null);
    setBoxOpen(false);
    setSnapshot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamCount, itemKey]);

  const word = items.length > 0 && order.length > 0 ? (items[order[pos % order.length]]?.label ?? '') : '';
  const wordInfo = info[word.trim().toLowerCase()];
  const clues = useMemo(() => (word ? buildClues(word, wordInfo, t as never) : []), [word, wordInfo, t]);
  useEffect(() => setPeek(false), [pos, round, phase]);
  const teamName = (i: number) => t('gameFourClues.teamName', { name: TEAM_NAMES[i] });
  // 선생님 폰 리모컨에는 지금 낱말(정답)을 알려 준다 — 칠판에는 안 보이고 폰에서만 눌러서 본다
  useRemoteSecret(word && phase === 'play' ? { title: t('gameFourClues.remoteSecretTitle'), text: word, sub: wordInfo?.meaning ?? undefined } : null);

  function snap() {
    setSnapshot({ scores: [...scores], turn, openCount, locked: [...locked], pos, phase, round, guesser });
  }

  function nextFree(from: number, lockedList: number[]): number {
    for (let k = 1; k <= teamCount; k++) {
      const c = (from + k) % teamCount;
      if (!lockedList.includes(c)) return c;
    }
    return from;
  }

  /** 선생님도 낱말을 모를 때 — 눌러서 3초만 정답을 본다(판정용) */
  function peekAnswer() {
    setPeek(true);
    later(() => setPeek(false), 3000);
  }

  function openNext() {
    if (phase !== 'play' || openCount >= MAX_CLUES) return;
    snap();
    playSfx(GAME_SFX.fourclues.flip);
    setOpenCount((n) => n + 1);
    setTurn((cur) => nextFree(cur, locked));
  }

  function judgeRight() {
    if (phase !== 'play' || !word) return;
    snap();
    const gain = pointsFor(openCount);
    playSfx(GAME_SFX.fourclues.correct);
    setScores((s) => s.map((v, i) => (i === turn ? v + gain : v)));
    setGuesser(turn);
    setPulse(turn);
    later(() => setPulse(null), 700);
    setPhase('bonus');
    later(() => playSfx(COMMON_SFX.praise), 700);
  }

  function judgeWrong() {
    if (phase !== 'play') return;
    snap();
    playSfx(GAME_SFX.fourclues.wrong);
    setShakeIdx(openCount - 1);
    later(() => setShakeIdx(null), 600);
    const nextLocked = [...locked, turn];
    setLocked(nextLocked);
    if (nextLocked.length >= teamCount) {
      finishRound(false);
      return;
    }
    setTurn(nextFree(turn, nextLocked));
    if (openCount < MAX_CLUES) {
      later(() => playSfx(GAME_SFX.fourclues.flip), 350);
      setOpenCount((n) => n + 1);
    }
  }

  function bonus(ok: boolean) {
    if (phase !== 'bonus') return;
    snap();
    if (ok && guesser !== null) {
      playSfx(GAME_SFX.fourclues.correct);
      setScores((s) => s.map((v, i) => (i === guesser ? v + BONUS_POINTS : v)));
      setPulse(guesser);
      later(() => setPulse(null), 700);
    }
    finishRound(true);
  }

  function finishRound(solved: boolean) {
    setPhase('reveal');
    setBoxOpen(false);
    playSfx(GAME_SFX.fourclues.reveal);
    later(() => {
      setBoxOpen(true);
      if (solved) playSfx(GAME_SFX.fourclues.finish);
      if (word) speak(word);
    }, 900);
  }

  function nextRound() {
    if (phase !== 'reveal') return;
    snap();
    let np = pos + 1;
    if (np >= order.length) {
      setOrder(shuffle(items.map((_, i) => i)));
      np = 0;
    }
    setPos(np);
    setRound((r) => r + 1);
    setOpenCount(1);
    setLocked([]);
    setGuesser(null);
    setBoxOpen(false);
    setTurn(round % teamCount);
    setPhase('play');
    playSfx(GAME_SFX.fourclues.flip);
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!snapshot) return;
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      setScores(snapshot.scores);
      setTurn(snapshot.turn);
      setOpenCount(snapshot.openCount);
      setLocked(snapshot.locked);
      setPos(snapshot.pos);
      setPhase(snapshot.phase);
      setRound(snapshot.round);
      setGuesser(snapshot.guesser);
      setBoxOpen(false);
      setSnapshot(null);
    },
  }));

  useRemoteActions(
    phase === 'play'
      ? [
          { id: 'right', label: t('gameFourClues.judgeRight', { n: pointsFor(openCount) }), tone: 'good', run: judgeRight },
          { id: 'wrong', label: t('gameFourClues.judgeWrong'), tone: 'bad', run: judgeWrong },
          ...(openCount < MAX_CLUES ? [{ id: 'clue', label: t('gameFourClues.nextClue'), tone: 'primary' as const, run: openNext }] : []),
        ]
      : phase === 'bonus'
        ? [
            { id: 'bonusYes', label: t('gameFourClues.bonusYes', { n: BONUS_POINTS }), tone: 'good', run: () => bonus(true) },
            { id: 'bonusSkip', label: t('gameFourClues.bonusSkip'), tone: 'neutral', run: () => bonus(false) },
          ]
        : boxOpen
          ? [{ id: 'next', label: t('gameFourClues.nextRound'), tone: 'primary', run: nextRound }]
          : [],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        {t('gameFourClues.needWords')}
      </div>
    );
  }

  const btn = 'rounded-full px-[1.6cqw] py-[0.7cqw] font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95';
  const fs = { fontSize: 'clamp(11px, 1.7cqw, 24px)' } as const;

  return (
    <div className="mx-auto w-full max-w-[1100px] select-none">
      <style>{STYLE}</style>

      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {scores.map((s, i) => {
          const active = i === turn && phase === 'play';
          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded-full px-4 py-1.5 font-title-md text-title-md text-white shadow-md transition-transform"
              style={{
                background: TEAM_COLORS[i],
                outline: active ? '4px solid #fde68a' : 'none',
                transform: active ? 'scale(1.1)' : 'none',
                opacity: locked.includes(i) && phase === 'play' ? 0.45 : 1,
              }}
            >
              <span>{teamName(i)}</span>
              <span
                className="fcl-anim min-w-[1.6em] rounded-full bg-white/90 px-2 text-center font-bold"
                style={{ color: TEAM_COLORS[i], animation: pulse === i ? 'fcl-score .6s' : undefined }}
              >
                {s}
              </span>
            </div>
          );
        })}
        <span className="rounded-full bg-amber-100 px-3 py-1 font-label-md text-label-md text-amber-900">
          {t('gameFourClues.roundLabel', { n: round })}
        </span>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-[24px] shadow-lg"
        style={{ aspectRatio: '16 / 9', containerType: 'size', background: `#4a3b6b url(${IMG('scene')}) center / cover no-repeat` }}
      >
        {/* 위쪽 안내 */}
        <div className="absolute left-0 right-0 top-[2.5%] z-10 text-center">
          <span className="inline-block rounded-full bg-white/85 px-[2.4cqw] py-[0.6cqw] font-bold text-slate-800 shadow" style={{ fontSize: 'clamp(12px, 2cqw, 26px)' }}>
            {phase === 'play' && t('gameFourClues.turnHint', { team: teamName(turn), n: pointsFor(openCount) })}
            {phase === 'bonus' && t('gameFourClues.bonusHint')}
            {phase === 'reveal' && t('gameFourClues.revealHint')}
          </span>
        </div>

        {/* 단서 카드 네 장 — 장면 속 액자 안 */}
        <div className="absolute flex items-center justify-between" style={{ left: '22%', width: '56%', top: '39%', height: '38%' }}>
          {FOUR.map((i) => {
            const clue = clues[i];
            const opened = (i === 0 ? firstShown && openCount >= 1 : i < openCount) || phase === 'reveal';
            return (
              <div
                key={i}
                className={`fcl-card ${opened ? 'fcl-open' : ''} fcl-anim`}
                style={{
                  width: '22.5%',
                  height: '100%',
                  animation: shakeIdx === i ? 'fcl-shake .6s' : !opened ? `fcl-float 2.6s ${i * 0.25}s ease-in-out infinite` : undefined,
                }}
              >
                <div className="fcl-card-inner">
                  <div className="fcl-face">
                    <img src={IMG('card-back')} alt="" draggable={false} className="h-full w-full object-contain drop-shadow-lg" />
                  </div>
                  <div className="fcl-face fcl-front flex flex-col items-center justify-center overflow-hidden rounded-[1.2cqw] border-[0.4cqw] border-amber-400 bg-[#fffaf0] p-[0.6cqw] text-center shadow-lg">
                    {clue && (
                      <>
                        <div className="mb-[0.3cqw] rounded-full bg-indigo-100 px-[0.8cqw] font-bold text-indigo-700" style={{ fontSize: 'clamp(8px, 1.1cqw, 15px)' }}>
                          {t(`gameFourClues.kind_${clue.kind}`)}
                        </div>
                        {clue.image ? (
                          <div className="relative min-h-0 w-full flex-1">
                            <img
                              src={clue.image}
                              alt=""
                              draggable={false}
                              className="absolute inset-0 h-full w-full object-contain"
                              style={{ filter: phase === 'reveal' ? 'none' : `blur(${Math.max(0, 5 - i * 1.5)}px)` }}
                            />
                          </div>
                        ) : (
                          <div
                            className="font-bold leading-tight text-deep-navy"
                            style={{ fontSize: clue.text.length > 36 ? 'clamp(8px,1.15cqw,16px)' : clue.kind === 'pattern' ? 'clamp(11px,1.8cqw,26px)' : 'clamp(10px,1.5cqw,22px)', wordBreak: 'keep-all' }}
                          >
                            {clue.text}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 조작 줄 — 책상 위 */}
        {phase === 'play' && (
          <div className="absolute inset-x-0 bottom-[3%] z-10 flex flex-wrap items-center justify-center gap-[1cqw]">
            <button type="button" onClick={judgeRight} className={btn} style={{ ...fs, background: '#10b981' }}>
              ✓ {t('gameFourClues.judgeRight', { n: pointsFor(openCount) })}
            </button>
            <button type="button" onClick={judgeWrong} className={btn} style={{ ...fs, background: '#f43f5e' }}>
              ✗ {t('gameFourClues.judgeWrong')}
            </button>
            <button type="button" onClick={peekAnswer} className={btn} style={{ ...fs, background: '#64748b' }}>
              👀 {t('gameFourClues.peek')}
            </button>
            {openCount < MAX_CLUES && (
              <button type="button" onClick={openNext} className={btn} style={{ ...fs, background: '#6366f1' }}>
                {t('gameFourClues.nextClue')}
              </button>
            )}
          </div>
        )}

        {/* 선생님용 정답 엿보기 — 3초 뒤 저절로 가려진다 */}
        {peek && phase === 'play' && (
          <div className="absolute left-1/2 top-[12%] z-40 -translate-x-1/2 rounded-[1.4cqw] bg-slate-900/90 px-[2.4cqw] py-[0.8cqw] text-center text-white shadow-xl">
            <div className="text-slate-300" style={{ fontSize: 'clamp(10px,1.3cqw,18px)' }}>{t('gameFourClues.peekTitle')}</div>
            <div className="font-black" style={{ fontSize: 'clamp(18px,3.4cqw,46px)' }}>{word}</div>
            {wordInfo?.meaning && <div className="text-amber-200" style={{ fontSize: 'clamp(11px,1.7cqw,24px)' }}>{wordInfo.meaning}</div>}
          </div>
        )}

        {/* 질문 만들기 */}
        {phase === 'bonus' && guesser !== null && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-[3%]">
            <div
              className="fcl-anim w-[min(86%,640px)] rounded-[28px] bg-[#fffdf8] p-[4%] text-center shadow-2xl"
              style={{ animation: 'fcl-pop .4s both', border: `0.8cqw solid ${TEAM_COLORS[guesser]}` }}
            >
              <img src={IMG('magnifier')} alt="" className="mx-auto mb-2 h-[9cqw] max-h-[110px] object-contain" />
              <div className="mb-1 font-title-md text-title-md text-deep-navy">{t('gameFourClues.bonusTitle', { team: teamName(guesser) })}</div>
              <div className="mb-4 font-body-md text-body-md text-on-surface-variant">{t('gameFourClues.bonusDesc', { word })}</div>
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => bonus(true)} className="rounded-full bg-emerald-500 px-7 py-3 font-title-md text-title-md text-white shadow hover:bg-emerald-600">
                  ✓ {t('gameFourClues.bonusYes', { n: BONUS_POINTS })}
                </button>
                <button type="button" onClick={() => bonus(false)} className="rounded-full bg-slate-400 px-7 py-3 font-title-md text-title-md text-white shadow hover:bg-slate-500">
                  {t('gameFourClues.bonusSkip')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 정답 공개 — 상자가 흔들리다 열린다 */}
        {phase === 'reveal' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/55">
            {boxOpen && (
              <>
                <div
                  className="fcl-anim pointer-events-none absolute left-1/2 top-[42%] aspect-square w-[70%]"
                  style={{
                    background: 'repeating-conic-gradient(from 0deg, rgba(253,224,71,.5) 0 8deg, rgba(253,224,71,0) 8deg 24deg)',
                    borderRadius: '50%',
                    animation: 'fcl-rays 10s linear infinite',
                    maskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
                    WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
                  }}
                />
                {Array.from({ length: 14 }, (_, p) => (
                  <span
                    key={p}
                    className="fcl-anim pointer-events-none absolute left-1/2 top-[42%] text-[2.2cqw]"
                    style={{
                      ['--dx' as string]: `${Math.cos((p / 14) * Math.PI * 2) * (16 + (p % 3) * 5)}cqw`,
                      ['--dy' as string]: `${Math.sin((p / 14) * Math.PI * 2) * (10 + (p % 4) * 3)}cqw`,
                      animation: `fcl-star 1.6s ${(p % 5) * 0.07}s both`,
                    }}
                  >
                    ★
                  </span>
                ))}
              </>
            )}
            <img
              src={IMG(boxOpen ? 'box-open' : 'box-closed')}
              alt=""
              draggable={false}
              className="fcl-anim relative h-[34%] object-contain"
              style={{ animation: boxOpen ? 'fcl-pop .5s both' : 'fcl-shake .5s .1s 2' }}
            />
            {boxOpen && (
              <div className="relative mt-[1cqw] text-center">
                <div className="flex flex-wrap items-center justify-center gap-[0.5cqw]">
                  {[...word].map((c, i) => (
                    <span
                      key={i}
                      className="fcl-anim inline-block rounded-[0.8cqw] bg-white px-[1cqw] py-[0.2cqw] font-bold text-deep-navy shadow-lg"
                      style={{ fontSize: 'clamp(22px, 5.6cqw, 72px)', animation: `fcl-letter .5s ${i * 0.06}s both`, minWidth: c === ' ' ? '1cqw' : undefined }}
                    >
                      {c === ' ' ? ' ' : c}
                    </span>
                  ))}
                </div>
                {wordInfo?.meaning && (
                  <div className="mt-[0.8cqw] font-bold text-amber-100" style={{ fontSize: 'clamp(14px, 2.4cqw, 32px)' }}>
                    {wordInfo.meaning}
                  </div>
                )}
                <div className="mt-[1.2cqw] flex justify-center gap-3">
                  <button type="button" onClick={() => speak(word)} className="rounded-full bg-white/90 px-5 py-2 font-label-md text-label-md text-primary shadow hover:bg-white">
                    🔊 {t('gameFourClues.listen')}
                  </button>
                  <button type="button" onClick={nextRound} className="rounded-full bg-amber-400 px-6 py-2 font-title-md text-title-md text-amber-950 shadow-lg hover:bg-amber-300">
                    {t('gameFourClues.nextRound')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 text-center font-caption text-caption text-on-surface-variant">
        {t('gameFourClues.scoreRule', { max: pointsFor(1), min: pointsFor(MAX_CLUES), bonus: BONUS_POINTS })}
      </div>
    </div>
  );
});

export default FourClues;
