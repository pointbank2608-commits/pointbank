import {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {defaultDetectiveRules, DETECTIVE_RULES, detectiveCaseFromVariant, previewDetectiveDraft} from '../../lib/detectiveSuggestion';
import type {AdventureConfig, DetectiveCase} from '../../lib/adventureGames';
import type {WordList} from '../../lib/types';
import WordListPicker from '../WordListPicker';

export default function DetectiveGenerator({draft, count, lists, loading, onGenerate, onDraftChange, onReview}: {
  draft?: AdventureConfig['detectiveDraft'];
  count: number;
  lists: WordList[];
  loading: boolean;
  onGenerate: (draft: NonNullable<AdventureConfig['detectiveDraft']>, cases: DetectiveCase[]) => void;
  onDraftChange: (dirty: boolean) => void;
  onReview: (correct: string, context: string, draft: NonNullable<AdventureConfig['detectiveDraft']>) => void;
}){
  const {i18n}=useTranslation();
  const en=i18n.resolvedLanguage?.startsWith('en')??false;
  const l=(ko:string, english:string)=>en?english:ko;
  const [sentences,setSentences]=useState(draft?.sentences??'');
  const [rules,setRules]=useState<string[]>(draft?.rules??defaultDetectiveRules);
  const [notice,setNotice]=useState('');
  const preview=useMemo(()=>previewDetectiveDraft(sentences,rules),[sentences,rules]);
  const available=preview.ready.slice(0,50);
  const cases=available.slice(0,count);
  function revise(value:string){
    setSentences(value);
    setNotice('');
    onDraftChange(value !== (draft?.sentences??'') || rules.join() !== (draft?.rules??defaultDetectiveRules).join());
  }
  function selectRules(value:string[]){
    setRules(value);
    setNotice('');
    onDraftChange(sentences !== (draft?.sentences??'') || value.join() !== (draft?.rules??defaultDetectiveRules).join());
  }
  return <div className="ad-edit-card" data-detective-generator>
    <h3>{l('내 문장으로 문제 만들기','Make questions from my sentences')}</h3>
    <p>{l('저장한 문장을 불러오거나 직접 입력하고, 출제할 문법을 골라 미리보기를 확인하세요.', 'Load saved sentences or enter your own, then choose grammar rules and check the preview.')}</p>
    <WordListPicker variant="full" kind="sentence" wordLists={lists} loading={loading}
      onImportFull={rows=>revise([sentences.trim(),...rows.map(row=>row.word.trim())].filter(Boolean).join('\n'))}/>
    <label>{l('올바른 영어 문장 (한 줄에 하나)','Correct English sentences (one per line)')}
      <textarea aria-label={l('올바른 영어 문장 (한 줄에 하나)','Correct English sentences (one per line)')}
        rows={5} value={sentences} placeholder={'She can swim.\nShe needs a pencil.\nThis bag is bigger than mine.'} onChange={event=>revise(event.target.value)}/>
    </label>
    <p>{l('뜻이나 상황을 보여주고 싶으면 문장 뒤에 | 를 쓰고 단서를 입력하세요. 영어 문장만으로도 만들 수 있어요.', 'To show a clue, add | after the sentence and enter the meaning or situation. English sentences alone work too.')}</p>
    <fieldset className="ad-detective-rule-set">
      <legend>{l('출제할 문법 (여러 개 선택)','Grammar to include (select any)')}</legend>
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
        <p role="status">{l(`출제 가능 ${preview.ready.length}문제 · 이번 게임 ${cases.length}문제 · 확인 필요 ${preview.review.length}문장`,`${preview.ready.length} ready · ${cases.length} in this game · ${preview.review.length} to review`)}</p>
        {preview.ready.length>50&&<p>{l('한 게임에는 최대 50문제를 넣을 수 있어요.','A game can contain up to 50 questions.')}</p>}
        <ul className="ad-detective-counts">{DETECTIVE_RULES.filter(rule=>rules.includes(rule.id)).map(rule=>{
          const amount=preview.counts.get(rule.id)?.length??0;
          return <li key={rule.id}>{en?rule.en:rule.ko} · {amount}{l('문제',' questions')}
            {amount===0&&<small lang="en">{rule.example}</small>}</li>;
        })}</ul>
        {cases.length>0&&<ol className="ad-detective-review-list">{cases.map(({variant,context,index})=><li key={index}>
          {context&&<p>{context}</p>}<span lang="en">{variant.incorrect} → <strong>{variant.correct}</strong></span>
        </li>)}</ol>}
        {preview.review.length>0&&<details open>
          <summary>{l('출제에서 제외된 문장 확인','Review sentences left out')}</summary>
          <p>{l('선택한 문법에서 오류가 분명한 문제를 찾지 못했어요. 뜻에 따라 둘 다 맞을 수 있거나 자동 출제 범위 밖인 문장입니다. 필요하면 아래에서 사건을 직접 추가하세요.', 'No clear error was found for the selected grammar. A sentence may allow more than one reading or fall outside the supported patterns. You can add a case manually below.')}</p>
          <ol className="ad-detective-review-list">{preview.review.map(row=><li key={row.index}>
            <span lang="en">{row.correct}</span>{row.context&&<small> · {row.context}</small>}
            {' '}<button type="button" onClick={()=>onReview(row.correct,row.context,{sentences,rules})}>{l('직접 문제 만들기','Write a question')}</button>
          </li>)}</ol>
        </details>}
      </>}
      <button type="button" className="ad-apply" disabled={!cases.length||!!notice} onClick={()=>{
        onGenerate({sentences,rules},available.map(({variant,context})=>detectiveCaseFromVariant(variant,undefined,context||undefined)));
        setNotice(l('아래 게임 문제를 교체했어요. 적용을 누르면 이 문제로 게임을 열어요.', 'Game questions replaced below. Apply to open the game with these questions.'));
      }}>{l('이 문제들로 바꾸기','Replace with these questions')}</button>
      {notice&&<p role="status">{notice}</p>}
    </section>}
    {(sentences!==(draft?.sentences??'')||rules.join()!==(draft?.rules??defaultDetectiveRules).join())&&
      <button type="button" onClick={()=>{setSentences(draft?.sentences??'');setRules(draft?.rules??defaultDetectiveRules);setNotice('');onDraftChange(false);}}>
        {l('미리보기 변경 취소','Discard preview changes')}
      </button>}
  </div>;
}
