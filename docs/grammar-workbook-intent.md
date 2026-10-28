# 문법 워크북 — 의도별 시트·A/B 세트 (2026-10-28)

`/materials/grammar-workbook`(활동지 > "문법 워크북 · 개념부터 도전까지")는 문법 169개 전부에 **같은 문법을 서로 다른 문장으로 두 번 연습하는 A·B 세트**를 만든다. 선생님은 주제를 고르고 시트(의도)·세트·도움 수준을 골라 인쇄한다.

## 의도(시트) — 프레임워크 SEE → CHOOSE → BUILD → SAY → CREATE와 맞춤

| 시트 | 학생이 하는 일 | 세트당 분량 | 쪽 |
|---|---|---|---|
| 규칙 발견 | 예문(굵은 부분)을 보고 규칙을 스스로 찾아 쓴다 | 예문 6 + 질문 | 1 |
| 고르기 | 알맞은 것 고르기(도전 단계는 이유까지) | 10문항 | 1 |
| 빈칸·배열 | 빈칸 채우기, 낱말 순서 맞추기 | 각 8문항 | 2 |
| 고쳐 쓰기 | 틀린 문장의 틀린 한 곳 고치기 | 6문항 | 1 |
| 말하기 미션 | 짝과 말하는 문장 틀 6개 + 미션 | 6 + 미션 | 1 |
| 총정리 | 조건 영작 6 + 같은 단원 섞어 풀기 2 + 체크리스트 | 6 + 2 | 1 |

- 세트 하나 = 학생용 7쪽 + 교사용 정답·풀이 1쪽. A+B = 학생용 14쪽 + 정답 2쪽.
- 도움 수준 3단계: ★ 규칙 상자·힌트 / ★★ 기본 / ★★★ 힌트 없이 "Why?"·"Because" 줄.
- 고르기 보기 순서는 문항마다 고정된 방식으로 섞는다(`shuffleChoices` — 정답이 늘 첫 번째가 되지 않게).
- 로봇 탐정 미션(`third-s`)은 기존 `GrammarMissionSheet`를 그대로 붙이는 선택 항목이다.

## 자료 구조

- 문법 데이터 `src/data/grammarPoints.json`의 예문·틀리기 쉬운 것은 **세트 A**의 재료다(복사하지 않는다).
- 시트 자료 `src/data/grammarSheets/bank/e*.json`(주제당 1건, 타입 `types.ts`):
  - 최상위 = 세트 A의 추가분(`choose` 10, `buildExtra` 4, `correct` 6 이상, `say` 6, `review` 6, `mission`, `discover`).
  - `b` = 세트 B 전체(`discover`, `choose` 10, `build` 8, `correct` 6, `say` 6, `mission`, `review` 6).
  - `dropPitfalls` = 문법 데이터의 틀리기 쉬운 문장 중 "문맥에 따라 맞는 문장이 될 수 있어" 시트에서 뺄 것.
- 빈칸·배열·규칙 발견은 `build` 문장(바뀌는 부분을 `**굵게**`)에서 코드가 만든다(`lib/grammarSheets.ts`).
- 화면: `pages/GrammarSheetsPage.tsx`, 시트 컴포넌트 `components/worksheets/GrammarIntentSheets.tsx`, 문구 `i18n/grammarSheetsLocales.ts`.

## 만들고 검증하는 법(`app/scripts/grammar-sheets/`)

1. `gen-v2.mjs [id,…]` — 주제마다 Gemini 로 A 추가분 + B 세트를 만들고 정적 검사를 통과할 때까지 3번까지 다시 만든다.
2. `check-bank.mjs --complete` — 구조·형식·중복·정답 번호·낱말 수·A/B 같은 문장 검사. 169개 모두 A·B가 있어야 통과.
3. `loop-v2.mjs` — **독립 검수 → 항목 단위 자동 수정 → 다시 검수**(최대 3회). 검수 기준: 보기 중 정답이 정말 하나인지(문장 안에 단서가 있는지), 틀린 문장이 모든 읽기에서 틀리고 틀린 곳이 한 군데인지, 영어·한국어가 자연스럽고 수준에 맞는지. 문법 데이터의 틀리기 쉬운 문장이 문제로 지적되면 `dropPitfalls`에 넣는다. 남은 지적은 `out/loop-remaining.json`.
4. `check-layout.mjs` — 169주제 × A/B × 도움 수준(1·3) 전부 한 쪽 내용 높이 273mm 이내·시트 8장(학생 7 + 교사 1)인지 Playwright 로 잰다. `IDS=a,b` 로 일부만, `shot.mjs`로 그림 저장, `measure.mjs`로 블록 높이 측정.

## 작성 규칙(검수에서 배운 것)

- 보기 둘이 모두 맞을 수 있는 문항 금지: flat adverb(slow/slowly), 영미 차이, 관사·수량의 다른 뜻("I like apple"의 맛), 둘 다 가능한 시제.
- "틀린 문장"은 다른 뜻으로는 맞는 문장이면 안 된다("I was boring", "He hurt him", "You don't have to run").
- 가르치지 않은 문법(전치사, 날짜 on, There is 등)을 그 주제 문항에 섞지 않는다.
- 틀린 곳은 한 군데(두 군데 차이는 고르기로).

## 아직 / 한계

- 영어 정답은 AI 독립 검수 + 정적 검사까지 했다. **교사의 눈으로 전수 검수한 것은 아니다.** 선생님 피드백으로 계속 다듬는다.
- 세트 A의 규칙 발견·미션 일부는 초기에 만든 문항이다(B는 새로 씀).
- 말하기 미션은 활동 지시일 뿐 AI 채점이 없다.
