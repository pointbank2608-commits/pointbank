# 문법별 게임 (2026-11-03~04, 1·2·3차 15종)

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

## 3차 묶음 (2026-11-04)
| 번호 | 게임 | 하는 일 | 문제 출처 | 만들 수 있는 문법 |
|---|---|---|---|---|
| 70 | 수동태 카메라 `grammarpassive` | 행동을 당한 것을 주어로 be + 과거분사 고르기, 카메라가 비추는 쪽 이모지 | 손으로 쓴 사건 12개(`grammarGameDataC.ts`), 시제·단복수는 규칙 | m-passive 등 3 |
| 71 | 조건문 선택 모험 `grammarcond` | if 절(현재형)·결과(will + 동사원형) 고르기 | 손으로 쓴 장면 12개 | m-if-conditional·m-conj-when-if-that |
| 72 | 관계사 인물 찾기 `grammarrelative` | who/whose/that/where 단서 문장을 읽고 알맞은 카드 고르기 | 사람 특징 7·사물 10·장소 8 표 | m-relative-subject·whose·object·adverb |
| 73 | 질문으로 친구 찾기 `grammarask` | 팀이 Does/Is/Can 질문을 골라 8명 중 비밀 친구를 좁히고 맞히기(적게 물을수록 점수↑, 최대 5점) | 규칙(특징 5가지 조합이 겹치지 않게 생성 → 5개 질문으로 반드시 한 명만 남음) | does-he·do-you-like·is-it·i-can |
| 74 | 문법 장보기 `grammarshop` | some/any, a/an, many/much, a few/a little 고르기 | 가산·불가산 12품목 표 + 템플릿 | countable-uncountable·how-many·h-quantifiers |

- 코드: `lib/grammarGamesC.ts`(문제 생성·`thirdSupport`), `lib/grammarGameDataC.ts`(손으로 쓴 자료), `components/GrammarGamesC.tsx`. 객관식 4종은 2차의 `Choice` 틀(정답 전에도 결과 자리를 잡아 전체화면 배율이 안 흔들림)을 재사용하고, 질문으로 친구 찾기만 별도 화면이다.
- 수업 게임① 자동 배정(`AFFINITY`)에 5개를 더했다: 수동태 → 카메라, if 조건문 → 조건문 모험, 관계사 → 인물 찾기, 의문문(does-he·is-it·i-can·do-you-like) → 친구 찾기, 수량 표현 → 장보기.
- 자료는 직접 쓴 초안(사실이 분명한 것만)이라 선생님 검수 전이다. 장보기의 some/any 문장은 의문문의 some 같은 예외를 피해 보기를 골랐다.
- 확인: `check-grammar-games.mjs`(문제 생성 전수 + 3차 5개), `check-grammar-games-browser.mjs`(실제 Chrome 21개, 임시 하네스 필요).
