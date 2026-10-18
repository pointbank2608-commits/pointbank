import { gameClock } from '../lib/gameClock';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_SFX, GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import { useRemoteActions } from '../lib/remote';
import { blockLabel } from '../lib/mysteryBox';
import type { GameItem, UndoHandle } from '../lib/types';

/**
 * 미스터리 박스 — 버섯 3택 1 방식(2026-10-14, 선생님이 쓰는 규칙).
 * 상자를 하나 고르면 낱말 3개가 나온다. 모든 팀이 그중 하나를 골라 인쇄물(기록지)에 적고,
 * 공개하면 낱말 뒤에 숨은 버섯 3개(−1점·+1점·+3점)가 하나씩 나와서 그 낱말을 고른 팀이 점수를 받거나 잃는다.
 */

interface Props {
  items: GameItem[];
  teams: number;
  blocks: number;
}

type Phase = 'board' | 'pick' | 'reveal' | 'final';

const TEAM_COLORS = ['#ef5b5b', '#3b82f6', '#22a559', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5a4', '#78716c'];
const TEAM_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const IMG = (n: string) => `/skins/mystery/${n}.webp`;
const MUSH: Record<number, { img: string; color: string }> = {
  3: { img: 'mush-gold', color: '#d97706' },
  1: { img: 'mush-red', color: '#dc2626' },
  [-1]: { img: 'mush-purple', color: '#7c3aed' },
};

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
  phase: Phase;
}

const STYLE = `
@keyframes mm-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7%)} }
@keyframes mm-pop { 0%{transform:scale(.3) rotate(-8deg);opacity:0} 60%{transform:scale(1.12) rotate(3deg);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes mm-grow { 0%{transform:translateY(40%) scale(.2);opacity:0} 60%{transform:translateY(-8%) scale(1.15);opacity:1} 100%{transform:none;opacity:1} }
@keyframes mm-shake { 0%,100%{transform:translateX(0) rotate(0)} 20%{transform:translateX(-5%) rotate(-4deg)} 40%{transform:translateX(5%) rotate(4deg)} 60%{transform:translateX(-3%)} 80%{transform:translateX(2%)} }
@keyframes mm-score { 0%{transform:scale(1)} 40%{transform:scale(1.4)} 100%{transform:scale(1)} }
@keyframes mm-star { 0%{transform:translate(0,0) scale(.3) rotate(0);opacity:0} 15%{opacity:1} 100%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(360deg);opacity:0} }
@keyframes mm-pts { 0%{transform:translateY(30%) scale(.4);opacity:0} 40%{opacity:1;transform:translateY(0) scale(1.2)} 100%{transform:translateY(0) scale(1);opacity:1} }
.mm-block { transition: transform .15s; }
.mm-block:hover:not(:disabled) { transform: translateY(-6%) scale(1.05); }
.mm-block:disabled { cursor: default; }
@media (prefers-reduced-motion: reduce) { .mm-anim { animation-duration:.01s !important; animation-iteration-count:1 !important; } }
`;

