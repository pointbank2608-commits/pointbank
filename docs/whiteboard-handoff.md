# 전자칠판 (2026-10-24)

즉흥 수업용 화면. 종이 교재로 수업하면서 칠판에 펜으로 쓰고, 그 자리에서 오늘 자료로 플래시카드·예문 읽기·간단 퀴즈·게임·활동지 인쇄를 불러온다. 도구를 끝내면 판서가 남아 있는 칠판으로 돌아온다.

## 진입
- 경로 `/whiteboard` (선생님 전용, `App.tsx`).
- 사이드바 "내 수업" 묶음의 "전자칠판"(`lib/navGroups.ts`), 오늘 화면(`DashboardPage`)의 전자칠판 시작 카드.
- 종료 단추는 `/dashboard` 로 이동.

## 구성
| 파일 | 역할 |
|---|---|
| `pages/WhiteboardPage.tsx` | 전체 화면 칠판, 위쪽 도구 막대, 배경 4종(흰색·초록 칠판·검정·모눈), 전체화면, 도구 오버레이 |
| `lib/boardMaterial.ts` | 순수 로직: 붙여넣은 글 읽기(`parseBoardText`), 낱말/문장 판별(`detectKind`), 합치기, 저장, 돌아오기 표시, 퀴즈 생성(`buildBoardQuiz`) |
| `components/board/BoardMaterialDialog.tsx` | 오늘 자료 입력 (붙여넣기·내 단어장·문장 목록·문장 은행·샘플) |
| `components/board/BoardSentenceReader.tsx` | 예문 읽기 (한 장에 하나, 듣기·뜻 보기, ← → Space Esc) |
| `components/board/BoardQuiz.tsx` | 간단 퀴즈 (뜻 고르기 4지선다, 점수 문구) |
| `components/board/BoardGameDialog.tsx` | 게임 고르기 → 기존 게임 안내 흐름(`guideLaunch`)으로 이동 |
| `components/board/BoardReturnPill.tsx` | 게임·활동지로 나갔을 때 구석에 뜨는 "칠판으로 돌아가기" (`AppLayout`에 마운트) |
| `components/LessonAnnotationLayer.tsx` | 기존 판서 층 재사용. `persistent`·`persistKey` 추가 (닫기 버튼·Esc 비활성, sessionStorage 보존) |
| `i18n/boardLocales.ts` | 문구 (`whiteboard.*`, ko/en) |

## 저장 방식 (이 탭의 sessionStorage 만)
`classbank.board.material.v1`(오늘 자료) · `.strokes.v1`(판서) · `.theme.v1`(배경) · `.return.v1`(돌아오기 표시). 서버 저장·SQL 없음. 탭을 닫으면 사라진다.

## 동작 규칙
- 자료는 한 번만 넣으면 모든 도구가 쓴다. 자료 없이 도구를 누르면 입력 창이 먼저 뜨고 입력 후 그 도구가 열린다.
- 게임은 기존 게임 안내 상태 `state.guideLaunch {kind, cards, ownerId, academyId}` 로 연다. 체험이 끝난 무료 플랜은 `isFreeTierGame` 규칙대로 잠긴다.
- 활동지 인쇄는 `MaterialsLaunchButtons` 재사용(`state.materialsWords`). 자료실이 체험 종료 무료 플랜에서 막혀 있으므로 그 경우 단추 비활성.
- 판서는 도구 사이를 오가도 유지된다.

## 확인
```bash
node app/scripts/games/check-whiteboard.mjs   # 로직 + 브라우저 11개 (임시 harness: app/scripts/games/board.html·board.tsx)
```
`tsc`·`npm run build` 통과. 1440/1024 폭 실화면 모의 확인.

## 추가 기능 (2026-10-25)
- 문법 불러오기(`BoardGrammar`, 학교급 탭·검색 → `GrammarBoard`), 영어 4선 노트 배경(칸 크기 S~XL), 타이머(`BoardTimer`, 칠판 위에 떠 있고 도구를 열어도 유지), 포인트 주기(`LessonPointsPanel` 재사용 + 반 고르기, 통장 `givePoints` 그대로), 펜 색 12가지·직접 고르기, 지우개 원 모양·크기 조절(단추·슬라이더·휠·두 손가락) — 지우개·색은 `LessonAnnotationLayer` 공용이라 수업 중 판서에도 적용.

## 한계 / 다음
- 실제 전자칠판·터치 하드웨어에서는 아직 확인하지 않았다 (펜은 마우스/포인터 이벤트 기준).
- `check-quick-activity.mjs`·`check-launch-flow.mjs` 는 칠판 변경 전(스태시한 기준 상태)에도 같은 방식으로 실패한다 — 칠판 때문이 아님. 게임 시작 화면 쪽 진행 중 작업 확인 필요.
- 다음 후보: 퀴즈 종류 늘리기(철자·듣고 고르기), 점수판, 폰 리모컨 연결, 판서 이미지로 저장/알림장 첨부.
