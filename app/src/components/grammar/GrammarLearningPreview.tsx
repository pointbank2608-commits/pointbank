import { useState } from 'react';
import {
  advanceGrammarPreview, gradeGrammarPreview, grammarBlockStep, grammarQuestionStep,
  type GrammarBlockAction, type GrammarBlockFeedback, type GrammarLesson, type GrammarPreviewPhase, type GrammarQuestionPhase,
} from '../../lib/grammarLearningContent';
import GrammarLearningBlock, { GrammarAnswerFeedback } from './GrammarLearningBlock';

export default function GrammarLearningPreview({ lesson }: { lesson: GrammarLesson }) {
  if (lesson.adaptive) return <AdaptivePreview key={lesson.goalId + ':' + lesson.version} lesson={lesson} />;
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

type AdaptivePhase = 'explain' | 'repair' | GrammarQuestionPhase | 'waiting' | 'finished';

function AdaptivePreview({ lesson }: { lesson: GrammarLesson }) {
  const [phase, setPhase] = useState<AdaptivePhase>('explain');
  const [index, setIndex] = useState(0);
  const [diagnosed, setDiagnosed] = useState(0);
  const [practice, setPractice] = useState<boolean[]>([]);
  const [transferred, setTransferred] = useState(0);
  const [feedback, setFeedback] = useState<GrammarBlockFeedback>();
  const enter = (next: AdaptivePhase) => { setPhase(next); setIndex(0); };
  const questions = lesson.adaptive!;
  const item = phase === 'reasoning' || phase === 'practice' || phase === 'transfer' || phase === 'delayed'
    ? questions[phase][index] : undefined;
  function advance(action: GrammarBlockAction) {
    if (action.type === 'continue') {
      if (phase === 'explain') enter('reasoning');
      if (phase === 'repair') enter('practice');
      return;
    }
    if (!item || item.id !== action.itemId) return;
    const result = gradeGrammarPreview(item, action.optionId);
    if (!result) return;
    if (result.correct && phase === 'reasoning') setDiagnosed(n => n + 1);
    if (phase === 'practice') setPractice(previous => [...previous, result.correct]);
    if (result.correct && phase === 'transfer') setTransferred(n => n + 1);
    setFeedback(result);
  }
  function afterAnswer() {
    setFeedback(undefined);
    if (phase === 'reasoning' && index === 2) enter(diagnosed === 3 ? 'practice' : 'repair');
    else if (phase === 'practice' && (index === 8 || (index === 4 && practice.filter(Boolean).length >= 4 && practice.slice(-2).every(Boolean)))) enter('transfer');
    else if (phase === 'transfer' && index === 3) enter('waiting');
    else if (phase === 'delayed' && index + 1 === (transferred === 4 ? 4 : 6)) enter('finished');
    else setIndex(n => n + 1);
  }
  const step = item && phase !== 'explain' && phase !== 'repair' && phase !== 'waiting' && phase !== 'finished'
    ? grammarQuestionStep(phase, item) : phase === 'explain' || phase === 'repair' ? grammarBlockStep(lesson, phase) : undefined;

  return <div className="space-y-4 text-on-surface" lang="ko">
    <header>
      <p className="text-sm">교사 미리보기</p>
      <h1 className="text-xl font-bold">{lesson.title}</h1>
      <p>첫날 12~16문항 · 다음 날 4~6문항</p>
    </header>
    {feedback ? <GrammarAnswerFeedback feedback={feedback} onContinue={afterAnswer} />
      : phase === 'waiting' ? <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-on-primary"
          onClick={() => enter('delayed')}>지연 확인 미리 보기</button>
      : phase === 'finished' ? <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-on-primary"
          onClick={() => { setDiagnosed(0); setPractice([]); setTransferred(0); enter('explain'); }}>처음부터 다시 보기</button>
      : step && <GrammarLearningBlock key={phase + ':' + index} step={step} onAction={advance} />}
  </div>;
}
