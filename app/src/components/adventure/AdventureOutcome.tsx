import {useLayoutEffect, useRef, type ReactNode} from 'react';
import './outcome.css';

/** Fit the complete feedback/result card, including the last action, without scrolling. */
export default function AdventureOutcome({className, children}: {className: string; children: ReactNode}) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = viewport.current, body = content.current;
    if (!box || !body) return;
    let frame = 0, alive = true;
    const fit = () => {
      frame = 0;
      if (!alive) return;
      const width = Math.max(1, box.clientWidth - 4), height = Math.max(1, box.clientHeight - 4);
      // Widen the natural layout when scaling down so long result lists use
      // more columns instead of leaving empty margins around tiny text.
      const fits = (scale: number) => {
        body.style.width = `${width / scale}px`;
        return body.scrollHeight * scale <= height && body.scrollWidth * scale <= width + 1;
      };
      let low = .01, high = 1;
      if (fits(1)) low = 1;
      else for (let i = 0; i < 14; i++) {
        const next = (low + high) / 2;
        if (fits(next)) low = next; else high = next;
      }
      fits(low);
      body.style.setProperty('--outcome-scale', String(low));
    };
    const schedule = () => {if (!frame) frame = requestAnimationFrame(fit);};
    const observer = new ResizeObserver(schedule);
    observer.observe(box); observer.observe(body);
    document.fonts.addEventListener('loadingdone', schedule);
    void document.fonts.ready.then(schedule);
    fit();
    return () => {alive = false; cancelAnimationFrame(frame); observer.disconnect(); document.fonts.removeEventListener('loadingdone', schedule);};
  }, []);
  return <div className={`ad-overlay ad-outcome ${className}`} role="status" data-game-contained>
    <div ref={viewport} className="ad-outcome-viewport">
      <div ref={content} className="ad-outcome-content">{children}</div>
    </div>
  </div>;
}
