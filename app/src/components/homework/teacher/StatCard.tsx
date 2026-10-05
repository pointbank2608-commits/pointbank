import { useTranslation } from 'react-i18next';
import { subLabelKey, type AbilityStat, type Grade, type StatSheet, type SubStat } from '../../../lib/homework/stats';

const GRADE_COLOR: Record<Grade, string> = {
  'S+': '#f5c542',
  S: '#f0a93b',
  A: '#4cc38a',
  B: '#5aa9f0',
  C: '#b39ddb',
};

/** 등급 배지 — 등급이 없으면 "?" */
export function GradeBadge({ grade, size = 'md', tone = 'dark' }: { grade: Grade | null; size?: 'sm' | 'md' | 'lg'; tone?: 'dark' | 'light' }) {
  const { t } = useTranslation();
  const dim = size === 'lg' ? 'h-20 w-20 text-4xl' : size === 'md' ? 'h-11 w-11 text-xl' : 'h-7 min-w-7 px-1 text-sm';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl font-black italic tabular-nums ${dim}`}
      style={
        grade
          ? { background: GRADE_COLOR[grade], color: '#16213e' }
          : tone === 'light'
            ? { background: '#e6e8ee', color: '#5b6476' }
            : { background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }
      }
      aria-label={grade ? t('studentHw.gradeIs', { grade }) : t('studentHw.gradeUnknown')}
    >
      {grade ?? '?'}
    </span>
  );
}

/** 다섯 능력 레이더 — 등급이 없는 축은 점선 원 위에 "?" */
function Radar({ abilities }: { abilities: AbilityStat[] }) {
  const { t } = useTranslation();
  const cx = 110;
  const cy = 110;
  const R = 78;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / abilities.length;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };
  // 아직 재지 않은 능력(?)은 0점처럼 보이지 않게 그래프에서 뺀다(잰 능력끼리만 잇는다)
  const poly = abilities
    .map((a, i) => (a.rate === null ? null : pt(i, R * Math.max(0.08, a.rate)).join(',')))
    .filter(Boolean)
    .join(' ');
  const knownCount = abilities.filter((a) => a.rate !== null).length;
  const anyKnown = knownCount >= 3;
  return (
    <svg viewBox="-30 -4 280 228" className="h-auto w-full max-w-[300px]" role="img" aria-label={t('studentHw.radarLabel')}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={abilities.map((_, i) => pt(i, R * f).join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      ))}
      {abilities.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />;
      })}
      {anyKnown && <polygon points={poly} fill="rgba(245,197,66,0.35)" stroke="#f5c542" strokeWidth={2} strokeLinejoin="round" />}
      {abilities.map((a, i) => {
        if (a.rate === null) return null;
        const [x, y] = pt(i, R * Math.max(0.08, a.rate));
        return <circle key={a.key} cx={x} cy={y} r={3.5} fill="#f5c542" />;
      })}
      {abilities.map((a, i) => {
        const [x, y] = pt(i, R + 22);
        return (
          <text key={a.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={11} fontWeight={700}>
            {t(`studentHw.ability_${a.key}`)} {a.grade ?? '?'}
          </text>
        );
      })}
    </svg>
  );
}

function Delta({ s }: { s: SubStat }) {
  const { t } = useTranslation();
  if (s.delta === null || Math.abs(s.delta) < 5) return null;
  return (
    <span className={`text-xs font-bold ${s.delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`} aria-label={t(s.delta > 0 ? 'studentHw.vsPrevUp' : 'studentHw.vsPrevDown', { n: Math.abs(s.delta) })}>
      {s.delta > 0 ? '▲' : '▼'}
      {Math.abs(s.delta)}
    </span>
  );
}

/**
 * 철권 플레이어 카드처럼 보이는 학생 스탯 카드 — 이름·전체 등급·레이더·능력별 등급과 세부 능력·경기 기록.
 * 학생끼리 순위는 없다. 기록이 모자라면 등급 대신 "?"와 안내.
 */
export default function StatCard({ name, className, days, sheet }: { name: string; className?: string | null; days: number; sheet: StatSheet }) {
  const { t } = useTranslation();
  const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#16213e] via-[#1d2b55] to-[#2a1f4d] p-4 text-white shadow-lg sm:p-5">
      <div className="flex items-center gap-4">
        <GradeBadge grade={sheet.overall.grade} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-warm-yellow">Classbank Student</div>
          <div className="truncate text-2xl font-black">{name}</div>
          <div className="text-sm text-white/70">
            {[className, t('studentHw.lastDays', { n: days })].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      {!sheet.enough && (
        <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm">
          <b>{t('studentHw.collectingTitle')}</b> · {t('studentHw.collectingBody')}
        </div>
      )}

      <div className="mt-3 grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex justify-center">
          <Radar abilities={sheet.abilities} />
        </div>
        <ul className="space-y-2">
          {sheet.abilities.map((a) => (
            <li key={a.key} className="rounded-xl bg-white/8 p-2" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                <GradeBadge grade={a.grade} size="sm" />
                <span className="flex-1 text-base font-bold">{t(`studentHw.ability_${a.key}`)}</span>
                {a.key === 'reading' && <span className="text-xs text-white/60">{t('studentHw.readingSoon')}</span>}
              </div>
              {a.subs.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5 pl-1">
                  {a.subs.map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-xs">
                      {t(subLabelKey(s.key))}
                      <b className="tabular-nums">{s.grade ?? '?'}</b>
                      <Delta s={s} />
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {[
          [t('studentHw.recCorrect'), pct(sheet.record.correctRate)],
          [t('studentHw.recGraded'), String(sheet.record.graded)],
          [t('studentHw.recFinished'), `${sheet.record.finished}/${sheet.record.assigned}`],
          [t('studentHw.recRetry'), `${sheet.record.corrected}/${sheet.record.retries}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-black/20 px-2 py-2">
            <div className="text-lg font-black tabular-nums">{value}</div>
            <div className="text-xs text-white/70">{label}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-white/60">{t('studentHw.gradeRule')}</p>
    </div>
  );
}
