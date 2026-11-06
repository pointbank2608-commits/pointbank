import { useRef, useState } from 'react';
import { fetchStudentsOfClass } from '../../lib/api';
import type { Student } from '../../lib/types';
import { grammarAssign, grammarCatalog, grammarNotReady, grammarPreview, grammarTeacherSummary,
  type GrammarCatalogItem, type GrammarMode, type GrammarOutcome } from '../../lib/grammarServer';
import type { GrammarLesson } from '../../lib/grammarLearningContent';
import GrammarLearningPreview from './GrammarLearningPreview';

const button = 'min-h-11 rounded-xl border border-outline-variant px-4 py-2 font-bold disabled:opacity-50';
const mark = (result: boolean | null) => result === null ? '—' : result ? '정답' : '오답';
const reviews: Record<string, string> = { correct: '정답', wrong: '오답', missing: '미응답', waiting: '예정 전', unscheduled: '미예약', excluded: '대상 제외' };

export default function GrammarTeacherPanel({ classId, mode }: { classId: string; mode: GrammarMode }) {
  return <ClassPanel key={classId + mode} classId={classId} mode={mode} />;
}

function ClassPanel({ classId, mode }: { classId: string; mode: GrammarMode }) {
  const [catalog, setCatalog] = useState<GrammarCatalogItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [goalId, setGoalId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [due, setDue] = useState('');
  const [lesson, setLesson] = useState<GrammarLesson>();
  const [approved, setApproved] = useState(false);
  const [outcomes, setOutcomes] = useState<GrammarOutcome[]>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const locked = useRef(false);
  const pending = useRef<Parameters<typeof grammarAssign> | null>(null);
  const goal = catalog.find(item => item.goalId === goalId);

  function change() { setApproved(false); setMessage(''); }
  async function perform(operation: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage('');
    try { await operation(); }
    catch (error) { setMessage(grammarNotReady(error) ? '문법 학습 서버를 준비 중이에요.' : '처리하지 못했어요. 입력과 연결을 확인해 주세요.'); }
    finally { locked.current = false; setBusy(false); }
  }
  const load = () => perform(async () => {
    const [goals, roster] = await Promise.all([grammarCatalog(), fetchStudentsOfClass(classId)]);
    setCatalog(goals); setStudents(roster);
    if (!goals.length) setMessage('배정할 수 있는 문법 목표가 아직 없어요.');
  });
  const results = () => perform(async () => setOutcomes(await grammarTeacherSummary(classId, mode)));
  const submit = () => perform(async () => {
    if (!pending.current && goal && lesson && approved && picked.length) {
      pending.current = [crypto.randomUUID(), classId, mode, goal, picked, due ? new Date(due).toISOString() : null];
    }
    if (!pending.current) return;
    try { await grammarAssign(...pending.current); }
    catch (error) {
      if (error instanceof Error && ['bad_due','bad_plan','bad_student','bad_class','feature_closed','content_unavailable','request_changed'].includes(error.message)) {
        pending.current = null;
        setApproved(false);
      }
      throw error;
    }
    pending.current = null;
    setApproved(false);
    setMessage('배정했어요. 학생 홈에서 시작할 수 있어요.');
    setOutcomes(undefined);
  });

  return <section lang="ko" className="space-y-3 rounded-2xl border border-outline-variant p-4">
    <h2 className="text-lg font-bold">{mode === 'homework' ? '문법 숙제' : '문법 개별수업'}</h2>
    <div className="flex flex-wrap gap-2">
      {!catalog.length && <button type="button" className={button} disabled={busy} onClick={() => void load()}>문법 목표 고르기</button>}
      <button type="button" className={button} disabled={busy} onClick={() => void results()}>문법 학습 결과 보기</button>
    </div>
    {catalog.length > 0 && <fieldset disabled={busy || !!pending.current} className="space-y-3">
      <label className="block">학습 목표 <select className="max-w-full rounded-lg border p-2" value={goalId} onChange={e => {
        setGoalId(e.target.value); setLesson(undefined); change();
      }}>
        <option value="">목표 선택</option>
        {catalog.map(item => <option key={item.goalId} value={item.goalId}>{item.title}</option>)}
      </select></label>
      {goal && <><p>{goal.objective}</p><button type="button" className={button} onClick={() => void perform(async () => {
        setLesson(await grammarPreview(goal)); setApproved(false);
      })}>학생 화면 미리보기</button></>}
      <fieldset className="flex flex-wrap gap-3"><legend>배정할 학생</legend>
        {students.map(student => <label key={student.id}><input type="checkbox" checked={picked.includes(student.id)} onChange={e => {
          setPicked(e.target.checked ? [...picked, student.id] : picked.filter(id => id !== student.id)); change();
        }} /> {student.name}</label>)}
      </fieldset>
      <label className="block">첫 학습 기한 (선택) <input type="datetime-local" value={due} onChange={e => { setDue(e.target.value); change(); }} /></label>
      {lesson && <><GrammarLearningPreview lesson={lesson} />
        <p>첫 학습이 끝나면 24시간 뒤에 새 문장이 열려요.</p>
        <label className="block"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} /> 내용과 학생을 확인했어요</label>
      </>}
    </fieldset>}
    {(lesson || pending.current) && <button type="button" className={button} disabled={busy || (!pending.current && (!approved || !picked.length))}
      onClick={() => void submit()}>{pending.current ? '같은 요청으로 다시 확인' : '이 계획으로 배정'}</button>}
    <p role="status">{busy ? '처리 중…' : message}</p>
    {outcomes && (outcomes.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr>{['학생','목표','첫 이유 확인','보충 후','직후 확인','지연 확인'].map(title => <th key={title} className="p-2">{title}</th>)}</tr></thead>
      <tbody>{outcomes.map(row => <tr key={row.assignmentId}><td className="p-2">{row.student}</td><td className="p-2">{row.title}</td>
        <td className="p-2">{mark(row.reasoning)}</td><td className="p-2">{mark(row.practice)}</td>
        <td className="p-2">{mark(row.transfer)}</td><td className="p-2">{reviews[row.review]}</td></tr>)}</tbody>
    </table></div> : <p>최근 문법 배정이 없어요.</p>)}
  </section>;
}
