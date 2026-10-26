import NumberRangeFill from './NumberRangeFill';
import GameSourcePicker from './GameSourcePicker';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { guideCatalogue, type GuideKind } from '../lib/gameGuide';
import { isFreeTierGame } from '../lib/gameCatalog';
import { useRecoverableField } from '../lib/useRecoverableField';
import type { FullCardItem } from '../lib/types';
import AccessibleDialog from './AccessibleDialog';

export const guideButton = 'min-h-12 rounded-xl border border-outline-variant bg-white px-5 py-3 text-base font-bold text-deep-navy focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40';
const lines=(v:string)=>v.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
export default function GameCreateButton() {
  const {t}=useTranslation();const {session,academy,hasFullAccess,isStaff}=useAuth();const navigate=useNavigate();
  const [open,setOpen]=useState(false);const [kind,setKind]=useState<GuideKind|null>(null);const [ready,setReady]=useState(false);
  const [text,setText]=useRecoverableField(`game-create:${kind||'word'}`);const [cards,setCards]=useState<FullCardItem[]>([]);
  useEffect(()=>{setOpen(false);setKind(null);setCards([]);},[session?.user.id,academy?.id]);
  if(!isStaff)return null;
  const close=()=>{setOpen(false);setKind(null);setReady(false);setCards([]);};
  const parse=()=>text.split(/\r?\n/).filter(s=>s.trim()).map((line,i)=>{const [word,...meaning]=line.split(/\t|\s*\|\s*/);return{id:`input-${i}`,word:word.trim(),meaning:meaning.join(' | ').trim(),imageUrl:null};});
  return <><button className={`${guideButton} bg-primary! text-white!`} onClick={()=>setOpen(true)}>{t('guide.create')}</button>{open&&<AccessibleDialog label={t('guide.title')} onClose={close}>
    <div className="space-y-5 p-5 sm:p-8" data-game-create>
      <header className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-2xl font-black">{t(!kind?'guide.title':ready||kind==='sample'?'guide.chooseGame':'guide.chooseContent')}</h2><p className="mt-2 text-on-surface-variant">{t('guide.intro')}</p></div><button className={`${guideButton} shrink-0 whitespace-nowrap`} onClick={close}>{t('guide.close')}</button></header>
      {!kind?<div className="grid gap-4 sm:grid-cols-2">{(['sample','word','sentence','names','numbers'] as const).map((k,i)=><button key={k} className={`${guideButton} min-h-36 text-left ${k==='sample'?'border-primary bg-sky-50!':''}`} onClick={()=>{setKind(k);setCards([]);}}><span aria-hidden className="mb-2 block text-3xl">{['▶','Aa','💬','👥','🔢'][i]}</span><span className="block text-xl">{t(`guide.${k}`)}</span><span className="mt-2 block font-normal text-on-surface-variant">{t(`guide.${k}Hint`)}</span></button>)}</div>:!ready&&kind!=='sample'?<>
        {kind==='numbers'?<NumberRangeFill existingLabels={lines(text)} onFill={(labels,replace)=>setText((replace?labels:[...lines(text),...labels]).join('\n'))} />:<GameSourcePicker kind={kind} onPick={selected=>{setCards(selected);setReady(true);}} />}
        <label className="block font-bold">{t(kind==='names'?'guide.nameColumn':kind==='numbers'?'guide.numberColumn':'guide.paste')}<textarea className="mt-2 min-h-44 w-full rounded-xl border p-3 font-normal" value={text} onChange={e=>setText(e.target.value)} placeholder={kind==='word'?'apple | 사과\nbanana | 바나나':kind==='sentence'?'I like apples.\nShe has a cat.':t('flow.participant',{n:1})+'\n'+t('flow.participant',{n:2})}/></label><p>{t('guide.pasteHint')}</p>
        <button className={`${guideButton} bg-primary! text-white!`} disabled={!text.trim()} onClick={()=>{setCards(parse());setReady(true);}}>{t('guide.next')}</button>

      </>:<><p>{t(`guide.${kind}`)}{cards.length?` · ${cards.length}`:''}</p><div className="grid max-h-[55dvh] gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{guideCatalogue(kind).map(g=>{const locked=!hasFullAccess&&!isFreeTierGame(g.type);return <button key={g.type} className={`${guideButton} text-left`} disabled={locked} onClick={()=>{navigate(g.path,{state:{guideLaunch:{kind,cards,ownerId:session?.user.id,academyId:academy?.id}}});close();}}>{g.cover&&<img className="mb-2 h-24 w-full rounded-lg object-cover" src={g.cover} alt="" loading="lazy"/>}<span className="block text-lg">{t(g.nameKey)}</span><span className="block font-normal">{t(g.descKey)}</span>{locked&&<span>{t('guide.locked')}</span>}</button>;})}</div></>}
      {kind&&<button className={guideButton} onClick={()=>{if(ready){setReady(false);setCards([]);}else setKind(null);}}>{t('guide.back')}</button>}
      <p className="text-sm text-on-surface-variant">{t('guide.temporary')}</p>
    </div>
  </AccessibleDialog>}</>;
}
