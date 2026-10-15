import type { CSSProperties } from 'react';

/**
 * 번개 피하기 캐릭터 6종(2026-10-16) — 번개를 맞으면 캐릭터마다 우스꽝스럽게 변한다(PPT는 해골 하나뿐이었다).
 * 전부 SVG(파일 없음). 새 캐릭터 = CHARS에 한 줄 + 아래 Character의 kind 분기.
 */
export type CharKind = 'sheep' | 'boy' | 'girl' | 'umbrella' | 'zeus' | 'mermaid';
export const CHARS: { id: CharKind; emoji: string }[] = [
  { id: 'sheep', emoji: '🐑' },
  { id: 'boy', emoji: '👦' },
  { id: 'girl', emoji: '👧' },
  { id: 'umbrella', emoji: '☂️' },
  { id: 'zeus', emoji: '⚡' },
  { id: 'mermaid', emoji: '🧜‍♀️' },
];

export type CharMood = 'happy' | 'worried' | 'shocked' | 'cheer';

const SKIN = '#ffd9b5';
const SOOT = '#26262d';

function Face({ mood, cx = 70, cy = 60 }: { mood: CharMood; cx?: number; cy?: number }) {
  if (mood === 'shocked') {
    return (
      <>
        <circle cx={cx - 10} cy={cy - 2} r="8" fill="#fff" />
        <circle cx={cx + 10} cy={cy - 2} r="8" fill="#fff" />
        <circle cx={cx - 10} cy={cy - 2} r="3" fill="#111" />
        <circle cx={cx + 10} cy={cy - 2} r="3" fill="#111" />
        <ellipse cx={cx} cy={cy + 18} rx="7" ry="9" fill="#fff" />
      </>
    );
  }
  return (
    <>
      <circle cx={cx - 10} cy={cy - 2} r="4" fill="#222" />
      <circle cx={cx + 10} cy={cy - 2} r="4" fill="#222" />
      {mood === 'worried' ? (
        <>
          <path d={`M${cx - 17} ${cy - 12} L${cx - 5} ${cy - 8}`} stroke="#222" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${cx + 17} ${cy - 12} L${cx + 5} ${cy - 8}`} stroke="#222" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${cx - 8} ${cy + 16} Q${cx - 3} ${cy + 10} ${cx} ${cy + 16} T${cx + 8} ${cy + 16}`} fill="none" stroke="#222" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${cx + 24} ${cy - 20} q6 10 0 16 q-6 -6 0 -16Z`} fill="#8bd3ff" />
        </>
      ) : (
        <path d={`M${cx - 10} ${cy + 10} Q${cx} ${cy + 22} ${cx + 10} ${cy + 10}`} fill="none" stroke="#222" strokeWidth="3.5" strokeLinecap="round" />
      )}
    </>
  );
}

function Legs({ color, burnt }: { color: string; burnt: boolean }) {
  const c = burnt ? SOOT : color;
  return (
    <>
      <rect x="52" y="124" width="14" height="28" rx="6" fill={c} />
      <rect x="74" y="124" width="14" height="28" rx="6" fill={c} />
    </>
  );
}

export default function Character({ kind, mood, className, style }: { kind: CharKind; mood: CharMood; className?: string; style?: CSSProperties }) {
  const hit = mood === 'shocked';
  const skin = hit ? SOOT : SKIN;
  const wrap = (children: React.ReactNode) => (
    <svg viewBox="0 0 140 160" className={className} style={style} aria-hidden="true">
      {children}
    </svg>
  );

  if (kind === 'boy') {
    return wrap(
      hit ? (
        <>
          {/* 해골 */}
          <rect x="66" y="84" width="8" height="44" rx="3" fill="#f4f4ee" />
          {[92, 102, 112].map((y) => (
            <path key={y} d={`M48 ${y} Q70 ${y - 8} 92 ${y}`} fill="none" stroke="#f4f4ee" strokeWidth="5" strokeLinecap="round" />
          ))}
          <rect x="52" y="124" width="12" height="28" rx="5" fill="#f4f4ee" />
          <rect x="76" y="124" width="12" height="28" rx="5" fill="#f4f4ee" />
          <circle cx="70" cy="58" r="28" fill="#f4f4ee" />
          <rect x="56" y="76" width="28" height="14" rx="4" fill="#f4f4ee" />
          <circle cx="60" cy="56" r="8" fill="#111" />
          <circle cx="80" cy="56" r="8" fill="#111" />
          <path d="M70 66 l-4 8 h8Z" fill="#111" />
          {[60, 66, 72, 78].map((x) => (
            <line key={x} x1={x} y1="80" x2={x} y2="88" stroke="#111" strokeWidth="2" />
          ))}
        </>
      ) : (
        <>
          <Legs color="#3b5fc4" burnt={false} />
          <rect x="46" y="84" width="48" height="46" rx="12" fill="#ef5b5b" />
          <circle cx="70" cy="58" r="26" fill={SKIN} />
          <path d="M44 52 Q50 28 70 30 Q92 28 96 52 Q82 42 70 44 Q56 42 44 52Z" fill="#5b3a29" />
          <Face mood={mood} />
        </>
      ),
    );
  }

  if (kind === 'girl') {
    return wrap(
      <>
        <Legs color="#7c5cc4" burnt={hit} />
        <path d="M44 128 L52 86 H88 L96 128Z" fill={hit ? SOOT : '#ec4899'} />
        {hit && (
          // 폭탄 머리 곱슬
          <>
            {[[28, 40, 20], [50, 22, 22], [78, 20, 22], [104, 36, 22], [112, 62, 18], [22, 66, 18], [70, 36, 24]].map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill="#3a2a22" />
            ))}
          </>
        )}
        {!hit && (
          <>
            <circle cx="40" cy="62" r="12" fill="#f59e0b" />
            <circle cx="100" cy="62" r="12" fill="#f59e0b" />
          </>
        )}
        <circle cx="70" cy="60" r="26" fill={skin} />
        {!hit && <path d="M44 56 Q48 30 70 32 Q92 30 96 56 Q84 44 70 46 Q56 44 44 56Z" fill="#f59e0b" />}
        <Face mood={mood} />
      </>,
    );
  }

  if (kind === 'umbrella') {
    return wrap(
      <>
        <Legs color="#374151" burnt={hit} />
        <rect x="46" y="84" width="48" height="46" rx="12" fill={hit ? SOOT : '#0ea5a4'} />
        {/* 우산 */}
        <line x1="104" y1="32" x2="104" y2="110" stroke="#6b7280" strokeWidth="4" strokeLinecap="round" />
        {hit ? (
          <path d="M82 40 L104 6 L126 40 L116 30 L104 42 L92 30Z" fill="#333" stroke="#555" strokeWidth="2" />
        ) : (
          <path d="M78 36 Q104 4 130 36Z" fill="#f59e0b" />
        )}
        <circle cx="70" cy="58" r="26" fill={skin} />
        {hit ? (
          <>
            <path d="M46 40 L40 14 L58 34Z M70 32 L70 4 L80 32Z M94 40 L104 16 L88 34Z" fill={SOOT} />
          </>
        ) : (
          <path d="M44 52 Q50 30 70 32 Q92 30 96 52 Q82 42 70 44 Q56 42 44 52Z" fill="#374151" />
        )}
        <Face mood={mood} />
      </>,
    );
  }

  if (kind === 'zeus') {
    return wrap(
      <>
        <Legs color={hit ? SOOT : SKIN} burnt={hit} />
        <path d="M42 130 L50 84 H90 L98 130Z" fill={hit ? SOOT : '#f8fafc'} stroke="#cbd5e1" strokeWidth="2" />
        {/* 번개 창 */}
        <polygon points="108,60 100,88 108,88 100,118 120,80 111,80 118,60" fill="#fde047" stroke="#d97706" strokeWidth="1.5" />
        {hit && (
          <>
            {[[40, 40], [56, 24], [80, 24], [98, 40], [34, 72], [106, 72], [70, 96]].map(([x, y], i) => (
              <path key={i} d={`M70 60 L${x} ${y}`} stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
            ))}
          </>
        )}
        <circle cx="70" cy="58" r="26" fill={skin} />
        {!hit && (
          <>
            <path d="M44 56 Q46 28 70 30 Q94 28 96 56 Q82 42 70 44 Q58 42 44 56Z" fill="#e5e7eb" />
            <path d="M52 72 Q70 108 88 72 Q70 82 52 72Z" fill="#e5e7eb" />
            <path d="M46 40 q24 -14 48 0" fill="none" stroke="#22a559" strokeWidth="4" />
          </>
        )}
        <Face mood={mood} />
      </>,
    );
  }

  // mermaid
  return wrap(
    <>
      {hit ? (
        // 튀겨진 물고기 뼈 꼬리
        <>
          <line x1="70" y1="86" x2="70" y2="146" stroke="#f4f4ee" strokeWidth="5" strokeLinecap="round" />
          {[96, 106, 116, 126].map((y) => (
            <path key={y} d={`M70 ${y} L54 ${y - 8} M70 ${y} L86 ${y - 8}`} stroke="#f4f4ee" strokeWidth="3" strokeLinecap="round" />
          ))}
          <path d="M70 146 L52 158 M70 146 L88 158" stroke="#f4f4ee" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M52 86 Q70 130 70 140 Q70 150 52 156 Q60 140 56 124 Q50 104 52 86Z M88 86 Q70 130 70 140 Q70 150 88 156 Q80 140 84 124 Q90 104 88 86Z" fill="#14b8a6" />
          <rect x="50" y="84" width="40" height="40" rx="16" fill="#14b8a6" />
        </>
      )}
      <path d="M52 84 H88 V96 Q70 108 52 96Z" fill={hit ? SOOT : '#f472b6'} />
      {hit ? (
        <>
          {[[30, 44, 18], [112, 44, 18], [44, 20, 18], [96, 20, 18], [70, 12, 16], [22, 74, 14], [118, 74, 14]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#dc2626" />
          ))}
        </>
      ) : (
        <>
          <path d="M42 70 Q34 34 70 30 Q106 34 98 70 Q92 46 70 46 Q48 46 42 70Z" fill="#dc2626" />
          <path d="M42 70 Q36 90 46 100 Q44 84 48 74Z M98 70 Q104 90 94 100 Q96 84 92 74Z" fill="#dc2626" />
        </>
      )}
      <circle cx="70" cy="60" r="26" fill={skin} />
      <Face mood={mood} />
    </>,
  );
}
