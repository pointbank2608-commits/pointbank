# 게임 자료 선택·설정 통일 확인 — 2026-11-20

## 적용 범위

현재 게임 카탈로그의 단어·문장 게임과 문법 탐정, 총 49종에 적용했다. 다른 문법 게임, 별도 파닉스 게임, 말하기·롤플레이와 수업도구는 제외했다. 말하기가 주 분류인 `lastbox`, `shufflefind`와 도구인 `wheel`도 제외한다.

대상: balloonpop, wordtrain, wordfishing, sentencerocket, grammardetective, treasurehunt, wordclaw, feedmonster, sentencebridge, sentencetower, telepathy, sentencesplash, bomb, tictactoe, saveorgive, findmissing, baskin31, connect4, popcorn, passball, quiz, hangman, truefalse, matchup, wordhoops, tugofwar, whackamole, flashcards, anagram, groupsort, unscramble, typeanswer, spellword, rankorder, wordsearch, crossword, mazechase, airplane, labeleddiagram, imagequiz, gameshowquiz, winlosequiz, watermelon, quizshow, treasuredig, fourclues, catchsentence, lightning, mysterybox.

## 구현

- 공통 도구줄은 `내 단어/문장 → 반 설정 → 게임설정 → 저장/불러오기` 순서다.
- 자료 목록 전체를 표시하고 실제 변환·검증 결과로 사용 가능/불가를 정한다. 불가 항목은 HTML `disabled`로 마우스·키보드 선택을 차단한다. 선택된 자료는 체크한다.
- 저장 자료 선택은 상단 메뉴 한 곳에서 한다. 직접 입력·추가·수정·삭제는 게임설정 아래의 공통 편집기에서 한다.
- 추가·수정은 취소/확인으로 처리한다. 확인은 편집 목록에 반영하고, 적용은 기존 변환기를 거쳐 실제 게임 데이터에 반영한다. 원본 단어장·문장 모음의 수정 API는 호출하지 않는다.
- 기존 옵션을 보존하며, 문장 블록 경계, 문법 오류 범위·설명, 지도 정답 지점, 온라인 문제 유형과 부가 정보를 유지한다. 이전 저장 게임에서 이미 직접 고친 문제는 원본 자료 스냅샷으로 덮지 않는다.
- 단어 낚시의 그림 모드는 선택한 자료의 그림을 사용한다. 편집 후 실제 그림 출제 가능 수를 다시 계산한다.
- 단어 뽑기는 분류 미션·정답 태그를 사용하지 않는다. 선택한 단어장의 단어를 집게로 뽑으며, 이미 뽑은 단어는 다음 판 후보에서 제외한다. 과거 저장 JSON의 미션 필드는 호환을 위해 읽을 수 있으나 게임·검증·설정에서 사용하지 않는다.

## 확인 환경과 결과

사용자 컴퓨터의 앱·마우스를 조작하지 않고 GPT 내장 브라우저의 숨겨진 탭으로 확인했다. 로컬 `scripts/classroom-ux/dev-fixture.mjs`의 합성 교사·반·자료를 사용했으며 운영 학습 센서는 꺼져 있다.

| 확인 | 결과 |
| --- | --- |
| 대상 49종의 `/games/<type>` 진입 | 메뉴 4개 이름·순서, 게임설정의 공통 편집기 표시 확인 |
| 단어 낚시 | 단어장 선택 → 추가/취소 → 추가/확인 → 수정 → 삭제 → 적용 → 6문제 실제 진행 확인. kitten과 새 goat 출제, dog 제외 확인 |
| 문장 기차 | 문장 모음 선택 → 추가/취소 → 추가/확인 → 수정 → 삭제 → 적용 확인. `We play soccer.` 블록 출제 확인 |
| 문법 탐정 | 문장 자료 선택 → 추가/취소 → 추가/확인 → 수정 → 삭제 → 적용 확인. `She like cats.` 수정 문제와 `He play soccer.` 추가 문제 출제, `likes` 정답 및 교사 설명 확인 |
| 문법 탐정 자료 참조 | 문제를 직접 편집한 뒤에도 선택한 자료 이름과 체크 표시 유지 확인 |
| 단어 낚시 그림 모드 | 별도 단어장 선택란 없음. 선택 자료의 그림 6개 → 삭제 후 5개 표시, 실제 `/phonics-images/cat.webp` 그림 출제 확인 |
| 단어 뽑기 | 미션 없는 설정·게임판, 선택한 6개 단어 표시, 집게로 cat 뽑기, 다음 판에서 cat 제외 확인 |
| 기존 옵션 | 단어 낚시 라운드 6개·빠른 속도 저장/불러오기 확인. 퀴즈의 뜻→영어 방향 실제 출제 확인. 문장 로켓의 `I like \| cats.` 구 블록 실제 출제 확인. 보물찾기 지도·정답/오답 지점 편집 입력 확인 |
| 반 설정 | 확인 반의 합성 학생 3명 불러오기, 2팀 적용, 차례 표시 확인 |
| 저장/불러오기 | 편집한 단어 낚시를 합성 저장소에 저장하고 다시 불러온 뒤 편집 목록·속도·문제 수·그림 모드 복원 확인 |
| 원본 자료 | 내 자료에서 원본 cat·dog 등 6단어와 기존 4문장 확인. 별도 데이터 회귀 검사에서 원본 객체 불변과 수정하지 않은 자료 ID 유지 검증 |
| 자동 회귀 | `node scripts/games/check-unified-settings.mjs` 통과: 49종 기본 데이터, 자료 변환, 추가·수정·삭제, 옵션/메타데이터 보존, 문법 정답, 단어 뽑기, 제외 범위, 오래된 스냅샷 방지 |
| 정적 검사·빌드 | TypeScript 검사, 변경 파일 oxlint, 배포용 Vite 빌드 확인. 빌드에는 기존 대용량 청크 경고가 있음 |

증거: `output/game-settings-unification/common-editor.jpg`, `source-picker.jpg`, `browser-checks.json`, `build.log`.

## 확인의 한계

- 운영 계정·운영 DB에 자료나 게임을 생성하는 검사는 하지 않았다. 저장/불러오기는 같은 API 흐름을 합성 응답으로 확인했다.
- 49종 모두의 메뉴·편집기 표시와 기존 데이터 검증을 확인했으나, 각 게임의 모든 옵션 조합과 모든 게임의 전체 라운드를 개별 실습하지는 않았다. 반 설정·저장/불러오기의 공통 경로는 단어 낚시에서 실습했다.
- 온라인 대회 퀴즈의 실제 학생 휴대폰 다중 접속·서버 진행은 확인하지 않았다. 네 가지 문제 유형과 부가 정보 보존은 데이터 회귀 검사로 확인했다.
- 그림 업로드·새 지도 장소 추가 등 이번 변경에서 재사용한 기존 부가 기능의 외부 저장 동작은 별도로 실습하지 않았다.
