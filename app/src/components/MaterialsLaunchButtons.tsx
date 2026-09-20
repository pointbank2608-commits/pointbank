import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MATERIAL_TARGETS, type MaterialsHandoffState } from '../lib/materialsHandoff';
import type { FullCardItem } from '../lib/types';

/** 고른 단어를 들고 수업 자료실 4종(플래시카드·워크시트·빙고·메모리 카드)으로 바로 넘어가는 버튼 묶음.
 * 플래시카드가 주 버튼(가장 자주 쓴다), 나머지는 보조 버튼. */
export default function MaterialsLaunchButtons({ words, phonics = false }: { words: FullCardItem[]; phonics?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  function go(path: string, tab?: string) {
    const state: MaterialsHandoffState = { materialsWords: words, materialsTab: tab };
    navigate(path, { state });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {phonics && (
        <button
          type="button"
          disabled={words.length === 0}
          onClick={() => go('/materials/worksheet', 'phonicsBlank')}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-base">spellcheck</span>
          {t('materials.launch.phonicsWorksheet')}
        </button>
      )}
      {MATERIAL_TARGETS.map((target) => (
        <button
          key={target.id}
          type="button"
          disabled={words.length === 0}
          onClick={() => go(target.path)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            target.primary && !phonics
              ? 'bg-primary text-on-primary hover:bg-primary-container'
              : 'border-2 border-primary/40 bg-surface-container-lowest text-primary hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-base">{target.icon}</span>
          {t(target.labelKey)}
        </button>
      ))}
    </div>
  );
}
