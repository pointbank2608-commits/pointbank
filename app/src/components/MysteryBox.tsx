import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_SFX, GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import { useRemoteActions } from '../lib/remote';
import { applyReward, blockLabel, isGood, rewardDeck, type Reward } from '../lib/mysteryBox';
import type { GameItem, UndoHandle } from '../lib/types';

/**
 * 미스터리 박스(2026-10-14) — PPT "Super Mario Mystery Box"의 방식만 참고한 모둠 대결.
 * 팀이 돌아가며 칸(상자)을 골라 문제를 맞히면 미스터리 박스를 받는다. 열기 전에 "내가 가질지, 다른 팀에게 줄지" 정하고,
 * 열어 보면 점수를 받거나 잃는다(좋을 수도, 나쁠 수도!). 모든 칸을 열면 순위가 나온다.
 */

interface Props {
  items: GameItem[];
  teams: number;
  /** 칸 수(20·28) */
  blocks: number;
}

type Phase = 'board' | 'question' | 'box' | 'give' | 'open' | 'target' | 'done' | 'final';

const TEAM_COLORS = ['#ef5b5b', '#3b82f6', '#22a559', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5a4', '#78716c'];
const TEAM_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const IMG = (n: string) => `/skins/mystery/${n}.webp`;

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function parseItem(raw: string): { text: string; sub: string } {
  const cut = raw.indexOf(' | ');
  return cut >= 0 ? { text: raw.slice(0, cut).trim(), sub: raw.slice(cut + 3).trim() } : { text: raw.trim(), sub: '' };
}

interface Snapshot {
  scores: number[];
  opened: number[];
  turn: number;
  cardPos: number;
}

const STYLE = `
@keyframes mb-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7%)} }
@keyframes mb-pop { 0%{transform:scale(.3) rotate(-8deg);opacity:0} 60%{transform:scale(1.12) rotate(3deg);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes mb-hit { 0%{transform:translateY(0)} 30%{transform:translateY(-14%) scale(1.08)} 100%{transform:translateY(0)} }
@keyframes mb-shake { 0%,100%{transform:translateX(0) rotate(0)} 20%{transform:translateX(-6%) rotate(-5deg)} 40%{transform:translateX(6%) rotate(5deg)} 60%{transform:translateX(-4%) rotate(-3deg)} 80%{transform:translateX(3%) rotate(2deg)} }
@keyframes mb-coin { 0%{transform:translate(0,0) rotate(0) scale(.5);opacity:0} 15%{opacity:1} 100%{transform:translate(var(--dx),var(--dy)) rotate(540deg) scale(1);opacity:0} }
@keyframes mb-rays { from{transform:translate(-50%,-50%) rotate(0)} to{transform:translate(-50%,-50%) rotate(360deg)} }
@keyframes mb-score { 0%{transform:scale(1)} 40%{transform:scale(1.4)} 100%{transform:scale(1)} }
@keyframes mb-boom { 0%{transform:scale(.4);opacity:0} 40%{transform:scale(1.5);opacity:1} 100%{transform:scale(2.4);opacity:0} }
.mb-block { transition: transform .15s; }
.mb-block:hover:not(:disabled) { transform: translateY(-6%) scale(1.05); }
.mb-block:disabled { cursor: default; }
@media (prefers-reduced-motion: reduce) { .mb-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

const MysteryBox = forwardRef<UndoHandle, Props>(function MysteryBox({ items, teams, blocks }, ref) {
  const { t } = useTranslation();
  const teamCount = Math.min(8, Math.max(2, teams));
  const blockCount = blocks <= 20 ? 20 : 28;
  const cols = blockCount === 20 ? 5 : 7;
  const rows = blockCount / cols;
  const itemKey = items.map((i) => i.id + i.label).join('|');

  const [deck, setDeck] = useState<Reward[]>(() => shuffle(rewardDeck()).slice(0, blockCount));
  const [opened, setOpened] = useState<number[]>([]);
  const [scores, setScores] = useState<number[]>(() => Array(teamCount).fill(0));
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<Phase>('board');
  const [sel, setSel] = useState<number | null>(null);
  const [recv, setRecv] = useState(0);
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [cardPos, setCardPos] = useState(0);
  const [showSub, setShowSub] = useState(false);
  const [lastReward, setLastReward] = useState<Reward | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const [pulse, setPulse] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
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
    setDeck(shuffle(rewardDeck()).slice(0, blockCount));
    setOpened([]);
    setScores(Array(teamCount).fill(0));
    setTurn(0);
    setPhase('board');
    setSel(null);
    setOrder(shuffle(items.map((_, i) => i)));
    setCardPos(0);
    setSnapshot(null);
    setLastReward(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamCount, blockCount, itemKey]);

  const card = useMemo(() => {
    if (items.length === 0 || order.length === 0) return { text: '', sub: '' };
    return parseItem(items[order[cardPos % order.length]]?.label ?? '');
  }, [items, order, cardPos]);
  useEffect(() => setShowSub(false), [cardPos, sel]);

  const teamName = (i: number) => t('gameMysteryBox.teamName', { name: TEAM_NAMES[i] });

  function snap() {
    setSnapshot({ scores: [...scores], opened: [...opened], turn, cardPos });
  }

  function pickBlock(i: number) {
    if (phase !== 'board' || opened.includes(i)) return;
    playSfx(GAME_SFX.mysterybox.pick);
    setSel(i);
    setPhase('question');
    if (card.text) speak(card.text);
  }

  function judge(ok: boolean) {
    if (phase !== 'question' || sel === null) return;
    snap();
    if (!ok) {
      playSfx(GAME_SFX.mysterybox.wrong);
      setShake(sel);
      later(() => setShake(null), 600);
      setCardPos((p) => p + 1);
      setTurn((v) => (v + 1) % teamCount);
      setSel(null);
      setPhase('board');
      return;
    }
    playSfx(GAME_SFX.mysterybox.correct);
    setCardPos((p) => p + 1);
    setRecv(turn);
    setPhase('box');
  }

  function keep() {
    setRecv(turn);
    openBox(turn);
  }

  function openBox(to: number) {
    if (sel === null) return;
    setRecv(to);
    setPhase('open');
    setLastReward(deck[sel]);
    playSfx(GAME_SFX.mysterybox.open);
    const r = deck[sel];
    later(() => {
      if (r.kind === 'swap' || r.kind === 'steal') {
        setPhase('target');
        return;
      }
      settle(to, r);
    }, 1300);
  }

  function settle(to: number, r: Reward, target?: number) {
    const next = applyReward(scores, to, r, target);
    setScores(next);
    setPulse(to);
    later(() => setPulse(null), 800);
    if (r.kind === 'sub' || r.kind === 'lose' || r.kind === 'half') playSfx(GAME_SFX.mysterybox.bad);
    else playSfx(GAME_SFX.mysterybox.good);
    if (r.kind === 'lose' || r.kind === 'sub') later(() => playSfx(GAME_SFX.mysterybox.boom), 200);
    setPhase('done');
  }

  function finishTurn() {
    if (sel === null) return;
    const nextOpened = [...opened, sel];
    setOpened(nextOpened);
    setSel(null);
    setLastReward(null);
    if (nextOpened.length >= blockCount) {
      playSfx(COMMON_SFX.praise);
      setPhase('final');
      return;
    }
    setTurn((v) => (v + 1) % teamCount);
    setPhase('board');
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!snapshot || (phase !== 'board' && phase !== 'final')) return;
      clearTimers();
      setScores(snapshot.scores);
      setOpened(snapshot.opened);
      setTurn(snapshot.turn);
      setCardPos(snapshot.cardPos);
      setSel(null);
      setPhase('board');
      setSnapshot(null);
    },
  }));

  const otherTeams = scores.map((_, i) => i).filter((i) => i !== turn);
  const targetTeams = scores.map((_, i) => i).filter((i) => i !== recv);
  useRemoteActions(
    phase === 'board'
      ? [
          {
            id: 'random',
            label: t('gameTreasureDig.randomPick'),
            tone: 'primary',
            run: () => {
              const free = Array.from({ length: blockCount }, (_, i) => i).filter((i) => !opened.includes(i));
              if (free.length > 0) pickBlock(free[Math.floor(Math.random() * free.length)]);
            },
          },
        ]
      : phase === 'question'
        ? [
            { id: 'right', label: t('gameMysteryBox.right'), tone: 'good', run: () => judge(true) },
            { id: 'wrong', label: t('gameMysteryBox.wrong'), tone: 'bad', run: () => judge(false) },
          ]
        : phase === 'box'
          ? [
              { id: 'keep', label: t('gameMysteryBox.keep'), tone: 'good', run: keep },
              { id: 'give', label: t('gameMysteryBox.give'), tone: 'primary', run: () => setPhase('give') },
            ]
          : phase === 'give'
            ? [
                ...otherTeams.map((i) => ({ id: `give${i}`, label: teamName(i), tone: 'team' as const, color: TEAM_COLORS[i], run: () => openBox(i) })),
                { id: 'back', label: t('gameMysteryBox.back'), tone: 'neutral' as const, run: () => setPhase('box') },
              ]
            : phase === 'target' && lastReward
              ? targetTeams.map((i) => ({ id: `target${i}`, label: `${teamName(i)} (${scores[i]})`, tone: 'team' as const, color: TEAM_COLORS[i], run: () => settle(recv, lastReward, i) }))
              : phase === 'done'
                ? [{ id: 'next', label: t('gameMysteryBox.next', { team: teamName((turn + 1) % teamCount) }), tone: 'primary', run: finishTurn }]
                : [],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        {t('gameMysteryBox.needItems')}
      </div>
    );
  }

  const btn = 'rounded-full px-[1.8cqw] py-[0.7cqw] font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95';
  const bf = { fontSize: 'clamp(12px, 1.8cqw, 26px)' } as const;
  const ranking = [...scores.map((s, i) => ({ s, i }))].sort((a, b) => b.s - a.s);

  /** 보상 한 줄 설명(한글) */
  const rewardText = (r: Reward): string => {
    switch (r.kind) {
      case 'add':
        return t('gameMysteryBox.r_add', { n: r.pts });
      case 'sub':
        return t('gameMysteryBox.r_sub', { n: r.pts });
      case 'steal':
        return t('gameMysteryBox.r_steal', { n: r.pts });
      default:
        return t(`gameMysteryBox.r_${r.kind}`);
    }
  };
  const rewardIcon = (r: Reward) => (r.kind === 'sub' || r.kind === 'lose' || r.kind === 'half' ? 'bomb' : r.kind === 'steal' ? 'mask' : r.kind === 'add' && r.pts >= 1000 ? 'star' : r.kind === 'double' || r.kind === 'add' ? 'coins' : 'star');

  return (
    <div className="mx-auto w-full max-w-[1100px] select-none">
      <style>{STYLE}</style>

      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {scores.map((s, i) => {
          const active = i === turn && (phase === 'board' || phase === 'question');
          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded-full px-4 py-1.5 font-title-md text-title-md text-white shadow-md transition-transform"
              style={{ background: TEAM_COLORS[i], outline: active ? '4px solid #fde68a' : 'none', transform: active ? 'scale(1.1)' : 'none' }}
            >
              <span>{teamName(i)}</span>
              <span
                className="mb-anim min-w-[2.4em] rounded-full bg-white/90 px-2 text-center font-bold"
                style={{ color: s < 0 ? '#dc2626' : TEAM_COLORS[i], animation: pulse === i ? 'mb-score .7s' : undefined }}
              >
                {s}
              </span>
            </div>
          );
        })}
        <span className="rounded-full bg-amber-100 px-3 py-1 font-label-md text-label-md text-amber-900">
          {t('gameMysteryBox.left', { n: blockCount - opened.length })}
        </span>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-[24px] shadow-lg"
        style={{ aspectRatio: '16 / 9', containerType: 'size', background: `#7dd3fc url(${IMG('scene')}) center / cover no-repeat` }}
      >
        <div className="absolute left-0 right-0 top-[2%] z-10 text-center">
          <span className="inline-block rounded-full bg-white/90 px-[2.4cqw] py-[0.6cqw] font-bold text-slate-800 shadow" style={{ fontSize: 'clamp(11px, 1.9cqw, 26px)' }}>
            {phase === 'board' && t('gameMysteryBox.pickHint', { team: teamName(turn) })}
            {phase === 'question' && t('gameMysteryBox.questionHint', { team: teamName(turn) })}
            {phase === 'box' && t('gameMysteryBox.boxHint')}
            {phase === 'give' && t('gameMysteryBox.giveHint')}
            {phase === 'open' && t('gameMysteryBox.openHint')}
            {phase === 'target' && t('gameMysteryBox.targetHint')}
            {phase === 'done' && t('gameMysteryBox.doneHint')}
            {phase === 'final' && t('gameMysteryBox.finalHint')}
          </span>
        </div>

        {/* 물음표 블록 격자 */}
        <div
          className="absolute"
          style={{ left: '3%', right: '3%', top: '12%', bottom: '8%', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: '1cqw' }}
        >
          {Array.from({ length: blockCount }, (_, i) => {
            const used = opened.includes(i);
            return (
              <button
                key={i}
                type="button"
                disabled={phase !== 'board' || used}
                onClick={() => pickBlock(i)}
                aria-label={t('gameMysteryBox.blockLabel', { n: blockLabel(i) })}
                className="mb-block mb-anim relative flex items-center justify-center"
                style={{
                  animation: shake === i ? 'mb-shake .6s' : !used && phase === 'board' ? `mb-bob 2.4s ${(i % 7) * 0.18}s ease-in-out infinite` : undefined,
                  filter: sel === i ? 'drop-shadow(0 0 1cqw #fde047)' : undefined,
                }}
              >
                <img src={IMG(used ? 'used' : 'block')} alt="" draggable={false} className="absolute h-[96%] w-[96%] object-contain" />
                {!used && (
                  <span
                    className="absolute bottom-[6%] right-[8%] rounded-full bg-white/95 px-[0.6cqw] font-black leading-none text-amber-900 shadow"
                    style={{ fontSize: 'clamp(9px,1.6cqw,22px)', paddingTop: '0.2cqw', paddingBottom: '0.2cqw' }}
                  >
                    {blockLabel(i)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 문제 */}
        {phase === 'question' && sel !== null && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-[3%]">
            <div className="mb-anim w-[min(88%,660px)] rounded-[28px] bg-[#fffdf8] p-[4%] text-center shadow-2xl" style={{ animation: 'mb-pop .35s both', border: `0.8cqw solid ${TEAM_COLORS[turn]}` }}>
              <div className="mb-2 font-label-md text-label-md text-on-surface-variant">
                {t('gameMysteryBox.cardTitle', { team: teamName(turn), n: blockLabel(sel) })}
              </div>
              <div
                className="mb-3 break-words font-bold text-deep-navy"
                style={{ fontSize: card.text.length > 50 ? 'clamp(16px,2.8cqw,36px)' : card.text.length > 20 ? 'clamp(20px,3.8cqw,50px)' : 'clamp(28px,6cqw,80px)' }}
              >
                {card.text || t('gameMysteryBox.noCard')}
              </div>
              {card.sub && (
                <div className="mb-3">
                  {showSub ? (
                    <div className="font-body-md text-body-md text-on-surface-variant">{card.sub}</div>
                  ) : (
                    <button type="button" onClick={() => setShowSub(true)} className="rounded-full bg-amber-100 px-4 py-1.5 font-label-md text-label-md text-amber-900 hover:bg-amber-200">
                      {t('gameMysteryBox.showAnswer')}
                    </button>
                  )}
                </div>
              )}
              {card.text && (
                <button type="button" onClick={() => speak(card.text)} className="mb-4 rounded-full bg-surface-container-low px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-surface-container">
                  🔊 {t('gameMysteryBox.listen')}
                </button>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={() => judge(true)} className="rounded-full bg-emerald-500 px-8 py-3 font-title-md text-title-md text-white shadow hover:bg-emerald-600">
                  ✓ {t('gameMysteryBox.right')}
                </button>
                <button type="button" onClick={() => judge(false)} className="rounded-full bg-rose-500 px-8 py-3 font-title-md text-title-md text-white shadow hover:bg-rose-600">
                  ✗ {t('gameMysteryBox.wrong')}
                </button>
              </div>
              <button type="button" onClick={() => { setSel(null); setPhase('board'); }} className="mt-3 font-label-md text-label-md text-on-surface-variant hover:underline">
                {t('gameMysteryBox.another')}
              </button>
            </div>
          </div>
        )}

        {/* 상자를 받았다 — 가질까, 줄까 */}
        {(phase === 'box' || phase === 'give') && sel !== null && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-[1.4cqw] bg-black/45 p-[3%] text-center">
            <img src={IMG('block')} alt="" draggable={false} className="mb-anim h-[34%] object-contain" style={{ animation: 'mb-bob 1.4s ease-in-out infinite' }} />
            {phase === 'box' ? (
              <>
                <div className="font-black text-white drop-shadow" style={{ fontSize: 'clamp(16px,3.4cqw,46px)' }}>
                  {t('gameMysteryBox.boxTitle', { team: teamName(turn) })}
                </div>
                <div className="text-amber-100" style={{ fontSize: 'clamp(12px,1.9cqw,26px)' }}>{t('gameMysteryBox.boxDesc')}</div>
                <div className="flex flex-wrap justify-center gap-[1.4cqw]">
                  <button type="button" onClick={keep} className={btn} style={{ ...bf, background: '#10b981' }}>
                    🤲 {t('gameMysteryBox.keep')}
                  </button>
                  <button type="button" onClick={() => setPhase('give')} className={btn} style={{ ...bf, background: '#6366f1' }}>
                    🎁 {t('gameMysteryBox.give')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="font-black text-white drop-shadow" style={{ fontSize: 'clamp(16px,3cqw,40px)' }}>{t('gameMysteryBox.giveTitle')}</div>
                <div className="flex flex-wrap justify-center gap-[1cqw]">
                  {scores.map((_, i) =>
                    i === turn ? null : (
                      <button key={i} type="button" onClick={() => openBox(i)} className={btn} style={{ ...bf, background: TEAM_COLORS[i] }}>
                        {teamName(i)}
                      </button>
                    ),
                  )}
                </div>
                <button type="button" onClick={() => setPhase('box')} className="text-white/80 underline" style={{ fontSize: 'clamp(11px,1.5cqw,20px)' }}>
                  {t('gameMysteryBox.back')}
                </button>
              </>
            )}
          </div>
        )}

        {/* 상자 열기 */}
        {(phase === 'open' || phase === 'target' || phase === 'done') && lastReward && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/55 p-[3%] text-center">
            {phase === 'open' ? (
              <img src={IMG('block')} alt="" draggable={false} className="mb-anim h-[36%] object-contain" style={{ animation: 'mb-shake .5s .1s 3' }} />
            ) : (
              <>
                {isGood(lastReward) && (
                  <>
                    <div
                      className="mb-anim pointer-events-none absolute left-1/2 top-[40%] aspect-square w-[60%]"
                      style={{
                        background: 'repeating-conic-gradient(from 0deg, rgba(253,224,71,.5) 0 8deg, rgba(253,224,71,0) 8deg 24deg)',
                        borderRadius: '50%',
                        animation: 'mb-rays 10s linear infinite',
                        maskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
                        WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
                      }}
                    />
                    {Array.from({ length: 12 }, (_, p) => (
                      <span
                        key={p}
                        className="mb-anim pointer-events-none absolute left-1/2 top-[40%] text-[2.4cqw] text-amber-300"
                        style={{
                          ['--dx' as string]: `${Math.cos((p / 12) * Math.PI * 2) * (14 + (p % 3) * 5)}cqw`,
                          ['--dy' as string]: `${Math.sin((p / 12) * Math.PI * 2) * (8 + (p % 4) * 3)}cqw`,
                          animation: `mb-coin 1.5s ${(p % 5) * 0.07}s both`,
                        }}
                      >
                        ●
                      </span>
                    ))}
                  </>
                )}
                {!isGood(lastReward) && (
                  <span className="mb-anim pointer-events-none absolute left-1/2 top-[40%] h-[22cqw] w-[22cqw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400/70" style={{ animation: 'mb-boom .7s both' }} />
                )}
                <img
                  src={IMG(rewardIcon(lastReward))}
                  alt=""
                  draggable={false}
                  className="mb-anim relative h-[30%] object-contain"
                  style={{ animation: !isGood(lastReward) ? 'mb-shake .6s both' : 'mb-pop .5s both' }}
                />
              </>
            )}
            <div
              className="mb-anim relative mt-[1cqw] rounded-[2cqw] px-[3cqw] py-[1cqw] font-black text-white shadow-2xl"
              style={{
                fontSize: 'clamp(18px,4cqw,56px)',
                background: phase === 'open' ? '#475569' : isGood(lastReward) ? 'linear-gradient(135deg,#f59e0b,#10b981)' : 'linear-gradient(135deg,#475569,#dc2626)',
                animation: 'mb-pop .45s both',
              }}
            >
              {phase === 'open' ? t('gameMysteryBox.opening') : rewardText(lastReward)}
            </div>
            <div className="mt-[0.6cqw] font-bold text-white" style={{ fontSize: 'clamp(12px,1.8cqw,24px)' }}>
              {t('gameMysteryBox.receiver', { team: teamName(recv) })}
            </div>

            {phase === 'target' && (
              <div className="mt-[1.2cqw] flex flex-col items-center gap-[0.8cqw]">
                <div className="text-amber-100" style={{ fontSize: 'clamp(12px,1.9cqw,26px)' }}>
                  {lastReward.kind === 'swap' ? t('gameMysteryBox.pickSwap') : t('gameMysteryBox.pickSteal')}
                </div>
                <div className="flex flex-wrap justify-center gap-[1cqw]">
                  {scores.map((_, i) =>
                    i === recv ? null : (
                      <button key={i} type="button" onClick={() => settle(recv, lastReward, i)} className={btn} style={{ ...bf, background: TEAM_COLORS[i] }}>
                        {teamName(i)} ({scores[i]})
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
            {phase === 'done' && (
              <button type="button" onClick={finishTurn} className={`${btn} mt-[1.2cqw]`} style={{ ...bf, background: '#6366f1' }}>
                {t('gameMysteryBox.next', { team: teamName((turn + 1) % teamCount) })}
              </button>
            )}
          </div>
        )}

        {/* 마지막 순위 */}
        {phase === 'final' && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-[1cqw] bg-black/60 p-[3%] text-center">
            <img src={IMG('star')} alt="" draggable={false} className="mb-anim h-[22%] object-contain" style={{ animation: 'mb-bob 1.4s ease-in-out infinite' }} />
            <div className="font-black text-white" style={{ fontSize: 'clamp(18px,3.6cqw,48px)' }}>{t('gameMysteryBox.finalTitle')}</div>
            <div className="flex flex-col gap-[0.6cqw]">
              {ranking.map((r, idx) => (
                <div key={r.i} className="mb-anim flex items-center gap-[1.2cqw] rounded-full px-[2.4cqw] py-[0.4cqw] font-bold text-white" style={{ background: TEAM_COLORS[r.i], animation: `mb-pop .4s ${idx * 0.12}s both`, fontSize: 'clamp(13px,2.2cqw,30px)' }}>
                  <span>{idx + 1}</span>
                  <span>{teamName(r.i)}</span>
                  <span className="ml-auto">{r.s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 text-center font-caption text-caption text-on-surface-variant">{t('gameMysteryBox.rule')}</div>
    </div>
  );
});

export default MysteryBox;
