# 클래스뱅크 — Claude 협업 메모

이 파일을 **현재 진실**로 본다. 초기 히스토리·옛 결정 세부는 `handoff.md`. 설치/스키마 적용은 `README.md`.

마지막 갱신: **2026-09-06** (Claude 세션: 교습소 선생님 실사용 피드백 10건 반영(단어/게임 항목 추가 시 토스트, 단어장·사전 추가 버튼 강조, 게임 생성 도움말, 단어장 "전체" 탭, 팝콘 터짐 연출 화면 확대, 행맨 자판 대소문자 토글, Two Dice를 팀 빙고(가로·세로·대각선)로 전체 재설계, 퀴즈·O,X·게임쇼퀴즈·퀴즈이기거나잃기 4종 편집/플레이 모드 분리) + 임시 🐷 이모지를 실제 `BrandMark.tsx` 로고로 전면 교체(파비콘 포함) + **랜딩 페이지를 "포인트 통장"에서 "단어장→게임 자동화"로 전면 재포지셔닝**(아래 "서비스 포지셔닝" 참고) + 사전/파닉스 이미지 PNG→WebP 전환(용량 약 12.7배 절감, 해상도 유지) — 이전 갱신(2026-09-03): 단어 사전(`/dictionary`, 800단어)·파닉스(`/phonics`, 347단어) 공용 데이터 도입, 출석부를 "학생관리"로 확장(반/학생 추가·이름변경·삭제), 반 선택 칩 드래그 순서변경(`ClassChipRow`) 전 페이지 적용, 선생님이 만드는 단어장(`/wordlists`, `word_lists` 테이블) + `WordListPicker` 게임 31종 적용(오지선다 4종 오답/거짓문장 자동생성 + 그룹정렬 카테고리 자동그룹화) + 오지선다 게임 5종 크래시 버그 수정 + 전체화면·다시하기 버튼 게임 34종 전체 적용(`GameThemeFrame`) + 한 수만 되돌리기 8종 적용(`UndoHandle` forwardRef 패턴) + 단어 사전·파닉스 발음 재생(`speech.ts`) + 파닉스 소리규칙 강조 색상 대비 수정 + 게임 설정 화면 간소화(`OpenInOtherGame` 스크롤 패널, `DictionaryPicker` 사전 검색 추가) + 단어장 카테고리로 선택하기 + 결과 초기화 + **배포 대상 전면 교체**(`pointbank-ten.vercel.app`/`pointbank2608-1458s-projects`, 기존 `classbank-rho.vercel.app`/`businessgym11-8014s-projects` 는 무관한 프로젝트였음이 확인돼 폐기))

---

## 한 줄

초등 영어 학원·공부방 **선생님용** 재미있는 수업 도구. 단어장 한 번 만들면 게임 34종에 그대로 들어간다(오지선다는 오답까지 자동생성). 포인트 통장·출석·숙제 캘린더는 그 수업을 뒷정리하는 기능이다. 포인트는 현금이 아니다.

---

## 서비스 포지셔닝 (2026-09-06 확정)

**파는 것은 포인트가 아니라 "준비 시간을 줄여주는 재미있는 수업 게임"이다.** 선생님들이 수업 게임의 효과를 몰라서 안 쓰는 게 아니라, 단어 입력·보기 제작·오답 제작·게임마다 재세팅하는 준비가 수업 시간보다 길어서 안 쓴다. 클래스뱅크의 핵심 가치는 **단어장을 한 번만 만들면 돌림판·퀴즈·매치업·플래시카드 등 게임 34종 중 31종에 그대로 재사용**되고(사전에서 담으면 이미지도 같이 따라오고, 오지선다는 오답/거짓문장까지 자동 생성), 남은 3종(명칭 다이어그램·문장 만들기·수학 문제)만 아직 그 흐름 밖이라는 것.

- **바깥 메시지(랜딩·마케팅)**: "재미있는 영어 수업 도구". 통장보다 게임·단어장·사전·파닉스를 먼저 보여준다.
- **안쪽 루프(제품 안 실제 흐름)**: 게임으로 수업 → 잘한 아이에게 포인트 지급. 통장은 보상 판매 수단이 아니라 "오늘 수업을 닫아 주는" 뒷정리 기능 — **기능 자체를 없애거나 축소하지 않는다**, 랜딩 등 바깥 메시지에서 순서만 뒤로 둔다.
- **하지 말 것**: 칭찬모아처럼 포인트→기프티콘·마켓데이로 가지 않는다(룰 3과 동일 원칙). 그 시장에서는 이길 수 없고, 우리 차별점은 "학생 앱 없이 선생님이 전자칠판에서 바로 돌리는 게임 + 그 게임에 바로 들어가는 단어장·사전·파닉스"다.
- 새 기능·문구를 판단할 때 기준: "이게 선생님의 수업 게임 준비 시간을 줄여주는가?" 통장/출석 개선은 계속하되, 앞세워 파는 것은 게임 쪽이다.

---

## 꼭 지킬 것

1. **선생님 제품이다.** 학생 UX를 키우지 않는다. `/me`·학생 라우트는 남아 있어도 확장하지 않는다. 베타에서는 학생 로그인 잠금 (`006_disable_student_login.sql`).
2. **동작 중인 `/board`(통장), `/attendance`를 목업으로 바꾸지 않는다.** 시각만 손볼 때는 실제 데이터·실제 라우트를 유지한다.
3. **칭찬모아(ccmoa.imweb.me)를 기능으로 따라가지 않는다.** 그쪽은 1포인트=1원, 기프티콘, 마켓데이 물류다. 우리는 수업 중 운영 도구다. 기프티콘 카탈로그·선충전 현금 포인트·여러 학원 포인트 합산은 하지 않는다. (자세한 포지셔닝은 위 "서비스 포지셔닝" 참고 — 파는 것은 포인트가 아니라 게임 준비 시간 단축이다.)
4. **랜딩에서 “스티커”라고 쓰지 않는다. “쿠폰”이다.**
5. **숙제 기록은 별도 입력이 아니다.** 통장의 숙제 완료 지급 버튼 → 캘린더 완료, 미제출 차감 버튼 → 캘린더 미제출. (`presets.is_homework`, `PassbookCard` / `ClassBoardPage`)
6. **새 미니게임**은 네비에 메뉴를 늘리지 않는다. `app/src/lib/gameCatalog.ts`의 `GAME_CATALOG` 배열에 항목 하나만 추가하면 `/games` 카드 목록에 자동 반영된다(`GamesPage.tsx`는 이 배열을 그대로 매핑). `App.tsx`에 스태프·학생 라우트 두 줄 추가는 별도로 필요. `game_templates` + `config jsonb`. `game_type`에 CHECK 없음 → 스키마 없이 종류 추가 가능. 게임마다 `number`(참고용, DB에 저장 안 됨)와 `category`(`simple`/`vocabulary`/`sentence`/`listening`/`reading`/`speaking`)를 붙인다.
7. **오늘 통장 화면은 오늘 적립만 크게.** 누적은 기본 숨김. 마감은 저장이 아니라 확정(`settlements`).
8. **커밋은 사용자가 요청할 때만.** `main`에 푸시하면 자동 배포된다 (아래 배포 참고). 수동 배포가 필요하면 `businessgym11-8014s-projects` 아닌 `pointbank2608-1458s-projects` 스코프로.

---

## 정보 구조 (로그인 후)

선생님(staff): 사이드/하단 내비 — 대시보드, 학생관리, 통장(`/board`), 게임, 단어 사전, 파닉스, 리포트(`/results`). 기본 진입 `/dashboard`.

