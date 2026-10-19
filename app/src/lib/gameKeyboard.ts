/** Hidden/paused boards must not consume typing or Enter in teacher controls. */
export function gameKeyboardAllowed(event: KeyboardEvent): boolean {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('input,textarea,select,[contenteditable="true"],dialog[open]')) return false;
  if (document.querySelector('dialog[open]')) return false;
  const workspace = target?.closest('.game-workspace') || document.querySelector('.game-workspace-focus') || document.querySelector('.game-workspace');
  return !workspace?.querySelector('.game-workspace-stage.game-workspace-paused');
}
