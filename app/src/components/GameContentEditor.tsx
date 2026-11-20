import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { guideFamily } from '../lib/gameGuide';
import type { GameEditDraft, GameEditRow } from '../lib/unifiedGameSettings';
import type { GameTemplateConfig, GameType, LiveQuestion } from '../lib/types';
import { RELATIONS, RELATION_NAMES } from '../lib/adventureGames';
import { SENTENCE_SLOTS, slotLabelKey } from '../lib/sentencePatterns';
import GameImagePicker from './GameImagePicker';
import { useGameWorkspace } from '../context/GameWorkspaceContext';

const button = 'min-h-11 rounded-xl border border-outline-variant bg-white px-4 py-2 font-bold text-deep-navy focus-visible:outline-4 focus-visible:outline-primary disabled:opacity-40';
export default function GameContentEditor({type, value, config, onChange, onEditing}: {type:GameType;value:GameEditDraft;config:GameTemplateConfig;onChange:(value:GameEditDraft)=>void;onEditing:(editing:boolean)=>void}) {
  const {i18n,t}=useTranslation();
  const workspace=useGameWorkspace();
  const en=i18n.language.startsWith('en'),text=(ko:string,eng:string)=>en?eng:ko;
  const [edit,setEdit]=useState<{id:string|null;cells:string[];live?:LiveQuestion}|null>(null);
  const [error,setError]=useState('');
  const family=guideFamily(type);
  const labels=value.cards ? [text(value.kind==='sentence'?'문장':'단어',value.kind==='sentence'?'Sentence':'Word'),text('뜻 · 해석','Meaning'),text('그림 (선택)','Image (optional)'),text('분류 (선택)','Category (optional)'),...(['wordtrain','sentencerocket'].includes(type)?[text('블록 경계 · | 로 구분 (비우면 단어 단위)','Chunks, separated by | (optional)')]:[])]
    : type==='grammardetective' ? [text('올바른 문장','Correct sentence'),text('틀린 문장 (비우면 자동 제안)','Incorrect sentence (leave blank for a suggestion)'),text('설명 (선택)','Explanation (optional)')]
    : ['wordtrain','sentencerocket'].includes(type) ? [text('문장','Sentence'),text('블록 경계 · | 로 구분 (비우면 단어 단위)','Chunks, separated by | (optional)')]
    : ['balloonpop','wordfishing','wordclaw'].includes(type) ? [text('단어','Word'),text('뜻','Meaning')]
    : type==='treasurehunt' ? [text('영어 힌트 문장','Clue sentence'),text('정답 지점','Correct location'),text('오답 지점 1','Wrong location 1'),text('오답 지점 2','Wrong location 2'),text('오답 지점 3','Wrong location 3')]
    : type==='quizshow'&&edit?.live&&edit.live.kind!=='choice' ? [text('문제 · 문장','Question / sentence'),text(edit.live.kind==='ox'?'정답 · O 또는 X':'정답','Answer')]
    : ['quiz','online','bridge','monster'].includes(family) ? [text('문제 · 문장','Question / sentence'),text('정답','Answer'),text('오답 1','Wrong answer 1'),text('오답 2','Wrong answer 2')]
    : family==='pairs' ? [text(type==='typeanswer'?'문제':'단어 · 문장','Word / sentence'),text('뜻 · 정답','Meaning / answer')]
    : family==='groups' ? [text('단어','Word'),text('분류','Group')]
    : family==='image' ? [text('정답 단어','Answer'),text('그림','Image')]
    : family==='ox' ? [text('문장','Statement'),text('정답 · O 또는 X','Answer · O or X')]
    : family==='slots' ? [text('단어 · 표현','Word / phrase'),text('문장 자리','Sentence slot')]
    : family==='tower' ? [text('추가할 표현','Phrase'),text('삽입 위치 (글자 수)','Insertion position'),text('오답 1','Wrong answer 1'),text('오답 2','Wrong answer 2')]
    : family==='diagram' ? [text('정답 단어','Answer'),text('가로 위치 (0~1)','X (0–1)'),text('세로 위치 (0~1)','Y (0–1)')]
    : [text(value.kind==='sentence'?'문장':'단어',value.kind==='sentence'?'Sentence':'Word')];
  function open(row?:GameEditRow) {setEdit({id:row?.id??null,cells:row?[...row.cells]:labels.map(()=> ''),live:!value.cards&&type==='quizshow'?structuredClone(row?.live??{id:crypto.randomUUID(),kind:'choice',prompt:'',points:1000,seconds:20}):undefined});setError('');onEditing(true);}
  function cancel(){setEdit(null);setError('');onEditing(false);}
  function confirm(){
    if(!edit?.cells[0]?.trim()){setError(text('내용을 입력해 주세요.','Enter some text.'));return;}
    const cells=edit.cells.map(s=>s.trim());
    if(edit.live&&(!Number.isFinite(edit.live.points??1000)||(edit.live.points??1000)<0||(edit.live.kind!=='buzzer'&&(!Number.isFinite(edit.live.seconds??20)||(edit.live.seconds??20)<5||(edit.live.seconds??20)>120)))){setError(text('점수와 제한 시간을 확인해 주세요.','Check the points and time limit.'));return;}
    if(edit.live?.kind==='ox'&&!['O','X'].includes(cells[1]?.toUpperCase())){setError(text('정답은 O 또는 X로 입력하세요.','Enter O or X as the answer.'));return;}
    if(type==='treasurehunt'&&(!cells[1]||!cells.slice(2).some(Boolean))){setError(text('정답 지점과 오답 지점을 선택하세요.','Choose correct and incorrect locations.'));return;}
    onChange({...value,rows:edit.id?value.rows.map(row=>row.id===edit.id?{...row,cells,live:edit.live}:row):[...value.rows,{id:crypto.randomUUID(),cells,live:edit.live}]});
    cancel();
  }
  function cell(index:number,next:string){setEdit(old=>old?{...old,cells:Array.from({length:Math.max(old.cells.length,index+1)},(_,j)=>j===index?next:old.cells[j]??'')}:null);}
  function form(){return <div className="mt-3 space-y-3 rounded-xl bg-sky-50 p-3" data-game-item-form>
    {Array.from({length:Math.max(labels.length,edit?.cells.length??0)},(_,i)=><label key={i} className="block text-sm font-bold">{labels[i]??text(`오답 ${i-1}`,`Wrong answer ${i-1}`)}
      {((value.cards&&i===2)||(family==='image'&&i===1))?<GameImagePicker academyId={workspace?.info?.academyId??''} value={edit?.cells[i]||null} onChange={url=>cell(i,url??'')}/>
        :type==='treasurehunt'&&i>0?<select className="mt-1 min-h-11 w-full rounded-xl border bg-white p-2" value={edit?.cells[i]??''} onChange={e=>cell(i,e.target.value)}><option value="">—</option>{config.adventure?.places.flatMap(place=>RELATIONS.map(relation=><option key={place.id+':'+relation} value={place.id+':'+relation}>{place.name} · {RELATION_NAMES[relation]}</option>))}</select>
        :family==='slots'&&i===1?<select className="mt-1 min-h-11 w-full rounded-xl border bg-white p-2" value={edit?.cells[i]??''} onChange={e=>cell(i,e.target.value)}><option value="">—</option>{SENTENCE_SLOTS.map(slot=><option key={slot} value={slot}>{t(slotLabelKey(slot))}</option>)}</select>
        :<input autoFocus={i===0} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-white px-3 py-2 font-normal" value={edit?.cells[i]??''} onChange={e=>cell(i,e.target.value)} />}
    </label>)}
    {edit?.live&&<>
      {!edit.live.style&&<label className="block font-bold">{text('답하는 방식','Answer mode')}<select className="mt-1 min-h-11 w-full rounded-xl border bg-white p-2" value={edit.live.kind} onChange={e=>setEdit(old=>old?.live?{...old,cells:old.cells.slice(0,2),live:{...old.live,kind:e.target.value as LiveQuestion['kind']}}:old)}>{(['choice','ox','text','buzzer'] as const).map(kind=><option key={kind} value={kind}>{({choice:text('보기 고르기','Multiple choice'),ox:'O · X',text:text('답 입력','Type an answer'),buzzer:text('부저','Buzzer')})[kind]}</option>)}</select></label>}
      <label className="block font-bold">{text('점수','Points')}<input className="mt-1 min-h-11 w-full rounded-xl border bg-white p-2" type="number" min={0} value={edit.live.points??1000} onChange={e=>setEdit(old=>old?.live?{...old,live:{...old.live,points:e.target.valueAsNumber}}:old)}/></label>
      {edit.live.kind!=='buzzer'&&<label className="block font-bold">{text('제한 시간(초)','Time limit (sec)')}<input className="mt-1 min-h-11 w-full rounded-xl border bg-white p-2" type="number" min={5} max={120} value={edit.live.seconds??20} onChange={e=>setEdit(old=>old?.live?{...old,live:{...old.live,seconds:e.target.valueAsNumber}}:old)}/></label>}
    </>}
    {error&&<p role="alert" className="text-error">{error}</p>}
    <div className="flex justify-end gap-2"><button type="button" className={button} onClick={cancel}>{text('취소','Cancel')}</button><button type="button" className={`${button} bg-primary! text-white!`} onClick={confirm}>{text('확인','Confirm')}</button></div>
  </div>;}
  return <section className="space-y-3 border-t border-outline-variant pt-4" aria-label={text('직접 입력 · 문제 편집','Enter text or edit questions')} data-game-content-editor>
    <h3 className="text-lg font-extrabold">{text('직접 입력 · 문제 편집','Enter text or edit questions')}</h3>
    <p className="text-sm font-bold">{text('지금 쓰는 자료: ','Current material: ')}{value.name || text('직접 입력','Direct input')} · {value.rows.length}{text('개',' items')}</p>
    <p className="text-sm text-on-surface-variant">{text('이번 게임에 쓸 목록만 바뀌어요. 저장된 원본 자료는 그대로 보존됩니다.','Edits affect this game only. Your saved source list is preserved.')}</p>
    <button type="button" className={button} onClick={()=>open()}>{text('추가','Add')}</button>
    {edit?.id===null&&form()}
    <ol className="space-y-2">{value.rows.map((row,i)=><li key={row.id} className="rounded-xl border border-outline-variant p-3" data-game-edit-row>
      <div className="flex flex-wrap items-start gap-2"><p className="min-w-0 flex-1 break-words font-bold">{i+1}. {row.cells[0]}{value.cards&&row.cells[1]&&<span className="ml-2 font-normal text-on-surface-variant">{row.cells[1]}</span>}</p>
        <button type="button" className={button} aria-label={text(`${i+1}번 수정`,`Edit item ${i+1}`)} onClick={()=>open(row)}>{text('수정','Edit')}</button>
        <button type="button" className={`${button} text-error`} aria-label={text(`${i+1}번 삭제`,`Delete item ${i+1}`)} onClick={()=>{onChange({...value,rows:value.rows.filter(r=>r.id!==row.id)});if(edit?.id===row.id)cancel();}}>{text('삭제','Delete')}</button>
      </div>{edit?.id===row.id&&form()}
    </li>)}</ol>
    {!value.rows.length&&<p>{text('추가를 눌러 이번 게임에 쓸 항목을 입력하세요.','Add items for this game.')}</p>}
  </section>;
}
