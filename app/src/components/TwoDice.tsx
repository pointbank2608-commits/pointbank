import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

const SIZE = 6;
const ROLL_MS = 980;
const TEAL_DIE = '/skins/twodice-teal.png?v=3';
const CORAL_DIE = '/skins/twodice-coral.png?v=3';
const BOARD_SRC = '/skins/twodice-board.png';

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';

/** 표준 주사위 3×3 점 위치 (0=좌상 … 8=우하). */
const PIP_MAP: number[][] = [
  [],
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];

/** 그 눈이 카메라를 향하게 하는 큐브 회전. 반대면 합이 7. */
const FACE_ROT: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: -90, ry: 0 },
  3: { rx: 0, ry: -90 },
  4: { rx: 0, ry: 90 },
  5: { rx: 90, ry: 0 },
  6: { rx: 0, ry: 180 },
};

const CUBE_FACES: { n: number; pos: string }[] = [
  { n: 1, pos: 'front' },
  { n: 6, pos: 'back' },
  { n: 3, pos: 'right' },
  { n: 4, pos: 'left' },
  { n: 2, pos: 'top' },
  { n: 5, pos: 'bottom' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 항목이 36개보다 많으면 무작위 36개만, 적으면 부족한 만큼 반복해서 6x6 판을 채운다. */
function pickBoardItems(items: GameItem[]): GameItem[] {
  const pool = shuffle(items);
  return Array.from({ length: SIZE * SIZE }, (_, i) => pool[i % pool.length]);
}

function Pips({ n }: { n: number }) {
  const on = new Set(PIP_MAP[n] ?? PIP_MAP[1]);
  return (
    <div className="td-pips" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={on.has(i) ? 'td-pip' : undefined} />
      ))}
    </div>
  );
}

function ClayDie({
  src,
  tint,
  value,
  rolling,
  spin,
  tossKey,
}: {
  src: string;
  tint: 'teal' | 'coral';
  value: number;
  rolling: boolean;
  spin: 'a' | 'b';
  tossKey: number;
}) {
  const rot = FACE_ROT[value] ?? FACE_ROT[1];
  const tumble = rolling ? (spin === 'b' ? 'td-tumble-b' : 'td-tumble') : '';
  return (
    <div data-skin-object="die" className={`td-die-scene ${rolling ? 'is-rolling' : ''}`}>
      <div className={`td-toss ${rolling ? 'td-tossing' : ''}`}>
        <div
          key={tossKey}
          className={`td-cube ${tumble}`}
          style={
            {
              ['--td-rx']: `${rot.rx}deg`,
              ['--td-ry']: `${rot.ry}deg`,
              ['--td-skin']: `url(${src})`,
            } as CSSProperties
          }
        >
          {CUBE_FACES.map((face) => (
            <div key={face.n} className={`td-face td-face-${face.pos} td-face-${tint}`}>
              <Pips n={face.n} />
            </div>
          ))}
        </div>
      </div>
      <div className={`td-die-shadow ${rolling ? 'td-die-shadow-toss' : ''}`} />
    </div>
  );
}

export default function TwoDice({ items }: Props) {
  const { t } = useTranslation();
  const [board, setBoard] = useState<GameItem[]>(() => pickBoardItems(items));
  const [die1, setDie1] = useState<number | null>(null);
  const [die2, setDie2] = useState<number | null>(null);
  const [target1, setTarget1] = useState(1);
  const [target2, setTarget2] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<{ key: string; label: string }[]>([]);
  const [tossKey, setTossKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function reshuffleBoard() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBoard(pickBoardItems(items));
    setHighlightIndex(null);
    setDie1(null);
    setDie2(null);
    setTarget1(1);
    setTarget2(1);
    setHistory([]);
    setRolling(false);
  }

  function roll() {
    if (rolling || items.length === 0) return;
    const d1 = 1 + Math.floor(Math.random() * SIZE);
    const d2 = 1 + Math.floor(Math.random() * SIZE);
    setTarget1(d1);
    setTarget2(d2);
    setHighlightIndex(null);
    setRolling(true);
    setTossKey((n) => n + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDie1(d1);
      setDie2(d2);
      const idx = (d1 - 1) * SIZE + (d2 - 1);
      setHighlightIndex(idx);
      const word = board[idx];
      setHistory((prev) => [{ key: `${Date.now()}`, label: word.label }, ...prev].slice(0, 8));
      setRolling(false);
    }, ROLL_MS);
  }

  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={TEAL_DIE} alt="" className="mx-auto mb-3 h-16 w-auto" />
        <div className="font-body-md text-body-md">{t('gameTwoDice.needParticipants')}</div>
      </div>
    );
  }

  const row = die1 ?? 1;
  const col = die2 ?? 1;

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      <div className="td-dice-row mb-4 flex items-end justify-center gap-10 sm:gap-14">
        <div className="flex flex-col items-center gap-2">
          <ClayDie src={TEAL_DIE} tint="teal" value={rolling ? target2 : col} rolling={rolling} spin="a" tossKey={tossKey} />
          <div className="font-title-md text-[15px] font-bold text-deep-navy">{t('gameTwoDice.colLabel', { n: col })}</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <ClayDie src={CORAL_DIE} tint="coral" value={rolling ? target1 : row} rolling={rolling} spin="b" tossKey={tossKey} />
          <div className="font-title-md text-[15px] font-bold text-deep-navy">{t('gameTwoDice.rowLabel', { n: row })}</div>
        </div>
      </div>

      <button onClick={roll} disabled={rolling} className={`mb-5 ${pill} disabled:opacity-60`}>
        {rolling ? t('gameTwoDice.rolling') : t('gameTwoDice.rollButton')}
      </button>

      <div data-skin-stage="board" className="td-board mb-3">
        <img src={BOARD_SRC} alt="" draggable={false} className="td-board-img" />
        <div className="td-board-grid">
          <div />
          {Array.from({ length: SIZE }, (_, n) => (
            <div
              key={`col-${n}`}
              className={`td-bead ${!rolling && die2 === n + 1 ? 'td-bead-col' : ''}`}
            >
              {n + 1}
            </div>
          ))}
          {board.map((item, i) => {
            const r = Math.floor(i / SIZE);
            const showRowBead = i % SIZE === 0;
            const hit = i === highlightIndex;
            return (
              <div key={`row-${r}-${i}`} className="contents">
                {showRowBead && (
                  <div className={`td-bead ${!rolling && die1 === r + 1 ? 'td-bead-row' : ''}`}>
                    {r + 1}
                  </div>
                )}
                <div data-skin-object="cell" className={`td-cell ${hit ? 'td-hit' : ''}`}>
                  <GameFitText text={item.label} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={reshuffleBoard}
        className="mb-4 font-label-md text-label-md text-secondary hover:underline"
      >
        {t('gameTwoDice.reshuffleButton')}
      </button>

      {history.length > 0 && (
        <div className="w-full max-w-[420px]">
          <div className="mb-2 font-caption text-caption text-on-surface-variant">{t('gameTwoDice.recentResults')}</div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((h, i) => (
              <span
                key={h.key}
                className="rounded-full px-3 py-1 font-label-md text-label-md text-deep-navy"
                style={{
                  background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
                  border: i === 0 ? '2px solid #f28b73' : '2px solid #f0d7a8',
                  boxShadow: i === 0 ? woodShadow : '0 2px 0 #e8c48a',
                }}
              >
                {h.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
