# 영어 워크시트 유형 조사와 ClassBank 확장 후보

조사일: 2026-10-25. 영국·미국·호주·뉴질랜드·홍콩의 교육기관과 국제 영어교육 자료 사이트를 온라인으로 조사하고, 현재 ClassBank 코드를 대조했다. 전 세계의 모든 사이트를 전수 조사한 목록은 아니다. 아래 9개 분야·72개 유형은 여러 출처의 활동을 학습 목적에 따라 다시 묶은 기획 분류이며, 국제적으로 공인된 단일 분류표나 서로 완전히 독립된 72개 기능을 뜻하지 않는다.

목록의 용도·사용 시점·ClassBank 적용 판단은 조사 자료에 기반한 제안이다. 특정 워크시트가 모든 학습자에게 같은 효과를 보장한다는 뜻은 아니다. 수준은 나이보다 실제 읽기·말하기 능력에 맞춰 조정한다.

## 현재 ClassBank에서 확인한 범위

- 일반 인쇄 화면에는 카탈로그 기준 18개 탭이 있다. 낱말표, 카드, 따라 쓰기, 퀴즈, 색칠, 연결, 낱말 찾기, 철자 배열, 빠진 철자, 분류, 오려 붙이기, 문장 배열, 객관식, 참·거짓, 미니북, 짝 인터뷰, 보드게임, 문장-그림 연결이다.
- 파닉스 생성기에는 규칙 빈칸·규칙 표시·다른 소리 찾기·라임 연결·읽기·따라 쓰기 등 12개 선택 유형이 있다. 일반 인쇄 화면과 겹치는 활동이 있으므로 18+12를 고유 유형 수로 합산하지 않는다.
- 1–5단계 완성형 워크북, 문법 워크북, 빙고·메모리 카드, 공항·병원·레스토랑·아이스크림 역할극 자료도 있다.
- 현재 일반 `fillBlank`는 **단어 안의 빠진 철자**를 만드는 기능이다. 이를 모든 문법 빈칸·지문 빈칸 생성기로 간주하지 않았다.
- 기존 미니북은 주로 단어·예문 패널이다. 일관된 이야기·통제된 파닉스 지문을 자동으로 만드는 완성형 리더와 구별했다.
- 문법 선택·빈칸·오류 수정은 검수된 일부 주제에서 구현돼 있다. 모든 문법 주제로 자동 확장돼 있다고 표시하지 않았다.
- 이 조사는 코드 구현 유무를 대조한 것이며, 기존 모든 인쇄 유형의 품질·교육 효과를 다시 전수 검증한 작업은 아니다.

확인 파일: `app/src/lib/materialsCatalog.ts`, `worksheetGenerators.ts`, `topicWorksheets.ts`, `pages/PhonicsWorksheetLibraryPage.tsx`, `data/grammarWorkbook.ts`, `pages/AirportWorksheetPage.tsx`, `components/worksheets/WorksheetSheets.tsx`.

## 표시 읽는 법

- **재사용**: 해당하는 기존 화면·생성 로직이 있다. 필요하면 사용성만 개선한다.
- **확장**: 관련 기능은 있으나 입력 데이터·활동 규칙·문항 검수 범위를 보완해야 한다.
- **신규**: 이번에 대조한 인쇄 기능에서 전용 유형을 확인하지 못했다. 새 템플릿과 필요한 데이터를 설계한다.

세 표시는 개발 관점이다. 해외 원본을 복사하거나 상업적으로 사용할 수 있다는 이용 허락을 의미하지 않는다. 아래 모든 유형은 **자체 문항·지문·그림·디자인을 제작하는 방향**으로 검토한다.

## 1. 알파벳·파닉스·발음 — 8종

