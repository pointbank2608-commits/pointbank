import { createContext, useContext } from 'react';

/**
 * 게임 페이지를 "내 커리큘럼" 편집 화면 안에 그대로 띄울 때(게임 슬라이드 상세) 쓰는 컨텍스트.
 * 게임 페이지 35종은 모두 useGameTemplates 를 쓰므로, 훅 하나가 이 값을 읽어
 * - 반은 레슨의 반으로 고정하고,
 * - 처음 열 템플릿은 슬라이드에 저장된 templateId 로,
 * - 선생님이 고른 템플릿은 onSelect 로 슬라이드에 되돌려 준다.
 * 게임 목록으로 가기·반 고르기·다른 게임으로 열기처럼 편집 화면을 떠나는 UI 는 .game-embed CSS 로 숨긴다.
 */
export interface GameEmbed {
  classId: string | null;
  templateId?: string;
  onSelect: (templateId: string | null) => void;
}

export const GameEmbedContext = createContext<GameEmbed | null>(null);

export function useGameEmbed(): GameEmbed | null {
  return useContext(GameEmbedContext);
}
