import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { markBoardReturn, type BoardMaterial } from '../../lib/boardMaterial';
import { isFreeTierGame } from '../../lib/gameCatalog';
import { guideCatalogue } from '../../lib/gameGuide';
import AccessibleDialog from '../AccessibleDialog';

/** 칠판에서 게임 불러오기: 오늘 자료에 맞는 게임만 보여 주고, 누르면 그 자료로 바로 시작한다(게임 만들기 안내와 같은 길). */
export default function BoardGameDialog({ material, onClose }: { material: BoardMaterial; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, academy, hasFullAccess } = useAuth();
  const games = guideCatalogue(material.kind);

  function launch(path: string) {
    markBoardReturn();
    navigate(path, { state: { guideLaunch: { kind: material.kind, cards: material.cards, ownerId: session?.user.id, academyId: academy?.id } } });
  }

  const btn = 'min-h-11 rounded-xl border border-outline-variant bg-white px-4 py-2 text-base font-bold text-deep-navy focus-visible:outline-4 focus-visible:outline-primary';
  return (
    <AccessibleDialog label={t('whiteboard.gameTitle')} onClose={onClose}>
      <div className="max-h-[88dvh] space-y-4 overflow-y-auto p-5 sm:p-7" data-board-games>
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-deep-navy">{t('whiteboard.gameTitle')}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t('whiteboard.gameCount', { n: material.cards.length })}</p>
          </div>
          <button type="button" className={btn} onClick={onClose}>
            {t('whiteboard.close')}
          </button>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => {
            const locked = !hasFullAccess && !isFreeTierGame(g.type);
            return (
              <button key={g.type} type="button" disabled={locked} data-game={g.type} className={`${btn} text-left disabled:opacity-40`} onClick={() => launch(g.path)}>
                {g.cover && <img className="mb-2 h-24 w-full rounded-lg object-cover" src={g.cover} alt="" loading="lazy" />}
                <span className="block text-lg">{t(g.nameKey)}</span>
                <span className="block text-sm font-normal text-on-surface-variant">{t(g.descKey)}</span>
                {locked && <span className="mt-1 block text-sm text-error">{t('whiteboard.gameLocked')}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </AccessibleDialog>
  );
}
