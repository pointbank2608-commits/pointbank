import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchStudentsOfClass } from '../../../lib/api';
import { fetchLearningCard, teacherErrorKey, type LearningCard } from '../../../lib/homework';
import { buildStatSheet, type StatSheet } from '../../../lib/homework/stats';
import type { Student } from '../../../lib/types';
import LearningCardModal from './LearningCardModal';
import { GradeBadge } from './StatCard';

interface Row {
  student: Student;
  card: LearningCard | null;
  sheet: StatSheet | null;
  error?: boolean;
}

/** 학생 카드를 한꺼번에 너무 많이 부르지 않게(반 30명이어도 4개씩) */
async function inBatches<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>, onEach: (x: T, r: R | null) => void) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map((x) => fn(x).then((r) => onEach(x, r), () => onEach(x, null))));
  }
}

/**
 * 리포트 메뉴의 "학생 스탯"(2026-10-05) — 반 학생마다 전체 등급·능력 5개 등급·숙제 완료·먼저 복습할 낱말을 한 줄로.
 * 누르면 숙제 결과와 같은 학습 카드 창(스탯 카드·자세히·학부모 리포트)이 열린다.
 * 순위를 매기지 않도록 이름순으로만 보여 준다(등급순 정렬 없음).
 */
export default function ClassStatsPanel({ classId }: { classId: string | null }) {
  const { t } = useTranslation();
  const [days, setDays] = useState<30 | 90>(30);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; view: 'stat' | 'report' } | null>(null);

  useEffect(() => {
    if (!classId) return;
    let alive = true;
    setRows(null);
    setErr(null);
    (async () => {
      try {
        const students = await fetchStudentsOfClass(classId);
        if (!alive) return;
        setRows(students.map((s) => ({ student: s, card: null, sheet: null })));
        let failed = 0;
        await inBatches(
          students,
          4,
          (s) => fetchLearningCard(s.id, days),
          (s, card) => {
            if (!alive) return;
            if (!card) failed += 1;
            setRows((rs) => rs?.map((r) => (r.student.id === s.id ? { ...r, card, sheet: card ? buildStatSheet(card) : null, error: !card } : r)) ?? rs);
          },
        );
        // 전부 실패하면 대개 041 이 없거나 연결 문제 — 한 번 더 불러 이유를 보여 준다
        if (alive && failed === students.length && students.length > 0) await fetchLearningCard(students[0].id, days).catch((e) => setErr(t(teacherErrorKey(e))));
      } catch (e) {
        if (alive) setErr(t(teacherErrorKey(e)));
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId, days, t]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-base text-on-surface-variant">{t('studentHw.classStatsIntro')}</p>
        <div className="flex gap-2" role="group" aria-label={t('studentHw.period')}>
          {([30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={`min-h-11 rounded-full px-5 font-label-md text-label-md ${days === d ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface'}`}
            >
              {t('studentHw.lastDays', { n: d })}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-base text-on-error-container">{err}</div>}
      {!classId && <p className="text-base text-on-surface-variant">{t('studentHw.noStudentsTeacher')}</p>}
      {classId && rows === null && !err && <p className="text-base text-on-surface-variant">{t('common.loading')}</p>}
      {rows && rows.length === 0 && <p className="text-base text-on-surface-variant">{t('studentHw.noStudentsTeacher')}</p>}

      {rows && rows.length > 0 && (
        <ul className="divide-y divide-outline-variant/40 overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
          {rows.map(({ student, card, sheet, error }) => (
            <li key={student.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <GradeBadge grade={sheet?.overall.grade ?? null} tone="light" />
              <div className="min-w-[8rem] flex-1">
                <div className="text-lg font-bold text-deep-navy">{student.name}</div>
                <div className="text-sm text-on-surface-variant">
                  {!card && !error
                    ? t('common.loading')
                    : error
                      ? t('studentHw.errGeneric')
                      : card && card.habit.assigned === 0
                        ? t('studentHw.noOnlineHomework')
                        : card && t('studentHw.habitEvidence', { finished: card.habit.finished, assigned: card.habit.assigned })}
                  {sheet && !sheet.enough && card && card.habit.assigned > 0 && ` · ${t('studentHw.collectingShort')}`}
                </div>
              </div>
              {sheet && (
                <div className="flex flex-wrap gap-1.5" aria-label={t('studentHw.radarLabel')}>
                  {sheet.abilities.map((a) => (
                    <span key={a.key} className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-2 py-1 text-sm">
                      {t(`studentHw.ability_${a.key}`)}
                      <b className="tabular-nums">{a.grade ?? '?'}</b>
                    </span>
                  ))}
                </div>
              )}
              {card && card.wrong_words.length > 0 && (
                <div className="w-full text-sm text-on-surface-variant sm:w-auto">
                  {t('studentHw.reviewFirst')}: <span className="text-on-error-container">{card.wrong_words.slice(0, 3).map((w) => w.word).join(', ')}</span>
                </div>
              )}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpen({ id: student.id, view: 'stat' })}
                  className="flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 font-label-md text-label-md text-on-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">military_tech</span>
                  {t('studentHw.view_stat')}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen({ id: student.id, view: 'report' })}
                  className="flex min-h-11 items-center gap-1 rounded-full border border-outline-variant px-4 font-label-md text-label-md text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">family_restroom</span>
                  {t('studentHw.view_report')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-on-surface-variant">{t('studentHw.cardFootnote')}</p>

      {open && <LearningCardModal studentId={open.id} initialView={open.view} onClose={() => setOpen(null)} />}
    </div>
  );
}
