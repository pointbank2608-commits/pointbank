import { useTranslation } from 'react-i18next';
import type { HwQuestion } from '../../lib/homework/types';
import './review-word-targets.css';

export default function ReviewWordTargets({question,disabled,onAnswer}:{
  question:HwQuestion; disabled:boolean; onAnswer:(option:string)=>void;
}) {
  const {i18n}=useTranslation();
  return <section className="hw-review-targets">
    <p>{i18n.language.startsWith('en')?'Tap the target with the matching word.':'뜻에 맞는 영어 단어의 과녁을 쏘세요.'}</p>
    <h2>{question.prompt}</h2>
    <div>{question.choices?.map((word,index)=><button type="button" key={index} disabled={disabled} onClick={()=>onAnswer(String(index))}>
      <span aria-hidden="true">◎</span><strong>{word}</strong>
    </button>)}</div>
  </section>;
}
