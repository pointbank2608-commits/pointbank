export function fullscreenContentSpace(stage: HTMLElement) {
  const style = getComputedStyle(stage);
  return {
    width: stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    height: stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
  };
}

/** Use layout measurements, which exclude the zoom applied to the board. */
export function fitFullscreenZoom(stage: HTMLElement, board: HTMLElement, reservedHeight = 0) {
  const { width, height } = fullscreenContentSpace(stage);
  const ratio = Math.min(width / board.offsetWidth, (height - reservedHeight) / board.offsetHeight);
  // Keep text and touch targets readable on narrow screens, where the stage can scroll.
  const zoom = board.offsetWidth && board.offsetHeight ? Math.max(1, Math.floor(ratio * 1000) / 1000) : 1;
  const value = String(zoom);
  if (stage.style.getPropertyValue('--game-fullscreen-zoom') !== value) {
    stage.style.setProperty('--game-fullscreen-zoom', value);
  }
}
