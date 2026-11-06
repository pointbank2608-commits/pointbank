import { useState } from 'react';
import {
  advanceGrammarPreview, grammarBlockStep, type GrammarBlockFeedback, type GrammarLesson, type GrammarPreviewPhase,
} from '../../lib/grammarLearningContent';
import GrammarLearningBlock, { GrammarAnswerFeedback } from './GrammarLearningBlock';

export default function GrammarLearningPreview({ lesson }: { lesson: GrammarLesson }) {
  return <Preview key={`${lesson.goalId}:${lesson.version}`} lesson={lesson} />;
}

function Preview({ lesson }: { lesson: GrammarLesson }) {
  const [phase, setPhase] = useState<GrammarPreviewPhase>('explain');
  const [feedback, setFeedback] = useState<GrammarBlockFeedback>();
  const advance = (action: Parameters<typeof advanceGrammarPreview>[2]) => {
    const result = advanceGrammarPreview(lesson, phase, action);
    if (!result) return;
    setPhase(result.phase);
    setFeedback(result.feedback);
  };

  return <div className="space-y-4 text-on-surface" lang="ko">
    <header>
      <p className="text-sm">교사 미리보기</p>
      <h1 className="text-xl font-bold">{lesson.title}</h1>
    </header>
    {feedback
      ? <GrammarAnswerFeedback feedback={feedback} onContinue={() => setFeedback(undefined)} />
      : phase === 'waiting'
        ? <section className="space-y-3">
            <p>학생에게는 시간이 지난 뒤 새 문장이 열려요.</p>
            <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-on-primary"
              onClick={() => advance({ type: 'continue' })}>지연 확인 미리 보기</button>
          </section>
        : phase === 'finished'
          ? <section className="space-y-3">
              <p>미리보기가 끝났어요.</p>
              <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-on-primary"
                onClick={() => setPhase('explain')}>처음부터 다시 보기</button>
            </section>
          : <GrammarLearningBlock step={grammarBlockStep(lesson, phase)} onAction={advance} />}
  </div>;
}
