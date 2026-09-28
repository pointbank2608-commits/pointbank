import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
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
  onRemoveItem?: (itemId?: string) => void;
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

const woodShadow = 'var(--game-wood-shadow, 0 4px 0 #c6a982)';
const pill =
  'game-clay-action px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

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

// 찾은 단어마다 다른 진한 색 — 스킨의 옅은 색에 묻히지 않게 인라인으로 칠한다(2026-09-28 선생님 피드백:
// 눌러도 반응이 없어 보임).
const FOUND_COLORS = ['#2a9d8c', '#e8743b', '#3f7fd0', '#d4497a', '#8a5ad6', '#c99a12', '#4f9d3a', '#1f8fb0'];

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
  /** 단어별로 실제로 고른 줄(숨긴 자리와 다를 수 있다) */
  const [foundLines, setFoundLines] = useState<Record<string, Cell[]>>({});
  const [wrongCells, setWrongCells] = useState<Set<string> | null>(null);
  // 첫 글자를 고른 뒤 손가락·마우스가 가리키는 칸 — 첫 글자부터 여기까지 줄을 미리 보여 준다
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
  const [justFound, setJustFound] = useState<string | null>(null);
  const [alreadyFound, setAlreadyFound] = useState<string | null>(null);
  const dragging = useRef(false);
  const justFoundTimer = useRef<number | null>(null);
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
    setFoundLines({});
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
    setHoverCell(null);
    setJustFound(null);
    setAlreadyFound(null);
    setPuzzle(buildPuzzle(items));
    setSelectedStart(null);
    setFoundIds(new Set());
    setFoundLines({});
    setWrongCells(null);
  }

  function commit(start: Cell, end: Cell) {
    setSelectedStart(null);
    setHoverCell(null);
    const line = lineBetween(start, end);
    // 빈칸을 단어 글자로 채워서 같은 글자 줄이 우연히 여러 곳에 생길 수 있다 — 숨긴 자리가 아니어도 글자가
    // 단어와 같으면(거꾸로 읽어도) 정답으로 인정하고, 고른 그 줄을 칠한다(2026-09-28 선생님 피드백).
    const text = line ? line.map((c) => grid[c.row][c.col]).join('') : '';
    const reversed = [...text].reverse().join('');
    const match =
      line &&
      (placements.find((p) => !foundIds.has(p.id) && sameCells(p.cells, line)) ??
        placements.find((p) => {
          if (foundIds.has(p.id)) return false;
          const clean = p.word.replace(/\s+/g, '').toUpperCase();
          return clean === text || clean === reversed;
        }));
    if (match) {
      setFoundIds((prev) => new Set(prev).add(match.id));
      setFoundLines((prev) => ({ ...prev, [match.id]: line }));
      setWrongCells(null);
      setAlreadyFound(null);
      setJustFound(match.id);
      if (justFoundTimer.current !== null) window.clearTimeout(justFoundTimer.current);
      justFoundTimer.current = window.setTimeout(() => setJustFound(null), 1200);
    } else if (
      line &&
      placements.some((p) => {
        const clean = p.word.replace(/\s+/g, '').toUpperCase();
        return foundIds.has(p.id) && (clean === text || clean === reversed);
      })
    ) {
      // 이미 찾은 단어와 글자가 같은 줄 — 틀린 게 아니니 빨갛게 흔들지 않고 알려만 준다
      const again = placements.find((p) => {
        const clean = p.word.replace(/\s+/g, '').toUpperCase();
        return foundIds.has(p.id) && (clean === text || clean === reversed);
      })!;
      setWrongCells(null);
      setJustFound(null);
      setAlreadyFound(again.id);
      if (justFoundTimer.current !== null) window.clearTimeout(justFoundTimer.current);
      justFoundTimer.current = window.setTimeout(() => setAlreadyFound(null), 1500);
    } else {
      // 한 줄이 아니면(대각선이 아닌 비스듬한 두 칸) 두 칸만 흔든다
      const keys = new Set((line ?? [start, end]).map((c) => cellKey(c.row, c.col)));
      setWrongCells(keys);
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
      wrongTimer.current = window.setTimeout(() => setWrongCells(null), 600);
    }
  }

  // 두 가지로 고를 수 있다: ① 첫 글자에서 마지막 글자까지 끌기 ② 첫 글자, 마지막 글자를 차례로 누르기
  function cellFromPoint(x: number, y: number): Cell | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-ws-r]');
    if (!el) return null;
    return { row: Number(el.dataset.wsR), col: Number(el.dataset.wsC) };
  }

  function onCellPointerDown(e: ReactPointerEvent<HTMLButtonElement>, row: number, col: number) {
    if (finished) return;
    e.preventDefault();
    // 터치는 누른 칸이 포인터를 붙잡아 버려서, 놓아야 다른 칸 위의 움직임을 읽을 수 있다
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setWrongCells(null);
    if (selectedStart) {
      if (selectedStart.row === row && selectedStart.col === col) {
        setSelectedStart(null);
        setHoverCell(null);
      } else commit(selectedStart, { row, col });
      return;
    }
    setSelectedStart({ row, col });
    setHoverCell({ row, col });
    dragging.current = true;
  }

  function onGridPointerMove(e: ReactPointerEvent) {
    if (!selectedStart) return;
    const c = cellFromPoint(e.clientX, e.clientY);
    if (c && (c.row !== hoverCell?.row || c.col !== hoverCell?.col)) setHoverCell(c);
  }

  function onGridPointerUp(e: ReactPointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    const c = cellFromPoint(e.clientX, e.clientY);
    // 같은 칸에서 떼면 "누르기" 방식 — 첫 글자만 고른 채로 두고 마지막 글자를 기다린다
    if (selectedStart && c && (c.row !== selectedStart.row || c.col !== selectedStart.col)) commit(selectedStart, c);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div
          className="mb-6 w-[min(360px,92%)] px-2 py-2 text-center"
          style={{
            borderRadius: 22,
            background: 'var(--game-wood, linear-gradient(115deg, #f3e3c8, #e9d0ac))',
            boxShadow: woodShadow,
          }}
        >
          <div
            className="px-4 py-5"
            style={{
              borderRadius: 16,
              background: 'var(--game-paper, #fffdf6)',
              boxShadow: 'var(--game-paper-shadow, inset 0 1px 0 #fff)',
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

  const colorById = new Map(placements.map((p, i) => [p.id, FOUND_COLORS[i % FOUND_COLORS.length]]));
  const foundColorByCell = new Map<string, string>();
  const justFoundCells = new Set<string>();
  placements.forEach((p) => {
    if (!foundIds.has(p.id)) return;
    (foundLines[p.id] ?? p.cells).forEach((c) => {
      foundColorByCell.set(cellKey(c.row, c.col), colorById.get(p.id)!);
      if (p.id === justFound) justFoundCells.add(cellKey(c.row, c.col));
    });
  });
  const previewLine = selectedStart && hoverCell ? lineBetween(selectedStart, hoverCell) : null;
  const previewKeys = new Set((previewLine ?? []).map((c) => cellKey(c.row, c.col)));
  const justFoundWord = justFound ? placements.find((p) => p.id === justFound)?.word : undefined;

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div
        className={`flex w-full flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
      >
        <div className="flex w-full max-w-[680px] flex-col items-center">
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
      <div className="mb-2 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {t('gameWordSearch.foundLabel', { found: foundIds.size, total: placements.length })}
      </div>
      <div className="mb-3 min-h-[22px] text-center font-caption text-caption text-on-surface-variant">
        {justFoundWord ? (
          <span key={justFound} className="ws-found-msg font-bold" style={{ color: colorById.get(justFound!) }}>
            {t('gameWordSearch.foundWord', { word: justFoundWord })}
          </span>
        ) : alreadyFound ? (
          <span key={`again-${alreadyFound}`} className="ws-found-msg font-bold" style={{ color: colorById.get(alreadyFound) }}>
            {t('gameWordSearch.alreadyFound', { word: placements.find((p) => p.id === alreadyFound)?.word ?? '' })}
          </span>
        ) : selectedStart ? (
          t('gameWordSearch.pickLastHint')
        ) : (
          t('gameWordSearch.howToHint')
        )}
      </div>

      <div data-skin-stage="board" className={`ws-frame mb-5 ${tiles ? 'ws-tiles' : ''}`}>
        <div
          className="ws-grid"
          style={{ gridTemplateColumns: `repeat(${grid.length}, minmax(0, 1fr))`, touchAction: 'none' }}
          onPointerMove={onGridPointerMove}
          onPointerUp={onGridPointerUp}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          {grid.map((row, r) =>
            row.map((ch, c) => {
              const key = cellKey(r, c);
              const foundColor = foundColorByCell.get(key);
              const picking = (selectedStart?.row === r && selectedStart?.col === c) || previewKeys.has(key);
              const isWrong = wrongCells?.has(key);
              const tone = (r + c) % 4;
              const mark = isWrong ? 'is-no ws-shake' : foundColor ? 'is-ok' : picking ? 'is-start' : '';
              return (
                <button
                  key={key}
                  type="button"
                  data-ws-r={r}
                  data-ws-c={c}
                  onPointerDown={(e) => onCellPointerDown(e, r, c)}
                  data-skin-object="cell"
                  className={`ws-cell ${tiles && !mark ? `ws-clay-${tone}` : ''} ${mark} ${justFoundCells.has(key) ? 'ws-pop' : ''}`}
                  style={
                    isWrong
                      ? undefined
                      : foundColor
                        ? { background: foundColor, color: '#fff', outline: 'none' }
                        : picking
                          ? { background: '#ffd23f', color: '#1a2744', outline: '3px solid #e0a100', outlineOffset: -3 }
                          : undefined
                  }
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
            className={`${tiles ? 'ws-tag' : 'ws-chip'} ${foundIds.has(p.id) ? 'is-found' : ''} ${justFound === p.id || alreadyFound === p.id ? 'ws-pop' : ''}`}
            style={
              foundIds.has(p.id) ? { background: colorById.get(p.id), color: '#fff', opacity: 1, textDecoration: 'none' } : undefined
            }
          >
            {foundIds.has(p.id) ? `✓ ${p.word}` : p.word}
          </span>
        ))}
      </div>
        </div>

        {editable && !itemsHidden && (
          <div className="w-full md:w-[260px] md:shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
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
                <div key={item.id} className="flex items-center gap-1">
                  <input
                  value={itemDrafts[item.id] ?? item.label}
                  onChange={(e) => handleItemDraftChange(item.id, e.target.value)}
                  onBlur={() => commitItemDraft(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  style={{ color: colorFor(i) }}
                  className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                  <button
                    type="button"
                    onClick={() => onRemoveItem?.(item.id)}
                    disabled={items.length <= 1}
                    title={t('gameAdmin.removeThisItem')}
                    aria-label={t('gameAdmin.removeThisItem')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-[18px]">remove_circle</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
