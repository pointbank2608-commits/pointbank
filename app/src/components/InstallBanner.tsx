import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

const DISMISS_KEY = 'classbank.installBannerDismissed.v1';

type Kind = 'kakao' | 'ios' | 'android' | null;

function detectKind(): Kind {
  const ua = navigator.userAgent;

  // 이미 홈 화면에서 실행 중이면(standalone) 안내가 필요 없다.
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isStandalone) return null;

  if (/kakaotalk/i.test(ua)) return 'kakao';

  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  if (isIOS) return 'ios';
  if (isAndroid) return 'android';
  return null;
}

/**
 * 스마트폰(사파리·크롬·카카오톡)에서 "홈 화면에 추가"를 안내하는 배너.
 *
 * - 카카오톡 인앱 브라우저는 홈 화면 추가 자체를 지원하지 않는다. 자바스크립트로
 *   "다른 브라우저로 열기"를 대신 실행해줄 방법이 없어서(그 메뉴는 카카오톡 자체
 *   UI에 있음), 위치만 안내한다.
 * - iOS Safari 는 매니페스트만으로 자동 설치 배너가 뜨지 않아서 수동 안내가 필요하다.
 * - Android Chrome 은 브라우저가 자체적으로 설치 배너를 띄워주기도 하지만, 못 볼 수도
 *   있어 보조적으로 안내한다.
 */
export default function InstallBanner() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Kind>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    setKind(detectKind());
  }, []);

  if (!kind) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setKind(null);
  }

  const content =
    kind === 'kakao' ? (
      <Trans i18nKey="installBanner.kakaoMessage" components={[<strong key="0" />, <strong key="1" />]} />
    ) : kind === 'ios' ? (
      <Trans i18nKey="installBanner.iosMessage" components={[<strong key="0" />, <strong key="1" />]} />
    ) : (
      <Trans i18nKey="installBanner.androidMessage" components={[<strong key="0" />]} />
    );

  return (
    <div className="sticky top-0 z-40 flex items-center gap-2.5 bg-warm-yellow/30 text-deep-navy px-3.5 py-2.5 font-body-md text-sm">
      <span className="text-lg shrink-0">🐷</span>
      <span className="flex-1 [&_strong]:text-deep-navy [&_strong]:font-bold">{content}</span>
      <button
        onClick={dismiss}
        aria-label={t('installBanner.closeAriaLabel')}
        className="text-on-surface-variant hover:text-error text-base px-1.5 py-0.5 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
