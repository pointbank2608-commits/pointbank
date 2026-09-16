import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getGameCatalogEntry, isFreeTierGame } from '../lib/gameCatalog';
import { isPathBlockedForFree } from '../lib/planLimits';
import type { GameType } from '../lib/types';

/** App.tsx의 34개 게임 라우트를 전부 건드리지 않고, AppLayout 안(모든 화면 공통) 딱 한
 * 곳에서 무료 플랜이 못 들어가는 경로를 막는다. 렌더하는 화면은 없고(null 반환), 경로가
 * 바뀔 때마다 검사만 한다. */
export default function PlanRouteGuard() {
  const { t } = useTranslation();
  const { isPaid, isStaff } = useAuth();
  const { notify } = useToast();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPaid) return;

    const gameMatch = pathname.match(/^\/games\/([^/]+)/);
    const gameType = gameMatch?.[1] as GameType | undefined;
    const blockedGame = gameType ? !!getGameCatalogEntry(gameType) && !isFreeTierGame(gameType) : false;

    if (isPathBlockedForFree(pathname) || blockedGame) {
      notify(t('plan.upgradeRequiredToast'), 'error');
      navigate(isStaff ? '/dashboard' : '/me', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isPaid]);

  return null;
}
