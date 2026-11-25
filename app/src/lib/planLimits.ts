/** Limits for the free plan and VAT-inclusive monthly prices. */

export const BASE_FEE_KRW = 9900;
export const monthlyFee = (students: number) => BASE_FEE_KRW + 4900 * students;

export const FREE_BLOCKED_PATHS = ['/dictionary', '/phonics', '/phonics-games', '/grammar', '/videos', '/homework', '/curriculum', '/materials', '/board', '/attendance', '/results', '/my-games', '/stem', '/whiteboard', '/solo', '/resources', '/me'];

export function isPathBlockedForFree(pathname: string): boolean {
  return FREE_BLOCKED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
