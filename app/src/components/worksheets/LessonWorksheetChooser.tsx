import { useEffect, useState } from 'react';
import { fetchAllWordLists } from '../../lib/api';
import { loadWordBank } from '../../lib/wordBankCache';
import { pickRecommended, toCard, topicEntries } from '../../lib/topicWorksheets';
import { WORKSHEET_TAB_CATALOG } from '../../lib/materialsCatalog';
import type { FullCardItem, WordBankEntry, WordList } from '../../lib/types';
import WordListPicker from '../WordListPicker';
import WorksheetTypePreview from '../WorksheetTypePreview';
import { useTranslation } from 'react-i18next';

export default function LessonWorksheetChooser({ topicMode, lessonWords, academyId, onAdd }: {
  topicMode: boolean;
  lessonWords: FullCardItem[];
  academyId: string;
  onAdd: (tab: string, words: FullCardItem[] | undefined, topic?: string) => void;
}) {
  const {t} = useTranslation();
  const [bank,setBank] = useState<WordBankEntry[]>([]);
  const [lists,setLists] = useState<WordList[]>([]);
  const [loading,setLoading] = useState(true);
  const [topic,setTopic] = useState('');
  const [selected,setSelected] = useState<FullCardItem[]>();
  const [direct,setDirect] = useState('');
  const [tab,setTab] = useState(topicMode ? 'match' : 'list');
  useEffect(()=>{
    let live = true;
    if (topicMode) void loadWordBank().then(rows=>{if(live)setBank(rows);});
    else void fetchAllWordLists(academyId,'word').then(rows=>{if(live)setLists(rows);}).catch(()=>{}).finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  },[academyId,topicMode]);
  const categories=[...new Set(bank.map(entry=>entry.category).filter((entry):entry is string=>Boolean(entry)))];
  const words=selected??(topicMode?[]:lessonWords);
  const format=WORKSHEET_TAB_CATALOG.find(item=>item.tab===tab);
  const title=format?t(`materials.worksheet.${format.labelKey}`):'';
  return <div className="space-y-4">
    {topicMode ? <>
      <label className="block">주제 <select aria-label="주제" value={topic} onChange={event=>{
        const next=event.target.value;
        setTopic(next);
        setSelected(pickRecommended(topicEntries(bank,next,'all'),9,1).map(toCard));
      }}>
        <option value="">주제를 선택하세요</option>
        {categories.map(category=><option key={category}>{category}</option>)}
      </select></label>
      {topic&&<div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto" aria-label="주제 단어">
        {topicEntries(bank,topic,'all').map(entry=>{
          const checked=words.some(word=>word.id===entry.id);
          return <label className="rounded-lg border p-2" key={entry.id}><input type="checkbox" checked={checked} onChange={()=>
            setSelected(checked?words.filter(word=>word.id!==entry.id):[...words,toCard(entry)])}/> {entry.word}</label>;
        })}
      </div>}
    </> : <>
      {lessonWords.length>0&&<button type="button" className="pc-button" onClick={()=>setSelected(undefined)}>수업 단어장 사용 · {lessonWords.length}개</button>}
      <WordListPicker variant="full" wordLists={lists} loading={loading} onImportFull={setSelected}/>
      <label className="block">직접 입력
        <textarea className="block w-full rounded-lg border p-2" value={direct} placeholder="apple | 사과" onChange={event=>{
          const text=event.target.value;
          setDirect(text);
          setSelected(text.split(/\r?\n/).flatMap((line,index)=>{
            const [word,meaning='']=line.split('|').map(part=>part.trim());
            return word?[{id:`typed-${index}`,word,meaning,imageUrl:null}]:[];
          }));
        }}/>
      </label>
    </>}
    <label className="block">워크시트 양식 <select aria-label="워크시트 양식" value={tab} onChange={event=>setTab(event.target.value)}>
      {WORKSHEET_TAB_CATALOG.map(item=><option key={item.tab} value={item.tab}>{t(`materials.worksheet.${item.labelKey}`)}</option>)}
    </select></label>
    {words.length>0&&<WorksheetTypePreview tab={tab} words={words} title={title} compact/>}
    <button type="button" className="rounded-lg bg-primary px-4 py-2 font-bold text-white" disabled={!words.length}
      onClick={()=>onAdd(tab,selected,topic||undefined)}>수업에 추가</button>
  </div>;
}