참고: [FCRR 활동 분류](https://fcrr.org/student-center-activities), [Reading Rockets 소리 칸](https://www.readingrockets.org/classroom/classroom-strategies/elkonin-boxes), [UFLI 읽기·철자 활동](https://ufli.education.ufl.edu/resources/teaching-resources/instructional-activities/decoding-and-encoding/), [EnglishClub 발음](https://www.englishclub.com/esl-worksheets/pronunciation/).

| 번호 | 유형 | 용도·학습 의도와 사용하는 상황 | ClassBank 적용 |
|---|---|---|---|
| 01 | 알파벳 따라 쓰기·대소문자 연결 | 입문 시 글자 모양과 대소문자 대응을 익힌다. | 재사용: 따라 쓰기·1단계 워크북 |
| 02 | 소리 칸 채우기 — Sound Boxes | 들은 단어를 음소로 나누고 글자와 연결한다. `ship`은 `sh / i / p`의 3칸으로 연습한다. | 신규: 글자 수가 아닌 검수된 음소·철자 대응 데이터 필요 |
| 03 | 목표 규칙 표시·빈칸 | 배운 철자 묶음을 찾고 회상한다. sh·ai·매직 e 수업 직후 활용한다. | 재사용: 파닉스 규칙 표시·빈칸 |
| 04 | 소리별 분류·다른 소리 찾기 | 비슷하게 보이는 단어에서 실제 소리 규칙을 구별한다. | 재사용: 분류·phonicsOdd |
| 05 | 라임 연결 — Rhyming | 같은 끝소리를 묶어 단어군을 인식한다. 읽기 전 소리 놀이·복습에 쓴다. | 재사용: phonicsRhyme; 예외 발음 검수 보완 |
| 06 | 한 소리 바꾸기 — Word Chains | 한 음소씩 바꿔 새 단어를 읽고 쓴다. 예: `cat → cot → dot`. | 신규: 학습 범위 안의 단어와 정확한 변경 단계 검증 |
| 07 | 비슷한 소리 구별 — Minimal Pairs | `cap / cup`처럼 한 소리 차이를 듣고 말한다. 혼동 발음 보완에 쓴다. | 신규: 발음 쌍·교사용 읽기 대본 필요 |
| 08 | 음절·강세 표시 | 긴 단어를 음절로 나누고 강세를 표시한다. 단어 읽기에서 발음·유창성으로 확장한다. | 신규: 검수된 음절·강세 정보 필요 |

## 2. 어휘·뜻·철자 — 8종

참고: [FCRR 교사용 활동 예시](https://fcrr.org/student-center-activities/teacher-resource-guide), [EnglishClub 워크시트](https://www.englishclub.com/esl-worksheets/), [Reading Rockets 전략 목록](https://www.readingrockets.org/classroom/classroom-strategies), [미국 National Reading Panel 보고서의 어휘 지도 분류](https://www.readingrockets.org/sites/default/files/migrated/NRP-2000.pdf).

| 번호 | 유형 | 용도·학습 의도와 사용하는 상황 | ClassBank 적용 |
|---|---|---|---|
| 09 | 그림-단어 연결 | 새 단어의 형태와 뜻을 연결한다. 도입 직후 이해 확인에 쓴다. | 재사용: 연결하기 |
| 10 | 정의·동의어·반의어 연결 | 단순 한글 뜻 암기에서 단어 사이 의미 관계로 넓힌다. | 확장: 연결 틀 재사용, 의미 관계 데이터 추가 |
| 11 | 낱말 찾기 — Word Search | 목표 철자 배열을 눈으로 찾는다. 복습·빠른 마무리에 쓴다. 의미 이해는 별도 질문으로 확인한다. | 재사용 |
| 12 | 철자 순서 맞추기 — Word Scramble | 철자 순서를 회상한다. 그림·뜻 단서를 함께 제공한다. | 재사용 |
| 13 | 의미별 분류 — Word Sort | 음식·동물·행동 등으로 묶고 분류 이유를 말한다. | 재사용: category 기반 분류 |
| 14 | 단어 개념 지도 — Frayer Model | 뜻·특징·예·아닌 예를 정리해 개념을 이해한다. 추상 어휘·내용 교과 어휘에 적합하다. | 신규: 빈 틀은 간단, 자동 예시·비예시는 검수 필요 |
| 15 | 접두사·접미사·어근 만들기 | 단어를 구성 요소로 나눠 뜻과 품사 변화를 이해한다. | 신규: 형태소와 가능한 결합 정보 필요 |
| 16 | 자연스러운 단어 짝 — Collocations | `make / do / have` 등과 자연스럽게 결합하는 표현을 익힌다. 문장 만들기 전에 쓴다. | 확장: 연결 틀 + 검수된 표현 쌍 |

## 3. 문장·문법 — 8종

참고: [Teach-This 문법 활동](https://www.teach-this.com/grammar), [EnglishClub 문법 워크시트](https://www.englishclub.com/esl-worksheets/grammar/), [미 국무부 Word Bricks](https://americanenglish.state.gov/resources/activate-games-learning-american-english).

| 번호 | 유형 | 용도·학습 의도와 사용하는 상황 | ClassBank 적용 |
|---|---|---|---|
| 17 | 문장 순서 맞추기 | 낱말을 배열해 영어 어순을 익힌다. 문장 구조 도입 뒤 연습한다. | 재사용: sentence |
| 18 | 문법 선택·형태 빈칸 | 주어에 맞는 동사·시제·관사 등을 고른다. 규칙 적용을 확인한다. | 확장: 기존 문법 워크북의 검수 주제 확대 |
| 19 | 문장 바꿔 쓰기 — Transformations | 평서문→의문문, 현재→과거 등 형태와 의미의 관계를 연습한다. | 신규: 변환 규칙·허용 답안 필요 |
| 20 | 틀린 문장 고치기 | 오류를 찾아 수정하고 이유를 설명한다. 오개념 확인·복습에 쓴다. | 확장: 기존 correct 활동의 주제 확대 |
| 21 | 두 문장 합치기 — Combining | and·but·because 등으로 내용을 연결한다. 단문에서 복문 쓰기로 넘어간다. | 신규: 의미가 자연스러운 문장 쌍 필요 |
| 22 | 문장 조합표 — Substitution Table | 주어·동사·목적어 등을 골라 여러 문장을 만든다. 말하기·쓰기 전 지원 틀로 쓴다. | 신규: 맞지 않는 조합을 막거나 표시해야 함 |
| 23 | 대문자·문장부호 고치기 | 문장 시작·고유명사·마침표·물음표를 편집한다. 쓰기 후 검토에 쓴다. | 신규: 원문·정답·허용 변형 필요 |
| 24 | 짧은 글 빈칸 — Contextual Cloze | 단어 하나보다 넓은 문맥을 읽고 문법·어휘를 선택한다. | 확장: 객관식·역할극 빈칸 틀 활용, 지문과 오답 설계 추가 |

## 4. 읽기·내용 이해 — 8종

참고: [Reading Rockets 이야기 지도](https://www.readingrockets.org/classroom/classroom-strategies/story-maps), [호주 교육과정 그래픽 조직자](https://www.australiancurriculum.edu.au/resources/formative-assessment/designing-formative-assessment/graphic-organisers), [UFLI 수업 도구의 해독용 지문](https://ufli.education.ufl.edu/foundations/toolbox/), [Cambridge Starters 읽기 유형](https://www.cambridgeenglish.org/exams-and-tests/qualifications/young-learners/paper/starters/format/).

| 번호 | 유형 | 용도·학습 의도와 사용하는 상황 | ClassBank 적용 |
|---|---|---|---|
| 25 | 문장 읽고 그림 연결·판단 | 문장을 실제로 이해했는지 확인한다. 단어 연결의 다음 단계다. | 재사용: readMatch·참/거짓 |
| 26 | 배운 소리로 읽는 짧은 글 — Decodable Reader | 이미 배운 철자 규칙을 실제 읽기에 적용한다. 그림 추측보다 해독이 중심이다. | 확장: 기존 파닉스 리더 틀 + 단계별 자체 지문 검수 |
| 27 | 짧은 글과 Who/What/Where 질문 | 글에서 명시된 정보를 찾는다. 짧은 독립 읽기 과제로 쓴다. | 신규: 지문·질문·근거 위치 데이터 필요 |
| 28 | 이야기·그림 순서 맞추기 | 사건의 시간 순서와 연결을 이해하고 다시 말한다. | 신규: 자체 연속 그림·사건 카드 필요 |
| 29 | 이야기 지도 — Story Map | 인물·배경·문제·해결 또는 처음·중간·끝을 정리한다. 읽은 뒤 재진술에 쓴다. | 신규: 공통 빈 틀과 질문 지원 가능 |
| 30 | 중심 생각·세부 내용 | 글의 요점과 이를 뒷받침하는 정보를 구별한다. 요약 전 단계다. | 신규: 지문별 검수 답안 필요 |
| 31 | 비교표·벤다이어그램 | 두 인물·동물·글의 공통점과 차이를 정리한다. 비교 설명 쓰기로 연결한다. | 신규: 공통 틀은 쉽게 제작 가능 |
| 32 | 단서로 추론하고 근거 찾기 | 정답뿐 아니라 판단 근거를 글에서 찾는다. 읽기 수준이 오른 뒤 쓴다. | 신규: 추론 타당성·복수 해석 검수 필요 |

## 5. 듣기·받아쓰기 — 8종

참고: [Cambridge 듣기 유형](https://www.cambridgeenglish.org/exams-and-tests/qualifications/young-learners/paper/starters/format/), [홍콩 교육국 받아쓰기 활동 안내](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Dictation/Part2_3.pdf), [Bell Foundation Dictogloss](https://www.bell-foundation.org.uk/resources/great-ideas/dictogloss/).

| 번호 | 유형 | 용도·학습 의도와 사용하는 상황 | ClassBank 적용 |
|---|---|---|---|
| 33 | 듣고 그림·답 고르기 | 들은 단어·문장의 구체 정보를 구별한다. 저학년 듣기 확인에 쓴다. | 확장: 그림 선택 틀 + 교사용 대본; 일부 1단계 듣기 자료 재사용 |
| 34 | 듣고 색칠하기 | 색·위치·대상을 함께 이해한다. 단순 색칠을 듣기 활동으로 확장한다. | 확장: 선화 + 검수된 지시문, 선생님 낭독으로 시작 가능 |
| 35 | 듣고 그리기 | 위치·수·모양 등 여러 지시를 종합한다. 듣기 이해를 그림으로 표현한다. | 신규: 그리기 영역과 교사용 기준 그림 필요 |
| 36 | 듣고 지도·경로 표시 | 방향·장소 표현을 공간적으로 이해한다. 길 안내 단원에 쓴다. | 신규: 읽을 수 있는 자체 지도·정확한 경로 필요 |
| 37 | 듣고 표·일정표 완성 | 이름·시간·가격·수량을 골라 적는다. 실제 정보 청취 연습이다. | 신규: A/B 값·대본·표 데이터 필요 |
| 38 | 단어·문장 받아쓰기 | 들은 소리를 철자로 바꾸고 어순·부호를 점검한다. 짧은 진단·복습에 쓴다. | 확장: 기존 쓰기 틀 + 학생용 답 가림·교사용 대본 |
| 39 | 듣고 글 재구성 — Dictogloss | 핵심어를 메모한 뒤 짝/모둠이 글을 재구성한다. 듣기·문법·협력 쓰기를 연결한다. | 신규: 지문·메모지·교사용 피드백 기준 필요 |
| 40 | 노래·영상 핵심어 채우기 | 실제 발화에서 핵심 표현을 찾고 내용 질문으로 이어간다. | 확장: 기존 영상·가사 흐름 검토 가능; 자체/허락된 대본 필요 |

음원 생성 없이 선생님이 읽는 대본만으로도 33–39를 운영할 수 있다. 학생용 종이에 대본·정답을 같이 노출하지 않는다. 추후 TTS를 붙일 경우 발음·억양·사용 권한을 별도 확인한다.

## 6. 말하기·짝·모둠 활동 — 8종

참고: [British Council 정보차 활동](https://www.teachingenglish.org.uk/professional-development/teachers/teaching-knowledge-database/d-h/what-information-gap-activity?page=1), [Find Someone Who](https://africa.teachingenglish.org.uk/classroom/activities/find-someone-who), [뉴질랜드 ESOL 말하기 전략](https://newzealandcurriculum.tahurangi.education.govt.nz/oral-language-esol-teaching-strategies/5637263083.p), [Ellii 일상 대화](https://ellii.com/lessons/everyday-dialogues).

| 번호 | 유형 | 용도·학습 의도와 사용하는 상황 | ClassBank 적용 |
|---|---|---|---|
| 41 | 짝 인터뷰 — Ask & Answer | 같은 질문 구조를 바꾸어 묻고 답하며 답을 기록한다. | 재사용: like/have/see 기반 인터뷰 |
| 42 | 친구 찾기 — Find Someone Who | 조건에 맞는 친구를 찾아 질문한다. 여러 상대에게 반복해서 말한다. | 확장: 기존 인터뷰 + 이름 기록·후속 질문·질문 전환 |
| 43 | 서로 다른 정보 채우기 — A/B Information Gap | 한쪽에만 있는 정보를 질문해서 완성한다. 답을 알아야 하는 실제 의사소통을 만든다. | 신규: 서로 보완하는 A/B 문제·각 답안 생성 |
| 44 | 다른 그림 찾아 설명하기 — Spot the Difference | 화면을 보여주지 않고 그림 차이를 설명한다. 존재·위치·현재진행 표현을 쓴다. | 신규: 의미가 통제된 그림 쌍 필요 |
| 45 | 가리고 설명해 완성하기 — Barrier Game | 짝이 설명하는 배치대로 그림·카드를 놓는다. 정확한 설명과 확인 질문을 연습한다. | 신규: 동일 카드 세트·배치판·확인표 필요 |
| 46 | 역할 카드 대화 — Role Play | 손님·직원처럼 다른 목적을 가진 역할로 상황을 해결한다. | 재사용/확장: 기존 4개 역할극 상황을 다른 단원으로 확대 |
| 47 | 우선순위 정하기·토론 | 선택지를 고르고 이유를 말해 합의한다. 정답 하나보다 근거·상호작용을 연습한다. | 신규: 수준별 이유 표현·교사용 관찰 기준 필요 |
| 48 | 나누어 읽고 알려주기 — Jigsaw | 각자 읽은 다른 정보를 설명해 전체 과제를 해결한다. | 신규: 부분 자료·공동 완성표·역할별 질문 필요 |

## 7. 쓰기·표현·편집 — 8종

참고: [Reading Rockets 쓰기 전략 목록](https://www.readingrockets.org/classroom/classroom-strategies), [Ellii 샘플 수업의 Writing in English](https://ellii.com/sample/lessons), [British Council 어린이 활동지](https://learnenglishkids.britishcouncil.org/print-make/worksheets).

| 번호 | 유형 | 용도·학습 의도와 사용하는 상황 | ClassBank 적용 |
|---|---|---|---|
| 49 | 보고 쓰기→가리고 쓰기 | 단어 형태를 확인한 뒤 보지 않고 회상한다. 따라 쓰기 다음 단계다. | 확장: 기존 쓰기 칸 + 접거나 가리는 구역 |
| 50 | 그림 보고 문장 쓰기 — Picture Writing | 단어 지식을 자기 문장으로 바꾼다. 문장 틀→일부 힌트→독립 쓰기로 조절한다. | 확장: 기존 그림·예문·쓰기 칸 재사용 |
| 51 | 문장 살 붙이기 — Sentence Expansion | 누가·무엇을·어디서·언제 정보를 더해 문장을 구체화한다. | 확장: 기존 문장 탑의 학습 원리를 별도 인쇄 틀로 제작 |
| 52 | 문단 틀 채우기 — Paragraph Organizer | 주제문·이유·예·마무리를 계획한다. 짧은 문장 쓰기에서 문단으로 넘어간다. | 신규: 문단 틀·간단한 자체 예문 필요 |
| 53 | 만화 말풍선 완성 | 인물·상황에 맞는 자연스러운 대화를 만든다. | 신규: 일관된 자체 연속 그림 필요 |
| 54 | 일기·경험 쓰기 — Recount | 있었던 일을 시간 순서로 쓴다. 과거형·연결어를 실제 경험에 적용한다. | 신규: 계획 질문·동사 지원표 필요 |
| 55 | 의견과 이유 쓰기 | 주장·이유·예시를 연결한다. 간단한 선택 이유에서 고학년 의견문으로 확장한다. | 신규: 정답표 대신 평가 기준·예시 답안 필요 |
| 56 | 스스로·짝과 고쳐 쓰기 — Editing Checklist | 의미 전달·철자·대문자·부호를 확인해 초고를 수정한다. | 신규: 수준별 체크리스트·피드백 칸 |

## 8. 게임·조작·이동 활동 — 8종

참고: [미 국무부 Activate](https://americanenglish.state.gov/resources/activate-games-learning-american-english), [FCRR 활동 예시](https://fcrr.org/student-center-activities/teacher-resource-guide), [British Council Running Dictation](https://www.teachingenglish.org.uk/teaching-resources/teaching-secondary/activities/pre-intermediate-a2/running-dictation), [UFLI 추가 연습 자료](https://ufli.education.ufl.edu/foundations/toolbox/).

| 번호 | 유형 | 용도·학습 의도와 사용하는 상황 | ClassBank 적용 |
|---|---|---|---|
| 57 | 빙고 | 들은 뜻·단어·설명을 찾아 표시한다. 전원 참여 복습에 쓴다. | 재사용: 별도 빙고 인쇄 |
| 58 | 말하기 보드게임 | 말을 옮기고 도착 칸의 단어·문장을 말한다. 반복 연습에 쓴다. | 재사용: 인쇄 보드게임; 질문 칸 등 확장 가능 |
| 59 | 뒤집어 짝 맞추기 — Memory | 그림-단어·단어-뜻 짝을 기억해 찾는다. | 재사용: 메모리 카드 |
| 60 | 도미노 연결 | 카드의 끝과 다음 카드의 시작이 뜻·소리·문장상 맞게 이어지게 한다. | 신규: 오려 쓰는 연결 카드·검증된 연결 관계 필요 |
| 61 | 십자말풀이 — Crossword | 뜻·정의·그림 단서에서 단어를 회상하고 철자를 적는다. | 확장: 온라인 게임과 별개로 인쇄 배치·답안 엔진 검토 |
| 62 | 주사위 읽기 — Roll & Read | 주사위 숫자가 정한 줄의 낱말·문장을 반복해서 읽는다. | 신규: 기존 자료로 인쇄 템플릿 제작 가능 |
| 63 | 걸어서 전달하는 받아쓰기 | 벽의 짧은 글을 읽고 기억해 짝에게 전달한다. 네 기능을 연결한다. 교실에서는 걷기 규칙으로 운영한다. | 신규: 벽 카드·기록지·교사용 운영 안내 |
| 64 | 교실 속 단어 찾기 — Read the Room | 교실에 붙은 그림·단어를 찾아 기록·분류한다. 움직이며 읽는 코너 활동이다. | 확장: 기존 카드 + 번호별 기록지 |

## 9. 실생활·프로젝트·평가 — 8종

참고: [Ellii 일상 과업](https://ellii.com/lessons/everyday-dialogues), [Ellii 읽기·쓰기·토론 샘플](https://ellii.com/sample/lessons), [ESL Brains 사전 학습·수업 연계](https://eslbrains.com/lesson_type/flipped-lesson/), [호주 교육과정 형성평가 조직자](https://www.australiancurriculum.edu.au/resources/formative-assessment/designing-formative-assessment/graphic-organisers), [미 국무부 학습 자료 활용·Exit Ticket](https://americanenglish.state.gov/resources/teachers-corner-collecting-and-using-data).

| 번호 | 유형 | 용도·학습 의도와 사용하는 상황 | ClassBank 적용 |
|---|---|---|---|
| 65 | 메뉴·시간표·표지판 읽기 | 필요한 가격·시간·행동을 실제 문서 형식에서 찾는다. | 확장: 기존 공항 전광판·메뉴판 활용 |
| 66 | 신청서·이메일·엽서 쓰기 | 목적·받는 사람에 맞는 실용 글쓰기를 한다. 청소년·성인 영어로도 확장 가능하다. | 신규: 허구 정보와 수준별 자체 서식 |
| 67 | 안내 포스터·여행 책자 만들기 | 조사한 어휘·정보를 독자를 위한 결과물로 정리한다. 단원 마무리 프로젝트에 쓴다. | 신규: 빈 레이아웃·계획표·평가표 |
| 68 | 뉴스·영상 읽고 비교·토론 | 내용 이해와 사실/의견·관점 판단을 연결한다. 고학년·청소년·성인용이다. | 신규: 자체/허락된 지문·영상 링크·질문; 외부 기사 복제와 구별 |
| 69 | KWL — 아는 것·궁금한 것·배운 것 | 읽기 전 질문을 만들고 수업 후 배운 내용을 돌아본다. | 신규: 공통 표 한 장으로 제작 가능 |
| 70 | 수업 끝 3문항 — Exit Ticket | 오늘의 핵심 이해·오류·다음 수업 필요를 짧게 확인한다. | 확장: 기존 퀴즈 문항 + 짧은 회상·자기 점검 |
| 71 | 자기·짝 평가표 — Can-do / Rubric | 말하기·쓰기 결과를 구체 기준으로 확인하고 다음 목표를 정한다. | 신규: 어린이용 그림 척도·간단 문장 기준 |
| 72 | 누적 복습·미니 진단 | 새 단어와 이전 단어를 섞어 회상하고 부족한 항목을 찾는다. | 확장: 기존 시험지 틀; 복습 항목 선정·기록은 별도 설계 |

## 먼저 만들면 좋은 10가지

다음 순위는 시장 수요 조사 결과가 아니라 **현재 ClassBank 자료 재사용성·교사 준비 부담·새로운 학습 경험**을 기준으로 한 제안이다. 개발 기간이나 효과 크기를 확정한 견적은 아니다.

| 순위 | 후보 | 우선하는 이유 | 필요한 준비·주의할 품질 기준 |
|---|---|---|---|
| 1 | 50 그림 보고 문장 쓰기 | 기존 그림·예문을 활용하며 단어 활동을 실제 표현으로 넓힌다. | 그림 속 행동과 예문이 일치해야 함; 자유 답안은 예시 답안으로 구별 |
| 2 | 42 친구 찾기 | 기존 짝 인터뷰를 여러 친구와 실제 질문하는 활동으로 확대한다. | 질문형 변환·기록 칸·진행 예시 |
| 3 | 70 수업 끝 3문항 | 준비가 짧고 거의 모든 수업에 쓸 수 있다. | 핵심 목표별 문항·교사용 다음 수업 판단 안내 |
| 4 | 62 주사위 읽기 | 기존 단어·문장만으로 새로운 반복 읽기 경험을 준다. | 읽을 분량·반복 횟수·읽기 확인 방법 |
| 5 | 43 A/B 정보차 | 각자 다른 정보를 갖게 해 말해야 할 이유를 만든다. | A/B 보완 관계·질문 틀·완성 답안 자동 검증 |
| 6 | 02 소리 칸 | 파닉스를 글자 찾기에서 소리-철자 연결로 넓힌다. | sh를 한 소리로 처리하고 매직 e 등은 별도 표기 규칙 검수 |
| 7 | 06 한 소리 바꾸기 | 단계별 파닉스 단어 데이터를 학습 절차로 활용한다. | 학습 범위 내 실제 단어·음소 변경 검증; 기본 단어표를 임의 변경하지 않음 |
| 8 | 14 단어 개념 지도 | 그림이 어려운 어휘도 뜻·예시로 깊게 연습할 수 있다. | 자체 정의·예/비예 검수, 저학년용 간단 버전 |
| 9 | 28·29 이야기 순서와 지도 | 단어 중심 자료에서 읽기 이해·다시 말하기로 확장한다. | 연속 그림/지문을 별도로 제작; 무관한 그림을 임의로 이야기로 묶지 않음 |
| 10 | 34 듣고 색칠하기 | 기존 선화를 다른 학습 목표로 활용한다. | 모호하지 않은 대상·위치·색 지시문, 학생용/교사용 분리 |

긴 지문 자동 생성, 미세한 그림 차이 자동 제작, 자연스러운 대화 음원 등은 템플릿보다 콘텐츠 제작·검수 부담이 크다. 초기에는 짧고 검수된 자체 콘텐츠와 선생님 낭독 대본으로 시작하는 것이 현실적이다.

## 참고해서 만들어도 되는가

일반적인 학습 활동의 원리를 연구하고 **자체 문제·지문·그림·레이아웃으로 독립 제작**하는 방향을 권한다. 미국 저작권청은 아이디어·방법 자체와 그것을 표현한 글·그림을 구별한다. 다만 이 설명만으로 특정 해외 자료의 국내 상업 사용이 일괄 허용된다는 뜻은 아니다. [미국 저작권청 설명](https://www.copyright.gov/circs/circ31.pdf)

| 자료 | 확인한 이용 조건 | ClassBank에서의 판단 |
|---|---|---|
| FCRR | 비영리 교육 목적, 변경 금지, 상업 이용·다른 사이트 재게시 등에 제한이 명시돼 있다. | PDF·그림·문항 세트를 우리 서비스에 옮기지 않고 활동 원리 참고. [원문](https://fcrr.org/student-center-activities) |
| UFLI | 교실 사용과 일부 적응을 허용하지만 판매·외부 재게시·매뉴얼 내용 재활용 등에 제한이 있다. 자체 콘텐츠라도 제휴·인증을 암시하면 안 된다. | 단어 사슬·통제 지문은 우리 데이터·자체 문장으로 새로 설계. [정책](https://ufli.education.ufl.edu/copyright/) |
| Teach-This | 수업 내 사용·적응 허용과 별개로 상업 배포, 공개 게시, 경쟁 교육 제품 제작 등에 금지 조건이 있다. | 유료 구독을 하더라도 자료를 가져와 ClassBank 상품으로 바꿔 배포하는 방식은 사용하지 않음. [약관 6항](https://www.teach-this.com/terms) |
| EnglishClub | 일부 페이지에 copyright-free/교실 인쇄 가능이라고 안내한다. | 이 문구만으로 상업 플랫폼 재배포·편집·임베드 권한까지 확정하지 않음. 원본 사용이 필요하면 해당 파일·범위의 조건을 추가 확인. [문법 페이지](https://www.englishclub.com/esl-worksheets/grammar/) |
| 그 밖의 출판·시험·영상 자료 | 페이지 공개·샘플 다운로드와 상업 재배포 허락은 같은 의미가 아니다. | 시험 문제·기사·가사·그림·캐릭터·정답 세트를 그대로 복제하지 않고 자체 제작하거나 별도 사용 허락 확보 |

이번 조사에서는 유료 가입·자료 구매·이미지/음성 생성·외부 자료의 대량 다운로드를 하지 않았다.

## 교사 화면에 적용할 때의 방향

72개를 한 화면에 72개 버튼으로 늘리기보다, 교사가 이해하기 쉬운 목적별 입구를 제안한다.

- **단어 익히기**: 연결·철자·분류·단어 개념 지도
- **소리와 철자 배우기**: 소리 칸·규칙·단어 바꾸기
- **문장 만들기**: 어순·그림 쓰기·문장 확장
- **읽고 이해하기**: 짧은 글·순서·이야기 지도
- **듣고 활동하기**: 듣고 고르기·색칠·표 채우기
- **짝과 이야기하기**: 인터뷰·친구 찾기·A/B 활동
- **게임으로 복습하기**: 빙고·보드·도미노·주사위 읽기
- **오늘 배운 것 확인하기**: 3문항·자기 평가·누적 복습

각 카드에는 **무엇을 하는지·혼자/짝/모둠·준비물·예상 수업 시간·한 장 예시**를 먼저 보여준다. 시간은 실제 시범 수업으로 보정한다. 학생용/교사용을 분리하고, 선택한 자료로 만들 수 없는 유형은 필요한 자료를 짧게 안내한다. 이 메뉴 구성은 제안이며 이번 조사에서 앱 코드는 변경하지 않았다.

## 주요 조사 출처

1. 영국 British Council: [어린이 워크시트](https://learnenglishkids.britishcouncil.org/print-make/worksheets), [정보차 활동](https://www.teachingenglish.org.uk/professional-development/teachers/teaching-knowledge-database/d-h/what-information-gap-activity?page=1), [친구 찾기](https://africa.teachingenglish.org.uk/classroom/activities/find-someone-who), [이동 받아쓰기](https://www.teachingenglish.org.uk/teaching-resources/teaching-secondary/activities/pre-intermediate-a2/running-dictation)
2. 영국 Cambridge English: [Starters 활동·평가 형식](https://www.cambridgeenglish.org/exams-and-tests/qualifications/young-learners/paper/starters/format/)
3. 미국 Florida Center for Reading Research: [활동 모음](https://fcrr.org/student-center-activities), [교사 안내](https://fcrr.org/student-center-activities/teacher-resource-guide)
4. 미국 University of Florida Literacy Institute: [도구 모음](https://ufli.education.ufl.edu/foundations/toolbox/), [읽기·철자 활동](https://ufli.education.ufl.edu/resources/teaching-resources/instructional-activities/decoding-and-encoding/)
5. 미국 Reading Rockets: [전략 목록](https://www.readingrockets.org/classroom/classroom-strategies), [소리 칸](https://www.readingrockets.org/classroom/classroom-strategies/elkonin-boxes), [이야기 지도](https://www.readingrockets.org/classroom/classroom-strategies/story-maps)
6. 미국 국무부 American English: [Activate](https://americanenglish.state.gov/resources/activate-games-learning-american-english), [수업 자료와 평가 활용](https://americanenglish.state.gov/resources/teachers-corner-collecting-and-using-data)
7. 호주 ACARA: [Graphic organisers](https://www.australiancurriculum.edu.au/resources/formative-assessment/designing-formative-assessment/graphic-organisers)
8. 뉴질랜드 교육과정 Tāhūrangi: [ESOL 말하기·듣기 전략](https://newzealandcurriculum.tahurangi.education.govt.nz/oral-language-esol-teaching-strategies/5637263083.p)
9. 홍콩 교육국 EDB: [받아쓰기 활동 PDF](https://www.edb.gov.hk/attachment/en/curriculum-development/kla/eng-edu/references-resources/Dictation/Part2_3.pdf)
10. 캐나다 기반 Ellii: [회사 소개](https://ellii.com/press), [샘플 수업](https://ellii.com/sample/lessons), [일상 대화](https://ellii.com/lessons/everyday-dialogues)
11. 영국 Bell Foundation: [Dictogloss](https://www.bell-foundation.org.uk/resources/great-ideas/dictogloss/)
12. 국제 영어교육 자료 사이트: [EnglishClub](https://www.englishclub.com/esl-worksheets/), [Teach-This 문법](https://www.teach-this.com/grammar), [ESL Brains 사전 학습·수업 연계](https://eslbrains.com/lesson_type/flipped-lesson/)

유형의 존재·운영 절차는 교육기관/제공자의 원문을 바탕으로 정리했다. 상업 사이트의 홍보성 학습 효과 문구를 독립적인 효과 검증 결과로 취급하지 않았다. 72개 모두를 한 번에 개발하자는 제안도 아니다.
