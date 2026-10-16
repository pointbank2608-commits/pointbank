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

const ROW = 'flex items-center gap-3 px-4 py-3 rounded-lg font-label-md text-label-md transition-all';
const ON = 'bg-secondary-container text-on-secondary-container font-bold';
const OFF = 'text-on-surface-variant hover:bg-soft-mint/20';

/** 선생님 메뉴: 묶음 5개 행 + 지금 화면이 속한 묶음만 펼친 항목 목록. NavLink 대신 Link 를 써서 같은 주소가 겹쳐 선택돼 보이지 않게 한다. */
export default function StaffNav({ onNavigate }: Props) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { hasFullAccess } = useAuth();
  const groupOpen = useFeature('group');
  const homeworkOpen = useFeature('homework');

  const groups = visibleGroups(STAFF_NAV_GROUPS, { group: groupOpen, homework: homeworkOpen });
  const active = findActive(groups, pathname);
  const lockedPath = (to: string) => !hasFullAccess && FREE_BLOCKED_PATHS.includes(to);
  const lock = (
    <span className="material-symbols-outlined shrink-0 text-[16px]" title={t('nav.premiumPageBadge')}>
      lock
    </span>
  );

  return (
    <ul className="flex-1 flex flex-col gap-1 px-2">
      {groups.map((g) => {
        const isActive = active?.group.id === g.id;
        const single = g.children.length === 1;
        return (
          <li key={g.id}>
            <Link
              to={g.children[0].to}
              onClick={onNavigate}
              aria-expanded={single ? undefined : isActive}
              className={`${ROW} ${isActive ? ON : OFF}`}
            >
              <span className="material-symbols-outlined">{g.icon}</span>
              <span className="flex-1 truncate">{t(g.labelKey)}</span>
              {single && lockedPath(g.children[0].to) && lock}
              {!single && (
                <span className="material-symbols-outlined shrink-0 text-[20px]" aria-hidden>
                  {isActive ? 'expand_more' : 'chevron_right'}
                </span>
              )}
            </Link>
            {!single && isActive && (
              <ul className="mt-1 mb-1 flex flex-col gap-0.5">
                {g.children.map((c) => {
                  const on = active?.child.to === c.to;
                  return (
                    <li key={c.to}>
                      <Link
                        to={c.to}
                        onClick={onNavigate}
                        aria-current={on ? 'page' : undefined}
                        className={`flex items-center gap-2.5 rounded-lg py-2.5 pl-12 pr-4 font-label-md text-label-md transition-all ${
                          on ? 'bg-primary-fixed/50 font-bold text-deep-navy' : OFF
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{c.icon}</span>
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
