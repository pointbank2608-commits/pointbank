/**
 * 단어 프로젝트(wm-v2) 학생·교사 화면 시안 하네스. 합성 응답만 쓰고 서버·DB를 부르지 않는다.
 * 열기: /scripts/wm-project/prototype.html  (목록)
 *   ?view=student&s=<시나리오>      학생 "오늘 할 학습"
 *   ?view=approval[&fail=1]         교사 승인(fail=1: 첫 요청의 응답이 유실된 뒤 같은 요청으로 재시도)
 *   ?view=progress                  교사 진행
 */
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/tailwind.css';
import i18n from '../../src/i18n';
import StudentToday from '../../src/components/wordMemoryProject/StudentToday';
import TeacherApproval, { type ApprovalInput } from '../../src/components/wordMemoryProject/TeacherApproval';
import TeacherProgress from '../../src/components/wordMemoryProject/TeacherProgress';
import { PROGRESS_ROWS, SECTION_SIZE, STUDENT_SCENARIOS, TODAY, TOTAL, type StudentScenario } from '../../src/components/wordMemoryProject/fixtures';
import * as model from '../../src/components/wordMemoryProject/model';

void i18n.changeLanguage('ko');
const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'index';
(window as unknown as Record<string, unknown>).__model = model;
const w = window as unknown as { __approvals: { calls: number; created: number; ids: string[] }; __decisions: string[] };
w.__approvals = { calls: 0, created: 0, ids: [] };
w.__decisions = [];

/** 서버가 저장한 오늘 진행(sessionStorage)을 새로고침해도 이어받는 것처럼 흉내 낸다 */
function applyDone(sc: StudentScenario, done: number) {
  let left = done;
  const items = sc.today.items.map((i) => (i.state === 'todo' && left > 0 ? (left--, { ...i, state: 'done' as const }) : i));
  const all = items.length > 0 && items.every((i) => i.state === 'done');
  const p = sc.today.project;
  const finished = all && sc.completesOnFinish && p ? { ...p, completed: true, verified: p.total, needs_review: 0, unconfirmed: 0, review_due: 0 } : p;
  return { ...sc.today, items, done: all, project: finished };
}

function StudentFlow({ sc }: { sc: StudentScenario }) {
  const key = `wmp:${sc.id}`;
  const [done, setDone] = useState(() => Number(sessionStorage.getItem(key) ?? 0));
  const [running, setRunning] = useState(false);
  const today = useMemo(() => applyDone(sc, done), [sc, done]);
  const todo = today.items.filter((i) => i.state === 'todo');
  if (running && todo.length > 0) {
    const n = today.items.length - todo.length + 1;
    return (
      <div className="flex min-h-dvh flex-col bg-[#f8f1e3] p-4 text-[#1c2742]" data-wmp-run>
        <p className="text-center text-sm font-bold text-[#5b6580]">합성 문제 화면 · {n} / {today.items.length}</p>
        <main className="mx-auto mt-4 w-full max-w-2xl rounded-3xl border border-[#eadfc5] bg-white p-6 text-center shadow">
          <p className="text-4xl font-extrabold">cat</p>
          <button type="button" data-wmp-answer className="mt-6 min-h-14 w-full rounded-full bg-[#3b5bdb] text-xl font-bold text-white" onClick={() => { const d = done + 1; sessionStorage.setItem(key, String(d)); setDone(d); }}>답하기(합성)</button>
          <button type="button" className="mt-3 min-h-11 text-sm font-bold text-[#5b6580] underline" onClick={() => setRunning(false)}>홈으로</button>
        </main>
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col bg-[#f8f1e3] text-[#1c2742]">
      <p className="px-4 pt-3 text-center text-xs text-[#5b6580]">시안 · {sc.title}</p>
      <div className="flex flex-1 flex-col"><StudentToday today={today} studentName={sc.open.student_name} title={sc.open.title} onStart={() => setRunning(true)} onCollection={() => alert('단어 모음(기존 화면)')} /></div>
    </div>
  );
}

const students = ['합성 학생 A', '합성 학생 B', '합성 학생 C'].map((name, i) => ({ id: `s${i + 1}`, name }));
const server = new Map<string, { created: number }>();
async function fakeApprove(i: ApprovalInput) {
  w.__approvals.calls += 1;
  w.__approvals.ids.push(i.requestId);
  await new Promise((r) => setTimeout(r, 150));
  let r = server.get(i.requestId);
  const duplicate = !!r;
  if (!r) { r = { created: i.studentIds.length }; server.set(i.requestId, r); w.__approvals.created += r.created; }
  if (q.get('fail') === '1' && w.__approvals.calls === 1) throw new Error('network'); // 서버는 처리했지만 응답이 유실됨
  return { duplicate, created: r.created };
}

function Index() {
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-5 text-[#1c2742]">
      <h1 className="text-2xl font-extrabold">단어 프로젝트 시안(합성 데이터)</h1>
      <section><h2 className="mb-2 font-bold">학생 · 오늘 할 학습</h2>
        <ul className="space-y-1">{STUDENT_SCENARIOS.map((s) => <li key={s.id}><a className="font-bold text-[#3b5bdb] underline" href={`?view=student&s=${s.id}`}>{s.title}</a><span className="text-sm text-[#5b6580]"> — {s.note}</span></li>)}</ul></section>
      <section><h2 className="mb-2 font-bold">교사</h2>
        <ul className="space-y-1"><li><a className="font-bold text-[#3b5bdb] underline" href="?view=approval">승인(3,520개)</a></li><li><a className="font-bold text-[#3b5bdb] underline" href="?view=approval&fail=1">승인 · 응답 유실 후 재시도</a></li><li><a className="font-bold text-[#3b5bdb] underline" href="?view=progress">진행(학생 6명, 기존 wm-v1 포함)</a></li></ul></section>
    </main>
  );
}

const sc = STUDENT_SCENARIOS.find((s) => s.id === q.get('s')) ?? STUDENT_SCENARIOS[0];
createRoot(document.getElementById('root')!).render(
  view === 'student' ? <StudentFlow sc={sc} />
    : view === 'approval' ? <div className="min-h-dvh bg-[#f8f1e3]"><TeacherApproval sourceName="초등·중등 기본 단어 3,520" total={TOTAL} students={students} today={TODAY} onApprove={fakeApprove} /></div>
    : view === 'progress' ? <div className="min-h-dvh bg-[#f8f1e3]"><TeacherProgress rows={PROGRESS_ROWS} words={TOTAL} sectionSize={SECTION_SIZE} today={TODAY} planMode="normal" onOpenNextSteps={() => w.__decisions.push('next-steps')} /></div>
    : <div className="min-h-dvh bg-[#f8f1e3]"><Index /></div>,
);
