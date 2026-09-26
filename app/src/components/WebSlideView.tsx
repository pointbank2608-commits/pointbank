import { useTranslation } from 'react-i18next';
import type { WebSlide } from '../lib/types';
import { openWebWindow, webSlideHost, safeWebUrl } from '../lib/webSlides';

/**
 * 웹페이지 슬라이드(캔바·E-book 등) 화면. 수업 중(LessonSlideViewerPage)과 편집 미리보기
 * (LessonSlideSorter)가 같이 쓴다.
 * - embed: iframe 으로 슬라이드 안에 바로 띄운다. 사이트가 막거나 로그인이 풀려 빈 화면이면 오른쪽 위
 *   "새 창으로 열기"로 바로 넘어갈 수 있게 항상 버튼을 둔다.
 * - window: 큰 "열기" 버튼 — 새 창은 선생님 브라우저 그대로라 이미 해 둔 로그인이 쓰인다. 슬라이드로
 *   넘어오자마자 자동으로 열면 브라우저 팝업 차단에 걸려서, 클릭으로만 연다.
 */
export default function WebSlideView({ slide, fill }: { slide: WebSlide; fill: boolean }) {
  const { t } = useTranslation();
  const safeUrl = safeWebUrl(slide.url);
  const host = webSlideHost(slide.url);
  const title = slide.title?.trim() || host;

  if (!safeUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-surface-container-low p-6 text-center font-body-md text-body-md text-on-surface-variant">
        {t('curriculum.web.unsafeUrl')}
      </div>
    );
  }

  if (slide.mode === 'embed') {
    return (
      <div className={fill ? 'absolute inset-0 flex flex-col p-2 md:p-3' : 'relative aspect-video w-full'}>
        <iframe
          src={safeUrl}
          title={title}
          className={`${fill ? 'min-h-0 flex-1' : 'absolute inset-0 h-full'} w-full rounded-xl border-0 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.12)]`}
          allow="fullscreen; autoplay; clipboard-write; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <button
          type="button"
          onClick={() => openWebWindow(slide.url)}
          className={`absolute ${fill ? 'right-5 top-5' : 'right-2 top-2'} inline-flex items-center gap-1 rounded-full bg-deep-navy/85 px-3 py-1.5 font-label-md text-label-md text-white shadow-md backdrop-blur hover:bg-deep-navy`}
          title={t('curriculum.web.openInWindowHint')}
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          {t('curriculum.web.openInWindow')}
        </button>
      </div>
    );
  }

  return (
    <div className={fill ? 'absolute inset-0 flex items-center justify-center p-4' : 'flex aspect-video w-full items-center justify-center rounded-xl bg-surface-container-low p-4'}>
      <div className="flex max-w-xl flex-col items-center gap-4 rounded-3xl bg-surface-container-lowest px-8 py-10 text-center shadow-[0_8px_28px_rgba(0,0,0,0.1)]">
        <span className="material-symbols-outlined text-[64px] text-primary">menu_book</span>
        <div>
          <div className="font-headline-lg-mobile text-headline-lg-mobile text-deep-navy">{title}</div>
          <div className="mt-1 font-caption text-caption text-on-surface-variant">{host}</div>
        </div>
        <button
          type="button"
          onClick={() => openWebWindow(slide.url)}
          className="inline-flex min-h-14 items-center gap-2 rounded-full bg-primary px-8 py-3 font-title-md text-title-md text-on-primary shadow-sm hover:bg-primary-container"
        >
          <span className="material-symbols-outlined text-[26px]">open_in_new</span>
          {t('curriculum.web.openButton')}
        </button>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('curriculum.web.windowHint')}</p>
      </div>
    </div>
  );
}
