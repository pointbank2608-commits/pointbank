/** Clock owned by classroom games only. Never patches browser globals or homework timers. */
import type {HistoryClock} from './gameHistory';
type Entry = {
  callback: () => void;
  due: number;
  native?: ReturnType<typeof setTimeout>;
  repeat?: number;
  owner?: string;
  scope?: string;
};
const jobs = new Map<number, Entry>();
const owners = new Set<string>();
const pauseListeners = new Set<(paused: boolean) => void>();
let nextId = 0;
let pausedAt: number | null = null;
let offset = 0;
let activeOwner:string|undefined;
let activeScope:string|undefined;
const historyOffsets=new Map<string,number>();
const now = () => (pausedAt ?? performance.now()) - offset;
const ownedNow=(owner:string|undefined)=>now()-(owner?historyOffsets.get(owner)??0:0);
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
      const previous=activeOwner,scope=activeScope;activeOwner=job.owner;activeScope=job.scope;
      try{job.callback();}finally{activeOwner=previous;activeScope=scope;}
    },
    Math.max(0, job.due - now()),
  );
}
function timeout(callback: () => void, ms = 0, owner=activeOwner): number {
  const id = ++nextId;
  const job = { callback, due: now() + Math.max(0, ms), owner, scope:activeScope };
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
    if (owners.size === 1) pauseListeners.forEach(listener => listener(true));
  } else {
    owners.delete(owner);
    if (!owners.size && pausedAt !== null) {
      offset += performance.now() - pausedAt;
      pausedAt = null;
      jobs.forEach((job, id) => arm(id, job));
      pauseListeners.forEach(listener => listener(false));
    }
  }
}
function interval(callback:()=>void,ms=0,owner=activeOwner) {
  const id=++nextId;
  const job={callback,due:now()+ms,repeat:Math.max(1,ms),owner,scope:activeScope};
  jobs.set(id,job);arm(id,job);return id;
}
interface GameClockCore {
  now:()=>number;paused:()=>boolean;onPause:(listener:(paused:boolean)=>void)=>()=>void;dateNow:()=>number;
  setTimeout:(callback:()=>void,ms?:number)=>number;clearTimeout:typeof clear;
  setInterval:(callback:()=>void,ms?:number)=>number;clearInterval:typeof clear;
  requestAnimationFrame:(callback:FrameRequestCallback)=>number;cancelAnimationFrame:typeof clear;
}
export const gameClock:GameClockCore&{forOwner:(owner:string)=>GameClockCore;history:(owner:string)=>HistoryClock;releaseOwner:(owner:string)=>void;clearScope:(scope:string)=>void;withScope:<T>(scope:string,fn:()=>T)=>T} = {
  clearScope:scope=>{for(const [id,job] of jobs)if(job.scope===scope)clear(id);},
  withScope:(scope,fn)=>{const previous=activeScope;activeScope=scope;try{return fn();}finally{activeScope=previous;}},
  releaseOwner:owner=>{for(const [id,job] of jobs)if(job.owner===owner)clear(id);historyOffsets.delete(owner);},
  now:()=>ownedNow(activeOwner),
  paused: () => owners.size > 0,
  onPause: (listener: (paused: boolean) => void) => {
    pauseListeners.add(listener);
    return () => { pauseListeners.delete(listener); };
  },
  dateNow: () =>
    Date.now() -
    offset -
    (pausedAt === null ? 0 : performance.now() - pausedAt),
  setTimeout: timeout,
  clearTimeout: clear,
  setInterval: interval,
  clearInterval: clear,
  requestAnimationFrame: (callback: FrameRequestCallback) =>
    timeout(() => callback(now()), 16),
  cancelAnimationFrame: clear,
  forOwner:owner=>({...gameClock,now:()=>ownedNow(owner),dateNow:()=>gameClock.dateNow()-(historyOffsets.get(owner)??0),setTimeout:(cb,ms)=>timeout(cb,ms,owner),setInterval:(cb,ms)=>interval(cb,ms,owner),requestAnimationFrame:cb=>timeout(()=>cb(ownedNow(owner)),16,owner)}),
  history:owner=>({
    capture:()=>({time:ownedNow(owner),jobs:[...jobs].filter(([,job])=>job.owner===owner).map(([id,job])=>({id,callback:job.callback,repeat:job.repeat,scope:job.scope,remaining:Math.max(0,job.due-now())}))}),
    clear:()=>{for(const [id,job] of jobs)if(job.owner===owner)clear(id);},
    restore:value=>{const snapshot=value as {time:number;jobs:Array<{id:number;callback:()=>void;repeat?:number;scope?:string;remaining:number}>};historyOffsets.set(owner,now()-snapshot.time);for(const saved of snapshot.jobs){const job={callback:saved.callback,repeat:saved.repeat,scope:saved.scope,due:now()+saved.remaining,owner};jobs.set(saved.id,job);arm(saved.id,job);}},
  }),
};
