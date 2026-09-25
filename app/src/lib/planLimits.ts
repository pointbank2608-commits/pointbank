/** 무료/유료 등급 관련 숫자·경로를 한 곳에 모은다 — 화면 가드(PlanRouteGuard),
 * 학생관리(AttendancePage), 게임 목록(GamesPage), 결제 화면(BillingPage)이 전부 이
 * 파일 하나만 가져다 쓴다.
 *
 * 유료 플랜은 학생 수와 무관하게 월 9,900원 정액이다(2026-09-17 확정) — 지금 제품에는
 * 학생이 직접 쓰는 기능이 없어서(학생 로그인 자체가 베타에서 잠겨 있음, CLAUDE.md 룰 1)
 * 학생 수로 추가 과금할 근거가 없다. Wordwall·Baamboozle처럼 "선생님이 쓰는 도구"는
 * 교사 라이선스 기준 정액이 맞고, 학생당 과금은 나중에 학생이 직접 쓰는 기능(숙제·
 * 스피킹 등)을 별도 유료 레이어로 낼 때가 맞다. */

export const FREE_CLASS_LIMIT = 1;
export const FREE_STUDENT_LIMIT = 10;
export const BASE_FEE_KRW = 9900;

/** 무료 플랜에서 접근할 수 없는 화면. 게임은 gameCatalog.ts의 tier로 별도 판단한다.
 * 리포트(/results, 숙제 캘린더·통장 내역 하위 페이지 포함)는 무료 플랜에도 연다(2026-09-22
 * 사용자 결정) — 적립·차감은 통장(무료 기능)의 결과라 그 기록을 보는 것까지 막으면 무료 플랜이
 * 반쪽짜리로 느껴진다는 판단. */
export const FREE_BLOCKED_PATHS = ['/dictionary', '/phonics', '/grammar', '/wordlists', '/curriculum', '/materials'];

export function isPathBlockedForFree(pathname: string): boolean {
  return FREE_BLOCKED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
