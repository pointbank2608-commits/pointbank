import { Link } from 'react-router-dom';

/**
 * 게임 카테고리 목록.
 * 새 미니게임(사다리, 빙고 …)을 추가할 때는 이 배열에 카드 하나만 더하면 된다.
 */
const GAMES = [
  {
    key: 'wheel',
    cover: '/covers/game-wheel.jpg',
    icon: 'target',
    name: '돌림판',
    desc: '항목을 등록해 두고 돌려서 하나를 무작위로 뽑아요.',
    path: '/games/wheel',
  },
  {
    key: 'ladder',
    cover: '/covers/game-ladder.jpg',
    icon: 'alt_route',
    name: '사다리타기',
    desc: '참가자와 결과를 등록하고 사다리를 타서 짝을 지어요.',
    path: '/games/ladder',
  },
  {
    key: 'order',
    cover: '/covers/game-balls.jpg',
    icon: 'sports_baseball',
    name: '랜덤 공 뽑기',
    desc: '이름을 등록해 두고 무작위 순서를 뽑아요.',
    path: '/games/order',
  },
  {
    key: 'bomb',
    cover: '/covers/game-bomb.jpg',
    icon: 'bolt',
    name: '시한폭탄',
    desc: '무작위 시각에 터지는 폭탄을 서로 돌려요.',
    path: '/games/bomb',
  },
  {
    key: 'timer',
    cover: '/covers/game-timer.jpg',
    icon: 'timer',
    name: '타이머 맞추기',
    desc: '목표 시간에 맞춰 시작·멈춤 버튼을 눌러요.',
    path: '/games/timer',
  },
];

export default function GamesPage() {
  return (
    <div className="space-y-6">
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
        게임 센터
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {GAMES.map((g) => (
          <Link
            key={g.key}
            to={g.path}
            className="group bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)] overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all"
          >
            <div className="relative h-36 overflow-hidden">
              <img
                src={g.cover}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
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
