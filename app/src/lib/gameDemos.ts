/**
 * 게임 시연 영상(2026-10-17) — `public/demos/<게임 type>.mp4`가 있는 게임. 게임 소개 패널(GameInfoPanel)이 이 목록으로 "▶ 15초 시연"을 보여 준다.
 * 영상은 `app/scripts/demo/record.py`가 실제 게임 화면을 녹화해 만든다(새 게임 = 그 스크립트에 한 항목 + 여기에 한 줄).
 */
const DEMO_GAMES = new Set(['lightning', 'popcorn', 'fourclues', 'catchsentence', 'icecream']);

export function demoForGame(gamePath: string): string | null {
  const type = gamePath.replace(/^\/games\//, '');
  return DEMO_GAMES.has(type) ? `/demos/${type}.mp4` : null;
}
