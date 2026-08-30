import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './StitchGameCenter.css';

type Category = '전체' | '간단게임' | '어휘 퀴즈' | '문법 매치' | '파닉스 펀';

const CHIPS: { id: Category; label: string }[] = [
  { id: '전체', label: '전체 보기' },
  { id: '간단게임', label: '간단게임' },
  { id: '어휘 퀴즈', label: '어휘 퀴즈' },
  { id: '문법 매치', label: '문법 매치' },
  { id: '파닉스 펀', label: '파닉스 펀' },
];

type Game = {
  id: string;
  featured?: boolean;
  category: Exclude<Category, '전체'>;
  title: string;
  desc: string;
  mediaClass: string;
  image?: string;
  emoji?: string;
  alt: string;
  path?: string;
};

const GAMES: Game[] = [
  {
    id: 'word-race',
    featured: true,
    category: '어휘 퀴즈',
    title: '단어 마스터 레이스',
    desc: '단어를 맞추고 결승선까지 달려보세요! 빠르고 정확할수록 높은 점수를 얻습니다.',
    mediaClass: 'sgc-media-vocab',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuArxBzhuLWT-pVdlXmgIgZApj--SgfY39C8NpdUw2hNbsjPvcGsWXlODNVyH798_9hlLjFFQHz3agI7gX-bfDxf4VQmiUds1NFeaO-EI-JdE-vwuGzBRIOhTvWk734kWLJ7YklcRKKvqCsBth9d8QurBM-h0AmVs_TkRna-nNKeztvgf_p1LVJ_T3BqL5Y-Z2_CAgIuok3RqSPiI5W5e2RAwMQdvqQLL-NdV1wcyAHyVqbpq1jsBwuNgQ',
    alt: '하늘에 떠 있는 영문 알파벳과 단어 퍼즐 블록',
  },
  {
    id: 'grammar-blocks',
    category: '문법 매치',
    title: '문법 퍼즐 블록',
    desc: '문장 구조를 재미있는 블록 쌓기로 배워봐요.',
    mediaClass: 'sgc-media-grammar',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDiCH2rV0R0MFKZtwXbWuwK4LU-p8ebCbHTUYMwr5d2ccneeWOQ0cJOHPRfxeH258k7gL0Cjx-ov6SbuYFwgYGdKP50jp9KBeQiQLJ0-1E9Bs5UzqU-44L1VC6b9L3pidCd5aoy-AHAUcjQiHivKHUgwygFjUpnGPYgKMG6hQcUvyUeBePeqA1MxOz49pV0aH8knIKMo6g8NAqLf49hlc935ab-wZb6O4GsejFfZ_DmFeTcaLf-7mDnXg',
    alt: '문법 규칙을 블록으로 맞추는 책 캐릭터',
  },
  {
    id: 'sound-explorers',
    category: '파닉스 펀',
    title: '소리 탐험대',
    desc: '정확한 발음을 듣고 알맞은 글자를 찾아보세요.',
    mediaClass: 'sgc-media-phonics',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDQOt0usyEy0HkuY3LkN8QP_LQuzXYSNKDJeP9VH3sJGRZ14cgezqIHTRXee8SJ2LHqW1kK9s8vNACMkb_I-maxsjODYOSOBbuB4m0ofL5TLAgDNddcwmIHcZY4WrbucwQkcHizor2EoetigB6YQkNNU-6AH9O7pJwOLsKgCQNnnBcwoblR2UoA2iQ05shbcCBHGiM3GzJJYm_9uYeuSSduGOPmVWR3aU9GPTz2cXq0PZqZZBk39lkNZw',
    alt: '음표와 알파벳 캐릭터가 함께 노래하는 장면',
  },
  {
    id: 'word-forest',
    category: '어휘 퀴즈',
    title: '단어 숲 탐험',
    desc: '숨겨진 단어들을 찾아 숲을 탈출하세요.',
    mediaClass: 'sgc-media-forest',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDDRza7p271KvyN0f6iwKYUpj7fV5kmXSpdHKzzsuOe2VVIyMq0DVYIgDaLyFLo0W5F0Gn7ERrIp5NZQkVDNSWSESTLSMDi5KyUVrS-00_Sz4Y3s1wN1xfIt4UT8Icf8HPh7920V8pQqy2wSXX7cb6atiNAG_cjfVPLtYS3mqnO92k3IFMpmqVRzxR8BdlTgJbj-XAzRN9n3A0gaLPJMkRwSkMW8xyO4obVlniAbNYUVgh7oQZ_yN1VDQ',
    alt: '단어가 자라는 마법의 숲',
  },
  {
    id: 'wheel',
    category: '간단게임',
    title: '돌림판',
    desc: '항목을 등록해 두고 돌려서 하나를 무작위로 뽑아요.',
    mediaClass: 'sgc-media-wheel',
    image: '/covers/game-wheel.jpg',
    alt: '교실에서 돌아가는 알록달록한 돌림판',
    path: '/games/wheel',
  },
  {
    id: 'ladder',
    category: '간단게임',
    title: '사다리타기',
    desc: '참가자와 결과를 등록하고 사다리를 타서 짝을 지어요.',
    mediaClass: 'sgc-media-ladder',
    image: '/covers/game-ladder.jpg',
    alt: '이름표와 선물이 있는 사다리타기 판',
    path: '/games/ladder',
  },
  {
    id: 'order',
    category: '간단게임',
    title: '랜덤 공 뽑기',
    desc: '이름을 등록해 두고 무작위 순서를 뽑아요.',
    mediaClass: 'sgc-media-order',
    image: '/covers/game-balls.jpg',
    alt: '색깔 공이 가득한 뽑기 기계',
    path: '/games/order',
  },
  {
    id: 'bomb',
    category: '간단게임',
    title: '시한폭탄',
    desc: '무작위 시각에 터지는 폭탄을 서로 돌려요.',
    mediaClass: 'sgc-media-bomb',
    image: '/covers/game-bomb.jpg',
    alt: '시계 얼굴의 폭탄을 돌리는 아이들',
    path: '/games/bomb',
  },
  {
    id: 'timer',
    category: '간단게임',
    title: '타이머 맞추기',
    desc: '목표 시간에 맞춰 시작·멈춤 버튼을 눌러요.',
    mediaClass: 'sgc-media-timer',
    image: '/covers/game-timer.jpg',
    alt: '초시계 캐릭터들이 교실에서 경주하는 장면',
    path: '/games/timer',
  },
];

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export default function StitchGameCenter() {
  const [chip, setChip] = useState<Category>('전체');

  const games = useMemo(
    () => (chip === '전체' ? GAMES : GAMES.filter((g) => g.category === chip)),
    [chip],
  );

  return (
    <section className="sgc" aria-label="게임 센터">
      <div className="sgc-blob sgc-blob-a" />
      <div className="sgc-blob sgc-blob-b" />

      <div className="sgc-inner">
        <header className="sgc-head">
          <h2 className="sgc-title">게임 센터</h2>
          <p className="sgc-sub">재미있고 인터랙티브한 게임으로 영어를 마스터하세요!</p>
        </header>

        <div className="sgc-chips" role="tablist" aria-label="게임 분류">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={chip === c.id}
              className={`sgc-chip${chip === c.id ? ' is-on' : ''}`}
              onClick={() => setChip(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="sgc-grid">
          {games.length === 0 ? (
            <p className="sgc-empty">이 분류의 게임이 아직 없어요.</p>
          ) : (
            games.map((game) => {
              const featured = Boolean(game.featured && chip === '전체');
              const className = `sgc-card${featured ? ' is-featured' : ''}`;
              const inner = (
                <>
                  <div className={`sgc-card-media ${game.mediaClass}`}>
                    {featured && <div className="sgc-card-accent" />}
                    {game.image ? (
                      <img src={game.image} alt={game.alt} />
                    ) : (
                      <span className="sgc-card-emoji" aria-hidden>
                        {game.emoji}
                      </span>
                    )}
                    {featured && (
                      <span className="sgc-hot">
                        <StarIcon />
                        인기 게임
                      </span>
                    )}
                  </div>
                  <div className="sgc-body">
                    <span className={`sgc-tag${featured ? ' is-accent' : ''}`}>{game.category}</span>
                    <h3 className="sgc-card-title">{game.title}</h3>
                    <p className="sgc-card-desc">{game.desc}</p>
                    {featured && (
                      <span className="sgc-play">
                        <PlayIcon />
                        게임 시작
                      </span>
                    )}
                  </div>
                </>
              );

              return game.path ? (
                <Link key={game.id} to={game.path} className={className} aria-label={game.alt}>
                  {inner}
                </Link>
              ) : (
                <article key={game.id} className={className}>
                  {inner}
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
