import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameItem } from '../lib/types';

export type CrosswordStyle = 'board' | 'blocks';

interface Props {
  items: GameItem[];
  boardStyle?: CrosswordStyle;
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

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';
const pill =
  'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

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

export default function Crossword({ items, boardStyle = 'board' }: Props) {
  const { t } = useTranslation();
  const blocks = boardStyle === 'blocks';
  const [puzzle, setPuzzle] = useState<Puzzle>(() => buildCrossword(items));
  const [wordBank, setWordBank] = useState<Placement[]>(() => shuffle(puzzle.placements));
  const [filledIds, setFilledIds] = useState<Set<string>>(new Set());
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [wrongSlotId, setWrongSlotId] = useState<string | null>(null);
  const wrongTimer = useRef<number | null>(null);
  const itemKey = items.map((it) => it.id).join(',');

  useEffect(() => {
    if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    const next = buildCrossword(items);
    setPuzzle(next);
    setWordBank(shuffle(next.placements));
    setFilledIds(new Set());
    setSelectedWordId(null);
    setWrongSlotId(null);
    return () => {
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  if (puzzle.placements.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center">
          <div className="cw-frame pointer-events-none w-[108px] p-2">
            <div className="cw-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {['C', 'A', 'T', null, 'A', null, 'B', 'A', 'G'].map((ch, i) =>
                ch === null ? (
                  <span key={i} className="cw-hole" />
                ) : (
                  <span key={i} className="cw-cell text-[10px]">
                    {ch}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
        <div className="font-body-md text-body-md">{t('gameCrossword.needParticipants')}</div>
      </div>
    );
  }

  const finished = filledIds.size === puzzle.placements.length;

  function restart() {
    if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    const next = buildCrossword(items);
    setPuzzle(next);
    setWordBank(shuffle(next.placements));
    setFilledIds(new Set());
    setSelectedWordId(null);
    setWrongSlotId(null);
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
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
      wrongTimer.current = window.setTimeout(() => setWrongSlotId(null), 400);
    }
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div
          className="mb-6 w-[min(360px,92%)] px-2 py-2 text-center"
          style={{
            borderRadius: 22,
            background: 'linear-gradient(180deg, #f8e4b8 0%, #e8c48a 42%, #c9964e 100%)',
            boxShadow: woodShadow,
          }}
        >
          <div
            className="px-4 py-5"
            style={{
              borderRadius: 16,
              background: 'linear-gradient(180deg, #fffef9 0%, #fff4e0 100%)',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 4px rgba(166,112,48,0.16)',
            }}
          >
            <div className="font-title-md text-title-md text-deep-navy">{t('gameCrossword.finishedTitle')}</div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameCrossword.restartButton')}
        </button>
      </div>
    );
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
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {t('gameCrossword.foundLabel', { found: filledIds.size, total: puzzle.placements.length })}
      </div>

      <div data-skin-stage="board" className={`cw-frame mb-5 ${blocks ? 'cw-blocks' : ''}`}>
        <div className="cw-grid" style={{ gridTemplateColumns: `repeat(${puzzle.width}, minmax(0, 1fr))` }}>
          {puzzle.grid.map((row, r) =>
            row.map((ch, c) => {
              if (ch === null) return <div key={`${r}-${c}`} className="cw-hole" />;
              const key = `${r}-${c}`;
              const revealed = cellFilled.has(key);
              const num = cellNumber.get(key);
              const tone = (r + c) % 4;
              return (
                <div
                  key={key}
                  data-skin-object="cell"
                  className={`cw-cell ${blocks && !revealed ? `cw-clay-${tone}` : ''} ${revealed ? 'is-ok' : ''}`}
                >
                  {num !== undefined && <span className="cw-num">{num}</span>}
                  <span>{revealed ? ch : ''}</span>
                </div>
              );
            }),
          )}
        </div>
      </div>

      <div className="mb-2 font-caption text-caption text-on-surface-variant">{t('gameCrossword.wordBankLabel')}</div>
      <div className="cw-row mb-5">
        {wordBank
          .filter((p) => !filledIds.has(p.id))
          .map((p, i) => {
            const on = selectedWordId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectWord(p.id)}
                data-skin-object="word-chip"
                className={`cw-chip ${on ? 'is-on' : blocks ? `is-clay-${i % 4}` : ''}`}
              >
                {p.word}
              </button>
            );
          })}
      </div>

      <div className="mb-2 font-caption text-caption text-on-surface-variant">{t('gameCrossword.slotListLabel')}</div>
      <div className="cw-row">
        {sortedSlots.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={filledIds.has(p.id)}
            onClick={() => clickSlot(p)}
            className={`cw-slot ${filledIds.has(p.id) ? 'is-ok' : wrongSlotId === p.id ? 'is-no' : ''}`}
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
