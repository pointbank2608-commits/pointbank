import { useMemo, useRef, useState } from 'react';
import { fetchStudentsOfClass } from '../../lib/api';
import { SCHOOLS, unitOf, type SchoolId } from '../../lib/curriculumGrammar';
import { GRAMMAR_POINTS } from '../../lib/grammar';
import type { Student } from '../../lib/types';
import { grammarAssign, grammarCatalog, grammarNotReady, grammarPreview, grammarTeacherSummary,
  type GrammarCatalogItem, type GrammarMode, type GrammarOutcome } from '../../lib/grammarServer';
import type { GrammarLesson } from '../../lib/grammarLearningContent';
import GrammarLearningPreview from './GrammarLearningPreview';

const button = 'min-h-11 rounded-xl border border-outline-variant px-4 py-2 font-bold disabled:opacity-50';
const mark = (result: boolean | null) => result === null ? '—' : result ? '정답' : '오답';
const pointById = new Map(GRAMMAR_POINTS.map(point => [point.id, point]));
const score = (correct: number, answered: number) => answered ? correct + '/' + answered : '—';
const reviews: Record<string, string> = { correct: '정답', wrong: '오답', missing: '미응답', waiting: '예정 전', unscheduled: '미예약', excluded: '대상 제외' };

export default function GrammarTeacherPanel({ classId, mode }: { classId: string; mode: GrammarMode }) {
  return <ClassPanel key={classId + mode} classId={classId} mode={mode} />;
}

function ClassPanel({ classId, mode }: { classId: string; mode: GrammarMode }) {
  const [catalog, setCatalog] = useState<GrammarCatalogItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [goalId, setGoalId] = useState('');
  const [schoolId, setSchoolId] = useState<SchoolId | 'all'>('all');
  const [query, setQuery] = useState('');
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
  const goalGroups = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const groups = new Map<string, { item: GrammarCatalogItem; label: string }[]>();
    for (const item of catalog) {
      const point = item.grammarIds.map(id => pointById.get(id)).find(Boolean);
      const school = SCHOOLS.find(candidate => point && candidate.stages.includes(point.stage));
      if (schoolId !== 'all' && school?.id !== schoolId) continue;
      const unit = point && unitOf(point.id);
      if (search && ![item.title, point?.name, point?.grade, unit?.ko]
        .some(value => value?.toLocaleLowerCase().includes(search))) continue;
      const group = school?.ko ?? '그 밖의 문법';
      const title = item.adaptive === false ? item.title + ' · 짧은 확인' : item.title;
      const label = point ? point.grade + ' · ' + title : title;
      const entries = groups.get(group) ?? [];
      entries.push({ item, label });
      groups.set(group, entries);
    }
    return groups;
  }, [catalog, query, schoolId]);
  const visibleCount = [...goalGroups.values()].reduce((total, entries) => total + entries.length, 0);

  function selectGoal(id: string) {
    setGoalId(id);
    setLesson(undefined);
    change();
  }

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
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1">학교급
          <select className="rounded-lg border p-2" value={schoolId} onChange={e => {
            setSchoolId(e.target.value as SchoolId | 'all'); selectGoal('');
          }}>
            <option value="all">전체</option>
            {SCHOOLS.map(school => <option key={school.id} value={school.id}>{school.ko}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1">문법 검색
          <input type="search" className="min-w-0 rounded-lg border p-2" value={query} placeholder="예: 관계사, 중2"
            onChange={e => { setQuery(e.target.value); selectGoal(''); }} />
        </label>
      </div>
      <label className="grid gap-1">학습 목표
        <select className="w-full max-w-xl rounded-lg border p-2" value={goalId} onChange={e => selectGoal(e.target.value)}>
          <option value="">{visibleCount ? `목표 선택 (${visibleCount}개)` : '검색 결과 없음'}</option>
          {[...goalGroups].map(([group, entries]) => <optgroup key={group} label={group}>
            {entries.map(({ item, label }) => <option key={item.goalId} value={item.goalId}>{label}</option>)}
          </optgroup>)}
        </select>
      </label>
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
      <thead><tr>{['학생','목표','첫 확인','연습','직후 확인','지연 확인'].map(title => <th key={title} className="p-2">{title}</th>)}</tr></thead>
      <tbody>{outcomes.map(row => <tr key={row.assignmentId}><td className="p-2">{row.student}</td><td className="p-2">{row.title}</td>
        <td className="p-2">{row.evidence ? score(row.evidence.diagnosed_ok, row.evidence.diagnosed) : mark(row.reasoning)}</td>
        <td className="p-2">{row.evidence ? score(row.evidence.practiced_ok, row.evidence.practiced) : mark(row.practice)}</td>
        <td className="p-2">{row.evidence ? score(row.evidence.transferred_ok, row.evidence.transferred) : mark(row.transfer)}</td>
        <td className="p-2">{reviews[row.review]}{row.evidence?.reviewed ? ' · ' + score(row.evidence.reviewed_ok, row.evidence.reviewed) : ''}</td></tr>)}</tbody>
    </table></div> : <p>최근 문법 배정이 없어요.</p>)}
  </section>;
}
