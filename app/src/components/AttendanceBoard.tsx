import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkIn, clearCheckIn, fetchAttendance, fetchStudentsOfClass } from '../lib/api';
import { BOARD_FONTS, boardSlideStyle, boardTheme } from '../lib/boardThemes';
import { dateKey } from '../lib/format';
import type { Attendance, Student } from '../lib/types';
import { CanvasStageBox } from './CanvasSlideView';

/**
 * "출석 체크" 슬라이드(2026-09-27) — 수업 첫 화면에서 학생 이름을 누르면 학생관리 출석부에 오늘 "등원"으로
 * 기록된다(다시 누르면 취소). 출석부 페이지와 같은 attendance 기록을 쓴다(checkIn/clearCheckIn).
 */
export default function AttendanceBoard({
  academyId,
  classId,
  teacherId,
  themeId,
  interactive,
}: {
  academyId: string;
  classId: string | null;
  teacherId: string | null;
  themeId?: string | null;
  /** false: 편집 화면 미리보기 — 눌러도 기록하지 않는다 */
  interactive: boolean;
}) {
  const { t } = useTranslation();
  const th = boardTheme(themeId ?? 'green') ?? boardTheme('green')!;
  const font = BOARD_FONTS[th.font];
  const [students, setStudents] = useState<Student[] | null>(null);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = dateKey();

  const load = useCallback(async () => {
    if (!classId) {
      setStudents([]);
      return;
    }
    try {
      const [s, a] = await Promise.all([fetchStudentsOfClass(classId), fetchAttendance(classId, today, today)]);
      setStudents(s);
      setRecords(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStudents([]);
    }
  }, [classId, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const recordOf = (sid: string) => records.find((r) => r.student_id === sid);
  const present = (sid: string) => !!recordOf(sid)?.checked_in_at;

  async function toggle(s: Student) {
    if (!interactive || !classId || !teacherId || busy) return;
    setBusy(s.id);
    setError(null);
    try {
      const rec = recordOf(s.id);
      if (rec?.checked_in_at) {
        await clearCheckIn(rec.id);
        setRecords((prev) => prev.map((r) => (r.id === rec.id ? { ...r, checked_in_at: null } : r)));
      } else {
        const row = await checkIn({ academyId, classId, studentId: s.id, attendedOn: today, teacherId });
        setRecords((prev) => [...prev.filter((r) => r.student_id !== s.id), row]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const list = students ?? [];
  const count = list.filter((s) => present(s.id)).length;
  // 학생 수에 맞춰 칸 크기
  const cols = list.length <= 6 ? 3 : list.length <= 12 ? 4 : list.length <= 20 ? 5 : 6;
  const nameSize = list.length <= 6 ? 7 : list.length <= 12 ? 5.6 : list.length <= 20 ? 4.4 : 3.6;

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ containerType: 'size' }}>
      <CanvasStageBox fitParent className="rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.15)]">
        <div className="absolute inset-0" style={boardSlideStyle(th)} />
        <div className="absolute inset-0 flex flex-col gap-[3cqh]" style={{ padding: th.frame ? '5cqh 6cqh' : '4cqh 5cqh', color: th.text, fontFamily: font }}>
          <div className="flex items-center gap-[2cqh]">
            <span className="material-symbols-outlined" style={{ fontSize: '6cqh' }}>
              how_to_reg
            </span>
            <span className="flex-1 font-bold" style={{ fontSize: '6cqh' }}>
              {t('curriculum.attendance.title')}
            </span>
            <span className="rounded-full px-[2cqh] py-[0.6cqh] font-bold tabular-nums" style={{ fontSize: '4.4cqh', background: th.chip }}>
              {t('curriculum.attendance.count', { count, total: list.length })}
            </span>
          </div>
          {students === null ? (
            <div style={{ fontSize: '3.4cqh', color: th.muted }}>{t('common.loading')}</div>
          ) : list.length === 0 ? (
            <div style={{ fontSize: '3.4cqh', color: th.muted }}>{classId ? t('curriculum.attendance.noStudents') : t('curriculum.attendance.noClass')}</div>
          ) : (
            <div className="grid min-h-0 flex-1 content-start gap-[2cqh] overflow-hidden" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {list.map((s) => {
                const on = present(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void toggle(s)}
                    disabled={busy === s.id}
                    className="flex items-center justify-center gap-[1cqh] rounded-[2.4cqh] px-[1.5cqh] py-[2cqh] font-bold transition-all active:scale-95"
                    style={{
                      fontSize: `${nameSize}cqh`,
                      background: on ? '#2e9e5b' : th.chip,
                      color: on ? '#ffffff' : th.text,
                      boxShadow: on ? '0 0.6cqh 0 rgba(0,0,0,0.2)' : undefined,
                      cursor: interactive ? 'pointer' : 'default',
                    }}
                  >
                    {on && (
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9em' }}>
                        check_circle
                      </span>
                    )}
                    <span className="min-w-0 truncate">{s.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ fontSize: '2.6cqh', color: error ? '#ff8a80' : th.muted }}>
            {error ?? (interactive ? t('curriculum.attendance.hint') : t('curriculum.attendance.previewHint'))}
          </div>
        </div>
      </CanvasStageBox>
    </div>
  );
}
