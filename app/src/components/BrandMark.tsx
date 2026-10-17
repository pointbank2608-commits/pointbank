interface Props {
  className?: string;
}

/** 클래스뱅크 로고(2026-10-17, 랜딩 디자인 시안): 파란 펼친 책 + 노란 말풍선. 앱 전체와 파비콘이 같은 그림을 쓴다. */
export default function BrandMark({ className = 'h-10 w-10' }: Props) {
  return (
    <svg className={className} viewBox="0 0 72 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="bm-y" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd861" />
          <stop offset="1" stopColor="#ffb52e" />
        </linearGradient>
        <linearGradient id="bm-p" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef4ff" />
          <stop offset="1" stopColor="#cfe0ff" />
        </linearGradient>
      </defs>
      <path d="M2 36q0-3 3-2l31 10 31-10q3-1 3 2v6q0 3-3 4L36 56 5 46q-3-1-3-4z" fill="#1d63f0" />
      <path d="M6 13q0-6 6-5l23 5v32L11 40q-5-1-5-6z" fill="url(#bm-p)" stroke="#1d63f0" strokeWidth="3.6" strokeLinejoin="round" />
      <rect x="35" y="5" width="31" height="36" rx="7.5" fill="url(#bm-y)" />
      <circle cx="45.5" cy="23" r="2.8" fill="#fff" />
      <circle cx="55.5" cy="23" r="2.8" fill="#fff" />
    </svg>
  );
}
