import { useMemo, useRef, useState } from 'react';
import { colorFor, computeSpinRotation, fontSizeFor, pickRandomIndex, shortenLabel } from '../lib/wheel';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
  /** 항목 하나를 선택할 때마다 화면 밖으로 알려준다 (최근 결과 기록 등에 사용). */
  onResult?: (item: GameItem) => void;
}

const SIZE = 420;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = SIZE / 2 - 10;
const SPIN_MS = 4600;

/** 화면 12시를 0도, 시계 방향으로 도는 각도 A 에서의 좌표. */
function pointOnCircle(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

export default function SpinWheel({ items, onResult }: Props) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GameItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const count = items.length;
  const slice = count > 0 ? 360 / count : 0;
  const fontSize = fontSizeFor(count);

  const slices = useMemo(() => {
    return items.map((item, i) => {
      const a0 = i * slice;
      const a1 = (i + 1) * slice;
      const p0 = pointOnCircle(a0, R);
      const p1 = pointOnCircle(a1, R);
      const largeArc = a1 - a0 > 180 ? 1 : 0;
      const path = `M ${CX} ${CY} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`;
      const mid = a0 + slice / 2;
      return { id: item.id, path, mid, color: colorFor(i), label: shortenLabel(item.label, slice) };
    });
  }, [items, slice]);

  function spin() {
    if (spinning || count === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    setResult(null);
    setSpinning(true);
    const targetIndex = pickRandomIndex(count);
    const next = computeSpinRotation({ targetIndex, itemCount: count, currentRotation: rotation });
    setRotation(next);

    timerRef.current = setTimeout(() => {
      setSpinning(false);
      const picked = items[targetIndex];
      setResult(picked);
      onResult?.(picked);
    }, SPIN_MS);
  }

  if (count === 0) {
    return (
      <div className="wheel-empty">
        <div className="wheel-empty-icon">🎡</div>
        <div>돌림판에 항목이 없습니다. 아래에서 항목을 추가해 주세요.</div>
      </div>
    );
  }

  return (
    <div className="wheel-stage">
      <div className="wheel-pointer" aria-hidden="true" />
      <div className="wheel-frame">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="wheel-svg"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.17, 0.89, 0.24, 1)` : 'none',
          }}
        >
          <circle cx={CX} cy={CY} r={R + 4} className="wheel-rim" />
          {slices.map((s) => (
            <path key={s.id} d={s.path} fill={s.color} stroke="#faf8f1" strokeWidth={2} />
          ))}
          {slices.map((s) => (
            <text
              key={s.id + '-label'}
              x={CX}
              y={CY - R * 0.62}
              transform={`rotate(${s.mid} ${CX} ${CY})`}
              textAnchor="middle"
              dominantBaseline="middle"
              className="wheel-label"
              style={{ fontSize }}
            >
              {s.label}
            </text>
          ))}
        </svg>

        <button
          className="wheel-hub"
          onClick={spin}
          disabled={spinning}
          aria-label="돌리기"
          title="돌리기"
        >
          <span>{spinning ? '···' : '₩'}</span>
        </button>
      </div>

      <button className="btn-primary wheel-spin-btn" onClick={spin} disabled={spinning}>
        {spinning ? '돌아가는 중…' : '돌리기'}
      </button>

      {result && !spinning && (
        <div className="wheel-result" key={result.id + result.label}>
          <div className="wheel-result-label">당첨</div>
          <div className="wheel-result-name">{result.label}</div>
        </div>
      )}
    </div>
  );
}
