import type { StoryGame } from '../../lib/storybook';

const ASSET = '/skins/storybook/';
const worlds: Record<StoryGame, string> = {
  feedmonster: 'garden-v2.webp',
  sentencebridge: 'river-v2.webp',
  sentencetower: 'castle-v2.webp',
};

/** Static production art is bundled locally; gameplay never calls an image API. */
export function StoryWorld({ type }: { type: StoryGame }) {
  return <div className="sb-world sb-world-painted" aria-hidden="true">
    <img src={ASSET + worlds[type]} alt="" fetchPriority="high" decoding="async" />
    <div className="sb-world-light" />
    <span className="sb-firefly sb-firefly-one" />
    <span className="sb-firefly sb-firefly-two" />
    <span className="sb-firefly sb-firefly-three" />
  </div>;
}

export function Monster({ happy, wrong, hungry }: { happy: boolean; wrong: boolean; hungry: boolean }) {
  return <div className={['sb-monster', 'sb-monster-painted', happy ? 'is-happy' : '', wrong ? 'is-wrong' : ''].join(' ')} aria-hidden="true">
    <span className="sb-painted-shadow" />
    <img className={ !happy && !hungry ? 'sb-monster-image is-active' : 'sb-monster-image' } src={ASSET + 'monster-idle-v2.webp'} alt="" decoding="async" />
    <img className={ happy ? 'sb-monster-image is-active' : 'sb-monster-image' } src={ASSET + 'monster-happy-v2.webp'} alt="" decoding="async" />
    <img className={['sb-monster-image', 'sb-mouth-art', hungry && !happy ? 'is-active is-hungry' : ''].join(' ')} src={ASSET + 'monster-hungry-v2.webp'} alt="" decoding="async" />
  </div>;
}

export function Explorer() {
  return <span className="sb-explorer-art" aria-hidden="true"><img src={ASSET + 'explorer-v2.webp'} alt="" decoding="async" /></span>;
}

export function FoodArt({ word }: { word: string }) {
  const key = word.toLowerCase();
  return <svg viewBox="0 0 100 90" aria-hidden="true"><ellipse cx="50" cy="80" rx="31" ry="5" fill="#bd9c83" opacity=".15"/>{key === 'apple' ? <><path d="M51 27Q47 10 57 8" stroke="#8c714e" strokeWidth="5" fill="none"/><path d="M55 20Q69 1 79 16Q69 29 55 20" fill="#87c98a"/><path d="M50 30C9 3 8 67 33 78Q47 85 51 78Q68 87 80 66C102 23 65 13 50 30Z" fill="#f58d9b" stroke="#d96d82" strokeWidth="3"/><path d="M29 35q-9 9-5 19" stroke="#ffd0d3" strokeWidth="6" fill="none" strokeLinecap="round"/></> : key === 'banana' ? <path d="M17 23Q41 69 81 25L86 17 89 28Q80 91 31 72Q9 61 11 31Z" fill="#ffe6a7" stroke="#d8b857" strokeWidth="4"/> : key === 'carrot' ? <><path d="M61 26Q82 3 85 14L70 32Q102 20 91 37L71 43" fill="#8dca8d"/><path d="M62 27Q89 36 68 56L18 81Q14 77 34 44Z" fill="#ffbb85" stroke="#d99565" strokeWidth="3"/><path d="M43 40l8 10m4 6 7 7" stroke="#e59b63" strokeWidth="3"/></> : key === 'milk' ? <><path d="M28 27l14-16h24l12 16v52H28Z" fill="#faffff" stroke="#89bcd3" strokeWidth="3"/><path d="M28 27h50v12H28Z" fill="#b8e7f5"/><path d="M42 11v16m24-16-5 16" stroke="#89bcd3" strokeWidth="3"/><rect x="37" y="46" width="30" height="22" rx="5" fill="#b8e7f5"/></> : key === 'pencil' ? <g transform="rotate(35 50 45)"><path d="M40 12h20v54L50 83 40 66Z" fill="#ffe6a7" stroke="#c6a05a" strokeWidth="3"/><path d="M40 12q10-14 20 0v12H40" fill="#f9b5ce"/><path d="M47 77l3 6 4-6" fill="#465a80"/></g> : key === 'book' ? <><path d="M18 19q18-8 32 2 15-10 32-2v55q-18-7-32 2-16-10-32-2Z" fill="#b8e7f5" stroke="#87b4d4" strokeWidth="3"/><path d="M50 21v55M26 33h16m-16 12h16m17-12h15M59 45h15" stroke="#86b5ca" strokeWidth="3"/></> : <><path d="M50 12l11 22 25 3-18 18 4 25-22-12-22 12 4-25-18-18 25-3Z" fill="#ffe6a7" stroke="#d8b86c" strokeWidth="3"/><circle cx="43" cy="46" r="3" fill="#8d805e"/><circle cx="59" cy="46" r="3" fill="#8d805e"/><path d="M44 55q7 6 13 0" stroke="#8d805e" strokeWidth="2" fill="none"/></>}</svg>;
}
