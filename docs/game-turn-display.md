# 게임 차례 표시 통합 (2026-10-21)

## 적용 범위

실제 서비스 카탈로그의 차례가 있는 게임 30종을 두 방식으로 처리한다. 원본 자료/수업/점수 저장 구조는 변경하지 않는다.

| 방식 | 게임 |
| --- | --- |
| 선택적 수동 순서 15종 | wheel, ladder, order, findmissing, passball, quiz, truefalse, flashcards, anagram, groupsort, unscramble, spellword, rankorder, labeleddiagram, imagequiz |
| 시한폭탄 | bomb: 공용 학생/팀 차례와 게임의 넘기기·폭발 결과를 연결 |
| 자체 진행 순서 14종 | tictactoe, connect4, baskin31, twodice, gameshowquiz, winlosequiz, popcorn, saveorgive, fourclues, treasuredig, mysterybox, lastbox, shufflefind, timer |

동시에 답하거나 경쟁하는 catchsentence/telepathy/실시간 대회, 역할극의 대화 순서, 개인 연습 게임에는 임의의 참가자 순서를 새로 강제하지 않는다. 수동 순서 게임은 기존처럼 참여자·팀·순서에서 순서 진행을 선택한다. 자유 참여도 유지한다.

## 동작

- 현재 사람/팀을 큰 카드로, 다음 사람과 순서 번호를 함께 표시한다. 바뀐 이름은 짧게 강조하며 동작 줄이기 설정에서는 애니메이션을 생략한다.
- 기존 작은 상단 차례 줄과 중복 다음 참여자 버튼은 제거했다. 수동 진행은 이름을 포함한 `○○에게 넘기기` 버튼을 사용한다. 한 명만 남으면 넘기기 버튼을 숨긴다.
- `GameTurnContext`/`useNativeGameTurn`은 각 게임이 이미 관리하는 실제 차례를 표시 영역에 전달한다. 자체 팀 게임의 점수·수 두기·건너뛰기 규칙을 별도 차례 엔진으로 대체하지 않는다. 일반적인 강제 넘기기 버튼도 만들지 않는다.
- 보물 땅파기는 기존 쉬는 팀 건너뛰기 계산을 표시와 실제 진행에서 함께 사용하도록 추출했다.
- 시한폭탄은 선택한 학생/팀 순서가 있으면 그 상태만 진행한다. 학습 자료와 참가자를 분리해 학생 이름 대신 `horse 차례`가 표시되던 혼선을 해결한다. 폭발 시 사람 이름을 고정하고, 넘길 때 폭발 타이머를 다시 만들지 않는다. 타이머만 모드에서는 차례 카드를 숨긴다.
- 타이머 맞추기는 참가자별 순위 모드에만 차례를 표시한다. 측정을 멈춘 뒤에만 다음 사람으로 넘어갈 수 있고 마지막 사람은 기존 결과 보기로 끝난다.
- 큰 글자/좁은 화면에서 시한폭탄과 읽을 단어가 잘리지 않도록 폭탄 무대의 화면 맞춤 배율을 조정했다. 다른 게임의 무대 규칙은 유지한다.
- 교사 메뉴의 `/games` 링크 이름을 한국어 `게임메뉴`, 영어 `Game menu`로 바꿨다.

## 주요 파일

- app/src/components/GameTurnDisplay.tsx: 카드와 게임별 표시 제공자
- app/src/context/GameTurnContext.tsx: 실제 게임 차례 보고 훅
- app/src/styles/game-turn.css, app/src/i18n/turnDisplayLocales.ts
- app/src/components/GameThemeFrame.tsx, GameWorkspace.tsx
- app/src/components/TimeBomb.tsx, TimerMatch.tsx 및 자체 순서 게임 컴포넌트 14개(미스터리 박스 기존/버섯 표현 포함)
- app/src/pages/BombPage.tsx, app/src/lib/gamePreparation.ts
- app/scripts/games/check-turns.mjs

## 검증

- `npm --prefix app run build`: TypeScript + Vite 통과. 기존 대형 청크 안내는 남음.
- `npm --prefix app run lint`: 통과. 기존 경고는 남음.
- `git diff --check`: 통과(기존 LF/CRLF 안내 제외).
- `node app/scripts/games/check-turns.mjs`: 전체 성공. 실제 AppLayout/GameWorkspace/게임 페이지를 사용하고 인증/API만 합성 데이터로 대체한다.
- 수동 15종 각각 준비·시작·참가자 설정·다음 사람·다음 표시·마지막 이후 순환·연속 클릭 방지, 명시적 저장 발생 없음.
- 시한폭탄: 동일 학생 순서, 이름을 포함한 넘기기, 연속 클릭 방지, 폭발 타이머가 하나로 유지됨, 폭발 결과가 마지막 보유자와 일치, 메뉴 일시정지/복귀, 타이머만 모드. 폭발 콜백을 검증용으로 호출했으며 실제 무작위 시간 전체를 기다리는 검증은 아니다.
- 자체 순서 14종의 정상 진입/카드/중복 수동 버튼 없음. 틱택토 실제 수 두기 및 팝콘 뽑기 후 카드 갱신. 타이머 이름 입력·측정·정지·다음 참가자.
- 모바일·전체화면 전환에서 한 개의 카드와 차례 유지, 실제 터치 탭, 큰 글자, 영어, 동작 줄이기, 가로 넘침 없음. 큰 글자 시 폭탄 단어 보드가 화면 안에 들어오는지 확인했다.
- `node app/scripts/games/check-guide-sources.mjs`: 기존 단어장/문장·학생 불러오기, 반 전환, 오류/재시도, 소유자 격리, 자료 원본 유지 검증 통과.
- 기존 `check-preparation-play.mjs`도 실행했으나 이전 홈 버튼의 접근성 이름 `게임 고르기 →`를 기대해 시작 부분에서 중단했다. 해당 오래된 검증을 통과했다고 보고하지 않는다. 이 작업의 차례/진행 검증은 새 스크립트로 수행했다.

스크린샷: output/turn-bomb-desktop.png, turn-bomb-mobile.png, turn-bomb-fullscreen.png, turn-bomb-large.png.

## 한계 / 로컬 확인

운영 로그인 계정·실제 DB 저장 권한, 수업 안에 삽입된 게임 및 학생 전용 화면, 실제 휴대폰/Safari는 직접 검증하지 않았다. 모든 자체 게임의 승패 조합·보상 조합 전체를 재실행하지 않았다. 기존 게임 규칙과 데이터는 유지한다. 운영 배포·커밋·푸시는 하지 않았다.

`npm --prefix app run dev` 후 `/games/bomb`에서 준비하고 참여자 이름을 지정해 확인한다. 수동 게임은 참여자·팀·순서에서 순서 진행을 켠다. 저장된 차례를 이어갈 수 있으며 시작 사람을 바꾸려면 `여기서 시작`을 누른다.
