import { useTranslation } from 'react-i18next';

/**
 * 랜딩 "단어 한 번 입력, 다양한 게임으로" 구성도(2026-10-17) — 가운데 단어장 카드에서 네 게임으로 화살표가 퍼진다.
 * 화살표·연결선은 SVG/CSS 로 직접 그린다(모바일에서는 화살표를 빼고 세로로 쌓는다). 예시 단어와 그림은 서로 맞게 짝지었다.
 */
const WORDS = ['apple', 'banana', 'cat', 'dog'];
const IMG = (w: string) => `/landing2/w-${w}.webp`;

function Arrow({ flipX, flipY }: { flipX?: boolean; flipY?: boolean }) {
  // 단어장(안쪽)에서 게임(바깥쪽)으로 가는 곡선 화살표
  return (
    <svg
      viewBox="0 0 64 80"
      className="h-20 w-16 text-[var(--lp-blue)]"
      style={{ transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})` }}
      aria-hidden="true"
    >
      <path d="M4 66 C 8 30, 30 14, 52 14" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M42 4 L56 14 L42 26" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PanelShell({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className={`relative aspect-[1.32/1] overflow-hidden rounded-[28px] shadow-[0_18px_44px_-26px_rgba(25,60,140,.5)] ${tone}`}>
      <div className="absolute left-5 top-4 z-10 text-[clamp(20px,2.4vw,26px)] font-black text-[var(--lp-navy)]">{title}</div>
      {children}
    </div>
  );
}

const WHEEL = [
  { w: 'banana', c: '#ffe98a', r: 0 },
  { w: 'dog', c: '#c8eec1', r: 90 },
  { w: 'cat', c: '#bcd9ff', r: 180 },
  { w: 'apple', c: '#ffc9ce', r: 270 },
];
function pol(deg: number, r: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
}

export default function GamesDiagram() {
  const { t } = useTranslation();

  const wheel = (
    <PanelShell title={t('landing2.games.wheel')} tone="bg-gradient-to-br from-[#cfe8ff] via-[#dff3e0] to-[#f4ead2]">
      <svg viewBox="-4 -14 208 218" className="absolute bottom-[3%] left-1/2 h-[82%] -translate-x-1/2" aria-hidden="true">
        <circle cx="100" cy="100" r="99" fill="#fff" />
        {WHEEL.map((s, i) => {
          const [x0, y0] = pol(i * 90, 94);
          const [x1, y1] = pol((i + 1) * 90, 94);
          const [ix, iy] = pol(i * 90 + 45, 52);
          return (
            <g key={s.w}>
              <path d={`M100 100 L${x0} ${y0} A94 94 0 0 1 ${x1} ${y1} Z`} fill={s.c} stroke="#fff" strokeWidth="3" />
              <image href={IMG(s.w)} x={ix - 21} y={iy - 30} width="42" height="42" />
              <text x={ix} y={iy + 26} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0b1f4d" fontFamily="'Noto Sans KR', sans-serif">{s.w}</text>
            </g>
          );
        })}
        <circle cx="100" cy="100" r="14" fill="#1d63f0" />
        <circle cx="100" cy="100" r="5" fill="#fff" />
        <path d="M89 -8 L111 -8 L100 14 Z" fill="#1d63f0" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    </PanelShell>
  );

  const hangman = (
    <PanelShell title={t('landing2.games.hangman')} tone="bg-gradient-to-br from-[#fff3c2] via-[#fff8dc] to-[#e1efff]">
      <div className="absolute bottom-[8%] left-[6%] right-[17%] top-[22%] rounded-2xl border-[7px] border-[#c08a4f] bg-[#fbfcff] shadow-[inset_0_0_0_3px_#e3c79a]">
        <div className="mt-[5%] text-center font-black tracking-[0.35em] text-[var(--lp-navy)] [font-size:clamp(28px,4vw,46px)]">C _ T</div>
        <div className="mx-auto mt-[3%] grid w-[74%] grid-cols-5 gap-[2.5%]">
          {'ABCDEFGHIJ'.split('').map((k) => (
            <span key={k} className={`flex aspect-[1/0.9] items-center justify-center rounded-md text-[clamp(11px,1.5vw,16px)] font-bold ${k === 'C' ? 'bg-[#1d63f0] text-white' : 'bg-[#e6eefc] text-[#33415f]'}`}>
              {k}
            </span>
          ))}
        </div>
      </div>
      <img src={IMG('cat')} alt="" className="absolute bottom-[3%] right-[2%] h-[34%] w-auto drop-shadow-md" />
    </PanelShell>
  );

  const matchup = (
    <PanelShell title={t('landing2.games.matchup')} tone="bg-gradient-to-br from-[#d6e8ff] to-[#eaf4ff]">
      <div className="absolute inset-x-[7%] bottom-[7%] top-[24%] flex">
        <div className="flex w-[34%] flex-col justify-between">
          {WORDS.map((w) => (
            <div key={w} className="flex h-[21%] items-center justify-center rounded-xl bg-white shadow-sm">
              <img src={IMG(w)} alt="" className="h-[80%] w-auto object-contain" />
            </div>
          ))}
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-[28%]" aria-hidden="true">
          {/* 사과→apple, 바나나→banana, 고양이→cat, 강아지→dog (오른쪽은 섞여 있어 선이 엇갈린다) */}
          {[
            [10.5, 36.5],
            [36.5, 11],
            [62, 89],
            [88, 63],
          ].map(([a, b], i) => (
            <path key={i} d={`M0 ${a} C 50 ${a}, 50 ${b}, 100 ${b}`} fill="none" stroke="#1d63f0" strokeWidth="2.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          ))}
        </svg>
        <div className="flex w-[38%] flex-col justify-between">
          {['banana', 'apple', 'dog', 'cat'].map((w) => (
            <div key={w} className="flex h-[21%] items-center justify-center rounded-xl bg-white text-[clamp(13px,1.7vw,19px)] font-bold text-[var(--lp-navy)] shadow-sm">
              {w}
            </div>
          ))}
        </div>
      </div>
    </PanelShell>
  );

  const treasure = (
    <PanelShell title={t('landing2.games.treasure')} tone="bg-[#fff3c2]">
      <img src="/skins/dig/scene.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute left-1/2 top-[20%] flex w-[34%] -translate-x-1/2 flex-col items-center rounded-xl bg-white py-[2%] shadow-md">
        <img src={IMG('apple')} alt="" className="h-[52%] w-auto object-contain [height:clamp(34px,5vw,60px)]" />
        <span className="text-[clamp(12px,1.6vw,18px)] font-bold text-[var(--lp-navy)]">apple</span>
      </div>
      <img src="/skins/dig/chest-open.webp" alt="" loading="lazy" className="absolute bottom-[3%] left-[10%] w-[24%] drop-shadow-lg" />
      <img src="/skins/dig/shovel.webp" alt="" loading="lazy" className="absolute bottom-[6%] right-[14%] w-[13%] drop-shadow-lg" />
    </PanelShell>
  );

  const list = (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="overflow-hidden rounded-[26px] bg-white shadow-[0_22px_50px_-24px_rgba(25,60,140,.55)]">
        <div className="bg-[var(--lp-blue)] py-3 text-center text-[24px] font-black text-white">{t('landing2.games.listTitle')}</div>
        <ul className="space-y-2.5 p-4">
          {WORDS.map((w) => (
            <li key={w} className="flex items-center gap-4 rounded-2xl bg-[#f3f6fc] px-4 py-2.5 text-[22px] font-extrabold text-[var(--lp-navy)]">
              <img src={IMG(w)} alt="" loading="lazy" className="h-12 w-12 object-contain" />
              {w}
            </li>
          ))}
        </ul>
      </div>
      <img src="/landing2/m-point.webp" alt="" loading="lazy" className="pointer-events-none absolute -bottom-10 right-0 w-[34%] translate-x-[18%] lg:-right-12 lg:w-[40%] lg:translate-x-0 drop-shadow-lg" />
    </div>
  );

  return (
    <div>
      {/* 데스크톱: 3열 + 화살표 칸 */}
      <div className="hidden items-center gap-y-6 lg:grid lg:grid-cols-[1fr_64px_340px_64px_1fr]">
        <div className="row-start-1">{wheel}</div>
        <div className="row-start-1 flex justify-center"><Arrow flipX /></div>
        <div className="col-start-3 row-span-2 row-start-1">{list}</div>
        <div className="row-start-1 flex justify-center"><Arrow /></div>
        <div className="row-start-1">{hangman}</div>

        <div className="row-start-2">{matchup}</div>
        <div className="row-start-2 flex justify-center"><Arrow flipX flipY /></div>
        <div className="row-start-2 flex justify-center"><Arrow flipY /></div>
        <div className="row-start-2">{treasure}</div>
      </div>

      {/* 태블릿·모바일: 단어장 → 네 게임 */}
      <div className="lg:hidden">
        {list}
        <div className="my-8 flex justify-center text-[var(--lp-blue)]" aria-hidden="true">
          <svg viewBox="0 0 48 56" className="h-14 w-12"><path d="M24 4 V44 M8 30 L24 46 L40 30" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {wheel}
          {hangman}
          {matchup}
          {treasure}
        </div>
      </div>
    </div>
  );
}
