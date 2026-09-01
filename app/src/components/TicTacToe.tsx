import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

type Team = 'blue' | 'red';
type Mark = Team | null;

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

export default function TicTacToe({ items }: Props) {
  const { t } = useTranslation();
  const [board, setBoard] = useState<GameItem[]>(() => pickBoardItems(items));
  const [marks, setMarks] = useState<Mark[]>(() => Array(9).fill(null));
  const [turn, setTurn] = useState<Team>('blue');
  const winner = checkWinner(marks);
  const isDraw = !winner && marks.every((m) => m !== null);

  function newRound() {
    setBoard(pickBoardItems(items));
    setMarks(Array(9).fill(null));
    setTurn('blue');
  }

  function claim(index: number) {
    if (winner || isDraw || marks[index]) return;
    const next = [...marks];
    next[index] = turn;
    setMarks(next);
    setTurn(turn === 'blue' ? 'red' : 'blue');
  }

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">⭕</div>
        <div className="font-body-md text-body-md">{t('gameTicTacToe.needParticipants')}</div>
      </div>
    );
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameTicTacToe.teamBlue') : t('gameTicTacToe.teamRed'));

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      {!winner && !isDraw && (
        <div
          className={`mb-4 px-6 py-2.5 rounded-full font-title-md text-title-md shadow-sm transition-colors ${
            turn === 'blue' ? 'bg-primary text-on-primary' : 'bg-error text-on-error'
          }`}
        >
          {t('gameTicTacToe.turnLabel', { team: teamLabel(turn) })}
        </div>
      )}

      {(winner || isDraw) && (
        <div className="mb-4 flex flex-col items-center gap-3">
          <div
            className={`px-6 py-2.5 rounded-full font-title-md text-title-md shadow-sm ${
              winner === 'blue'
                ? 'bg-primary text-on-primary'
                : winner === 'red'
                  ? 'bg-error text-on-error'
                  : 'bg-surface-container-low text-on-surface'
            }`}
          >
            {winner ? t('gameTicTacToe.winMessage', { team: teamLabel(winner) }) : t('gameTicTacToe.drawMessage')}
          </div>
          <button
            onClick={newRound}
            className="px-8 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('gameTicTacToe.playAgainButton')}
          </button>
        </div>
      )}

      <div data-skin-stage="board" className="grid grid-cols-3 gap-2.5 w-full max-w-[420px]">
        {board.map((item, i) => {
          const mark = marks[i];
          return (
            <button
              key={i}
              type="button"
              onClick={() => claim(i)}
              disabled={!!mark || !!winner || isDraw}
              data-skin-object="cell"
              className={`aspect-square rounded-2xl flex items-center justify-center text-center px-2 font-title-md text-title-md [word-break:keep-all] transition-all border-2 ${
                mark === 'blue'
                  ? 'bg-primary/15 border-primary text-primary'
                  : mark === 'red'
                    ? 'bg-error/15 border-error text-error'
                    : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface hover:bg-surface-container-low cursor-pointer'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {!winner && !isDraw && (
        <div className="mt-4 font-caption text-caption text-on-surface-variant">{t('gameTicTacToe.boardHint')}</div>
      )}
    </div>
  );
}
