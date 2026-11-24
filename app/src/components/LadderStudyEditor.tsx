import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ladderStudyCards } from '../lib/ladderStudy';
import { wordListToCards } from '../lib/gameFromWords';
import { isSentenceList } from '../lib/gameWorkspace';
import type { FullCardItem, LadderFace, LadderStudy, WordList } from '../lib/types';
import GameImagePicker from './GameImagePicker';

export default function LadderStudyEditor({study, lists, academyId, onChange}: {
  study: LadderStudy; lists: WordList[]; academyId: string; onChange: (next: LadderStudy) => void;
}) {
  const {i18n} = useTranslation();
  const en = i18n.language.startsWith('en');
  const [editing, setEditing] = useState<string | null>(null);
  const faces: Record<LadderFace,string> = {word:en?'Word':'영어 단어', meaning:en?'Meaning':'뜻', imageUrl:en?'Picture':'그림'};
  const ready = ladderStudyCards(study).length;
  const field = 'block w-full min-h-11 rounded-xl border border-outline-variant bg-white p-2';
  function editCard(id: string, patch: Partial<FullCardItem>) {
    onChange({...study, cards:study.cards.map(card => card.id === id ? {...card,...patch} : card)});
  }
  return <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
    <label className="block font-bold">{en?'Word list':'단어장'}
      <select aria-label={en?'Word list':'단어장'} className={field} value={lists.some(list=>list.id===study.listId) ? study.listId : ''} onChange={event=>{
        const list = lists.find(list => list.id === event.target.value);
        if (list) { setEditing(null); onChange({...study, cards:wordListToCards(list), listId:list.id, listName:list.name, listVersion:list.updated_at}); }
      }}>
        <option value="" disabled>{study.listName || (en?'Current pairs':'현재 단어 짝')}</option>
        {lists.filter(list=>!isSentenceList(list)).map(list=><option key={list.id} value={list.id}>{list.name}</option>)}
      </select>
    </label>
    <div className="grid grid-cols-2 gap-3">{(['from','to'] as const).map(side=><label key={side} className="font-bold">
      {side==='from' ? (en?'Start':'출발 칸') : (en?'Destination':'도착 칸')}
      <select className={field} value={study[side]} onChange={event=>{
        const face = event.target.value as LadderFace;
        const other = side === 'from' ? 'to' : 'from';
        onChange({...study,[side]:face,[other]:face===study[other] ? study[side] : study[other]});
      }}>{Object.entries(faces).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    </label>)}</div>
    <p role="status" className="text-sm">{en ? `${ready} playable pairs` : `출제 가능 ${ready}쌍`}{ready<study.cards.length && (en?' · Missing or repeated faces are skipped.':' · 빈칸이 있거나 표시가 겹치는 짝은 건너뛰어요.')}</p>
    <details><summary className="cursor-pointer font-bold">{en?'Edit pairs':'단어 짝 편집'}</summary>
      <div className="mt-2 space-y-2">{study.cards.map((card,i)=><div key={card.id} className="rounded-xl bg-white p-2">
        <button type="button" className="min-h-11 w-full text-left font-semibold" aria-expanded={editing===card.id} onClick={()=>setEditing(editing===card.id?null:card.id)}>{i+1}. {card.word || '…'} · {card.meaning || '…'}</button>
        {editing===card.id && <div className="space-y-2">
          {(['word','meaning'] as const).map(face=><label key={face} className="block">{faces[face]}<input className={field} value={card[face]} onChange={e=>editCard(card.id,{[face]:e.target.value})}/></label>)}
          <GameImagePicker academyId={academyId} value={card.imageUrl} onChange={imageUrl=>editCard(card.id,{imageUrl})}/>
          <button type="button" className="min-h-11 text-error" onClick={()=>onChange({...study,cards:study.cards.filter(row=>row.id!==card.id)})}>{en?'Remove pair':'이 짝 삭제'}</button>
        </div>}
      </div>)}</div>
      <button type="button" className="mt-2 min-h-11 rounded-xl bg-white px-3 font-bold" onClick={()=>{
        const card = {id:crypto.randomUUID(),word:'',meaning:'',imageUrl:null};
        onChange({...study,cards:[...study.cards,card]}); setEditing(card.id);
      }}>{en?'Add pair':'단어 짝 추가'}</button>
    </details>
  </div>;
}