- `/dashboard` — 오늘 할 일, 실데이터. 맨 위 "처음 시작하기" 체크리스트(`OnboardingChecklist.tsx`, 반→단어장→게임→수업→발표 5단계, 실데이터로 자동 체크, 발표는 러너 시작 시 localStorage 표시, 숨기기 가능) — 사용설명서 1단계. 발표 진행바의 "?"는 발표 단축키 안내(`LessonRunnerBar` `KEY_ROWS`, 발표 조작을 바꾸면 여기도 고칠 것). 다음: `/help` 페이지·페이지별 "?"·FAQ.
- `/attendance` (네비 라벨 "학생관리") — 반 추가, 학생 추가/이름변경/삭제 + 출석부(등원·하원, 월별) 전부 한 페이지. `AttendancePage.tsx`.
- `/board` — 반 통장. 프리셋 버튼으로 지급/차감
- `/dictionary` — 교육부 지정 초등 필수 영단어 800(`word_bank` 테이블, 학원 구분 없는 공용 데이터). 카테고리/품사 필터, 이미지 클릭 시 전체보기. 단어·예문 옆 🔊 버튼으로 발음(`app/src/lib/speech.ts`의 `speak()`, Web Speech API, 서버 비용 없음) 재생. `DictionaryPage.tsx`. **확장 중(2026-09-20)**: 초등 중심 약 1,500단어로 늘리는 중 — `word_bank`에 `level`(1~4, 5+는 중등 이상용 예약)·`subcategory`·`extra_categories`(같은 뜻이 여러 카테고리에 걸릴 때, 뜻이 다르면 `word-2` 행)·`origin`(`moe`만 "교육부 지정"이라 부를 수 있음) 컬럼(`supabase/020~025`: 020 스키마, 021 기존 812 레벨, 022 시범 166, 024 확장 배치 785행, 025 기존 단어 추가 카테고리, 023은 그림 생긴 뒤 image_url), 숙어·표현은 `part_of_speech`가 '숙어'/'표현'인 행을 "숙어·표현" 탭으로 분리. 카테고리로 거를 땐 반드시 `entryInCategory()`(`wordBankCategories.ts`). 새 행은 그림 파일이 생길 때까지 `image_url = null`. 데이터 파이프라인은 `app/scripts/vocab/`(원본 목록 `raw-lists*.mjs` → 보강 `pilot-new-words.mjs`/`batch-a~e.mjs` → `build-batches.mjs`가 024·025 SQL과 검수 CSV 생성, `image-targets.mjs`가 그림 대상 목록), 그림 제작은 `CURSOR_IMAGE_HANDOFF.md`. 글자 게임의 표기 처리 규칙은 `lib/gameText.ts`(아직 게임에 미연결). 5,000단어 초·중·고·대입 확장은 보류.
- `/phonics` — 파닉스 5단계 단어 347(`phonics_bank` 테이블, 공용 데이터, 이미지 301장 커서가 채움). 단계 탭 + 소리규칙 필터. 소리규칙 강조는 이미지에 텍스트를 굽지 않고 `pattern_marked`의 `{}` 마커를 앱이 직접 `bg-warm-yellow text-deep-navy`(진한 남색 글자+밝은 노란 배경, 처음엔 파란 글자+파란 배경이라 안 보인다는 피드백으로 수정함)로 렌더링. 단어 옆 🔊 버튼도 `speak()` 재사용. `PhonicsPage.tsx`. `word_bank`/`phonics_bank` 둘 다 쓰기는 SQL Editor로만, RLS는 읽기 전용.
- `/grammar` (네비 라벨 "문법", 파닉스 밑, 2026-09-26) — 모두 127개: 초등 43 · 중등 37 · 고등 19 + 따로 정리한 8품사 9 · 시제 13(12시제+한눈에) · 5형식 6. `stage`는 `elementary|middle|high|pos|tense|forms`(페이지·슬라이드 고르기의 탭), 레벨 번호는 1~4 초등, 5~7 중1~3, 8 8품사, 9 시제, 10 5형식, 11~15 고등 영역(동사·준동사·관계사/접속사·가정법/비교·특수 구문). **기존 항목과 겹쳐도(예: 중2 5형식) 지우거나 합치지 않는다(사용자 요청)**. 127개 전부 초보자용 필드 `usage`(이럴 때 써요)·`detail`(쉽게 이해하기)·`translations`(예문 해석, 괄호에 역할 메모)·`tip`(한 줄 정리)이 있고(초등은 아이에게 읽어 줄 수 있는 말투, 초등도 `rule`·`pitfalls` 추가), 문법 페이지의 설명 카드(`GrammarExplainCard`)와 칠판의 "해석 보기"가 이걸 쓴다. **초등과 중등의 차이(사용자와 합의)**: 초등은 Language Level 1~4로 묶고 문장 틀 + 예문 중심, 중등은 교과서·내신 흐름대로 학년 묶음(level 5=중1, 6=중2, 7=중3)이고 칠판에 형태 규칙 상자(`rule`)와 "틀리기 쉬운 것" ✗/✓ 화면(`pitfalls`)이 더 붙는다. 중등 예문은 6~12낱말, 단어장 바꾸기는 항상 안전한 틀(I enjoy ~ing, It is fun to ~ 등)만. 데이터는 `src/data/grammarPoints.json`(원본, 검수표는 `node app/scripts/grammar/build-review.mjs` → `out/grammar-review.csv`), 도구는 `lib/grammar.ts`. **레벨은 문법 단원이 아니라 Language Level 1~4**(Notice & Name → Tell & Explain, 커리큘럼 프레임워크)이고, 문법은 규칙보다 "문장 틀"(`pattern`, `[ ]`=바뀌는 자리, `** **`=강조)로 먼저 보여준다. 예문은 검수된 것만(초안 4~5개씩, 사용자 검수 전). "우리 단어장으로 예문 만들기"는 AI 없이 `slots` 틀에 품사·카테고리가 맞는 단어만 넣고 a/an·복수·-ing·-s·-ed는 코드 규칙(`buildWordListSentences`); 동사는 목적어 없이 자연스러운 `SAFE_VERBS`만, 사실관계가 틀리기 쉬운 틀(비교급·생김새 등)은 `slots: null`. 품사 저장 전 단어장·직접 입력 단어는 `useGrammarCards`가 사전(word_bank)에서 같은 낱말을 찾아 품사·카테고리를 채운다. 화면은 `GrammarBoard`(16:9 칠판, cqh 글자, 예문 하나씩 꺼내기 →/Space, 읽어주기 `speakSequence`) — 문법 페이지 "크게 보기"와 커리큘럼 "문법" 슬라이드(`kind: 'grammar'`, `grammarId`/`useWordList`/`seed`/`boardTheme`)가 공유. 슬라이드 상세의 "다음에 문장 배열하기 게임 넣기"는 예문으로 unscramble 템플릿을 만들어 바로 뒤에 게임 슬라이드를 넣는다.
- `/games` — 게임 34종 카드. 선생님은 "내 라이브러리"(현재 반에 템플릿이 있는 게임만)/"전체 보기" 탭, 카테고리 필터 탭 + 번호 배지. 전체 목록은 `app/src/lib/gameCatalog.ts`가 단일 소스 — 새 게임은 여기 한 줄 + `App.tsx` 라우트(스태프·학생) 두 줄이면 끝.
  - 1~30번: 돌림판·사다리·랜덤공뽑기부터 미로 찾기·비행기까지(순서/설명은 `gameCatalog.ts` 참고). 1~10번(돌림판·사다리·랜덤공뽑기·시한폭탄·타이머·틱택토·Save or Give it·사라진 항목 찾기·4 in a row)은 커서가 나무 질감 이미지 스킨(`app/public/skins/*.png`) 적용, 나머지는 `data-skin-stage`/`data-skin-object` 속성만 마킹돼 있어(시각 변화 없음) 나중에 이미지 스킨을 씌우기 쉽게 준비만 된 상태.
  - **31~32번 (`category: vocabulary`, 사진 업로드 필요)**: `/games/labeleddiagram` 명칭이 있는 다이어그램(사진 위 핀에 정답 이름 매칭), `/games/imagequiz` 이미지 퀴즈(흐린 사진이 점점 선명해지며 정답 맞히기). 둘 다 선생님이 직접 사진을 올린다 — `GameImagePicker.tsx` + `game-images` 스토리지 버킷(`supabase/011_game_images.sql`, `game-audio`와 동일한 RLS 패턴). **AI 이미지 생성이 아니라 파일 업로드**이므로 별도 이미지 생성 도구 불필요.
  - **33~34번 (`category: vocabulary`, 기존 퀴즈 변형)**: `/games/gameshowquiz` 게임쇼 퀴즈(청/홍팀 대결, 보너스 문제 2배 점수, 팀당 반반(50:50) 라이프라인), `/games/winlosequiz` 퀴즈를 이기거나 잃기(문제마다 점수 베팅, 맞으면 획득·틀리면 손실). 둘 다 `Quiz.tsx`의 `QuizQuestion`(질문+보기+정답) 구조를 그대로 재사용 — `config.questions`만 공유하고 나머지(팀 점수·베팅·라이프라인)는 컴포넌트 자체 상태.
  - **36번 대회 퀴즈쇼(`/games/quizshow`, 2026-09-26)**: 보카 대회용 실시간 퀴즈. 칠판(`QuizShowHost`)에 QR·6자리 입장 번호 → 학생은 휴대폰 `/join/:code`(`LiveJoinPage`, **로그인 없이 닉네임만**, `App.tsx`가 인증 확인보다 먼저 처리)로 들어와 4지선다·O·X·철자 쓰기(주관식)·스피드 부저로 답한다. 문제는 `config.liveQuestions`(`LiveQuestion`, 라운드 이름이 바뀌면 칠판에 라운드 소개), 단어장 하나로 4라운드 자동 생성(`lib/liveQuiz.ts`의 `buildContestQuestions`, 게임 슬라이드 자동 생성도 같은 함수). DB는 `supabase/028_live_quiz_show.sql`(`live_sessions`/`live_players`/`live_answers`) — 학생은 테이블을 직접 못 읽고 security definer 함수(`live_join`/`live_state`/`live_submit`)로만, 정답은 공개 전까지 학생에게 안 간다. 빠르기 점수·부저 순서는 서버 시계 기준. 선생님 칠판은 RLS로 직접 읽고 실시간 구독(+3초 폴링), 학생 폰은 방송 신호 + 2초 폴링. 주관식은 같은 답끼리 묶어 "정답 인정", 부저는 누른 순서대로 정답/오답 판정, 이상한 닉네임은 내보내기. 같은 템플릿의 열린 대회(3시간 안)는 다시 들어오면 이어서 진행. 학생 화면이지만 앱·계정 없이 수업 중에만 쓰는 화면이라 룰 1(학생 UX 안 키움)의 예외로 사용자와 합의.
  - 각 게임 페이지 상단에 `GameInfoPanel`(접이식 "게임 소개 및 방법") — `gameXxx.infoDescription`/`infoSteps` i18n 키, 전부 적용됨
  - **단어장 불러오기(`WordListPicker.tsx`)**: 34개 중 31개(라벨 하나짜리 `GameItem[]` 게임
    21개 + 단어+뜻 짝 게임 4개[매치업·두더지잡기·플래시카드·답 입력하기] + 이미지 퀴즈 +
    오지선다 4개[퀴즈·참거짓·게임쇼 퀴즈·퀴즈를 이기거나 잃기] + 그룹정렬)에 적용 완료 —
    `/wordlists`에서 만든 단어장을 게임 항목으로 그대로 불러온다. 오지선다 4개는 AI 없이
    자동 생성(`quizFromWordList.ts`의 `buildQuizQuestions`/`buildTrueFalseStatements` — 같은
    단어장의 다른 단어 뜻/단어를 무작위로 오답·거짓 문장 재료로 씀; 퀴즈·게임쇼 퀴즈·퀴즈를
    이기거나 잃기는 셋 다 `QuizQuestion[]`이라 `variant="quiz"` 그대로 공유). 그룹정렬은
    `buildGroupSortGroups`가 `word_bank.category`(사전에서 담은 단어만 있음, 직접 입력은
    없음)로 자동 그룹화 — 카테고리가 2개 이상 섞인 단어장만 고를 수 있고, 이미 있는 그룹과
    이름이 같으면 항목만 이어붙인다(`GroupSortPage.tsx`의 `addGroupsBulk`). 이걸 위해
    `WordListItem`에 `category` 필드 추가(`word_lists` 마이그레이션 불필요, jsonb라 기존
    행은 그냥 `null` 취급). **명칭 다이어그램·문장 만들기·수학 문제** 3개만 남음(구조 자체가
    단어 리스트가 아님, "나중에 같이 생각"으로 사용자와 합의 — 문장 만들기는
    `word_bank.example_sentence` 활용 아이디어 있음) —
    새 게임을 추가할 때 콘텐츠가 `GameItem[]`/`MatchPair[]`/`QuizQuestion[]`/`GroupSortGroup[]`
    모양이면 `useGameTemplates`가 이미 돌려주는 `wordLists`/`wordListsLoading`으로
    `<WordListPicker variant="label|pairs|image|quiz|truefalse|groupsort" .../>` 한 줄만
    추가하면 된다(`WheelPage.tsx`/`MatchupPage.tsx`/`QuizPage.tsx`/`TrueFalsePage.tsx`/
    `GroupSortPage.tsx`의 기존 적용 예 참고).
  - **오지선다 게임(퀴즈·참거짓·게임쇼 퀴즈·퀴즈를 이기거나 잃기) 공통 버그 패턴**: `Quiz.tsx`/
    `TrueFalse.tsx`/`GameShowQuiz.tsx`/`WinLoseQuiz.tsx`/`ImageQuiz.tsx` 전부 `order`(인덱스
    셔플)+`pos`를 `questions.map(...).join('|')` 키의 `useEffect`로 재동기화하는데, 항목을
    지운 그 순간의 렌더 한 번은 `useEffect`가 아직 안 돌아서 `order[pos]`가 새로 짧아진
    배열 범위를 벗어나 `undefined`가 나올 수 있다(`current.correctIndex` 등에서 크래시,
    2026-09-02에 실제로 재현·수정함) — `const current = questions[order[pos]]; if (!current) return null;`
    가드가 5개 파일 전부에 있어야 한다. 새 오지선다류 게임을 이 패턴으로 만들 때 잊지 말 것.
  - **전체화면·다시하기(2026-09-03)**: 34개 게임 페이지 전부가 플레이 영역을 `GameThemeFrame`
    으로 감싸고 있다는 공통점을 이용해, `GameThemeFrame.tsx` 한 곳만 고쳐서 우측 상단에
    전체화면 토글(Fullscreen API)과 다시하기 버튼을 얹었다 — 전자칠판에서 화면이 작아 보이고
    선생님 실수 시 되돌릴 방법이 없다는 사용자 피드백에서 나옴. "다시하기"는 게임마다 내부
    상태 모양이 다 달라서 게임별로 리셋 로직을 새로 짜는 대신, **각 페이지에 `roundKey`
    state를 추가하고 실제 게임 컴포넌트에 `key={roundKey}`를 줘서 버튼 클릭 시
    `setRoundKey((k) => k + 1)`로 컴포넌트를 통째로 리마운트시키는 방식**으로 통일함(리액트
    key 변경 시 전체 리마운트되는 성질 이용 — 게임 컴포넌트 내부를 하나도 안 건드림). 새 게임을
    추가할 때도 `<GameThemeFrame onRestart={() => setRoundKey((k) => k + 1)}>` +
    `<게임컴포넌트 key={roundKey} .../>` 패턴만 따라하면 자동으로 두 기능 다 적용됨. **"한 수만
    되돌리기"(undo)는 별도**로 논의해 턴제로 점수·상태가 누적되는 8개(틱택토·4 in a row·
    베스킨라빈스31·게임쇼퀴즈·퀴즈이기거나잃기·매치업·두더지잡기·행맨)만 필요하다고
    사용자와 합의, 2026-09-03에 구현 완료. `GameThemeFrame`에 `onUndo?` prop 추가(있으면
    되돌리기 버튼도 뜸, 없으면 34개 중 나머지 26개처럼 그냥 안 보임) — 다시하기와 달리
    `key` 리마운트로는 "한 수만"을 표현할 수 없어서(리마운트는 전체 리셋), 8개 게임
    컴포넌트가 각자 `forwardRef` + `useImperativeHandle`로 `undo(): void`를 노출하고
    (`UndoHandle` 타입, `types.ts`), 페이지가 `useRef<UndoHandle>(null)`을 만들어
    게임 컴포넌트에 `ref={gameRef}`, `GameThemeFrame`엔 `onUndo={() =>
    gameRef.current?.undo()}`로 연결한다. 되돌릴 수 있는 "한 수"의 정의는 게임마다 다르고
    각 컴포넌트 안에 점수/보드에 영향을 주는 딱 하나의 함수(틱택토 `claim`, 게임쇼퀴즈
    `selectChoice` 등) 직전에 그 함수가 바꾸는 state만 골라 `prevSnapshot`으로 스냅샷 1개만
    저장했다가 `undo()`가 그걸로 복원하는 방식 — 히스토리 스택이 아니라 "바로 직전 한 번"만
    되돌아간다(다시 시도하면 스냅샷이 덮어써짐). 새 라운드/재시작 시 반드시 `prevSnapshot`도
    같이 `null`로 초기화해야 함(안 하면 라운드 경계를 넘어 되돌아가는 버그).
