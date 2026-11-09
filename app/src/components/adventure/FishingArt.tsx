import { useId } from 'react';

const fishColors = [
  ['#ffddad', '#ed7950', '#aa454a'],
  ['#fff3ae', '#f3b443', '#b26a32'],
  ['#d8ffe6', '#61c7a6', '#237b7d'],
  ['#d8f6ff', '#65a8ed', '#4b66ad'],
  ['#f6deff', '#b78aef', '#7853af'],
  ['#ffd9e2', '#e77ba4', '#ad496f'],
];

export function FishArt({ index }: { index: number }) {
  const id = useId();
  const [light, base, deep] = fishColors[index % fishColors.length];
  const body = 'M51 79C68 48 103 28 144 28c35 0 62 14 79 37 5 7 10 9 14 12-4 5-5 12-13 19-21 19-51 27-81 26-41-1-74-14-92-43Z';
  return <svg className="ad-fish-art" viewBox="0 0 244 150" aria-hidden="true">
    <defs>
      <linearGradient id={id + 'body'} x1="0" x2=".14" y1="0" y2="1" gradientUnits="objectBoundingBox">
        <stop stopColor={light}/><stop offset=".49" stopColor={base}/><stop offset=".84" stopColor={light}/><stop offset="1" stopColor={base}/>
      </linearGradient>
      <linearGradient id={id + 'fin'} x2=".8" y2="1">
        <stop stopColor={light}/><stop offset=".45" stopColor={base}/><stop offset="1" stopColor={deep}/>
      </linearGradient>
      <pattern id={id + 'scales'} width="15" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 0q11 3 0 7M7.5 7q11 3 0 7" fill="none" stroke={deep} strokeOpacity=".26" strokeWidth="1"/>
      </pattern>
    </defs>
    <g fill={`url(#${id}fin)`} stroke={deep} strokeWidth="2" strokeLinejoin="round">
      <path d="M61 72C47 60 27 41 7 42c7 14 9 25 17 34C14 85 11 99 7 110c23 1 44-19 56-24Z"/>
      <path d="M83 52c13-28 31-39 62-41-3 9 5 14 19 21Z"/>
      <path d="M113 106c3 15 14 25 32 30l13-19Z"/>
    </g>
    <g fill="none" stroke={light} strokeOpacity=".65" strokeWidth="1.7" strokeLinecap="round">
      <path d="M53 76 18 53m34 27-29-4m28 7-33 18M99 44l17-22m-7 20 20-21m-8 19 17-20m-7 100 13 10"/>
    </g>
    <path d={body} fill={`url(#${id}body)`} stroke={deep} strokeWidth="2.5"/>
    <path d={body} fill={`url(#${id}scales)`}/>
    <path d="M64 74c30-31 68-43 106-34" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round"/>
    <path d="M173 89c-15-1-28 12-39 23 13 2 31-4 39-13Z" fill={`url(#${id}fin)`} stroke={deep} strokeWidth="1.5"/>
    <path d="M187 50c-10 12-11 32-3 43" fill="none" stroke={deep} strokeOpacity=".57" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="203" cy="60" r="12" fill="#fffbef" stroke={deep} strokeWidth="2"/>
    <circle cx="206" cy="61" r="6.8" fill="#183447"/>
    <circle cx="208" cy="58" r="2.5" fill="#fff"/>
    <path d="M220 80q8 4 15-2" fill="none" stroke={deep} strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="234" cy="78" r="1" fill="transparent" data-fish-mouth=""/>
  </svg>;
}

export function FishingTackle({ target }: { target: { x: number; y: number } | null }) {
  const tip = '32%';
  const x = target ? `${target.x}%` : tip;
  const y = target ? `${target.y}%` : '68px';
  return <div className={`ad-fishing-tackle${target ? ' is-casting' : ''}`} aria-hidden="true">
    <svg className="ad-fishing-rod" viewBox="0 0 280 70" preserveAspectRatio="none">
      <path d="M14 53C87 22 203 2 278 43" fill="none" stroke="#29384b" strokeWidth="8" strokeLinecap="round"/>
      <path d="M18 51C89 22 206 4 278 43" fill="none" stroke="#df9b58" strokeWidth="4" strokeLinecap="round"/>
      <path d="M38 43C107 17 206 6 273 39" fill="none" stroke="#ffe2a2" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 54 73 31" stroke="#653d36" strokeWidth="14" strokeLinecap="round"/>
      <path d="M13 51 73 28" stroke="#dc9d6d" strokeWidth="8" strokeLinecap="round"/>
      <path d="m26 45 4 7m8-12 4 7m8-12 4 7m8-12 4 7" stroke="#8d5140" strokeWidth="1.6"/>
      <g stroke="#31465b" strokeWidth="2.5" fill="#ffe7aa">
        <circle cx="61" cy="51" r="13"/><circle cx="61" cy="51" r="8" fill="#6a91a4"/><circle cx="61" cy="51" r="3"/>
        <path d="m62 51 12 8 8-2" fill="none"/>
        <ellipse cx="117" cy="24" rx="4" ry="5"/><ellipse cx="184" cy="20" rx="3" ry="4"/><ellipse cx="239" cy="29" rx="2.5" ry="3.5"/>
      </g>
    </svg>
    <svg className="ad-fishing-line">
      <line x1={tip} y1="43" x2={x} y2={y} stroke="#13466f" strokeOpacity=".55" strokeWidth="3" />
      <line x1={tip} y1="43" x2={x} y2={y} stroke="#fff8dc" strokeWidth="1.4" />
    </svg>
    <svg className="ad-fishing-lure" style={{ left: x, top: y }} viewBox="0 0 32 49">
      <path d="M16 2v5m0 22v12c0 7-10 7-10 0v-4l-3 4" fill="none" stroke="#274b69" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M16 6c-13 7-14 17-9 22 4 5 14 5 18 0 5-5 4-15-9-22Z" fill="#fff6dd" stroke="#294963" strokeWidth="1.8"/>
      <path d="M6 21h20c1 6-3 10-10 10S5 27 6 21Z" fill="#e97855"/>
      <path d="M11 13c-3 3-4 5-4 7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/>
    </svg>
  </div>;
}
