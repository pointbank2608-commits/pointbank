import type { FullCardItem } from '../../lib/types';
import { colorFor } from '../../lib/wheel';

export type CardSize = 'small' | 'medium' | 'large';

const COLUMNS: Record<CardSize, number> = { small: 4, medium: 3, large: 2 };
const WORD_FONT: Record<CardSize, string> = { small: '16px', medium: '20px', large: '26px' };
const MEANING_FONT: Record<CardSize, string> = { small: '11px', medium: '13px', large: '15px' };

interface Card {
  key: string;
  word: string;
  meaning: string;
  imageUrl: string | null;
  colorIndex: number;
}

/** 카드 두 벌(같은 단어 두 장)을 섞어서 메모리 게임/고피쉬 양쪽에 다 쓸 수 있게 만든다. */
export function buildDeck(items: FullCardItem[]): Card[] {
  const pairs = items.flatMap((it, i) => [
    { key: `${it.id}-a`, word: it.word, meaning: it.meaning, imageUrl: it.imageUrl, colorIndex: i },
    { key: `${it.id}-b`, word: it.word, meaning: it.meaning, imageUrl: it.imageUrl, colorIndex: i },
  ]);
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

export default function MemoryCardsPrintSheets({ deck, cardSize = 'medium' }: { deck: Card[]; cardSize?: CardSize }) {
  return (
        <div className="print-sheet mx-auto">
          <div className="flex flex-wrap gap-[4mm]">
            {deck.map((card) => {
              const color = colorFor(card.colorIndex);
              return (
                <div
                  key={card.key}
                  className="print-card flex flex-col items-center rounded-[6mm] border-[3px] bg-surface-container-lowest overflow-hidden"
                  style={{
                    width: `calc((100% - ${(COLUMNS[cardSize] - 1) * 4}mm) / ${COLUMNS[cardSize]})`,
                    borderColor: color,
                    padding: '3mm',
                  }}
                >
                  <div
                    className="w-full flex items-center justify-center rounded-[4mm] overflow-hidden"
                    style={{ aspectRatio: '1 / 1', background: `${color}22` }}
                  >
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span style={{ fontSize: '36px' }} aria-hidden>
                        🔤
                      </span>
                    )}
                  </div>
                  <div
                    className="mt-[2mm] font-title-md font-bold text-center"
                    style={{ color, fontSize: WORD_FONT[cardSize], wordBreak: 'keep-all' }}
                  >
                    {card.word}
                  </div>
                  {card.meaning && (
                    <div
                      className="font-body-sm text-on-surface-variant text-center"
                      style={{ fontSize: MEANING_FONT[cardSize], wordBreak: 'keep-all' }}
                    >
                      {card.meaning}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
  );
}