- **옛 .png 그림 주소**: 사전·파닉스 그림은 017에서 WebP로 바뀌었지만 단어장·게임 내용·수업은 그림 주소를 복사해 두어 옛 `.png`가 남아 있을 수 있다 — `api.ts`의 `fixLegacyImageUrls`가 word_lists·game_templates·curriculum_lessons를 불러올 때 `/word-bank-images|phonics-images/*.png`를 `.webp`로 고친다(저장 데이터 정리는 `supabase/027`). 새로 그림 주소를 복사해 저장하는 기능을 만들 때 참고.
- `/wordlists` (네비 라벨 "내 단어장") — 선생님이 반/학원별로 만드는 단어장(`word_lists` 테이블,
  `word_bank`/`phonics_bank`와 달리 **쓰기 가능**, `game_templates`와 같은 academy/class 스코프
  패턴). 단어를 "직접 입력"하거나 "사전(`word_bank`)에서 선택"으로 담는다 — 사전에서 담으면
  `image_url`이 같이 복사돼서 이미지 필요한 게임(이미지 퀴즈)에도 쓸 수 있다. `WordListsPage.tsx`.
- `/materials` (네비 라벨 "수업 자료실") — 단어 목록으로 만드는 인쇄물: 플래시카드 인쇄(`FlashcardPrintPage`, A4에 2·4·6·8·12장, 그림/단어/뜻 토글, 컬러/흑백)·워크시트·빙고판·메모리 카드. 목록은 `materialsCatalog.ts` 한 줄 + `App.tsx` 라우트. **"골라서 바로 인쇄" 흐름(2026-09-20)**: `/dictionary`·`/phonics` 카드 왼쪽 위 체크(`CardSelectToggle`) → 하단 `WordSelectionBar` → `MaterialsLaunchButtons`가 자료실 4종으로 `navigate(path, { state: { materialsWords } })`(`materialsHandoff.ts`). `/wordlists`에도 목록별 "인쇄물 만들기" 버튼이 같은 버튼 묶음을 쓴다. 자료실 페이지는 `useState(() => wordsFromLocationState(location.state))`로 넘겨받은 단어로 시작. 선택은 페이지 상태라 카테고리/단계를 바꿔도 유지되고, 전역 스토어는 쓰지 않는다(옛 선택이 몰래 남는 걸 피함). **워크시트 유형 6종(2026-09-20)**: `WorksheetPrintPage` 탭에 선 잇기·낱말 찾기·글자 순서 바꾸기·빈칸 채우기·분류하기·오려 붙이기 추가 — 문제 생성은 `lib/worksheetGenerators.ts`(seed 고정 난수라 미리보기=인쇄, "다시 섞기"는 seed만 바꿈, 글자 유형은 `gameText.ts` 규칙), 화면은 `components/worksheets/WorksheetSheets.tsx`, 정답지는 마지막 장으로 붙는다. `FullCardItem.category`(사전·단어장에서 담을 때만)가 분류하기의 기준. **색칠하기 탭**: 색칠용 선화(`public/word-bank-lineart/<id>.webp`, 커서가 `CURSOR_LINEART_HANDOFF.md`로 제작, 견본 화풍 `app/scripts/vocab/ref/lineart-style-sample.webp`)와 주제별 장식 부품(`.../decor/<id>.webp`)을 코드가 A4로 조립(제목·단어 라벨·쓰기 줄은 앱이 그림, 그림엔 글자 없음). 어떤 선화가 있는지는 `scripts/vocab/lineart-manifest.mjs`가 `src/lib/lineartManifest.ts`(자동 생성)로 뽑고 predev/prebuild가 자동 재생성 — 커서가 선화를 더 만들면 dev/build를 다시 돌리면 반영. 선화가 없는 단어는 이 유형에서 빠지고 화면에 알린다. **주제별 워크시트 라이브러리(`/materials/library`, `WorksheetLibraryPage`)**: 사전 카테고리(단어 탭만)를 고르면 `topicWorksheets.ts`의 `pickRecommended`가 그림·선화가 있는 단어를 우선해 6~12개를 추천(seed로 다시 뽑기, 난이도 칩, 단어 눌러 넣고 빼기)하고, 유형 카드를 누르면 `navigate('/materials/worksheet', { state })`로 단어·탭·색칠 제목(`TOPIC_TITLES`)·장식 주제(`decorThemeFor`)를 넘긴다(`MaterialsHandoffState.materialsTab` 등, 워크시트 페이지가 초기값으로 사용). 유형별로 쓸 수 있는 단어 수를 보여주고 0이면 막는다. **2차 유형 3종**: 문장 순서 바꾸기(예문 3~9낱말, `FullCardItem.example`은 사전에서 담을 때만)·객관식(그림→단어, 그림 없으면 단어→뜻, 보기 3개는 세트 안 다른 단어에서)·참·거짓(그림+단어 짝이 맞는지 T/F, 절반씩 배정) 추가 — 문장 빈칸형 객관식은 같은 주제 단어끼리 보기가 겹쳐 정답이 여러 개가 될 수 있어 일부러 안 했다. **3차 유형 4종**: 미니북(가로 A4 한 장을 접어 8쪽 책 — 위 줄 180° 회전 배치, 가로 인쇄는 `@page landscape-sheet`/`.print-landscape`, 화면은 `.landscape-preview` zoom)·짝 인터뷰(Ask & Answer, 질문 틀 like/have/see)·보드게임(5×6=30칸 뱀 모양, 특수 칸 5개, 단어 3개 이상)·문장 읽고 잇기(예문↔그림, 사전에서 담은 단어만). 미니북·보드게임 제목은 색칠하기 제목 입력칸과 같은 값(`coloring.title`)을 쓴다. **인쇄물은 전부 A4 기준(사용자 결정, 학원 대부분이 A4로 뽑는다)**: 전역 `@page { size: A4; margin: 12mm }`(`tailwind.css`)이라 세로 페이지의 내용 높이는 **273mm 이내**여야 한다(넘으면 다음 장으로 밀려 빈 장·잘림이 생긴다). 미니북만 `landscape-sheet`(A4 가로, 내용 190mm 이내). 워크시트 유형 이후 글씨·그림 크기·페이지당 개수를 바꿀 때는 모든 유형(`NEW_WORKSHEET_KINDS`)을 긴 단어·많은 단어로 렌더해 각 `.print-board` 높이(mm)를 재서 확인한다(2026-09-21 점검: 참·거짓 8→6개, 글자 찾기 칸 폭 자동 축소로 수정). **파닉스 워크시트는 일반 단어·숙어 워크시트(`/materials/worksheet`)와 화면·코드를 분리해 개발한다(2026-09-21 사용자 결정)** — 파닉스 전용 유형·귀여운 스타일은 `/materials/phonics`에서만 다루고, 일반 워크시트 페이지에는 파닉스 탭이 없다(`PHONICS_KINDS`를 `TABS`에서 뺌). 파닉스 페이지는 유형을 눌러도 이동하지 않고 같은 페이지 아래 작업 영역에서 옵션(정답지·컬러·그림·뜻·다시 섞기)·미리보기·인쇄까지 한다. 학생용 페이지 높이는 A4 한 장(262mm)을 넘지 않게 `PHONICS_PER_PAGE`(빈칸 3·찾기 4·다른 하나 3·라임 5·목록 4/6·사선지 2)로 맞춤 — 글씨·그림을 키우면 이 값을 다시 재야 한다. **파닉스 워크시트(2026-09-21)**: `/materials/phonics`(`PhonicsWorksheetLibraryPage`, 자료실 카드 + `/phonics` 페이지 헤더 버튼 + 파닉스 선택 바의 "파닉스 워크시트" 버튼)에서 단계·소리 규칙을 고르면 규칙을 골고루 섞어 추천(`pickBalanced`)하고, 유형을 누르면 `/materials/worksheet`로 넘어간다. 파닉스 전용 4종은 `worksheetGenerators.ts`(`buildPhonicsBlankPages`/`buildPhonicsCirclePages`/`buildOddPages`/`buildRhymePages`) + `WorksheetSheets.tsx` — 규칙 글자 빈칸(`pattern_marked`의 {} 만 비움)·규칙 글자 동그라미·다른 하나 찾기(같은 소리 3 + 다른 소리 1)·라임 잇기(끝 2~3글자 같은 쌍), "소리별 분류"는 기존 분류하기에 `category = rule`을 넘겨 재사용. 파닉스 카드는 `FullCardItem.patternMarked`+`category(=rule)`를 갖고, 이게 있어야 워크시트 화면에 파닉스 탭 4개가 보인다. `lib/phonicsPattern.ts`가 `pattern_marked` 파서. 파닉스 단어 색칠용 선화 92개는 `CURSOR_LINEART_HANDOFF.md`의 "파닉스" 카테고리(제작 대기). **I Can Read 읽기 카드(파닉스 전용, 2026-09-21)**: 목표 단어 위에 크게, 왼쪽에 문장을 한 낱말씩 쌓은 줄, 오른쪽에 그림 칸(직접 그리기/파닉스 그림/없음), 맨 아래 점선 따라쓰기 문장 한 줄 — 한 장에 카드 2개(`PHONICS_PER_PAGE.reader`). 문장은 자동 생성이 아니라 **검수된 데이터**(`src/data/cvcReaders.json`, CVC 67개: 번호 순서대로 앞에서 배운 단어·Heart Words(the/a/is/on/in/can/has)·도우미(sat/mat)만 쓰게 한 통제된 문장)이고, 수정하면 반드시 `node app/scripts/vocab/validate-cvc-readers.mjs`를 돌린다(안 배운 낱말·목표 단어 누락 검출). 선생님이 "cat: The cat is on the mat."처럼 직접 입력한 줄도 같은 카드로 만든다(`lib/cvcReaders.ts`의 `parseCustomReaders`). 렌더는 `PhonicsCuteSheets.tsx`의 `ReaderCute`. 이 문장들은 나중에 문장 순서 바꾸기·미니북·문장 만들기 게임에도 재사용할 수 있다. **귀여운 스타일(파닉스 학생용 페이지, 2026-09-21)**: `components/worksheets/CuteStyle.tsx`(페이지 테두리·리본 제목·별 칸·해/구름/꽃 장식) + `cuteTheme.ts`(파스텔 팔레트·글꼴 Fredoka/Andika) + `PhonicsCuteSheets.tsx`(빈칸·찾기·다른 하나·라임). 글씨 약 60px·그림 32mm로 크게, 정답지는 선생님용이라 담백한 기존 스타일. "컬러로 인쇄" 체크(`cuteColor`)를 끄면 흑백에 맞는 모양. 한 장에 들어가는 개수는 `PHONICS_PER_PAGE`. 마스코트·리본·스티커·말풍선·테두리 그림 57장은 커서가 `CURSOR_DESIGN_BRIEF_PHONICS.md`대로 제작 완료(`app/public/worksheet-cute/<id>.webp`, 흑백판 `-bw`, 경로는 `cuteTheme.ts`의 `cuteAsset()`). **연결된 것**: 머리글(Ollie·Pip + `ribbon-blue` 제목 배경), 바닥글(`ollie-thumbsup`), 네 모서리(`corner-flowers/stars`를 뒤집어 배치 — 사용자 결정으로 테두리 이미지 `frame-a4`는 안 씀, 안쪽 공간이 줄어서). **아직 안 쓴 것**: 나머지 마스코트 포즈, 스티커 8종, 말풍선 3종, `frame-a4`(415KB, 안 쓰면 지워도 됨) — 정답 칭찬·안내 말풍선 등에 쓸 수 있다. 다른 워크시트에도 적용하려면 같은 `Cute*` 컴포넌트를 쓰면 된다. 다음 단계: 기존 유형의 선화 모드, 크로스워드. 참고 사이트(잉글리시 플러스·티처플러스·Twinkl)의 그림·문구·레이아웃은 저작권상 쓰지 않는다(유형 아이디어만 참고). 다음 단계 후보: 미니북, 그래픽 오거나이저 서식.
- `/curriculum` (네비 라벨 "내 수업", 2026-09-26에 "내 커리큘럼"에서 바꿈 — 사용자가 가장 많이 쓸 핵심 기능) — 캔바식 슬라이드 빌더(`LessonSlideSorter.tsx`, 이미지·유튜브·게임·수업 자료실). **준비는 편집 화면에서 끝내고, "발표하기" 뒤엔 수업만 한다(2026-09-25 사용자 결정).**
  - 발표 중 = `usePresenting()`(`LessonRunnerContext`, `runner != null`, 전체화면 여부 무관). 발표 중엔 `AppLayout`이 사이드바·상단바를 걷어내고 진행바(`LessonRunnerBar`) + 슬라이드만 그린다. "수업 마치기"로만 빠져나간다.
  - 편집 UI는 `<EditOnly>`로 감싼다(발표 중 null). 게임 35종은 뒤로가기·`classPicker`·`templateRow`가 `EditOnly`, `GameInfoPanel`은 스스로 숨고, `useGameTemplates`가 발표 중 `isStaff`를 false로 돌려줘서 편집 패널·게임판 안 편집·퀴즈 편집 모드가 한 번에 꺼진다. **새 게임 페이지를 만들 때도 같은 패턴을 따를 것.**
  - **게임 슬라이드 편집 = 게임 센터 설정 화면 그대로(2026-09-26)**: `GameSlideEditor`가 `lib/gamePages.ts`(게임 경로→페이지 컴포넌트, **새 게임 추가 시 여기도 한 줄**)의 페이지를 `GameEmbedContext`로 감싸 띄운다. `useGameTemplates`가 이 컨텍스트를 읽어 반은 레슨 반으로 고정, 처음 템플릿은 슬라이드 `templateId`, 고른 템플릿은 `onSelect`로 슬라이드에 되돌린다. 편집 화면을 떠나게 하는 UI(게임 목록 링크·`ClassChipRow`·`OpenInOtherGame`)는 `.game-embed` CSS로 숨김(`data-class-chip-row`/`data-open-other-game`).
  - **카드로 외우기 슬라이드(`kind: 'study'`, 2026-09-26)**: 단어 사전의 `FlashcardStudy`를 `inline`(부모 칸 꽉 채움, 닫기 버튼 없음)으로 띄운다. 카드는 수업 단어장 — 러너가 `navState.materialsWords`로 넘기고 `LessonSlideViewerPage`가 읽는다. 옵션은 `shuffle`(섞어서 시작)뿐. 게임 센터의 플래시카드 게임과는 별개로 둘 다 유지.
  - **편집·발표 흐름(2026-09-26)**: 슬라이드 상세 머리줄의 "이 슬라이드부터 발표"는 저장(`saveLesson`, 폼은 안 닫음) 뒤 `start(..., { startSlideId, returnToEdit: true })` — `RunnerStep.slideId`로 시작 단계를 찾고, "수업 마치기"를 누르면 `exit`가 `/curriculum`에 `{ reopenLessonId, reopenSlideId }`를 넘겨 마지막으로 보던 슬라이드가 선택된 편집 화면으로 돌아온다. 레슨 카드의 슬라이드 아이콘을 누르면 그 슬라이드부터 시작. 편집 중 바뀐 게 있으면 취소할 때 확인. 발표 중 **PageDown/PageUp(클리커)**은 러너가 다음/이전 슬라이드로 — 슬라이드 안에 단계가 있는 화면(문법 예문 하나씩, 카드로 외우기)은 capture 단계에서 먼저 받아 처리하고 전파를 막으며, 단계를 다 넘기면 흘려보내 다음 슬라이드로 간다(PPT 애니메이션처럼). **새 "단계 있는" 슬라이드를 만들 때도 이 패턴을 따를 것.** 슬라이드 레일은 `lg` 미만에서 위쪽 가로 줄(편집 칸을 넓게), 썸네일은 문법=미니 칠판·게임=표지 그림.
  - 발표 화면 옮기기(`PresentZoomArea`): 터치는 두 손가락, 마우스는 **스페이스바를 누른 채 끌기**(손바닥 커서 `.present-pan-ready/-grabbing`) 또는 **휠 버튼 끌기**. 확대됐으면 확대 화면을, 아니면 긴 슬라이드를 스크롤. 스페이스를 짧게 눌렀다 떼면 원래 스페이스 동작으로 다시 보내 준다. 그래서 슬라이드 안 키 처리(문법·카드)는 `document` capture로 듣고, `PresentZoomArea`는 `window` capture로 먼저 받는다(순서가 등록 시점에 좌우되지 않게).
  - **PPT처럼 넘기기(2026-09-26)**: 발표 중 그림·직접 만들기·문법·노래·지문·카드로 외우기(`PPT_KEY_KINDS`)에서는 Space·Enter·→·↓·N = 다음, ←·↑·Backspace·P = 이전, 화면 클릭 = 다음(버튼·링크·카드는 제외, 확대 중 제외, 더블클릭 확대와 구분하려고 260ms 기다림). 러너가 이 키들을 PageDown/PageUp으로 바꿔 다시 보내서 슬라이드 안 단계가 먼저 받는다. 게임·영상·워크시트·웹페이지는 그 키·클릭이 화면 조작이라 제외(클리커 PageDown/PageUp만).
  - **다른 반으로 복사(2026-09-26)**: 레슨 카드의 복사 버튼 → 여러 반 선택 → `lib/copyLesson.ts`의 `copyLessonToClass`. 반 전용 단어장·게임 내용(game_templates)은 그 반 것으로 같이 복사해 id를 바꾸고(학원 공용·같은 반 것은 그대로 연결), 슬라이드 id는 새로 만든다. 복사본은 원본과 따로 고친다. 올린 그림 파일은 여러 수업이 같이 쓰므로 **슬라이드를 지워도 스토리지 파일은 지우지 않는다**(편집 취소 시 되살아나는 문제도 같이 해결).
  - **수업 만들기 = 모든 메뉴의 허브(2026-09-27 사용자 방향: 가장 많이 쓸 기능, 통장·게임·사전·파닉스·문법·단어장·자료실이 전부 여기서 설정·진행돼야 한다)**:
    - 단어장: 수업 화면·슬라이드 패널의 "새 단어장 / 단어 고치기"(`LessonWordListModal`, 내 단어장의 `WordListEditor` 재사용, 새 단어장은 수업 반으로). 슬라이드 패널 곳곳의 `WordListSelect`는 `WordListManageContext`로 창을 연다.
    - 파닉스: `WordListItem.patternMarked`(파닉스에서 담을 때 복사) → 카드로 외우기·단어 소개가 규칙 글자 강조(`PhonicsMarkedWord`). 예전 단어장은 `lib/phonicsFill.ts`가 파닉스 자료에서 채움 — 기본은 category(소리 규칙)까지 같은 것만(사전 단어 "cat"에 강조가 붙지 않게), 파닉스 워크시트는 `loose`.
    - 자료실 슬라이드: 파닉스 워크시트(`materialId 'phonics'`)는 `PhonicsSlideDetail`에서 유형(`PHONICS_SLIDE_TABS`)·단어·옵션(`phonicsOptions`)을 정하고, 발표 중 `PhonicsWorksheetLibraryPage`가 `usePresenting()`이면 고르는 화면 없이 시트 + `PresentPrintBar`만. 주제별 워크시트는 따로 슬라이드가 아니라 워크시트 슬라이드의 "단어: 사전 주제에서 고르기"(`LessonWordSources.tsx`의 `WordSourcePicker`) — 고른 단어는 `MaterialSlide.words`/`topic`에 저장(수업 단어장 대신 쓰고 색칠 제목·장식 주제도 따라감). 예전 `library` 슬라이드는 러너가 워크시트로 연다.
    - 새 슬라이드 2종: "단어 소개"(`kind: 'wordshow'`, `WordShowBoard` — 단어 하나씩 그림 → 단어(자동 읽기) → 뜻·품사 → 예문, 예문·품사는 `lib/wordBankCache.ts`가 사전에서 채움, 클리커 단계 처리는 문법 슬라이드와 같은 capture 패턴)·"출석 체크"(`kind: 'attendance'`, `AttendanceBoard` — 이름을 누르면 출석부 등원 `checkIn`, 다시 누르면 `clearCheckIn`). 둘 다 `PPT_KEY_KINDS`.
  - **종류 바꾸기·되돌리기(2026-09-26)**: 슬라이드 상세 머리줄 "종류 바꾸기"는 추가 패널을 바꾸기 모드(`replaceTargetId`)로 열어, 고른 슬라이드가 그 자리에 들어간다(`placeSlides`). 레일 위 되돌리기/다시하기(Ctrl+Z·Ctrl+Y, 입력칸·직접 만들기 편집기가 먼저 처리한 키는 건너뜀)는 `LessonSlideSorter`의 `onChange` 래퍼가 슬라이드 목록을 기록한다 — 같은 슬라이드 연속 수정은 1.2초 안이면 한 번으로, 방금 넣은 슬라이드가 스스로 채우는 값(게임 슬라이드 템플릿 자동 선택)은 5초 안이면 넣기와 한 번으로 묶는다. 바깥에서 목록이 통째로 바뀌면(초안 불러오기 등) 기록을 비운다. 새 슬라이드 종류를 만들 때 슬라이드를 넣는 곳은 `addSlide`/`placeSlides`를 거칠 것(그래야 바꾸기 모드가 된다).
  - **자동 임시저장(2026-09-26)**: 편집 중 바뀐 내용을 `localStorage`(`classbank.lessonDraft.<academyId>`, 학원당 하나)에 400ms 모아 저장 → 편집 화면이 닫혀 있을 때 "저장하지 않은 수업이 있어요 — 이어서 만들기/버리기" 배너(다른 반 초안이면 그 반으로 옮긴 뒤 연다). 서버 저장은 "저장"을 눌렀을 때만(자동 서버 저장은 새 수업·게임 내용이 저절로 생겨서 안 함). 저장 성공·취소 확정 시 초안 삭제, 바뀐 게 있으면 탭 닫기/새로고침에 `beforeunload` 경고. BrowserRouter라 앱 안 이동을 막는 `useBlocker`는 못 쓴다 — 초안이 그 역할.
  - 진행바 "화면 맞춤"(`PRESENT_FIT_EVENT`): 긴 슬라이드는 한 화면에 들어오게 축소, 아니면 100%. 두 번 탭·더블클릭 확대(2.5배)/원래대로는 그림·직접 만들기·문법 슬라이드만(`DOUBLE_TAP_KINDS`, 게임 조작과 안 겹치게).
  - **노래·지문 슬라이드(`kind: 'reading'`, 2026-09-26)**: 원문 형식 `[분:초] 영어 | 해석`(`lib/readingLines.ts`, `**낱말**`=강조·빈칸), 모드 `lines`(한 줄씩, 클리커로 다음 줄→끝나면 다음 슬라이드, 해석 토글, 읽어주기, 영상 그 시점 재생)·`cloze`(빈칸 듣기, 빈칸 눌러 하나씩/정답 보기). `ReadingBoard`. 가사 원문은 그 수업 안에만 저장(공용 자료로 모으지 않음, 저작권). 다음 단계: AI 원문 분석이 이 형식을 채우고 → AI 수업 조립(질문: 대상·시간·출발점·스타일·외부 사이트 사용 여부·교실 환경).
  - 문법 슬라이드 옵션: `showKo`(해석 켠 채 시작)·`revealAll`(예문 처음부터 모두). 칠판 글자 크기는 `GrammarBoard`가 문장·해석이 몇 줄로 접힐지 글자 수로 어림해 가장 크게 맞추고, 한 단으로 3.6cqh 미만이면 두 단(왼쪽 단 먼저). 칠판 "설명" 화면은 이럴 때 써요·쉽게 이해하기·한 줄 정리를 두 단으로. 127개 전부 예문·해석·틀리기 쉬운 것·설명 화면이 넘치지 않는지 확인함(바꿀 때 다시 확인할 것).
  - 게임 슬라이드는 `GameSlide.templateId`(game_templates)로 내용을 미리 정한다. 안 고르면 저장할 때 수업 단어장으로 자동 생성(`lib/gameFromWords.ts`의 `buildGameContent` — 게임별로 채우는 필드가 다름, **새 게임 추가 시 여기 한 줄**). 발표 중 이동은 `navState.openTemplateId/openClassId` → `useGameTemplates`가 `location.key`마다 다시 읽어 같은 게임이 연속 슬라이드여도 맞는 템플릿을 연다.
  - 자료실 4종(워크시트·플래시카드 인쇄·빙고·메모리 카드)은 발표 중 + 단어가 있으면 편집 블록 대신 `PresentPrintBar`(인쇄·다시 섞기)만. 단어는 레슨 단어장이 `materialsWords`로 넘어온다.
  - **직접 만들기 슬라이드(`kind: 'canvas'`, 2026-09-25)**: PPT처럼 글상자·그림을 자유 배치. 좌표는 16:9 무대 기준 %, 글자 크기는 `cqh`(무대 높이 %)라 썸네일·편집·발표 어디서든 같은 비율. 렌더는 `CanvasSlideView.tsx`(공용), 편집은 `CanvasSlideEditor.tsx`(끌어 이동·8방향 크기·두 번 눌러 글자 수정·Ctrl+Z·붙여넣기/끌어놓기 업로드·단어장 단어 넣기). 이미지 슬라이드는 "편집 슬라이드로 바꾸기"로 배경 그림이 있는 canvas가 된다. 썸네일을 누르면 추가 패널이 닫히고 바로 그 슬라이드 미리보기. 복사·붙여넣기는 슬라이드를 넘나들고(모듈 변수 + 클립보드 마커), 되돌리기 기록은 슬라이드별(`historyBySlide`), 글상자는 글이 넘치면 높이가 자동으로 늘어난다. **정렬(2026-09-26)**: Shift·Ctrl+클릭으로 여러 개 선택(`multiIds`), Ctrl+A 모두, 함께 끌기·화살표·삭제, 정렬 6종(하나면 슬라이드 기준, 여럿이면 고른 영역 기준)·간격 똑같이(3개 이상). **글꼴**: 구글 폰트는 처음 쓰일 때 받아져서 입력칸이 대체 글꼴로 보이다가 다른 곳을 누르면 바뀌어 보였다 — 편집기를 열 때 `preloadBoardFonts()`(`boardThemes.ts`)로 미리 받고, 입력칸은 글꼴을 다 받으면 다시 그리며 보기 화면처럼 세로 가운데로 둔다.
  - **배경 테마(`lib/boardThemes.ts`)**: 녹색·검은 칠판, 화이트보드, 줄 공책, 모눈종이, 파스텔. 배경마다 기본 글자색·글꼴(칠판·공책은 손글씨 Gaegu)·크기가 정해져 있어 새 글상자가 따라가고, 배경을 바꾸면 기본값 그대로인 글자만 따라 바뀐다(직접 바꾼 색은 유지). 워크시트 슬라이드도 `MaterialSlide.boardTheme`(새 슬라이드 기본 화이트보드) → `materialsBoardTheme` → `WorksheetPrintPage`가 발표 중에만 칠판 바탕을 깐다. 색은 앱 토큰(`--color-*`/`--text-*`)을 `[data-board-text]` 블록(단어 리스트·그림 카드·사선지·시험지처럼 종이 없는 유형)에서만 바꾸고 `@media screen`이라 인쇄는 그대로. A4 종이 모양 유형은 종이째 칠판 위에 올라간다.
  - 포인트: 진행바 "포인트 주기" → `LessonPointsPanel`(여러 학생 선택 → 프리셋 지급, 오늘 적립만 표시, 마감이면 막힘, `is_homework` 유지). 반은 `RunnerState.classId`.
