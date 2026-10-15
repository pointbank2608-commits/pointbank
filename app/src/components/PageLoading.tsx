import { useTranslation } from 'react-i18next';

/** 화면 조각을 받는 동안 보이는 가벼운 로딩 표시(코드 분할 Suspense 용) */
export default function PageLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-3 text-on-surface-variant ${fullScreen ? 'min-h-screen bg-background' : 'min-h-[40vh]'}`}
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
      <span className="font-body-md text-body-md">{t('common.loading')}</span>
    </div>
  );
}
