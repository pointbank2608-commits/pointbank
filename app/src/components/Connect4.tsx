import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import { useGamePlay } from './GameThemeFrame';
import type { GameItem, UndoHandle } from '../lib/types';

interface Props {
  items: GameItem[];
}

type Team = 'blue' | 'red';
type Mark = Team | null;

const ROWS = 6;
const COLS = 7;
const BOARD_SRC = '/skins/c4-board.png?v=5';
const BLUE_SRC = '/skins/c4-blue.png';
const RED_SRC = '/skins/c4-red.png';

/** 정면 7×6 동일 원 구멍. 값은 이미지 너비/높이 대비 비율. */
const COL_CENTER = [0.15072, 0.26693, 0.38314, 0.49935, 0.61556, 0.73177, 0.84798];
const ROW_CENTER = [0.15088, 0.29004, 0.4292, 0.56787, 0.70703, 0.84619];
const HOLE_W = 0.08557;
const HOLE_H = 0.128355;
/** 열 전체 클릭 영역(구멍 사이 나무 포함). */
const COL_SPAN = 0.11621;
/** 점토 원판이 구멍 가장자리까지 차도록. 클립은 구멍 원. */
const DISC_FILL = 1.2;

function well(r: number, c: number) {
  return {
    left: COL_CENTER[c] - HOLE_W / 2,
    top: ROW_CENTER[r] - HOLE_H / 2,
    width: HOLE_W,
    height: HOLE_H,
  };
}

function colHit(c: number) {
  return { left: COL_CENTER[c] - COL_SPAN / 2, width: COL_SPAN };
}

function idx(r: number, c: number): number {
  return r * COLS + c;
}

function discSrc(team: Team): string {
  return team === 'blue' ? BLUE_SRC : RED_SRC;
}

function dropMs(row: number): number {
  return 220 + row * 85;
}

/** 열마다 단어 하나. 항목이 7개보다 많으면 무작위 7개만, 적으면 반복한다. */
function pickColumnItems(items: GameItem[]): GameItem[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: COLS }, (_, i) => pool[i % pool.length]);
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function findWin(marks: Mark[]): { team: Team; cells: number[] } | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const m = marks[idx(r, c)];
      if (!m) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const cells = [idx(r, c)];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (marks[idx(nr, nc)] !== m) break;
          cells.push(idx(nr, nc));
        }
        if (cells.length >= 4) return { team: m, cells };
      }
    }
  }
  return null;
}

interface Dropping {
  col: number;
  row: number;
  team: Team;
}

/**
 * 4 in a row. 열 아래에 단어를 두고, 원판을 위에서 떨어뜨려 아래부터 쌓는다.
 */
