# 게임 상단 도구줄 계획 (2026-11-04)

게임에 들어가면 **샘플로 바로 실행**되고, 위쪽 한 줄에 6개 버튼이 있다. 준비 화면·설정 마법사는 없앤다.
이 문서는 개발 전에 **버튼마다 어떤 기능·항목을 넣을지** 정리한 목록이다(게임 74종, 분류 10묶음).

## 0. 공통 도구줄

`[내 단어/문장] [참여자] [게임설정] [다시하기] [나가기] [전체화면]` (+ 한 수 되돌리기가 있는 게임은 `[되돌리기]`)

| 버튼 | 누르면 | 공통 규칙 |
|---|---|---|
| **내 단어/문장** (문법 게임은 "문법") | 아래쪽에 패널. ① 내 단어장 ② 문장 모음 ③ ▸ 직접 입력(접힘). 고르면 바로 적용 | 샘플이면 위에 "샘플 자료예요 · 내 단어장으로 바꾸기" 띠. 진행 중이면 "바꾸면 처음부터 시작해요" 확인 1번. 단어장이 하나도 없으면 직접 입력을 펼침 |
| **참여자** | `없음`(기본) · `개인` · `팀`(2~4팀) · `순서 정하기` | 반 명단으로 팀·순서 배정(기존 `TeamOrderPanel`). 반별로 기억. 바꾸면 처음부터 다시 시작 |
| **게임설정** | 그 게임만의 옵션 3~5개 + `▸ 더 보기`. 맨 아래 `저장하기`(내 게임으로) | 옵션은 즉시 반영. 저장은 이름 입력 후 |
| **다시하기** | 같은 자료로 처음부터 | 진행 중이면 확인 1번(지금도 있음) |
| **나가기** | 게임 목록으로 | 저장 안 된 변경이 있으면 확인 |
| **전체화면** | 전체화면 켜기/끄기 | 전체화면에서도 도구줄은 위에 남음 |
| **되돌리기** | 직전 한 수 취소 | 지금 8개 게임만: tictactoe, connect4, baskin31, gameshowquiz, winlosequiz, matchup, whackamole, hangman |

수업 발표 중에는 `참여자`·`게임설정`·`내 단어/문장`을 숨기고 `다시하기·전체화면`만 둔다(지금 규칙 유지).

## 1. 문법 게임 15종 (먼저 만든다)
grammarlab, grammarverb, grammarauction, grammarwrite, grammarpos, grammarframe, grammarcompare, grammarlink, grammarhabit, grammarpassive, grammarcond, grammarrelative, grammarask, grammarshop + grammardetective(탐정, 어드벤처형)

| 버튼 | 항목 |
|---|---|
| 문법 | 문법 항목 선택(학교급·학년 칩 + 검색, 그 게임에서 문제가 충분한 항목만) / 내가 저장한 게임 / 탐정은 "문법 사건집 가져오기" |
| 참여자 | 없음(기본) · 개인(내 점수) · 팀 2~4 · 순서 정하기 |
| 게임설정 | 문제 수(8/10/12) · 힌트 켜기 · 효과음 · (경매) 시작 코인 · (친구 찾기) 판 수 |
| 나머지 | 공통 |

## 2. 목록형 돌림·추첨·보드 (13종)
wheel, ladder, order, bomb, findmissing, passball, popcorn, rankorder, twodice, baskin31, tictactoe, connect4, saveorgive

| 버튼 | 항목 |
|---|---|
| 내 단어/문장 | 단어장 / 문장 모음 / 직접 입력(한 줄에 하나). 학생 이름으로 돌리는 경우 "반 명단 불러오기"(wheel·ladder·order·bomb·passball) |
| 참여자 | 돌림판·사다리·순서·폭탄·공 돌리기는 **명단이 곧 참여자**(개인 기본). 보드 게임(tictactoe·connect4·baskin31)은 **팀 2 고정**. twodice·saveorgive는 팀 2~6 |
| 게임설정 | wheel: 뽑은 항목 빼기·돌림판 색 / ladder: 결과 칸 입력·순서 섞기 / bomb: 시간 범위·소리 / popcorn: 개수·점수 / passball: 시간 / twodice: 판 크기 / baskin31: 목표 수 / connect4: 판 크기 / saveorgive: 팀 수 |
| 되돌리기 | tictactoe, connect4, baskin31 |

## 3. 글자 게임 (5종)
hangman, anagram, spellword, wordsearch, crossword

| 버튼 | 항목 |
|---|---|
| 내 단어/문장 | 단어장 / 직접 입력(문장 모음은 지원 안 함 → 버튼에 "단어만" 표시). 철자 길이 2~14자 자동 검사 |
| 참여자 | hangman·anagram·spellword: 없음/개인/팀 · wordsearch·crossword: 없음/개인(팀 점수 없음) |
| 게임설정 | hangman: 시도 횟수·대소문자 자판 / anagram: 힌트(뜻 보이기) / spellword: 소리 듣기 / wordsearch: 판 크기·방향 / crossword: 힌트 종류 |
| 되돌리기 | hangman |

