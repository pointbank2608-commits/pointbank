/** Clock owned by classroom games only. Never patches browser globals or homework timers. */
type Entry = {
  callback: () => void;
  due: number;
  native?: ReturnType<typeof setTimeout>;
  repeat?: number;
};
const jobs = new Map<number, Entry>();
const owners = new Set<string>();
let nextId = 0;
let pausedAt: number | null = null;
let offset = 0;
const now = () => (pausedAt ?? performance.now()) - offset;
function arm(id: number, job: Entry) {
  if (owners.size) return;
  job.native = globalThis.setTimeout(
    () => {
      if (!jobs.has(id) || owners.size) return;
      if (job.repeat === undefined) jobs.delete(id);
      else {
        job.due = now() + job.repeat;
        arm(id, job);
      }
      job.callback();
    },
    Math.max(0, job.due - now()),
  );
}
function timeout(callback: () => void, ms = 0): number {
  const id = ++nextId;
  const job = { callback, due: now() + Math.max(0, ms) };
  jobs.set(id, job);
  arm(id, job);
  return id;
}
function clear(id: number | undefined | null) {
  if (id == null) return;
  const job = jobs.get(id);
  if (job?.native) globalThis.clearTimeout(job.native);
  jobs.delete(id);
}
export function pauseGameClock(owner: string, paused: boolean) {
  if (paused) {
    if (owners.has(owner)) return;
    if (!owners.size) {
      pausedAt = performance.now();
      jobs.forEach((job) => {
        if (job.native) globalThis.clearTimeout(job.native);
      });
    }
    owners.add(owner);
  } else {
    owners.delete(owner);
    if (!owners.size && pausedAt !== null) {
      offset += performance.now() - pausedAt;
      pausedAt = null;
      jobs.forEach((job, id) => arm(id, job));
    }
  }
}
export const gameClock = {
  now,
  dateNow: () =>
    Date.now() -
    offset -
    (pausedAt === null ? 0 : performance.now() - pausedAt),
  setTimeout: timeout,
  clearTimeout: clear,
  setInterval: (callback: () => void, ms = 0) => {
    const id = ++nextId;
    const job = { callback, due: now() + ms, repeat: Math.max(1, ms) };
    jobs.set(id, job);
    arm(id, job);
    return id;
  },
  clearInterval: clear,
  requestAnimationFrame: (callback: FrameRequestCallback) =>
    timeout(() => callback(now()), 16),
  cancelAnimationFrame: clear,
};