- `/results` — 기간별 적립/차감. 학생별 `/results/homework/:studentId` 숙제 캘린더
- `/settings` — 학원·반·프리셋·로고. 게임 센터를 여기 넣지 말 것

로그인 전: `/` 랜딩, `/login` 인증.

---

## 숙제 캘린더 (고객에게 이렇게 설명한다)

통장에서 숙제를 검사하는 **그 버튼**이 기록을 남긴다.

- 숙제했으면 → **숙제 완료 포인트** → 캘린더에 완료
- 안 가져왔으면 → **미제출 차감 포인트** → 캘린더에 미제출

설정에서 해당 프리셋에 “숙제 캘린더 반영”이 켜져 있어야 한다. 랜딩 카피: `app/src/i18n/locales/ko.ts` `landing.feature4*`.

---

## 랜딩 (2026-08-31)

칭찬모아처럼 **큰 한글 제목 + 문제→해결→비교** 흐름. 내용은 우리 제품만.

- 파일: `app/src/pages/LandingPage.tsx`, `app/src/tailwind.css` (`.landing`, `.landing-display`)
- 카피: `app/src/i18n/locales/ko.ts` / `en.ts` 의 `landing`
- 히어로 그림: `app/public/covers/landing-hero.jpg`
- 용어: 쿠폰 (스티커 금지)
- 가짜 도입 학원 수·가짜 후기는 넣지 않음 (베타)

