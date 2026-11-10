import {useMemo, useSyncExternalStore} from 'react';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../context/AuthContext';

const changeEvent='classbank:game-favorites';
const fallback=new Map<string,string>();
function subscribe(listener:()=>void){
  window.addEventListener('storage',listener);
  window.addEventListener(changeEvent,listener);
  return ()=>{
    window.removeEventListener('storage',listener);
    window.removeEventListener(changeEvent,listener);
  };
}
function read(key:string){
  if(fallback.has(key))return fallback.get(key)!;
  try{return localStorage.getItem(key)??'[]';}catch{return '[]';}
}
function parse(value:string):Set<string>{
  try{
    const ids:unknown=JSON.parse(value);
    return new Set(Array.isArray(ids)?ids.filter((id):id is string=>typeof id==='string'):[]);
  }catch{return new Set();}
}
export function useGameFavorites(){
  const {isStaff,session}=useAuth();
  const key=isStaff&&session?.user.id?`classbank.game-favorites.v1:${session.user.id}`:null;
  const snapshot=useSyncExternalStore(subscribe,()=>key?read(key):'[]',()=> '[]');
  const ids=useMemo(()=>parse(snapshot),[snapshot]);
  function toggle(id:string){
    if(!key)return;
    const next=parse(read(key));
    if(next.has(id))next.delete(id);else next.add(id);
    const value=JSON.stringify([...next]);
    try{localStorage.setItem(key,value);fallback.delete(key);}catch{fallback.set(key,value);}
    window.dispatchEvent(new Event(changeEvent));
  }
  return {enabled:!!key,ids,toggle};
}

export function GameFavoriteButton({name,selected,onToggle}:{name:string;selected:boolean;onToggle:()=>void}){
  const {i18n}=useTranslation();
  const en=i18n.resolvedLanguage?.startsWith('en');
  const label=en?`${name} favorite`:`${name} 즐겨찾기`;
  const action=en?(selected?'Remove from favorites':'Add to favorites'):(selected?'즐겨찾기 해제':'즐겨찾기 추가');
  return <button type="button" title={action} aria-label={label} aria-pressed={selected} onClick={onToggle}
    className={`absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full border shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected?'border-amber-300 bg-amber-100 text-amber-800':'border-outline-variant bg-white text-deep-navy hover:bg-surface-container'}`}>
    <span aria-hidden="true" className="text-2xl leading-none">{selected?'★':'☆'}</span>
  </button>;
}
