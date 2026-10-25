import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DictionaryPicker from '../DictionaryPicker';
import WordListPicker from '../WordListPicker';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { uploadGameImage } from '../../lib/api';
import { safePicture, type StudioWord } from '../../lib/worksheetStudio';
import type { FullCardItem, WordList } from '../../lib/types';

export default function WorksheetSourceEditor({words,onChange,onImport,lists,loading,activityId}:{words:StudioWord[];onChange:(words:StudioWord[])=>void;onImport:(cards:FullCardItem[],append:boolean)=>void;lists:WordList[];loading:boolean;activityId:string}) {
 const {t}=useTranslation(),{academy,session}=useAuth(),{notify}=useToast();const tr=(key:string)=>t(`worksheetStudio.${key}`);
 const [append,setAppend]=useState(false),[uploading,setUploading]=useState('');const latest=useRef(words);latest.current=words;
 const owner=useRef(`${session?.user.id}:${academy?.id}:${activityId}`);owner.current=`${session?.user.id}:${academy?.id}:${activityId}`;
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 function patch(id:string,key:keyof StudioWord,value:string|number|null) {
  onChange(latest.current.map(w=>w.id===id?{...w,...(key==='word'&&value!==w.word?{meaning:'',example:'',imageUrl:null,lineartUrl:null,patternMarked:'',soundGroup:'',sounds:'',phonemes:'',syllables:'',partner:'',partnerSounds:'',partnerPhonemes:'',parts:'',sharedImage:false,sharedLineart:false}:{}),[key]:value,...(key==='imageUrl'?{sharedImage:false,...(value!==w.imageUrl?{lineartUrl:null,sharedLineart:false}:{})}:key==='lineartUrl'?{sharedLineart:false}:{})}:w));
 }
 function move(index:number,delta:number){const next=[...words];[next[index],next[index+delta]]=[next[index+delta],next[index]];onChange(next);}
 async function upload(id:string,field:'imageUrl'|'lineartUrl',file:File) {
  if(!academy||uploading)return;const ownerAtStart=owner.current,wordAtStart=latest.current.find(w=>w.id===id)?.word;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){notify(tr('uploadFailed'),'error');return;}
  setUploading(id+field);
  try {const saved=await uploadGameImage(academy.id,file);if(alive.current&&owner.current===ownerAtStart&&latest.current.some(w=>w.id===id&&w.word===wordAtStart))patch(id,field,saved.url);}
  catch {if(alive.current)notify(tr('uploadFailed'),'error');}finally{if(alive.current)setUploading('');}
 }
 const extraFields=activityId==='rhyme'?['phonemes']:activityId==='soundSort'?['soundGroup']:activityId==='soundBoxes'?['sounds']:activityId==='wordChain'?['sounds','phonemes']:activityId==='minimalPairs'?['sounds','phonemes','partner','partnerSounds','partnerPhonemes']:activityId==='syllables'?['syllables','stress']:activityId==='morphology'?['parts']:['meaningPairs','collocations'].includes(activityId)?['partner']:[];
 return <div className="ws-source-editor">
  <p>{tr('sourceHint')}</p>
  <div className="ws-source-tools"><label><input type="radio" name="worksheet-import-mode" checked={!append} onChange={()=>setAppend(false)}/>{tr('replace')}</label><label><input type="radio" name="worksheet-import-mode" checked={append} onChange={()=>setAppend(true)}/>{tr('append')}</label></div>
  <div className="ws-source-tools"><WordListPicker variant="full" wordLists={lists.filter(l=>l.kind!=='sentence')} loading={loading} onImportFull={cards=>onImport(cards,append)}/><WordListPicker variant="full" kind="sentence" wordLists={lists.filter(l=>l.kind==='sentence')} loading={loading} onImportFull={cards=>onImport(cards,append)}/><DictionaryPicker variant="full" onImportFull={cards=>onImport(cards,append)}/></div>
  <details className="ws-source-details"><summary>{tr('editWords')} · {words.length}</summary><div className="ws-word-list">{words.map((word,index)=><fieldset className="ws-word-editor" key={word.id} data-word-editor={word.id}><legend>{index+1}. {word.word||tr('word')}</legend>
   <div className="ws-input-grid">{(['word','meaning','example','category','patternMarked',...extraFields] as (keyof StudioWord)[]).map(field=><label key={field}>{tr(field==='patternMarked'?'pattern':field)}<input type={field==='stress'?'number':'text'} min={field==='stress'?1:undefined} maxLength={field==='example'?250:200} value={String(word[field]??'')} onChange={e=>patch(word.id,field,field==='stress'?Number(e.target.value):e.target.value)}/></label>)}</div>
   <div className="ws-image-editors">{(['imageUrl','lineartUrl'] as const).map(field=><div key={field} className="ws-image-editor"><label>{tr(field==='imageUrl'?'image':'lineart')}{word[field]&&safePicture(word[field])&&<img src={word[field]!} alt="" onLoad={e=>{e.currentTarget.style.visibility='visible';}} onError={e=>{e.currentTarget.style.visibility='hidden';}}/>}</label><label>{tr(field)}<input value={word[field]||''} maxLength={2048} onChange={e=>patch(word.id,field,e.target.value||null)}/></label><label className="ws-button ws-file-button">{uploading===word.id+field?tr('uploading'):tr('upload')}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!!uploading||!academy} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(word.id,field,f);e.target.value='';}}/></label>{word[field]&&<button type="button" className="ws-button" onClick={()=>patch(word.id,field,null)}>{tr('removeImage')}</button>}</div>)}</div>
   <div className="ws-actions"><button type="button" className="ws-button" disabled={index===0} onClick={()=>move(index,-1)}>{tr('moveUp')}</button><button type="button" className="ws-button" disabled={index===words.length-1} onClick={()=>move(index,1)}>{tr('moveDown')}</button><button type="button" className="ws-button" onClick={()=>onChange(words.filter(w=>w.id!==word.id))}>{tr('remove')}</button></div>
  </fieldset>)}</div><div className="ws-actions"><button type="button" className="ws-button" disabled={words.length>=60} onClick={()=>onChange([...words,{id:crypto.randomUUID(),word:'',meaning:'',imageUrl:null,lineartUrl:null}])}>{tr('addWord')}</button><button type="button" className="ws-button" disabled={!words.length} onClick={()=>onImport([],false)}>{tr('clear')}</button></div></details>
 </div>;
}
