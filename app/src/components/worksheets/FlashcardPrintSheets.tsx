import type { FullCardItem } from '../../lib/types';

/** 한 페이지(A4)에 들어가는 카드 배치. 카드 수가 페이지당 장수보다 적으면 남는 칸은 비워 둔다(칸 크기 일정). */
export const LAYOUTS = [
  { perPage: 2, cols: 1, rows: 2, wordPt: 54, meaningPt: 24 },
  { perPage: 4, cols: 2, rows: 2, wordPt: 40, meaningPt: 18 },
  { perPage: 6, cols: 2, rows: 3, wordPt: 32, meaningPt: 15 },
  { perPage: 8, cols: 2, rows: 4, wordPt: 26, meaningPt: 13 },
  { perPage: 12, cols: 3, rows: 4, wordPt: 20, meaningPt: 11 },
] as const;

export type Layout = (typeof LAYOUTS)[number];
export type ColorMode = 'color' | 'mono';

export function chunk<T>(arr: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += size) pages.push(arr.slice(i, i + size));
  return pages;
}

function FlashCard({
  item,
  layout,
  showImage,
  showWord,
  showMeaning,
}: {
  item: FullCardItem;
  layout: Layout;
  showImage: boolean;
  showWord: boolean;
  showMeaning: boolean;
}) {
  const hasImage = showImage && Boolean(item.imageUrl);
  return (
    <div className="flex min-h-0 flex-col items-center rounded-[3mm] border border-dashed border-[#8a8a8a] p-[3mm]">
      {hasImage && (
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          <img src={item.imageUrl as string} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
      {(showWord || showMeaning) && (
        <div className={`flex flex-col items-center justify-center text-center ${hasImage ? 'pt-[2mm]' : 'flex-1'}`}>
          {showWord && (
            <div
              className="font-title-md font-bold leading-tight text-deep-navy"
              style={{ fontSize: `${layout.wordPt}pt`, overflowWrap: 'anywhere' }}
            >
              {item.word}
            </div>
          )}
          {showMeaning && item.meaning && (
            <div
              className="font-body-md leading-tight text-on-surface-variant"
              style={{ fontSize: `${layout.meaningPt}pt`, wordBreak: 'keep-all' }}
            >
              {item.meaning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FlashcardPrintSheets({ pages, layout, showImage = true, showWord = true, showMeaning = true, colorMode = 'color' }: { pages: FullCardItem[][]; layout: Layout; showImage?: boolean; showWord?: boolean; showMeaning?: boolean; colorMode?: ColorMode }) {
  return (
        <div className="print-sheet mx-auto" style={colorMode === 'mono' ? { filter: 'grayscale(1)' } : undefined}>
          {pages.map((pageWords, pageIndex) => (
            <div
              key={pageIndex}
              className="print-board mb-6 grid gap-[3mm] border border-outline-variant/40 bg-white p-3 print:mb-0 print:border-0 print:p-0"
              style={{
                // A4 인쇄 가능 영역(여백 12mm 제외 186×273mm)보다 낮게 잡는다 — 빈 페이지가 끼는 걸
                // 막는 것도 있지만, 무엇보다 페이지 맨 아래에 항상 찍히는 클래스뱅크 브랜드 푸터
                // (PrintBrandFooter.tsx, position:fixed)와 겹치지 않을 여백을 남겨야 한다. 카드가
                // 12장(3×4)까지 꽉 차면 270mm였을 땐 마지막 줄 카드 안에 푸터 글자가 겹쳐 찍히는
                // 실제 인쇄 사고가 났다(2026-09-23 사용자 제보, 헤드리스 크롬으로 재현·확인함) —
                // 262mm는 파닉스 학생용 페이지에서도 쓰는 값이라 안전 여백이 이미 검증돼 있다.
                aspectRatio: '186 / 262',
                gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
              }}
            >
              {pageWords.map((item) => (
                <FlashCard
                  key={item.id}
                  item={item}
                  layout={layout}
                  showImage={showImage}
                  showWord={showWord}
                  showMeaning={showMeaning}
                />
              ))}
            </div>
          ))}
        </div>
  );
}
