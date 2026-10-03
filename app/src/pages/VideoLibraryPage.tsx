import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import VideoClipLibrary from '../components/VideoClipLibrary';

/**
 * 영상 라이브러리 메뉴(2026-10-03 사용자 요청: 왼쪽 내비에 따로) — 클래스뱅크가 미리 만든 유튜브 장면을 둘러보고,
 * "이 장면으로 수업 만들기"를 누르면 내 수업에서 새 수업이 열리며 "영상 하나로 수업" 레시피가 그 장면으로 채워진다.
 */
export default function VideoLibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy md:font-headline-lg md:text-headline-lg">{t('videoLibrary.pageTitle')}</h1>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{t('videoLibrary.pageIntro')}</p>
      </div>
      <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
        <VideoClipLibrary tall pickLabel={t('recipes.videoUseClip')} onPick={(clip) => navigate('/curriculum', { state: { createFromClipId: clip.id } })} />
      </div>
    </div>
  );
}
