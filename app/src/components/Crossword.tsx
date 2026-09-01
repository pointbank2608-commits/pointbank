import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
}

interface Placement {
  id: string;
  word: string;
  clean: string;
  row: number;
  col: number;
  dir: 'across' | 'down';
  number: number;
}

interface Puzzle {
  placements: Placement[];
  grid: (string | null)[][];
  width: number;
  height: number;
}

function cleanWord(label: string): string {
  return label.replace(/\s+/g, '').toUpperCase();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCrossword(items: GameItem[]): Puzzle {
  const words = items
    .map((it) => ({ id: it.id, word: it.label, clean: cleanWord(it.label) }))
    .filter((w) => w.clean.length >= 2);

  const seen = new Set<string>();
  const uniqueWords: typeof words = [];
  for (const w of words) {
    if (seen.has(w.clean)) continue;
    seen.add(w.clean);
    uniqueWords.push(w);
  }
  if (uniqueWords.length === 0) return { placements: [], grid: [], width: 0, height: 0 };

  const sorted = [...uniqueWords].sort((a, b) => b.clean.length - a.clean.length);

  const cellMap = new Map<string, string>();
  const raw: { id: string; word: string; clean: string; row: number; col: number; dir: 'across' | 'down' }[] = [];

  function canPlace(clean: string, row: number, col: number, dir: 'across' | 'down'): boolean {
    for (let i = 0; i < clean.length; i++) {
      const r = dir === 'across' ? row : row + i;
      const c = dir === 'across' ? col + i : col;
      const key = `${r},${c}`;
      const existing = cellMap.get(key);
      if (existing !== undefined && existing !== clean[i]) return false;
    }
    return true;
  }

  function placeWord(w: { id: string; word: string; clean: string }, row: number, col: number, dir: 'across' | 'down') {
    for (let i = 0; i < w.clean.length; i++) {
      const r = dir === 'across' ? row : row + i;
      const c = dir === 'across' ? col + i : col;
      cellMap.set(`${r},${c}`, w.clean[i]);
    }
    raw.push({ id: w.id, word: w.word, clean: w.clean, row, col, dir });
  }

  placeWord(sorted[0], 0, 0, 'across');

  for (let k = 1; k < sorted.length; k++) {
    const w = sorted[k];
    let placed = false;
    for (const existing of raw) {
      if (placed) break;
      for (let i = 0; i < existing.clean.length && !placed; i++) {
        for (let j = 0; j < w.clean.length && !placed; j++) {
          if (existing.clean[i] !== w.clean[j]) continue;
          let row: number, col: number, dir: 'across' | 'down';
          if (existing.dir === 'across') {
            dir = 'down';
            row = existing.row - j;
            col = existing.col + i;
          } else {
            dir = 'across';
            row = existing.row + i;
            col = existing.col - j;
          }
          if (canPlace(w.clean, row, col, dir)) {
            placeWord(w, row, col, dir);
            placed = true;
          }
        }
      }
    }
  }

  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;
  for (const key of cellMap.keys()) {
    const [r, c] = key.split(',').map(Number);
    minRow = Math.min(minRow, r);
    maxRow = Math.max(maxRow, r);
    minCol = Math.min(minCol, c);
    maxCol = Math.max(maxCol, c);
  }
  const height = maxRow - minRow + 1;
  const width = maxCol - minCol + 1;

  const shifted = raw.map((p) => ({ ...p, row: p.row - minRow, col: p.col - minCol }));

  const grid: (string | null)[][] = Array.from({ length: height }, () => Array(width).fill(null));
  for (const [key, letter] of cellMap.entries()) {
    const [r, c] = key.split(',').map(Number);
    grid[r - minRow][c - minCol] = letter;
  }

  const startKeyOf = (p: { row: number; col: number }) => `${p.row},${p.col}`;
  const uniqueStarts = Array.from(new Set(shifted.map(startKeyOf)))
    .map((k) => {
      const [r, c] = k.split(',').map(Number);
      return { row: r, col: c };
    })
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const numberMap = new Map<string, number>();
  uniqueStarts.forEach((s, idx) => numberMap.set(`${s.row},${s.col}`, idx + 1));

  const placements: Placement[] = shifted.map((p) => ({ ...p, number: numberMap.get(startKeyOf(p)) ?? 0 }));

  return { placements, grid, width, height };
}

export default function Crossword({ items }: Props) {
  const { t } = useTranslation();
  const [puzzle, setPuzzle] = useState<Puzzle>(() => buildCrossword(items));
  const [wordBank, setWordBank] = useState<Placement[]>(() => shuffle(puzzle.placements));
  const [filledIds, setFilledIds] = useState<Set<string>>(new Set());
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [wrongSlotId, setWrongSlotId] = useState<string | null>(null);

  if (puzzle.placements.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">🧩</div>
        <div className="font-body-md text-body-md">{t('gameCrossword.needParticipants')}</div>
      </div>
    );
  }

  const finished = filledIds.size === puzzle.placements.length;

  function restart() {
    const next = buildCrossword(items);
    setPuzzle(next);
    setWordBank(shuffle(next.placements));
    setFilledIds(new Set());
    setSelectedWordId(null);
    setWrongSlotId(null);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div className="text-5xl mb-3">🎉</div>
        <div className="font-title-md text-title-md text-on-surface mb-6">{t('gameCrossword.finishedTitle')}</div>
        <button
          onClick={restart}
          className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
        >
          {t('gameCrossword.restartButton')}
        </button>
      </div>
    );
  }

  function selectWord(id: string) {
    if (filledIds.has(id)) return;
    setSelectedWordId((prev) => (prev === id ? null : id));
  }

  function clickSlot(placement: Placement) {
    if (!selectedWordId || filledIds.has(placement.id)) return;
    if (selectedWordId === placement.id) {
      setFilledIds((prev) => new Set(prev).add(placement.id));
      setSelectedWordId(null);
      setWrongSlotId(null);
    } else {
      setWrongSlotId(placement.id);
      window.setTimeout(() => setWrongSlotId(null), 400);
    }
  }

  const cellFilled = new Set<string>();
  puzzle.placements.forEach((p) => {
    if (!filledIds.has(p.id)) return;
    for (let i = 0; i < p.clean.length; i++) {
      const r = p.dir === 'across' ? p.row : p.row + i;
      const c = p.dir === 'across' ? p.col + i : p.col;
      cellFilled.add(`${r}-${c}`);
    }
  });

  const cellNumber = new Map<string, number>();
  puzzle.placements.forEach((p) => {
    cellNumber.set(`${p.row}-${p.col}`, p.number);
  });

  const sortedSlots = [...puzzle.placements].sort((a, b) => a.number - b.number || (a.dir === 'across' ? -1 : 1));

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2 w-full">
      <div className="font-caption text-caption text-on-surface-variant mb-4 tabular-nums">
        {t('gameCrossword.foundLabel', { found: filledIds.size, total: puzzle.placements.length })}
      </div>

      <div
        data-skin-stage="board"
        className="grid gap-[2px] mb-6 w-full max-w-[420px]"
        style={{ gridTemplateColumns: `repeat(${puzzle.width}, minmax(0, 1fr))` }}
      >
        {puzzle.grid.map((row, r) =>
          row.map((ch, c) => {
            if (ch === null) return <div key={`${r}-${c}`} className="aspect-square" />;
            const key = `${r}-${c}`;
            const revealed = cellFilled.has(key);
            const num = cellNumber.get(key);
            return (
              <div
                key={key}
                data-skin-object="cell"
                className="relative aspect-square flex items-center justify-center border border-outline-variant/50 bg-surface-container-lowest rounded-[3px]"
              >
                {num !== undefined && (
                  <span className="absolute top-[1px] left-[2px] text-[7px] sm:text-[9px] text-on-surface-variant leading-none">
                    {num}
                  </span>
                )}
                <span className="font-bold text-[11px] sm:text-sm text-on-surface">{revealed ? ch : ''}</span>
              </div>
            );
          }),
        )}
      </div>

      <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameCrossword.wordBankLabel')}</div>
      <div className="flex flex-wrap justify-center gap-2 mb-5 max-w-[460px]">
        {wordBank
          .filter((p) => !filledIds.has(p.id))
          .map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectWord(p.id)}
              data-skin-object="word-chip"
              className={`px-4 py-2 rounded-full font-label-md text-label-md border-2 transition-colors ${
                selectedWordId === p.id
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface hover:bg-surface-container-low'
              }`}
            >
              {p.word}
            </button>
          ))}
      </div>

      <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameCrossword.slotListLabel')}</div>
      <div className="flex flex-wrap justify-center gap-2 max-w-[460px]">
        {sortedSlots.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={filledIds.has(p.id)}
            onClick={() => clickSlot(p)}
            className={`px-3 py-1.5 rounded-full font-caption text-caption border-2 transition-colors ${
              filledIds.has(p.id)
                ? 'bg-secondary-container/50 border-secondary text-on-surface opacity-70'
                : wrongSlotId === p.id
                  ? 'bg-error-container border-error text-on-error-container'
                  : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface hover:bg-surface-container-low'
            }`}
          >
            {p.number}
            {p.dir === 'across' ? t('gameCrossword.acrossLabel') : t('gameCrossword.downLabel')} · {p.clean.length}
            {t('gameCrossword.lettersUnit')}
          </button>
        ))}
      </div>
    </div>
  );
}
