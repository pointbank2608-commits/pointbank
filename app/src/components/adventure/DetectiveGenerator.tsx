import {useImperativeHandle, useMemo, useState, type Ref} from 'react';
import {useTranslation} from 'react-i18next';
import {defaultDetectiveRules, DETECTIVE_RULES, detectiveCaseFromVariant, previewDetectiveDraft} from '../../lib/detectiveSuggestion';
import type {DetectiveCase} from '../../lib/adventureGames';
import type {WordList} from '../../lib/types';
import WordListPicker from '../WordListPicker';

export type DetectiveInput = {text:string; rules:string[]};
export type DetectiveGeneratorHandle = {importWords: (rows: string[]) => void};

export default function DetectiveGenerator({ref, source='sentences', initialText='', initialRules=defaultDetectiveRules, busy=false, lists, loading, onGenerate, onDraftChange, onReview}: {
  ref?: Ref<DetectiveGeneratorHandle>;
  source?: 'words' | 'sentences';
  initialText?: string;
  initialRules?: readonly string[];
  busy?: boolean;
  lists: WordList[];
  loading: boolean;
  onGenerate: (input: DetectiveInput, cases: DetectiveCase[]) => void;
  onDraftChange: (draft: DetectiveInput | null) => void;
  onReview?: (correct: string, context: string, draft: {sentences:string; rules:string[]}) => void;
}){
  const {i18n}=useTranslation();
  const en=i18n.resolvedLanguage?.startsWith('en')??false;
  const l=(ko:string, english:string)=>en?english:ko;
  const words=source==='words';
  const [sentences,setSentences]=useState(initialText);
  const [rules,setRules]=useState<string[]>(()=>[...initialRules]);
  const changed=sentences!==initialText||rules.join()!==initialRules.join();
  const preview=useMemo(()=>previewDetectiveDraft(words?sentences.replaceAll(',', '\n'):sentences,rules,source),[sentences,rules,source,words]);
  const cases=preview.ready;
  function revise(value:string){
    setSentences(value);
    onDraftChange(value !== initialText || rules.join() !== initialRules.join()?{text:value,rules}:null);
  }
  function importWords(rows:string[]){
    revise([sentences.trim(),...rows.map(row=>row.trim())].filter(Boolean).join('\n'));
  }
  useImperativeHandle(ref,()=>({importWords}));
  function selectRules(value:string[]){
    setRules(value);
    onDraftChange(sentences !== initialText || value.join() !== initialRules.join()?{text:sentences,rules:value}:null);
  }
  const inputLabel=words?l('영어 단어 (한 줄에 하나 또는 쉼표로 구분)','English words (one per line or comma separated)'):l('올바른 영어 문장 (한 줄에 하나)','Correct English sentences (one per line)');
  return <div className="ad-edit-card" data-detective-generator={source}>
    <h3>{words?l('내 단어로 문제 만들기','Make questions from my words'):l('내 문장으로 문제 만들기','Make questions from my sentences')}</h3>
    <p>{words?l('단어장을 불러오거나 영어 단어를 입력하세요. 예를 들어 apple로 관사 a/an 문제를 만들 수 있어요.', 'Load a word list or enter English words. For example, apple can make an a/an question.'):l('저장한 문장을 불러오거나 직접 입력하고, 출제할 문법을 골라 미리보기를 확인하세요.', 'Load saved sentences or enter your own, then choose grammar rules and check the preview.')}</p>
    <WordListPicker variant="full" kind={words?'word':'sentence'} wordLists={lists} loading={loading}
      onImportFull={rows=>importWords(rows.map(row=>row.word))}/>
    <label>{inputLabel}
      <textarea aria-label={inputLabel}
        rows={5} value={sentences} placeholder={words?'apple, book, swim':'She can swim.\nShe needs a pencil.\nThis bag is bigger than mine.'} onChange={event=>revise(event.target.value)}/>
    </label>
    {!words&&<p>{l('뜻이나 상황을 보여주고 싶으면 문장 뒤에 | 를 쓰고 단서를 입력하세요. 영어 문장만으로도 만들 수 있어요.', 'To show a clue, add | after the sentence and enter the meaning or situation. English sentences alone work too.')}</p>}
    <fieldset className="ad-detective-rule-set">
      <legend>{words?l('내 단어에 적용할 문법 (여러 개 선택)','Grammar for my words (select any)'):l('내 문장에 적용할 문법 (여러 개 선택)','Grammar for my sentences (select any)')}</legend>
      <div className="ad-detective-rule-actions">
        <button type="button" onClick={()=>selectRules(defaultDetectiveRules)}>{l('전체 선택','Select all')}</button>
        <button type="button" onClick={()=>selectRules([])}>{l('선택 지우기','Clear selection')}</button>
      </div>
      <div className="ad-detective-rules">
        {DETECTIVE_RULES.map(rule=><label key={rule.id}><input type="checkbox" checked={rules.includes(rule.id)}
          onChange={event=>selectRules(event.target.checked?[...rules,rule.id]:rules.filter(id=>id!==rule.id))}/>
          <span>{en?rule.en:rule.ko}</span>
        </label>)}
      </div>
    </fieldset>
    {!!sentences.trim()&&<section className="ad-detective-preview" aria-label={l('문제 미리보기','Question preview')}>
      <h4>{l('문제 미리보기','Question preview')}</h4>
      {rules.length===0?<p>{l('출제할 문법을 한 가지 이상 고르세요.','Select at least one grammar topic.')}</p>:<>
        <p role="status">{l(`출제 가능 ${cases.length}문제 · 이번 게임 ${cases.length}문제 · 확인 필요 ${preview.review.length}${words?'단어':'문장'}`,`${cases.length} ready · ${cases.length} in this game · ${preview.review.length} to review`)}</p>
        <ul className="ad-detective-counts">{DETECTIVE_RULES.filter(rule=>rules.includes(rule.id)).map(rule=>{
          const amount=preview.counts.get(rule.id)?.length??0;
          return <li key={rule.id}>{en?rule.en:rule.ko} · {amount}{l('문제',' questions')}
            {amount===0&&<small lang="en">{rule.example}</small>}</li>;
        })}</ul>
        {cases.length>0&&<ol className="ad-detective-review-list">{cases.map(({variant,context,index})=><li key={index}>
          {context&&<p>{context}</p>}<span lang="en">{variant.incorrect} → <strong>{variant.correct}</strong></span>
        </li>)}</ol>}
        {preview.review.length>0&&<details open>
          <summary>{words?l('출제에서 제외된 단어 확인','Review words left out'):l('출제에서 제외된 문장 확인','Review sentences left out')}</summary>
          <p>{words?l('이 단어로는 선택한 문법의 문제를 만들기 어려워요. 단어가 들어간 문장을 직접 입력해 보세요.', 'These words could not make questions for the selected rules. Try entering sentences that use them.'):l('선택한 문법에서 오류가 분명한 문제를 찾지 못했어요. 뜻에 따라 둘 다 맞을 수 있거나 자동 출제 범위 밖인 문장입니다. 필요하면 아래에서 사건을 직접 추가하세요.', 'No clear error was found for the selected grammar. A sentence may allow more than one reading or fall outside the supported patterns. You can add a case manually below.')}</p>
          <ol className="ad-detective-review-list">{preview.review.map(row=><li key={row.index}>
            <span lang="en">{row.correct}</span>{row.context&&<small> · {row.context}</small>}
            {onReview&&<> <button type="button" onClick={()=>onReview(row.correct,row.context,{sentences,rules})}>{l('직접 문제 만들기','Write a question')}</button></>}
          </li>)}</ol>
        </details>}
      </>}
      <button type="button" className="ad-apply" disabled={busy||!cases.length} onClick={()=>{
        onGenerate({text:sentences,rules},cases.map(({variant,context})=>detectiveCaseFromVariant(variant,undefined,context||undefined)));
      }}>{busy?l('적용하는 중…','Applying…'):l('이 문제로 게임 시작','Start game with these questions')}</button>
    </section>}
    {changed&&
      <button type="button" onClick={()=>{setSentences(initialText);setRules([...initialRules]);onDraftChange(null);}}>
        {l('미리보기 변경 취소','Discard preview changes')}
      </button>}
  </div>;
}
