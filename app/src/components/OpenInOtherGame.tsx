import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GAME_CATALOG } from '../lib/gameCatalog';
import type { GameType } from '../lib/types';

interface Props {
  currentType: GameType;
  itemCount: number;
  onOpen: (target: GameType) => Promise<void>;
}

/** 지금 게임의 항목 리스트를 그대로 다른 호환 게임에 새 템플릿으로 열어주는 스크롤 선택 패널.
 * 예전엔 후보를 전부 펼쳐서 보여줘 설정 화면이 길어지는 문제가 있어, 버튼 하나로 접었다 펴는
 * 스크롤 목록으로 바꿨다(WordListPicker 와 같은 토글 패턴). */
export default function OpenInOtherGame({ currentType, itemCount, onOpen }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const targets = GAME_CATALOG.filter((g) => g.type !== currentType && itemCount >= g.minItems);
  if (targets.length === 0) return null;

  async function handleClick(target: GameType) {
    if (busy) return;
    setBusy(true);
    try {
      await onOpen(target);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="my-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-label-md text-label-md transition-colors ${
          open
            ? 'bg-secondary-container text-on-secondary-container'
            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
        }`}
      >
        <span className="material-symbols-outlined text-base">open_in_new</span>
        {t('gameAdmin.openInOtherGameLabel')}
        <span className="material-symbols-outlined text-base">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg bg-surface-container-low p-2">
          <div className="flex flex-col gap-1">
            {targets.map((g) => (
              <button
                key={g.type}
                type="button"
                disabled={busy}
                onClick={() => void handleClick(g.type)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-lowest hover:bg-secondary-container disabled:opacity-60 text-on-surface hover:text-on-secondary-container font-label-md text-label-md transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">{g.icon}</span>
                {t(g.nameKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
