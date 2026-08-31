import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
const ROW_H = 34;
const TOP_PAD = 10;
const BOTTOM_PAD = 10;
const RUN_MS = 1700;
const DEFAULT_ROWS = 10;

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
          className="px-5 py-2 rounded-full bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary font-label-md text-label-md shadow-sm transition-colors"
        >
          {busy && mode === 'all' ? t('gameLadder.revealingAll') : t('gameLadder.revealAllButton')}
        </button>
        <button
          onClick={startOneByOne}
          disabled={busy}
          className="px-5 py-2 rounded-full bg-warm-yellow hover:brightness-95 disabled:opacity-60 text-tertiary-container font-label-md text-label-md shadow-sm transition-all"
        >
          {t('gameLadder.revealOneButton')}
        </button>
      </div>

      <div className="max-w-full overflow-x-auto pb-1">
        <div className="flex mb-3.5" style={{ width }}>
          {participants.map((p, i) =>
            mode === 'one' ? (
              <button
                key={p.id}
                type="button"
                disabled={revealed.has(i) || runningSet.has(i)}
                onClick={() => revealOne(i)}
                style={{ width: COL_W }}
                className={`flex-none text-center font-title-md text-title-md px-2 py-2.5 rounded-full border-2 transition-colors disabled:cursor-default ${
                  revealed.has(i)
                    ? 'border-warm-yellow bg-warm-yellow/20 text-tertiary-container font-bold'
                    : runningSet.has(i)
                      ? 'border-primary bg-surface-container-lowest text-on-surface ladder-pulse'
                      : 'border-primary bg-surface-container-lowest text-on-surface cursor-pointer hover:bg-surface-container-low'
                }`}
              >
                {p.label}
              </button>
            ) : (
              <div
                key={p.id}
                style={{ width: COL_W }}
                className="flex-none text-center font-title-md text-title-md text-on-surface px-1.5 py-1 [word-break:keep-all]"
              >
                {p.label}
              </div>
            ),
          )}
        </div>

        <svg className="block drop-shadow-[0_10px_22px_rgba(39,101,168,0.16)]" viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
          {Array.from({ length: n }, (_, i) => (
            <line
              key={`col-${i}`}
              x1={COL_W / 2 + i * COL_W}
              y1={TOP_PAD}
              x2={COL_W / 2 + i * COL_W}
              y2={height - BOTTOM_PAD}
              className="stroke-surface-container-high"
              strokeWidth={5}
            />
          ))}
          {rungLines.map((l) => (
            <line key={l.key} x1={l.x1} y1={l.y} x2={l.x2} y2={l.y} className="stroke-outline-variant" strokeWidth={5} />
          ))}
          {paths.map((p, i) => (
            <path
              key={p.id}
              ref={(el) => {
                pathRefs.current[i] = el;
              }}
              d={p.d}
              fill="none"
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ stroke: p.color }}
            />
          ))}
        </svg>

        <div className="flex mt-3.5" style={{ width }}>
          {results.map((r, i) => (
            <div
              key={r.id}
              style={{ width: COL_W }}
              className={`flex-none text-center font-title-md text-title-md px-1.5 py-1 [word-break:keep-all] transition-all ${
                landedResultIndex(i) ? 'text-secondary font-bold scale-110' : 'text-on-surface-variant'
              }`}
            >
              {r.label}
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
                  className="flex items-center justify-center gap-3 bg-secondary-container/20 border border-secondary-container rounded-2xl px-5 py-3.5 font-title-md text-title-md"
                >
                  <span className="text-on-surface">{p.label}</span>
                  <span className="text-on-surface-variant">→</span>
                  <span className="text-secondary">{results[mapping[i]].label}</span>
                </div>
              ),
          )}
        </div>
      )}
    </div>
  );
}
