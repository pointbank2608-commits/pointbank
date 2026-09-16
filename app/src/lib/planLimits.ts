/** 무료/유료 등급 관련 숫자·경로를 한 곳에 모은다 — 화면 가드(PlanRouteGuard),
 * 학생관리(AttendancePage), 게임 목록(GamesPage), 결제 화면(BillingPage)이 전부 이
 * 파일 하나만 가져다 쓴다. 실제 청구 금액은 항상 서버(Edge Function)에서 다시 계산하고,
 * 여기 값은 화면 안내·클라이언트 가드용이다.
 */

export const FREE_CLASS_LIMIT = 1;
export const FREE_STUDENT_LIMIT = 10;
export const BASE_FEE_KRW = 9900;
export const PER_STUDENT_FEE_KRW = 5000;

/** 무료 플랜에서 접근할 수 없는 화면. 게임은 gameCatalog.ts의 tier로 별도 판단한다. */
export const FREE_BLOCKED_PATHS = ['/dictionary', '/phonics', '/wordlists', '/results', '/curriculum', '/materials'];

export function isPathBlockedForFree(pathname: string): boolean {
  return FREE_BLOCKED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** 안내용 예상 청구액 — 실제 결제는 청구 시점 학생 수로 서버가 다시 계산한다. */
export function estimateMonthlyChargeKrw(studentCount: number): number {
  return BASE_FEE_KRW + Math.max(0, studentCount - FREE_STUDENT_LIMIT) * PER_STUDENT_FEE_KRW;
}
