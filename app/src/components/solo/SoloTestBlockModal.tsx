import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SoloStep } from '../../lib/soloLessons';
import { areaCounts, buildTestStep, TEST_AREAS, TEST_LENGTHS, testCapacity, testSeconds } from '../../lib/soloTest';

type TestStep = Extract<SoloStep, { t: 'test' }>;

/**
 * 시험 블록 만들기 창 — 범위·길이·제한 시간만 고르면 수업의 낱말·문장 문제로 시험 하나가 만들어진다.
 * 범위는 지금 "이 수업에서 배운 것"만 되고, 학교 학년·6년 커리큘럼은 "준비 중"으로 보여 준다.
 */
export default function SoloTestBlockModal({
  steps,
  current,
  onCreate,
  onClose,
}: {
  /** 이 수업의 단계(시험 재료) */
  steps: SoloStep[];
  /** 다시 만들기면 지금 시험(길이·시간·제목을 이어받는다) */
  current?: TestStep;
  onCreate: (test: TestStep) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cap = useMemo(() => testCapacity(steps.filter((s) => s.t !== 'test')), [steps]);
  const lengths = TEST_LENGTHS.filter((n) => n <= Math.max(cap, TEST_LENGTHS[0]));
  const [count, setCount] = useState<number>(() => {
    const want = current?.items.length ?? 10;
    return Math.min(want, Math.max(cap, 1));
  });
  const [timed, setTimed] = useState(current?.timed ?? true);
  const [title, setTitle] = useState(current?.title || t('soloTest.defaultTitle'));
  // 미리보기는 길이가 바뀔 때만 다시 만든다(문제 고르기에 무작위가 섞여 있다)
  const draft = useMemo(() => buildTestStep(steps, { count, timed, title: '' }), [steps, count, timed]);
  const counts = draft ? areaCounts(draft.items) : null;
  const chip = (on: boolean) => `rounded-full px-4 py-1.5 font-label-md text-label-md ${on ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'}`;

  return (
    <div className="fixed inset-0 z-[67] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-surface-container-lowest p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[26px] text-primary">assignment_turned_in</span>
          <h3 className="flex-1 font-title-md text-title-md font-bold text-deep-navy">{current ? t('soloTest.regenTitle') : t('soloTest.modalTitle')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('soloTest.modalIntro')}</p>

        <div>
          <div className="mb-1.5 font-label-md text-label-md font-bold text-on-surface">{t('soloTest.scopeLabel')}</div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 rounded-xl border border-primary bg-primary/5 px-3 py-2">
              <input type="radio" checked readOnly />
              <span className="font-label-md text-label-md text-on-surface">{t('soloTest.scopeLesson')}</span>
            </label>
            {(['grade', 'curriculum'] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 rounded-xl border border-outline-variant/50 px-3 py-2 opacity-60">
                <input type="radio" disabled />
                <span className="flex-1 font-label-md text-label-md text-on-surface-variant">{t(`soloTest.scope_${s}`)}</span>
                <span className="rounded-full bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{t('soloTest.soon')}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 font-label-md text-label-md font-bold text-on-surface">{t('soloTest.lengthLabel')}</div>
          <div className="flex flex-wrap items-center gap-2">
            {lengths.map((n) => (
              <button key={n} type="button" onClick={() => setCount(n)} className={chip(count === n)}>
                {t('soloTest.lengthN', { n })}
              </button>
            ))}
            {cap > 0 && cap < TEST_LENGTHS[TEST_LENGTHS.length - 1] && !lengths.includes(cap as (typeof TEST_LENGTHS)[number]) && (
              <button type="button" onClick={() => setCount(cap)} className={chip(count === cap)}>
                {t('soloTest.lengthMax', { n: cap })}
              </button>
            )}
          </div>
          {cap < 10 && <p className="mt-1 font-caption text-caption text-on-surface-variant">{t('soloTest.fewMaterial', { n: cap })}</p>}
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} className="h-4 w-4" />
          <span className="font-label-md text-label-md text-on-surface">{t('soloTest.timedLabel')}</span>
        </label>

        <label className="block">
          <span className="mb-1 block font-caption text-caption text-on-surface-variant">{t('soloTest.titleLabel')}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary" />
        </label>

        {draft && counts ? (
          <div className="rounded-xl bg-primary-fixed/25 px-4 py-3">
            <div className="font-label-md text-label-md font-bold text-deep-navy">
              {t('soloTest.preview', { count: draft.items.length, minutes: Math.max(1, Math.round(testSeconds(draft.items) / 60)) })}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {TEST_AREAS.filter((a) => counts[a] > 0).map((a) => (
                <span key={a} className="rounded-full bg-surface-container-lowest px-2.5 py-0.5 font-caption text-caption text-on-surface">
                  {t(`soloTest.area_${a}`)} {counts[a]}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-error/10 px-4 py-3 font-caption text-caption text-error">{t('soloTest.noMaterial')}</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!draft}
            onClick={() => draft && onCreate({ ...draft, title: title.trim() || t('soloTest.defaultTitle') })}
            className="rounded-full bg-primary px-6 py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-40"
          >
            {current ? t('soloTest.regenCreate') : t('soloTest.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
