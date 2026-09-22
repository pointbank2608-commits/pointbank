import { useTranslation } from 'react-i18next';
import BrandMark from './BrandMark';

/** 나중에 도메인을 구입하면 여기 한 줄만 채우면 인쇄물 하단에 함께 찍힌다.
 * 미니북(WorksheetSheets.tsx 의 MiniBookSheet)도 이 값을 그대로 가져다 쓴다. */
export const BRAND_DOMAIN: string | null = null;

/**
 * 수업 자료실 인쇄물(워크시트·플래시카드·빙고판·메모리 카드) 맨 아래 가운데에 클래스뱅크
 * 로고·이름을 찍는다. 학원 워터마크(PrintWatermark.tsx, 화면 전체에 옅게 대각선)와는 다른
 * 용도 — 이건 카피 방지가 아니라 "이 자료 클래스뱅크에서 만들었어요" 브랜딩이라 작지만 또렷하게 둔다.
 *
 * `position: fixed` 인쇄 워터마크는 원래 페이지마다 반복되지만(PrintWatermark 로 확인됨),
 * `bottom` 기준으로 앵커를 걸면 세로 인쇄 페이지(`@page landscape-sheet`, 미니북 전용)에서는
 * 크롬 인쇄 엔진이 위치 계산을 못 해 아예 안 찍히는 버그가 있다(2026-09-22 헤드리스 크롬으로
 * 확인). 미니북 한 종류만 영향받고, 나머지 워크시트·플래시카드·빙고·메모리 카드는 전부
 * 정상 출력된다 — 미니북까지 고치려면 그 페이지 안에 직접 한 줄을 넣어야 해서 별도 작업으로 남긴다.
 */
export default function PrintBrandFooter() {
  const { t } = useTranslation();
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] hidden items-end justify-center gap-[1.5mm] pb-[2mm] print:flex"
    >
      <BrandMark className="h-[4mm] w-[4mm] shrink-0 opacity-60" />
      <span className="text-[3mm] font-bold leading-none text-[#1e4b7a] opacity-60">
        {t('common.brand')}
        {BRAND_DOMAIN ? ` · ${BRAND_DOMAIN}` : ''}
      </span>
    </div>
  );
}
