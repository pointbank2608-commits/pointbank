# 시한폭탄 게임 준비: 단어·문장·이름 입력 분리 (2026-10-28)

이전(2026-10-26)에는 `연습할 단어·문장` 칸(`BombPracticeInput`)이 모드와 상관없이 붙어 있어서, 시작 메뉴에서는 문장을 막아 두고도 "단어로 만들기" 화면에서 문장 불러오기가 보였다. 지금은 **선택한 모드가 입력을 정한다.**

| 시작 메뉴 | 입력 | 저장 위치 |
|---|---|---|
| 단어로 만들기 | 단어(내 단어장 불러오기·직접 입력) | `config.words` (읽을 내용) |
| 문장으로 만들기 | 문장(내 문장 모음 불러오기·직접 입력) | `config.words` (읽을 내용) |
| 학생·팀 이름으로 만들기 | 이름 | `items` (참가자) |

- `lib/gameGuide.ts`: 시한폭탄을 `BOTH`에 넣어 문장 모드를 열었다. `isBombReading(type, kind)`가 단어·문장 모드를 가리키고, `guideRows`/`guideContent`가 그때는 `config.words`를 읽고 쓴다. 참가자(`items`)는 그대로 두고, 비어 있으면 기본 이름(`참가자 1~3`, `bombParticipants()`)을 쓴다.
- `lib/gameFromWords.ts`: 시한폭탄은 단어를 참가자 칸이 아니라 `config.words`에 넣는다(내 단어장·수업 슬라이드·게임 전환 경로 공통). `lib/gameWorkspace.ts`의 `SENTENCE_GAMES`에 시한폭탄을 추가했다.
- `components/GameSetupGuide.tsx`: 연습 입력 칸과 `extra`로 `words`를 덮어쓰던 코드를 없앴다. 읽을 내용이 비어 있으면 완료를 막는다. 이름 모드는 `config.words`를 건드리지 않는다. 모드별 안내 문구는 `guide.gameHints.bomb_word|bomb_sentence|bomb_names`.
- `lib/useGameTemplates.ts`: 시한폭탄에서 "이 단어로 다른 게임"을 고를 때 참가자가 아니라 `config.words`를 단어로 쓴다.
- `BombPracticeInput.tsx`와 문구 `guide.bombWords`·`source.bombPracticeHint`는 삭제했다.
- 상세 설정(`BombPage`)의 읽을 단어·문장 목록과 `SentenceSources`는 그대로다.

**이전 방식으로 만든 활동**: 예전에는 "단어로 만들기"가 단어를 참가자 칸에 넣었다. 그런 활동을 다시 고치면 참가자 칸이 기본 이름으로 바뀌고 단어는 읽을 내용으로 옮겨진다(`GameSetupGuide`의 `bombPeople`).

검증: `node app/scripts/games/check-bomb-sentences.mjs`(이름·단어·문장 각 모드의 입력 분리, 원본 미변경, 빈 입력 차단, 게임 시작, 상세 설정, 실패·재시도·빈 목록·영어·모바일), `check-bomb-range.mjs`, `check-prelaunch-ux.mjs`, `check-guide-logic.mjs`, `check-workspace-logic.mjs` 통과. 합성 인증/API로 실행했고 운영 DB에는 쓰지 않는다.
`check-bomb-sound.mjs`·`check-turns.mjs`는 안내 창에 있던 예전 조작(초시계 소리 라디오, 안내 창의 게임 시작 버튼)을 기다리다 실패한다. 이번 변경 이전 화면 개편(2026-10-28, `e5c1ab00`·`ad483466`)에서 이미 어긋난 검사다. `check-game-save-audit.mjs`는 Node 20에 WebSocket이 없어 시작 단계에서 멈춘다.
커밋·운영 배포 전 상태의 구현 기록이다.