---

## 경쟁 한 줄

| | 클래스뱅크 | 칭찬모아 |
|---|---|---|
| 본질 | 수업 OS (통장·출석·게임·숙제) | 보상 이행 (기프티콘·마켓데이) |
| 포인트 | 학원 내부 단위. 현금 아님 | 1P = 1원, 선충전 |
| 학생 앱 | 키우지 않음 | 핵심 |

비교 보드(참고): Cursor canvases `classbank-vs-ccmoa.canvas.tsx` (워크스페이스 canvases 폴더, 앱 코드 아님).

---

## 기술

- `app/` — React 19 + Vite + TypeScript + Tailwind 4 (`app/src/tailwind.css`) + react-router + i18next
- Supabase: Postgres + Auth + RLS. 스키마 `supabase/schema.sql`, 이후 번호 마이그레이션 `supabase/00*.sql`
- 포인트는 `transactions` 합. `redemptions` 테이블은 학원 **내부** 상품 교환용으로만 열어 둔 상태(미구현). 쇼핑몰로 확장하지 말 것.
- 게임 CRUD 공통: `app/src/lib/useGameTemplates.ts`
- 다국어: `app/src/i18n/locales/ko.ts`, `en.ts` — UI 문자열은 하드코딩하지 말고 `t()`

로컬 실행: 저장소 루트에서 `npm run dev --prefix app` (루트에 package.json 없음).

