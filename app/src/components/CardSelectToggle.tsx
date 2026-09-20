import { useTranslation } from 'react-i18next';

/** 사전·파닉스 카드 왼쪽 위에 얹는 선택 버튼. 카드 자체(이미지 클릭=크게 보기)와 동작이 겹치지 않게
 * 별도 버튼으로 두고, 체크 전에도 버튼처럼 보이도록 테두리·그림자를 준다. 부모는 `relative` 여야 한다. */
export default function CardSelectToggle({
  selected,
  word,
  onToggle,
}: {
  selected: boolean;
  word: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={t('selectionBar.selectWord', { word })}
      onClick={onToggle}
      className={`absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-md transition-colors ${
        selected
          ? 'border-secondary bg-secondary text-on-secondary'
          : 'border-outline-variant bg-surface-container-lowest text-transparent hover:border-secondary hover:text-secondary/50'
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">check</span>
    </button>
  );
}
