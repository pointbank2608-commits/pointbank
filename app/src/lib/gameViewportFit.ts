import { useLayoutEffect, type RefObject } from 'react';

type Bounds = { x: number; y: number; width: number; height: number };
const transparent = (color: string) => color === 'transparent' || color === 'rgba(0, 0, 0, 0)';

/** Read painted content instead of treating every full-width wrapper as the board. */
export function gameCanvasBounds(canvas: HTMLElement): Bounds {
  const origin = canvas.getBoundingClientRect();
  const scale = Number(canvas.dataset.gameScale) || 1;
  const boxes: Bounds[] = [];
  function visit(element: Element) {
    if (!(element instanceof HTMLElement || element instanceof SVGSVGElement)) return;
    if (element.matches('[hidden], [data-game-management], [role="dialog"], dialog')) return;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const image = ['IMG', 'SVG', 'CANVAS', 'VIDEO', 'IFRAME'].includes(element.tagName);
    const control = element.matches('button,input,select,textarea');
    const scrollArea = element.hasAttribute('data-game-contained') || element instanceof HTMLElement && (
      (/auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2)
      || (/auto|scroll/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 2));
    const painted = !transparent(style.backgroundColor) || style.backgroundImage !== 'none'
      || ['Top', 'Right', 'Bottom', 'Left'].some(side => parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0);
    if (image || control || painted || scrollArea) {
      // Rotating a wheel or shaking an answer must not resize the whole game.
      const width = element instanceof HTMLElement ? element.offsetWidth : parseFloat(style.width) || rect.width / scale;
      const height = element instanceof HTMLElement ? element.offsetHeight : parseFloat(style.height) || rect.height / scale;
      boxes.push({x: (rect.left + rect.width / 2 - origin.left) / scale - width / 2,
        y: (rect.top + rect.height / 2 - origin.top) / scale - height / 2, width, height});
    } else if ([...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
      const range = document.createRange();
      range.selectNodeContents(element);
      for (const r of range.getClientRects()) if (r.width && r.height) boxes.push({
        x: (r.left - origin.left) / scale, y: (r.top - origin.top) / scale,
        width: r.width / scale, height: r.height / scale,
      });
    }
    if (!image && !control && !scrollArea) for (const child of element.children) visit(child);
  }
  for (const child of canvas.children) visit(child);
  if (!boxes.length) return {x: 0, y: 0, width: canvas.offsetWidth, height: canvas.offsetHeight};
  const left = Math.min(...boxes.map(box => box.x));
  const top = Math.min(...boxes.map(box => box.y));
  return {x: left - 2, y: top - 2,
    width: Math.max(...boxes.map(box => box.x + box.width)) - left + 4,
    height: Math.max(...boxes.map(box => box.y + box.height)) - top + 4};
}

/** Extend scenery behind the fitted canvas; foreground objects keep their proportions. */
function extendBackdrop(canvas: HTMLElement, backdrop: HTMLElement) {
  let best = 0;
  let image = '';
  let position = 'center';
  let source: HTMLElement | null = null;
  const rootHeight = canvas.offsetHeight;
  const candidates = new Set<Element>(canvas.querySelectorAll('img, :scope > *, :scope > * > *, :scope > * > * > *'));
  for (const element of candidates) {
    if (!(element instanceof HTMLElement)) continue;
    const style = getComputedStyle(element);
    if (style.display === 'none' || (style.visibility === 'hidden' && !element.dataset.gameSceneSource)) continue;
    const decorative = element instanceof HTMLImageElement && style.position === 'absolute' && style.objectFit === 'cover';
    const next = decorative ? `url(${JSON.stringify(element.currentSrc || element.src)})`
      : element.style.backgroundImage || element.dataset.gameSceneImage || style.backgroundImage;
    if (!next || next === 'none') continue;
    const area = element.offsetWidth * element.offsetHeight;
    if (element.offsetWidth < canvas.offsetWidth * .45 || element.offsetHeight < rootHeight * .4 || area <= best) continue;
    best = area;
    image = next;
    position = decorative ? style.objectPosition : style.backgroundPosition;
    source = element;
  }
  if (backdrop.style.backgroundImage !== image) backdrop.style.backgroundImage = image;
  backdrop.style.backgroundPosition = position;
  for (const previous of canvas.querySelectorAll<HTMLElement>('[data-game-scene-source]')) {
    if (previous !== source) { delete previous.dataset.gameSceneSource; delete previous.dataset.gameSceneImage; }
  }
  if (source) {
    source.dataset.gameSceneSource = source instanceof HTMLImageElement ? 'image' : 'background';
    source.dataset.gameSceneImage = image;
    canvas.dataset.gameHasScenery = 'true';
  } else delete canvas.dataset.gameHasScenery;
  backdrop.dataset.gameSceneTint = source && canvas.querySelector('.ad-game') ? 'adventure' : '';
}

/** One fit calculation for normal play, fullscreen and lesson presentation. No remounts. */
export function useGameViewportFit({stage, canvas, backdrop, fill, identity}: {
  stage: RefObject<HTMLDivElement | null>; canvas: RefObject<HTMLDivElement | null>;
  backdrop?: RefObject<HTMLDivElement | null>; fill: boolean; identity?: string;
}) {
  useLayoutEffect(() => {
    const surface = stage.current;
    const board = canvas.current;
    if (!surface || !board) return;
    let frame = 0;
    let alive = true;
    const set = (element: HTMLElement, name: string, value: string) => {
      if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
    };
    const fit = () => {
      if (!alive || !surface.isConnected) return;
      if (!fill) {
        const available = Math.max(200, window.innerHeight - surface.getBoundingClientRect().top - 20);
        set(surface, 'height', `${available}px`);
        set(surface, 'flex', 'none');
      } else {
        surface.style.removeProperty('height');
        surface.style.removeProperty('flex');
      }
      const style = getComputedStyle(surface);
      const width = surface.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = surface.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (width < 16 || height < 16) return;
      // A stable layout width keeps pixel-sized objects and their labels in proportion.
      set(board, '--game-canvas-width', `${Math.min(1280, width)}px`);
      // Responsive scenes can lay out against the available shape before uniform scaling.
      set(board, '--game-surface-ratio', `${width} / ${height}`);
      const bounds = gameCanvasBounds(board);
      board.dataset.gameBounds = JSON.stringify(bounds);
      if (bounds.width < 8 || bounds.height < 8) return;
      const ratio = Math.min((width - 4) / bounds.width, (height - 4) / bounds.height);
      const scale = Math.max(.01, Math.floor(ratio * 10000) / 10000);
      board.dataset.gameScale = String(scale);
      set(board, '--game-fit-scale', String(scale));
      set(board, '--game-fit-x', `${-bounds.x}px`);
      set(board, '--game-fit-y', `${-bounds.y}px`);
      set(surface, '--game-fit-width', `${bounds.width * scale}px`);
      set(surface, '--game-fit-height', `${bounds.height * scale}px`);
      if (backdrop?.current) extendBackdrop(board, backdrop.current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => {frame = 0; fit();}); };
    fit();
    const resize = new ResizeObserver(schedule);
    resize.observe(surface);
    resize.observe(board);
    for (const element of board.children) resize.observe(element);
    const mutations = new MutationObserver(schedule);
    // Style changes from the fitting calculation itself are deliberately excluded.
    mutations.observe(board, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['src', 'hidden', 'class']});
    board.addEventListener('load', schedule, true);
    board.addEventListener('animationend', schedule, true);
    board.addEventListener('transitionend', schedule, true);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    document.fonts.addEventListener('loadingdone', schedule);
    void document.fonts.ready.then(schedule);
    return () => {
      alive = false;
      resize.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
      board.removeEventListener('load', schedule, true);
      board.removeEventListener('animationend', schedule, true);
      board.removeEventListener('transitionend', schedule, true);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      document.fonts.removeEventListener('loadingdone', schedule);
      for (const source of board.querySelectorAll<HTMLElement>('[data-game-scene-source]')) {
        delete source.dataset.gameSceneSource;
        delete source.dataset.gameSceneImage;
      }
      delete board.dataset.gameHasScenery;
      if (backdrop?.current) backdrop.current.style.backgroundImage = '';
    };
  }, [stage, canvas, backdrop, fill, identity]);
}
