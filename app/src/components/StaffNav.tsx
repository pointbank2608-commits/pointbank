import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeature } from '../lib/features';
import { findActive, STAFF_NAV_GROUPS, visibleGroups } from '../lib/navGroups';
import { FREE_BLOCKED_PATHS } from '../lib/planLimits';

interface Props {
  /** 링크를 누르면(모바일 서랍 닫기 등) 부른다 */
  onNavigate?: () => void;
}

const ROW = 'flex items-center gap-3.5 px-4 py-3 rounded-[14px] font-label-md text-[17px] font-semibold transition-all';
const OFF = 'text-white/85 hover:bg-white/10';
const ON = 'bg-primary text-white shadow-[0_6px_16px_rgb(8_102_255/35%)]';

/** 선생님 메뉴(네이비 사이드바용): 묶음 5개 행 + 지금 화면이 속한 묶음만 펼친 항목 목록. NavLink 대신 Link 를 써서 같은 주소가 겹쳐 선택돼 보이지 않게 한다. */
export default function StaffNav({ onNavigate }: Props) {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const { hasFullAccess } = useAuth();
  const groupOpen = useFeature('group');
  const homeworkOpen = useFeature('homework');

  const groups = visibleGroups(STAFF_NAV_GROUPS, { group: groupOpen, homework: homeworkOpen });
  const active = findActive(groups, pathname+(search.includes('tab=course')?'?tab=course':''));
  const lockedPath = (to: string) => !hasFullAccess && FREE_BLOCKED_PATHS.includes(to);
  const lock = (
    <span className="material-symbols-outlined shrink-0 text-[16px]" title={t('nav.premiumPageBadge')}>
      lock
    </span>
  );

  return (
    <ul className="flex flex-1 flex-col gap-1.5 px-4">
      {groups.map((g) => {
        const isActive = active?.group.id === g.id;
        const single = g.children.length === 1;
        return (
          <li key={g.id}>
            <Link
              to={g.home ?? g.children[0].to}
              onClick={onNavigate}
              aria-expanded={single ? undefined : isActive}
              aria-current={single && isActive ? 'page' : undefined}
              className={`${ROW} ${isActive ? ON : OFF}`}
            >
              <span className="material-symbols-outlined shrink-0 text-[28px]" aria-hidden>
                {g.icon}
              </span>
              <span className="flex-1 truncate">{t(g.labelKey)}</span>
              {single && lockedPath(g.children[0].to) && lock}
              {isActive && (
                <span className="material-symbols-outlined shrink-0 text-[22px]" aria-hidden>
                  {single ? 'chevron_right' : 'expand_more'}
                </span>
              )}
            </Link>
            {!single && isActive && (
              <ul className="mb-1 mt-1.5 flex flex-col gap-0.5">
                {g.children.map((c) => {
                  const on = active?.child.to === c.to;
                  return (
                    <li key={c.to}>
                      <Link
                        to={c.to}
                        onClick={onNavigate}
                        aria-current={on ? 'page' : undefined}
                        className={`flex items-center gap-2.5 rounded-[12px] py-2.5 pl-12 pr-4 font-label-md text-[15px] font-semibold transition-all ${
                          on ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[19px]">{c.icon}</span>
                        <span className="flex-1 truncate">{t(c.labelKey)}</span>
                        {lockedPath(c.to) && lock}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
