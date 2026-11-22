/** Local classroom play history. Never a database rollback or a source-material revision. */
export interface HistoryNode<T = unknown> {
  capture: () => T;
  restore: (value: T, elapsed: number) => void | Promise<void>;
}
type Snapshot = { values: Map<string, unknown>; time: number; clock: unknown };
export interface HistoryClock {
  capture: () => unknown;
  restore: (value: unknown) => void;
  clear: () => void;
}

export function cloneHistoryValue<T>(value: T, seen = new Map<object, unknown>()): T {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value) as T;
  if (value instanceof Date) return new Date(value) as T;
  if (value instanceof Set) { const copy = new Set(); seen.set(value, copy); value.forEach(v => copy.add(cloneHistoryValue(v, seen))); return copy as T; }
  if (value instanceof Map) { const copy = new Map(); seen.set(value, copy); value.forEach((v,k) => copy.set(k,cloneHistoryValue(v,seen))); return copy as T; }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  const copy: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  for (const key of Object.keys(value)) (copy as Record<string, unknown>)[key] = cloneHistoryValue((value as Record<string,unknown>)[key], seen);
  return copy as T;
}

function signature(snapshot: Snapshot) {
  const seen = new Set<object>();
  return JSON.stringify([...snapshot.values], (key, value) => {
    if (/^(now|left|remaining|elapsed|tick|frame|hover|pointer|timeLeft)$/i.test(key)) return undefined;
    if (typeof value === 'function') return undefined;
    if (value && typeof value === 'object') {
      if (seen.has(value)) return undefined;
      seen.add(value);
      if (value instanceof Set) return [...value];
      if (value instanceof Map) return [...value.entries()];
      if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return undefined;
    }
    return value;
  });
}

export class GameHistory {
  private nodes = new Map<string, HistoryNode>();
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private pending: Snapshot | null = null;
  private pendingChanged=false;
  private target: Snapshot | null = null;
  private listeners = new Set<() => void>();
  private revision = 0;
  private clock:HistoryClock;
  private limit:number;
  readonly owner:string;
  restoring = false;
  constructor(clock:HistoryClock, limit=50, owner=`history:${crypto.randomUUID()}`) {this.clock=clock;this.limit=limit;this.owner=owner;}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  version = () => this.revision;
  private emit() { this.revision++; this.listeners.forEach(listener => listener()); }
  register(name: string, node: HistoryNode) {
    let index=0; while(this.nodes.has(`${name}#${index}`)) index++;
    const id=`${name}#${index}`;
    this.nodes.set(id,node);
    if(this.target?.values.has(id)) node.restore(cloneHistoryValue(this.target.values.get(id)),performance.now()-this.target.time);
    return () => { if(this.nodes.get(id)===node) this.nodes.delete(id); if(!this.nodes.size&&!this.restoring)this.clear(); };
  }
  capture(): Snapshot {
    return { values: new Map([...this.nodes].map(([id,node]) => [id,cloneHistoryValue(node.capture())])), time:performance.now(), clock:this.clock.capture() };
  }
  begin() {
    if(this.restoring)return;
    this.commit();
    this.pending=this.capture();
    this.pendingChanged=false;
  }
  changed() { if(this.pending&&!this.restoring&&!this.pendingChanged&&signature(this.pending)!==signature(this.capture())){this.pendingChanged=true;this.emit();} }
  private hasPending() { return !!this.pending && (this.pendingChanged||signature(this.pending)!==signature(this.capture())); }
  private commit() {
    if(this.hasPending()) { this.past.push(this.pending!); if(this.past.length>this.limit)this.past.shift(); this.future=[]; }
    this.pending=null;this.pendingChanged=false;
  }
  get canUndo() { return !this.restoring&&(this.past.length>0||this.hasPending()); }
  get canRedo() { return !this.restoring&&!this.hasPending()&&this.future.length>0; }
  private async restore(snapshot: Snapshot) {
    const previousClock=this.clock.capture();
    this.restoring=true; this.target=snapshot; this.clock.clear(); this.emit();
    try {
      const elapsed=performance.now()-snapshot.time;
      await Promise.all([...this.nodes].filter(([id])=>snapshot.values.has(id)).map(([id,node])=>node.restore(cloneHistoryValue(snapshot.values.get(id)),elapsed)));
      // Allow React to restore conditional descendants before resuming their pending timers.
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      this.clock.restore(snapshot.clock);
    } catch(error) { this.clock.clear();this.clock.restore(previousClock);throw error; }
    finally { this.restoring=false; this.target=null; this.emit(); }
  }
  async undo() {
    if(!this.canUndo)return;
    this.commit(); const target=this.past.pop();if(!target)return;
    this.future.push(this.capture());try{await this.restore(target);}catch(error){this.future.pop();this.past.push(target);this.emit();throw error;}
  }
  async redo() {
    if(!this.canRedo)return;
    this.past.push(this.capture()); const target=this.future.pop();if(target)try{await this.restore(target);}catch(error){this.past.pop();this.future.push(target);this.emit();throw error;}
  }
  clear() { this.past=[];this.future=[];this.pending=null;this.pendingChanged=false;this.emit(); }
}
