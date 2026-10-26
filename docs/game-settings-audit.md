# 전체 게임 설정·저장 점검 (2026-10-27)

대상은 카탈로그 60종의 **설정·저장·다시 열기·모바일 버튼 표시**다. 각 게임의 모든 문제/그림/점수 규칙을 전수 플레이한 결과는 아니다. 합성 사용자/API로 확인했고 운영 자료는 생성·수정하지 않았다.

## 결과

- 공통 흐름 59종: 새 게임 저장, 같은 ID 갱신(중복 생성 없음), PC/390px 저장 버튼 표시 통과.
- 전용 흐름 1종(휴대폰 참여 보카 대회): 전용 문제 생성·저장·저장 대회 불러오기 통과.
- 브라우저 런타임 오류 없음. 타입 검사·Vite 빌드 통과.

## 발견해서 수정한 문제

1. 전용 편집기 11종(모험 7종·스토리북 3종·Sentence Splash)의 아직 적용하지 않은 로컬 수정은 공통 저장에 포함되지 않을 수 있었다. 이제 미적용 상태를 공통 준비 화면에 전달해 저장/시작을 막고, 편집 영역의 적용 버튼을 먼저 누르도록 안내한다. 적용 후 수정한 값이 저장되는 것도 확인했다.
2. 모험 7종·스토리북 3종은 플레이 중 설정 창을 열어도 페이지 자체가 편집기를 숨겼다. 공통 설정 창이 표시 여부를 관리하도록 수정해 편집기를 계속 유지한다. 대표 풍선/몬스터 게임에서 플레이 → 설정 → 수정 → 닫기 → 다시 열기 때 수정 내용 유지와 적용 동작을 확인했다.

기존의 하단 고정 저장·성공 안내·실패 시 창 유지/재시도는 그대로 유지했다. 전용 보카 대회는 공통 저장 버튼을 중복 노출하지 않는다.

## 게임별 기록

