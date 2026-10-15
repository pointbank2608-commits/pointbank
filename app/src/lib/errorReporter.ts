import { supabase } from './supabase';

/**
 * 화면 오류 수집(2026-10-16, 관리자 자동화 1단계).
 *  - 잡히지 않은 오류·처리 안 된 Promise 거부·화면 그리기 오류(AppErrorBoundary)를 서버(client_errors)로 보낸다.
 *  - 한 세션에서 같은 오류는 한 번, 전체 10건까지만 보낸다(폭주 방지). 실패해도 화면에는 아무 영향이 없다.
 *  - 최근 오류 몇 개는 메모리에 두었다가 원클릭 SOS 진단 정보에 같이 담는다.
 */
export interface RecordedError {
  at: string;
  message: string;
  page: string;
}

const MAX_PER_SESSION = 10;
const KEEP_RECENT = 5;
const recent: RecordedError[] = [];
const sentFingerprints = new Set<string>();
let sentCount = 0;
let installed = false;

const IGNORED = [/ResizeObserver loop/i, /chrome-extension:\/\//i, /moz-extension:\/\//i, /^Script error\.?$/i];

function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function normalize(err: unknown): { message: string; stack: string } {
  if (err instanceof Error) return { message: err.message || err.name, stack: err.stack ?? '' };
  if (typeof err === 'string') return { message: err, stack: '' };
  try {
    return { message: JSON.stringify(err) ?? String(err), stack: '' };
  } catch {
    return { message: String(err), stack: '' };
  }
}

/** 스택 맨 위 줄에서 줄·열 번호와 빌드 해시를 지워 같은 오류가 같은 지문이 되게 한다 */
function topFrame(stack: string): string {
  const line = stack.split('\n').find((l) => /\bat\b|@/.test(l)) ?? '';
  return line.replace(/:\d+:\d+/g, '').replace(/-[A-Za-z0-9_-]{6,}\.(js|mjs)/g, '.js').trim().slice(0, 160);
}

export function reportClientError(err: unknown): void {
  try {
    const { message, stack } = normalize(err);
    if (!message || IGNORED.some((re) => re.test(message))) return;
    const page = window.location.pathname;
    recent.push({ at: new Date().toISOString(), message: message.slice(0, 160), page });
    if (recent.length > KEEP_RECENT) recent.shift();

    const fingerprint = hash(`${message.replace(/\d+/g, '#').slice(0, 120)}|${topFrame(stack)}`);
    if (sentFingerprints.has(fingerprint) || sentCount >= MAX_PER_SESSION) return;
    sentFingerprints.add(fingerprint);
    sentCount += 1;

    supabase
      .rpc('report_client_error', {
        p_fingerprint: fingerprint,
        p_message: message,
        p_stack: stack || null,
        p_page: page,
        p_user_agent: navigator.userAgent,
      })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    /* 오류 보고가 앱을 깨뜨리면 안 된다 */
  }
}

export function installErrorReporter(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (ev) => reportClientError(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportClientError(ev.reason));
}

export function recentClientErrors(): RecordedError[] {
  return [...recent];
}

/** 원클릭 SOS 에 같이 보내는 자동 진단 글(개인정보·학생 이름은 담지 않는다) */
export function buildDiagnostics(extra: { plan?: string; role?: string; lang?: string }): string {
  const lines = [
    `페이지: ${window.location.pathname}`,
    `브라우저: ${navigator.userAgent}`,
    `화면: ${window.innerWidth}x${window.innerHeight} (배율 ${window.devicePixelRatio || 1})`,
    `언어: ${extra.lang ?? navigator.language}`,
    `플랜: ${extra.plan ?? '-'} / 역할: ${extra.role ?? '-'}`,
    `온라인: ${navigator.onLine ? '예' : '아니요'}`,
    `시각: ${new Date().toISOString()}`,
  ];
  if (recent.length > 0) {
    lines.push(`최근 오류 ${recent.length}건:`);
    for (const e of recent) lines.push(`  - ${e.at.slice(11, 19)} ${e.page} ${e.message}`);
  }
  return lines.join('\n');
}
