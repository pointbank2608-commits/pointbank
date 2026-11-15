import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/tailwind.css';
import { CaillouFollowupTeacher, CaillouHomeworkCard } from '../../src/components/solo/CaillouFollowup';
import type { TeacherTransferApi, TransferState } from '../../src/lib/caillouFollowup';

async function request<T>(action: string, values: object = {}): Promise<T> {
  const response = await fetch('/__caillou_preview', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...values }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as T;
}

const teacher: TeacherTransferApi = (action, id, plan) => request(`teacher:${action}`, { id, plan });

function Preview() {
  const [view, setView] = useState<'teacher' | 'student'>('teacher');
  const [revision, setRevision] = useState(0);
  const [student, setStudent] = useState<TransferState[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (view !== 'student') return;
    let active = true;
    void request<TransferState[]>('student:list').then(rows => { if (active) setStudent(rows); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [view, revision]);

  async function simulate(action: string) {
    setBusy(true);
    setError(false);
    try {
      await request(action);
      setRevision(value => value + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const tab = (name: 'teacher' | 'student') => `min-h-11 rounded-lg px-4 py-2 text-sm font-bold ${view === name ? 'bg-[#3b5bdb] text-white' : 'bg-white text-[#263e6b]'}`;
  return <div className="min-h-screen bg-[#f6f1e5] p-4 text-[#162d50] md:p-10">
    <main className="mx-auto max-w-3xl space-y-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#e5dcc5] sm:p-8">
      <header className="space-y-2">
        <p className="text-sm font-bold text-[#3b5bdb]">카이유 1차시 · 테스트용 미리보기</p>
        <h1 className="text-2xl font-bold sm:text-3xl">처음 타는 스케이트</h1>
        <p>개별수업에서 배운 표현을 다음 날 새 상황에서 확인해요.</p>
      </header>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#eef3fd] p-2" aria-label="미리보기 화면 선택">
        <button type="button" className={tab('teacher')} aria-pressed={view === 'teacher'} onClick={() => setView('teacher')}>선생님 화면</button>
        <button type="button" className={tab('student')} aria-pressed={view === 'student'} onClick={() => { setStudent(null); setView('student'); }} disabled={view === 'student'}>학생 숙제 화면</button>
        <a className="rounded-lg px-3 py-2 text-sm font-bold text-[#2847b4] underline" href="./video-template.html?library" target="_blank" rel="noreferrer">개별수업 열기</a>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-[#2847b4]">
        <button type="button" className="underline disabled:opacity-50" disabled={busy} onClick={() => void simulate('today')}>수업을 오늘 끝낸 상태</button>
        <button type="button" className="underline disabled:opacity-50" disabled={busy} onClick={() => void simulate('tomorrow')}>수업을 마친 다음 날</button>
        <button type="button" className="underline disabled:opacity-50" disabled={busy} onClick={() => void simulate('reset')}>테스트 초기화</button>
      </div>
      {error && <p role="alert">미리보기 상태를 불러오지 못했어요.</p>}
      {view === 'teacher' ? <CaillouFollowupTeacher key={revision} api={teacher} /> : <section className="space-y-3">
        {student?.length === 0 && <p>선생님 화면에서 다음 날 숙제를 연결해 주세요.</p>}
        {student?.map(row => <CaillouHomeworkCard key={`${revision}-${row.assignment_id}`} state={row} act={async (action, answer) => {
          setStudent([await request<TransferState>(`student:${action}`, { id: row.assignment_id, answer })]);
        }} />)}
      </section>}
      <p className="border-t border-[#e5dcc5] pt-3 text-sm text-[#53617a]">테스트 학생을 사용해요. 실제 수업이나 숙제에는 반영되지 않아요.</p>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<Preview />);
