import {useReducer, useRef, useState, type Ref, type SetStateAction} from 'react';
import {useTranslation} from 'react-i18next';
import {grammarBoardContent, type GrammarBoardContent, type GrammarPoint} from '../lib/grammar';
import {PresentSyncContext} from '../lib/presentSync';
import {useAuth} from '../context/AuthContext';
import {uploadLessonSlideImage} from '../lib/api';
import {schoolOf} from '../../../supabase/functions/_shared/grammarWorkshop';
import AccessibleDialog from './AccessibleDialog';
import GrammarBoard, {type GrammarBoardEditor, type GrammarBoardPosition} from './GrammarBoard';
import {ActiveTextContext} from './grammar/InlineWorkshopEdit';
import {WorkshopSettings} from './grammar/WorkshopEditor';
import './GrammarContentEditor.css';

type Draft = GrammarBoardContent;
interface History {current:Draft; previous:Draft[]; group:number}
type Action = {change:SetStateAction<Draft>; group:number} | {undo:true};
function reduce(history:History, action:Action):History {
  if('undo' in action) {
    const current=history.previous.at(-1);
    return current?{current,previous:history.previous.slice(0,-1),group:-1}:history;
  }
  const current=typeof action.change==='function'?action.change(history.current):action.change;
  const previous=history.group===action.group?history.previous:[...history.previous.slice(-29),history.current];
  return {current,previous,group:action.group};
}

