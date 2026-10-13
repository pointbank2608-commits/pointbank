import { useEffect } from 'react';

/**
 * 학생용 페이지(/s)에서는 홈 화면에 설치되는 "앱"을 선생님용과 따로 만든다(2026-10-13).
 * 같은 사이트라 manifest 가 하나면 브라우저가 "이미 설치된 앱"이라고만 해서 학생용을 따로 못 깔았다 —
 * 여기서 manifest 를 학생용(id·시작 주소 /s, 이름 "클래스뱅크 학생", 초록 띠 아이콘)으로 바꿔 둔다.
 * 선생님 화면으로 나가면 원래대로 되돌린다.
 */
export default function StudentAppIdentity() {
  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const touch = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    const title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prev = {
      manifest: manifest?.getAttribute('href') ?? null,
      touch: touch?.getAttribute('href') ?? null,
      title: title?.getAttribute('content') ?? null,
      theme: theme?.getAttribute('content') ?? null,
      docTitle: document.title,
    };
    manifest?.setAttribute('href', '/student.webmanifest');
    touch?.setAttribute('href', '/apple-touch-icon-student.png');
    title?.setAttribute('content', '학생 클래스뱅크');
    theme?.setAttribute('content', '#16213e');
    return () => {
      if (manifest && prev.manifest) manifest.setAttribute('href', prev.manifest);
      if (touch && prev.touch) touch.setAttribute('href', prev.touch);
      if (title && prev.title) title.setAttribute('content', prev.title);
      if (theme && prev.theme) theme.setAttribute('content', prev.theme);
      document.title = prev.docTitle;
    };
  }, []);
  return null;
}
