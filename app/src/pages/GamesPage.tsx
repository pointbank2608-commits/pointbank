import { Link } from 'react-router-dom';

/**
 * 게임 카테고리 목록.
 * 새 미니게임(사다리, 빙고 …)을 추가할 때는 이 배열에 카드 하나만 더하면 된다.
 */
const GAMES = [
  {
    key: 'wheel',
    emoji: '🎡',
    name: '돌림판',
    desc: '항목을 등록해 두고 돌려서 하나를 무작위로 뽑아요.',
    path: '/games/wheel',
  },
  {
    key: 'ladder',
    emoji: '🪜',
    name: '사다리타기',
    desc: '참가자와 결과를 등록하고 사다리를 타서 짝을 지어요.',
    path: '/games/ladder',
  },
  {
    key: 'order',
    emoji: '🔀',
    name: '순서정하기',
    desc: '이름을 등록해 두고 무작위 순서를 뽑아요.',
    path: '/games/order',
  },
];

export default function GamesPage() {
  return (
    <>
      <div className="section-title">게임</div>
      <div className="game-grid">
        {GAMES.map((g) => (
          <Link key={g.key} to={g.path} className="game-card">
            <div className="game-card-emoji">{g.emoji}</div>
            <div className="game-card-name">{g.name}</div>
            <div className="game-card-desc">{g.desc}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
