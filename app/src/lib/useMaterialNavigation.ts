import { useEffect, useRef, useState } from 'react';

/** Measures the real scroll ancestor and app chrome, including font and safe-area changes. */
export function useMaterialNavigation(ids: string[]) {
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const navigateRef = useRef<(id: string, focus: boolean) => void>(() => {});
  const [active, setActive] = useState(ids[0] ?? '');
  useEffect(() => {
    const page = rootRef.current, nav = navRef.current;
    if (!page || !nav) return;
    let ancestor = page.parentElement;
    while (ancestor && !/(auto|scroll)/.test(getComputedStyle(ancestor).overflowY)) ancestor = ancestor.parentElement;
    const scroller = ancestor ?? document.scrollingElement ?? document.documentElement;
    const nested = !!ancestor;
    const eventTarget = nested ? scroller : window;
    const headers = [...document.querySelectorAll<HTMLElement>('header[data-app-chrome]')];
    const sections = ids.map(id => document.getElementById(id)).filter((s): s is HTMLElement => !!s);
    let frame = 0, releaseTimer = 0, locked: string | null = null, top = 0, inset = 0;
    const rootTop = () => nested ? scroller.getBoundingClientRect().top : 0;
    const height = () => nested ? scroller.clientHeight : window.innerHeight;
    const showActive = (id: string) => {
      setActive(id);
      const link = nav.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`);
      const rail = link?.parentElement;
      if (link && rail) {
        const x = link.offsetLeft;
        if (x < rail.scrollLeft) rail.scrollLeft = x;
        else if (x + link.offsetWidth > rail.scrollLeft + rail.clientWidth) rail.scrollLeft = x + link.offsetWidth - rail.clientWidth;
      }
    };
    const measure = () => {
      top = headers.reduce((n, header) => {
        const rect = header.getBoundingClientRect();
        return rect.height && rect.top <= rootTop() + 1 && rect.bottom > rootTop() ? Math.max(n, rect.bottom - rootTop()) : n;
      }, 0);
      inset = top + nav.getBoundingClientRect().height + 16;
      page.style.setProperty('--materials-header', `${top}px`);
      page.style.setProperty('--materials-inset', `${inset}px`);
    };
    const update = () => {
      frame = 0; measure();
      if (locked) { showActive(locked); return; }
      let current: string | undefined = sections[0]?.id;
      for (const section of sections) if (section.getBoundingClientRect().top <= rootTop() + inset + 2) current = section.id;
      // A short final section cannot reach the top of the viewport.
      if (scroller.scrollTop > 0 && scroller.scrollTop + height() >= scroller.scrollHeight - 3) current = sections.at(-1)?.id;
      if (current) showActive(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const unlock = () => { locked = null; clearTimeout(releaseTimer); schedule(); };
    const onScroll = () => { schedule(); if (locked) { clearTimeout(releaseTimer); releaseTimer = window.setTimeout(unlock, 160); } };
    const jump = (id: string, focus: boolean) => {
      const section = sections.find(s => s.id === id);
      if (!section) return;
      measure(); locked = id; showActive(id);
      if (focus) {
        history.replaceState(history.state, '', `#${id}`);
        section.querySelector<HTMLElement>('h2')?.focus({preventScroll:true});
      }
      const y = Math.max(0, Math.min(scroller.scrollHeight - height(), scroller.scrollTop + section.getBoundingClientRect().top - rootTop() - inset));
      const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches || !focus ? 'instant' : 'smooth';
      if (nested) scroller.scrollTo({top:y, behavior}); else window.scrollTo({top:y, behavior});
      clearTimeout(releaseTimer); releaseTimer = window.setTimeout(unlock, 1800);
    };
    navigateRef.current = jump;
    const hashJump = () => jump(location.hash.slice(1), false);
    const resized = () => { measure(); if (location.hash && locked) jump(location.hash.slice(1), false); schedule(); };
    const observer = new ResizeObserver(resized);
    observer.observe(nav); headers.forEach(h => observer.observe(h));
    eventTarget.addEventListener('scroll', onScroll, {passive:true});
    eventTarget.addEventListener('wheel', unlock, {passive:true});
    eventTarget.addEventListener('touchstart', unlock, {passive:true});
    window.addEventListener('resize', resized); window.addEventListener('hashchange', hashJump);
    measure(); hashJump(); schedule();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(releaseTimer);
      eventTarget.removeEventListener('scroll', onScroll); eventTarget.removeEventListener('wheel', unlock); eventTarget.removeEventListener('touchstart', unlock);
      window.removeEventListener('resize', resized); window.removeEventListener('hashchange', hashJump);
      navigateRef.current = () => {};
    };
  }, [ids]);
  return {rootRef, navRef, active, jump:(id: string, focus = false) => navigateRef.current(id, focus)};
}