const MysteryMushroom = forwardRef<UndoHandle, Props>(function MysteryMushroom({ items, teams, blocks }, ref) {
  const { t } = useTranslation();
  const teamCount = Math.min(8, Math.max(2, teams));
  const blockCount = blocks <= 20 ? 20 : 28;
  const cols = blockCount === 20 ? 5 : 7;
  const rows = blockCount / cols;
  const itemKey = items.map((i) => i.id + i.label).join('|');

  const [opened, setOpened] = useState<number[]>([]);
  const [scores, setScores] = useState<number[]>(() => Array(teamCount).fill(0));
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<Phase>('board');
  const [sel, setSel] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [cardPos, setCardPos] = useState(0);
  const [words, setWords] = useState<{ text: string; sub: string }[]>([]);
  const [values, setValues] = useState<number[]>([3, 1, -1]);
  /** 팀 → 고른 낱말(0~2) */
  const [choice, setChoice] = useState<(number | null)[]>(() => Array(teamCount).fill(null));
  const [flipped, setFlipped] = useState<boolean[]>([false, false, false]);
  const [pulse, setPulse] = useState<number | null>(null);
  const [gains, setGains] = useState<Record<number, number>>({});
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
    setOpened([]);
    setScores(Array(teamCount).fill(0));
    setTurn(0);
    setPhase('board');
    setSel(null);
    setOrder(shuffle(items.map((_, i) => i)));
    setCardPos(0);
    setChoice(Array(teamCount).fill(null));
    setFlipped([false, false, false]);
    setSnapshot(null);
    setGains({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamCount, blockCount, itemKey]);

  const teamName = (i: number) => t('gameMysteryBox.teamName', { name: TEAM_NAMES[i] });

  function pickBlock(i: number) {
    if (phase !== 'board' || opened.includes(i) || items.length === 0) return;
    playSfx(GAME_SFX.mysterybox.pick);
    const picked: { text: string; sub: string }[] = [];
    let pos = cardPos;
    let ord = order;
    for (let k = 0; k < 3; k++) {
      if (pos >= ord.length) {
        ord = shuffle(items.map((_, j) => j));
        setOrder(ord);
        pos = 0;
      }
      picked.push(parseItem(items[ord[pos]].label));
      pos += 1;
    }
    setCardPos(pos);
    setWords(picked);
    setValues(shuffle([3, 1, -1]));
    setChoice(Array(teamCount).fill(null));
    setFlipped([false, false, false]);
    setGains({});
    setSel(i);
    setPhase('pick');
  }

  function choose(team: number, word: number) {
    if (phase !== 'pick') return;
    playSfx(GAME_SFX.mysterybox.pick);
    setChoice((c) => c.map((v, i) => (i === team ? (v === word ? null : word) : v)));
  }

  function reveal() {
    if (phase !== 'pick') return;
    setSnapshot({ scores: [...scores], opened: [...opened], turn, phase });
    setPhase('reveal');
    // 버섯을 하나씩 — 점수도 그때그때 반영
    [0, 1, 2].forEach((w, k) => {
      later(() => {
        setFlipped((f) => f.map((v, i) => (i === w ? true : v)));
        const v = values[w];
        playSfx(v > 0 ? GAME_SFX.mysterybox.good : GAME_SFX.mysterybox.bad);
        const who = choice.map((c, team) => (c === w ? team : -1)).filter((x) => x >= 0);
        if (who.length > 0) {
          setScores((s) => s.map((val, team) => (who.includes(team) ? val + v : val)));
          setGains((g) => {
            const n = { ...g };
            who.forEach((tm) => (n[tm] = v));
            return n;
          });
          who.forEach((tm) => {
            setPulse(tm);
          });
          later(() => setPulse(null), 700);
        }
      }, 700 + k * 1300);
    });
  }

  function next() {
    if (phase !== 'reveal' || sel === null) return;
    const nextOpened = [...opened, sel];
    setOpened(nextOpened);
    setSel(null);
    setGains({});
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
      setSel(null);
      setPhase('board');
      setSnapshot(null);
    },
  }));

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
      : phase === 'pick'
        ? [
            ...scores.flatMap((_, team) =>
              [0, 1, 2].map((wi) => ({
                id: `c${team}-${wi}`,
                label: `${TEAM_NAMES[team]} → ${wi + 1}${choice[team] === wi ? ' ✓' : ''}`,
                tone: 'team' as const,
                color: TEAM_COLORS[team],
                run: () => choose(team, wi),
              })),
            ),
            { id: 'reveal', label: t('gameMysteryBox.mushReveal'), tone: 'primary' as const, run: reveal },
          ]
        : phase === 'reveal' && flipped.every(Boolean)
          ? [{ id: 'next', label: t('gameMysteryBox.mushNext'), tone: 'primary', run: next }]
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
  const pending = choice.filter((c) => c === null).length;

  return (
    <div className="mx-auto w-full max-w-[1100px] select-none">
      <style>{STYLE}</style>

      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {scores.map((s, i) => (
          <div key={i} className="flex items-center gap-2 rounded-full px-4 py-1.5 font-title-md text-title-md text-white shadow-md" style={{ background: TEAM_COLORS[i] }}>
            <span>{teamName(i)}</span>
            <span className="mm-anim min-w-[2.2em] rounded-full bg-white/90 px-2 text-center font-bold" style={{ color: s < 0 ? '#dc2626' : TEAM_COLORS[i], animation: pulse === i ? 'mm-score .7s' : undefined }}>
              {s}
            </span>
          </div>
        ))}
        <span className="rounded-full bg-amber-100 px-3 py-1 font-label-md text-label-md text-amber-900">{t('gameMysteryBox.left', { n: blockCount - opened.length })}</span>
      </div>

      <div className="relative w-full overflow-hidden rounded-[24px] shadow-lg" style={{ aspectRatio: '16 / 9', containerType: 'size', background: `#7dd3fc url(${IMG('scene')}) center / cover no-repeat` }}>
        <div className="absolute left-0 right-0 top-[2%] z-10 text-center">
          <span className="inline-block rounded-full bg-white/90 px-[2.4cqw] py-[0.6cqw] font-bold text-slate-800 shadow" style={{ fontSize: 'clamp(11px, 1.9cqw, 26px)' }}>
            {phase === 'board' && t('gameMysteryBox.mushPickHint')}
            {phase === 'pick' && t('gameMysteryBox.mushChooseHint')}
            {phase === 'reveal' && t('gameMysteryBox.mushRevealHint')}
            {phase === 'final' && t('gameMysteryBox.finalHint')}
          </span>
        </div>

        {/* 상자 격자 */}
        <div className="absolute" style={{ left: '3%', right: '3%', top: '12%', bottom: '5%', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: '1cqw' }}>
          {Array.from({ length: blockCount }, (_, i) => {
            const used = opened.includes(i);
            return (
              <button
                key={i}
                type="button"
                disabled={phase !== 'board' || used}
                onClick={() => pickBlock(i)}
                aria-label={t('gameMysteryBox.blockLabel', { n: blockLabel(i) })}
                className="mm-block mm-anim relative flex items-center justify-center"
                style={{ animation: !used && phase === 'board' ? `mm-bob 2.4s ${(i % 7) * 0.18}s ease-in-out infinite` : undefined, filter: sel === i ? 'drop-shadow(0 0 1cqw #fde047)' : undefined }}
              >
                <img src={IMG(used ? 'used' : 'block')} alt="" draggable={false} className="absolute h-[96%] w-[96%] object-contain" />
                {!used && (
                  <span className="absolute bottom-[6%] right-[8%] rounded-full bg-white/95 px-[0.6cqw] font-black leading-none text-amber-900 shadow" style={{ fontSize: 'clamp(9px,1.6cqw,22px)', paddingTop: '0.2cqw', paddingBottom: '0.2cqw' }}>
                    {blockLabel(i)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 낱말 3개 → 버섯 공개 */}
        {(phase === 'pick' || phase === 'reveal') && sel !== null && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-[1.2cqw] bg-black/45 p-[2%]">
            <div className="flex w-full items-stretch justify-center gap-[2cqw]">
              {words.map((w, wi) => {
                const v = values[wi];
                const who = choice.map((c, team) => (c === wi ? team : -1)).filter((x) => x >= 0);
                const isFlipped = flipped[wi];
                return (
                  <div key={wi} className="mm-anim flex w-[28%] flex-col items-center gap-[0.8cqw] rounded-[2cqw] bg-[#fffdf8] p-[1.4cqw] shadow-2xl" style={{ animation: `mm-pop .4s ${wi * 0.1}s both` }}>
                    <div className="rounded-full bg-indigo-600 px-[1cqw] font-black text-white" style={{ fontSize: 'clamp(11px,1.6cqw,22px)' }}>{wi + 1}</div>
                    <div className="break-words text-center font-black text-deep-navy" style={{ fontSize: w.text.length > 30 ? 'clamp(12px,1.9cqw,26px)' : w.text.length > 12 ? 'clamp(15px,2.8cqw,38px)' : 'clamp(20px,4.2cqw,58px)', lineHeight: 1.15 }}>
                      {w.text}
                    </div>
                    {w.sub && <div className="text-center text-on-surface-variant" style={{ fontSize: 'clamp(10px,1.4cqw,19px)' }}>{w.sub}</div>}
                    <button type="button" onClick={() => speak(w.text)} className="rounded-full bg-indigo-50 px-[1cqw] font-bold text-indigo-700 hover:bg-indigo-100" style={{ fontSize: 'clamp(10px,1.4cqw,19px)' }}>
                      🔊
                    </button>

                    {/* 버섯 자리 */}
                    <div className="flex h-[12cqw] w-full items-center justify-center">
                      {isFlipped ? (
                        <div className="mm-anim flex flex-col items-center" style={{ animation: v > 0 ? 'mm-grow .6s both' : 'mm-shake .6s both' }}>
                          <img src={IMG(MUSH[v].img)} alt="" draggable={false} className="h-[8.4cqw] object-contain" />
                          <span className="mm-anim font-black" style={{ color: MUSH[v].color, fontSize: 'clamp(16px,3.2cqw,44px)', animation: 'mm-pts .5s .15s both' }}>
                            {v > 0 ? `+${v}` : `−${Math.abs(v)}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[6cqw] opacity-60" style={{ animation: 'mm-bob 1.6s ease-in-out infinite' }}>❓</span>
                      )}
                    </div>

                    {/* 이 낱말을 고른 팀 */}
                    <div className="flex min-h-[3.4cqw] flex-wrap justify-center gap-[0.5cqw]">
                      {who.map((tm) => (
                        <span key={tm} className="rounded-full px-[0.9cqw] font-black text-white" style={{ background: TEAM_COLORS[tm], fontSize: 'clamp(10px,1.5cqw,20px)' }}>
                          {TEAM_NAMES[tm]}
                          {isFlipped && gains[tm] !== undefined ? ` ${gains[tm] > 0 ? '+' : '−'}${Math.abs(gains[tm])}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {phase === 'pick' && (
              <>
                {/* 팀이 고른 낱말을 누른다 */}
                <div className="flex flex-wrap items-center justify-center gap-[1cqw] rounded-[1.4cqw] bg-white/90 px-[1.6cqw] py-[0.8cqw]">
                  {scores.map((_, team) => (
                    <div key={team} className="flex items-center gap-[0.5cqw]">
                      <span className="rounded-full px-[0.9cqw] font-black text-white" style={{ background: TEAM_COLORS[team], fontSize: 'clamp(11px,1.6cqw,22px)' }}>
                        {TEAM_NAMES[team]}
                      </span>
                      {[0, 1, 2].map((wi) => (
                        <button
                          key={wi}
                          type="button"
                          onClick={() => choose(team, wi)}
                          className={`rounded-full px-[0.9cqw] font-black transition-transform hover:scale-110 ${choice[team] === wi ? 'text-white shadow' : 'bg-slate-100 text-slate-500'}`}
                          style={{ background: choice[team] === wi ? TEAM_COLORS[team] : undefined, fontSize: 'clamp(11px,1.6cqw,22px)' }}
                        >
                          {wi + 1}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-[1cqw]">
                  <button type="button" onClick={reveal} className={btn} style={{ ...bf, background: '#f59e0b' }}>
                    🍄 {t('gameMysteryBox.mushReveal')}
                  </button>
                  {pending > 0 && <span className="rounded-full bg-black/40 px-[1.2cqw] text-white" style={{ fontSize: 'clamp(11px,1.5cqw,20px)' }}>{t('gameMysteryBox.mushPending', { n: pending })}</span>}
                </div>
              </>
            )}

            {phase === 'reveal' && flipped.every(Boolean) && (
              <button type="button" onClick={next} className={btn} style={{ ...bf, background: '#6366f1' }}>
                {t('gameMysteryBox.mushNext')}
              </button>
            )}
          </div>
        )}

        {phase === 'final' && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-[1cqw] bg-black/60 p-[3%] text-center">
            <img src={IMG('star')} alt="" draggable={false} className="mm-anim h-[22%] object-contain" style={{ animation: 'mm-bob 1.4s ease-in-out infinite' }} />
            <div className="font-black text-white" style={{ fontSize: 'clamp(18px,3.6cqw,48px)' }}>{t('gameMysteryBox.finalTitle')}</div>
            <div className="flex flex-col gap-[0.6cqw]">
              {ranking.map((r, idx) => (
                <div key={r.i} className="mm-anim flex items-center gap-[1.2cqw] rounded-full px-[2.4cqw] py-[0.4cqw] font-bold text-white" style={{ background: TEAM_COLORS[r.i], animation: `mm-pop .4s ${idx * 0.12}s both`, fontSize: 'clamp(13px,2.2cqw,30px)' }}>
                  <span>{idx + 1}</span>
                  <span>{teamName(r.i)}</span>
                  <span className="ml-auto">{r.s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 text-center font-caption text-caption text-on-surface-variant">{t('gameMysteryBox.mushRule')}</div>
    </div>
  );
});

export default MysteryMushroom;
