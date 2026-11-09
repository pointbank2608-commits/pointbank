import { useId, useLayoutEffect, useRef } from 'react';
import { gameClock } from '../../lib/gameClock';

export type FishingCast = { fish: HTMLButtonElement; correct: boolean; duration: number; reducedMotion: boolean };

const progress = (time: number, start: number, end: number) => Math.max(0, Math.min(1, (time - start) / (end - start)));
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const ease = (amount: number) => amount * amount * (3 - 2 * amount);

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
      <g className="ad-fish-tail">
        <path d="M61 72C47 60 27 41 7 42c7 14 9 25 17 34C14 85 11 99 7 110c23 1 44-19 56-24Z"/>
        <path d="M53 76 18 53m34 27-29-4m28 7-33 18" fill="none" stroke={light} strokeOpacity=".65" strokeWidth="1.7" strokeLinecap="round"/>
      </g>
      <path d="M83 52c13-28 31-39 62-41-3 9 5 14 19 21Z"/>
      <path d="M113 106c3 15 14 25 32 30l13-19Z"/>
    </g>
    <g fill="none" stroke={light} strokeOpacity=".65" strokeWidth="1.7" strokeLinecap="round">
      <path d="M99 44l17-22m-7 20 20-21m-8 19 17-20m-7 100 13 10"/>
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

export function FishingTackle({ cast }: { cast: FishingCast | null }) {
  const tackle = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!cast || cast.reducedMotion || !tackle.current) return;
    const { fish, correct, duration } = cast;
    const root = tackle.current;
    const mouth = fish.querySelector('[data-fish-mouth]');
    const lines = root.querySelectorAll('line');
    const lure = root.querySelector<SVGSVGElement>('.ad-fishing-lure');
    const splash = root.querySelector<HTMLElement>('.ad-fishing-splash');
    const wake = root.querySelector<HTMLElement>('.ad-fishing-wake');
    if (!mouth || !lure || !splash || !wake || !root.offsetWidth || !root.offsetHeight) return;

    // Freeze the selected fish in its current swim position before measuring its mouth.
    fish.style.translate = getComputedStyle(fish).translate;
    fish.style.animation = 'none';
    fish.style.transition = 'none';
    const bounds = root.getBoundingClientRect();
    const scaleX = root.offsetWidth / bounds.width;
    const scaleY = root.offsetHeight / bounds.height;
    const end = mouth.getBoundingClientRect();
    const body = fish.getBoundingClientRect();
    // The background is 1536 × 1024, covered from the upper left. Use its painted line and water entry.
    const artScale = Math.max(root.offsetWidth / 1536, root.offsetHeight / 1024);
    const rodX = 394 * artScale;
    const rodY = 57 * artScale;
    const surfaceY = 220 * artScale;
    const hookOffset = lure.clientHeight * 43 / 49;
    const mouthX = (end.left + end.width / 2 - bounds.left) * scaleX;
    const mouthY = (end.top + end.height / 2 - bounds.top) * scaleY;
    fish.style.transformOrigin = `${(end.left + end.width / 2 - body.left) * scaleX}px ${(end.top + end.height / 2 - body.top) * scaleY}px`;
    const escapeX = root.offsetWidth - mouthX + fish.offsetWidth + 24;
    const start = gameClock.now();
    let frame: number | undefined;

    const draw = (now: number) => {
      const elapsed = now - start;
      const drop = ease(progress(elapsed, 0, 700));
      const reel = ease(progress(elapsed, correct ? 820 : 720, duration - 100));
      const x = mix(mix(rodX, mouthX, drop), rodX, reel * (1.35 - .35 * reel));
      const y = mix(mix(surfaceY, mouthY, drop), correct ? rodY + hookOffset : surfaceY, reel);
      lure.style.left = `${x}px`;
      lure.style.top = `${y}px`;
      lines.forEach(line => {
        line.setAttribute('x1', String(rodX));
        line.setAttribute('y1', String(y > surfaceY + hookOffset ? surfaceY : rodY));
        line.setAttribute('x2', String(x));
        line.setAttribute('y2', String(y - hookOffset));
      });
      if (correct) {
        // Once caught, the same motion moves the hook and the fish's mouth together.
        const tilt = -86 * ease(progress(elapsed, 700, 1150)) + Math.sin(elapsed / 45) * 8 * (1 - reel);
        const scale = 1 - .38 * ease(progress(reel, .72, 1));
        if (elapsed >= 700) fish.style.transform = `translate(${x - mouthX}px, ${y - mouthY}px) rotate(${tilt}deg) scale(${scale})`;
        fish.style.opacity = String(1 - progress(reel, 0.94, 1));
        lure.style.opacity = fish.style.opacity;
        const surface = 1 - Math.min(1, Math.abs(y - surfaceY) / 48);
        splash.style.left = `${x}px`;
        splash.style.top = `${surfaceY}px`;
        splash.style.opacity = String(reel > 0 ? surface : 0);
        splash.style.scale = String(1.4 - surface * .55);
      } else {
        const dodge = ease(progress(elapsed, 475, duration - 300));
        const rise = -Math.min(70, root.offsetHeight * .11) * Math.sin(dodge * Math.PI * .75);
        fish.style.transform = `translate(${escapeX * dodge}px, ${rise}px) rotate(${-18 * Math.sin(dodge * Math.PI)}deg)`;
        wake.style.left = `${mouthX - fish.offsetWidth * .7 + escapeX * dodge}px`;
        wake.style.top = `${mouthY + rise}px`;
        wake.style.opacity = String(Math.sin(dodge * Math.PI));
      }
      if (elapsed < duration - 100) frame = gameClock.requestAnimationFrame(draw);
    };
    draw(start);

    return () => {
      gameClock.cancelAnimationFrame(frame);
      for (const property of ['translate', 'animation', 'transition', 'transform', 'transform-origin', 'opacity']) fish.style.removeProperty(property);
      lure.style.removeProperty('left');
      lure.style.removeProperty('top');
      lure.style.removeProperty('opacity');
      splash.style.opacity = '0';
      wake.style.opacity = '0';
    };
  }, [cast]);

  return <div ref={tackle} className="ad-fishing-tackle" data-fishing-cast={cast ? cast.correct ? 'catch' : 'miss' : 'idle'} hidden={!cast || cast.reducedMotion} aria-hidden="true">
    <svg className="ad-fishing-line">
      <line stroke="#13466f" strokeOpacity=".55" strokeWidth="3" />
      <line stroke="#fff8dc" strokeWidth="1.4" />
    </svg>
    <svg className="ad-fishing-lure" viewBox="0 0 32 49">
      <path d="M16 2v5m0 22v12c0 7-10 7-10 0v-4l-3 4" fill="none" stroke="#274b69" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M16 6c-13 7-14 17-9 22 4 5 14 5 18 0 5-5 4-15-9-22Z" fill="#fff6dd" stroke="#294963" strokeWidth="1.8"/>
      <path d="M6 21h20c1 6-3 10-10 10S5 27 6 21Z" fill="#e97855"/>
      <path d="M11 13c-3 3-4 5-4 7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/>
    </svg>
    <span className="ad-fishing-splash" />
    <span className="ad-fishing-wake"><i/><i/><i/></span>
  </div>;
}
