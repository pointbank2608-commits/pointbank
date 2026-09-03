import { forwardRef, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import type { GameItem, UndoHandle } from '../lib/types';

interface Props {
  items: GameItem[];
}

type Team = 'blue' | 'red';
type Mark = Team | null;

const BOARD_SRC = '/skins/tic-board.png';
const O_SRC = '/skins/tic-o.png';
const X_SRC = '/skins/tic-x.png';

/** 스킨 이미지에서 측정한 9칸. 값은 이미지 너비/높이 대비 비율. */
const CELLS = [
  { left: 0.091, top: 0.093, width: 0.255, height: 0.248 },
  { left: 0.38, top: 0.093, width: 0.246, height: 0.248 },
  { left: 0.661, top: 0.093, width: 0.256, height: 0.248 },
  { left: 0.091, top: 0.38, width: 0.255, height: 0.244 },
  { left: 0.381, top: 0.38, width: 0.245, height: 0.244 },
  { left: 0.662, top: 0.38, width: 0.255, height: 0.244 },
  { left: 0.092, top: 0.664, width: 0.254, height: 0.248 },
  { left: 0.381, top: 0.664, width: 0.245, height: 0.248 },
  { left: 0.662, top: 0.664, width: 0.255, height: 0.248 },
] as const;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** 항목이 9개보다 많으면 무작위 9개만, 적으면 부족한 만큼 반복해서 판을 채운다. */
function pickBoardItems(items: GameItem[]): GameItem[] {
  if (items.length === 0) return [];
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: 9 }, (_, i) => pool[i % pool.length]);
}

function checkWinner(marks: Mark[]): Team | null {
  for (const [a, b, c] of LINES) {
    if (marks[a] && marks[a] === marks[b] && marks[b] === marks[c]) return marks[a];
  }
  return null;
}

/**
 * 틱택토. 등록한 단어를 3×3 나무 판에 올려 두고, 두 팀이 번갈아 칸을 차지한다.
 */
const TicTacToe = forwardRef<UndoHandle, Props>(function TicTacToe({ items }, ref) {
  const { t } = useTranslation();
  const [board, setBoard] = useState<GameItem[]>(() => pickBoardItems(items));
  const [marks, setMarks] = useState<Mark[]>(() => Array(9).fill(null));
  const [turn, setTurn] = useState<Team>('blue');
  const [prevSnapshot, setPrevSnapshot] = useState<{ marks: Mark[]; turn: Team } | null>(null);
  const winner = checkWinner(marks);
  const isDraw = !winner && marks.every((m) => m !== null);

  function newRound() {
    setBoard(pickBoardItems(items));
    setMarks(Array(9).fill(null));
    setTurn('blue');
    setPrevSnapshot(null);
  }

  function claim(index: number) {
    if (winner || isDraw || marks[index]) return;
    setPrevSnapshot({ marks, turn });
    const next = [...marks];
    next[index] = turn;
    setMarks(next);
    setTurn(turn === 'blue' ? 'red' : 'blue');
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!prevSnapshot) return;
      setMarks(prevSnapshot.marks);
      setTurn(prevSnapshot.turn);
      setPrevSnapshot(null);
    },
  }));

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameTicTacToe.teamBlue') : t('gameTicTacToe.teamRed'));
  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={BOARD_SRC} alt="" className="mx-auto mb-3 h-20 w-auto" />
        <div className="font-body-md text-body-md">{t('gameTicTacToe.needParticipants')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      {!winner && !isDraw && (
        <div
          className={`mb-4 rounded-full px-6 py-2.5 font-title-md text-title-md shadow-sm transition-colors ${
            turn === 'blue' ? 'bg-secondary text-on-secondary' : 'text-white'
          }`}
          style={turn === 'red' ? { backgroundColor: '#f28b73' } : undefined}
        >
          {t('gameTicTacToe.turnLabel', { team: teamLabel(turn) })}
        </div>
      )}

      {(winner || isDraw) && (
        <div className="mb-4 flex flex-col items-center gap-3">
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
                {t('gameTicTacToe.winMessage', { team: teamLabel(winner) })}
              </div>
            </div>
          ) : (
            <div className="rounded-full bg-[#f3eee4] px-6 py-2.5 font-title-md text-title-md text-on-surface">
              {t('gameTicTacToe.drawMessage')}
            </div>
          )}
          <button onClick={newRound} className={pill}>
            {t('gameTicTacToe.playAgainButton')}
          </button>
        </div>
      )}

      <div
        data-skin-stage="board"
        className="relative mb-3 w-[min(420px,92vw)]"
        style={{ filter: 'drop-shadow(0 10px 14px rgba(90, 50, 18, 0.28))' }}
      >
        <img src={BOARD_SRC} alt="" draggable={false} className="pointer-events-none w-full select-none" />
        {board.map((item, i) => {
          const mark = marks[i];
          const cell = CELLS[i];
          return (
            <button
              key={item.id + String(i)}
              type="button"
              onClick={() => claim(i)}
              disabled={!!mark || !!winner || isDraw}
              data-skin-object="cell"
              className={`absolute flex flex-col items-center justify-center px-1.5 text-center transition-transform ${
                mark || winner || isDraw ? 'cursor-default' : 'cursor-pointer hover:scale-[1.03]'
              }`}
              style={{
                left: `${cell.left * 100}%`,
                top: `${cell.top * 100}%`,
                width: `${cell.width * 100}%`,
                height: `${cell.height * 100}%`,
              }}
            >
              {mark ? (
                <>
                  <img
                    src={mark === 'blue' ? O_SRC : X_SRC}
                    alt=""
                    draggable={false}
                    className="pointer-events-none h-[58%] w-[58%] select-none object-contain"
                  />
                  <span className="mt-0.5 h-[34%] w-full min-h-0">
                    <GameFitText text={item.label} />
                  </span>
                </>
              ) : (
                <span className="h-[86%] w-full min-h-0">
                  <GameFitText text={item.label} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!winner && !isDraw && (
        <div className="mt-1 font-caption text-caption text-on-surface-variant">{t('gameTicTacToe.boardHint')}</div>
      )}
    </div>
  );
});

export default TicTacToe;