## 4. 짝·카드 (5종)
matchup, whackamole, flashcards, typeanswer, groupsort

| 버튼 | 항목 |
|---|---|
| 내 단어/문장 | 단어+뜻 짝(단어장 그대로) / 직접 입력 `영어 | 뜻`. groupsort는 카테고리 있는 단어장만("그룹 자동 만들기") |
| 참여자 | 없음/개인/팀. flashcards·groupsort는 순서 정하기 |
| 게임설정 | matchup: 쌍 수·그림 보이기 / whackamole: 시간·난이도 / flashcards: 섞기·뒷면 먼저 / typeanswer: 대소문자 구분·힌트 / groupsort: 그룹 이름 고치기 |
| 되돌리기 | matchup, whackamole |

## 5. 퀴즈형 (7종)
quiz, truefalse, gameshowquiz, winlosequiz, imagequiz, labeleddiagram, quizshow

| 버튼 | 항목 |
|---|---|
| 내 단어/문장 | 단어장 → 문제 자동 만들기(오답 자동) / 직접 문제 입력(접힘) / imagequiz·labeleddiagram은 **그림 올리기·사전에서 고르기**. quizshow(대회)는 단어장으로 라운드 8종 자동 |
| 참여자 | quiz·truefalse: 없음/개인/팀/순서 · gameshowquiz: 팀 2 고정(청·홍) · winlosequiz: 팀 2~4 · quizshow: **학생 폰 입장**(참여자 버튼은 QR·입장 번호 패널) |
| 게임설정 | 문제 수·보기 수 / 제한 시간 / 보너스 문제 / 라이프라인 / (quizshow) 라운드 켜기·끄기·순서 |
| 되돌리기 | gameshowquiz, winlosequiz |

## 6. 문장형 (4종)
unscramble, sentencesplash, catchsentence, lightning

| 버튼 | 항목 |
|---|---|
| 내 단어/문장 | 문장 모음 우선(문장 은행 상황·레벨·목적 선택 패널 포함) / 단어장 / 직접 입력 `영어 | 해석` |
| 참여자 | unscramble: 없음/개인/팀/순서 · sentencesplash: 개인/팀 · catchsentence: 팀 1~4 · lightning: **학생 수 2~40**(번호 칩) |
| 게임설정 | unscramble: 낱말 섞기 수준 / sentencesplash: 속도 / catchsentence: 단계 1~5·보이는 시간 / lightning: 캐릭터·번개 최소·최대 초 |

## 7. 어드벤처·스토리 (9종)
balloonpop, wordfishing, treasurehunt, wordclaw, grammardetective, wordtrain, sentencerocket, feedmonster, sentencebridge, sentencetower (전용 편집기가 있는 게임)

| 버튼 | 항목 |
|---|---|
| 내 단어/문장 | balloonpop·wordfishing: 단어+뜻 / wordtrain·sentencerocket·sentencetower·sentencebridge: 문장 / treasurehunt·wordclaw: 단서·미션(직접 입력 중심, 샘플 제공) / feedmonster·sentencebridge·sentencetower: 이야기(storybook) 편집기 |
| 참여자 | 없음/개인/팀(기본 없음) |
| 게임설정 | 소리 켜기·제한 시간·난이도 / 전용 편집기로 가는 "내용 고치기" 버튼 |

> 이 묶음은 전용 편집기가 크다. 1차에는 **내 단어/문장 버튼이 그 편집기를 연다**로 두고 편집기 자체는 손대지 않는다.

## 8. 팀 대결형 (6종)
treasuredig, fourclues, lastbox, mysterybox, shufflefind, telepathy

| 버튼 | 항목 |
|---|---|
| 내 단어/문장 | 낱말·문장 혼합 `영어 | 해석`, 단어장 / 문장 모음 / 직접 입력, 문장 은행 패널 |
| 참여자 | 팀 수 칩(2~4 또는 2~8)이 **기본으로 "팀 2"**. `없음`은 선택 불가(팀 대결이라). 순서 정하기 가능 |
| 게임설정 | treasuredig: 언덕 12/20/30 / fourclues: 팀 수 / lastbox: 박스 15/21/31 / mysterybox: 방식(버섯·문제 맞히기)·칸 20/28 / shufflefind: 컵 3~5·속도·판 수 / telepathy: 후보 3~4·시간·판 수 |
| 되돌리기 | 직전 판정 한 번(treasuredig·fourclues·mysterybox) |

## 9. 역할극 (5종)
airport, restaurant, icecream, doctor, shopping

| 버튼 | 항목 |
|---|---|
| 내 단어/문장 | **내장 대본이라 단어장 없음.** 버튼은 "낱말 바꾸기"(공항 낱말·메뉴·환자 선택) 하나만. shopping은 물건 고르기(사전·단어장) + 가게 선택 |
| 참여자 | 없음(기본) · 짝 연습(Partner A/B, Switch!) · 순서 |
| 게임설정 | 해석 보이기 / 단계(메뉴 수준·장소) / 가격 기호 / 방식(shopping: 목록·요리·특별한 날) |
| 메모 | 워크시트 인쇄 버튼은 `게임설정` 안에 둔다(지금 소개 패널 위치) |

