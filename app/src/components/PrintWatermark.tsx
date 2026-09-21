import { useAuth } from '../context/AuthContext';
import { usePrintWatermark } from '../lib/printWatermark';

/**
 * 인쇄할 때만 보이는 학원 워터마크(로고 + 이름). 화면에는 나오지 않고, 인쇄물의 모든 장에 옅게 깔린다.
 * `position: fixed` 요소는 인쇄 시 장마다 반복되므로 워크시트·플래시카드·빙고·메모리 카드 어디서 인쇄해도
 * 페이지 수와 무관하게 각 장에 찍힌다. 글씨·그림을 가리지 않도록 아주 옅게(9%) 곱하기 혼합으로 얹는다.
 * 켜고 끄는 건 설정 화면(usePrintWatermark).
 */
export default function PrintWatermark() {
  const { academy } = useAuth();
  const enabled = usePrintWatermark();
  if (!enabled || !academy || (!academy.logo_url && !academy.name)) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999] hidden items-center justify-center print:flex"
    >
      <div
        className="flex max-w-[150mm] -rotate-[20deg] flex-col items-center gap-[5mm] text-center opacity-[0.09]"
        style={{ mixBlendMode: 'multiply', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
      >
        {academy.logo_url && (
          <img src={academy.logo_url} alt="" className="h-[48mm] w-[48mm] object-contain grayscale" />
        )}
        {academy.name && (
          <span className="break-keep text-[15mm] font-extrabold leading-tight text-black">{academy.name}</span>
        )}
      </div>
    </div>
  );
}
