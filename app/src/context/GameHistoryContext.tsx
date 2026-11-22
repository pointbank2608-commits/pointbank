import {createContext,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore,type DependencyList,type EffectCallback,type ReactNode,type Dispatch,type SetStateAction} from 'react';
import {GameHistory,type HistoryNode} from '../lib/gameHistory';
import {gameClock} from '../lib/gameClock';

const Context=createContext<GameHistory|null>(null);
export const useGameHistory=()=>useContext(Context);
export function GameHistoryBoundary({children}:{children:ReactNode}) {
  return useGameHistory()?<>{children}</>:<GameHistoryProvider>{children}</GameHistoryProvider>;
}
export function GameHistoryProvider({children}:{children:ReactNode}) {
  const history=useRef<GameHistory|null>(null);
  if(!history.current){const owner=crypto.randomUUID();history.current=new GameHistory(gameClock.history(owner),50,owner);}
  useEffect(()=>{const owner=history.current!.owner;return()=>gameClock.releaseOwner(owner);},[]);
  return <Context.Provider value={history.current}>{children}</Context.Provider>;
}
export function useGameHistoryView() {
  const history=useGameHistory();
  useSyncExternalStore(history?.subscribe??(()=>()=>{}),history?.version??(()=>0));
  return history;
}
export function useGameHistorySnapshot<T>(name:string,capture:()=>T,restore:(value:T,elapsed:number)=>void|Promise<void>) {
  const history=useGameHistory();
  const latest=useRef({capture,restore});latest.current={capture,restore};
  useLayoutEffect(()=>history?.register(name,{capture:()=>latest.current.capture(),restore:(value,elapsed)=>latest.current.restore(value as T,elapsed)} as HistoryNode),[history,name]);
  useLayoutEffect(()=>{history?.changed();});
}
/** Preserve imperative timers and derived boards when restoring their captured state. */
export function useGameHistoryEffect(effect:EffectCallback,deps?:DependencyList,synchronize=false,name='effect') {
  const history=useGameHistory(),cleanup=useRef<ReturnType<EffectCallback>>(undefined);
  const binding=useHistoryBinding(name,null);
  const scope=()=>history?`${history.owner}:${binding.id()}`:null;
  const clear=()=>{const id=scope();if(id)gameClock.clearScope(id);cleanup.current?.();cleanup.current=undefined;};
  useEffect(()=>{
    if(history?.restoring&&!synchronize)return;
    clear();const id=scope();cleanup.current=id?gameClock.withScope(id,effect):effect();
  },deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>clear,[]); // eslint-disable-line react-hooks/exhaustive-deps
}
export function useGameHistoryClock() {
  const history=useGameHistory();
  return useMemo(()=>history?gameClock.forOwner(history.owner):gameClock,[history]);
}
// A timer captured in an earlier round may outlive that round's React mount. Route its
// setters/logic refs to the restored mount, without retaining DOM nodes or React internals.
const bindings=new WeakMap<GameHistory,Map<string,{token:object;value:unknown}>>();
function useHistoryBinding<T>(name:string,value:T) {
  const history=useGameHistory(),slot=useRef<string|null>(null),token=useRef({}),local=useRef(value);
  local.current=value;
  useLayoutEffect(()=>{
    if(!history)return;
    let map=bindings.get(history);if(!map){map=new Map();bindings.set(history,map);}
    let index=0;while(map.has(`${name}#${index}`))index++;
    const id=`${name}#${index}`;slot.current=id;const own=token.current;
    map.set(id,{token:own,value:local.current});
    return()=>{if(map.get(id)?.token===own)map.delete(id);};
  },[history,name]);
  return useRef({
    get:()=>{const item=history&&slot.current?bindings.get(history)?.get(slot.current):undefined;return item?item.value as T:local.current;},
    id:()=>slot.current??name,
  }).current;
}
export function useGameHistoryState<T>(name:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>] {
  const [value,setValue]=useState(initial),binding=useHistoryBinding(name,setValue);
  const dispatch=useRef<Dispatch<SetStateAction<T>>>(next=>binding.get()(next)).current;
  return [value,dispatch];
}
export function useGameHistoryRef<T>(name:string,initial:T):{current:T} {
  const value=useRef(initial),binding=useHistoryBinding(name,value);
  return useRef({get current(){return binding.get().current;},set current(next:T){binding.get().current=next;}}).current;
}
/** Random boards must return with the same choices when a round is revisited. Dependencies are game data. */
export function useGameHistoryMemo<T>(name:string,factory:()=>T,deps:DependencyList):T {
  const key=JSON.stringify(deps);
  const [saved,setSaved]=useGameHistoryState(name,()=>({key,value:factory()}));
  const value=saved.key===key?saved:{key,value:factory()};
  if(value!==saved)setSaved(value);
  useGameHistorySnapshot('memo:'+name,()=>value,snapshot=>setSaved(snapshot));
  return value.value;
}
export function captureGameRef<T>(value:T,callback=false):{value:T}|null {
  if(typeof value==='function'&&!callback)return null;
  if(value&&typeof value==='object') {
    if(typeof Node!=='undefined'&&value instanceof Node)return null;
    if('engine' in value||'canvas' in value||'play' in value||'send' in value||'disconnect' in value)return null;
  }
  return {value};
}
export function restoreGameRef<T>(ref:{current:T},snapshot:{value:T}|null,elapsed=0,timestamp=false) {
  if(snapshot)ref.current=timestamp&&typeof snapshot.value==='number'?(snapshot.value+elapsed) as T:snapshot.value;
}
