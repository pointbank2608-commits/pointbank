import { colorFor } from '../../lib/wheel';

export const GRID_SIZES = [3, 4, 5] as const;
export type GridSize = (typeof GRID_SIZES)[number];

const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];
const CELL_FONT: Record<GridSize, string> = { 3: '20px', 4: '16px', 5: '13px' };

function shuffled<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** 홀수 크기(3×3, 5×5)는 정중앙을 클래식 빙고처럼 FREE 칸으로 비워 둔다(word=null). */
function centerIndex(gridSize: GridSize): number {
  return gridSize % 2 === 1 ? Math.floor((gridSize * gridSize) / 2) : -1;
}

export function neededWordCount(gridSize: GridSize): number {
  const cells = gridSize * gridSize;
  return centerIndex(gridSize) >= 0 ? cells - 1 : cells;
}

export function buildBoards(words: string[], gridSize: GridSize, count: number): (string | null)[][] {
  const cells = gridSize * gridSize;
  const free = centerIndex(gridSize);
  const needed = neededWordCount(gridSize);
  return Array.from({ length: count }, () => {
    const picks = shuffled(words).slice(0, needed);
    const board: (string | null)[] = [];
    let p = 0;
    for (let i = 0; i < cells; i++) board.push(i === free ? null : picks[p++]);
    return board;
  });
}

export default function BingoPrintSheets({ boards, gridSize }: { boards: (string | null)[][]; gridSize: GridSize }) {
  return (
    <>
      {boards.map((board, boardIndex) => (
          <div key={boardIndex} className="print-sheet print-board mx-auto flex flex-col items-center gap-4 py-6">
            <div className="no-print font-caption text-caption text-on-surface-variant">
              {boardIndex + 1} / {boards.length}
            </div>
            <div className="w-full max-w-[170mm] rounded-[6mm] border-[4px] border-deep-navy overflow-hidden bg-surface-container-lowest shadow-[0_4px_20px_rgba(30,75,122,0.15)]">
              {gridSize === 5 ? (
                <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                  {BINGO_LETTERS.map((letter, i) => (
                    <div
                      key={letter}
                      className="flex items-center justify-center py-[3mm] font-headline-lg font-black text-white"
                      style={{ background: colorFor(i), fontSize: '9mm' }}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-[3mm] py-[3mm] bg-deep-navy">
                  {BINGO_LETTERS.map((letter, i) => (
                    <span
                      key={letter}
                      className="font-headline-lg font-black"
                      style={{ color: colorFor(i), fontSize: '9mm' }}
                    >
                      {letter}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid gap-[2.5mm] p-[3mm]" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
                {board.map((word, cellIndex) => {
                  const col = cellIndex % gridSize;
                  const cellColor = colorFor(col);
                  if (word === null) {
                    return (
                      <div
                        key={cellIndex}
                        className="print-card flex flex-col items-center justify-center gap-[1mm] rounded-[3mm] border-2 border-warm-yellow bg-warm-yellow/30 text-center font-title-md font-bold text-deep-navy"
                        style={{ aspectRatio: '1 / 1', fontSize: CELL_FONT[gridSize] }}
                      >
                        <span aria-hidden style={{ fontSize: '1.4em' }}>
                          ⭐
                        </span>
                        FREE
                      </div>
                    );
                  }
                  return (
                    <div
                      key={cellIndex}
                      className="print-card flex items-center justify-center rounded-[3mm] border-2 text-center font-title-md font-bold text-deep-navy"
                      style={{
                        aspectRatio: '1 / 1',
                        fontSize: CELL_FONT[gridSize],
                        padding: '2mm',
                        wordBreak: 'keep-all',
                        borderColor: cellColor,
                        background: `${cellColor}1a`,
                      }}
                    >
                      {word}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
    </>
  );
}
