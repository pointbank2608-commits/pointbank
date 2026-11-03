# 문법별 게임 (2026-11-03, 1차 5종 + 2차 5종)

문법 항목 하나(`config.grammarId`)로 문제를 **규칙으로** 만든다. 게임 템플릿에는 문법 id 만 저장하고 `items` 에는 문법 이름 한 줄만 둔다.
재료: 문법 데이터(예문·틀리기 쉬운 것) + 워크북 A·B 자료(오류 고치기·조건 영작) + 문장 공장(`lib/sentenceFactory.ts`). AI 가 새 문제를 쓰지 않는다.

| 번호 | 게임 | 하는 일 | 만들 수 있는 문법(169개 중) |
|---|---|---|---|
| 61 | 문장 변신 연구소 `grammarlab` | 원문을 과거·부정·의문·주어 바꾸기로 바꿔 낱말 카드(함정 낱말 2개)로 조립 | 134 |
| 62 | 주어·동사 짝꿍 `grammarverb` | 주어가 He/They 로 바뀌면 동사 고르기 | 50 |
| 63 | 문법 경매 `grammarauction` | 팀 코인(게임용, 통장 포인트와 무관)으로 맞는 문장 사기, 틀린 문장을 사면 손해, 고쳐 말하면 절반 회복 | 169 |
| 64 | 조건 영작 대결 `grammarwrite` | 우리말+조건으로 종이에 쓰고 모범 답과 비교, 교사가 팀에 점수 | 169 |
| (기존) | 문법 탐정 `grammardetective` | 편집기에 "문법 항목에서 사건 가져오기" — pitfalls·워크북 오류 고치기로 사건집 | 158 |

- 코드: `lib/grammarGames.ts`(문제 생성·시드 섞기), `components/GrammarGames.tsx`(4종 화면, 1~4팀 놀이 점수·폰 리모컨 버튼·효과음), `pages/GrammarGamePage.tsx`(문법 고르기·저장·반 선택), `components/adventure/GrammarCasePicker.tsx`.
- 문법을 만들 수 없는 경우(문제 수가 `MIN_ROUNDS` 미만)에는 편집기 목록에서 빠지고, 직접 열면 안내 문구가 나온다.
- 확인: `node app/scripts/grammar/check-grammar-games.mjs`(문제 생성 전수), `node --experimental-websocket app/scripts/grammar/check-grammar-games-browser.mjs`(실제 Chrome 7개, 임시 하네스 `gharness.html` 가 필요 — 검증 때만 만들고 지운다).
- 아직: 수업 30분 흐름의 게임 자리에 문법 종류별 자동 배정, 문법 종류 → 어울리는 게임 추천 표, 질문 제작소·전치사 방 꾸미기, 2·3차 묶음.

## 2차 묶음 (2026-11-03)
| 번호 | 게임 | 하는 일 | 문제 출처 | 만들 수 있는 문법 |
|---|---|---|---|---|
| 65 | 문장 속 품사 탐험 `grammarpos` | 문장에서 동사·대명사·전치사·관사/소유격·접속사를 눌러 찾기 | 예문 + 닫힌 낱말 목록(대명사·관사·전치사·접속사) + 알려진 동사. 명사로도 쓰이는 원형 동사(play 등)는 확신이 없어 제외 | 168 |
| 66 | 문장 뼈대 조립소 `grammarframe` | 조각을 주어/동사/나머지 칸에 놓기 | 문장 공장 파서(`splitSimple`) | 127 |
| 67 | 비교급 챔피언 `grammarcompare` | 막대로 크기·속도·무게를 비교해 -er/-est 고르기 | 손으로 쓴 12개 형용사 표(`grammarGameData.ts`) | comparative·superlative 등 6 |
| 68 | 이유·결과 연결 다리 `grammarlink` | and/but/because/so 고르기, because=이유·so=결과 설명 | 손으로 쓴 16쌍 | and-but·because·so 등 6 |
| 69 | 습관 캘린더 `grammarhabit` | 일주일 ✓ 수를 보고 always/usually/sometimes/never 고르기 + 어순 | 손으로 쓴 활동·주어 표 | frequency·tense-present 2 |

- 코드: `lib/grammarGamesB.ts`(문제 생성·`grammarGameSupport`·`MIN_ROUNDS`), `lib/grammarGameData.ts`(손으로 쓴 자료), `components/GrammarGamesB.tsx`. 페이지는 `GrammarGamePage` 가 종류에 따라 A/B 화면을 고른다.
- 습관 캘린더는 always=7·usually=5~6·sometimes=1~2·never=0 의 **뚜렷한 구간만** 쓴다(경계가 모호한 횟수는 출제하지 않음). 달력 ✓ 가 정답의 근거이므로 "often 은 4번" 같은 규칙을 가르치지 않는다.
- 비교급·연결 다리·습관은 해당 문법에서만 열린다(다른 문법에서는 목록에서 빠진다).
- 확인: `check-grammar-games.mjs`(문제 생성 전수), `check-grammar-games-browser.mjs`(13개, 임시 하네스 `app/gharness.html` + `src/gharness.tsx` 필요 — 검증 때만 만들고 지운다).
