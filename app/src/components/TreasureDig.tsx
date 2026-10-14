import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_SFX, GAME_SFX, playSfx } from '../lib/gameSfx';
import { speak } from '../lib/speech';
import type { GameItem, UndoHandle } from '../lib/types';

/**
 * 보물 땅파기(2026-10-14) — 모래 언덕 N개 중 한 곳에 보물이 묻혀 있고, 팀이 돌아가며 언덕을 골라
 * 단어 카드에 답해 맞히면 그 땅을 판다. 선생님이 맞고 틀림을 판정하는 모둠 대결 게임.
 * 그림은 구글 AI 점토 화풍(public/skins/dig/*.webp), 움직임은 전부 CSS 키프레임(아래 STYLE).
 */

interface Props {
  items: GameItem[];
  teams: number;
  mounds: number;
}

type Phase = 'pick' | 'question' | 'digging' | 'result' | 'roundEnd';
type Find = 'crab' | 'worm' | 'starfish' | 'boot' | 'bottle' | 'shell';
/** hint: 파 보니 보물이 아니었고, 보물까지의 칸 수(1·2·3 = 3칸 이상)를 알려 주는 팻말이 나온다.
 * bonus = 불가사리(1칸 + 한 번 더), penalty = 장화(3칸 이상 + 한 번 쉼) — PPT의 fossil·can 칸 */
type Dug = { kind: 'hint'; dist: 1 | 2 | 3; find: Find; special?: 'bonus' | 'penalty' } | { kind: 'treasure' };

interface Layout {
  treasure: number;
  bonus: number[];
  penalty: number[];
}

/** 보물과 칸 사이의 거리 — 지뢰찾기처럼 대각선도 한 칸(8방향) */
function cellDist(a: number, b: number, cols: number): number {
  return Math.max(Math.abs((a % cols) - (b % cols)), Math.abs(Math.floor(a / cols) - Math.floor(b / cols)));
}

function makeLayout(count: number, cols: number): Layout {
  const treasure = randomTreasure(count);
  const all = Array.from({ length: count }, (_, i) => i).filter((i) => i !== treasure);
  const near = shuffle(all.filter((i) => cellDist(i, treasure, cols) === 1));
  const far = shuffle(all.filter((i) => cellDist(i, treasure, cols) >= 3));
  return { treasure, bonus: near.slice(0, count > 20 ? 2 : 1), penalty: far.slice(0, count > 12 ? 2 : 1) };
}