## 10. 기타 (5종)
timer, mathgen, mazechase, airplane, watermelon

| 게임 | 내 단어/문장 | 참여자 | 게임설정 |
|---|---|---|---|
| timer | 팀 이름 | 팀 2~6 | 시간·소리·모드 |
| mathgen | 없음(수 범위) | 없음/개인 | 연산 종류·범위·문제 수 |
| mazechase | 단어장·직접 입력 | 개인/팀 | 미로 크기·난이도 |
| airplane | 단어장·직접 입력 | 팀 | 속도 |
| watermelon | 문장 틀(주어·동사·목적어 칸) | 개인/팀 | 문장 틀 선택 |


## 적용 단계 (A·B·C, 2026-11-04 확정)

- **A — 그대로 적용(약 45종):** 문법 게임, 목록형, 글자(단어장만), 짝·카드, 퀴즈형, 문장형, 팀 대결형. 6버튼 전부.
- **B — 일부만(약 14종):** 역할극 5종, mathgen, timer, labeleddiagram, imagequiz, watermelon 등. 쓸 수 없는 버튼은 숨기고 `게임설정`을 풍부하게.
- **C — 틀만(약 10종 + quizshow):** 어드벤처·스토리 게임과 대회 퀴즈쇼. `다시하기·나가기·전체화면`만 공통이고 내용 편집은 기존 편집기.
- 참여자 구조가 고정된 게임(gameshowquiz·tictactoe·connect4 팀 2 고정, lightning 학생 수, ladder 결과 칸 수)은 `없음`을 막거나 해당 입력으로 대체.

## 구현 진행

- [x] 문법 게임 14종(탐정 제외): `GrammarToolbar`(문법 · 참여자 · 게임설정 · 다시하기 · 나가기 · 전체화면). 들어오면 샘플로 자동 시작, 준비 창 안 뜸. 문법 고르기·참여자는 바꾸면 처음부터 다시 시작.
- [ ] 문법 게임의 게임설정 옵션(문제 수·힌트): 아직 게임 쪽에 옵션이 없어서 지금은 반 선택·저장만.
- [x] 공통 `GameToolbar`(2026-11-04): 들어오면 샘플로 바로 시작(`instantStart`), 내 단어/문장(문법)·반 설정·게임설정·저장/불러오기·다시하기·나가기·전체화면. 세 패널 위쪽 `적용` 버튼 → "설정이 적용되었습니다." 알림(토스트). 어드벤처·스토리 10종·대회 퀴즈쇼(C단계)는 예전 준비 흐름 유지. 되돌리기는 기존 프레임 버튼 그대로.
- [ ] 게임별 옵션(문제 수·힌트 등)을 게임설정 패널에 직접 넣기(지금은 효과음 + "자세한 설정 열기").

## 개발 순서

1. **공통 도구줄 만들기**(`GameToolbar`): 6버튼 + 아래로 열리는 패널 틀 + "샘플 띠" + "바꾸면 처음부터" 확인. 기존 `GameWorkspaceFrameControls`를 이것으로 교체.
2. **문법 게임 15종 연결**: 문법·참여자·게임설정 패널. 준비 창(`GameSetupGuide`)을 거치지 않고 샘플로 바로 시작. 끝나면 방금 만든 `GrammarGuideStep` 정리.
3. **내 단어/문장 패널 공통화**(목록·글자·짝·퀴즈·문장형): 단어장 / 문장 모음 / 직접 입력(접힘).
4. **참여자 공통화**: 모든 게임의 팀 수를 `configureTeams`로 연결(이미 팀 수가 있는 게임 8개: fourclues, catchsentence, lastbox, mysterybox, treasuredig, shufflefind, telepathy, saveorgive).
5. **어드벤처·역할극**: 전용 편집기로 가는 버튼으로 연결.
6. 게임마다 "샘플이 있는가"·"자료를 바꾸면 처음부터 다시 시작되는가"를 점검하는 스크립트를 추가한다.

## 정해진 것
- `뒤로가기` = **나가기**(게임 목록으로)와 **되돌리기**(한 수)를 따로 둔다.
- 샘플이면 "샘플 자료예요" 띠를 보여 준다.
- 내 단어/문장·참여자를 바꾸면 처음부터 다시 시작하고, 진행 중이면 확인을 한 번 한다.

## 아직 정해야 할 것 (확인 필요)
- 7번 묶음(어드벤처·스토리)의 `내 단어/문장` 버튼을 1차에서는 "전용 편집기 열기"로만 둬도 되는지.
- 9번 역할극의 `참여자`(짝 연습)가 지금 게임 안 `Switch!` 버튼과 겹치는데, 도구줄로 옮길지 게임 안에 둘지.
- 단어장이 하나도 없는 신규 학원에서 `내 단어/문장`을 눌렀을 때 보일 안내 문구.
