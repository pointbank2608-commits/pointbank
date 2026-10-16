import { useTranslation } from 'react-i18next';
import { STAFF_NAV_GROUPS } from '../../lib/navGroups';

const CHIP = {
  today: 'bg-tag-today text-tag-today-ink',
  lesson: 'bg-tag-lesson text-tag-lesson-ink',
  library: 'bg-tag-library text-tag-library-ink',
  class: 'bg-tag-class text-tag-class-ink',
  more: 'bg-tag-more text-tag-more-ink',
} as const;

/**
 * 랜딩 히어로의 앱 화면 목업 — 스크린샷이 아니라 같은 디자인 토큰으로 그린 정적 화면이다(실제 계정의
 * 학원·학생 이름이 노출되지 않게). 클릭할 수 없는 장식이라 button 대신 div 를 쓴다.
 */
export default function ProductMock() {
  const { t } = useTranslation();
  return (
    <div className="relative mx-auto w-full max-w-[560px] pb-6 pt-8">
      <div className="overflow-hidden rounded-[24px] border border-outline-variant/50 bg-surface-container-lowest shadow-card" aria-hidden>
        <div className="flex h-9 items-center gap-1.5 bg-surface-container px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-clay-coral" />
          <span className="h-2.5 w-2.5 rounded-full bg-clay-yellow" />
          <span className="h-2.5 w-2.5 rounded-full bg-clay-mint" />
        </div>
        <div className="flex bg-background">
          <div className="hidden w-[150px] shrink-0 flex-col gap-1.5 border-r border-outline-variant/40 bg-surface-container-low p-3 md:flex">
            {STAFF_NAV_GROUPS.map((g, i) => (
              <div key={g.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] ${i === 0 ? `${CHIP[g.id]} font-bold` : 'text-on-surface-variant'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${CHIP[g.id]}`}>
                  <span className="material-symbols-outlined text-[15px]">{g.icon}</span>
                </span>
                {t(g.labelKey)}
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-3 p-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: 'play_arrow', tone: CHIP.today, label: t('todayEntry.start') },
                { icon: 'add', tone: CHIP.lesson, label: t('todayEntry.create') },
                { icon: 'print', tone: CHIP.library, label: t('todayEntry.print') },
              ].map((e) => (
                <div key={e.label} className="flex flex-col items-center gap-1 rounded-2xl bg-surface-container-lowest p-2.5 text-center shadow-card">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${e.tone}`}>
                    <span className="material-symbols-outlined text-[18px]">{e.icon}</span>
                  </span>
                  <span className="text-[12px] font-bold leading-4 text-on-surface">{e.label}</span>
                </div>
              ))}
            </div>
            <div className="text-[14px] font-bold text-deep-navy">{t('landing.mockToday')}</div>
            {[
              { time: '3:30', name: t('landing.mockClass1'), sub: t('landing.mockClass1Sub'), action: `▶ ${t('landing.mockStart')}`, primary: true },
              { time: '5:00', name: t('landing.mockClass2'), sub: t('landing.mockClass2Sub'), action: t('landing.mockCreate'), primary: false },
            ].map((r) => (
              <div key={r.time} className="flex items-center gap-2 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-2.5">
                <span className="w-9 text-[13px] font-bold text-deep-navy">{r.time}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-on-surface">{r.name}</div>
                  <div className="truncate text-[12px] text-on-surface-variant">{r.sub}</div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold ${r.primary ? 'bg-primary text-on-primary' : 'bg-tag-today text-tag-today-ink'}`}>{r.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <img src="/landing/char-teacher.webp" alt="" aria-hidden width={374} height={700} className="pointer-events-none absolute -left-4 bottom-0 h-[170px] w-auto drop-shadow-md sm:-left-8 sm:h-[210px]" />
      <img src="/landing/char-boy.webp" alt="" aria-hidden width={429} height={700} className="pointer-events-none absolute -right-3 top-0 h-[120px] w-auto drop-shadow-md sm:-right-6 sm:h-[150px]" />
      <img src="/skins/dig/starfish.webp" alt="" aria-hidden width={56} height={56} className="pointer-events-none absolute bottom-1 right-2 h-14 w-auto" />
    </div>
  );
}
