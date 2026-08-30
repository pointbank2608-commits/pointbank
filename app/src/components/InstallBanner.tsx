import { useEffect, useState } from 'react';

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
      <>
        <strong>카카오톡</strong>에서는 홈 화면 추가가 안 돼요. 오른쪽 위{' '}
        <strong>‥ 메뉴 → 다른 브라우저로 열기</strong>를 눌러주세요.
      </>
    ) : kind === 'ios' ? (
      <>
        하단 <strong>공유 아이콘</strong> → <strong>홈 화면에 추가</strong>를 누르면 앱처럼 쓸 수
        있어요.
      </>
    ) : (
      <>
        오른쪽 위 <strong>⋮ 메뉴 → 홈 화면에 추가</strong>를 누르면 앱처럼 쓸 수 있어요.
      </>
    );

  return (
    <div className="sticky top-0 z-40 flex items-center gap-2.5 bg-warm-yellow/30 text-deep-navy px-3.5 py-2.5 font-body-md text-sm">
      <span className="text-lg shrink-0">🐷</span>
      <span className="flex-1 [&_strong]:text-deep-navy [&_strong]:font-bold">{content}</span>
      <button
        onClick={dismiss}
        aria-label="닫기"
        className="text-on-surface-variant hover:text-error text-base px-1.5 py-0.5 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
