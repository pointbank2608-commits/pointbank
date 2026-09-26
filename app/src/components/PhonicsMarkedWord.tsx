import { parsePattern } from '../lib/phonicsPattern';

/**
 * 파닉스 소리 규칙 글자 강조(`r{ai}n` → r + [ai] + n). 진한 남색 글자 + 밝은 노란 배경(파닉스 페이지와 같은 대비).
 * 수업 "카드로 외우기"·"단어 소개" 슬라이드처럼 단어장에서 온 파닉스 단어(patternMarked 있음)에 쓴다.
 */
export default function PhonicsMarkedWord({ pattern, className }: { pattern: string; className?: string }) {
  return (
    <span className={className}>
      {parsePattern(pattern).map((part, i) =>
        part.marked ? (
          <span key={i} className="rounded-[0.12em] bg-warm-yellow px-[0.06em] font-extrabold text-deep-navy">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}
