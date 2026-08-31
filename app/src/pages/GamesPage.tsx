import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function GamesPage() {
  const { t } = useTranslation();

  /**
   * 게임 카테고리 목록.
   * 새 미니게임(사다리, 빙고 …)을 추가할 때는 이 배열에 카드 하나만 더하면 된다.
   */
  const games = [
    {
      key: 'wheel',
      cover: '/covers/game-wheel.jpg',
      icon: 'target',
      name: t('gamesList.wheelName'),
      desc: t('gamesList.wheelDesc'),
      path: '/games/wheel',
    },
    {
      key: 'ladder',
      cover: '/covers/game-ladder.jpg',
      icon: 'alt_route',
      name: t('gamesList.ladderName'),
      desc: t('gamesList.ladderDesc'),
      path: '/games/ladder',
    },
    {
      key: 'order',
      cover: '/covers/game-balls.jpg',
      icon: 'sports_baseball',
      name: t('gamesList.orderName'),
      desc: t('gamesList.orderDesc'),
      path: '/games/order',
    },
    {
      key: 'bomb',
      cover: '/covers/game-bomb.jpg',
      icon: 'bolt',
      name: t('gamesList.bombName'),
      desc: t('gamesList.bombDesc'),
      path: '/games/bomb',
    },
    {
      key: 'timer',
      cover: '/covers/game-timer.jpg',
      icon: 'timer',
      name: t('gamesList.timerName'),
      desc: t('gamesList.timerDesc'),
      path: '/games/timer',
    },
    {
      key: 'tictactoe',
      cover: null,
      icon: 'grid_3x3',
      name: t('gamesList.tictactoeName'),
      desc: t('gamesList.tictactoeDesc'),
      path: '/games/tictactoe',
    },
    {
      key: 'saveorgive',
      cover: null,
      icon: 'redeem',
      name: t('gamesList.saveorgiveName'),
      desc: t('gamesList.saveorgiveDesc'),
      path: '/games/saveorgive',
    },
    {
      key: 'findmissing',
      cover: null,
      icon: 'search',
      name: t('gamesList.findmissingName'),
      desc: t('gamesList.findmissingDesc'),
      path: '/games/findmissing',
    },
    {
      key: 'baskin31',
      cover: null,
      icon: 'icecream',
      name: t('gamesList.baskin31Name'),
      desc: t('gamesList.baskin31Desc'),
      path: '/games/baskin31',
    },
    {
      key: 'connect4',
      cover: null,
      icon: 'grid_on',
      name: t('gamesList.connect4Name'),
      desc: t('gamesList.connect4Desc'),
      path: '/games/connect4',
    },
    {
      key: 'popcorn',
      cover: null,
      icon: 'casino',
      name: t('gamesList.popcornName'),
      desc: t('gamesList.popcornDesc'),
      path: '/games/popcorn',
    },
    {
      key: 'passball',
      cover: null,
      icon: 'sports_volleyball',
      name: t('gamesList.passballName'),
      desc: t('gamesList.passballDesc'),
      path: '/games/passball',
    },
    {
      key: 'twodice',
      cover: null,
      icon: 'casino',
      name: t('gamesList.twodiceName'),
      desc: t('gamesList.twodiceDesc'),
      path: '/games/twodice',
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        {t('gamesList.title')}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {games.map((g) => (
          <Link
            key={g.key}
            to={g.path}
            className="group bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all"
          >
            <div className="relative h-36 overflow-hidden">
              {g.cover ? (
                <img
                  src={g.cover}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-container to-secondary-container flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                  <span className="material-symbols-outlined text-6xl text-on-primary-container opacity-80">{g.icon}</span>
                </div>
              )}
              <div className="absolute top-3 left-3 w-10 h-10 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined">{g.icon}</span>
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-title-md text-title-md text-on-surface mb-1">{g.name}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">{g.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