---

## 배포 (2026-09-03 전면 교체)

- GitHub: `https://github.com/pointbank2608-commits/pointbank` 브랜치 `main`
- 프로덕션: **https://pointbank-ten.vercel.app**
- Vercel 프로젝트: `pointbank` (팀/스코프 `pointbank2608-1458s-projects`), GitHub 저장소가 **Connect Git Repository**로 연결돼 있어서 **`main`에 푸시만 하면 자동으로 프로덕션 배포된다.** 수동 `vercel --prod` 는 이제 평소엔 필요 없음(자동 배포 실패 시 대비용으로만 아래 명령 사용).
- Vercel 로그인은 **GitHub로**(`npx vercel login`, 브라우저에서 GitHub 선택) — 이 계정이라야 `pointbank2608-1458s-projects` 팀이 보인다.
- **`businessgym11-8014s-projects` 계정/스코프는 완전히 다른 프로젝트다. 여기다 절대 배포하지 말 것.** (2026-09-03: 이 계정으로 여러 차례 정상 배포됐던 `classbank-rho.vercel.app` 은 사용자 확인 결과 실수로 써온 무관한 프로젝트였음 — 폐기, `pointbank-ten.vercel.app` 이 진짜 프로덕션.)

혹시 자동 배포가 막히면(수동 fallback):

