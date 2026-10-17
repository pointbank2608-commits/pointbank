import { useFeature } from '../lib/features';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import i18n from '../i18n';
import ClassChipRow from '../components/ClassChipRow';
import ClassroomHeader from '../components/ClassroomHeader';
import LearningCardModal from '../components/homework/teacher/LearningCardModal';
import StudentLoginPanel from '../components/StudentLoginPanel';
import AddStudentModal from '../components/AddStudentModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  clearCheckIn,
  clearCheckOut,
  createClass,
  deleteAttendance,
  deleteStudent,
  fetchAttendance,
  fetchStudentsOfAcademy,
  fetchStudentsOfClass,
  markPresent,
  renameStudent,
} from '../lib/api';
import { useClasses } from '../lib/useClasses';
import { FREE_CLASS_LIMIT, FREE_STUDENT_LIMIT } from '../lib/planLimits';
import type { Attendance, Student } from '../lib/types';

const AVATAR_TONES = ['#cfe3ff', '#ffd9e6', '#d6f5e6', '#e4dcff', '#ffeaa8', '#cdeff2'];
function avatarTone(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % AVATAR_TONES.length;
  return AVATAR_TONES[h];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 시:분만 뽑는다 (날짜는 모달 제목에 이미 있으므로). */
function timeOnly(iso: string): string {
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'ko-KR';
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export default function AttendancePage() {
  const { academy, profile, hasFullAccess } = useAuth();
  const studentAreaOpen = useFeature('solo') || useFeature('homework');
  const { notify, run } = useToast();
  const { t } = useTranslation();
  const { classes, selectedId, select, reload: reloadClasses, reorder } = useClasses(academy?.id);
  /** 무료 플랜 학생 10명 한도는 반 하나가 아니라 학원 전체 기준이라, 반별 학생 목록(students
   * state)과는 별도로 학원 전체 학생 수를 따로 추적한다. */
  const [academyStudentCount, setAcademyStudentCount] = useState(0);
  const [academyStudentNames, setAcademyStudentNames] = useState<string[]>([]);
  const [addingStudent, setAddingStudent] = useState(false);

  const loadAcademyStudentCount = useCallback(async () => {
    if (!academy?.id) return;
    try {
      const all = await fetchStudentsOfAcademy(academy.id);
      setAcademyStudentCount(all.length);
      setAcademyStudentNames(all.map((s) => s.name));
    } catch {
      // 한도 체크용 보조 값이라 실패해도 화면을 막지 않는다.
    }
  }, [academy?.id]);

  useEffect(() => {
    void loadAcademyStudentCount();
  }, [loadAcademyStudentCount]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1~12

  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  // 학생 이름 옆 "스탯" → 숙제 결과·리포트와 같은 학습 카드 창
  const [statStudent, setStatStudent] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  /** 상세 팝업 대상: 셀을 눌렀을 때 등원/하원 시각을 보여주는 용도 */
  const [detail, setDetail] = useState<{ studentId: string; studentName: string; day: number } | null>(
    null,
  );

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const from = `${year}-${pad(month)}-01`;
  const to = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const load = useCallback(async () => {
    if (!selectedId) {
      setStudents([]);
      setAttendance([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        fetchStudentsOfClass(selectedId),
        fetchAttendance(selectedId, from, to),
      ]);
      setStudents(s);
      setAttendance(a);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedId, from, to, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  // 반이나 월이 바뀌면 열려 있던 상세 팝업은 닫는다.
  useEffect(() => {
    setDetail(null);
  }, [selectedId, year, month]);

  async function handleAddClass() {
    if (!academy?.id) return;
    if (!hasFullAccess && classes.length >= FREE_CLASS_LIMIT) {
      notify(t('attendance.freeClassLimitToast'), 'error');
      return;
    }
    const name = prompt(t('attendance.addClassPrompt'));
    if (!name?.trim()) return;
    const ok = await run(async () => {
      await createClass(academy.id, name.trim(), classes.length);
    }, t('settings.classAddedToast'));
    if (ok) await reloadClasses();
  }

  async function handleAddStudent() {
    if (!academy?.id || !selectedId) return;
    if (!hasFullAccess && academyStudentCount >= FREE_STUDENT_LIMIT) {
      notify(t('attendance.freeStudentLimitToast'), 'error');
      return;
    }
    setAddingStudent(true);
  }

  async function handleStudentAdded(name: string, phoneProblem: string | null) {
    setAddingStudent(false);
    notify(t('board.addStudentToast', { name }));
    if (phoneProblem) notify(phoneProblem, 'error');
    await load();
    await loadAcademyStudentCount();
  }

  async function handleRenameStudent(studentId: string, currentName: string) {
    const next = prompt(t('attendance.renameStudentPrompt'), currentName);
    if (!next?.trim() || next.trim() === currentName) return;
    const ok = await run(() => renameStudent(studentId, next.trim()), t('attendance.renameStudentToast'));
    if (ok) setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, name: next.trim() } : s)));
  }

  async function handleDeleteStudent(studentId: string, name: string) {
    if (!confirm(t('board.removeStudentConfirm', { name }))) return;
    const ok = await run(() => deleteStudent(studentId), t('board.removeStudentToast'));
    if (ok) {
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setAttendance((prev) => prev.filter((a) => a.student_id !== studentId));
      await loadAcademyStudentCount();
    }
  }

  const todayRef = new Date();
  const isThisMonth = todayRef.getFullYear() === year && todayRef.getMonth() + 1 === month;
  const todayDay = todayRef.getDate();
  const weekdayLabel = (d: number) => new Date(year, month - 1, d).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-US' : 'ko-KR', { weekday: 'short' });
  const map = useMemo(() => {
    const m = new Map<string, Attendance>(); // `${studentId}_${day}`
    for (const a of attendance) {
      const day = Number(a.attended_on.slice(8, 10));
      m.set(`${a.student_id}_${day}`, a);
    }
    return m;
  }, [attendance]);
  const presentToday = isThisMonth ? students.filter((s) => map.has(`${s.id}_${todayDay}`)).length : 0;

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  }

  function cellTooltip(a: Attendance | undefined): string {
    if (!a) return t('attendance.tooltipEmpty');
    const parts: string[] = [];
    parts.push(
      a.checked_in_at ? t('attendance.tooltipCheckedIn', { time: timeOnly(a.checked_in_at) }) : t('attendance.tooltipNoCheckIn'),
    );
    parts.push(
      a.checked_out_at ? t('attendance.tooltipCheckedOut', { time: timeOnly(a.checked_out_at) }) : t('attendance.tooltipNoCheckOut'),
    );
    return parts.join(' · ');
  }

  async function handleCellClick(studentId: string, studentName: string, day: number) {
    const key = `${studentId}_${day}`;
    const existing = map.get(key);
    if (existing) {
      // 이미 기록이 있으면 바로 지우지 않고, 시각을 보여주는 상세 팝업을 연다.
      setDetail({ studentId, studentName, day });
      return;
    }
    if (!academy?.id || !selectedId || !profile) return;
    setBusyKey(key);
    const attendedOn = `${year}-${pad(month)}-${pad(day)}`;
    try {
      const row = await markPresent({
        academyId: academy.id,
        classId: selectedId,
        studentId,
        attendedOn,
        teacherId: profile.id,
      });
      setAttendance((prev) => [...prev, row]);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
    setBusyKey(null);
  }

  const detailRow = detail ? map.get(`${detail.studentId}_${detail.day}`) : null;

  async function handleClearCheckIn() {
    if (!detailRow) return;
    const ok = await run(() => clearCheckIn(detailRow.id), t('attendance.toastClearedCheckIn'));
    if (ok) {
      setAttendance((prev) =>
        prev.map((a) => (a.id === detailRow.id ? { ...a, checked_in_at: null, checked_in_by: null } : a)),
      );
    }
  }

  async function handleClearCheckOut() {
    if (!detailRow) return;
    const ok = await run(() => clearCheckOut(detailRow.id), t('attendance.toastClearedCheckOut'));
    if (ok) {
      setAttendance((prev) =>
        prev.map((a) =>
          a.id === detailRow.id ? { ...a, checked_out_at: null, checked_out_by: null } : a,
        ),
      );
    }
  }

  async function handleDeleteDay() {
    if (!detailRow) return;
    if (!confirm(t('attendance.confirmDeleteDay'))) return;
    const ok = await run(() => deleteAttendance(detailRow.id), t('attendance.toastDeletedDay'));
    if (ok) {
      setAttendance((prev) => prev.filter((a) => a.id !== detailRow.id));
      setDetail(null);
    }
  }

  return (
    <div className="space-y-5">
      <ClassroomHeader />
      <div className="flex flex-wrap items-center gap-2">
        <ClassChipRow classes={classes} selectedId={selectedId} onSelect={select} onReorder={reorder} />
        <button
          onClick={() => void handleAddClass()}
          disabled={!hasFullAccess && classes.length >= FREE_CLASS_LIMIT}
          title={!hasFullAccess && classes.length >= FREE_CLASS_LIMIT ? t('attendance.freeClassLimitToast') : undefined}
          className="flex min-h-11 items-center gap-1 rounded-full border border-dashed border-primary/60 bg-white px-5 font-label-md text-[15px] font-bold text-primary transition-colors hover:bg-primary-fixed disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('settings.addClass')}
        </button>
        {!hasFullAccess && classes.length >= FREE_CLASS_LIMIT && (
          <Link to="/settings/billing" className="font-label-md text-label-md text-primary hover:underline">
            {t('plan.upgradeCta')}
          </Link>
        )}
      </div>

      {selectedId && students.length > 0 && (
        <div className="rounded-[20px] bg-deep-navy px-2 py-5 shadow-card sm:px-4">
          <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-3 sm:divide-x sm:divide-white/20">
            <div className="flex items-center gap-3.5 px-4 py-1 sm:px-6">
              <span className="material-symbols-outlined text-[38px] text-[#7fb2ff]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
              <div>
                <div className="font-caption text-[13px] text-white/75">{t('attendanceV2.selectedClass')}</div>
                <div className="font-display-lg text-[22px] font-extrabold text-white">{t('attendanceV2.people', { n: students.length })}</div>
              </div>
            </div>
            <div className="flex items-center gap-3.5 px-4 py-1 sm:px-6">
              <span className="material-symbols-outlined text-[38px] text-[#7fb2ff]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>event_available</span>
              <div>
                <div className="font-caption text-[13px] text-white/75">{t('attendanceV2.todayPresent')}</div>
                <div className="font-display-lg text-[22px] font-extrabold text-white">{isThisMonth ? t('attendanceV2.people', { n: presentToday }) : '–'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3.5 px-4 py-1 sm:px-6">
              <span className="material-symbols-outlined text-[38px] text-[#7fb2ff]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>fact_check</span>
              <div>
                <div className="font-caption text-[13px] text-white/75">{t('attendanceV2.monthRecords')}</div>
                <div className="font-display-lg text-[22px] font-extrabold text-white">{t('attendanceV2.times', { n: map.size })}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {studentAreaOpen && selectedId && students.length > 0 && <StudentLoginPanel students={students} />}

      <section className="space-y-4 rounded-[20px] border border-outline-variant bg-white p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display-lg text-[clamp(1.4rem,2.4vw,1.8rem)] font-black text-deep-navy">{t('nav.attendance')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-[12px] border border-outline-variant bg-white px-1.5 py-1">
              <button
                onClick={() => shiftMonth(-1)}
                className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-primary-fixed"
                aria-label={t('attendance.prevMonth')}
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="px-3 font-title-md text-[17px] font-bold text-deep-navy">{t('attendance.monthLabel', { year, month })}</span>
              <button
                onClick={() => shiftMonth(1)}
                className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-primary-fixed"
                aria-label={t('attendance.nextMonth')}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            {selectedId && (
              <>
                <button
                  onClick={() => void handleAddStudent()}
                  disabled={!hasFullAccess && academyStudentCount >= FREE_STUDENT_LIMIT}
                  title={!hasFullAccess && academyStudentCount >= FREE_STUDENT_LIMIT ? t('attendance.freeStudentLimitToast') : undefined}
                  className="flex min-h-11 items-center gap-1 rounded-[12px] border border-primary px-4 font-label-md text-[15px] font-bold text-primary transition-colors hover:bg-primary-fixed disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('board.addStudent')}
                </button>
                {!hasFullAccess && academyStudentCount >= FREE_STUDENT_LIMIT && (
                  <Link to="/settings/billing" className="font-label-md text-label-md text-primary hover:underline">
                    {t('plan.upgradeCta')}
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="font-body-md text-on-surface-variant">{t('attendance.noStudents')}</p>
          {selectedId && (
            <button
              onClick={() => void handleAddStudent()}
              className="inline-flex items-center px-4 py-2 rounded-full font-label-md text-label-md bg-primary text-on-primary shadow-sm hover:opacity-90 transition-opacity"
            >
              {t('board.addStudent')}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-outline-variant">
          <table className="w-full border-collapse text-center">
            <thead>
              <tr className="bg-primary-fixed/70 font-caption text-[13px] font-bold text-deep-navy">
                <th className="sticky left-0 z-10 bg-[#e9f2ff] px-4 py-3 text-left">{t('attendance.name')}</th>
                {days.map((d) => {
                  const isToday = isThisMonth && d === todayDay;
                  return (
                    <th key={d} className={`min-w-[44px] px-1 py-3 ${isToday ? 'bg-primary text-white' : ''}`}>
                      {d}
                      <span className={`block text-[11px] font-semibold ${isToday ? 'text-white/85' : 'text-on-surface-variant'}`}>{weekdayLabel(d)}</span>
                    </th>
                  );
                })}
                <th className="px-3 py-3">{t('attendance.total')}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const count = days.filter((d) => map.has(`${s.id}_${d}`)).length;
                return (
                  <tr key={s.id} className="border-t border-outline-variant/70">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-2 text-left font-label-md text-[15px] font-bold text-deep-navy">
                      <div className="flex items-center gap-1">
                        <span className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-deep-navy" style={{ background: avatarTone(s.name) }}>{s.name.slice(0, 1)}</span>
                        <span>{s.name}</span>
                        <button
                          onClick={() => void handleRenameStudent(s.id, s.name)}
                          aria-label={t('attendance.renameStudentPrompt')}
                          className="p-1 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          onClick={() => void handleDeleteStudent(s.id, s.name)}
                          aria-label={t('board.removeStudent')}
                          className="p-1 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-error transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                        <button
                          onClick={() => setStatStudent(s.id)}
                          aria-label={t('studentHw.statOf', { name: s.name })}
                          className="flex items-center gap-0.5 rounded px-1 py-1 text-xs text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">military_tech</span>
                          {t('studentHw.statShort')}
                        </button>
                      </div>
                    </td>
                    {days.map((d) => {
                      const key = `${s.id}_${d}`;
                      const rec = map.get(key);
                      return (
                        <td key={d} className={`px-0.5 py-1.5 ${isThisMonth && d === todayDay ? 'bg-primary-fixed/60' : ''}`}>
                          <button
                            disabled={busyKey === key}
                            title={cellTooltip(rec)}
                            aria-label={t(rec ? 'attendanceV2.checkedAria' : 'attendanceV2.uncheckedAria', { name: s.name, day: d })}
                            onClick={() => void handleCellClick(s.id, s.name, d)}
                            className={`flex h-7 w-7 items-center justify-center rounded-[7px] border-2 transition-colors ${
                              rec ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-white hover:border-primary/60'
                            } disabled:opacity-50`}
                          >
                            {rec && (
                              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                                check
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 font-title-md text-[17px] font-extrabold text-primary">{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

        <div className="flex flex-wrap items-center justify-between gap-2 font-body-md text-[14px] text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden>info</span>
            {t('attendance.hint')}
          </span>
          <span className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-primary text-white" aria-hidden>
              <span className="material-symbols-outlined text-[15px]">check</span>
            </span>
            {t('attendanceV2.legendPresent')}
            <span className="ml-2 h-5 w-5 rounded-[5px] border-2 border-outline-variant bg-white" aria-hidden />
            {t('attendanceV2.legendNone')}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link to="/board" className="flex items-center gap-4 rounded-[18px] bg-[#fff4c2] px-5 py-5 shadow-card transition hover:-translate-y-0.5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#ffc531] text-white">
            <span className="material-symbols-outlined text-[32px]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-title-md text-[19px] font-extrabold text-deep-navy">{t('attendanceV2.shortcutBoard')}</span>
            <span className="block font-body-md text-[14px] text-deep-navy/75">{t('attendanceV2.shortcutBoardDesc')}</span>
          </span>
          <span className="material-symbols-outlined text-[28px] text-deep-navy" aria-hidden>chevron_right</span>
        </Link>
        <Link to="/results" className="flex items-center gap-4 rounded-[18px] bg-[#e6f1ff] px-5 py-5 shadow-card transition hover:-translate-y-0.5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <span className="material-symbols-outlined text-[30px]" aria-hidden style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-title-md text-[19px] font-extrabold text-deep-navy">{t('attendanceV2.shortcutResults')}</span>
            <span className="block font-body-md text-[14px] text-deep-navy/75">{t('attendanceV2.shortcutResultsDesc')}</span>
          </span>
          <span className="material-symbols-outlined text-[28px] text-deep-navy" aria-hidden>chevron_right</span>
        </Link>
      </div>

      {detail && (
        <div
          className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-surface-container-lowest w-full max-w-[360px] rounded-xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-surface-variant flex justify-between items-center bg-surface-bright">
              <div>
                <div className="font-title-md text-title-md text-deep-navy">{detail.studentName}</div>
                <div className="font-caption text-caption text-on-surface-variant">
                  {t('attendance.dateLabel', { year, month, day: detail.day })}
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-on-surface-variant hover:bg-surface-container p-2 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-surface-container">
                <span className="font-label-md text-label-md text-on-surface-variant">{t('attendance.checkIn')}</span>
                <span className="font-title-md text-title-md text-secondary">
                  {detailRow?.checked_in_at ? timeOnly(detailRow.checked_in_at) : t('attendance.noRecord')}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-label-md text-label-md text-on-surface-variant">{t('attendance.checkOut')}</span>
                <span className="font-title-md text-title-md text-error">
                  {detailRow?.checked_out_at ? timeOnly(detailRow.checked_out_at) : t('attendance.noRecord')}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                {detailRow?.checked_in_at && (
                  <button
                    onClick={() => void handleClearCheckIn()}
                    className="flex-1 py-2 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-low transition-colors"
                  >
                    {t('attendance.clearCheckIn')}
                  </button>
                )}
                {detailRow?.checked_out_at && (
                  <button
                    onClick={() => void handleClearCheckOut()}
                    className="flex-1 py-2 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-low transition-colors"
                  >
                    {t('attendance.clearCheckOut')}
                  </button>
                )}
              </div>
              <button
                onClick={() => void handleDeleteDay()}
                className="w-full py-2.5 rounded-lg bg-error text-on-error font-label-md text-label-md hover:opacity-90 transition-opacity"
              >
                {t('attendance.deleteDay')}
              </button>
            </div>
          </div>
        </div>
      )}
      {addingStudent && academy?.id && selectedId && (
        <AddStudentModal
          academyId={academy.id}
          classId={selectedId}
          existingNames={academyStudentNames}
          onClose={() => setAddingStudent(false)}
          onAdded={(n, problem) => void handleStudentAdded(n, problem)}
        />
      )}
      {statStudent && <LearningCardModal studentId={statStudent} onClose={() => setStatStudent(null)} />}
    </div>
  );
}
