import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { fetchAllWordLists, fetchClasses, fetchStudentsOfClass } from '../lib/api';
import { wordListToCards } from '../lib/gameFromWords';
import type { ClassRow, FullCardItem, Student, WordList } from '../lib/types';

const button='min-h-12 rounded-xl border border-outline-variant bg-white px-4 py-3 font-bold text-deep-navy focus-visible:outline-4 focus-visible:outline-primary disabled:opacity-40';
type Kind='word'|'sentence'|'names';
export default function GameSourcePicker({kind,onPick,onDirect,canUse}: {
  kind:Kind;
  onPick:(cards:FullCardItem[],list?:WordList)=>void|Promise<void>;
  onDirect?:()=>void;
  canUse?:(list:WordList)=>string|null;
}) {
  const {t}=useTranslation();const {academy,session}=useAuth();
  const [open,setOpen]=useState(false);const [lists,setLists]=useState<WordList[]>([]);const [classes,setClasses]=useState<ClassRow[]>([]);
  const [classId,setClassId]=useState('');const [students,setStudents]=useState<Student[]>([]);const [selected,setSelected]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);const [failed,setFailed]=useState(false);const [retry,setRetry]=useState(0);const [busy,setBusy]=useState(false);
  const identity=`${session?.user.id}:${academy?.id}:${kind}`;
  const currentIdentity=useRef(identity);currentIdentity.current=identity;
  const [loadedIdentity,setLoadedIdentity]=useState('');const [studentClass,setStudentClass]=useState('');
  useEffect(()=>{setOpen(false);setLists([]);setClasses([]);setClassId('');setStudents([]);setSelected([]);setFailed(false);setBusy(false);},[identity]);
  useEffect(()=>{
    if(!open||!academy?.id||!session?.user.id)return;
    let active=true;setLoading(true);setFailed(false);setLoadedIdentity('');setLists([]);setClasses([]);
    const request=kind==='names'?fetchClasses(academy.id):fetchAllWordLists(academy.id,'all');
    void request.then(rows=>{if(!active)return;if(kind==='names')setClasses((rows as ClassRow[]).filter(c=>c.academy_id===academy.id));else setLists((rows as WordList[]).filter(l=>l.academy_id===academy.id&&(l.kind||'word')===kind));setLoadedIdentity(identity);}).catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[open,identity,retry,academy?.id,session?.user.id,kind]);
  useEffect(()=>{
    setStudents([]);setSelected([]);setStudentClass('');
    if(!open||kind!=='names'||!classId||loadedIdentity!==identity||!classes.some(c=>c.id===classId))return;
    let active=true;setLoading(true);setFailed(false);
    void fetchStudentsOfClass(classId).then(rows=>{if(!active)return;const own=rows.filter(s=>s.academy_id===academy?.id&&s.class_id===classId);setStudents(own);setSelected(own.map(s=>s.id));setStudentClass(classId);}).catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[classId,open,kind,identity,loadedIdentity,classes,academy?.id,retry]);
  async function pick(cards:FullCardItem[],list?:WordList){
    const owner=identity;if(busy||loadedIdentity!==identity)return;
    setBusy(true);setFailed(false);
    try{await onPick(structuredClone(cards),list?structuredClone(list):undefined);if(currentIdentity.current===owner)setOpen(false);}
    catch{if(currentIdentity.current===owner)setFailed(true);}
    finally{if(currentIdentity.current===owner)setBusy(false);}
  }
  const label=t(kind==='word'?'source.words':kind==='sentence'?'source.sentences':'source.class');
  return <section className="space-y-3 rounded-2xl border border-primary/20 bg-sky-50 p-4" aria-label={t('source.choose')} data-game-source-picker>
    <h3 className="text-lg font-bold">{t('source.choose')}</h3>
    <div className="flex flex-wrap gap-3"><button type="button" className={`${button} ${open?'border-primary':''}`} aria-expanded={open} disabled={busy} onClick={()=>setOpen(v=>!v)}>{label}</button><button type="button" className={button} disabled={busy} onClick={()=>{setOpen(false);onDirect?.();}}>{t('guide.direct')}</button></div>
    {open&&<div className="space-y-3" aria-busy={loading||busy}>
      {failed&&<p role="alert">{t('guide.failed')} <button type="button" className={button} onClick={()=>setRetry(n=>n+1)}>{t('guide.retry')}</button></p>}
      {kind==='names'&&loadedIdentity===identity&&<><label className="block font-bold">{t('source.chooseClass')}<select className="ml-2 max-w-full rounded-xl border bg-white p-3" value={classId} disabled={busy} onChange={e=>setClassId(e.target.value)}><option value="">{t('source.chooseClass')}</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {!classes.length&&!loading&&<p>{t('source.noClasses')}</p>}
        {studentClass===classId&&!!classId&&!loading&&<><p>{t('source.attendance')}</p><div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{students.map(s=><label key={s.id} className="flex min-h-12 items-center gap-3 rounded-xl bg-white p-3"><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id))}/>{s.name}</label>)}</div>{!students.length&&<p>{t('source.noStudents')}</p>}
          <button type="button" className={`${button} bg-primary! text-white!`} disabled={!selected.length||busy} onClick={()=>void pick(students.filter(s=>selected.includes(s.id)).map(s=>({id:s.id,word:s.name,meaning:'',imageUrl:null})))}>{t('source.useStudents',{count:selected.length})}</button></>}
        <p className="text-sm">{t('source.rosterHint')}</p></>}
      {kind!=='names'&&loadedIdentity===identity&&!loading&&<div className="grid gap-2 sm:grid-cols-2">{lists.length?lists.map(list=>{const reason=canUse?.(list);return <div key={list.id}><button type="button" className={`${button} w-full text-left`} disabled={busy||!!reason||!list.items.length} onClick={()=>void pick(wordListToCards(list),list)}>{list.name} · {t('quick.items',{count:list.items.length})}</button>{reason&&<p className="mt-1 text-sm">{reason}</p>}</div>;}):<p>{t(kind==='word'?'source.noWords':'source.noSentences')}</p>}</div>}
      {loading&&<p role="status">{t('common.loading')}</p>}
    </div>}
  </section>;
}
