import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { changeMyPassword, deleteAcademyAsAdmin, fetchAdminAcademies } from '../lib/api';
import type { AdminAcademyRow } from '../lib/types';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function AdminAcademiesPage() {
  const { notify, run } = useToast();
  const [rows, setRows] = useState<AdminAcademyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAdminAcademies());
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(row: AdminAcademyRow) {
    const typed = prompt(
      `"${row.name}" 학원을 완전히 삭제합니다. 소속된 반·학생·거래 기록이 전부 사라지고 되돌릴 수 없습니다.\n\n계속하려면 학원 이름을 정확히 입력하세요.`,
    );
    if (typed !== row.name) {
      if (typed !== null) notify('학원 이름이 일치하지 않아 취소했습니다.', 'error');
      return;
    }
    setBusyId(row.academy_id);
    const ok = await run(
      () => deleteAcademyAsAdmin(row.academy_id),
      `"${row.name}" 학원을 삭제했습니다.`,
    );
    setBusyId(null);
    if (ok) setRows((prev) => prev.filter((r) => r.academy_id !== row.academy_id));
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      notify('비밀번호는 6자 이상이어야 합니다.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify('두 비밀번호가 서로 다릅니다.', 'error');
      return;
    }
    setPwBusy(true);
    const ok = await run(() => changeMyPassword(newPassword), '비밀번호를 변경했습니다.');
    setPwBusy(false);
    if (ok) {
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  const totals = rows.reduce(
    (acc, r) => ({
      academies: acc.academies + 1,
      teachers: acc.teachers + r.owner_count + r.teacher_count,
      students: acc.students + r.student_count,
    }),
    { academies: 0, teachers: 0, students: 0 },
  );

  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        가입한 학원
      </h2>

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">아직 가입한 학원이 없습니다.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">학원 수</div>
              <div className="font-display-lg text-[28px] text-on-surface">{totals.academies}</div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">선생님(원장 포함)</div>
              <div className="font-display-lg text-[28px] text-on-surface">{totals.teachers}</div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
              <div className="font-caption text-caption text-on-surface-variant mb-1">학생</div>
              <div className="font-display-lg text-[28px] text-on-surface">{totals.students}</div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="font-caption text-caption text-on-surface-variant border-b border-surface-container">
                  <th className="px-4 md:px-6 py-3 font-medium">학원명</th>
                  <th className="px-4 py-3 font-medium">단위</th>
                  <th className="px-4 py-3 font-medium">원장</th>
                  <th className="px-4 py-3 font-medium">선생님</th>
                  <th className="px-4 py-3 font-medium">학생</th>
                  <th className="px-4 py-3 font-medium">가입일</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.academy_id} className="border-b border-surface-container last:border-0">
                    <td className="px-4 md:px-6 py-3 font-label-md text-label-md text-on-surface whitespace-nowrap">
                      {r.name}
                    </td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.point_unit}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.owner_count}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.teacher_count}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">{r.student_count}</td>
                    <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant whitespace-nowrap">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={busyId === r.academy_id}
                        onClick={() => void handleDelete(r)}
                        className="font-label-md text-label-md text-error hover:underline disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] max-w-[420px] space-y-4">
        <h4 className="font-title-md text-title-md text-on-surface">관리자 비밀번호 변경</h4>
        <div>
          <label htmlFor="new-pw" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
            새 비밀번호
          </label>
          <input
            id="new-pw"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="6자 이상"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label htmlFor="confirm-pw" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
            새 비밀번호 확인
          </label>
          <input
            id="confirm-pw"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <button
          disabled={pwBusy}
          onClick={() => void handleChangePassword()}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 hover:bg-primary-container transition-colors"
        >
          {pwBusy ? '변경 중…' : '비밀번호 변경'}
        </button>
      </div>
    </div>
  );
}
