import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GAME_CATALOG } from '../lib/gameCatalog';
import type { GameType } from '../lib/types';

interface Props {
  currentType: GameType;
  itemCount: number;
  onOpen: (target: GameType) => Promise<void>;
}

/** 지금 게임의 항목 리스트를 그대로 다른 호환 게임에 새 템플릿으로 열어주는 칩 목록. */
export default function OpenInOtherGame({ currentType, itemCount, onOpen }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const targets = GAME_CATALOG.filter((g) => g.type !== currentType && itemCount >= g.minItems);
  if (targets.length === 0) return null;

  async function handleClick(target: GameType) {
    if (busy) return;
    setBusy(true);
    try {
      await onOpen(target);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4">
      <div className="font-caption text-caption text-on-surface-variant mb-2">
        {t('gameAdmin.openInOtherGameLabel')}
      </div>
      <div className="flex flex-wrap gap-2">
        {targets.map((g) => (
          <button
            key={g.type}
            type="button"
            disabled={busy}
            onClick={() => void handleClick(g.type)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container disabled:opacity-60 text-on-surface-variant hover:text-primary font-label-md text-label-md transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">{g.icon}</span>
            {t(`gamesList.${g.type}Name`)}
          </button>
        ))}
      </div>
    </div>
  );
}
