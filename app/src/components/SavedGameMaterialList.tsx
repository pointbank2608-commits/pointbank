import { useTranslation } from 'react-i18next';
import { isSentenceList } from '../lib/gameWorkspace';
import type { WordList } from '../lib/types';

/** The same saved materials stay visible even when this game cannot use them. */
export default function SavedGameMaterialList({lists,value,onChange,canUse,wordOnly,loading}: {lists:WordList[];value:string;onChange:(id:string)=>void;canUse:(list:WordList)=>boolean;wordOnly:boolean;loading:boolean}) {
  const {i18n}=useTranslation();const text=(ko:string,en:string)=>i18n.language.startsWith('en')?en:ko;
  return <div className="space-y-2" data-saved-game-materials>
    {wordOnly&&<p className="text-sm font-bold">{text('이 게임은 단어장만 사용할 수 있어요.','This game only supports word lists.')}</p>}
    {loading&&<p role="status">{text('자료를 불러오는 중이에요.','Loading your lists…')}</p>}
    {!loading&&!lists.length&&<p>{text('저장한 자료가 없어요. 게임설정에서 직접 입력할 수 있어요.','No saved lists. You can enter items in Game settings.')}</p>}
    {lists.map(list=>{const available=canUse(list);return <button type="button" key={list.id} disabled={!available} aria-pressed={value===list.id} onClick={()=>onChange(list.id)}
      className={`flex min-h-14 w-full items-center gap-2 rounded-xl border p-3 text-left focus-visible:outline-4 focus-visible:outline-primary ${value===list.id?'border-primary bg-sky-50':'border-outline-variant bg-white'} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500`}>
      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${available?'bg-lime-100 text-lime-900':'bg-slate-200 text-slate-600'}`}>{text(available?'사용 가능':'사용 불가',available?'Available':'Unavailable')}</span>
      <span className="min-w-0 flex-1 break-words"><strong>{list.name}</strong><span className="block text-xs">{text(isSentenceList(list)?'문장 모음':'단어장',isSentenceList(list)?'Sentences':'Words')} · {list.items.length}{text('개',' items')}</span></span>
      {value===list.id&&<span aria-label={text('현재 선택','Selected')} className="font-extrabold text-primary">✓</span>}
    </button>;})}
  </div>;
}
