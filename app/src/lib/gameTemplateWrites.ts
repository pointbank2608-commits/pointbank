/** Serialize writes to one saved game so a slow automatic save cannot overwrite an explicit save. */
const pending = new Map<string, Promise<void>>();
export function queueGameTemplateWrite(id: string, write: () => Promise<void>): Promise<void> {
  const next = (pending.get(id) ?? Promise.resolve()).catch(() => undefined).then(write);
  pending.set(id, next);
  const clear = () => { if (pending.get(id) === next) pending.delete(id); };
  void next.then(clear, clear);
  return next;
}
export async function flushGameTemplateWrites(id: string): Promise<void> {
  await pending.get(id);
}