```bash
cd app
npx vercel --prod --scope pointbank2608-1458s-projects
```

빌드에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 필요 (로컬은 `app/.env.local`, git에 올리지 않음).

배포 후 Supabase Auth URL Configuration에 프로덕션 주소를 넣어야 메일 링크가 localhost로 안 간다. (`README.md`)

로고 업로드 RLS 문제면 `supabase/009_fix_logo_storage.sql`을 SQL Editor에서 실행 (있으면).

---

## 하지 말 것 / 나중에

- 나머지 워드월 템플릿 변형(매칭 페어류·랜덤카드·속도 정렬·풍선 터트리기·타일 뒤집기 등): 이미 있는 게임(매치업·두 주사위·그룹정렬·플래시카드)과 메커니즘이 사실상 같아 보류 — 새로 만들 가치 낮음.
- 학생 앱, 학부모 알림, 유료화 통계: 보류.
- 선생님별 담당 반 제한: 소규모 학원에선 전체 접근이 편해서 보류.
- `handoff.md`의 “schema.sql 아직 안 돌림” “배포 예정” “게임 내비 맨 끝”은 **구버전**일 수 있음. 의심되면 코드와 이 파일을 우선.

---

## 손대는 파일 빠른 색인

| 하고 싶은 일 | 어디 |
|---|---|
| 랜딩 문구 | `app/src/i18n/locales/ko.ts` `landing` |
| 랜딩 레이아웃 | `app/src/pages/LandingPage.tsx` |
| 게임 목록에 게임 추가 | `app/src/lib/gameCatalog.ts`(카드 자동 반영) + `App.tsx` 라우트(스태프·학생 둘 다) |
| 게임 소개/방법 문구 수정 | 각 게임의 `gameXxx.infoDescription`/`infoSteps` (`ko.ts`/`en.ts`) |
| 게임 비주얼 테마 추가 | `app/src/lib/gameThemes.ts` (`GameThemeFrame.tsx`가 자동 반영) |
| 게임에 사진 업로드 넣기 | `GameImagePicker.tsx` + `uploadGameImage`(`api.ts`) — `game-images` 버킷 재사용 |
| 숙제 연동 | `PassbookCard.tsx`, `ClassBoardPage.tsx`, 프리셋 `is_homework` |
| 숙제 캘린더 UI | `HomeworkCalendarPage.tsx` |
| 내비 | `AppLayout.tsx` |
| 디자인 토큰 | `app/src/tailwind.css` `@theme` |
| 반 선택 칩(선택+드래그 순서변경) | `ClassChipRow.tsx` — 모든 페이지(게임 34종 포함)가 이 컴포넌트 하나를 공유. 새 페이지에 반 칩이 필요하면 `classes.map(...)`으로 새로 만들지 말고 이걸 재사용(`onReorder`는 `useClasses`/`useGameTemplates`의 `reorder`/`reorderClasses`) |
| 단어 사전/파닉스 데이터 추가 | `word_bank`/`phonics_bank` 테이블에 SQL Editor로 직접 insert. 앱에 쓰기 UI 없음(의도적) |
| 새 게임에 단어장 불러오기 추가 | `WordListPicker.tsx` — `useGameTemplates`가 주는 `wordLists`/`wordListsLoading`을 그대로 넘기고 `variant`(`label`/`pairs`/`image`)만 게임 콘텐츠 모양에 맞게 고르면 끝 |