| 번호 | 게임 ID | 새 저장 | 같은 게임 갱신 | 모바일 | 미적용 수정 보호 검증 |
|---|---|---|---|---|---|
| 54 | balloonpop | 통과 | 통과 | 통과 | 통과 |
| 55 | wordtrain | 통과 | 통과 | 통과 | 통과 |
| 56 | wordfishing | 통과 | 통과 | 통과 | 통과 |
| 57 | sentencerocket | 통과 | 통과 | 통과 | 통과 |
| 58 | grammardetective | 통과 | 통과 | 통과 | 통과 |
| 59 | treasurehunt | 통과 | 통과 | 통과 | 통과 |
| 60 | wordclaw | 통과 | 통과 | 통과 | 통과 |
| 51 | feedmonster | 통과 | 통과 | 통과 | 통과 |
| 52 | sentencebridge | 통과 | 통과 | 통과 | 통과 |
| 53 | sentencetower | 통과 | 통과 | 통과 | 통과 |
| 50 | telepathy | 통과 | 통과 | 통과 | 해당 없음 |
| 49 | shufflefind | 통과 | 통과 | 통과 | 해당 없음 |
| 48 | sentencesplash | 통과 | 통과 | 통과 | 통과 |
| 1 | wheel | 통과 | 통과 | 통과 | 해당 없음 |
| 2 | ladder | 통과 | 통과 | 통과 | 해당 없음 |
| 3 | order | 통과 | 통과 | 통과 | 해당 없음 |
| 4 | bomb | 통과 | 통과 | 통과 | 해당 없음 |
| 5 | timer | 통과 | 통과 | 통과 | 해당 없음 |
| 6 | tictactoe | 통과 | 통과 | 통과 | 해당 없음 |
| 7 | saveorgive | 통과 | 통과 | 통과 | 해당 없음 |
| 8 | findmissing | 통과 | 통과 | 통과 | 해당 없음 |
| 9 | baskin31 | 통과 | 통과 | 통과 | 해당 없음 |
| 10 | connect4 | 통과 | 통과 | 통과 | 해당 없음 |
| 11 | popcorn | 통과 | 통과 | 통과 | 해당 없음 |
| 12 | passball | 통과 | 통과 | 통과 | 해당 없음 |
| 13 | twodice | 통과 | 통과 | 통과 | 해당 없음 |
| 14 | quiz | 통과 | 통과 | 통과 | 해당 없음 |
| 15 | hangman | 통과 | 통과 | 통과 | 해당 없음 |
| 16 | truefalse | 통과 | 통과 | 통과 | 해당 없음 |
| 17 | matchup | 통과 | 통과 | 통과 | 해당 없음 |
| 18 | whackamole | 통과 | 통과 | 통과 | 해당 없음 |
| 19 | flashcards | 통과 | 통과 | 통과 | 해당 없음 |
| 20 | anagram | 통과 | 통과 | 통과 | 해당 없음 |
| 21 | groupsort | 통과 | 통과 | 통과 | 해당 없음 |
| 22 | unscramble | 통과 | 통과 | 통과 | 해당 없음 |
| 23 | typeanswer | 통과 | 통과 | 통과 | 해당 없음 |
| 24 | spellword | 통과 | 통과 | 통과 | 해당 없음 |
| 25 | rankorder | 통과 | 통과 | 통과 | 해당 없음 |
| 26 | wordsearch | 통과 | 통과 | 통과 | 해당 없음 |
| 27 | crossword | 통과 | 통과 | 통과 | 해당 없음 |
| 28 | mathgen | 통과 | 통과 | 통과 | 해당 없음 |
| 29 | mazechase | 통과 | 통과 | 통과 | 해당 없음 |
| 30 | airplane | 통과 | 통과 | 통과 | 해당 없음 |
| 31 | labeleddiagram | 통과 | 통과 | 통과 | 해당 없음 |
| 32 | imagequiz | 통과 | 통과 | 통과 | 해당 없음 |
| 33 | gameshowquiz | 통과 | 통과 | 통과 | 해당 없음 |
| 34 | winlosequiz | 통과 | 통과 | 통과 | 해당 없음 |
| 35 | watermelon | 통과 | 통과 | 통과 | 해당 없음 |
| 37 | shopping | 통과 | 통과 | 통과 | 해당 없음 |
| 38 | treasuredig | 통과 | 통과 | 통과 | 해당 없음 |
| 39 | fourclues | 통과 | 통과 | 통과 | 해당 없음 |
| 40 | catchsentence | 통과 | 통과 | 통과 | 해당 없음 |
| 47 | lightning | 통과 | 통과 | 통과 | 해당 없음 |
| 41 | lastbox | 통과 | 통과 | 통과 | 해당 없음 |
| 42 | mysterybox | 통과 | 통과 | 통과 | 해당 없음 |
| 43 | airport | 통과 | 통과 | 통과 | 해당 없음 |
| 44 | restaurant | 통과 | 통과 | 통과 | 해당 없음 |
| 45 | icecream | 통과 | 통과 | 통과 | 해당 없음 |
| 46 | doctor | 통과 | 통과 | 통과 | 해당 없음 |

휴대폰 참여 보카 대회는 `check-contest-setup.mjs`의 전용 저장/재사용 검증으로 확인했다.

## 파일·재현

- 실행: `node app/scripts/games/check-settings-all.mjs`, `node app/scripts/games/check-contest-setup.mjs`.
- 결과: `output/game-settings-audit/results.json`.
- 화면: 같은 폴더의 대표 게임 `*-mobile.png`.
- 수정: `GameWorkspace.tsx`, `GameWorkspaceContext.tsx`, `useGameTemplates.ts`, `AdventureGamePage.tsx`, `StorybookGamePage.tsx`, `SentenceSplashPage.tsx`, KO/EN 저장 안내.
- 게임 문제·유닛·자산을 재구성하거나 배포하지 않았다. 사용자 요청에 따라 아이스크림·장보기 소리·설정 저장 UI 변경과 함께 선별 커밋·푸시·운영 배포한다.
