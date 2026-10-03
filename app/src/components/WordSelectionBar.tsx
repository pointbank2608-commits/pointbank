import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddToWordListModal from './AddToWordListModal';
import type { FullCardItem } from '../lib/types';
import MaterialsLaunchButtons from './MaterialsLaunchButtons';

/** 사전·파닉스에서 카드를 골라 담았을 때 화면 아래에 떠서 "바로 수업 자료 만들기"를 눌러주는 바.
 * 선택이 0개면 아무것도 그리지 않는다. 사이드바(md:w-64) 옆에 맞춰 떠 있다. */
export default function WordSelectionBar({ words, onClear, phonics = false }: { words: FullCardItem[]; onClear: () => void; phonics?: boolean }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  if (words.length === 0) return null;

  return (
    <div className="no-print fixed bottom-0 left-0 right-0 z-30 border-t border-outline-variant/40 bg-surface-container-lowest px-4 py-3 shadow-[0_-4px_20px_rgba(39,101,168,0.15)] md:left-64">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="font-title-md text-title-md text-deep-navy tabular-nums">
            {t('selectionBar.count', { count: words.length })}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-3 py-1 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low"
          >
            {t('selectionBar.clear')}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container"
        >
          <span className="material-symbols-outlined text-[18px]">library_add</span>
          {t('addToWordList.button')}
        </button>
        <MaterialsLaunchButtons words={words} phonics={phonics} />
        {adding && <AddToWordListModal words={words} onClose={() => setAdding(false)} onDone={onClear} />}
      </div>
    </div>
  );
}
