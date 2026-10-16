import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface Props {
  /** 같은 페이지 안에서 펼친 화면을 닫을 때 쓴다. 없으면 브라우저의 이전 페이지로 간다. */
  onClick?: () => void;
  /** 정해진 곳으로 가는 버튼(브라우저 기록과 무관) */
  path?: string;
  /** 이전 페이지가 없을 때(새 탭으로 열었을 때 등) 갈 곳 */
  fallback?: string;
  /** "뒤로" 뒤에 붙는 목적지 이름(예: 수업 목록) */
  to?: string;
  className?: string;
}

/** 한 단계 들어간 화면 왼쪽 위에 붙이는 공통 "← 뒤로" 버튼. */
export default function BackButton({ onClick, path, fallback = '/dashboard', to, className = '' }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const go = () => {
    if (onClick) onClick();
    else if (path) navigate(path);
    else if (window.history.length > 1) navigate(-1);
    else navigate(fallback);
  };
  return (
    <button
      type="button"
      onClick={go}
      className={`no-print inline-flex min-h-10 items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest px-4 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary ${className}`}
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden>
        arrow_back
      </span>
      {t('common.back')}
      {to ? ` · ${to}` : ''}
    </button>
  );
}
