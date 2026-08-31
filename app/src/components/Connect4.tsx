import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

type Team = 'blue' | 'red';
type Mark = Team | null;

const ROWS = 6;
const COLS = 7;

function idx(r: number, c: number): number {
  return r * COLS + c;
}

/** 항목이 42개보다 많으면 무작위 42개만, 적으면 부족한 만큼 반복해서 판을 채운다. */
function pickBoardItems(items: GameItem[]): GameItem[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: ROWS * COLS }, (_, i) => pool[i % pool.length]);
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function checkWinner(marks: Mark[]): Team | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const m = marks[idx(r, c)];
      if (!m) continue;
      for (const [dr, dc] of DIRECTIONS) {
        let count = 1;
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (marks[idx(nr, nc)] !== m) break;
          count++;
        }
        if (count >= 4) return m;
      }
    }
  }
  return null;
}

export default function Connect4({ items }: Props) {
  const { t } = useTranslation();
  const [board, setBoard] = useState<GameItem[]>(() => pickBoardItems(items));
  const [marks, setMarks] = useState<Mark[]>(() => Array(ROWS * COLS).fill(null));
  const [turn, setTurn] = useState<Team>('blue');
  const winner = checkWinner(marks);
  const isDraw = !winner && marks.every((m) => m !== null);

  function newRound() {
    setBoard(pickBoardItems(items));
    setMarks(Array(ROWS * COLS).fill(null));
    setTurn('blue');
  }

  function dropInColumn(c: number) {
    if (winner || isDraw) return;
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!marks[idx(r, c)]) {
        targetRow = r;
        break;
      }
    }
    if (targetRow === -1) return;
    const next = [...marks];
    next[idx(targetRow, c)] = turn;
    setMarks(next);
    setTurn(turn === 'blue' ? 'red' : 'blue');
  }

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🔴</div>
        <div className="font-body-md text-body-md">{t('gameConnect4.needParticipants')}</div>
      </div>
    );
  }

  const teamLabel = (team: Team) => (team === 'blue' ? t('gameConnect4.teamBlue') : t('gameConnect4.teamRed'));
  const columnFull = (c: number) => marks[idx(0, c)] !== null;

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2">
      {!winner && !isDraw && (
        <div
          className={`mb-4 px-6 py-2.5 rounded-full font-title-md text-title-md shadow-sm transition-colors ${
            turn === 'blue' ? 'bg-primary text-on-primary' : 'bg-error text-on-error'
          }`}
        >
          {t('gameConnect4.turnLabel', { team: teamLabel(turn) })}
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
            {winner ? t('gameConnect4.winMessage', { team: teamLabel(winner) }) : t('gameConnect4.drawMessage')}
          </div>
          <button
            onClick={newRound}
            className="px-8 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-colors"
          >
            {t('gameConnect4.playAgainButton')}
          </button>
        </div>
      )}

      <div className="w-full max-w-[600px] overflow-x-auto">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(56px, 1fr))`, width: '100%' }}>
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={`col-${c}`}
              type="button"
              disabled={!!winner || isDraw || columnFull(c)}
              onClick={() => dropInColumn(c)}
              className="py-1.5 rounded-t-lg bg-surface-container-low hover:bg-surface-container disabled:opacity-30 text-primary flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
            </button>
          ))}

          {board.map((item, i) => {
            const mark = marks[i];
            return (
              <div
                key={i}
                className={`aspect-square rounded-md flex items-center justify-center text-center px-0.5 font-label-md text-[10px] sm:text-[12px] leading-tight [word-break:keep-all] border ${
                  mark === 'blue'
                    ? 'bg-primary/15 border-primary text-primary'
                    : mark === 'red'
                      ? 'bg-error/15 border-error text-error'
                      : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface'
                }`}
              >
                {item.label}
              </div>
            );
          })}
        </div>
      </div>

      {!winner && !isDraw && (
        <div className="mt-4 font-caption text-caption text-on-surface-variant">{t('gameConnect4.columnHint')}</div>
      )}
    </div>
  );
}
