import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/attendance', key: 'attendance' },
  { to: '/board', key: 'board' },
  { to: '/results', key: 'results' },
] as const;

/** 우리 반 공통 머리글(2026-10-17, 시안 05_classroom_selected) — 제목·설명과 출석부/칭찬 통장/기록 탭. 세 화면이 같이 쓴다. 주소·뒤로가기는 그대로다. */
export default function ClassroomHeader() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display-lg text-[clamp(1.9rem,3.4vw,2.6rem)] font-black leading-tight tracking-[-0.02em] text-deep-navy">{t('classroomHeader.title')}</h1>
        <p className="mt-1 font-body-lg text-[clamp(1rem,1.4vw,1.2rem)] text-on-surface-variant">{t('classroomHeader.subtitle')}</p>
      </div>
      <nav aria-label={t('classroomHeader.title')} className="grid grid-cols-3 gap-3">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex min-h-[52px] items-center justify-center rounded-[12px] px-3 font-title-md text-[17px] font-bold transition-colors ${
                isActive ? 'bg-primary text-white shadow-[0_6px_16px_rgb(8_102_255/28%)]' : 'bg-primary-fixed/70 text-deep-navy hover:bg-primary-fixed'
              }`
            }
          >
            {t(`classroomHeader.tab_${tab.key}`)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
