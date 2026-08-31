import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  description: string;
  steps: string[];
}

/** 게임 페이지 상단에 붙는 "게임 소개 및 방법" 접이식 패널. 19개 게임 페이지가 전부 공유한다. */
export default function GameInfoPanel({ description, steps }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="font-title-md text-title-md text-on-surface flex items-center gap-2">
          <span aria-hidden="true">💡</span>
          {t('gameAdmin.howToPlayTitle')}
        </span>
        <span className="font-label-md text-label-md text-primary shrink-0">
          {open ? t('gameAdmin.collapse') : t('gameAdmin.expand')}
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3">
          <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
          <ol className="list-decimal list-inside space-y-1.5 font-body-md text-sm text-on-surface-variant">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
