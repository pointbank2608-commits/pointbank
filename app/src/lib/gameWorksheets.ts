/**
 * 게임 → 워크시트 연결(2026-10-16) — 게임 설정 화면의 "워크시트 인쇄" 버튼이 쓴다.
 * 게임에 워크시트(자료실 페이지)를 새로 만들면 여기에도 한 줄 더할 것.
 */
const GAME_WORKSHEETS: Record<string, string> = {
  '/games/airport': '/materials/airport',
  '/games/restaurant': '/materials/restaurant',
  '/games/icecream': '/materials/icecream',
  '/games/doctor': '/materials/doctor',
  '/games/lightning': '/materials/lightning',
  '/games/mysterybox': '/materials/mystery-box',
};

export function worksheetPathForGame(gamePath: string): string | null {
  return GAME_WORKSHEETS[gamePath] ?? null;
}
