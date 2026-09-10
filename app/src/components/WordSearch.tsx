import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colorFor } from '../lib/wheel';
import { useGamePlay } from './GameThemeFrame';
import type { GameItem } from '../lib/types';

export type WordSearchStyle = 'board' | 'tiles';

interface Props {
  items: GameItem[];
  boardStyle?: WordSearchStyle;
  /** true면 오른쪽에 단어 개수 조절 + 이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  /** 상단 이름 표시/수정 + 단어 개수 +/- 툴바. GameThemeFrame 안(전체화면 포함)에서도
   * 보이도록 WordSearch 자체에 둔다. */
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
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

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';
const pill =
  'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

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

export default function WordSearch({
  items,
  boardStyle = 'board',
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const tiles = boardStyle === 'tiles';
  const [puzzle, setPuzzle] = useState<Puzzle>(() => buildPuzzle(items));
  const [selectedStart, setSelectedStart] = useState<Cell | null>(null);
  const [foundIds, setFoundIds] = useState<Set<string>>(new Set());
  const [wrongCells, setWrongCells] = useState<Set<string> | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const wrongTimer = useRef<number | null>(null);
  // 라벨(단어)까지 키에 포함시켜야 이름을 바꿨을 때도 퍼즐이 새로 만들어진다 — id만
  // 키로 쓰면 rename(같은 id, 다른 label)이 재생성을 트리거하지 못했다.
  const itemKey = items.map((it) => `${it.id}:${it.label}`).join(',');

  useEffect(() => {
    if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    setPuzzle(buildPuzzle(items));
    setSelectedStart(null);
    setFoundIds(new Set());
    setWrongCells(null);
    return () => {
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  // 오른쪽 목록 입력창의 초안 텍스트를 실제 단어와 맞춰둔다 — 타이핑 중엔 이 draft를
  // 보여주다가(반응성), blur/Enter 시점에 onEditItem으로 실제 반영한다.
  useEffect(() => {
    setItemDrafts(Object.fromEntries(items.map((i) => [i.id, i.label])));
  }, [items]);

  function handleItemDraftChange(id: string, value: string) {
    setItemDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function commitItemDraft(id: string) {
    const value = (itemDrafts[id] ?? '').trim();
    if (value) onEditItem?.(id, value);
  }

  function startEditTemplateName() {
    setTemplateNameDraft(templateName ?? '');
    setEditingTemplateName(true);
  }

  function commitTemplateNameEdit() {
    const trimmed = templateNameDraft.trim();
    setEditingTemplateName(false);
    if (trimmed && trimmed !== templateName) onRenameTemplate?.(trimmed);
  }

  const { grid, placements } = puzzle;

  if (placements.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center">
          <div className="ws-frame pointer-events-none w-[120px] p-2">
            <div className="ws-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {['A', 'a', 'B', 'C', 'a', 'T', 'D', 'O', 'G'].map((ch, i) => (
                <span key={i} className="ws-cell text-[10px]">
                  {ch}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="font-body-md text-body-md">{t('gameWordSearch.needParticipants')}</div>
      </div>
    );
  }

  if (grid.length === 0) {
    return null;
  }

  const finished = foundIds.size === placements.length;

  function restart() {
    if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    setPuzzle(buildPuzzle(items));
    setSelectedStart(null);
    setFoundIds(new Set());
    setWrongCells(null);
  }

  function clickCell(row: number, col: number) {
    if (finished) return;
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
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
      wrongTimer.current = window.setTimeout(() => setWrongCells(null), 500);
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
            <div className="font-title-md text-title-md text-deep-navy">{t('gameWordSearch.finishedTitle')}</div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameWordSearch.restartButton')}
        </button>
      </div>
    );
  }

  const foundCellKeys = new Set<string>();
  placements.forEach((p) => {
    if (foundIds.has(p.id)) p.cells.forEach((c) => foundCellKeys.add(cellKey(c.row, c.col)));
  });

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div
        className={`flex flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
      >
        <div className="flex flex-col items-center">
          {editable &&
            (editingTemplateName ? (
              <input
                autoFocus
                value={templateNameDraft}
                onChange={(e) => setTemplateNameDraft(e.target.value)}
                onBlur={commitTemplateNameEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTemplateNameEdit();
                  if (e.key === 'Escape') setEditingTemplateName(false);
                }}
                className="mb-2 w-full max-w-[420px] font-headline-lg-mobile text-headline-lg-mobile text-deep-navy bg-surface-container-lowest border border-primary rounded-lg px-2 outline-none text-center"
              />
            ) : (
              <button
                type="button"
                onClick={startEditTemplateName}
                title={t('gameAdmin.renameInlineHint')}
                className="mb-2 max-w-[420px] truncate font-headline-lg-mobile text-headline-lg-mobile text-deep-navy hover:bg-surface-container-lowest rounded-lg px-2 transition-colors"
              >
                {templateName}
              </button>
            ))}
          {editable && !itemsHidden && (
            <div className="mb-3 max-w-[420px] text-center font-caption text-caption text-on-surface-variant">
              {t('gameAdmin.editHintItems')}
            </div>
          )}
      <div className="mb-4 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {t('gameWordSearch.foundLabel', { found: foundIds.size, total: placements.length })}
      </div>

      <div data-skin-stage="board" className={`ws-frame mb-5 ${tiles ? 'ws-tiles' : ''}`}>
        <div className="ws-grid" style={{ gridTemplateColumns: `repeat(${grid.length}, minmax(0, 1fr))` }}>
          {grid.map((row, r) =>
            row.map((ch, c) => {
              const key = cellKey(r, c);
              const isFound = foundCellKeys.has(key);
              const isSelected = selectedStart?.row === r && selectedStart?.col === c;
              const isWrong = wrongCells?.has(key);
              const tone = (r + c) % 4;
              const mark = isFound ? 'is-ok' : isWrong ? 'is-no' : isSelected ? 'is-start' : '';
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => clickCell(r, c)}
                  data-skin-object="cell"
                  className={`ws-cell ${tiles && !mark ? `ws-clay-${tone}` : ''} ${mark}`}
                >
                  {ch}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className="ws-chips">
        {placements.map((p) => (
          <span
            key={p.id}
            data-skin-object="word-chip"
            className={`${tiles ? 'ws-tag' : 'ws-chip'} ${foundIds.has(p.id) ? 'is-found' : ''}`}
          >
            {p.word}
          </span>
        ))}
      </div>
        </div>

        {editable && !itemsHidden && (
          <div className="w-full md:w-[260px] md:shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
              <button
                type="button"
                onClick={onRemoveItem}
                disabled={items.length <= 1}
                aria-label={t('gameAdmin.removeItemQuick')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">remove</span>
              </button>
              <span className="font-label-md text-label-md text-on-surface-variant tabular-nums whitespace-nowrap">
                {t('gameAdmin.itemCountLabel', { count: items.length })}
              </span>
              <button
                type="button"
                onClick={onAddItem}
                aria-label={t('gameAdmin.addItemQuick')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>
            </div>
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {items.map((item, i) => (
                <input
                  key={item.id}
                  value={itemDrafts[item.id] ?? item.label}
                  onChange={(e) => handleItemDraftChange(item.id, e.target.value)}
                  onBlur={() => commitItemDraft(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  style={{ color: colorFor(i) }}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
