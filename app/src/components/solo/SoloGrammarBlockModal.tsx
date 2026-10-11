import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GRAMMAR_POINTS } from '../../lib/grammar';
import { curriculumFor, SCHOOLS, type SchoolId } from '../../lib/curriculumGrammar';
import { buildFixErrorSteps, fixErrorItems, pitfallCount } from '../../lib/grammarBlocks';
import type { SoloStep } from '../../lib/soloLessons';
import SoloPrintModal from './SoloPrintModal';

/**
 * 문법 항목으로 어법 오류 고치기 블록 만들기 — 학교급·학년·단원에서 문법 항목을 고르면, 그 항목들의 검수된
 * "틀리기 쉬운 문장 → 고친 문장"으로 문제를 만든다(AI 없음). 화면에서 풀거나 인쇄할 수 있다.
 */
export default function SoloGrammarBlockModal({ lessonName, onCreate, onClose }: { lessonName: string; onCreate: (steps: SoloStep[]) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith('ko');
  const [school, setSchool] = useState<SchoolId>('middle');
  const [gradeIdx, setGradeIdx] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(8);
  const [printing, setPrinting] = useState(false);

  const grades = useMemo(() => curriculumFor(school, GRAMMAR_POINTS), [school]);
  const grade = grades[Math.min(gradeIdx, Math.max(0, grades.length - 1))];
  const ids = useMemo(() => [...picked], [picked]);
  const steps = useMemo(() => buildFixErrorSteps(ids, count), [ids, count]);
  const available = useMemo(() => fixErrorItems(GRAMMAR_POINTS.filter((p) => picked.has(p.id))).length, [picked]);

  const toggle = (id: string) =>
    setPicked((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleMany = (list: string[], on: boolean) =>
    setPicked((cur) => {
      const n = new Set(cur);
      for (const id of list) {
        if (on) n.add(id);
        else n.delete(id);
      }
      return n;
    });

  const chip = (on: boolean) => `rounded-full px-4 py-1.5 font-label-md text-label-md ${on ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'}`;

  return (
    <div className="fixed inset-0 z-[67] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-surface-container-lowest p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[26px] text-primary">spellcheck</span>
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{t('soloGrammar.title')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('soloGrammar.intro')}</p>

        <div className="flex flex-wrap gap-2">
          {SCHOOLS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSchool(s.id);
                setGradeIdx(0);
              }}
              className={chip(school === s.id)}
            >
              {ko ? s.ko : s.en}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {grades.map((g, i) => (
            <button key={g.grade} type="button" onClick={() => setGradeIdx(i)} className={chip(gradeIdx === i)}>
              {g.grade}
            </button>
          ))}
        </div>

        <div className="max-h-[34vh] space-y-3 overflow-y-auto rounded-xl border border-outline-variant/50 p-3">
          {grade && grade.units.length === 0 && <p className="font-caption text-caption text-on-surface-variant">{t('soloGrammar.noUnits')}</p>}
          {grade?.units.map(({ unit, points }) => {
            const usable = points.filter((p) => pitfallCount(p) > 0);
            if (usable.length === 0) return null;
            const allOn = usable.every((p) => picked.has(p.id));
            return (
              <div key={unit.id}>
                <label className="flex items-center gap-2 font-label-md text-label-md font-bold text-deep-navy">
                  <input type="checkbox" checked={allOn} onChange={(e) => toggleMany(usable.map((p) => p.id), e.target.checked)} className="h-4 w-4" />
                  {ko ? unit.ko : unit.en}
                </label>
                <ul className="mt-1 space-y-0.5 pl-6">
                  {usable.map((p) => (
                    <li key={p.id}>
                      <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
                        <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4" />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="shrink-0 font-caption text-caption text-on-surface-variant">{t('soloGrammar.itemCount', { n: pitfallCount(p) })}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div>
          <div className="mb-1.5 font-label-md text-label-md font-bold text-on-surface">{t('soloText.countLabel')}</div>
          <div className="flex flex-wrap gap-2">
            {[5, 8, 10, 15].map((n) => (
              <button key={n} type="button" onClick={() => setCount(n)} className={chip(count === n)}>
                {t('soloText.countN', { n })}
              </button>
            ))}
          </div>
        </div>

        {picked.size === 0 ? (
          <p className="rounded-xl bg-surface-container-low px-4 py-3 font-caption text-caption text-on-surface-variant">{t('soloGrammar.pickHint')}</p>
        ) : steps.length === 0 ? (
          <p className="rounded-xl bg-error/10 px-4 py-3 font-caption text-caption text-error">{t('soloGrammar.none')}</p>
        ) : (
          <div className="rounded-xl bg-primary-fixed/25 px-4 py-3">
            <div className="font-label-md text-label-md font-bold text-deep-navy">
              {t('soloGrammar.preview', { count: steps.length, points: picked.size })}
              {available > steps.length && <span className="ml-2 font-caption text-caption font-normal text-on-surface-variant">{t('soloGrammar.moreAvailable', { n: available })}</span>}
            </div>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-6 font-caption text-caption text-on-surface">
              {steps.slice(0, 4).map((s, i) =>
                s.t === 'fixError' ? (
                  <li key={i} className="truncate">
                    <span className="text-error line-through">{s.wrong}</span> → <b>{s.right}</b>
                  </li>
                ) : null,
              )}
            </ol>
            {steps.length > 4 && <div className="mt-0.5 pl-6 font-caption text-caption text-on-surface-variant">… {t('soloText.more', { n: steps.length - 4 })}</div>}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={steps.length === 0}
            onClick={() => setPrinting(true)}
            className="flex items-center gap-1 rounded-full border border-primary px-5 py-2 font-label-md text-label-md text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            {t('soloText.printOnly')}
          </button>
          <button
            type="button"
            disabled={steps.length === 0}
            onClick={() => onCreate(steps)}
            className="rounded-full bg-primary px-6 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-40"
          >
            {t('soloText.create')}
          </button>
        </div>
      </div>
      {printing && <SoloPrintModal steps={steps} title={lessonName} onClose={() => setPrinting(false)} />}
    </div>
  );
}
