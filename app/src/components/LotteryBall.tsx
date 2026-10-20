import GameFitText from './GameFitText';

const TEXTURE = '/skins/lottery-ball-clay-v1.png';

/** One neutral clay sprite preserves its grain and lighting across every pastel tint. */
export default function LotteryBall({ color, label, compact = false }: { color: string; label?: string; compact?: boolean }) {
  return <span data-lottery-ball className="pointer-events-none absolute inset-0 isolate" style={{ filter: 'drop-shadow(0 3px 3px #38544830)' }}>
    <span aria-hidden="true" className="absolute inset-0" style={{ backgroundColor: color, maskImage: `url(${TEXTURE})`, maskSize: '100% 100%', maskRepeat: 'no-repeat' }} />
    <img data-clay-ball-texture src={TEXTURE} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" style={{ mixBlendMode: 'multiply', filter: 'brightness(1.14)' }} />
    {label && <span className="absolute inset-x-[14%] inset-y-[30%] flex items-center justify-center rounded-[40%] font-bold text-[#294d49]" style={{ background: 'radial-gradient(circle at 30% 25%, #fff9e9f5, #eee0c4ed)', boxShadow: 'inset 0 1px 2px #fff9, 0 1px 2px #42553c30' }}>
      {compact ? <span className="text-[7px] leading-none">{label}</span> : <GameFitText text={label} maxSize={20} />}
    </span>}
  </span>;
}