const Connect4 = forwardRef<UndoHandle, Props>(function Connect4({ items }, ref) {
  const { t } = useTranslation();
  const { fullscreen } = useGamePlay();
  const labelH = fullscreen ? 96 : 58;
  const [columns, setColumns] = useState<GameItem[]>(() => pickColumnItems(items));
  const [marks, setMarks] = useState<Mark[]>(() => Array(ROWS * COLS).fill(null));
  const [turn, setTurn] = useState<Team>('blue');
  const [dropping, setDropping] = useState<Dropping | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<{ marks: Mark[]; turn: Team } | null>(null);
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const win = findWin(marks);
  const winner = win?.team ?? null;
  const isDraw = !winner && marks.every((m) => m !== null);
  const busy = dropping !== null;

  useEffect(() => {
    return () => {
      if (dropTimer.current) clearTimeout(dropTimer.current);
    };
  }, []);

  function newRound() {
    if (dropTimer.current) clearTimeout(dropTimer.current);
    setDropping(null);
    setColumns(pickColumnItems(items));
    setMarks(Array(ROWS * COLS).fill(null));
    setTurn('blue');
    setPrevSnapshot(null);
  }

  function dropInColumn(c: number) {
    if (winner || isDraw || busy) return;
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!marks[idx(r, c)]) {
        targetRow = r;
        break;
      }
    }
    if (targetRow === -1) return;
    const team = turn;
    setPrevSnapshot({ marks, turn });
    setDropping({ col: c, row: targetRow, team });
    dropTimer.current = setTimeout(() => {
      setMarks((prev) => {
        const next = [...prev];
        next[idx(targetRow, c)] = team;
        return next;
      });
      setTurn(team === 'blue' ? 'red' : 'blue');
      setDropping(null);
    }, dropMs(targetRow));
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (busy || !prevSnapshot) return;
      setMarks(prevSnapshot.marks);
      setTurn(prevSnapshot.turn);
      setPrevSnapshot(null);
    },
  }));

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameConnect4.teamBlue') : t('gameConnect4.teamRed'));
  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={BOARD_SRC} alt="" className="mx-auto mb-3 h-16 w-auto" />
        <div className="font-body-md text-body-md">{t('gameConnect4.needParticipants')}</div>
      </div>
    );
  }

  const columnFull = (c: number) => marks[idx(0, c)] !== null || (dropping?.col === c && dropping.row === 0);

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      {!winner && !isDraw && (
        <div
          className={`mb-4 rounded-full px-8 py-3 font-title-md text-[20px] font-bold shadow-sm transition-colors ${
            turn === 'blue' ? 'bg-secondary text-on-secondary' : 'text-white'
          }`}
          style={turn === 'red' ? { backgroundColor: '#f28b73' } : undefined}
        >
          {t('gameConnect4.turnLabel', { team: teamLabel(turn) })}
        </div>
      )}

      {(winner || isDraw) && (
        <div className="mb-3 flex flex-col items-center gap-3">
          {winner ? (
            <div
              className="result-pop rounded-2xl px-9 py-4 text-center"
              style={{
                backgroundColor: winner === 'blue' ? '#3dbea8' : '#f28b73',
                border: '3px solid #f0d7a8',
                boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
              }}
            >
              <div className="font-title-md text-[22px] font-bold text-white">
                {t('gameConnect4.winMessage', { team: teamLabel(winner) })}
              </div>
            </div>
          ) : (
            <div className="rounded-full bg-[#f3eee4] px-6 py-2.5 font-title-md text-title-md text-on-surface">
              {t('gameConnect4.drawMessage')}
            </div>
          )}
          <button onClick={newRound} className={pill}>
            {t('gameConnect4.playAgainButton')}
          </button>
        </div>
      )}

      <div className="relative mb-3 h-12 w-[min(760px,100%)]">
        {Array.from({ length: COLS }, (_, c) => {
          const disabled = !!winner || isDraw || busy || columnFull(c);
          return (
            <button
              key={`col-${c}`}
              type="button"
              disabled={disabled}
              onClick={() => dropInColumn(c)}
              data-skin-object="drop-button"
              aria-label={t('gameConnect4.columnHint')}
              className="absolute top-0 z-20 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full disabled:opacity-30"
              style={{
                left: `${COL_CENTER[c] * 100}%`,
                backgroundColor: '#e8c48a',
                boxShadow: '0 3px 0 #c4925c, 0 6px 10px rgba(110,62,18,0.16)',
              }}
            >
              <span className="material-symbols-outlined text-[26px] font-bold text-[#3dbea8]">arrow_downward</span>
            </button>
          );
        })}
      </div>

      <div
        data-skin-stage="board"
        className="relative w-[min(760px,100%)] overflow-hidden"
        style={{ filter: 'drop-shadow(0 10px 14px rgba(90, 50, 18, 0.28))' }}
      >
        {/* 높이만 잡는 투명 스페이서. 원판은 나무 뒤에서 구멍으로 비친다. */}
        <img src={BOARD_SRC} alt="" draggable={false} className="pointer-events-none invisible w-full select-none" />

        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[18px]"
          style={{
            left: `${(COL_CENTER[0] - HOLE_W * 0.85) * 100}%`,
            top: `${(ROW_CENTER[0] - HOLE_H * 0.85) * 100}%`,
            width: `${(COL_CENTER[6] - COL_CENTER[0] + HOLE_W * 1.7) * 100}%`,
            height: `${(ROW_CENTER[5] - ROW_CENTER[0] + HOLE_H * 1.7) * 100}%`,
            backgroundColor: '#fff8ec',
          }}
        />

        {marks.map((mark, i) => {
          if (!mark) return null;
          const r = Math.floor(i / COLS);
          const c = i % COLS;
          const winning = win?.cells.includes(i);
          const cell = well(r, c);
          return (
            <div
              key={`disc-${i}`}
              className="pointer-events-none absolute z-[1]"
              style={{
                left: `${(cell.left + cell.width / 2) * 100}%`,
                top: `${(cell.top + cell.height / 2) * 100}%`,
                width: `${cell.width * 100}%`,
                aspectRatio: '1',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="c4-disc">
                <img
                  src={discSrc(mark)}
                  alt=""
                  draggable={false}
                  className={`h-full w-full select-none object-cover ${winning ? 'c4-win' : ''}`}
                  style={{ transform: `scale(${DISC_FILL})` }}
                />
              </div>
            </div>
          );
        })}

        {dropping && (
          <div
            className="pointer-events-none absolute z-[1]"
            style={{
              left: `${(well(dropping.row, dropping.col).left + well(dropping.row, dropping.col).width / 2) * 100}%`,
              top: `${(well(dropping.row, dropping.col).top + well(dropping.row, dropping.col).height / 2) * 100}%`,
              width: `${well(dropping.row, dropping.col).width * 100}%`,
              aspectRatio: '1',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="c4-disc c4-drop"
              style={
                {
                  ['--c4-from']: `-${(well(dropping.row, dropping.col).top / well(dropping.row, dropping.col).height + 1.2) * 100}%`,
                  ['--c4-ms']: `${dropMs(dropping.row)}ms`,
                } as CSSProperties
              }
            >
              <img
                src={discSrc(dropping.team)}
                alt=""
                draggable={false}
                className="h-full w-full select-none object-cover"
                style={{ transform: `scale(${DISC_FILL})` }}
              />
            </div>
          </div>
        )}

        <img
          src={BOARD_SRC}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-[2] h-full w-full select-none object-contain"
        />

        {Array.from({ length: COLS }, (_, c) => {
          const hit = colHit(c);
          const disabled = !!winner || isDraw || busy || columnFull(c);
          return (
            <button
              key={`hit-${c}`}
              type="button"
              disabled={disabled}
              onClick={() => dropInColumn(c)}
              aria-label={t('gameConnect4.columnHint')}
              className="absolute z-[3] cursor-pointer bg-transparent disabled:cursor-default"
              style={{
                left: `${hit.left * 100}%`,
                top: 0,
                width: `${hit.width * 100}%`,
                height: '100%',
              }}
            />
          );
        })}
      </div>

      <div className={`relative mt-3 mb-1 w-[min(760px,100%)] ${fullscreen ? 'h-[120px]' : 'h-[78px]'}`}>
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${(COL_CENTER[0] - COL_SPAN * 0.48) * 100}%`,
            width: `${(COL_CENTER[6] - COL_CENTER[0] + COL_SPAN * 0.96) * 100}%`,
            bottom: 6,
            height: 22,
            background: 'linear-gradient(180deg, #f6dfb0 0%, #e8c48a 38%, #d4a056 72%, #c4925c 100%)',
            boxShadow: '0 5px 0 #a06b38, 0 10px 16px rgba(110,62,18,0.18)',
          }}
        />
        {columns.map((item, c) => (
          <div
            key={item.id + String(c)}
            className="absolute bottom-[16px] flex -translate-x-1/2 items-center justify-center"
            style={{
              left: `${COL_CENTER[c] * 100}%`,
              width: `${COL_SPAN * 86}%`,
              height: labelH,
              padding: '8px 7px',
              borderRadius: 20,
              background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
              boxShadow: '0 5px 0 #b07d3c, 0 10px 16px rgba(110,62,18,0.16)',
            }}
          >
            <span
              className="flex h-full w-full items-center justify-center px-1"
              style={{
                borderRadius: 13,
                background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.18)',
              }}
            >
              <span className="block h-full w-full min-h-0">
                <GameFitText text={item.label} />
              </span>
            </span>
          </div>
        ))}
      </div>

      {!winner && !isDraw && (
        <div className="mt-4 text-[17px] font-bold text-on-surface">{t('gameConnect4.columnHint')}</div>
      )}
    </div>
  );
});

export default Connect4;
