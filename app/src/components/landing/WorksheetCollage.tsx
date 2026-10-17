/**
 * 랜딩 "활동지 만들기" 오른쪽 그림(2026-10-17) — 나무 책상 일러스트 위에 활동지 3종을 HTML 로 얹었다.
 * 낱말 찾기·색칠하기·파닉스 워크북은 이 서비스가 실제로 만드는 유형의 **예시 일러스트**이고, 선화·그림은 서비스의 사전·파닉스 그림을 그대로 쓴다.
 */
const GRID = ['CATRSU', 'DOGBCA', 'SUNDOG', 'KCATFU', 'DOGSUN'];
const sheet = 'absolute rounded-md bg-white shadow-[0_20px_36px_-16px_rgba(60,40,10,.55)]';
const small = 'text-[clamp(8px,1.05vw,13px)]';

export default function WorksheetCollage() {
  return (
    <div className="relative min-h-[420px] w-full overflow-hidden lg:min-h-[620px]" aria-hidden="true">
      <img src="/landing2/worksheet.webp" alt="" loading="lazy" width={1264} height={848} className="absolute inset-0 h-full w-full object-cover object-[62%_0%] lg:[mask-image:linear-gradient(to_right,transparent_0%,#000_26%)]" />

      {/* 낱말 찾기 */}
      <div className={`${sheet} left-[8%] top-[24%] w-[38%] -rotate-[3deg] max-w-[330px] p-[2.4%]`}>
        <div className="font-bold text-[#1d63f0] [font-size:clamp(11px,1.5vw,18px)]">Word Search</div>
        <div className={`mb-[3%] text-[#52607d] ${small}`}>숨은 단어를 찾아보세요.</div>
        <div className="grid grid-cols-6 gap-[2%] rounded-md border border-[#dbe3f3] p-[3%]">
          {GRID.flatMap((row, r) =>
            row.split('').map((ch, c) => (
              <span key={`${r}-${c}`} className="text-center font-semibold text-[#33415f] [font-size:clamp(9px,1.25vw,15px)]">
                {ch}
              </span>
            )),
          )}
        </div>
        <div className={`mt-[4%] flex justify-around rounded-md bg-[#f1f5fc] py-[2%] font-semibold text-[#33415f] ${small}`}>
          <span>CAT</span>
          <span>DOG</span>
          <span>SUN</span>
        </div>
      </div>

      {/* 색칠하기 */}
      <div className={`${sheet} left-[50%] top-[27%] w-[31%] rotate-[3deg] max-w-[270px] p-[2.4%]`}>
        <div className="font-bold text-[#1d63f0] [font-size:clamp(11px,1.5vw,18px)]">Color the Picture</div>
        <div className={`mb-[4%] text-[#52607d] ${small}`}>알맞은 단어를 색칠해 보세요.</div>
        <div className="grid grid-cols-2 gap-[6%]">
          {(['apple', 'cat'] as const).map((w) => (
            <div key={w} className="text-center">
              <img src={`/word-bank-lineart/${w}.webp`} alt="" loading="lazy" className="mx-auto aspect-square w-full object-contain" />
              <span className={`font-semibold text-[#33415f] ${small}`}>{w}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 파닉스 워크북 */}
      <div className="absolute bottom-[3%] left-[14%] flex w-[70%] max-w-[640px] -rotate-[1.5deg] gap-[1%] rounded-md bg-[#fbfcff] p-[1.4%] shadow-[0_22px_40px_-16px_rgba(60,40,10,.55)]">
        <div className="flex-1 rounded-md bg-white p-[2.4%] shadow-inner">
          <div className="font-bold text-[#1d63f0] [font-size:clamp(10px,1.4vw,17px)]">Phonics Workbook</div>
          <div className="my-[2%] flex items-center gap-[4%]">
            <span className="rounded bg-[#4a93ff] px-1.5 text-[clamp(8px,1vw,12px)] font-bold text-white">Unit 1</span>
            <span className={`font-semibold text-[#33415f] ${small}`}>CVC - at</span>
          </div>
          <div className="grid grid-cols-3 gap-[3%]">
            {(['cat', 'hat', 'mat'] as const).map((w) => (
              <div key={w} className="rounded border border-[#dbe3f3] p-[6%] text-center">
                <img src={`/phonics-images/${w}.webp`} alt="" loading="lazy" className="mx-auto aspect-square w-[78%] object-contain" />
                <div className="font-bold text-[#0b1f4d] [font-size:clamp(10px,1.4vw,17px)]">{w}</div>
                <div className="mt-[6%] border-b border-dashed border-[#b9c6e4]" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 rounded-md bg-white p-[2.4%] shadow-inner">
          <div className="my-[2%] flex items-center gap-[4%]">
            <span className="rounded bg-[#4a93ff] px-1.5 text-[clamp(8px,1vw,12px)] font-bold text-white">Unit 2</span>
            <span className={`font-semibold text-[#33415f] ${small}`}>a_e (장모음)</span>
          </div>
          <div className="grid grid-cols-2 gap-[4%]">
            {(['cake', 'rake'] as const).map((w) => (
              <div key={w} className="rounded border border-[#dbe3f3] p-[6%] text-center">
                <img src={`/phonics-images/${w}.webp`} alt="" loading="lazy" className="mx-auto aspect-square w-[78%] object-contain" />
                <div className="font-bold text-[#0b1f4d] [font-size:clamp(10px,1.4vw,17px)]">{w}</div>
                <div className="mt-[6%] border-b border-dashed border-[#b9c6e4]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
