import { useId } from 'react';

/** The alpha opening keeps every animated ball above the glass and behind the clay rim. */
export default function LotteryCabinet({ front = false }: { front?: boolean }) {
  const id = useId().replaceAll(':', '');
  if (front) return <img data-lottery-cabinet src="/skins/lottery-cabinet-clay-v2.png" alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />;
  return <svg aria-hidden="true" viewBox="0 0 400 440" className="pointer-events-none absolute inset-0 h-full w-full select-none">
    <defs>
      <radialGradient id={`${id}-glass`} cx=".28" cy=".2" r=".9"><stop stopColor="#fffdf3" stopOpacity=".9"/><stop offset=".65" stopColor="#f6f9e9" stopOpacity=".6"/><stop offset="1" stopColor="#abd5c7" stopOpacity=".75"/></radialGradient>
    </defs>
    <ellipse cx="200" cy="425" rx="120" ry="9" fill="#526c65" opacity=".1"/>
    <circle cx="200" cy="164" r="111" fill={`url(#${id}-glass)`}/>
    <path d="M105 151a96 96 0 0 1 47-72" fill="none" stroke="#fffdf6" strokeOpacity=".45" strokeWidth="6" strokeLinecap="round"/>
    <ellipse cx="200" cy="250" rx="66" ry="10" fill="#8bb7a2" opacity=".18"/>
  </svg>;
}
