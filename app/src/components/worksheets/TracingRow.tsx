/**
 * 위·가운데(점선)·아래 3선 사선지 한 줄. trace 가 true 면 줄 안에 속이 빈 점선 글씨(따라 쓸 글씨) 하나를 앉힌다.
 * 일반 워크시트(WorksheetPrintPage)와 파닉스 워크시트(PhonicsWorksheetLibraryPage)가 같이 쓴다.
 */
export default function TracingRow({ word, trace, last, gapMm = 8 }: { word: string; trace: boolean; last: boolean; gapMm?: number }) {
  // 글씨 크기(mm) — 줄 높이(13mm)에 대문자 높이가 거의 차도록 잡는다.
  const emMm = 15;
  return (
    <div className="relative h-[13mm]" style={{ marginBottom: last ? 0 : `${gapMm}mm` }}>
      <div className="absolute left-0 right-0 top-0 border-t border-outline" />
      <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-outline-variant" />
      <div className="absolute left-0 right-0 bottom-0 border-t border-outline" />
      {trace && (
        // 속이 빈 점선 글씨: 글자 윤곽에 점선 획만 준다(글씨 폭을 미리 몰라도 되게 SVG text 를 쓴다).
        <svg className="absolute inset-0" width="100%" height="100%" style={{ overflow: 'visible' }} aria-hidden>
          <text
            x="2mm"
            y="13mm"
            fontFamily="'Andika', 'Comic Sans MS', sans-serif"
            fontSize={`${emMm}mm`}
            fill="none"
            stroke="#6b7488"
            strokeWidth="0.3mm"
            strokeDasharray="0.8mm 0.9mm"
            strokeLinecap="round"
          >
            {word}
          </text>
        </svg>
      )}
    </div>
  );
}
