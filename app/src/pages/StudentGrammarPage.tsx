import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import GrammarLearningBlock, { GrammarAnswerFeedback, type GrammarPicked } from '../components/grammar/GrammarLearningBlock';
import { StudioCard, StudioShell, StudioTopBar } from '../components/studio/StudioKit';
import { grammarAct, grammarOpen, type GrammarState } from '../lib/grammarServer';
import { savedToken } from '../lib/studentPortal';
import { useLearningActivity } from '../lib/learningSensors/useLearningActivity';
import type { GrammarBlockAction } from '../lib/grammarLearningContent';

export default function StudentGrammarPage() {
  const { assignmentId } = useParams();
  const token = savedToken();
  if (!token || !assignmentId) return <Navigate to="/s" replace />;
  return <Player key={`${token}:${assignmentId}`} token={token} assignment={assignmentId} />;
}

function Player({ token, assignment }: { token: string; assignment: string }) {
  const [result, setResult] = useState<GrammarState>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [picked, setPicked] = useState<GrammarPicked>();
  const [checked, setChecked] = useState(false);
  const pending = useRef<{ id: string; revision: number; action: GrammarBlockAction } | null>(null);
  const locked = useRef(false);
  const state = result?.state;
  const emit = useLearningActivity(result ? { source: 'grammar', credential: token, resource: assignment, runId: result.runId } : undefined,
    state?.kind === 'step' || state?.kind === 'feedback' ? state.position : null);
  useEffect(() => {
    let active = true;
    grammarOpen(token, assignment).then(data => { if (active) setResult(data); })
      .catch(() => { if (active) setError('학습을 열지 못했어요. 다시 시도해 주세요.'); });
    return () => { active = false; };
  }, [token, assignment]);

  async function update(action?: GrammarBlockAction) {
    if (locked.current || (action && (!result || pending.current))) return;
    locked.current = true;
    setBusy(true);
    setError('');
    if (action && result) {
      if (action.type === 'answer') {
        emit('submitted');
        if (result.state.kind === 'step' && result.state.step.phase !== 'explain' && result.state.step.phase !== 'repair') {
          const { item, phase } = result.state.step;
          setPicked({ sentence: item.sentence, prompt: item.prompt, phase, text: item.written ? action.optionId : item.options.find(o => o.id === action.optionId)?.text ?? '' });
        }
      }
      pending.current = { id: crypto.randomUUID(), revision: result.revision, action };
    }
    try {
      const request = pending.current;
      setResult(await (request ? grammarAct(token, assignment, request.id, request.revision, request.action) : grammarOpen(token, assignment)));
      pending.current = null;
      setEpoch(n => n + 1);
    } catch (err) {
      if (err instanceof Error && ['grammar_changed', 'request_changed', 'not_due', 'not_found', 'feature_closed', 'expired'].includes(err.message)) {
        pending.current = null;
      }
      setEpoch(n => n + 1);
      setError('현재 학습 상태를 확인하지 못했어요. 다시 시도해 주세요.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  const position = state && (state.kind === 'step' || state.kind === 'feedback') ? state.position : null;
  const dayNumber = position !== null && position >= 40 ? 2 : 1;
  const progressText = result?.adaptive
    ? state?.kind === 'finished' ? '학습 완료' : dayNumber === 2 ? '다음 날 확인' : '첫날 학습'
    : position !== null ? `${Math.min(position + 1, 6)} / 6` : undefined;
  const home = <Link to="/s" className="flex min-h-10 items-center gap-1 rounded-full border border-[#d9d3c3] bg-white px-3 text-sm font-bold text-[#1c2742]"><span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_back</span>학생 홈</Link>;
  const waitingDue = state?.kind === 'waiting' ? new Date(state.dueAt) : null;
  return <div lang="ko" className="flex min-h-dvh flex-col bg-[#f8f1e3] text-[#1c2742]">
    <StudioTopBar title="문법 학습" right={home}
      progressText={progressText}
      progress={state?.kind === 'finished' ? 1 : result?.adaptive ? undefined : position !== null ? (position + 1) / 6 : state?.kind === 'waiting' ? 5 / 6 : undefined} />
    <StudioShell>
      {error ? <StudioCard label="오류"><div role="alert" className="space-y-3"><p>{error}</p><button type="button" disabled={busy} onClick={() => void update()} className="min-h-12 rounded-full bg-[#3b5bdb] px-8 text-lg font-bold text-white disabled:opacity-50">다시 시도</button></div></StudioCard>
        : !state ? <StudioCard><p role="status">학습을 불러오는 중이에요.</p></StudioCard>
        : state.kind === 'step' ? <GrammarLearningBlock key={`${state.position}:${epoch}`} step={state.step} busy={busy} onAction={action => void update(action)} />
        : state.kind === 'feedback' ? <GrammarAnswerFeedback feedback={state.feedback} picked={picked} busy={busy} onContinue={() => void update({ type: 'continue' })} />
        : state.kind === 'waiting' ? <StudioCard label="복습 대기"><div className="space-y-4 text-center">
            <span aria-hidden="true" className="material-symbols-outlined text-[56px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <h2 className="text-2xl font-extrabold">오늘 학습 완료</h2>
            <p className="leading-relaxed text-[#4a5470]">기억이 남았는지 확인하는 복습은<br /><b className="text-[#1c2742]">{waitingDue!.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</b>부터 할 수 있어요.</p>
            <button type="button" disabled={busy} onClick={() => { setChecked(true); void update(); }} className="min-h-12 rounded-full bg-[#3b5bdb] px-8 text-lg font-bold text-white disabled:opacity-50">복습이 열렸는지 확인</button>
            {checked && !busy && !error && <p role="status" className="text-sm text-[#5b6580]">아직 복습 시간이 아니에요. 시간이 되면 다시 확인해 주세요.</p>}
          </div></StudioCard>
        : <StudioCard label="완료"><div role="status" className="space-y-3 py-4 text-center">
            <span aria-hidden="true" className="studio-star material-symbols-outlined text-[64px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            <h2 className="text-2xl font-extrabold">잘했어요!</h2>
            <p className="text-[#4a5470]">계획한 문법 학습과 복습을 마쳤어요.</p>
            <style>{`@keyframes studio-star{0%{transform:scale(.4) rotate(-20deg);opacity:0}60%{transform:scale(1.25) rotate(8deg);opacity:1}100%{transform:scale(1) rotate(0)}}.studio-star{display:inline-block;animation:studio-star .7s ease-out}@media (prefers-reduced-motion:reduce){.studio-star{animation:none}}`}</style>
          </div></StudioCard>}
    </StudioShell>
  </div>;
}
