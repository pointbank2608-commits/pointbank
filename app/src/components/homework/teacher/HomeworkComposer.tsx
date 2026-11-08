import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {fetchCurriculumLessons,fetchCurriculumLessonById,fetchWordLists,fetchStudentsOfClass,fetchGameTemplateById} from '../../../lib/api';
import type {CurriculumLesson,FullCardItem,GameTemplate,Student,WordList} from '../../../lib/types';
import {effectiveSlides} from '../../../lib/lessonSlides';
import {assignDraft} from '../../../lib/homework/blockApi';
import type {HomeworkDraft} from '../../../lib/homework/blocks';
import {buildGuidedPractice,CHECK_TYPES,suggestedCheck,type CheckType,type FinalCheck,contentFromLesson,contentFromList,mergeLearningContent,splitLearningContent,type LearningSource,type PracticeGoal} from '../../../lib/homework/guided';
import HomeworkDeadlinePicker from './HomeworkDeadlinePicker';
import { HINT_NAMES, type HintLevel, type SpellingHintPolicy } from '../../../lib/homework/spellingHints';
import AccessibleDialog from '../../AccessibleDialog';
import HomeworkPreview from './HomeworkPreview';
import '../../../styles/homework-composer.css';

type State={mode:'lesson'|'list'|null;sourceId:string;excluded:string[];edits:Record<string,{word:string;meaning:string}>;videos:string[];goals:PracticeGoal[];check:boolean;checkTypes:CheckType[]|null;checkCount:FinalCheck['count'];portion:number;part:number;title:string;due:string;everyone:boolean;students:string[];spellingHints:SpellingHintPolicy};
type Receipt={fingerprint:string;request:string;draft:HomeworkDraft;result?:{id:string;code:string}};
const empty=():State=>({mode:null,sourceId:'',excluded:[],edits:{},videos:[],goals:[],check:false,checkTypes:null,checkCount:5,portion:20,part:0,title:'',due:'',everyone:true,students:[],spellingHints:{defaultLevel:0,overrides:{}}});
function validRecovery(value:unknown):value is State{
 if(!value||typeof value!=='object')return false;const s=value as State;
 return [null,'lesson','list'].includes(s.mode)&&typeof s.sourceId==='string'&&typeof s.title==='string'&&typeof s.due==='string'&&typeof s.everyone==='boolean'
  &&Array.isArray(s.goals)&&new Set(s.goals).size===s.goals.length&&s.goals.every(goal=>['review','memory','speaking'].includes(goal))
  &&typeof s.check==='boolean'&&(s.checkTypes===null||Array.isArray(s.checkTypes)&&new Set(s.checkTypes).size===s.checkTypes.length&&s.checkTypes.every(type=>Object.hasOwn(CHECK_TYPES,type)))&&[0,5,10,15].includes(s.checkCount)&&[0,10,20].includes(s.portion)&&Number.isInteger(s.part)&&s.part>=0
  &&[s.excluded,s.videos,s.students].every(a=>Array.isArray(a)&&a.every(v=>typeof v==='string'))&&!!s.edits&&typeof s.edits==='object'
  &&Object.values(s.edits).every(v=>v&&typeof v.word==='string'&&typeof v.meaning==='string');
}
export default function HomeworkComposer({academyId,ownerId,classId,className,initialLessonId,initialCards,initialTitle,initialMode,followUp,initialStudents,onSwitch,adaptiveEnabled=true,onClose,onCreated}:{
 academyId:string;ownerId:string;classId:string;className:string;initialLessonId?:string;initialCards?:FullCardItem[];initialTitle?:string;initialMode?:'lesson'|'list';followUp?:{studentId:string;type:CheckType};initialStudents?:string[];
 onSwitch?:(kind:'adaptive'|'wordProject')=>void;adaptiveEnabled?:boolean;
 onClose:()=>void;onCreated:(result:{id:string;code:string})=>void;
}){
 const {i18n}=useTranslation(),en=i18n.language.startsWith('en');const l=useCallback((ko:string,english:string)=>en?english:ko,[en]);
 const switchOptions=onSwitch?([['adaptive',l('맞춤 단어 숙제','Adaptive vocabulary homework'),l('단어를 고르고 계획을 확인하면, 학생마다 필요한 연습과 이후 복습 확인이 이어져요.','Students practise what they need, then get later review checks.'),'auto_awesome',adaptiveEnabled],['wordProject',l('장기 단어 프로젝트','Long-term word project'),l('큰 단어 범위를 한 번 배정하면, 학생별로 매일 새 단어와 복습을 나눠 학습해요.','Assign a large word range once; each student gets daily new words and review.'),'event_repeat',true]] as const):[];
 const cache=`classbank.hw.guided.v1.${ownerId}.${academyId}.${classId}`+(followUp?':followup:'+followUp.studentId+':'+followUp.type:'');
 const [state,setState]=useState<State>(()=>{
  try{const saved=JSON.parse(localStorage.getItem(cache)||'null');if(saved?.version===1&&saved.state&&!saved.state.goals)saved.state={...empty(),...saved.state,goals:[saved.state.goal]};if(saved?.version===1&&saved.state)saved.state={...empty(),...saved.state};if(saved?.version===1&&validRecovery(saved.state)&&(!initialLessonId||saved.state.sourceId===initialLessonId)&&(!initialMode||saved.state.mode===initialMode)&&!initialCards?.length)return saved.state;}catch{/* malformed recovery never changes server data */}
  if(followUp){
   const type=followUp.type;
   const goal:PracticeGoal=['spelling','lettersMissing','lettersOrder'].includes(type)?'memory':'review';
   const checkTypes:CheckType[]=goal==='memory'?['spelling']:[type];
   return {...empty(),mode:'list',title:initialTitle||'',goals:[goal],check:goal==='memory',checkCount:0,checkTypes,everyone:false,students:[followUp.studentId]};
  }
  return {...empty(),mode:initialLessonId?'lesson':initialCards?.length?'list':initialMode||null,everyone:!initialStudents?.length,students:initialStudents||[],sourceId:initialLessonId||'',title:initialTitle||''};
 });
 const patch=(next:Partial<State>)=>setState(old=>({...old,...next}));
 const [step,setStep]=useState(0),[lessons,setLessons]=useState<CurriculumLesson[]>([]),[lists,setLists]=useState<WordList[]>([]),[templates,setTemplates]=useState<GameTemplate[]>([]),[students,setStudents]=useState<Student[]>([]),[repeatIntent,setRepeatIntent]=useState(0);
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(false),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[visible,setVisible]=useState(20),[preview,setPreview]=useState<PracticeGoal|'all'|'example'|null>(null),[exampleType,setExampleType]=useState<CheckType|null>(null);
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
  if(state.mode==='list'&&initialCards?.length)return {contents:mergeLearningContent(initialCards.map(card=>({id:card.id,kind:followUp?.type==='sentenceOrder'?'sentence':'word',card,origins:[initialTitle||'']}))),videos:[],excluded:0};
  return {contents:[],videos:[],excluded:0};
 },[lesson,lists,templates,state.sourceId,state.mode,initialCards,initialTitle,followUp]);
 const sourceName=lesson?.name||lists.find(row=>row.id===state.sourceId)?.name||initialTitle||'';
 const selected=useMemo(()=>source.contents.filter(row=>!state.excluded.includes(row.id)).map(row=>({...row,card:{...row.card,...state.edits[row.id]}})),[source.contents,state.excluded,state.edits]);
 const chosenVideos=useMemo(()=>source.videos.filter(v=>state.videos.includes(v.id)),[source.videos,state.videos]);
 const parts=useMemo(()=>splitLearningContent(selected,state.portion),[selected,state.portion]);
 const part=Math.min(Math.max(0,state.part),Math.max(0,parts.length-1));
 const current=useMemo(()=>parts[part]||[],[parts,part]);
 const types=useMemo(()=>state.checkTypes??suggestedCheck(state.goals,current),[state.checkTypes,state.goals,current]);
 const plan=useMemo(()=>buildGuidedPractice(current,chosenVideos,state.goals,en,state.check?{types,count:state.checkCount}:null,state.spellingHints),[current,chosenVideos,state.goals,en,state.check,state.checkCount,types,state.spellingHints]);
 const shownType=exampleType&&types.includes(exampleType)?exampleType:types[0];
 const example=shownType?plan.examples[shownType]:undefined;
 const previewItems=useMemo(()=>preview==='all'?plan.items:preview==='example'?example?[example]:[]:preview?buildGuidedPractice(current,chosenVideos,preview,en,null,state.spellingHints).items:[],[preview,plan,example,current,chosenVideos,en,state.spellingHints]);
 const previewStart=preview==='memory'?previewItems.findIndex(item=>item.content.questions.some(q=>q.guidedSpelling)):
   preview==='speaking'?previewItems.findIndex(item=>item.config.block?.type==='speak'):0;
 const title=state.title.trim()||`${sourceName||l('선택한 자료','Selected material')} ${l('복습','review')}`;
 const assignmentTitle=parts.length>1?`${title} · ${part+1}/${parts.length}`:title;
 const targets=state.everyone?null:state.students.filter(id=>students.some(s=>s.id===id)).sort();
 const fingerprint=JSON.stringify({classId,title:assignmentTitle,goal:state.goals.length===1?state.goals[0]:state.goals,...(state.check?{check:types,checkCount:state.checkCount}:{}),...(state.goals.includes('memory')?{spellingHints:state.spellingHints}:{}),due:state.due,targets,content:current.map(c=>({kind:c.kind,word:c.card.word,meaning:c.card.meaning,imageUrl:c.card.imageUrl,example:c.card.example})),videos:chosenVideos.map(v=>v.item)});
 const alreadySent=receipts.current.find(entry=>entry.fingerprint===fingerprint)?.result;
 const waiting=loading||templateLoading;
 const available=!!selected.length||!!chosenVideos.length;
 const canNext=!waiting&&!loadError&&!templateError&&available&&selected.every(row=>row.card.word.trim());
 const assignmentValid=!!students.length&&(state.everyone||state.students.some(id=>students.some(s=>s.id===id)))&&(!state.due||new Date(state.due).getTime()>Date.now());
 const issues=[...(!state.goals.length?[l('활동을 한 가지 이상 선택해 주세요.','Choose at least one activity.')]:[]),...plan.issues].map(message=>message.includes(' / ')?message.split(' / ')[en?1:0]:message);
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
  <header className="hw-compose-header"><div><p>{className}</p><h2 ref={heading} tabIndex={-1}>{[l('어떤 자료로 숙제를 낼까요?','Which materials should students use?'),l('숙제 구성','Homework activities'),l('학생에게 보내기','Send to students')][step]}</h2></div><button type="button" disabled={busy} onClick={onClose}>{l('닫기','Close')}</button></header>
  <nav className="hw-compose-steps" aria-label={l('숙제 만들기 순서','Homework steps')}>{[l('자료 선택','Materials'),l('숙제 구성','Activities'),l('학생에게 보내기','Send')].map((name,i)=><button type="button" key={name} disabled={busy||i>step} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)}><b>{i+1}</b>{name}</button>)}</nav>
  <p className="hw-muted mt-3">{l('구성은 이 기기에 자동으로 기억해요. 학생에게는 숙제 보내기를 눌러야 전달됩니다.','This device remembers your plan. Nothing is assigned until you press Send homework.')}</p>
  {loadError&&<div role="alert">{l('자료를 불러오지 못했어요.','Could not load your materials.')} <button onClick={()=>setRevision(n=>n+1)}>{l('다시 불러오기','Retry')}</button></div>}
  {templateError&&<div role="alert">{l('수업에 저장한 게임의 내용을 확인하지 못했어요. 빠뜨리지 않도록 다시 불러와 주세요.','Could not check saved game content. Retry to avoid missing materials.')} <button onClick={()=>setRevision(n=>n+1)}>{l('다시 불러오기','Retry')}</button></div>}
  <fieldset disabled={busy||waiting} className="hw-compose-body">
   {step===0&&<>
    <div className="hw-source-choices">{(['lesson','list'] as const).map(mode=><button key={mode} type="button" aria-pressed={state.mode===mode} onClick={()=>{patch({...empty(),mode,goals:[]});setError('');}}><span aria-hidden className="material-symbols-outlined">{mode==='lesson'?'school':'style'}</span><strong>{mode==='lesson'?l('수업에서 가져오기','Use a saved lesson'):l('내 단어장·문장 모음에서 가져오기','Use my words and sentences')}</strong><span>{mode==='lesson'?l('만든 수업에서 학습 내용을 모아요.','Use the learning content from a saved lesson.'):l('내 단어장·문장 모음을 사용해요.','Use your word or sentence collection.')}</span></button>)}</div>
    {switchOptions.length>0&&<div className="hw-content-card"><h3>{l('며칠에 걸쳐 배우는 단어 숙제','Multi-day vocabulary homework')}</h3><p className="hw-muted">{l('한 번 내는 숙제가 아니라, 학생마다 계획에 따라 이어지는 숙제예요. 선택하면 전용 구성 화면으로 이동해요.','These follow a plan over several days for each student. Choosing one opens its own setup.')}</p><div className="hw-source-choices">{switchOptions.map(([kind,name,help,icon,enabled])=><button key={kind} type="button" disabled={!enabled} onClick={()=>onSwitch?.(kind)}><span aria-hidden className="material-symbols-outlined">{icon}</span><strong>{name}</strong><span>{enabled?help:l('학원의 개별수업 기능이 열려 있어야 만들 수 있어요.','Requires the academy’s individual learning feature.')}</span></button>)}</div></div>}
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
    <div className="hw-goal-grid">{(['review','memory','speaking'] as const).map(goal=><article key={goal} data-selected={state.goals.includes(goal)}><label className="flex cursor-pointer gap-2 p-3"><input type="checkbox" checked={state.goals.includes(goal)} onChange={event=>patch({goals:event.target.checked?[...state.goals,goal]:state.goals.filter(g=>g!==goal)})}/><span><strong className="block">{goalNames[goal]}</strong><span className="block">{goalHelp[goal]}</span></span></label><button type="button" className="hw-text-button" onClick={()=>setPreview(goal)}>{l('학생 화면 예시 보기','See student example')}</button></article>)}</div>
    {state.goals.includes('memory')&&<fieldset className="hw-content-card">
      <legend className="font-bold">{l('철자 힌트 설정','Spelling hints')}</legend>
      <label className="hw-compose-label">{l('반 기본값','Class default')}
        <select value={state.spellingHints.defaultLevel} onChange={event=>patch({spellingHints:{...state.spellingHints,defaultLevel:Number(event.target.value) as HintLevel}})}>
          {HINT_NAMES.map(([ko,english],level)=><option key={ko} value={level}>{l(ko,english)}</option>)}
        </select>
      </label>
      <details><summary>{l('학생별 조정','Adjust by student')}</summary>
        <div className="grid gap-2 sm:grid-cols-2">{students.map(student=><label key={student.id}>{student.name}
          <select value={state.spellingHints.overrides[student.id]??''} onChange={event=>{
            const overrides={...state.spellingHints.overrides};
            if(event.target.value==='')delete overrides[student.id];
            else overrides[student.id]=Number(event.target.value) as HintLevel;
            patch({spellingHints:{...state.spellingHints,overrides}});
          }}>
            <option value="">{l('반 기본값 사용','Use class default')}</option>
            {HINT_NAMES.map(([ko,english],level)=><option key={ko} value={level}>{l(ko,english)}</option>)}
          </select>
        </label>)}</div>
      </details>
    </fieldset>}
    <div className="hw-content-card"><h3>{l('분량을 어떻게 나눌까요?','How much per assignment?')}</h3><p>{parts.length>1?l(`전체 ${selected.length}개를 빠짐없이 ${parts.length}회로 나눠 구성합니다. 이번에는 ${part+1}회차 ${current.length}개를 보냅니다.`, `All ${selected.length} entries are divided into ${parts.length} parts. Send part ${part+1} with ${current.length} entries now.`):l(`선택한 학습 내용 ${selected.length}개를 이번 숙제에 모두 넣습니다.`, `All ${selected.length} selected entries go into this assignment.`)}</p><div className="hw-portion-choices">{[10,20,0].map(size=><button type="button" key={size} aria-pressed={state.portion===size} onClick={()=>patch({portion:size,part:0})}>{size?l(`${size}개씩 나누기`,`${size} per part`):l('한 번에 모두','All at once')}</button>)}</div>
     {parts.length>1&&<label className="hw-compose-label">{l('이번에 보낼 회차','Part to send now')}<select aria-label={l('이번에 보낼 회차','Part to send now')} value={part} onChange={e=>patch({part:Number(e.target.value)})}>{parts.map((rows,i)=><option key={i} value={i}>{i+1}/{parts.length} · {rows.length}{l('개',' entries')} · {rows.slice(0,2).map(r=>r.card.word).join(', ')}</option>)}</select></label>}
     <p className="hw-muted">{l('회차별로 골라 보냅니다. 선택하지 않은 회차를 자동으로 배정하거나 예약하지 않습니다. 다음 회차는 이 기기에 기억해 둡니다.','Choose a part to send. Other parts are not automatically assigned or scheduled. This device remembers the next part.')}</p>
    </div>
        <fieldset className="hw-content-card">
     <legend className="font-bold">{l('마무리 확인','Final check')}</legend>
     <label className="flex items-center gap-2"><input type="checkbox" checked={state.check} onChange={event=>patch({check:event.target.checked})}/>{l('마무리 확인 추가','Add a final check')}</label>
     {state.check?<div className="mt-2 space-y-2">
      <p>{l('선택 유형: ','Selected types: ')}{types.map(type=>CHECK_TYPES[type][en?1:0]).join(' · ')||l('선택 없음','None')}</p>
      <details open><summary className="cursor-pointer">{l('문제 유형 바꾸기','Change question types')}</summary>
       <div className="mt-2 grid gap-2 sm:grid-cols-2">{(Object.keys(CHECK_TYPES) as CheckType[]).map(type=><label key={type} className="flex items-center gap-2"><input type="checkbox" checked={types.includes(type)} onChange={event=>{patch({checkTypes:event.target.checked?[...types,type]:types.filter(t=>t!==type)});if(event.target.checked)setExampleType(type);}}/>{CHECK_TYPES[type][en?1:0]}</label>)}</div>
       <button type="button" className="hw-text-button" onClick={()=>patch({checkTypes:null})}>{l('추천 유형으로 되돌리기','Reset to suggested types')}</button>
      </details>
      {shownType&&<div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3">
        <strong className="rounded-full bg-primary-fixed px-3 py-1 text-primary">{CHECK_TYPES[shownType][en?1:0]}</strong>
        {example?<><span className="min-w-0 flex-1 text-lg font-bold">{example.content.questions[0]?.prompt||example.config.block?.translation||l('그림 또는 음성 단서','Picture or audio cue')}</span>
          <button type="button" onClick={()=>setPreview('example')}>{l('학생 화면 미리보기','Preview student screen')}</button></>
          :<span>{l('선택한 자료로는 이 유형을 만들 수 없어요.','This type is unavailable with these materials.')}</span>}
      </div>}
      <div className="hw-portion-choices" aria-label={l('마무리 확인 총 문제 수','Total final check questions')}>{([5,10,15,0] as const).map(count=><button key={count} type="button" aria-pressed={state.checkCount===count} onClick={()=>patch({checkCount:count})}>{count?l(count+'문제',count+' questions'):l('전체','All')}</button>)}</div>
      <p className="hw-muted">{l('고른 유형을 합친 총 문제 수예요. 전체는 유형별로 출제 가능한 자료를 한 번씩 확인해요.','This is the total across selected types. All checks each eligible entry once per type.')}</p>
     </div>:<p className="hw-muted">{l('연습 결과는 기록돼요. 마무리 확인 결과는 미확인으로 표시돼요.','Practice results are recorded. Final performance stays unverified.')}</p>}
    </fieldset>
    <div className="hw-plan-summary"><h3>{l('학생이 진행하는 순서','Student activity order')}</h3><ol>{[...new Set(plan.items.map(item=>item.title))].map(name=><li key={name}>{name}</li>)}</ol><p>{l(`학습 ${current.length}개 · 선택 활동 ${state.goals.length}개 · 마무리 확인 ${plan.finalQuestions}문제${plan.recordings?` · 녹음 ${plan.recordings}개`:''}`,`${current.length} entries · ${state.goals.length} activities · ${plan.finalQuestions} final checks${plan.recordings?` · ${plan.recordings} recordings`:''}`)}</p>{plan.recordings>0&&<p className="hw-muted">{l('녹음 답변은 선생님이 확인합니다. 자동 발음 채점은 하지 않아요.','The teacher reviews recordings; pronunciation is not automatically graded.')}</p>}</div>
   </>}
   {step===2&&<>
    <label className="hw-compose-label">{l('숙제 이름','Homework title')}<input value={state.title} placeholder={title} maxLength={150} onChange={e=>patch({title:e.target.value})}/></label>
    <div className="hw-confirm-card"><h3>{assignmentTitle}</h3><p>{state.goals.map(goal=>goalNames[goal]).join(' · ')}</p><p>{l(`전체 선택 ${selected.length}개 중 이번 회차 ${current.length}개 · ${part+1}/${Math.max(parts.length,1)}회`,`${current.length} of ${selected.length} entries · Part ${part+1}/${Math.max(parts.length,1)}`)}</p><p>{current.slice(0,6).map(row=>row.card.word).join(' · ')}{current.length>6?' …':''}</p><p>{l(`마무리 확인 ${plan.finalQuestions}문제 · 녹음 ${plan.recordings}개 · 영상 ${chosenVideos.length}개`,`${plan.finalQuestions} final checks · ${plan.recordings} recordings · ${chosenVideos.length} videos`)}</p></div>
    <fieldset className="hw-targets"><legend>{l('누구에게 보낼까요?','Who should receive it?')}</legend><label><input type="checkbox" checked={state.everyone} onChange={e=>patch({everyone:e.target.checked})}/>{l('반 전체','Whole class')} · {className} ({students.length})</label>{!state.everyone&&<div>{students.map(student=><label key={student.id}><input type="checkbox" checked={state.students.includes(student.id)} onChange={e=>patch({students:e.target.checked?[...state.students,student.id]:state.students.filter(id=>id!==student.id)})}/>{student.name}</label>)}</div>}{!students.length&&<p role="alert">{l('이 반에 등록된 학생이 없습니다. 학생을 등록한 뒤 보내 주세요.','This class has no students. Add students before sending.')}</p>}</fieldset>
    <HomeworkDeadlinePicker value={state.due} onChange={due=>patch({due})} en={en}/>
    {state.due&&new Date(state.due).getTime()<=Date.now()&&<p role="alert">{l('마감일을 현재 시간 이후로 정해 주세요.','Choose a future deadline.')}</p>}
    <button type="button" onClick={()=>setPreview('all')}>{l('학생 화면 미리보기','Preview student screen')}</button>
   </>}
  </fieldset>
  {step>0&&issues.length>0&&<div role="alert" className="hw-compose-error">{issues.map(issue=><p key={issue}>{issue}</p>)}<p>{l('분량을 나누거나 내용을 수정해 주세요. 선택한 내용을 임의로 빼지 않습니다.','Split the content or edit it. Selected entries are never silently removed.')}</p></div>}
  {step===2&&alreadySent&&<div className="hw-content-card" role="status"><p>{l('이 구성으로 이미 보낸 숙제가 있어요. 다시 연습시킬 때는 새 숙제로 보내세요.','This assignment was already sent. Create a new assignment for another practice session.')}</p><div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={()=>onCreated(alreadySent)}>{l('이미 보낸 숙제 보기','View sent homework')}</button><button type="button" disabled={busy} onClick={()=>{receipts.current=receipts.current.filter(entry=>entry.fingerprint!==fingerprint);receipt.current=null;setRepeatIntent(n=>n+1);}}>{l('새 숙제로 다시 내기','Create a new assignment')}</button></div></div>}
  {error&&<p role="alert" className="hw-compose-error">{error}</p>}
  <footer className="hw-compose-footer"><div>{step>0&&<button type="button" disabled={busy} onClick={()=>setStep(n=>n-1)}>{l('이전','Back')}</button>}</div><button type="button" className="hw-primary" disabled={busy||!canNext||step>0&&!!issues.length||step===2&&(!assignmentValid||!!alreadySent)} onClick={()=>step<2?setStep(n=>n+1):void send()}>{busy?l('보내는 중…','Sending…'):step===2?alreadySent?l('이미 보냈어요','Already sent'):l('숙제 보내기','Send homework'):l('다음','Next')}</button></footer>
  {preview&&<AccessibleDialog label={l('학생 화면 예시','Student preview')} onClose={()=>setPreview(null)}><div className="hw-preview-dialog"><header><h3>{preview==='all'?assignmentTitle:preview==='example'&&shownType?CHECK_TYPES[shownType][en?1:0]:goalNames[preview as PracticeGoal]}</h3><button type="button" onClick={()=>setPreview(null)}>{l('닫기','Close')}</button></header>{previewItems.length?<HomeworkPreview title={assignmentTitle} items={previewItems} startImmediately startItem={Math.max(0,previewStart)} showStages startHidden={preview==='speaking'}/>:<p>{l('미리 볼 수 있는 자료를 선택해 주세요.','Choose suitable material to preview.')}</p>}</div></AccessibleDialog>}
 </section>;
}
