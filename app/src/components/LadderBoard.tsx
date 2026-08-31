import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { emptyLadder, generateLadder, traceAll, tracePath, type LadderGrid } from '../lib/ladder';
import { playMusic } from '../lib/gameMusic';
import { colorFor } from '../lib/wheel';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  participants: GameItem[];
  results: GameItem[];
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
}

type Mode = 'all' | 'one';

// 50인치대 전자칠판/태블릿에서 뒤에서도 잘 보이도록 큼직하게 잡은 값.
const COL_W = 128;
const ROW_H = 38;
const TOP_PAD = 18;
const BOTTOM_PAD = 18;
const RAIL_W = 24;
const RUNG_H = 16;
const RUN_MS = 1700;
const DEFAULT_ROWS = 10;
const RAIL_SRC = '/skins/ladder-rail.png';
const RUNG_SRC = '/skins/ladder-rung.png';

function plaqueStyle(index: number, emphasized = false): CSSProperties {
  return {
    backgroundColor: colorFor(index),
    border: '3px solid #f0d7a8',
    boxShadow: emphasized
      ? '0 0 0 3px #fff8ea, 0 4px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.2)'
      : '0 3px 0 #c4925c, 0 7px 12px rgba(110,62,18,0.16)',
  };
}

export default function LadderBoard({ participants, results, music, resultSound }: Props) {
  const { t } = useTranslation();
  const n = participants.length;
  const [mode, setMode] = useState<Mode>('all');
  const [grid, setGrid] = useState<LadderGrid>(() => emptyLadder(Math.max(n, 2), DEFAULT_ROWS));
  const [mapping, setMapping] = useState<number[] | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [runningSet, setRunningSet] = useState<Set<number>>(new Set());
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const stopMusicRef = useRef<() => void>(() => {});
  const oneStopsRef = useRef<(() => void)[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 게임을 시작하기 전(참가자만 편집 중)에는 세로줄 + 이름 칸만 미리 보여준다.
  // 실제로 사다리를 탄 적이 없는 동안은(mapping === null) 참가자 수가 바뀔 때마다 빈 틀을 다시 맞춘다.
  useEffect(() => {
    if (mapping) return;
    setGrid(emptyLadder(Math.max(n, 2), DEFAULT_ROWS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const width = Math.max(n, 2) * COL_W;
  const height = TOP_PAD + grid.rows * ROW_H + BOTTOM_PAD;
  const railH = height - TOP_PAD - BOTTOM_PAD;

  const paths = useMemo(() => {
    return participants.map((_, i) => {
      const pts = tracePath(grid, i).map((p) => ({
        x: COL_W / 2 + p.col * COL_W,
        y: TOP_PAD + p.row * ROW_H,
      }));
      const d = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      return { id: participants[i].id, d, color: colorFor(i) };
    });
  }, [grid, participants]);

  const rungLines = useMemo(() => {
    const lines: { key: string; x1: number; x2: number; y: number }[] = [];
    grid.rungs.forEach((row, r) => {
      row.forEach((has, gap) => {
        if (!has) return;
        const y = TOP_PAD + (r + 0.5) * ROW_H;
        lines.push({
          key: `${r}-${gap}`,
          x1: COL_W / 2 + gap * COL_W,
          x2: COL_W / 2 + (gap + 1) * COL_W,
          y,
        });
      });
    });
    return lines;
  }, [grid]);

  // 경로 길이만큼 stroke-dasharray 를 잡아둔 뒤(안 보이게), 다음 프레임에 dashoffset 을 0 으로
  // 애니메이션하면 위→아래로 선이 그려지는 것처럼 보인다. 새 사다리가 만들어질 때마다 전부 다시 숨긴다.
  useLayoutEffect(() => {
    pathRefs.current.forEach((el) => {
      if (!el) return;
      const len = el.getTotalLength();
      el.style.transition = 'none';
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len}`;
    });
  }, [grid, paths]);

  function resetRunState() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    stopMusicRef.current();
    oneStopsRef.current.forEach((stop) => stop());
    oneStopsRef.current = [];
    setRevealed(new Set());
    setRunningSet(new Set());
  }

  function newLadder() {
    resetRunState();
    const g = generateLadder(n);
    setGrid(g);
    setMapping(traceAll(g));
  }

  function revealPathEls(indices: number[], onDone: () => void) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        indices.forEach((i) => {
          const el = pathRefs.current[i];
          if (!el) return;
          el.style.transition = `stroke-dashoffset ${RUN_MS}ms linear`;
          el.style.strokeDashoffset = '0';
        });
      });
    });
    const timer = setTimeout(onDone, RUN_MS + 150);
    timersRef.current.push(timer);
  }

  function startRevealAll() {
    if (n < 2) return;
    setMode('all');
    newLadder();
    const all = Array.from({ length: n }, (_, i) => i);
    setRunningSet(new Set(all));
    stopMusicRef.current = playMusic(music, { loop: true });
    revealPathEls(all, () => {
      setRevealed(new Set(all));
      setRunningSet(new Set());
      stopMusicRef.current();
      playMusic(resultSound);
    });
  }

  function startOneByOne() {
    if (n < 2) return;
    setMode('one');
    newLadder();
  }

  function revealOne(i: number) {
    if (!mapping || revealed.has(i) || runningSet.has(i)) return;
    setRunningSet((prev) => new Set(prev).add(i));
    const stopMusic = playMusic(music, { loop: false });
    oneStopsRef.current.push(stopMusic);
    revealPathEls([i], () => {
      setRevealed((prev) => new Set(prev).add(i));
      setRunningSet((prev) => {
        const next = new Set(prev);
        next.delete(i);
        return next;
      });
      stopMusic();
      playMusic(resultSound);
    });
  }

  function retry() {
    if (runningSet.size > 0) return;
    resetRunState();
    setMapping(null);
    setGrid(emptyLadder(Math.max(n, 2), DEFAULT_ROWS));
    setMode('all');
  }

  function landedResultIndex(colIndex: number): boolean {
    if (!mapping) return false;
    const p = mapping.findIndex((dest) => dest === colIndex);
    return p !== -1 && revealed.has(p);
  }

  if (n < 2) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🪜</div>
        <div className="font-body-md text-body-md">{t('gameLadder.needTwoParticipants')}</div>
      </div>
    );
  }

  const busy = runningSet.size > 0;

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="flex flex-wrap justify-center gap-2.5 mb-6">
        <button
          onClick={startRevealAll}
          disabled={busy}
          className="px-5 py-2.5 rounded-full bg-secondary hover:bg-on-secondary-container disabled:opacity-60 text-on-secondary font-label-md text-label-md shadow-sm transition-colors"
        >
          {busy && mode === 'all' ? t('gameLadder.revealingAll') : t('gameLadder.revealAllButton')}
        </button>
        <button
          onClick={startOneByOne}
          disabled={busy}
          className="px-5 py-2.5 rounded-full bg-warm-yellow hover:brightness-95 disabled:opacity-60 text-tertiary-container font-label-md text-label-md shadow-sm transition-all"
        >
          {t('gameLadder.revealOneButton')}
        </button>
        {revealed.size > 0 && (
          <button
            type="button"
            onClick={retry}
            disabled={busy}
            className="px-5 py-2.5 rounded-full border-2 border-secondary text-secondary hover:bg-secondary-container/40 disabled:opacity-60 font-label-md text-label-md transition-colors"
          >
            {t('gameLadder.retryButton')}
          </button>
        )}
      </div>

      <div className="max-w-full overflow-x-auto pb-1">
        <div className="flex mb-3 items-stretch" style={{ width }}>
          {participants.map((p, i) => {
            const plaque = (
              <span
                className="inline-block max-w-[112px] truncate rounded-full px-3 py-2 font-title-md text-sm font-bold text-white"
                style={plaqueStyle(i, revealed.has(i))}
              >
                {p.label}
              </span>
            );
            return mode === 'one' ? (
              <button
                key={p.id}
                type="button"
                disabled={revealed.has(i) || runningSet.has(i)}
                onClick={() => revealOne(i)}
                style={{ width: COL_W }}
                className={`flex-none flex items-center justify-center px-1 py-0.5 rounded-full bg-transparent disabled:cursor-default ${
                  runningSet.has(i) ? 'ladder-pulse' : 'cursor-pointer hover:brightness-105'
                }`}
              >
                {plaque}
              </button>
            ) : (
              <div key={p.id} style={{ width: COL_W }} className="flex-none flex items-center justify-center px-1">
                {plaque}
              </div>
            );
          })}
        </div>

        <svg
          className="block"
          viewBox={`0 0 ${width} ${height}`}
          style={{ width, height, filter: 'drop-shadow(0 10px 18px rgba(110, 62, 18, 0.18))' }}
        >
          {Array.from({ length: n }, (_, i) => (
            <image
              key={`col-${i}`}
              href={RAIL_SRC}
              x={COL_W / 2 + i * COL_W - RAIL_W / 2}
              y={TOP_PAD}
              width={RAIL_W}
              height={railH}
              preserveAspectRatio="none"
            />
          ))}
          {rungLines.map((l) => (
            <image
              key={l.key}
              href={RUNG_SRC}
              x={l.x1}
              y={l.y - RUNG_H / 2}
              width={l.x2 - l.x1}
              height={RUNG_H}
              preserveAspectRatio="none"
            />
          ))}
          {paths.map((p, i) => (
            <path
              key={p.id}
              ref={(el) => {
                pathRefs.current[i] = el;
              }}
              d={p.d}
              fill="none"
              strokeWidth={10}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ stroke: p.color }}
            />
          ))}
        </svg>

        <div className="flex mt-4 items-stretch" style={{ width }}>
          {results.map((r, i) => (
            <div key={r.id} style={{ width: COL_W }} className="flex-none flex items-center justify-center px-1.5">
              <div
                className={`w-full rounded-2xl px-1.5 py-2.5 text-center font-title-md text-sm font-bold text-white [word-break:keep-all] transition-transform ${
                  landedResultIndex(i) ? 'scale-110' : ''
                }`}
                style={plaqueStyle(i, landedResultIndex(i))}
              >
                {r.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {mode === 'one' && (
        <div className="font-body-lg text-body-lg text-on-surface-variant mt-3.5 text-center">
          {t('gameLadder.oneByOneHint')}
        </div>
      )}

      {mapping && revealed.size > 0 && (
        <div className="flex flex-col gap-2.5 mt-6 w-full max-w-[460px]">
          {participants.map(
            (p, i) =>
              revealed.has(i) && (
                <div
                  key={p.id}
                  className="flex items-center justify-center gap-3 bg-secondary-container/50 border border-secondary-container rounded-2xl px-5 py-3.5 font-title-md text-title-md"
                >
                  <span className="text-on-surface">{p.label}</span>
                  <span className="text-on-surface-variant">→</span>
                  <span className="text-secondary">{results[mapping[i]].label}</span>
                </div>
              ),
          )}
          <button
            type="button"
            onClick={retry}
            disabled={busy}
            className="mt-1 px-8 py-3 rounded-full bg-secondary hover:bg-on-secondary-container disabled:opacity-60 text-on-secondary font-title-md text-title-md shadow-sm transition-colors"
          >
            {t('gameLadder.retryButton')}
          </button>
        </div>
      )}
    </div>
  );
}
