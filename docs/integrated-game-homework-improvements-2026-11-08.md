# 게임 시작·문법 게임·숙제 마무리 확인 개선

## 변경 파일

경로는 저장소 루트 기준이다.

| 범위 | 파일 | 변경 내용 |
| --- | --- | --- |
| 공통 게임 시작 | `app/src/components/GameWorkspace.tsx`, `app/src/tailwind.css` | 준비 화면의 가로 중앙에 큰 파란색 시작 버튼을 표시한다. 버튼 영역을 게임판과 나눠 삽화를 가리지 않고, 시작하면 버튼을 제거한다. |
| 개별 게임 시작 | `app/src/components/CatchSentence.tsx`, `FindMissing.tsx`, `LightningLuck.tsx`, `PassTheBall.tsx`, `SentenceSplash.tsx`, `ShuffleFind.tsx`, `Telepathy.tsx`, `TimeBomb.tsx`, `TugOfWar.tsx`, `WordHoops.tsx` | 공통 버튼에서 각 게임의 기존 시작 동작을 실행한다. 같은 폴더의 파일이다. |
| 사다리·컵 | `app/src/pages/LadderPage.tsx`, `app/src/components/ShuffleFind.tsx` | 사다리의 샘플 참가자 수를 결과 칸 수와 맞췄다. 컵은 준비·이동·선택 중 같은 파란색 클레이 이미지를 쓴다. |
| 문법 탐정 | `app/src/components/adventure/AdventureEditor.tsx`, `app/src/components/adventure/DetectiveCaseEditor.tsx`, `app/src/lib/detectiveSuggestion.ts`, `app/src/lib/gameWorkspace.ts` | 올바른 문장 하나를 입력하거나 저장된 문장 모음을 불러온다. 명확한 오류 한 곳과 정답을 제안한다. 대안, 수동 편집, 고급 설정을 제공하고 자동 생성이 어려우면 수동 편집을 안내한다. |
| 마무리 확인 | `app/src/components/homework/HomeworkRunner.tsx`, `app/src/components/homework/QuestionCard.tsx`, `app/src/lib/homework/guided.ts` | 교사 미리보기와 학생 화면에 기존 스튜디오의 베이지 배경, 흰 카드, 진행률과 차분한 번호 선택지를 적용했다. 듣기, 입력, 배열, 녹음은 유형별 조작을 유지한다. |
| 문장 변신 연구소 | `app/src/lib/grammarLabGoals.ts`, `app/src/lib/grammarGames.ts`, `app/src/i18n/grammarLessonLocales.ts`, `app/src/pages/GrammarGamePage.tsx`, `app/src/components/GameToolbar.tsx` | 검증된 18개 단원의 규칙으로 지시와 정답을 구성한다. `They have a bike.`를 `She has a bike.`로 바꾸는 문제에서는 정답에 쓰는 단어만 배열한다. 지원하지 않는 단원의 저장값은 화면에 표시하고 교사가 다시 선택할 수 있다. |
| 회귀 검사 | `app/scripts/games/check-launch-flow.mjs`, `app/scripts/games/check-shuffle.mjs`, `app/scripts/games/check-shuffle-page.mjs`, `app/scripts/games/check-splash.mjs`, `app/scripts/grammar/check-grammar-games.mjs`, `app/scripts/homework/check-final-studio.mjs`, `app/scripts/homework/final-studio.html`, `app/scripts/homework/final-studio.tsx` | 게임 시작, 컵 이동, 문법 규칙과 편집, 숙제 유형별 교사·학생 화면을 검증한다. |

## 적용 범위와 검증

- 게임센터 교사 화면 `/games` 카탈로그 76종에서 시작 버튼의 크기와 중앙 정렬, 버튼이 하나만 보이는 상태, 클릭 후 게임 진입을 확인했다. 컵 속 친구 찾기는 모바일 전체화면에서도 확인했다.
- 컵 속 친구 찾기 브라우저 검사 10개와 페이지 검사 6개가 통과했다. 컵 3·4·5개의 색상과 섞기, 결과·재시작, 세 화면 너비의 배치, 수업에서 기존 설정으로 열기, 게임센터에서 팀·컵·속도 수정본을 별도로 저장하는 흐름을 확인했다. Sentence Splash는 7라운드 진행, 점수, 키보드, 재시도, 설정 저장과 다시 열기, 수업 재생을 확인했다.
- 문법 탐정의 올바른 문장 입력, 대체 오류 생성, 수동 편집을 브라우저에서 확인했다. 문장 변신 연구소에서는 3인칭 단수 문장의 카드 배열과 득점을 확인했다. 규칙 검사에서는 등록된 169개 단원을 검사하고 지원하는 18개 단원만 문항을 내는지 확인했다.
- 마무리 확인 8종은 그림·뜻으로 단어 고르기, 듣고 단어 고르기, 빠진 알파벳 채우기, 알파벳 배열, 철자 쓰기, 문장 배열, 문장 빈칸 고르기, 혼자 말하기다. 실제 교사·학생 렌더러를 합성 데이터로 실행해 모바일 카드, 진행률, 유형별 조작을 확인했다. 듣기 유형에 목표 단어가 화면에 노출되지 않는지도 확인했다.
- TypeScript 검사, 숙제 생성 검사, PGlite 숙제 검사에서 배정 내용 보존, 재시도, 녹음 소유권 등을 확인했다. 별도 파닉스 경로와 실시간 방, 실제 마이크 녹음·업로드, 운영 데이터 및 모든 기기의 전체화면은 이번 검증 범위에서 제외했다. 구형 문법 전용 브라우저 스크립트는 로컬 실행 환경 제약이 있어 문장 변신 연구소를 실제 앱 경로로 확인했다.

## 호환성

저장된 게임 설정, 문법 탐정 문제, 숙제와 학생 기록의 데이터 구조를 유지했다. 기존 게임의 라운드·팀·점수 동작과 숙제의 채점·녹음 API를 사용한다. 마무리 확인은 기존 `guided-final:` 표식으로 구분한다. 문장 변신 연구소의 새 문항 ID에는 규칙 버전을 넣어 기존 문항과 구별한다. 새 학습 센서와 SQL 마이그레이션은 없다.