export default function GrammarContentEditor({point,inline,initialPosition,onPositionChange,titleRef,onClose,onSave,saveLabel}:{
  point:GrammarPoint;inline?:boolean;themeId?:string|null;initialRevealAll?:boolean;initialShowKo?:boolean;
  initialPosition?:GrammarBoardPosition;onPositionChange?:(position:GrammarBoardPosition)=>void;titleRef?:Ref<HTMLInputElement>;
  onClose:()=>void;onSave:(content:Draft)=>Promise<void>|void;saveLabel:string;
}) {
  const {t}=useTranslation();
  const {academy}=useAuth();
  const [history,dispatch]=useReducer(reduce,point,p=>({current:structuredClone(grammarBoardContent(p)),previous:[],group:-1}));
  const draft=history.current;
  const group=useRef(0);
  const lock=useRef(false);
  const [active,select]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  function setDraft(change:SetStateAction<Draft>) {
    dispatch({change,group:group.current});
    setError('');
  }
  function scene(key:'opening'|'model'|'task',value:string) {
    setDraft(old=>{
      const w=old.workshop!;
      const school=schoolOf(w.grade);
      return {...old,workshop:{...w,scenes:{...w.scenes,[school]:{...w.scenes[school],[key]:value}}}};
    });
  }
  function stepText(index:number,key:'prompt'|'followUp',value:string){
    setDraft(old=>({...old,steps:old.steps?.map((step,i)=>i===index?{...step,[key]:value}:step)}));
  }
  const editor:GrammarBoardEditor={
    goal:goal=>setDraft(old=>({...old,goal})),
    prompt:(index,value)=>index===0?scene('opening',value):stepText(index,'prompt',value),
    stage:index=>({
      practice:change=>setDraft(old=>({...old,steps:old.steps?.map((s,i)=>i===index&&s.practice?{...s,practice:change(s.practice)}:s)})),
      task:v=>scene('task',v),model:v=>scene('model',v),followUp:v=>stepText(index,'followUp',v),
      async upload(file,apply){
        if(lock.current)return;
        if(!academy){setError('그림을 저장할 학원 정보를 확인해 주세요.');return;}
        lock.current=true;setBusy(true);setError('');
        try{const {url}=await uploadLessonSlideImage(academy.id,file);group.current++;apply(url);}
        catch{setError('그림을 저장하지 못했어요. 다시 선택해 주세요.');}
        finally{lock.current=false;setBusy(false);}
      },
    }),
  };
  async function save(){
    if(lock.current)return;
    const name=draft.name.trim();
    if (!name || !draft.pattern.trim() || !draft.examples.length || draft.examples.some(en => !en.trim())) {
      setError(t('myGrammar.required')); return;
    }
    if(draft.steps?.some(s=>s.practice?.panels?.some(line=>line.glosses && (line.glosses.length!==line.chunks.length || line.glosses.some(gloss=>!gloss.trim()))))){
      setError('예문에서 영어 조각마다 우리말 뜻을 채워 주세요.');return;
    }
    if(Object.values(draft.workshop?.overrides??{}).some(q=>
      !q.prompt.trim() || !q.answer.trim() || !q.reason.trim() || q.kind==='order'&&q.answer.trim().split(/\s+/).length<3 || q.options&&(
        !q.options.includes(q.answer)||q.options.some(s=>!s.trim())||new Set(q.options.map(s=>s.trim())).size!==q.options.length))){
      setError('심화 문제의 보기와 정답, 풀이를 확인해 주세요.');return;
    }
    if (draft.workshop && Object.values(draft.workshop.scenes).some(scene=>Object.values(scene).some(v=>!v.trim())) ||
        draft.steps?.some(({ prompt, hint, answer, followUp,practice },i) => [prompt, ...(draft.workshop ? (i===5 ? [followUp] : []) : [hint,answer,followUp]),
          ...(practice?[practice.title]:[]), ...(practice?.assembly??[]), ...(practice?.map?.flatMap(entry=>[entry.label,entry.text])??[]), ...(practice?.why.flat()??[]), ...(practice?.panels?.flatMap(p=>[p.meaning,p.label,...p.chunks])??[]),
          ...(practice && 'choices'in practice?practice.choices.flat():[])].some(value => !value.trim()))) {
      setError('빈 항목이 있어요. 새로 추가한 카드의 제목·예문·뜻, 질문과 설명을 채우거나 −로 빼 주세요.'); return;
    }
    lock.current=true;setBusy(true);
    try{
      await onSave({...draft,name});
      onClose();
    }catch{setError(t('myGrammar.saveFailed'));}
    finally{lock.current=false;setBusy(false);}
  }
  const body=<section className="grammar-visual-editor space-y-3" aria-label="문법 편집"
    onFocusCapture={()=>{group.current++;}}>
    <div className="workshop-edit-toolbar">
      <strong>문법 편집</strong>
      <button type="button" disabled={!history.previous.length||busy} onClick={()=>dispatch({undo:true})}>↶ 되돌리기</button>
      <button type="button" disabled={busy} onClick={onClose}>취소</button>
      <button type="button" className="workshop-save" disabled={busy} onClick={()=>void save()}>{saveLabel}</button>
      {error&&<p role="alert" className="text-error">{error}</p>}
    </div>
    <div inert={busy} aria-busy={busy} className="space-y-2">
      <label className="block">문법 제목<input aria-label="문법 제목" ref={titleRef} className="ml-1 max-w-full rounded border p-1" value={draft.name}
        onChange={e=>{const name=e.target.value;setDraft(old=>({...old,name}));}}/></label>
      <p className="text-sm">바꾸고 싶은 글이나 그림을 눌러 주세요.</p>
      <div className="workshop-reading"><PresentSyncContext.Provider value={null}>
        <ActiveTextContext.Provider value={{active,select}}><GrammarBoard point={{...point,...draft}} mode="prepare" editor={editor} keyboard={false} initialPosition={initialPosition} onPositionChange={onPositionChange}/></ActiveTextContext.Provider>
      </PresentSyncContext.Provider></div>
      <WorkshopSettings draft={draft} setDraft={setDraft} disabled={busy}/>
    </div>
  </section>;
  return inline?body:<AccessibleDialog label={t('myGrammar.edit')} onClose={()=>{if(!lock.current)onClose();}}>
    <div className="p-4">{body}</div>
  </AccessibleDialog>;
}
