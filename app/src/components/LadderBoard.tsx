import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { generateLadder, traceAll, tracePath, type LadderGrid } from '../lib/ladder';
import { playMusic } from '../lib/gameMusic';
import { colorFor } from '../lib/wheel';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  participants: GameItem[];
  results: GameItem[];
  music?: MusicSelection | null;
}

type Mode = 'all' | 'one';

const COL_W = 62;
const ROW_H = 22;
const TOP_PAD = 6;
const BOTTOM_PAD = 6;
const RUN_MS = 1500;

export default function LadderBoard({ participants, results, music }: Props) {
  const n = participants.length;
  const [mode, setMode] = useState<Mode>('all');
  const [grid, setGrid] = useState<LadderGrid | null>(null);
  const [mapping, setMapping] = useState<number[] | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [runningSet, setRunningSet] = useState<Set<number>>(new Set());
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const stopMusicRef = useRef<() => void>(() => {});
  const oneStopsRef = useRef<(() => void)[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const width = Math.max(n, 2) * COL_W;
  const height = TOP_PAD + (grid?.rows ?? 10) * ROW_H + BOTTOM_PAD;

  const paths = useMemo(() => {
    if (!grid) return [];
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
    if (!grid) return [];
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
    if (!grid) return;
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
    const t = setTimeout(onDone, RUN_MS + 150);
    timersRef.current.push(t);
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
    });
  }

  function startOneByOne() {
    if (n < 2) return;
    setMode('one');
    newLadder();
  }

  function revealOne(i: number) {
    if (!grid || revealed.has(i) || runningSet.has(i)) return;
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
    });
  }

  function landedResultIndex(colIndex: number): boolean {
    if (!mapping) return false;
    const p = mapping.findIndex((dest) => dest === colIndex);
    return p !== -1 && revealed.has(p);
  }

  if (n < 2) {
    return (
      <div className="wheel-empty">
        <div className="wheel-empty-icon">🪜</div>
        <div>참가자를 2명 이상 등록해야 사다리를 만들 수 있어요.</div>
      </div>
    );
  }

  const busy = runningSet.size > 0;

  return (
    <div className="ladder-stage">
      <div className="ladder-mode-buttons">
        <button className="btn-primary wheel-spin-btn" onClick={startRevealAll} disabled={busy}>
          {busy && mode === 'all' ? '내려가는 중…' : '한 번에 결과 보기'}
        </button>
        <button className="btn-primary gold wheel-spin-btn" onClick={startOneByOne} disabled={busy}>
          한 명씩 결과 보기
        </button>
      </div>

      {grid && (
        <>
          <div className="ladder-scroll">
            <div className="ladder-labels top" style={{ width }}>
              {participants.map((p, i) =>
                mode === 'one' ? (
                  <button
                    key={p.id}
                    type="button"
                    className={`ladder-label clickable ${revealed.has(i) ? 'landed' : ''} ${runningSet.has(i) ? 'running' : ''}`}
                    style={{ width: COL_W }}
                    disabled={revealed.has(i) || runningSet.has(i)}
                    onClick={() => revealOne(i)}
                  >
                    {p.label}
                  </button>
                ) : (
                  <div key={p.id} className="ladder-label" style={{ width: COL_W }}>
                    {p.label}
                  </div>
                ),
              )}
            </div>

            <svg className="ladder-svg" viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
              {Array.from({ length: n }, (_, i) => (
                <line
                  key={`col-${i}`}
                  x1={COL_W / 2 + i * COL_W}
                  y1={TOP_PAD}
                  x2={COL_W / 2 + i * COL_W}
                  y2={height - BOTTOM_PAD}
                  className="ladder-rail"
                />
              ))}
              {rungLines.map((l) => (
                <line key={l.key} x1={l.x1} y1={l.y} x2={l.x2} y2={l.y} className="ladder-rung" />
              ))}
              {paths.map((p, i) => (
                <path
                  key={p.id}
                  ref={(el) => {
                    pathRefs.current[i] = el;
                  }}
                  d={p.d}
                  className="ladder-path"
                  style={{ stroke: p.color }}
                />
              ))}
            </svg>

            <div className="ladder-labels bottom" style={{ width }}>
              {results.map((r, i) => (
                <div
                  key={r.id}
                  className={`ladder-label result ${landedResultIndex(i) ? 'landed' : ''}`}
                  style={{ width: COL_W }}
                >
                  {r.label}
                </div>
              ))}
            </div>
          </div>

          {mode === 'one' && (
            <div className="ladder-hint">이름을 누르면 그 사람 결과만 확인할 수 있어요.</div>
          )}

          {mapping && revealed.size > 0 && (
            <div className="ladder-result-list">
              {participants.map(
                (p, i) =>
                  revealed.has(i) && (
                    <div key={p.id} className="ladder-result-row">
                      <span className="ladder-result-name">{p.label}</span>
                      <span className="ladder-result-arrow">→</span>
                      <span className="ladder-result-target">{results[mapping[i]].label}</span>
                    </div>
                  ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
