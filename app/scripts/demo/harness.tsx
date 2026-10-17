/**
 * 시연 영상 녹화용 임시 화면(2026-10-17) — record.py 가 이 파일을 src/_demo.tsx 로 복사해 쓰고 끝나면 지운다.
 * 로그인 없이 실제 게임 컴포넌트(점토 그림·소리·움직임 그대로)를 샘플 단어로 띄우고, 화면 아래에 한글 자막을 얹는다.
 */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './tailwind.css';
import './i18n';
import GameThemeFrame from './components/GameThemeFrame';
import LightningLuck from './components/LightningLuck';
import Popcorn from './components/Popcorn';
import FourClues from './components/FourClues';
import CatchSentence from './components/CatchSentence';
import IceCreamShop from './components/IceCreamShop';
import type { GameItem, GameType } from './lib/types';

const items = (labels: string[]): GameItem[] => labels.map((label, i) => ({ id: String(i), label }));

const game = new URLSearchParams(location.search).get('game') ?? 'lightning';

const INFO = {
  apple: { meaning: '사과', category: '과일', pos: '명사', example: 'I eat an apple every day.' },
  banana: { meaning: '바나나', category: '과일', pos: '명사', example: 'The monkey likes a banana.' },
  dog: { meaning: '강아지', category: '동물', pos: '명사', example: 'My dog is cute.' },
};

function Cap() {
  const [text, setText] = useState('');
  useEffect(() => {
    (window as unknown as { __cap: (t: string) => void }).__cap = setText;
  }, []);
  if (!text) return null;
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 14, display: 'flex', justifyContent: 'center', zIndex: 99999, pointerEvents: 'none' }}>
      <div style={{ background: 'rgba(15,23,42,.88)', color: '#fff', padding: '10px 22px', borderRadius: 999, fontSize: 22, fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>{text}</div>
    </div>
  );
}

function Game() {
  const frame = (type: GameType, child: React.ReactNode) => (
    <GameThemeFrame gameType={type} roster={[]} className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6">
      {child}
    </GameThemeFrame>
  );
  switch (game) {
    case 'lightning':
      return frame('lightning', <LightningLuck items={items(['It is raining. | 비가 와요.', 'I hear thunder. | 천둥소리가 들려요.', 'Take an umbrella. | 우산을 챙겨요.'])} players={6} minSec={4} maxSec={5} />);
    case 'popcorn':
      return frame('popcorn', <Popcorn items={items(['apple', 'banana', 'dog', 'cat', 'bird', 'book'])} />);
    case 'fourclues':
      return frame('fourclues', <FourClues items={items(['apple', 'banana', 'dog'])} teams={3} info={INFO} />);
    case 'catchsentence':
      return frame('catchsentence', <CatchSentence items={items(['I like to read books.', 'She is playing the piano.'])} teams={3} level={1} seconds={2} />);
    case 'icecream':
      return frame('icecream', <IceCreamShop showKo={true} menu="basic" currency="$" />);
    default:
      return <div>unknown game</div>;
  }
}

createRoot(document.getElementById('root')!).render(
  <div style={{ padding: '12px 12px 84px' }}>
    <Game />
    <Cap />
  </div>,
);
