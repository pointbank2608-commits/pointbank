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

const COL_W = 62;
const ROW_H = 22;
const TOP_PAD = 6;
const BOTTOM_PAD = 6;
const RUN_MS = 1500;

export default function LadderBoard({ participants, results, music }: Props) {
  const n = participants.length;
  const [grid, setGrid] = useState<LadderGrid | null>(null);
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [mapping, setMapping] = useState<number[] | null>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const stopMusicRef = useRef<() => void>(() => {});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  // 애니메이션하면 위→아래로 선이 그려지는 것처럼 보인다.
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

  function start() {
    if (n < 2 || running) return;
    stopMusicRef.current();
    if (timerRef.current) clearTimeout(timerRef.current);

    const g = generateLadder(n);
    setGrid(g);
    setMapping(null);
    setRevealed(false);
    setRunning(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pathRefs.current.forEach((el) => {
          if (!el) return;
          el.style.transition = `stroke-dashoffset ${RUN_MS}ms linear`;
          el.style.strokeDashoffset = '0';
        });
        setRevealed(true);
      });
    });

    stopMusicRef.current = playMusic(music, { loop: true });

    timerRef.current = setTimeout(() => {
      setMapping(traceAll(g));
      setRunning(false);
      stopMusicRef.current();
    }, RUN_MS + 150);
  }

  if (n < 2) {
    return (
      <div className="wheel-empty">
        <div className="wheel-empty-icon">🪜</div>
        <div>참가자를 2명 이상 등록해야 사다리를 만들 수 있어요.</div>
      </div>
    );
  }

  return (
    <div className="ladder-stage">
      <div className="ladder-scroll">
        <div className="ladder-labels top" style={{ width }}>
          {participants.map((p) => (
            <div key={p.id} className="ladder-label" style={{ width: COL_W }}>
              {p.label}
            </div>
          ))}
        </div>

        <svg className="ladder-svg" viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
          {grid &&
            Array.from({ length: n }, (_, i) => (
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
          {results.map((r, i) => {
            const landedParticipant =
              revealed && mapping ? participants[mapping.findIndex((dest) => dest === i)] : null;
            return (
              <div
                key={r.id}
                className={`ladder-label result ${landedParticipant ? 'landed' : ''}`}
                style={{ width: COL_W }}
              >
                {r.label}
              </div>
            );
          })}
        </div>
      </div>

      <button className="btn-primary wheel-spin-btn" onClick={start} disabled={running}>
        {running ? '내려가는 중…' : grid ? '다시 타기' : '사다리 타기 시작'}
      </button>

      {mapping && !running && (
        <div className="ladder-result-list">
          {participants.map((p, i) => (
            <div key={p.id} className="ladder-result-row">
              <span className="ladder-result-name">{p.label}</span>
              <span className="ladder-result-arrow">→</span>
              <span className="ladder-result-target">{results[mapping[i]].label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
