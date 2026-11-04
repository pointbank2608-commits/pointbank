import { createContext, useContext } from 'react';

/**
 * 게임 화면의 "전체화면 여부·항목 숨김" 상태. GameThemeFrame 이 값을 내려 주고 게임·도구줄이 읽는다.
 * 순환 import 를 피하고(개발 서버에서 파일이 부분 갱신될 때 서로 다른 context 를 보는 문제 방지) 이 파일에만 둔다.
 */
export const GamePlayContext = createContext({ fullscreen: false, itemsHidden: false, toggleItems: () => {} });

export function useGamePlay() {
  return useContext(GamePlayContext);
}
