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
    <>
      <div className="section-title">가입한 학원</div>

      {loading ? (
        <div className="empty-hint">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="empty-hint">아직 가입한 학원이 없습니다.</div>
      ) : (
        <>
          <div className="stat-strip">
            <div className="stat">
              <div className="stat-label">학원 수</div>
              <div className="stat-num">{totals.academies}</div>
            </div>
            <div className="stat">
              <div className="stat-label">선생님(원장 포함)</div>
              <div className="stat-num">{totals.teachers}</div>
            </div>
            <div className="stat">
              <div className="stat-label">학생</div>
              <div className="stat-num">{totals.students}</div>
            </div>
          </div>

          <div className="att-grid-wrap" style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>학원명</th>
                  <th>단위</th>
                  <th>원장</th>
                  <th>선생님</th>
                  <th>학생</th>
                  <th>가입일</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.academy_id}>
                    <td className="admin-table-name">{r.name}</td>
                    <td>{r.point_unit}</td>
                    <td>{r.owner_count}</td>
                    <td>{r.teacher_count}</td>
                    <td>{r.student_count}</td>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>
                      <button
                        className="link-danger"
                        disabled={busyId === r.academy_id}
                        onClick={() => void handleDelete(r)}
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

      <div className="settings-block" style={{ marginTop: 28, maxWidth: 420 }}>
        <h4>관리자 비밀번호 변경</h4>
        <div className="form-field">
          <label htmlFor="new-pw">새 비밀번호</label>
          <input
            id="new-pw"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="6자 이상"
          />
        </div>
        <div className="form-field">
          <label htmlFor="confirm-pw">새 비밀번호 확인</label>
          <input
            id="confirm-pw"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button className="btn-primary" disabled={pwBusy} onClick={() => void handleChangePassword()}>
          {pwBusy ? '변경 중…' : '비밀번호 변경'}
        </button>
      </div>
    </>
  );
}
