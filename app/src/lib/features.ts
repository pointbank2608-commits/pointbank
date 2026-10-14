import { useAuth } from '../context/AuthContext';

/**
 * 학원별 기능 열기·닫기(2026-10-14, 서버 `academies.features`, 관리자 화면에서 바꾼다).
 *  - group: 단체수업(내 수업·발표) · solo: 개별수업(학생이 혼자) · homework: 온라인 숙제
 *  - 통장의 숙제 완료/미제출 버튼과 숙제 캘린더는 이 스위치와 상관없이 늘 열려 있다(룰 5).
 * 서버에 적히지 않은 칸의 기본값은 단체수업 열림, 개별수업·숙제 닫힘이다(서버 `academy_feature`와 같게 둘 것).
 */
export type FeatureKey = 'group' | 'solo' | 'homework';
export const FEATURE_KEYS: FeatureKey[] = ['group', 'solo', 'homework'];
export const FEATURE_DEFAULT: Record<FeatureKey, boolean> = { group: true, solo: false, homework: false };

type FeatureSource = { features?: Partial<Record<FeatureKey, boolean>> | null } | null | undefined;

/** 학원 정보를 아직 못 읽었으면(null) 닫지 않는다 — 읽기 전에 화면이 닫히며 튀지 않게 */
export function featureOpen(academy: FeatureSource, key: FeatureKey): boolean {
  if (!academy) return true;
  const v = academy.features?.[key];
  return typeof v === 'boolean' ? v : FEATURE_DEFAULT[key];
}

export function useFeature(key: FeatureKey): boolean {
  const { academy } = useAuth();
  return featureOpen(academy, key);
}

/** 이 경로가 어느 기능에 속하는지(속하지 않으면 null) — 막힌 기능이면 대시보드로 돌려보낸다 */
export function featureOfPath(pathname: string): FeatureKey | null {
  if (pathname === '/curriculum' || pathname.startsWith('/curriculum/') || pathname === '/videos' || pathname.startsWith('/videos/')) return 'group';
  if (pathname === '/homework' || pathname.startsWith('/homework/')) return 'homework';
  return null;
}
