import { useTranslation } from 'react-i18next';
import type { BoardBlock } from '../../lib/soloBoard';
import type { SoloStep } from '../../lib/soloLessons';
import { blockPerformance, MIN_SKILL_N, type BlockStatsData } from '../../lib/soloBlockStats';

const LABEL_STYLE = {
  good: 'bg-emerald-100 text-emerald-800',
  practice: 'bg-amber-100 text-amber-800',
  review: 'bg-rose-100 text-rose-800',
} as const;

/**
 * 블록 카드 아래 한 줄 — 이 수업에서의 정답률 + 이 반이 이 능력에서 최근에 얼마나 맞히는지.
 * 기록이 8개 미만이면 숫자만 작게 보이고 판단 말은 하지 않는다(학습 카드와 같은 기준). 순위·학생 이름은 없다.
 */
export default function SoloBlockStatsLine({ data, saved, steps, block }: { data: BlockStatsData | null; saved: SoloStep[]; steps: SoloStep[]; block: BoardBlock }) {
  const { t } = useTranslation();
  const perf = blockPerformance(data, saved, steps, block);
  if (!data || (!perf.lesson && !perf.klass)) return null;
  const pct = (r: number) => Math.round(r * 100);

  return (
    <div className="mt-1.5 space-y-1 rounded-lg bg-surface-container-low px-2.5 py-1.5 font-caption text-caption text-on-surface-variant">
      {perf.lesson && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="material-symbols-outlined text-[15px] text-primary">groups</span>
          {perf.lesson.n >= MIN_SKILL_N ? (
            <>
              <span className="font-bold text-on-surface">{t('soloBoard.statsLesson', { pct: pct(perf.lesson.rate) })}</span>
              <span className="tabular-nums">{t('soloBoard.statsLessonDetail', { students: perf.lesson.students, n: perf.lesson.n, correct: perf.lesson.correct })}</span>
              {perf.lesson.label && <span className={`rounded-full px-2 py-0.5 font-bold ${LABEL_STYLE[perf.lesson.label]}`}>{t(`studentHw.label_${perf.lesson.label}`)}</span>}
            </>
          ) : (
            <span>{t('soloBoard.statsLessonFew', { n: perf.lesson.n })}</span>
          )}
        </div>
      )}
      {perf.klass && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="material-symbols-outlined text-[15px] text-primary">school</span>
          <span>
            {t(data.scope === 'class' ? 'soloBoard.statsClass' : 'soloBoard.statsAcademy', { days: data.days, skill: t(`studentHw.skill_${perf.klass.skill.replace('.', '_')}`) })}
          </span>
          {perf.klass.n >= MIN_SKILL_N ? (
            <>
              <span className="font-bold text-on-surface">{pct(perf.klass.rate)}%</span>
              <span className="tabular-nums">{t('soloBoard.statsClassDetail', { n: perf.klass.n })}</span>
              {perf.klass.label && <span className={`rounded-full px-2 py-0.5 font-bold ${LABEL_STYLE[perf.klass.label]}`}>{t(`studentHw.label_${perf.klass.label}`)}</span>}
            </>
          ) : (
            <span>{t('soloBoard.statsClassFew', { n: perf.klass.n })}</span>
          )}
        </div>
      )}
      {perf.klass?.label === 'review' && <div className="text-rose-800">{t('soloBoard.statsWeakHint')}</div>}
    </div>
  );
}
