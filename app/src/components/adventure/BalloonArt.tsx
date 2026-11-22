import { useId } from 'react';

const colors = [
  ['#ffe6ef', '#f889b0', '#c74f83'],
  ['#fff5c4', '#ffda68', '#d29a36'],
  ['#e1fff1', '#87d9bd', '#3c9c8b'],
  ['#e9f4ff', '#9abff5', '#5e85c8'],
  ['#f5eaff', '#c3a0ed', '#9064be'],
  ['#fff0d9', '#ffb279', '#d17c53'],
];

/** A rounded crown, tapered neck, tied knot and loose string form one balloon. */
export default function BalloonArt({ index, wide = false }: { index: number; wide?: boolean }) {
  const id = useId();
  const [light, base, shade] = colors[index % colors.length];
  const body = wide
    ? 'M200 12C99 12 18 47 18 103c0 51 61 81 135 108 29 10 39 15 42 21h10c3-6 13-11 42-21 74-27 135-57 135-108 0-56-81-91-182-91Z'
    : 'M110 12C57 12 18 55 18 111c0 51 28 83 64 106 15 10 21 15 23 21h10c2-6 8-11 23-21 36-23 64-55 64-106 0-56-39-99-92-99Z';
  return <svg className="ad-balloon-art" viewBox={wide?'0 0 400 270':'0 0 220 316'} width={wide?400:220} height={wide?270:316} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}-body`} cx="30%" cy="22%" r="84%">
        <stop stopColor={light}/><stop offset=".42" stopColor={base}/><stop offset="1" stopColor={shade}/>
      </radialGradient>
      <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fff" stopOpacity=".85"/><stop offset="1" stopColor="#fff" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <path className="ad-balloon-string" d={wide?'M200 242c-2 8-12 12-7 18s12 4 7 8':'M110 246c-2 16-16 24-9 37s19 14 9 29'} fill="none" stroke="#69869b" strokeWidth="1.8" strokeLinecap="round"/>
    <path d={wide?'M196 229l-8 14q12-5 24 0l-8-14':'M106 235l-8 14q12-5 24 0l-8-14'} fill={base} stroke={shade} strokeWidth="1.4" strokeLinejoin="round"/>
    <path d={body} fill={`url(#${id}-body)`} stroke={light} strokeWidth="2"/>
    <path d={wide?'M55 97c-3-26 25-48 68-60':'M45 102c-3-26 11-51 34-63'} fill="none" stroke={`url(#${id}-shine)`} strokeWidth="12" strokeLinecap="round"/>
    <ellipse cx={wide?149:89} cy="31" rx="9" ry="4" fill="#fff" opacity=".55" transform={`rotate(-18 ${wide?149:89} 31)`}/>
    <path d={wide?'M198 215q2 9 2 15':'M108 219q2 9 2 15'} fill="none" stroke={shade} strokeWidth="2" opacity=".4"/>
    <path d={wide?'M195 231q5 3 10 0':'M105 237q5 3 10 0'} fill="none" stroke={shade} strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}
