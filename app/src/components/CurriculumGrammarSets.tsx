import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { curriculumFor, NEW_CURRICULUM_IDS, SCHOOLS, type SchoolId } from '../lib/curriculumGrammar';
import { GRAMMAR_POINTS, grammarLevelTag, plainText } from '../lib/grammar';

/**
 * 교과과정 문법 — 새 수업 만들기의 "수업 세트" 안. 학교급(초등·중등·고등·기초 개념) → 학년 → 단원 순으로 항목을 고르면
 * 그 문법으로 수업(문법 칠판 + 문장 배열하기)이 바로 만들어진다. 기존 "문법 수업" 10개와 나란히 두고 비교할 수 있다.
 */
export default function CurriculumGrammarSets({ disabled, onPick }: { disabled: boolean; onPick: (grammarId: string) => void }) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith('ko');
  const [school, setSchool] = useState<SchoolId>('elementary');
  const [grade, setGrade] = useState<string | null>(null);

  const grades = useMemo(() => curriculumFor(school), [school]);
  const total = (id: SchoolId) => curriculumFor(id).reduce((n, g) => n + g.count, 0);
  const shown = grade ? grades.filter((g) => g.grade === grade) : grades;
  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`;

  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary-fixed/15 p-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-primary">school</span>
          <span className="font-label-md text-label-md font-bold text-deep-navy">{t('recipes.cgTitle')}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-caption text-caption text-primary">{t('recipes.cgNew')}</span>
        </div>
        <p className="mt-1 font-caption text-caption text-on-surface-variant">{t('recipes.cgHint')}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SCHOOLS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSchool(s.id);
              setGrade(null);
            }}
            className={chip(school === s.id)}
          >
            {ko ? s.ko : s.en} <span className="opacity-70">{total(s.id)}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setGrade(null)} className={chip(grade === null)}>
          {t('recipes.cgAllGrades')}
        </button>
        {grades.map((g) => (
          <button key={g.grade} type="button" onClick={() => setGrade(g.grade)} className={chip(grade === g.grade)}>
            {g.grade} <span className="opacity-70">{g.count}</span>
          </button>
        ))}
      </div>

      {shown.map((g) =>
        g.units.length === 0 ? null : (
          <div key={g.grade} className="space-y-2">
            {(grade === null || shown.length > 1) && <div className="font-label-md text-label-md font-bold text-deep-navy">{g.grade}</div>}
            {g.units.map(({ unit, points }) => (
              <div key={unit.id} className="space-y-1.5">
                <div className="font-caption text-caption font-bold text-primary">{ko ? unit.ko : unit.en}</div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {points.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onPick(p.id)}
                      className="flex flex-col gap-1 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 font-label-md text-label-md font-bold text-on-surface">{plainText(p.name)}</span>
                        {NEW_CURRICULUM_IDS.has(p.id) && <span className="shrink-0 rounded-full bg-warm-yellow px-1.5 py-0.5 font-caption text-[10px] font-bold text-deep-navy">NEW</span>}
                      </div>
                      <div className="line-clamp-2 font-caption text-caption text-on-surface-variant">{plainText(p.explain)}</div>
                      <div className="font-caption text-[11px] text-on-surface-variant/80">{grammarLevelTag(p)}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ),
      )}
      <p className="font-caption text-caption text-on-surface-variant">{t('recipes.cgCount', { count: GRAMMAR_POINTS.length })}</p>
    </div>
  );
}
