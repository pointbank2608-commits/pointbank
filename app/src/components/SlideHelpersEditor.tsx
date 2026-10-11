import { useTranslation } from 'react-i18next';
import { formatClock, HELPER_POSITIONS, HELPER_TYPES, newHelper, POSITION_CLASS, TEAM_COLORS, TIMER_PRESETS, type HelperType } from '../lib/slideHelpers';
import type { HelperPosition, SlideHelper } from '../lib/types';

/**
 * 슬라이드 상세 아래의 "보조 블록" 패널 — 주 블록(이 슬라이드의 게임·문제·워크시트 …) 곁에 제목·타이머·점수판을 놓는다.
 * 슬라이드 종류와 상관없이 같은 패널이고, 주 블록을 바꿔도 보조 블록은 남는다(placeSlides).
 */
const ICON: Record<HelperType, string> = { title: 'title', timer: 'timer', scoreboard: 'scoreboard' };

export default function SlideHelpersEditor({ helpers, onChange }: { helpers: SlideHelper[]; onChange: (next: SlideHelper[] | undefined) => void }) {
  const { t } = useTranslation();
  const set = (next: SlideHelper[]) => onChange(next.length > 0 ? next : undefined);
  const patch = (id: string, p: Partial<SlideHelper>) => set(helpers.map((h) => (h.id === id ? ({ ...h, ...p } as SlideHelper) : h)));
  const field = 'rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-sm text-on-surface outline-none focus:border-primary';

  return (
    <section className="space-y-3 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-primary">widgets</span>
        <h4 className="font-label-md text-label-md font-bold text-on-surface">{t('curriculum.helpers.title')}</h4>
        <span className="font-caption text-caption text-on-surface-variant">{t('curriculum.helpers.hint')}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {HELPER_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => set([...helpers, newHelper(type)])}
            className="flex items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 font-label-md text-label-md text-primary hover:bg-primary/10"
          >
            <span className="material-symbols-outlined text-[18px]">{ICON[type]}</span>
            {t(`curriculum.helpers.add_${type}`)}
          </button>
        ))}
      </div>

      {helpers.length > 0 && (
        <>
          <ul className="space-y-2">
            {helpers.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-lowest p-2">
                <span className="flex w-24 shrink-0 items-center gap-1 font-label-md text-label-md text-on-surface">
                  <span className="material-symbols-outlined text-[18px] text-primary">{ICON[h.type]}</span>
                  {t(`curriculum.helpers.name_${h.type}`)}
                </span>
                {h.type === 'title' && (
                  <input
                    value={h.text}
                    onChange={(e) => patch(h.id, { text: e.target.value })}
                    placeholder={t('curriculum.helpers.titlePlaceholder')}
                    className={`${field} min-w-0 flex-1`}
                  />
                )}
                {h.type === 'timer' && (
                  <div className="flex flex-wrap items-center gap-1">
                    {TIMER_PRESETS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => patch(h.id, { seconds: s })}
                        className={`rounded-full px-2.5 py-1 text-sm ${h.seconds === s ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                      >
                        {formatClock(s)}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={5}
                      max={3600}
                      value={h.seconds}
                      onChange={(e) => patch(h.id, { seconds: Math.max(5, Math.min(3600, Math.round(Number(e.target.value) || 5))) })}
                      className={`${field} w-20`}
                      aria-label={t('curriculum.helpers.seconds')}
                    />
                    <span className="font-caption text-caption text-on-surface-variant">{t('curriculum.helpers.secondsUnit')}</span>
                  </div>
                )}
                {h.type === 'scoreboard' && (
                  <div className="flex items-center gap-1">
                    {[2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => patch(h.id, { teams: n })}
                        className={`rounded-full px-3 py-1 text-sm ${h.teams === n ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                      >
                        {t('curriculum.helpers.teamsN', { n })}
                      </button>
                    ))}
                  </div>
                )}
                <select value={h.position} onChange={(e) => patch(h.id, { position: e.target.value as HelperPosition })} className={`${field} ml-auto`} aria-label={t('curriculum.helpers.position')}>
                  {HELPER_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {t(`curriculum.helpers.pos_${p}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => set(helpers.filter((x) => x.id !== h.id))}
                  className="rounded-full p-1 text-on-surface-variant hover:bg-error/10 hover:text-error"
                  aria-label={t('common.delete')}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </li>
            ))}
          </ul>

          {/* 자리 미리보기 */}
          <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-lg border border-outline-variant bg-surface-container-highest" aria-hidden>
            <div className="absolute inset-3 flex items-center justify-center rounded border border-dashed border-outline-variant font-caption text-caption text-on-surface-variant">
              {t('curriculum.helpers.mainBlock')}
            </div>
            {HELPER_POSITIONS.map((p) => {
              const here = helpers.filter((h) => h.position === p);
              if (here.length === 0) return null;
              return (
                <div key={p} className={`absolute flex flex-col gap-1 ${POSITION_CLASS[p]}`}>
                  {here.map((h) => (
                    <span key={h.id} className="rounded-md bg-deep-navy/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {h.type === 'title' ? h.text || t('curriculum.helpers.name_title') : h.type === 'timer' ? formatClock(h.seconds) : (
                        <>
                          {Array.from({ length: h.teams }, (_, i) => (
                            <span key={i} className="mr-0.5 inline-block h-2 w-2 rounded-full" style={{ background: TEAM_COLORS[i % TEAM_COLORS.length] }} />
                          ))}
                          0
                        </>
                      )}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
