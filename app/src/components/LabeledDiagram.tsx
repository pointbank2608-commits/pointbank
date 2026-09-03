import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagramPin } from '../lib/types';

export type LabeledDiagramStyle = 'wood' | 'clay';

interface Props {
  imageUrl: string | null;
  pins: DiagramPin[];
  boardStyle?: LabeledDiagramStyle;
}

const woodShadow = '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)';
const pill =
  'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
    setSelectedWordId((prev) => (prev === id ? null : id));
  }

  function clickPin(pin: DiagramPin) {
    if (!selectedWordId || filledIds.has(pin.id)) return;
    if (selectedWordId === pin.id) {
      setFilledIds((prev) => new Set(prev).add(pin.id));
      setSelectedWordId(null);
      setWrongPinId(null);
    } else {
      setWrongPinId(pin.id);
      window.setTimeout(() => setWrongPinId(null), 400);
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
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameLabeledDiagram.finishedTitle')}</div>
            <div className="font-title-md text-[22px] font-bold tabular-nums text-deep-navy">
              {t('gameLabeledDiagram.foundLabel', { found: pins.length, total: pins.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
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
                onClick={() => clickPin(pin)}
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
