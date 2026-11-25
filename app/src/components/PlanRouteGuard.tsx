import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getGameCatalogEntry, isFreeTierGame } from '../lib/gameCatalog';
import { featureOfPath, featureOpen } from '../lib/features';
import { isPathBlockedForFree } from '../lib/planLimits';
import type { GameType } from '../lib/types';

const SampleGame = lazy(() => import('./LessonNativeGamePreview'));

/** Check access before an editable game or paid screen mounts. */
export default function PlanRouteGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { hasFullAccess, isStaff, academy, profile } = useAuth();
  const { notify } = useToast();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const gameType = pathname.match(/^\/games\/([^/]+)/)?.[1] as GameType | undefined;
  const game = gameType && getGameCatalogEntry(gameType);
  const blocked = !hasFullAccess && (isPathBlockedForFree(pathname) || (!!gameType && !game));

  // 관리자가 이 학원에서 닫아 둔 기능(단체수업·숙제)은 들어가지 못한다
  useEffect(() => {
    const key = featureOfPath(pathname);
    if (key && !featureOpen(academy, key)) {
      notify(t('features.closedToast'), 'error');
      navigate(isStaff ? '/dashboard' : '/me', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, academy]);

  useEffect(() => {
    if (blocked) {
      notify(t('plan.upgradeRequiredToast'), 'error');
      navigate(isStaff ? '/settings/billing' : '/games', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, blocked, isStaff]);

  if (blocked) return null;
  if (!hasFullAccess && game && !isFreeTierGame(game.type, profile?.free_game_choices)) {
    return <section key={game.type} className="space-y-3">
      <h2 className="text-xl font-bold">{t(game.nameKey)} · {t('freeGames.sample')}</h2>
      <p>{t('freeGames.sampleHint')}</p>
      <Suspense fallback={<p>{t('common.loading')}</p>}><SampleGame path={game.path} title={t(game.nameKey)} content={null} /></Suspense>
    </section>;
  }
  return children;
}
