import { useState } from 'react';
import type {
  GrammarBlockAction, GrammarBlockFeedback, GrammarBlockStep, GrammarExample, GrammarQuestionPhase,
} from '../../lib/grammarLearningContent';
import {
  StudioCard, StudioChunks, StudioFeedback, StudioOptions, StudioPrompt, type StudioOption,
} from '../studio/StudioKit';

const phaseTitle: Record<GrammarQuestionPhase, string> = {
  reasoning: '왜 그런지 골라 봐요',
  practice: '다른 문장으로 연습해요',
  transfer: '새 문장을 혼자 풀어 봐요',
  delayed: '기억을 되살려 혼자 풀어 봐요',
};

const inner = 'space-y-3 rounded-2xl border border-[#eadfc5] bg-[#fffdf8] p-4';
const primary = 'min-h-12 rounded-full bg-[#3b5bdb] px-8 text-lg font-bold text-white shadow active:scale-95 disabled:opacity-50';

function Example({ example }: { example: GrammarExample }) {
  return <div className={inner}>
    <p lang="en" className="break-words text-xl font-extrabold text-[#1c2742]">{example.sentence}</p>
    <p className="text-[#4a5470]">{example.translation}</p>
    <StudioChunks chunks={example.chunks} />
    <p className="leading-relaxed">{example.why}</p>
  </div>;
}

/** 방금 고른 답(새로고침 뒤에는 없을 수 있다) */
export interface GrammarPicked { sentence: string; prompt: string; text: string; phase?: GrammarQuestionPhase }

export function GrammarAnswerFeedback({ feedback, picked, onContinue, busy = false }: {
  feedback: GrammarBlockFeedback;
  picked?: GrammarPicked;
  onContinue: () => void;
  busy?: boolean;
}) {
  const options: StudioOption[] | null = picked ? [{ id: 'picked', text: picked.text, state: feedback.correct ? 'correct' : 'wrong' }] : null;
  return <StudioCard label="답변 설명" barSpace>
    {picked && <StudioPrompt guide={picked.phase ? phaseTitle[picked.phase] : undefined} text={picked.sentence} lang="en" />}
    {options && <>
      <p className="mt-5 text-sm font-bold text-[#5b6580]">내가 고른 이유</p>
      <StudioOptions options={options} disabled onPick={() => undefined} label="내가 고른 답" className="mt-2" />
    </>}
    <StudioFeedback
      correct={feedback.correct}
      title={feedback.correct ? '이렇게 판단하면 돼요' : '이 부분을 다시 살펴봐요'}
      body={<p>{feedback.explanation}</p>}
      onNext={onContinue}
      nextLabel="계속하기"
      busy={busy}
    />
  </StudioCard>;
}

export default function GrammarLearningBlock({ step, busy = false, onAction }: {
  step: GrammarBlockStep;
  busy?: boolean;
  onAction: (action: GrammarBlockAction) => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  if (step.phase === 'explain' || step.phase === 'repair') {
    const isExplain = step.phase === 'explain';
    const examples = isExplain ? step.examples : [step.example];
    return <StudioCard label={isExplain ? '예문 비교' : '다른 방법으로 설명'}>
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold leading-snug">{isExplain ? step.objective : '이번엔 이렇게 살펴봐요'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {examples.map(example => <Example key={example.sentence} example={example} />)}
        </div>
        {isExplain
          ? <div className={`${inner} leading-relaxed`}><p>{step.rule}</p><p>{step.boundary}</p></div>
          : <p className={`${inner} leading-relaxed`}>{step.explanation}</p>}
        <button type="button" className={primary} disabled={busy} onClick={() => onAction({ type: 'continue' })}>
          {isExplain ? '이유 골라 보기' : '연습해 보기'}
        </button>
      </div>
    </StudioCard>;
  }

  const { item, phase } = step;
  const options: StudioOption[] = item.options.map(option => ({ id: option.id, text: option.text, state: pickedId === option.id ? 'selected' : 'idle' }));
  return <StudioCard label={phaseTitle[phase]}>
    <StudioPrompt guide={phaseTitle[phase]} text={item.sentence} sub={item.prompt} lang="en" />
    <StudioOptions
      key={item.id}
      options={options}
      disabled={busy || pickedId !== null}
      label="보기"
      onPick={optionId => { setPickedId(optionId); onAction({ type: 'answer', itemId: item.id, optionId }); }}
    />
  </StudioCard>;
}
