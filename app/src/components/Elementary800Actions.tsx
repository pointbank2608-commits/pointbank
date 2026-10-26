import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useFeature } from '../lib/features';
import { createWordList, fetchAllWordLists } from '../lib/api';
import { bookletCards, matchingWorkbookList, workbookListItems } from '../lib/elementary800Sources';
import type { VocabularyBooklet } from '../lib/elementary800Workbook';
import type { WordList } from '../lib/types';
import AccessibleDialog from './AccessibleDialog';
import AddActivityToLesson from './AddActivityToLesson';
import WordMemoryAssignModal from './wordMemory/WordMemoryAssignModal';

export default function Elementary800Actions({ books }: { books: VocabularyBooklet[] }) {
  const { academy, profile, session } = useAuth();
  // Account switches discard the dialog, results and in-flight follow-up operations.
  return <Actions key={`${session?.user.id}:${academy?.id}:${books.map(b=>b.id).join(',')}`} books={books} academyId={academy?.id} teacherId={profile?.id} ownerId={session?.user.id}/>;
}
function Actions({ books, academyId, teacherId, ownerId }: { books: VocabularyBooklet[]; academyId?: string; teacherId?: string; ownerId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const groupOpen = useFeature('group');
  const homeworkOpen = useFeature('homework');
  const [dialog, setDialog] = useState<'save'|'lesson'|'memory'|null>(null);
  const [merged, setMerged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<WordList[]>([]);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
  const cards = bookletCards(books);
  const bookName = (book: VocabularyBooklet) => t('elementary800.listName', { pos:t(`elementary800.pos.${book.pos}`), levels:book.level });
  const name = t('elementary800.listName', {pos:books[0]?t(`elementary800.pos.${books[0].pos}`):'',levels:books.map(b=>b.level).join(', ')});
  const enabled = !!cards.length && !!ownerId && !!academyId && !!teacherId;
  async function save() {
    if (!enabled || lock.current) return;
    lock.current=true;setBusy(true);setError('');
    try {
      const lists = (await fetchAllWordLists(academyId!, 'word')).filter(list=>list.academy_id===academyId);
      const results: WordList[] = [];
      const groups = merged ? [{ name, cards }] : books.map(book=>({ name:bookName(book), cards:bookletCards([book]) }));
      for (const group of groups) {
        if (!alive.current) return;
        let list = matchingWorkbookList(lists, academyId!, group.cards);
        if (!list) {
          // Recheck names on every retry; edited lists are preserved, never overwritten.
          let nextName=group.name, suffix=2;
          while(lists.some(row=>row.name===nextName))nextName=`${group.name} (${suffix++})`;
          list = await createWordList({ academyId:academyId!, teacherId:teacherId!, classId:null, name:nextName, items:workbookListItems(group.cards) });
          lists.push(list);
        }
        results.push(list);
        if (alive.current) setSaved([...results]);
      }
    } catch { if(alive.current)setError(t('elementary800.saveError')); }
    finally { lock.current=false;if(alive.current)setBusy(false); }
  }
  return <section className="e800-reuse no-print" data-e800-actions>
    <h2>{t('elementary800.reuseTitle')}</h2>{cards.length>0&&<p className="font-bold break-words">{name} · {t('elementary800.count',{count:cards.length})}</p>}<p>{t('elementary800.reuseHint')}</p>
    <div className="flex flex-wrap gap-3">
      <button className="e800-button" disabled={!enabled} onClick={()=>{setSaved([]);setError('');setDialog('save');}}>{t('elementary800.saveLists')}</button>
      <button className="e800-button e800-button-primary" disabled={!enabled} onClick={()=>navigate('/games',{state:{quickSource:{ownerId,academyId,cards,kind:'word',name}}})}>{t('elementary800.playWords')}</button>
      {groupOpen&&<button className="e800-button" disabled={!enabled} onClick={()=>setDialog('lesson')}>{t('quick.addLesson')}</button>}
      {homeworkOpen&&<button className="e800-button" disabled={!enabled} onClick={()=>setDialog('memory')} data-wm-open title={t('wordMemory.assignHintElementary')}>{t('wordMemory.assignButton')}</button>}
    </div>
    {dialog==='memory'&&<WordMemoryAssignModal source={{type:'elementary800',name}} cards={cards} onClose={()=>setDialog(null)}/>}
    {dialog==='lesson'&&<AddActivityToLesson source={{cards,kind:'word',name}} onClose={()=>setDialog(null)}/>}
    {dialog==='save'&&<AccessibleDialog label={t('elementary800.saveLists')} onClose={()=>{if(!lock.current)setDialog(null);}}><div className="e800-controls space-y-4">
      <h2>{t('elementary800.saveLists')}</h2><p>{t('elementary800.saveHint')}</p>
      <fieldset disabled={busy} className="space-y-3">
        <label className="flex min-h-11 items-center gap-2"><input type="radio" name="workbook-save-mode" checked={!merged} onChange={()=>{setMerged(false);setSaved([]);}}/>{t('elementary800.separate')}</label>
        {books.length>1&&<label className="flex min-h-11 items-center gap-2"><input type="radio" name="workbook-save-mode" checked={merged} onChange={()=>{setMerged(true);setSaved([]);}}/>{t('elementary800.merge')}</label>}
      </fieldset>
      <ul className="break-words">{(merged?[name]:books.map(bookName)).map(label=><li key={label}>{label}</li>)}</ul>
      {!!saved.length&&<div role="status"><p>{t('elementary800.savedHint')}</p><ul className="break-words">{saved.map(list=><li key={list.id}>{list.name} · {t('elementary800.count',{count:list.items.length})}</li>)}</ul><Link className="e800-button" to="/wordlists">{t('addToWordList.openWordLists')}</Link></div>}
      {error&&<p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3"><button className="e800-button" disabled={busy} onClick={()=>setDialog(null)}>{t('common.close')}</button><button className="e800-button e800-button-primary" disabled={busy} onClick={()=>void save()}>{t(busy?'common.loading':'elementary800.confirmSave')}</button></div>
    </div></AccessibleDialog>}
  </section>;
}
