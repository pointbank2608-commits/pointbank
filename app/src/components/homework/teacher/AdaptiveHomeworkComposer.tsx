import {useEffect,useMemo,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {fetchCurriculumLessons,fetchStudentsOfClass,fetchWordLists} from '../../../lib/api';
import type {CurriculumLesson,Student,WordList} from '../../../lib/types';
import {contentFromLesson,contentFromList} from '../../../lib/homework/guided';
import {parsePathCards,type PathCard} from '../../../lib/learningPaths';
import HomeworkDeadlinePicker from './HomeworkDeadlinePicker';
import {formatHomeworkDeadline} from '../../../lib/homework/deadline';
import '../../../styles/homework-composer.css';
import {adaptiveCards,assignAdaptiveHomework,AdaptiveHomeworkError,homeworkParts,type AdaptiveHomeworkInput,type HomeworkPortion} from '../../../lib/homework/adaptive';

const field='min-h-12 w-full rounded-xl border border-outline-variant bg-white px-3 py-3 text-on-surface';
const button='min-h-12 rounded-full bg-primary px-5 py-3 font-bold text-white disabled:opacity-40';
export default function AdaptiveHomeworkComposer({academyId,classId,onClose,onCreated}:{academyId:string;classId:string;onClose:()=>void;onCreated:()=>void}){
 const {i18n}=useTranslation(),en=i18n.language.startsWith('en');const l=(ko:string,english:string)=>en?english:ko;
 const [lists,setLists]=useState<WordList[]>([]),[lessons,setLessons]=useState<CurriculumLesson[]>([]),[students,setStudents]=useState<Student[]>([]);
 const [source,setSource]=useState<'list'|'lesson'|'manual'>('list'),[sourceId,setSourceId]=useState(''),[text,setText]=useState('');
 const [imported,setImported]=useState<PathCard[]>([]);
 const [excluded,setExcluded]=useState(0),[portion,setPortion]=useState<HomeworkPortion>(4),[part,setPart]=useState(0),[practice,setPractice]=useState<'letters'|'recall'>('letters');
 const [selected,setSelected]=useState<string[]>([]),[title,setTitle]=useState(''),[due,setDue]=useState(''),[step,setStep]=useState(0),[approved,setApproved]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const pending=useRef<AdaptiveHomeworkInput|null>(null),[uncertain,setUncertain]=useState(false);
 useEffect(()=>{let alive=true;Promise.all([fetchWordLists(academyId,classId),fetchCurriculumLessons(academyId,classId),fetchStudentsOfClass(classId)]).then(([ws,ls,ss])=>{if(!alive)return;setLists(ws);setLessons(ls);setStudents(ss);setSelected(ss.map(s=>s.id));setLoading(false);}).catch(()=>{if(alive){setError('load');setLoading(false);}});return()=>{alive=false;};},[academyId,classId]);
 const parsed=useMemo(()=>{if(source!=='manual')return{cards:imported,valid:imported.length>0};try{return{cards:parsePathCards(text),valid:true};}catch{
  // The source may have more than 12 words. Validate each batch without discarding the remainder.
  try{const lines=text.split(/\r?\n/).filter(x=>x.trim());const cards=lines.flatMap(line=>parsePathCards(line));if(!cards.length||new Set(cards.map(c=>JSON.stringify([c.word,c.meaning]))).size!==cards.length)throw Error();return{cards,valid:true};}catch{return{cards:[],valid:false};}
 }},[text,source,imported]);
 const parts=homeworkParts(parsed.cards,portion),current=parts[part]??[];
 const sourceName=source==='manual'?l('직접 고른 단어','Selected words'):(source==='list'?lists:lessons).find(x=>x.id===sourceId)?.name||'';
 const canReview=parsed.valid&&current.length>0&&selected.length>0&&(source==='manual'||!!sourceId)&&!loading;
 function resetReview(){setApproved(false);setError('');}
 function choose(kind:typeof source,id:string){
  setSource(kind);setSourceId(id);setPart(0);setText('');setImported([]);setExcluded(0);resetReview();
  const row=(kind==='list'?lists:lessons).find(x=>x.id===id);if(!row)return;
  const material=kind==='list'?contentFromList(row as WordList):contentFromLesson(row as CurriculumLesson,lists);
  const result=adaptiveCards(material);setImported(result.cards);setExcluded(result.excluded);
 }
 async function send(){
  if(busy||(!pending.current&&!approved))return;
  if(!pending.current){
   let date:string|null=null;if(due){const d=new Date(due);if(!Number.isFinite(d.getTime())||d.getTime()<=Date.now()){setError('due');return;}date=d.toISOString();}
   pending.current={p_request:crypto.randomUUID(),p_class:classId,p_students:[...selected],p_title:(title.trim()||`${sourceName} · ${l('단어 회상 숙제','Recall homework')}`).slice(0,100),p_cards:structuredClone(current),p_practice:practice,p_portion:portion,p_due:date,p_source_kind:source,p_source_id:source==='manual'?null:sourceId};
  }
  setBusy(true);setUncertain(true);setError('');
  try{await assignAdaptiveHomework(pending.current);pending.current=null;setUncertain(false);onCreated();}
  catch(e){if(e instanceof AdaptiveHomeworkError&&e.kind!=='uncertain'){pending.current=null;setUncertain(false);setApproved(false);setError(e.kind==='missing'?'missing':e.message.includes('feature_closed')?'closed':e.message.includes('protection_changed')?'protection':'rejected');}else setError('uncertain');}
  finally{setBusy(false);}
 }
 return <section aria-label={l('필요한 만큼 배우는 숙제 만들기','Create adaptive homework')} className="space-y-5 rounded-3xl border border-outline-variant bg-white p-4 sm:p-6">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-primary">{l('맞춤 단어 숙제','Adaptive vocabulary homework')}</p><h2 className="text-2xl font-bold">{l('필요한 단어만 연습하고, 기억을 확인해요','Practise what is needed, then check what lasts')}</h2></div><button className="min-h-11 rounded-full border px-4" disabled={busy||uncertain} onClick={onClose}>{l('닫기','Close')}</button></header>
  <p>{l('목표는 뜻을 보고 영어 단어를 혼자 쓰는 것입니다. 먼저 확인한 뒤 필요한 설명·연습만 제공하고, 같은 목표로 다시 확인합니다.','The goal is to write an English word from its meaning. Try first, receive support as needed, then check the same goal.')}</p>
  {error&&<div role="alert" className="rounded-xl bg-error-container p-4 text-on-error-container">{error==='missing'?l('맞춤 숙제가 아직 서버에 준비되지 않았어요. 준비 후 다시 시도해 주세요.','Adaptive homework is not ready on the server yet.'):error==='closed'?l('학원에서 숙제 또는 개별학습 기능을 닫았어요. 설정을 확인해 주세요.','Homework or individual learning is closed for this academy.'):error==='due'?l('첫 학습 기한을 현재보다 나중으로 선택해 주세요.','Choose a future initial-learning deadline.'):error==='uncertain'?l('배정 결과를 확인하지 못했어요. 내용을 유지했으니 같은 요청으로 다시 확인해 주세요.','The assignment result is uncertain. Keep these settings and retry the same request.'):error==='load'?l('자료를 불러오지 못했어요. 닫은 뒤 다시 열어 주세요.','Could not load the materials. Close and reopen.'):error==='protection'?l('학습 보호 설정을 확인해야 해요. 관리자에게 점검을 요청해 주세요.','Learning protection needs an administrator review.'):l('배정하지 못했어요. 자료·학생·기한을 확인한 뒤 다시 승인해 주세요.','Could not assign. Review the content, students and deadline, then approve again.')}</div>}
  <fieldset disabled={busy||uncertain} className="space-y-5 disabled:opacity-70">
  {step===0?<>
   <div className="flex flex-wrap gap-2">{(['list','lesson','manual'] as const).map(s=><button type="button" key={s} aria-pressed={source===s} className="min-h-11 rounded-full border px-4 aria-pressed:bg-primary aria-pressed:text-white" onClick={()=>choose(s,'')}>{s==='list'?l('단어장에서','From a word list'):s==='lesson'?l('오늘 수업에서','From a lesson'):l('직접 입력','Enter words')}</button>)}</div>
   {source!=='manual'&&<label className="block space-y-2"><span>{source==='list'?l('단어장 선택','Word list'):l('수업 선택','Lesson')}</span><select aria-label={source==='list'?l('단어장 선택','Word list'):l('수업 선택','Lesson')} className={field} value={sourceId} onChange={e=>choose(source,e.target.value)}><option value="">{l('선택해 주세요','Choose')}</option>{(source==='list'?lists:lessons).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
   {loading&&<p role="status">{l('자료와 학생을 불러오고 있어요…','Loading materials and students…')}</p>}
   {source==='manual'&&<><label className="block space-y-2"><span>{l('단어 | 뜻 | 예문(선택)','Word | meaning | example (optional)')}</span><textarea className={field} rows={5} maxLength={12000} value={text} onChange={e=>{setText(e.target.value);setPart(0);resetReview();}} placeholder={'cat | 고양이\ndog | 개'}/></label>{text&&!parsed.valid&&<p role="alert">{l('영어 단어와 뜻을 한 줄씩 입력하고 중복된 단어·뜻을 확인해 주세요.','Enter one word and meaning per line and check duplicates.')}</p>}</>}
   {sourceId&&<p role="status">{imported.length?l(`${imported.length}단어를 가져왔어요.`,`Imported ${imported.length} words.`):l('쓸 수 있는 영어 단어와 뜻을 찾지 못했어요. 다른 자료를 선택하거나 직접 입력해 주세요.','No eligible words and meanings were found. Choose another source or enter words.')}</p>}
   {excluded>0&&<p className="text-sm">{l(`이 숙제는 영어 단어의 철자 회상용입니다. 문장·영상 등 ${excluded}개 내용은 기존 숙제 편집기로 구성할 수 있어요.`,`This is single-word spelling recall. Use the existing composer for ${excluded} sentence, video or unsupported entries.`)}</p>}
   <div className="space-y-2"><p className="font-bold">{l('한 번에 배울 분량','Words in this assignment')}</p><div className="flex flex-wrap gap-2">{([4,8] as const).map(n=><button type="button" key={n} aria-pressed={portion===n} className="min-h-11 rounded-full border px-4 aria-pressed:bg-primary aria-pressed:text-white" onClick={()=>{setPortion(n);setPart(0);resetReview();}}>{n===4?l('짧게 · 최대 4단어','Short · up to 4 words'):l('보통 · 최대 8단어','Standard · up to 8 words')}</button>)}</div><p className="text-sm text-on-surface-variant">{l('소요 시간은 학생마다 다릅니다. 계속 어려운 단어의 추가 설명·연습은 한 번으로 제한합니다.','Time varies by student. Further explanation and practice for a difficult word is limited to one additional cycle.')}</p></div>
   {parts.length>1&&<label className="block space-y-2"><span>{l(`전체 ${parsed.cards.length}단어 중 이번에 보낼 묶음`, `Choose a part from ${parsed.cards.length} words`)}</span><select aria-label={l('이번에 보낼 묶음','Part to assign')} className={field} value={part} onChange={e=>{setPart(Number(e.target.value));resetReview();}}>{parts.map((p,i)=><option key={i} value={i}>{i+1}/{parts.length} · {p.map(c=>c.word).join(', ')}</option>)}</select><p className="text-sm">{l('이번에는 선택한 묶음만 배정합니다. 나머지 묶음은 다음 숙제에서 선택할 수 있어요.','Assign the selected part now. Choose the remaining parts for a later assignment.')}</p></label>}
   <details><summary className="min-h-11 cursor-pointer font-bold">{l('학생·기한·연습 방식 조정','Adjust students, deadline and practice')}</summary><div className="mt-3 space-y-4">
    <label className="block">{l('숙제 이름 · 선택','Homework title · optional')}<input className={field} value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/></label>
    <HomeworkDeadlinePicker value={due} onChange={v=>{setDue(v);resetReview();}} en={en}/><p className="text-sm">{l('마감일은 첫 학습 안내용입니다. 이후 복습 확인은 첫 학습 완료 시점부터 이어집니다.','The deadline guides initial learning. Later reviews are scheduled from initial completion.')}</p>
    <label className="block">{l('도움받아 연습하는 방식','Supported practice')}<select aria-label={l('도움받아 연습하는 방식','Supported practice')} className={field} value={practice} onChange={e=>setPractice(e.target.value as 'letters'|'recall')}><option value="letters">{l('글자 조합','Arrange letters')}</option><option value="recall">{l('뜻을 보고 직접 쓰기','Type from meaning')}</option></select></label>
    <div className="flex flex-wrap gap-2">{students.map(s=><label key={s.id} className="flex min-h-11 items-center gap-2 rounded-full border px-3"><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,s.id]:ids.filter(id=>id!==s.id))}/>{s.name}</label>)}</div>
   </div></details>
   <p className="font-bold">{current.length}{l('단어',' words')} · {selected.length}{l('명 선택',' students selected')}</p>
   <button type="button" className={button} disabled={!canReview} onClick={()=>{setStep(1);resetReview();}}>{l('추천 숙제 확인','Review homework')}</button>
  </>:<>
   <h3 className="text-xl font-bold">{title||`${sourceName} · ${l('단어 회상 숙제','Recall homework')}`}</h3><p>{current.map(c=>`${c.word} (${c.meaning})`).join(' · ')}</p>
   <p>{l(`${selected.length}명 · ${current.length}단어 · 뜻을 보고 혼자 쓰기`,`${selected.length} students · ${current.length} words · Write from meaning`)}</p>
   <p className="text-sm">{l('도움받아 연습: ','Supported practice: ')}{practice==='letters'?l('글자 조합','Arrange letters'):l('뜻을 보고 직접 쓰기','Type from meaning')}{due?` · ${l('첫 학습 마감일','Initial deadline')}: ${formatHomeworkDeadline(due,en?'en':'ko')}`:''}</p>
   <ol aria-label={l('숙제 블록 구성','Homework blocks')} className="grid gap-3 sm:grid-cols-2">{[
    [l('먼저 확인','Try first'),l('혼자 떠올려 봅니다. 맞힌 단어는 설명과 연습을 줄입니다.','Try recalling. Known words skip repeated explanation and practice.')],
    [l('배우고 연습','Learn and practise'),l('필요한 단어만 설명·예시·짧은 연습으로 이어집니다.','Words needing support get explanation, examples and brief practice.')],
    [l('혼자 확인','Check independently'),l('단서를 줄여 직접 씁니다. 계속 어려우면 한 번만 더 배우고 확인합니다.','Write with fewer cues. Difficulty gets one additional learning cycle.')],
    [l('시간을 두고 확인','Check after a delay'),l('첫 학습을 마친 뒤 약 1일·7일 이후 다시 확인합니다.','Check again about 1 and 7 days after initial learning.')],
   ].map(([name,description],i)=><li className="rounded-2xl bg-surface-container-low p-4" key={name}><b>{i+1}. {name}</b><p className="mt-2 text-sm">{description}</p></li>)}</ol>
   <p className="text-sm text-on-surface-variant">{l('복습 간격과 분량은 초기 운영 규칙입니다. 최적 효과를 검증한 값은 아닙니다. 교사·부모가 별도로 기록할 내용은 없습니다.','Spacing and portions are initial rules, not proven optimums. Teachers and parents have no additional reporting tasks.')}</p>
   <label className="flex min-h-12 items-start gap-3 rounded-xl border p-4"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/><span>{l('학습 내용과 학생을 확인했습니다. 분량 안의 맞춤 설명·연습과 이후 복습 확인까지 이 계획으로 진행합니다.','I reviewed the content and students and approve the bounded adaptive practice and later review checks.')}</span></label>
   <div className="flex flex-wrap gap-3"><button type="button" className="min-h-12 rounded-full border px-5" onClick={()=>{setStep(0);resetReview();}}>{l('수정','Edit')}</button><button type="button" className={button} disabled={!approved} onClick={()=>void send()}>{l('이 계획으로 숙제 배정','Assign this homework plan')}</button></div>
  </>}
  </fieldset>
  {uncertain&&<button type="button" className={button} disabled={busy} onClick={()=>void send()}>{busy?l('배정 확인 중…','Confirming…'):l('같은 요청으로 배정 확인','Confirm the same request')}</button>}
 </section>;
}
