import { usePictureWordTurn } from './PictureWordTurn';
import { gameClock } from '../lib/gameClock';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagramPin } from '../lib/types';
import { playSfx, useGameSfx, useStepSounds } from '../lib/gameSfx';

export type LabeledDiagramStyle = 'wood' | 'clay';

interface Props {
  imageUrl: string | null;
  pins: DiagramPin[];
  boardStyle?: LabeledDiagramStyle;
}

const woodShadow = 'var(--game-wood-shadow, 0 4px 0 #c6a982)';
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 사진·핀을 아직 안 만든 선생님이 바로 해 볼 수 있는 샘플(시장 그림 위의 채소·과일 4개) */
export const SAMPLE_DIAGRAM_IMAGE = '/skins/shop-market.webp';
export const SAMPLE_DIAGRAM_PINS: DiagramPin[] = [
  { id: 'sample-onion', label: 'onion', x: 0.128, y: 0.388 },
  { id: 'sample-carrot', label: 'carrot', x: 0.423, y: 0.277 },
  { id: 'sample-banana', label: 'banana', x: 0.424, y: 0.503 },
  { id: 'sample-grapes', label: 'grapes', x: 0.273, y: 0.5 },
];

export function LabeledDiagramEmptyMotif() {
  return (
    <div className="ld-frame pointer-events-none mx-auto w-[148px] p-2">
      <div className="ld-photo" style={{ aspectRatio: '4 / 3' }}>
        <span className="ld-pin" style={{ left: '28%', top: '38%' }}>
          1
        </span>
        <span className="ld-pin is-filled" style={{ left: '68%', top: '58%' }}>
          2
        </span>
      </div>
    </div>
  );
}

export default function LabeledDiagram({ imageUrl, pins, boardStyle = 'wood' }: Props) {
  const pictureTurn = usePictureWordTurn();
  const { t } = useTranslation();
  const clay = boardStyle === 'clay';
  const [wordBank, setWordBank] = useState<DiagramPin[]>(() => shuffle(pins));
  const [filledIds, setFilledIds] = useState<Set<string>>(new Set());
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [wrongPinId, setWrongPinId] = useState<string | null>(null);

  const pinIdsKey = pins.map((p) => p.id).join('|');
  useEffect(() => {
    setWordBank(shuffle(pins));
    setFilledIds(new Set());
    setSelectedWordId(null);
    setWrongPinId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinIdsKey]);

  const sfx = useGameSfx('labeleddiagram');
  useStepSounds(0, !!imageUrl && pins.length > 0 && filledIds.size === pins.length, undefined, sfx.finish);

  if (!imageUrl || pins.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mb-3">
          <LabeledDiagramEmptyMotif />
        </div>
        <div className="font-body-md text-body-md">{t('gameLabeledDiagram.needSetup')}</div>
      </div>
    );
  }

  const finished = filledIds.size === pins.length;

  function restart() {
    setWordBank(shuffle(pins));
    setFilledIds(new Set());
    setSelectedWordId(null);
    setWrongPinId(null);
  }

  function selectWord(id: string) {
    if (filledIds.has(id)) return;
    playSfx(sfx.pick, 0.6);
    setSelectedWordId((prev) => (prev === id ? null : id));
  }

  function clickPin(pin: DiagramPin) {
    if (!selectedWordId || filledIds.has(pin.id)) return;
    if (selectedWordId === pin.id) {
      if (filledIds.size + 1 < pins.length) playSfx(sfx.correct);
      setFilledIds((prev) => new Set(prev).add(pin.id));
      setSelectedWordId(null);
      setWrongPinId(null);
    } else {
      playSfx(sfx.wrong);
      setWrongPinId(pin.id);
      gameClock.setTimeout(() => setWrongPinId(null), 400);
    }
  }

  if (finished) {
    // 전체화면에서는 내용 크기에 맞춰 화면을 꽉 채우도록 확대되므로, 결과 상자가 너무 커 보이지 않게
    // 투명한 큰 틀(span)을 깔아 확대 비율을 낮춘다. 상자와 버튼은 작게 만들어 가운데에 둔다.
    return (
      <div className="relative flex w-full min-h-[420px] flex-col items-center justify-center pt-3 pb-2">
        <span aria-hidden className="pointer-events-none absolute left-0 top-0 block h-[420px] w-[760px] max-w-full" />
        <div
          className="mb-4 w-[min(260px,92%)] px-2 py-2 text-center"
          style={{
            borderRadius: 18,
            background: 'var(--game-wood, linear-gradient(115deg, #f3e3c8, #e9d0ac))',
            boxShadow: woodShadow,
          }}
        >
          <div
            className="px-3 py-3"
            style={{
              borderRadius: 14,
              background: 'var(--game-paper, #fffdf6)',
              boxShadow: 'var(--game-paper-shadow, inset 0 1px 0 #fff)',
            }}
          >
            <div className="mb-1 font-title-md text-[18px] font-bold text-deep-navy">{t('gameLabeledDiagram.finishedTitle')}</div>
            <div className="font-title-md text-[15px] font-bold tabular-nums text-deep-navy">
              {t('gameLabeledDiagram.foundLabel', { found: pins.length, total: pins.length })}
            </div>
          </div>
        </div>
        <button
          onClick={restart}
          className="game-clay-action rounded-full bg-secondary px-7 py-2 font-title-md text-[16px] text-on-secondary shadow-sm transition-colors hover:bg-on-secondary-container"
        >
          {t('gameLabeledDiagram.restartButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div className="mb-3 rounded-full bg-secondary px-3 py-1 font-title-md text-[13px] font-bold tabular-nums text-on-secondary">
        {t('gameLabeledDiagram.foundLabel', { found: filledIds.size, total: pins.length })}
      </div>

      <div data-skin-stage="diagram" className={`ld-frame mb-5 w-full max-w-[720px] ${clay ? 'ld-clay' : ''}`}>
        <div className="ld-photo">
          <img src={imageUrl} alt="" className="block h-auto w-full select-none" draggable={false} />
          {pins.map((pin, i) => {
            const isFilled = filledIds.has(pin.id);
            const isWrong = wrongPinId === pin.id;
            return (
              <button
                key={pin.id}
                type="button"
                onClick={() => pictureTurn(() => clickPin(pin))}
                disabled={isFilled}
                data-skin-object="pin"
                className={`ld-pin ${isFilled ? 'is-filled' : ''} ${isWrong ? 'is-wrong' : ''} ${clay ? `ld-clay-${i % 4}` : ''}`}
                style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
              >
                {isFilled ? pin.label : i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-2 font-caption text-caption text-on-surface-variant">{t('gameLabeledDiagram.wordBankLabel')}</div>
      <div className={`ld-bank ${clay ? 'ld-clay' : ''}`}>
        {wordBank
          .filter((p) => !filledIds.has(p.id))
          .map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectWord(p.id)}
              data-skin-object="word-chip"
              className={`ld-chip ${selectedWordId === p.id ? 'is-on' : ''} ${clay ? `ld-clay-${i % 4}` : ''}`}
            >
              {p.label}
            </button>
          ))}
      </div>
    </div>
  );
}
