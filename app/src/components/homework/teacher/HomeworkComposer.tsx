import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {fetchCurriculumLessons,fetchCurriculumLessonById,fetchWordLists,fetchStudentsOfClass,fetchGameTemplateById} from '../../../lib/api';
import type {CurriculumLesson,FullCardItem,GameTemplate,Student,WordList} from '../../../lib/types';
import {effectiveSlides} from '../../../lib/lessonSlides';
import {assignDraft} from '../../../lib/homework/blockApi';
import type {HomeworkDraft} from '../../../lib/homework/blocks';
import type {HwItemDraft} from '../../../lib/homework/types';
import {buildGuidedPractice,contentFromLesson,contentFromList,mergeLearningContent,splitLearningContent,type LearningSource,type PracticeGoal} from '../../../lib/homework/guided';
import AccessibleDialog from '../../AccessibleDialog';
import HomeworkPreview from './HomeworkPreview';
import '../../../styles/homework-composer.css';

type State={mode:'lesson'|'list'|null;sourceId:string;excluded:string[];edits:Record<string,{word:string;meaning:string}>;videos:string[];goal:PracticeGoal;portion:number;part:number;title:string;due:string;everyone:boolean;students:string[]};
type Receipt={fingerprint:string;request:string;draft:HomeworkDraft;result?:{id:string;code:string}};
const empty=():State=>({mode:null,sourceId:'',excluded:[],edits:{},videos:[],goal:'memory',portion:20,part:0,title:'',due:'',everyone:true,students:[]});
function validRecovery(value:unknown):value is State{
 if(!value||typeof value!=='object')return false;const s=value as State;
 return [null,'lesson','list'].includes(s.mode)&&typeof s.sourceId==='string'&&typeof s.title==='string'&&typeof s.due==='string'&&typeof s.everyone==='boolean'
  &&['review','memory','speaking'].includes(s.goal)&&[0,10,20].includes(s.portion)&&Number.isInteger(s.part)&&s.part>=0
  &&[s.excluded,s.videos,s.students].every(a=>Array.isArray(a)&&a.every(v=>typeof v==='string'))&&!!s.edits&&typeof s.edits==='object'
  &&Object.values(s.edits).every(v=>v&&typeof v.word==='string'&&typeof v.meaning==='string');
}
export default function HomeworkComposer({academyId,ownerId,classId,className,initialLessonId,initialCards,initialTitle,initialMode,onClose,onEdit,onCreated,onLegacy}:{
 academyId:string;ownerId:string;classId:string;className:string;initialLessonId?:string;initialCards?:FullCardItem[];initialTitle?:string;initialMode?:'lesson'|'list';
 onClose:()=>void;onEdit:(items:HwItemDraft[],title:string,students:string[]|null,due:string)=>void;onCreated:(result:{id:string;code:string})=>void;onLegacy:()=>void;
}){
 const {i18n}=useTranslation(),en=i18n.language.startsWith('en');const l=useCallback((ko:string,english:string)=>en?english:ko,[en]);
 const cache=`classbank.hw.guided.v1.${ownerId}.${academyId}.${classId}`;
 const [state,setState]=useState<State>(()=>{
  try{const saved=JSON.parse(localStorage.getItem(cache)||'null');if(saved?.version===1&&validRecovery(saved.state)&&(!initialLessonId||saved.state.sourceId===initialLessonId)&&(!initialMode||saved.state.mode===initialMode)&&!initialCards?.length)return saved.state;}catch{/* malformed recovery never changes server data */}
  return {...empty(),mode:initialLessonId?'lesson':initialCards?.length?'list':initialMode||null,goal:initialLessonId||initialMode==='lesson'?'review':'memory',sourceId:initialLessonId||'',title:initialTitle||''};
 });
 const patch=(next:Partial<State>)=>setState(old=>({...old,...next}));
 const [step,setStep]=useState(0),[lessons,setLessons]=useState<CurriculumLesson[]>([]),[lists,setLists]=useState<WordList[]>([]),[templates,setTemplates]=useState<GameTemplate[]>([]),[students,setStudents]=useState<Student[]>([]),[repeatIntent,setRepeatIntent]=useState(0);
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(false),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[visible,setVisible]=useState(20),[preview,setPreview]=useState<PracticeGoal|null>(null);
 const [templateError,setTemplateError]=useState(false),[templateLoading,setTemplateLoading]=useState(false);
 const receipt=useRef<Receipt|null>(null),receipts=useRef<Receipt[]>([]),lock=useRef(false),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(cache)||'null');receipt.current=saved?.receipt||null;receipts.current=Array.isArray(saved?.receipts)?saved.receipts:receipt.current?[receipt.current]:[];}catch{/* recovery optional */}},[cache]);
 useEffect(()=>{try{localStorage.setItem(cache,JSON.stringify({version:1,state,receipt:receipt.current,receipts:receipts.current}));}catch{/* keeping the editor usable when storage is full */}},[cache,state,repeatIntent]);
 useEffect(()=>{let active=true;setLoading(true);setLoadError(false);
  Promise.all([fetchCurriculumLessons(academyId,classId),fetchWordLists(academyId,classId,'all'),fetchStudentsOfClass(classId)]).then(async([ls,wl,st])=>{
   if(initialLessonId&&!ls.some(r=>r.id===initialLessonId)){const extra=await fetchCurriculumLessonById(initialLessonId);if(extra?.academy_id===academyId&&(!extra.class_id||extra.class_id===classId))ls=[extra,...ls];}
   if(active){setLessons(ls);setLists(wl);setStudents(st);}
  }).catch(()=>{if(active)setLoadError(true);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[academyId,classId,initialLessonId,revision]);
 const lesson=state.mode==='lesson'?lessons.find(row=>row.id===state.sourceId):undefined;
 useEffect(()=>{let active=true;setTemplates([]);setTemplateError(false);const ids=lesson?[...new Set(effectiveSlides(lesson).flatMap(s=>s.kind==='game'&&s.templateId?[s.templateId]:[]))]:[];
  setTemplateLoading(!!ids.length);Promise.all(ids.map(id=>fetchGameTemplateById(id))).then(rows=>{if(rows.some(r=>!r||r.academy_id!==academyId))throw Error('missing_game_source');if(active)setTemplates(rows);}).catch(()=>{if(active)setTemplateError(true);}).finally(()=>{if(active)setTemplateLoading(false);});return()=>{active=false;};
 },[lesson,academyId,revision]);
 useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start'});},[step]);
 const source=useMemo<LearningSource>(()=>{
  if(lesson)return contentFromLesson(lesson,lists,templates);
  const list=lists.find(row=>row.id===state.sourceId);
  if(state.mode==='list'&&list)return contentFromList(list);
  if(state.mode==='list'&&initialCards?.length)return {contents:mergeLearningContent(initialCards.map(card=>({id:card.id,kind:'word',card,origins:[initialTitle||'']}))),videos:[],excluded:0};
  return {contents:[],videos:[],excluded:0};
 },[lesson,lists,templates,state.sourceId,state.mode,initialCards,initialTitle]);
 const sourceName=lesson?.name||lists.find(row=>row.id===state.sourceId)?.name||initialTitle||'';
 const selected=useMemo(()=>source.contents.filter(row=>!state.excluded.includes(row.id)).map(row=>({...row,card:{...row.card,...state.edits[row.id]}})),[source.contents,state.excluded,state.edits]);
 const chosenVideos=useMemo(()=>source.videos.filter(v=>state.videos.includes(v.id)),[source.videos,state.videos]);
 const parts=useMemo(()=>splitLearningContent(selected,state.portion),[selected,state.portion]);
 const part=Math.min(Math.max(0,state.part),Math.max(0,parts.length-1));
 const current=useMemo(()=>parts[part]||[],[parts,part]);
 const plan=useMemo(()=>buildGuidedPractice(current,chosenVideos,state.goal,en),[current,chosenVideos,state.goal,en]);
 const previewPlan=useMemo(()=>preview?buildGuidedPractice(current,chosenVideos,preview,en):null,[preview,current,chosenVideos,en]);
 const title=state.title.trim()||`${sourceName||l('선택한 자료','Selected material')} ${l('복습','review')}`;
 const assignmentTitle=parts.length>1?`${title} · ${part+1}/${parts.length}`:title;
 const targets=state.everyone?null:state.students.filter(id=>students.some(s=>s.id===id)).sort();
 const fingerprint=JSON.stringify({classId,title:assignmentTitle,goal:state.goal,due:state.due,targets,content:current.map(c=>({kind:c.kind,word:c.card.word,meaning:c.card.meaning,imageUrl:c.card.imageUrl,example:c.card.example})),videos:chosenVideos.map(v=>v.item)});
 const alreadySent=receipts.current.find(entry=>entry.fingerprint===fingerprint)?.result;
 const waiting=loading||templateLoading;
 const available=!!selected.length||!!chosenVideos.length;
 const canNext=!waiting&&!loadError&&!templateError&&available&&selected.every(row=>row.card.word.trim());
 const assignmentValid=!!students.length&&(state.everyone||state.students.some(id=>students.some(s=>s.id===id)))&&(!state.due||new Date(state.due).getTime()>Date.now());
 const issues=plan.issues.map(message=>message.includes(' / ')?message.split(' / ')[en?1:0]:message);
 function chooseSource(sourceId:string){patch({sourceId,excluded:[],edits:{},videos:[],part:0,title:''});setVisible(20);setError('');}
 function toggle(id:string){patch({excluded:state.excluded.includes(id)?state.excluded.filter(v=>v!==id):[...state.excluded,id],part:0});}
 function toggleKind(kind:'word'|'sentence'){
  const ids=source.contents.filter(row=>row.kind===kind).map(row=>row.id),all=ids.every(id=>!state.excluded.includes(id));
  patch({excluded:all?[...new Set([...state.excluded,...ids])]:state.excluded.filter(id=>!ids.includes(id)),part:0});
 }
 async function send(){
  if(lock.current||!canNext||!assignmentValid||issues.length||alreadySent)return;
  lock.current=true;setBusy(true);setError('');
  try{
   if(receipt.current?.fingerprint!==fingerprint)receipt.current=receipts.current.find(entry=>entry.fingerprint===fingerprint)||{fingerprint,request:crypto.randomUUID(),draft:{id:crypto.randomUUID(),revision:0,title:assignmentTitle,items:structuredClone(plan.items),template:false}};
   const pending=receipt.current;
   receipts.current=[pending,...receipts.current.filter(entry=>entry.fingerprint!==fingerprint)].slice(0,20);
   localStorage.setItem(cache,JSON.stringify({version:1,state,receipt:pending,receipts:receipts.current}));
   const result=pending.result||await assignDraft(classId,pending.draft,targets,state.due,pending.request);
   pending.result=result;
   const next={...state,part:part<parts.length-1?part+1:part};
   // Keep the exact request/result across reloads; retries never generate a second assignment.
   localStorage.setItem(cache,JSON.stringify({version:1,state:next,receipt:pending,receipts:receipts.current}));
   onCreated(result);
  }catch{setError(l('보내지 못했어요. 선택한 내용은 유지됩니다. 연결을 확인하고 다시 보내기를 눌러 주세요.','Could not send. Your choices are kept. Check your connection and retry.'));}
  finally{lock.current=false;setBusy(false);}
 }
 const goalNames:Record<PracticeGoal,string>={review:l('오늘 수업 복습하기','Review the lesson'),memory:l('뜻과 철자 외우기','Remember meaning and spelling'),speaking:l('문장·표현 말하기','Practise speaking')};
 const goalHelp:Record<PracticeGoal,string>={review:l('보고 듣기 → 뜻·문장 확인','Study → check meanings and sentences'),memory:l('보고 듣기 → 기억 확인 → 가리고 쓰기','Study → recall → write from memory'),speaking:l('보고 듣기 → 기억 확인 → 가리고 말하기','Study → recall → hide and speak')};
 return <section className="hw-composer" aria-label={l('쉽게 숙제 만들기','Create homework')}>
  <header className="hw-compose-header"><div><p>{className}</p><h2 ref={heading} tabIndex={-1}>{[l('무엇을 복습시킬까요?','What should students practise?'),l('어떻게 연습시킬까요?','How should they practise?'),l('확인하고 학생에게 보내세요','Review and send')][step]}</h2></div><button type="button" disabled={busy} onClick={onClose}>{l('닫기','Close')}</button></header>
  <nav className="hw-compose-steps" aria-label={l('숙제 만들기 순서','Homework steps')}>{[l('학습 내용','Content'),l('연습 방법','Practice'),l('학생에게 보내기','Send')].map((name,i)=><button type="button" key={name} disabled={busy||i>step} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)}><b>{i+1}</b>{name}</button>)}</nav>
  <p className="hw-muted mt-3">{l('구성은 이 기기에 자동으로 기억해요. 학생에게는 숙제 보내기를 눌러야 전달됩니다.','This device remembers your plan. Nothing is assigned until you press Send homework.')}</p>
  {loadError&&<div role="alert">{l('자료를 불러오지 못했어요.','Could not load your materials.')} <button onClick={()=>setRevision(n=>n+1)}>{l('다시 불러오기','Retry')}</button></div>}
  {templateError&&<div role="alert">{l('수업에 저장한 게임의 내용을 확인하지 못했어요. 빠뜨리지 않도록 다시 불러와 주세요.','Could not check saved game content. Retry to avoid missing materials.')} <button onClick={()=>setRevision(n=>n+1)}>{l('다시 불러오기','Retry')}</button></div>}
  <fieldset disabled={busy||waiting} className="hw-compose-body">
   {step===0&&<>
    <div className="hw-source-choices">{(['lesson','list'] as const).map(mode=><button key={mode} type="button" aria-pressed={state.mode===mode} onClick={()=>{patch({...empty(),mode,goal:mode==='lesson'?'review':'memory'});setError('');}}><span aria-hidden className="material-symbols-outlined">{mode==='lesson'?'school':'style'}</span><strong>{mode==='lesson'?l('오늘 수업 복습시키기','Review a lesson'):l('단어·문장 외우게 하기','Learn words and expressions')}</strong><span>{mode==='lesson'?l('만든 수업에서 학습 내용을 모아요.','Use the learning content from a saved lesson.'):l('내 단어장·문장 모음을 사용해요.','Use your word or sentence collection.')}</span></button>)}</div>
    {state.mode&&<label className="hw-compose-label">{state.mode==='lesson'?l('수업 선택','Choose a lesson'):l('단어장·문장 모음 선택','Choose a collection')}<select aria-label={state.mode==='lesson'?l('수업 선택','Choose a lesson'):l('단어장·문장 모음 선택','Choose a collection')} value={state.sourceId} onChange={e=>chooseSource(e.target.value)}><option value="">{state.mode==='list'&&initialCards?.length?(initialTitle||l('선택한 단어·표현','Selected entries')):l('선택해 주세요','Please choose')}</option>{(state.mode==='lesson'?lessons:lists).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
    {waiting&&<p role="status">{l('학습 내용을 모으고 있어요…','Loading learning content…')}</p>}
    {state.mode&&!waiting&&(state.sourceId||initialCards?.length)&&<div className="hw-content-card">
     <h3>{l('이번 숙제에 넣을 내용','Include in this homework')}</h3><p>{sourceName}</p>
     <div className="hw-content-summary">{(['word','sentence'] as const).map(kind=>{const total=source.contents.filter(c=>c.kind===kind).length,count=selected.filter(c=>c.kind===kind).length;return total>0&&<label key={kind}><input type="checkbox" checked={count===total} onChange={()=>toggleKind(kind)}/><b>{kind==='word'?l('단어·숙어','Words and phrases'):l('문장 표현','Sentences')}</b> {count}/{total}{l('개','')}</label>;})}</div>
     {source.videos.map(video=><label key={video.id} className="hw-video-choice"><input type="checkbox" checked={state.videos.includes(video.id)} onChange={e=>patch({videos:e.target.checked?[...state.videos,video.id]:state.videos.filter(id=>id!==video.id)})}/>{l('수업 영상','Lesson video')} · {video.title}</label>)}
     <p className="hw-muted">{l('같은 단어·같은 뜻은 한 번만 모았어요. 다른 뜻은 구분합니다.','Repeated words with the same meaning are combined; different meanings stay separate.')}</p>
     {source.excluded>0&&<p className="hw-muted">{l('출석 등 학습 내용이 없는 수업 단계는 숙제에서 제외했어요.','Lesson steps without learning content, such as attendance, are excluded.')}</p>}
     {!source.contents.length&&!source.videos.length&&<p role="status">{l('가져올 학습 내용을 찾지 못했어요. 다른 수업·단어장을 선택하거나 직접 세부 편집을 사용해 주세요.','No supported learning content found. Choose another source or use detailed editing.')}</p>}
     <details><summary>{l('내용 확인·수정','Check or edit content')} · {source.contents.length}{l('개',' entries')}</summary><div className="hw-content-list">{source.contents.slice(0,visible).map(row=><div key={row.id}><input type="checkbox" aria-label={`${row.card.word} ${l('포함','include')}`} checked={!state.excluded.includes(row.id)} onChange={()=>toggle(row.id)}/><label>{l('학습 내용','English')}<input value={state.edits[row.id]?.word??row.card.word} onChange={e=>patch({edits:{...state.edits,[row.id]:{word:e.target.value,meaning:state.edits[row.id]?.meaning??row.card.meaning}}})}/></label><label>{l('뜻','Meaning')}<input value={state.edits[row.id]?.meaning??row.card.meaning} onChange={e=>patch({edits:{...state.edits,[row.id]:{word:state.edits[row.id]?.word??row.card.word,meaning:e.target.value}}})}/></label></div>)}</div>{visible<source.contents.length&&<button type="button" onClick={()=>setVisible(n=>n+40)}>{l('내용 더 보기','Show more')} ({source.contents.length-visible})</button>}<p className="hw-muted">{l('여기서 수정한 내용은 이번 숙제에만 반영됩니다. 원본 수업·단어장은 바뀌지 않아요.','Edits apply to this homework only; your original lesson and collection stay unchanged.')}</p></details>
    </div>}
   </>}
   {step===1&&<>
    <div className="hw-goal-grid">{(['review','memory','speaking'] as const).map(goal=><article key={goal} data-selected={state.goal===goal}><button type="button" aria-pressed={state.goal===goal} onClick={()=>patch({goal})}><strong>{goalNames[goal]}</strong><span>{goalHelp[goal]}</span></button><button type="button" className="hw-text-button" onClick={()=>setPreview(goal)}>{l('학생 화면 예시 보기','See student example')}</button></article>)}</div>
    <div className="hw-content-card"><h3>{l('분량을 어떻게 나눌까요?','How much per assignment?')}</h3><p>{parts.length>1?l(`전체 ${selected.length}개를 빠짐없이 ${parts.length}회로 나눠 구성합니다. 이번에는 ${part+1}회차 ${current.length}개를 보냅니다.`, `All ${selected.length} entries are divided into ${parts.length} parts. Send part ${part+1} with ${current.length} entries now.`):l(`선택한 학습 내용 ${selected.length}개를 이번 숙제에 모두 넣습니다.`, `All ${selected.length} selected entries go into this assignment.`)}</p><div className="hw-portion-choices">{[10,20,0].map(size=><button type="button" key={size} aria-pressed={state.portion===size} onClick={()=>patch({portion:size,part:0})}>{size?l(`${size}개씩 나누기`,`${size} per part`):l('한 번에 모두','All at once')}</button>)}</div>
     {parts.length>1&&<label className="hw-compose-label">{l('이번에 보낼 회차','Part to send now')}<select aria-label={l('이번에 보낼 회차','Part to send now')} value={part} onChange={e=>patch({part:Number(e.target.value)})}>{parts.map((rows,i)=><option key={i} value={i}>{i+1}/{parts.length} · {rows.length}{l('개',' entries')} · {rows.slice(0,2).map(r=>r.card.word).join(', ')}</option>)}</select></label>}
     <p className="hw-muted">{l('회차별로 골라 보냅니다. 선택하지 않은 회차를 자동으로 배정하거나 예약하지 않습니다. 다음 회차는 이 기기에 기억해 둡니다.','Choose a part to send. Other parts are not automatically assigned or scheduled. This device remembers the next part.')}</p>
    </div>
    <div className="hw-plan-summary"><h3>{l('학생이 할 활동','Student practice')}</h3><ol>{[...new Set(plan.items.map(item=>item.title))].map(name=><li key={name}>{name}</li>)}</ol><p>{l(`학습 ${current.length}개 · 확인 ${plan.questions}문제${plan.recordings?` · 녹음 ${plan.recordings}개`:''}`,`${current.length} entries · ${plan.questions} questions${plan.recordings?` · ${plan.recordings} recordings`:''}`)}</p>{plan.recordings>0&&<p className="hw-muted">{l('녹음 답변은 선생님이 확인합니다. 자동 발음 채점은 하지 않아요.','The teacher reviews recordings; pronunciation is not automatically graded.')}</p>}</div>
   </>}
   {step===2&&<>
    <label className="hw-compose-label">{l('숙제 이름','Homework title')}<input value={state.title} placeholder={title} maxLength={150} onChange={e=>patch({title:e.target.value})}/></label>
    <div className="hw-confirm-card"><h3>{assignmentTitle}</h3><p>{goalNames[state.goal]}</p><p>{l(`전체 선택 ${selected.length}개 중 이번 회차 ${current.length}개 · ${part+1}/${Math.max(parts.length,1)}회`,`${current.length} of ${selected.length} entries · Part ${part+1}/${Math.max(parts.length,1)}`)}</p><p>{current.slice(0,6).map(row=>row.card.word).join(' · ')}{current.length>6?' …':''}</p><p>{l(`확인 문제 ${plan.questions}개 · 녹음 ${plan.recordings}개 · 영상 ${chosenVideos.length}개`,`${plan.questions} questions · ${plan.recordings} recordings · ${chosenVideos.length} videos`)}</p></div>
    <fieldset className="hw-targets"><legend>{l('누구에게 보낼까요?','Who should receive it?')}</legend><label><input type="checkbox" checked={state.everyone} onChange={e=>patch({everyone:e.target.checked})}/>{l('반 전체','Whole class')} · {className} ({students.length})</label>{!state.everyone&&<div>{students.map(student=><label key={student.id}><input type="checkbox" checked={state.students.includes(student.id)} onChange={e=>patch({students:e.target.checked?[...state.students,student.id]:state.students.filter(id=>id!==student.id)})}/>{student.name}</label>)}</div>}{!students.length&&<p role="alert">{l('이 반에 등록된 학생이 없습니다. 학생을 등록한 뒤 보내 주세요.','This class has no students. Add students before sending.')}</p>}</fieldset>
    <label className="hw-compose-label">{l('마감일 · 선택','Deadline · optional')}<input type="datetime-local" value={state.due} onChange={e=>patch({due:e.target.value})}/></label>
    {state.due&&new Date(state.due).getTime()<=Date.now()&&<p role="alert">{l('마감일을 현재 시간 이후로 정해 주세요.','Choose a future deadline.')}</p>}
    <button type="button" onClick={()=>setPreview(state.goal)}>{l('학생 화면 미리보기','Preview student screen')}</button>
   </>}
  </fieldset>
  {step>0&&issues.length>0&&<div role="alert" className="hw-compose-error">{issues.map(issue=><p key={issue}>{issue}</p>)}<p>{l('분량을 나누거나 내용을 수정해 주세요. 선택한 내용을 임의로 빼지 않습니다.','Split the content or edit it. Selected entries are never silently removed.')}</p></div>}
  {step===2&&alreadySent&&<div className="hw-content-card" role="status"><p>{l('이 구성으로 이미 보낸 숙제가 있어요. 다시 연습시킬 때는 새 숙제로 보내세요.','This assignment was already sent. Create a new assignment for another practice session.')}</p><div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={()=>onCreated(alreadySent)}>{l('이미 보낸 숙제 보기','View sent homework')}</button><button type="button" disabled={busy} onClick={()=>{receipts.current=receipts.current.filter(entry=>entry.fingerprint!==fingerprint);receipt.current=null;setRepeatIntent(n=>n+1);}}>{l('새 숙제로 다시 내기','Create a new assignment')}</button></div></div>}
  {error&&<p role="alert" className="hw-compose-error">{error}</p>}
  <footer className="hw-compose-footer"><div>{step>0&&<button type="button" disabled={busy} onClick={()=>setStep(n=>n-1)}>{l('이전','Back')}</button>}<details><summary>{l('더보기','More')}</summary><button type="button" disabled={busy||!canNext||!!issues.length} onClick={()=>onEdit(structuredClone(plan.items),assignmentTitle,state.everyone?null:state.students,state.due)}>{l('직접 세부 편집','Detailed editing')}</button><button type="button" disabled={busy} onClick={onLegacy}>{l('기존 방식으로 만들기','Use the previous wizard')}</button></details></div><button type="button" className="hw-primary" disabled={busy||!canNext||step>0&&!!issues.length||step===2&&(!assignmentValid||!!alreadySent)} onClick={()=>step<2?setStep(n=>n+1):void send()}>{busy?l('보내는 중…','Sending…'):step===2?alreadySent?l('이미 보냈어요','Already sent'):l('숙제 보내기','Send homework'):l('다음','Next')}</button></footer>
  {preview&&previewPlan&&<AccessibleDialog label={l('학생 화면 예시','Student preview')} onClose={()=>setPreview(null)}><div className="hw-preview-dialog"><header><h3>{goalNames[preview]}</h3><button type="button" onClick={()=>setPreview(null)}>{l('닫기','Close')}</button></header>{previewPlan.issues.length?<p>{l('분량이나 내용을 확인한 뒤 미리볼 수 있어요.','Check the content and amount before previewing.')}</p>:<HomeworkPreview title={goalNames[preview]} items={previewPlan.items} startImmediately/>}</div></AccessibleDialog>}
 </section>;
}
