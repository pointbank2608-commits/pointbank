import type { WebSlide } from './types';

export type WebProvider = 'canva' | 'google' | 'alist' | 'other';

export interface NormalizedWebUrl {
  url: string;
  provider: WebProvider;
  /** 이 주소에 알맞은 기본 표시 방식. */
  mode: WebSlide['mode'];
}

/** 끼워 넣기(iframe)를 공식으로 허용해서 슬라이드 안에 바로 띄워도 되는 곳. */
const EMBED_HOSTS = [
  'docs.google.com',
  'view.genial.ly',
  'wordwall.net',
  'www.liveworksheets.com',
  'padlet.com',
  'www.figma.com',
  'e.issuu.com',
];

/** 로그인해야 보이는 E-book 사이트 — 다른 사이트 안(iframe)에선 로그인 쿠키가 안 넘어가 "로그인이 필요"만
 * 뜨므로 새 창으로 연다(2026-09-25 A*List 확인: 끼워 넣기 차단 헤더는 없지만 세션 쿠키가 iframe 에선
 * 안 보내짐). 여기 없는 모르는 사이트도 안전하게 새 창이 기본이다. */
const LOGIN_EBOOK_HOSTS = ['alist.co.kr'];

/**
 * 선생님이 붙여 넣은 주소를 슬라이드용으로 다듬는다.
 * - 캔바: 편집(/edit)·보기(/view) 링크를 공식 임베드 주소(/view?embed)로 바꾼다 — 편집 화면은 캔바가
 *   끼워 넣기를 막지만 view?embed 는 허용한다(디자인이 "링크가 있는 모든 사용자 보기"로 공유돼 있어야 함).
 * - 구글 슬라이드: /edit 를 /embed 로.
 * 그 밖은 그대로 두고, 알려진 끼워 넣기 허용 사이트만 embed, 나머지는 새 창(window)을 기본으로.
 */
export function normalizeWebUrl(raw: string): NormalizedWebUrl | null {
  let input = raw.trim();
  if (!input) return null;
  // 캔바 "임베드" 코드(<iframe src="...">)를 통째로 붙여 넣어도 주소만 뽑는다.
  const srcMatch = input.match(/src=["']([^"']+)["']/i);
  if (srcMatch) input = srcMatch[1];
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;

  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase();

  if (host === 'canva.com' || host.endsWith('.canva.com') || host === 'canva.link') {
    const m = u.pathname.match(/^\/design\/([^/]+)(?:\/([^/]+))?\/(?:edit|view|watch)/);
    if (m) {
      const path = m[2] ? `/design/${m[1]}/${m[2]}/view` : `/design/${m[1]}/view`;
      return { url: `https://www.canva.com${path}?embed`, provider: 'canva', mode: 'embed' };
    }
    return { url: u.toString(), provider: 'canva', mode: 'embed' };
  }

  if (host === 'docs.google.com' && /\/presentation\//.test(u.pathname)) {
    const embedPath = u.pathname.replace(/\/(edit|pub|present)(\/.*)?$/, '/embed');
    return { url: `https://docs.google.com${embedPath}`, provider: 'google', mode: 'embed' };
  }

  if (LOGIN_EBOOK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return { url: u.toString(), provider: 'alist', mode: 'window' };
  }

  if (EMBED_HOSTS.includes(host)) return { url: u.toString(), provider: 'other', mode: 'embed' };
  return { url: u.toString(), provider: 'other', mode: 'window' };
}

/** 새 창으로 열 때 — 같은 이름의 창을 재사용해 여러 번 눌러도 창이 쌓이지 않게, 화면을 거의 채우는 크기로. */
/** 화면에 띄우거나 새 창으로 열어도 되는 주소인지(http/https 만) — 2026-09-27 보안 점검.
 * 슬라이드 주소는 만들 때 normalizeWebUrl 로 검사하지만, 공유받은 수업·직접 조작한 데이터에는 javascript: 같은
 * 주소가 들어올 수 있어서 띄우는 순간에도 다시 확인한다(우리 사이트 안에서 코드가 실행되지 않게). */
export function safeWebUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function openWebWindow(url: string): Window | null {
  const safe = safeWebUrl(url);
  if (!safe) return null;
  url = safe;
  const w = Math.round(window.screen.availWidth * 0.95);
  const h = Math.round(window.screen.availHeight * 0.95);
  const left = Math.round((window.screen.availWidth - w) / 2);
  const top = Math.round((window.screen.availHeight - h) / 2);
  const win = window.open(url, 'classbank-web-slide', `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
  win?.focus();
  return win;
}

export function webSlideHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