const FINDS: Find[] = ['crab', 'worm', 'starfish', 'boot', 'bottle', 'shell'];
const TEAM_COLORS = ['#ef5b5b', '#3b82f6', '#22a559', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5a4', '#78716c'];
const TEAM_NAMES_FALLBACK = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const IMG = (name: string) => `/skins/dig/${name}.webp`;

const SCORE_TREASURE = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomTreasure(count: number): number {
  return Math.floor(Math.random() * Math.max(1, count));
}

interface Snapshot {
  dug: Record<number, Dug>;
  scores: number[];
  turn: number;
  layout: Layout;
  skipped: number[];
  cardPos: number;
  round: number;
}

const STYLE = `
@keyframes td-shovel { 0%{transform:translate(60%,-90%) rotate(40deg);opacity:0}
  25%{opacity:1} 45%{transform:translate(10%,-10%) rotate(-8deg)} 60%{transform:translate(0,0) rotate(0)}
  75%{transform:translate(12%,-30%) rotate(18deg)} 100%{transform:translate(0,0) rotate(0)} }
@keyframes td-sand { 0%{transform:translate(0,0) scale(.6);opacity:0} 20%{opacity:1}
  100%{transform:translate(var(--dx),var(--dy)) scale(1);opacity:0} }
@keyframes td-mound-out { 0%{transform:scale(1)} 40%{transform:scale(1.06,.94)} 100%{transform:scale(.2,.05);opacity:0} }
@keyframes td-find-pop { 0%{transform:translateY(40%) scale(.2);opacity:0} 55%{transform:translateY(-55%) scale(1.15);opacity:1}
  75%{transform:translateY(-38%) scale(.96)} 100%{transform:translateY(-45%) scale(1);opacity:1} }
@keyframes td-chest-rise { 0%{transform:translateY(60%) scale(.3);opacity:0} 60%{transform:translateY(-30%) scale(1.1);opacity:1}
  100%{transform:translateY(-22%) scale(1);opacity:1} }
@keyframes td-rays { from{transform:translate(-50%,-50%) rotate(0)} to{transform:translate(-50%,-50%) rotate(360deg)} }
@keyframes td-coin { 0%{transform:translate(0,0) rotate(0) scale(.5);opacity:0} 15%{opacity:1}
  100%{transform:translate(var(--dx),var(--dy)) rotate(540deg) scale(1);opacity:0} }
@keyframes td-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7%)} 40%{transform:translateX(6%)}
  60%{transform:translateX(-4%)} 80%{transform:translateX(3%)} }
@keyframes td-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6%)} }
@keyframes td-card-in { 0%{transform:translateY(30px) scale(.85);opacity:0} 100%{transform:none;opacity:1} }
@keyframes td-banner { 0%{transform:scale(.3) rotate(-6deg);opacity:0} 60%{transform:scale(1.12) rotate(2deg);opacity:1}
  100%{transform:scale(1) rotate(0);opacity:1} }
@keyframes td-sign { 0%{transform:translate(-50%,40%) scale(.2);opacity:0} 60%{transform:translate(-50%,-6%) scale(1.2);opacity:1} 100%{transform:translate(-50%,0) scale(1);opacity:1} }
@keyframes td-score { 0%{transform:scale(1)} 40%{transform:scale(1.35)} 100%{transform:scale(1)} }
.td-mound { transition: transform .15s; }
.td-mound:hover:not(:disabled) { transform: translateY(-6%) scale(1.06); }
.td-mound:disabled { cursor: default; }
.td-bob { animation: td-bob 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .td-anim, .td-bob { animation-duration: .01s !important; animation-iteration-count: 1 !important; }
}
`;

const TreasureDig = forwardRef<UndoHandle, Props>(function TreasureDig({ items, teams, mounds }, ref) {
  const { t } = useTranslation();
  const teamCount = Math.min(8, Math.max(2, teams));
  const moundCount = Math.max(6, mounds);
  // 칸 수가 딱 맞게(빈 칸 없이) 장면 가득 — 12=4×3, 20=5×4, 30=6×5
  const cols = moundCount <= 12 ? 4 : moundCount <= 20 ? 5 : 6;
  const itemKey = items.map((i) => i.id).join(',');

  const [dug, setDug] = useState<Record<number, Dug>>({});
  const [scores, setScores] = useState<number[]>(() => Array(teamCount).fill(0));
  const [turn, setTurn] = useState(0);
  const [layout, setLayout] = useState<Layout>(() => makeLayout(moundCount, cols));
  const [skipped, setSkipped] = useState<number[]>([]);
  const [lastDug, setLastDug] = useState<Dug | null>(null);
  const treasureAt = layout.treasure;
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>('pick');
  const [selected, setSelected] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [cardPos, setCardPos] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [wrongShake, setWrongShake] = useState<number | null>(null);
  const [scorePulse, setScorePulse] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const timers = useRef<number[]>([]);

  function later(fn: () => void, ms: number) {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  // 팀·언덕 수·단어가 바뀌면 처음부터 다시 묻는다.
  useEffect(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setDug({});
    setScores(Array(teamCount).fill(0));
    setTurn(0);
    setLayout(makeLayout(moundCount, cols));
    setSkipped([]);
    setLastDug(null);
    setRound(1);
    setPhase('pick');
    setSelected(null);
    setOrder(shuffle(items.map((_, i) => i)));
    setCardPos(0);
    setSnapshot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamCount, moundCount, itemKey]);

  // 항목은 단어 또는 문장 — "영어 문장 | 해석" 꼴이면 해석은 눌러서 본다(문법 수업용)
  const { word, ko } = useMemo(() => {
    if (items.length === 0 || order.length === 0) return { word: '', ko: '' };
    const raw = items[order[cardPos % order.length]]?.label ?? '';
    const cut = raw.indexOf(' | ');
    return cut >= 0 ? { word: raw.slice(0, cut).trim(), ko: raw.slice(cut + 3).trim() } : { word: raw.trim(), ko: '' };
  }, [items, order, cardPos]);
  const [showKo, setShowKo] = useState(false);
  useEffect(() => setShowKo(false), [cardPos, selected]);

  const finds = useMemo(() => shuffle(FINDS.filter((f) => f !== 'starfish' && f !== 'boot')), [round]);
  const teamName = (i: number) => t('gameTreasureDig.teamName', { name: TEAM_NAMES_FALLBACK[i] });

  function pickMound(idx: number) {
    if (phase !== 'pick' || dug[idx]) return;
    playSfx(GAME_SFX.treasuredig.pick);
    setSelected(idx);
    setPhase('question');
    if (word) speak(word);
  }

  function cancelPick() {
    setSelected(null);
    setPhase('pick');
  }

  function saveSnapshot() {
    setSnapshot({ dug: { ...dug }, scores: [...scores], turn, layout, skipped: [...skipped], cardPos, round });
  }

  function judgeRight() {
    if (phase !== 'question' || selected === null) return;
    saveSnapshot();
    playSfx(GAME_SFX.treasuredig.correct);
    setPhase('digging');
    const idx = selected;
    later(() => playSfx(GAME_SFX.treasuredig.dig), 350);
    later(() => playSfx(GAME_SFX.treasuredig.dig), 950);
    later(() => {
      const isTreasure = idx === treasureAt;
      const dist = Math.min(3, cellDist(idx, treasureAt, cols)) as 1 | 2 | 3;
      const special = layout.bonus.includes(idx) ? 'bonus' : layout.penalty.includes(idx) ? 'penalty' : undefined;
      const kind: Dug = isTreasure
        ? { kind: 'treasure' }
        : { kind: 'hint', dist: special === 'bonus' ? 1 : special === 'penalty' ? 3 : dist, find: finds[Object.keys(dug).length % finds.length], special };
      const gain = isTreasure ? SCORE_TREASURE : 0;
      setDug((d) => ({ ...d, [idx]: kind }));
      setLastDug(kind);
      if (gain > 0) {
        setScores((s) => s.map((v, i) => (i === turn ? v + gain : v)));
        setScorePulse(turn);
        later(() => setScorePulse(null), 700);
      }
      if (special === 'penalty') setSkipped((sk) => (sk.includes(turn) ? sk : [...sk, turn]));
      setLastGain(gain);
      playSfx(isTreasure ? GAME_SFX.treasuredig.treasure : special === 'penalty' ? GAME_SFX.treasuredig.wrong : GAME_SFX.treasuredig.find);
      if (isTreasure) later(() => playSfx(COMMON_SFX.praise), 900);
      setPhase(isTreasure ? 'roundEnd' : 'result');
    }, 1500);
  }

  function judgeWrong() {
    if (phase !== 'question' || selected === null) return;
    saveSnapshot();
    playSfx(GAME_SFX.treasuredig.wrong);
    setWrongShake(selected);
    later(() => setWrongShake(null), 700);
    setCardPos((p) => p + 1);
    advanceTurn();
    setSelected(null);
    setPhase('pick');
  }

  /** 다음 차례 팀 — 장화(쉬어요)가 걸린 팀은 한 번 건너뛴다 */
  function advanceTurn(sk: number[] = skipped, from: number = turn) {
    let n = (from + 1) % teamCount;
    const left = [...sk];
    for (let k = 0; k < teamCount && left.includes(n); k++) {
      left.splice(left.indexOf(n), 1);
      n = (n + 1) % teamCount;
    }
    setSkipped(left);
    setTurn(n);
  }

  function nextTurn() {
    setCardPos((p) => p + 1);
    // 불가사리 칸이면 같은 팀이 한 번 더
    if (lastDug?.kind === 'hint' && lastDug.special === 'bonus') {
      playSfx(COMMON_SFX.yourTurn);
    } else {
      advanceTurn();
    }
    setSelected(null);
    setPhase('pick');
  }

  function nextRound() {
    saveSnapshot();
    setDug({});
    setLayout(makeLayout(moundCount, cols));
    setSkipped([]);
    setLastDug(null);
    setRound((r) => r + 1);
    setCardPos((p) => p + 1);
    setTurn((v) => (v + 1) % teamCount);
    setSelected(null);
    setPhase('pick');
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!snapshot) return;
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      setDug(snapshot.dug);
      setScores(snapshot.scores);
      setTurn(snapshot.turn);
      setLayout(snapshot.layout);
      setSkipped(snapshot.skipped);
      setCardPos(snapshot.cardPos);
      setRound(snapshot.round);
      setSelected(null);
      setPhase('pick');
      setSnapshot(null);
    },
  }));

  const rows = Math.ceil(moundCount / cols);

  return (
    <div className="mx-auto w-full max-w-[1100px] select-none">
      <style>{STYLE}</style>

      {/* 점수판 */}
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {scores.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-full px-4 py-1.5 font-title-md text-title-md text-white shadow-md transition-transform"
            style={{
              background: TEAM_COLORS[i],
              outline: i === turn && phase !== 'roundEnd' ? '4px solid #fde68a' : 'none',
              transform: i === turn && phase !== 'roundEnd' ? 'scale(1.1)' : 'none',
            }}
          >
            <span>{teamName(i)}</span>
            <span
              className="td-anim min-w-[1.6em] rounded-full bg-white/90 px-2 text-center font-bold"
              style={{ color: TEAM_COLORS[i], animation: scorePulse === i ? 'td-score .6s' : undefined }}
            >
              {s}
            </span>
          </div>
        ))}
        <span className="rounded-full bg-amber-100 px-3 py-1 font-label-md text-label-md text-amber-900">
          {t('gameTreasureDig.roundLabel', { n: round })}
        </span>
      </div>

      {/* 무대 */}
      <div
        className="relative w-full overflow-hidden rounded-[24px] shadow-lg"
        style={{
          aspectRatio: '16 / 9',
          containerType: 'size',
          background: `#f3d58a url(${IMG('scene')}) center / cover no-repeat`,
        }}
      >
        <div className="absolute left-0 right-0 top-[2%] text-center">
          <span
            className="inline-block rounded-full bg-white/85 px-[2.4cqw] py-[0.8cqw] font-bold text-slate-800 shadow"
            style={{ fontSize: 'clamp(12px, 2.2cqw, 28px)' }}
          >
            {phase === 'roundEnd'
              ? t('gameTreasureDig.treasureFound')
              : t('gameTreasureDig.pickMound', { team: teamName(turn) })}
          </span>
        </div>

        {/* 언덕 격자 */}
        <div
          className="absolute"
          style={{
            left: '2%',
            right: '2%',
            top: '12%',
            bottom: '2%',
            display: 'grid',
            // 지뢰찾기처럼 칸이 무대를 가득 채운다
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gap: 0,
          }}
        >
          {Array.from({ length: moundCount }, (_, idx) => {
            const d = dug[idx];
            const isSel = selected === idx;
            const digging = isSel && phase === 'digging';
            return (
              <div key={idx} className="relative flex items-center justify-center">
                <button
                  type="button"
                  disabled={phase !== 'pick' || !!d}
                  onClick={() => pickMound(idx)}
                  aria-label={t('gameTreasureDig.moundLabel', { n: idx + 1 })}
                  className="td-mound td-anim relative h-full w-full"
                  style={{
                    animation: wrongShake === idx ? 'td-shake .6s' : undefined,
                    filter: isSel ? 'drop-shadow(0 0 0.8cqw #fde047)' : undefined,
                  }}
                >
                  <img
                    src={d || digging ? IMG('hole') : IMG(idx % 2 ? 'mound-b' : 'mound-a')}
                    alt=""
                    draggable={false}
                    className="td-anim absolute left-1/2 top-1/2 h-[104%] max-h-none w-[104%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
                    style={digging ? { animation: 'td-mound-out 1.2s .3s both' } : undefined}
                  />
                  {!d && !digging && (
                    <span
                      className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 px-[0.5em] font-bold text-amber-900"
                      style={{ fontSize: 'clamp(9px, 1.6cqw, 20px)' }}
                    >
                      {idx + 1}
                    </span>
                  )}
                </button>

                {/* 파헤친 결과물 — 팻말(보물까지 칸 수) + 특별 칸의 불가사리·장화 */}
                {d?.kind === 'hint' && (
                  <>
                    <img
                      src={IMG(d.special === 'bonus' ? 'starfish' : d.special === 'penalty' ? 'boot' : d.find)}
                      alt=""
                      draggable={false}
                      className="td-anim pointer-events-none absolute left-1/2 top-[8%] w-[62%] -translate-x-1/2 object-contain"
                      style={{ animation: 'td-find-pop .9s both', maxHeight: '70%' }}
                    />
                    <span
                      className="td-anim pointer-events-none absolute bottom-[4%] left-1/2 z-10 rounded-[0.7cqw] border-[0.25cqw] border-amber-900 bg-amber-50 px-[0.8cqw] font-black leading-none shadow-md"
                      style={{
                        fontSize: 'clamp(12px, 2.6cqw, 34px)',
                        color: d.dist === 1 ? '#dc2626' : d.dist === 2 ? '#d97706' : '#2563eb',
                        animation: 'td-sign .6s .15s both',
                      }}
                    >
                      {d.dist === 3 ? '3+' : d.dist}
                    </span>
                  </>
                )}
                {d?.kind === 'treasure' && (
                  <img
                    src={IMG('chest-open')}
                    alt=""
                    draggable={false}
                    className="td-anim pointer-events-none absolute left-1/2 top-1/2 z-10 w-[130%] max-w-none -translate-x-1/2 object-contain"
                    style={{ animation: 'td-chest-rise .9s both' }}
                  />
                )}

                {/* 삽질 + 모래 */}
                {digging && (
                  <>
                    <img
                      src={IMG('shovel')}
                      alt=""
                      draggable={false}
                      className="td-anim pointer-events-none absolute left-[30%] top-[-30%] z-20 h-[120%] object-contain"
                      style={{ animation: 'td-shovel 1.4s .1s both' }}
                    />
                    {[0, 1, 2, 3, 4, 5, 6].map((p) => (
                      <span
                        key={p}
                        className="td-anim pointer-events-none absolute left-1/2 top-1/2 z-10 rounded-full"
                        style={{
                          width: '0.9cqw',
                          height: '0.9cqw',
                          background: p % 2 ? '#e8c36a' : '#c99a3d',
                          ['--dx' as string]: `${(p - 3) * 1.1}cqw`,
                          ['--dy' as string]: `${-4 - (p % 3) * 1.6}cqw`,
                          animation: `td-sand .7s ${0.4 + p * 0.09}s both`,
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 보물 발견 연출 */}
        {phase === 'roundEnd' && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div
              className="td-anim absolute left-1/2 top-1/2 aspect-square w-[70%]"
              style={{
                background:
                  'repeating-conic-gradient(from 0deg, rgba(253,224,71,.55) 0 8deg, rgba(253,224,71,0) 8deg 24deg)',
                borderRadius: '50%',
                animation: 'td-rays 9s linear infinite',
                maskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
              }}
            />
            {Array.from({ length: 16 }, (_, p) => (
              <span
                key={p}
                className="td-anim absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: '1.6cqw',
                  height: '1.6cqw',
                  background: p % 3 === 0 ? '#facc15' : p % 3 === 1 ? '#f87171' : '#60a5fa',
                  border: '0.2cqw solid #b45309',
                  ['--dx' as string]: `${Math.cos((p / 16) * Math.PI * 2) * (14 + (p % 4) * 5)}cqw`,
                  ['--dy' as string]: `${Math.sin((p / 16) * Math.PI * 2) * (9 + (p % 3) * 4)}cqw`,
                  animation: `td-coin 1.6s ${(p % 5) * 0.08}s both`,
                }}
              />
            ))}
          </div>
        )}

        {/* 문제 카드 */}
        {phase === 'question' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/35 p-[3%]">
            <div
              className="td-anim w-[min(88%,640px)] rounded-[28px] bg-[#fffdf8] p-[4%] text-center shadow-2xl"
              style={{ animation: 'td-card-in .35s both', border: `0.8cqw solid ${TEAM_COLORS[turn]}` }}
            >
              <div className="mb-2 font-label-md text-label-md text-on-surface-variant">
                {t('gameTreasureDig.cardTitle', { team: teamName(turn), n: (selected ?? 0) + 1 })}
              </div>
              <div
                className="mb-3 break-words font-bold text-deep-navy"
                style={{
                  fontSize:
                    word.length > 60
                      ? 'clamp(16px,2.6cqw,34px)'
                      : word.length > 30
                        ? 'clamp(18px,3.2cqw,42px)'
                        : word.length > 14
                          ? 'clamp(20px,4cqw,52px)'
                          : 'clamp(28px,6cqw,80px)',
                }}
              >
                {word || t('gameTreasureDig.noWordCard')}
              </div>
              {ko && (
                <div className="mb-3">
                  {showKo ? (
                    <div className="font-body-md text-body-md text-on-surface-variant">{ko}</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowKo(true)}
                      className="rounded-full bg-amber-100 px-4 py-1.5 font-label-md text-label-md text-amber-900 hover:bg-amber-200"
                    >
                      {t('gameTreasureDig.showKo')}
                    </button>
                  )}
                </div>
              )}
              {word && (
                <button
                  type="button"
                  onClick={() => speak(word)}
                  className="mb-4 rounded-full bg-surface-container-low px-4 py-1.5 font-label-md text-label-md text-primary hover:bg-surface-container"
                >
                  🔊 {t('gameTreasureDig.listen')}
                </button>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={judgeRight}
                  className="rounded-full bg-emerald-500 px-8 py-3 font-title-md text-title-md text-white shadow hover:bg-emerald-600"
                >
                  ✓ {t('gameTreasureDig.judgeRight')}
                </button>
                <button
                  type="button"
                  onClick={judgeWrong}
                  className="rounded-full bg-rose-500 px-8 py-3 font-title-md text-title-md text-white shadow hover:bg-rose-600"
                >
                  ✗ {t('gameTreasureDig.judgeWrong')}
                </button>
              </div>
              <button
                type="button"
                onClick={cancelPick}
                className="mt-3 font-label-md text-label-md text-on-surface-variant hover:underline"
              >
                {t('gameTreasureDig.pickAnother')}
              </button>
            </div>
          </div>
        )}

        {/* 결과 배너 */}
        {(phase === 'result' || phase === 'roundEnd') && (
          <div className="absolute inset-x-0 bottom-[4%] z-40 flex flex-col items-center gap-2">
            <div
              className="td-anim rounded-[24px] px-[3cqw] py-[1cqw] text-center font-bold text-white shadow-xl"
              style={{
                fontSize: 'clamp(16px, 3.4cqw, 44px)',
                background: phase === 'roundEnd' ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : '#0ea5a4',
                animation: 'td-banner .5s both',
              }}
            >
              {phase === 'roundEnd'
                ? t('gameTreasureDig.treasureBanner', { team: teamName(turn), n: lastGain })
                : lastDug?.kind === 'hint' && lastDug.special === 'bonus'
                  ? t('gameTreasureDig.bonusBanner')
                  : lastDug?.kind === 'hint' && lastDug.special === 'penalty'
                    ? t('gameTreasureDig.penaltyBanner')
                    : t('gameTreasureDig.hintBanner', { n: lastDug?.kind === 'hint' && lastDug.dist === 3 ? '3+' : lastDug?.kind === 'hint' ? lastDug.dist : '' })}
            </div>
            <button
              type="button"
              onClick={phase === 'roundEnd' ? nextRound : nextTurn}
              className="rounded-full bg-white px-6 py-2 font-title-md text-title-md text-primary shadow-lg hover:bg-amber-50"
            >
              {phase === 'roundEnd'
                ? t('gameTreasureDig.nextRound', { team: teamName((turn + 1) % teamCount) })
                : lastDug?.kind === 'hint' && lastDug.special === 'bonus'
                  ? t('gameTreasureDig.nextAgain', { team: teamName(turn) })
                  : t('gameTreasureDig.nextTurn', { team: teamName((turn + 1) % teamCount) })}
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-caption text-caption text-on-surface-variant">
        <span>{t('gameTreasureDig.legendNumber')}</span>
        <span>⭐ {t('gameTreasureDig.legendBonus')}</span>
        <span>🥾 {t('gameTreasureDig.legendPenalty')}</span>
        <span>{t('gameTreasureDig.scoreRule', { treasure: SCORE_TREASURE })}</span>
      </div>
    </div>
  );
});

export default TreasureDig;
