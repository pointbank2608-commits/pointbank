import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

interface Cell {
  row: number;
  col: number;
}

interface Placement {
  id: string;
  word: string;
  cells: Cell[];
}

interface Puzzle {
  grid: string[][];
  placements: Placement[];
}

const DIRECTIONS: { dr: number; dc: number }[] = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: -1 },
];

function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

function buildPuzzle(items: GameItem[]): Puzzle {
  const words = items
    .map((it) => ({ id: it.id, word: it.label, clean: it.label.replace(/\s+/g, '').toUpperCase() }))
    .filter((w) => w.clean.length >= 2);

  if (words.length === 0) return { grid: [], placements: [] };

  const longest = Math.max(...words.map((w) => w.clean.length));
  const size = Math.min(14, Math.max(9, longest + 2));

  const grid: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const placements: Placement[] = [];
  const sorted = [...words].sort((a, b) => b.clean.length - a.clean.length);

  for (const w of sorted) {
    if (w.clean.length > size) continue;
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const startRow = Math.floor(Math.random() * size);
      const startCol = Math.floor(Math.random() * size);
      const endRow = startRow + dir.dr * (w.clean.length - 1);
      const endCol = startCol + dir.dc * (w.clean.length - 1);
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

      const cells: Cell[] = [];
      let ok = true;
      for (let i = 0; i < w.clean.length; i++) {
        const r = startRow + dir.dr * i;
        const c = startCol + dir.dc * i;
        const existing = grid[r][c];
        if (existing !== null && existing !== w.clean[i]) {
          ok = false;
          break;
        }
        cells.push({ row: r, col: c });
      }
      if (!ok) continue;

      cells.forEach((cell, i) => {
        grid[cell.row][cell.col] = w.clean[i];
      });
      placements.push({ id: w.id, word: w.word, cells });
      placed = true;
    }
  }

  const usedChars = Array.from(new Set(sorted.flatMap((w) => [...w.clean])));
  const fillerPool = usedChars.length >= 5 ? usedChars : [...usedChars, ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  const finalGrid: string[][] = grid.map((row) =>
    row.map((cell) => cell ?? fillerPool[Math.floor(Math.random() * fillerPool.length)]),
  );

  return { grid: finalGrid, placements };
}

function lineBetween(a: Cell, b: Cell): Cell[] | null {
  const dr = b.row - a.row;
  const dc = b.col - a.col;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  if (steps === 0) return null;
  if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
  const stepR = Math.sign(dr);
  const stepC = Math.sign(dc);
  const cells: Cell[] = [];
  for (let i = 0; i <= steps; i++) {
    cells.push({ row: a.row + stepR * i, col: a.col + stepC * i });
  }
  return cells;
}

function sameCells(a: Cell[], b: Cell[]): boolean {
  if (a.length !== b.length) return false;
  const forward = a.every((c, i) => c.row === b[i].row && c.col === b[i].col);
  const backward = a.every((c, i) => c.row === b[b.length - 1 - i].row && c.col === b[b.length - 1 - i].col);
  return forward || backward;
}

export default function WordSearch({ items }: Props) {
  const { t } = useTranslation();
  const [puzzle, setPuzzle] = useState<Puzzle>(() => buildPuzzle(items));
  const [selectedStart, setSelectedStart] = useState<Cell | null>(null);
  const [foundIds, setFoundIds] = useState<Set<string>>(new Set());
  const [wrongCells, setWrongCells] = useState<Set<string> | null>(null);

  const { grid, placements } = puzzle;

  if (placements.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🔍</div>
        <div className="font-body-md text-body-md">{t('gameWordSearch.needParticipants')}</div>
      </div>
    );
  }

  const finished = foundIds.size === placements.length;

  function restart() {
    setPuzzle(buildPuzzle(items));
    setSelectedStart(null);
    setFoundIds(new Set());
    setWrongCells(null);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🎉</div>
        <div className="font-title-md text-title-md text-on-surface mb-6">{t('gameWordSearch.finishedTitle')}</div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameWordSearch.restartButton')}
        </button>
      </div>
    );
  }

  function clickCell(row: number, col: number) {
    if (!selectedStart) {
      setSelectedStart({ row, col });
      setWrongCells(null);
      return;
    }
    if (selectedStart.row === row && selectedStart.col === col) {
      setSelectedStart(null);
      return;
    }
    const line = lineBetween(selectedStart, { row, col });
    setSelectedStart(null);
    if (!line) return;
    const match = placements.find((p) => !foundIds.has(p.id) && sameCells(p.cells, line));
    if (match) {
      setFoundIds((prev) => new Set(prev).add(match.id));
      setWrongCells(null);
    } else {
      const keys = new Set(line.map((c) => cellKey(c.row, c.col)));
      setWrongCells(keys);
      window.setTimeout(() => setWrongCells(null), 400);
    }
  }

  const foundCellKeys = new Set<string>();
  placements.forEach((p) => {
    if (foundIds.has(p.id)) p.cells.forEach((c) => foundCellKeys.add(cellKey(c.row, c.col)));
  });

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2 w-full">
      <div className="font-caption text-caption text-on-surface-variant mb-4 tabular-nums">
        {t('gameWordSearch.foundLabel', { found: foundIds.size, total: placements.length })}
      </div>

      <div
        data-skin-stage="board"
        className="grid gap-[2px] mb-6 w-full max-w-[460px]"
        style={{ gridTemplateColumns: `repeat(${grid.length}, minmax(0, 1fr))` }}
      >
        {grid.map((row, r) =>
          row.map((ch, c) => {
            const key = cellKey(r, c);
            const isFound = foundCellKeys.has(key);
            const isSelected = selectedStart?.row === r && selectedStart?.col === c;
            const isWrong = wrongCells?.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => clickCell(r, c)}
                data-skin-object="cell"
                className={`aspect-square flex items-center justify-center rounded font-label-md text-[12px] sm:text-sm font-bold transition-colors ${
                  isFound
                    ? 'bg-secondary-container text-on-surface'
                    : isWrong
                      ? 'bg-error-container text-on-error-container'
                      : isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
                }`}
              >
                {ch}
              </button>
            );
          }),
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2 max-w-[460px]">
        {placements.map((p) => (
          <span
            key={p.id}
            data-skin-object="word-chip"
            className={`px-3 py-1.5 rounded-full font-label-md text-label-md ${
              foundIds.has(p.id)
                ? 'bg-secondary-container/50 text-on-surface line-through opacity-60'
                : 'bg-surface-container-low text-on-surface'
            }`}
          >
            {p.word}
          </span>
        ))}
      </div>
    </div>
  );
}
