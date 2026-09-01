import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagramPin } from '../lib/types';

interface Props {
  imageUrl: string | null;
  pins: DiagramPin[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function LabeledDiagram({ imageUrl, pins }: Props) {
  const { t } = useTranslation();
  const [wordBank, setWordBank] = useState<DiagramPin[]>(() => shuffle(pins));
  const [filledIds, setFilledIds] = useState<Set<string>>(new Set());
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [wrongPinId, setWrongPinId] = useState<string | null>(null);

  // 편집 중인 선생님 화면에서 핀을 추가/삭제하면(= 핀 구성 자체가 바뀌면) 미리보기를 다시 섞는다.
  // pins 배열은 매 렌더마다 새 참조로 넘어오므로, 내용(아이디 목록)이 실제로 바뀔 때만 반응한다.
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
      <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
        <div className="text-4xl mb-2">📍</div>
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

  return (
    <div className="flex flex-col items-center pt-1.5 pb-2 w-full">
      <div className="font-caption text-caption text-on-surface-variant mb-4 tabular-nums">
        {t('gameLabeledDiagram.foundLabel', { found: filledIds.size, total: pins.length })}
      </div>

      <div
        data-skin-stage="diagram"
        className="relative w-full max-w-[560px] mb-6 rounded-2xl overflow-hidden border-2 border-outline-variant/40"
      >
        <img src={imageUrl} alt="" className="w-full h-auto block select-none" draggable={false} />
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
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full font-label-md text-label-md font-bold shadow-md border-2 transition-all ${
                isFilled
                  ? 'min-w-[36px] border-secondary bg-secondary-container px-3 py-1.5 text-on-surface'
                  : isWrong
                    ? 'h-9 w-9 border-error bg-error-container text-on-error-container'
                    : 'h-9 w-9 border-primary-container bg-primary text-on-primary hover:scale-110'
              }`}
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
            >
              {isFilled ? pin.label : i + 1}
            </button>
          );
        })}
      </div>

      {finished ? (
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl">🎉</div>
          <div className="font-title-md text-title-md text-on-surface">{t('gameLabeledDiagram.finishedTitle')}</div>
          <button
            onClick={restart}
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-colors"
          >
            {t('gameLabeledDiagram.restartButton')}
          </button>
        </div>
      ) : (
        <>
          <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameLabeledDiagram.wordBankLabel')}</div>
          <div className="flex flex-wrap justify-center gap-2 max-w-[460px]">
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
                  {p.label}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
