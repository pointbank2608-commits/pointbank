import { useMemo } from 'react';
import { GameEmbedContext } from '../context/GameEmbedContext';
import { GAME_PAGES } from '../lib/gamePages';
import type { GameContent } from '../lib/gameFromWords';

export default function LessonNativeGamePreview({ path, title, content }: { path: string; title: string; content: GameContent | null }) {
  const context = useMemo(() => ({ classId: null, onSelect: () => {}, preview: { title, content } }), [title, content]);
  const GamePage = GAME_PAGES[path];
  return GamePage ? <div className="game-embed activity-native-game" data-native-game-preview={path}>
    <GameEmbedContext.Provider value={context}><GamePage /></GameEmbedContext.Provider>
  </div> : null;
}
