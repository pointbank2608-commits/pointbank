import {useRef,useState} from 'react';
import type {VideoQuestion} from '../lib/videoQuestions';
import {formatQuestionTime,parseQuestionTime,questionError,questionKinds,questionNumber,questionTimeInClip,questionTimeInVideo,sentenceWords} from '../lib/videoQuestions';
import type {ShadowLine} from '../lib/shadowLines';

/** Edits the existing question format against the classroom's single player. */
export default function ClassroomQuestionEditor({question,number,time,start,end,lines,onClose,onSelect,onSave}:{question?:VideoQuestion;number:number;time:number;start:number;end:number;lines:ShadowLine[];onClose:()=>void;onSelect:(id?:string)=>void;onSave:(question:VideoQuestion,remove?:boolean)=>Promise<void>}){
 const [draft,setDraft]=useState<VideoQuestion|null>(question??null),[at,setAt]=useState(question?formatQuestionTime(questionTimeInClip(question.at,start)):''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const lock=useRef(false);
 const clock=(n:number)=>`${Math.floor(Math.max(0,n)/60)}:${String(Math.floor(Math.max(0,n)%60)).padStart(2,'0')}`;
 const cancel=()=>{if(lock.current)return;setDraft(null);setError('');onSelect();};
 const commit=async(remove=false)=>{
  if(!draft||lock.current)return;
  const q={...draft,at:questionTimeInVideo(parseQuestionTime(at),start)};
  const message=remove?'':questionError(q,start,end);if(message){setError(message);return;}
  lock.current=true;setBusy(true);setError('');
  try{await onSave(q,remove);setDraft(null);onSelect();}catch(e){setError(e instanceof Error?e.message:'저장하지 못했어요. 다시 시도해 주세요.');}finally{lock.current=false;setBusy(false);}
 };
 return <section className={'classroom-question-editor '+(draft?'is-writing':'')} aria-label="질문 편집 팝업" data-editor-state={draft?(question?'existing':'new'):'idle'}>
  <header><h2>{draft?(question?`질문 ${questionNumber(number)} 편집`:'질문 추가'):'질문 편집'}</h2><button className="animation-close" disabled={busy} onClick={onClose}>× 닫기</button></header>
  {!draft?<div className="classroom-editor-body"><button className="vq-primary" onClick={()=>{const q:VideoQuestion={id:crypto.randomUUID(),kind:'spoken',at:time,prompt:''};setDraft(q);setAt(formatQuestionTime(questionTimeInClip(time,start)));}}>＋ {clock(time-start)}에 질문 추가</button></div>:<form onSubmit={e=>{e.preventDefault();void commit();}}>
   <div className="classroom-editor-body"><fieldset disabled={busy}>
    <label>질문 시점<input aria-label="질문 시점" value={at} onChange={e=>setAt(e.target.value)}/></label>
    <label>질문 유형<select aria-label="질문 유형" value={draft.kind} onChange={e=>{const kind=e.target.value as VideoQuestion['kind'];const base={id:draft.id,at:draft.at};setDraft(kind==='spoken'?{...base,kind,prompt:''}:kind==='choice'?{...base,kind,prompt:'',choices:['',''],answerIndex:0}:kind==='cloze'?{...base,kind,sentence:'sentence'in draft?draft.sentence:'',hiddenWordIndices:[]}:{...base,kind,sentence:'sentence'in draft?draft.sentence:''});}}>{Object.entries(questionKinds).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></label>
    {(draft.kind==='spoken'||draft.kind==='choice')&&<label>질문 내용<textarea value={draft.prompt} onChange={e=>setDraft({...draft,prompt:e.target.value})}/></label>}
    {draft.kind==='spoken'&&<details open={draft.modelAnswer?true:undefined}><summary>예시 답 (선택)</summary><label>예시 답<textarea value={draft.modelAnswer??''} onChange={e=>setDraft({...draft,modelAnswer:e.target.value})}/></label></details>}
    {draft.kind==='choice'&&<fieldset><legend>보기 · 왼쪽 원을 눌러 정답 선택</legend>{draft.choices.map((choice,i)=><label className="classroom-choice" key={i}><input type="radio" name="classroom-answer" aria-label={`보기 ${i+1} 정답`} checked={draft.answerIndex===i} onChange={()=>setDraft({...draft,answerIndex:i})}/><input aria-label={`보기 ${i+1}`} value={choice} onChange={e=>setDraft({...draft,choices:draft.choices.map((c,j)=>j===i?e.target.value:c)})}/></label>)}<button type="button" onClick={()=>setDraft({...draft,choices:[...draft.choices,'']})}>＋ 보기 추가</button></fieldset>}
    {(draft.kind==='cloze'||draft.kind==='scramble')&&<><label>완성 문장<textarea value={draft.sentence} onChange={e=>setDraft(draft.kind==='cloze'?{...draft,sentence:e.target.value,hiddenWordIndices:[]}:{...draft,sentence:e.target.value})}/></label>{lines.length>0&&<label>대본에서 가져오기<select defaultValue="" onChange={e=>{const line=lines[Number(e.target.value)];if(line)setDraft(draft.kind==='cloze'?{...draft,sentence:line.en,hiddenWordIndices:[]}:{...draft,sentence:line.en});}}><option value="" disabled>대사를 선택하세요</option>{lines.map((l,i)=><option key={i} value={i}>{clock(l.start-start)} · {l.en}</option>)}</select></label>}{draft.kind==='cloze'&&<div><p>가릴 단어를 누르세요.</p><div className="vq-choices">{sentenceWords(draft.sentence).map((w,i)=><button type="button" key={i} aria-pressed={draft.hiddenWordIndices.includes(i)} onClick={()=>setDraft({...draft,hiddenWordIndices:draft.hiddenWordIndices.includes(i)?draft.hiddenWordIndices.filter(n=>n!==i):[...draft.hiddenWordIndices,i]})}>{w}</button>)}</div></div>}</>}
    {error&&<p role="alert" className="vq-error">{error}</p>}
   </fieldset></div>
   <footer>{question&&<button className="classroom-delete" type="button" disabled={busy} onClick={()=>void commit(true)}>삭제</button>}<span/><button type="button" disabled={busy} onClick={cancel}>취소</button><button className="vq-primary" disabled={busy} type="submit">{busy?'저장 중…':'저장'}</button></footer>
  </form>}
 </section>;
}
