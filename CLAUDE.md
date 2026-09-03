# 클래스뱅크 — Claude 협업 메모

이 파일을 **현재 진실**로 본다. 초기 히스토리·옛 결정 세부는 `handoff.md`. 설치/스키마 적용은 `README.md`.

마지막 갱신: **2026-09-03** (Claude 세션: 단어 사전(`/dictionary`, 800단어)·파닉스(`/phonics`, 347단어) 공용 데이터 도입, 출석부를 "학생관리"로 확장(반/학생 추가·이름변경·삭제), 반 선택 칩 드래그 순서변경(`ClassChipRow`) 전 페이지 적용, 선생님이 만드는 단어장(`/wordlists`, `word_lists` 테이블) + `WordListPicker` 게임 31종 적용(오지선다 4종 오답/거짓문장 자동생성 + 그룹정렬 카테고리 자동그룹화) + 오지선다 게임 5종 크래시 버그 수정 + 전체화면·다시하기 버튼 게임 34종 전체 적용(`GameThemeFrame`) + 한 수만 되돌리기 8종 적용(`UndoHandle` forwardRef 패턴))

---

## 한 줄

초등 학원·공부방 **선생님용** 포인트 통장. 지급/차감, 출석, 숙제 캘린더, 교실 미니게임이 한 학원 안에 있다. 포인트는 현금이 아니다.

---

## 꼭 지킬 것

1. **선생님 제품이다.** 학생 UX를 키우지 않는다. `/me`·학생 라우트는 남아 있어도 확장하지 않는다. 베타에서는 학생 로그인 잠금 (`006_disable_student_login.sql`).
2. **동작 중인 `/board`(통장), `/attendance`를 목업으로 바꾸지 않는다.** 시각만 손볼 때는 실제 데이터·실제 라우트를 유지한다.
3. **칭찬모아(ccmoa.imweb.me)를 기능으로 따라가지 않는다.** 그쪽은 1포인트=1원, 기프티콘, 마켓데이 물류다. 우리는 수업 중 운영 도구다. 기프티콘 카탈로그·선충전 현금 포인트·여러 학원 포인트 합산은 하지 않는다.
4. **랜딩에서 “스티커”라고 쓰지 않는다. “쿠폰”이다.**
5. **숙제 기록은 별도 입력이 아니다.** 통장의 숙제 완료 지급 버튼 → 캘린더 완료, 미제출 차감 버튼 → 캘린더 미제출. (`presets.is_homework`, `PassbookCard` / `ClassBoardPage`)
6. **새 미니게임**은 네비에 메뉴를 늘리지 않는다. `app/src/lib/gameCatalog.ts`의 `GAME_CATALOG` 배열에 항목 하나만 추가하면 `/games` 카드 목록에 자동 반영된다(`GamesPage.tsx`는 이 배열을 그대로 매핑). `App.tsx`에 스태프·학생 라우트 두 줄 추가는 별도로 필요. `game_templates` + `config jsonb`. `game_type`에 CHECK 없음 → 스키마 없이 종류 추가 가능. 게임마다 `number`(참고용, DB에 저장 안 됨)와 `category`(`simple`/`vocabulary`/`sentence`/`listening`/`reading`/`speaking`)를 붙인다.
7. **오늘 통장 화면은 오늘 적립만 크게.** 누적은 기본 숨김. 마감은 저장이 아니라 확정(`settlements`).
8. **커밋은 사용자가 요청할 때만.** 배포는 `app/`에서 `npx vercel --prod` (아래 배포 참고).

---

## 정보 구조 (로그인 후)

선생님(staff): 사이드/하단 내비 — 대시보드, 학생관리, 통장(`/board`), 게임, 단어 사전, 파닉스, 리포트(`/results`). 기본 진입 `/dashboard`.

- `/dashboard` — 오늘 할 일, 실데이터
- `/attendance` (네비 라벨 "학생관리") — 반 추가, 학생 추가/이름변경/삭제 + 출석부(등원·하원, 월별) 전부 한 페이지. `AttendancePage.tsx`.
- `/board` — 반 통장. 프리셋 버튼으로 지급/차감
- `/dictionary` — 교육부 지정 초등 필수 영단어 800(`word_bank` 테이블, 학원 구분 없는 공용 데이터). 카테고리/품사 필터, 이미지 클릭 시 전체보기. `DictionaryPage.tsx`.
- `/phonics` — 파닉스 5단계 단어 347(`phonics_bank` 테이블, 공용 데이터). 단계 탭 + 소리규칙 필터. 소리규칙 강조는 이미지에 텍스트를 굽지 않고 `pattern_marked`의 `{}` 마커를 앱이 직접 색깔 `<span>`으로 렌더링(`PhonicsPage.tsx`). `word_bank`/`phonics_bank` 둘 다 쓰기는 SQL Editor로만, RLS는 읽기 전용.
- `/games` — 게임 34종 카드. 선생님은 "내 라이브러리"(현재 반에 템플릿이 있는 게임만)/"전체 보기" 탭, 카테고리 필터 탭 + 번호 배지. 전체 목록은 `app/src/lib/gameCatalog.ts`가 단일 소스 — 새 게임은 여기 한 줄 + `App.tsx` 라우트(스태프·학생) 두 줄이면 끝.
  - 1~30번: 돌림판·사다리·랜덤공뽑기부터 미로 찾기·비행기까지(순서/설명은 `gameCatalog.ts` 참고). 1~10번(돌림판·사다리·랜덤공뽑기·시한폭탄·타이머·틱택토·Save or Give it·사라진 항목 찾기·4 in a row)은 커서가 나무 질감 이미지 스킨(`app/public/skins/*.png`) 적용, 나머지는 `data-skin-stage`/`data-skin-object` 속성만 마킹돼 있어(시각 변화 없음) 나중에 이미지 스킨을 씌우기 쉽게 준비만 된 상태.
  - **31~32번 (`category: vocabulary`, 사진 업로드 필요)**: `/games/labeleddiagram` 명칭이 있는 다이어그램(사진 위 핀에 정답 이름 매칭), `/games/imagequiz` 이미지 퀴즈(흐린 사진이 점점 선명해지며 정답 맞히기). 둘 다 선생님이 직접 사진을 올린다 — `GameImagePicker.tsx` + `game-images` 스토리지 버킷(`supabase/011_game_images.sql`, `game-audio`와 동일한 RLS 패턴). **AI 이미지 생성이 아니라 파일 업로드**이므로 별도 이미지 생성 도구 불필요.
  - **33~34번 (`category: vocabulary`, 기존 퀴즈 변형)**: `/games/gameshowquiz` 게임쇼 퀴즈(청/홍팀 대결, 보너스 문제 2배 점수, 팀당 반반(50:50) 라이프라인), `/games/winlosequiz` 퀴즈를 이기거나 잃기(문제마다 점수 베팅, 맞으면 획득·틀리면 손실). 둘 다 `Quiz.tsx`의 `QuizQuestion`(질문+보기+정답) 구조를 그대로 재사용 — `config.questions`만 공유하고 나머지(팀 점수·베팅·라이프라인)는 컴포넌트 자체 상태.
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
- `/wordlists` (네비 라벨 "내 단어장") — 선생님이 반/학원별로 만드는 단어장(`word_lists` 테이블,
  `word_bank`/`phonics_bank`와 달리 **쓰기 가능**, `game_templates`와 같은 academy/class 스코프
  패턴). 단어를 "직접 입력"하거나 "사전(`word_bank`)에서 선택"으로 담는다 — 사전에서 담으면
  `image_url`이 같이 복사돼서 이미지 필요한 게임(이미지 퀴즈)에도 쓸 수 있다. `WordListsPage.tsx`.
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

## 배포 (2026-08-31에 함)

- GitHub: `https://github.com/pointbank2608-commits/pointbank` 브랜치 `main`
- 랜딩 개편 커밋: `06411df`
- 프로덕션: **https://classbank-rho.vercel.app**
- 이 PC Vercel CLI 계정(`businessgym11-8014`)으로는 GitHub 저장소 자동 연결이 **실패**함 (write 권한 없음). **푸시만으로는 재배포되지 않을 수 있다.** 배포 시:

```bash
cd app
npx vercel --prod --scope businessgym11-8014s-projects
```

`--scope` 없이 `npx vercel --prod`만 실행하면 `"Not authorized"` (`deploy_failed`)로 실패할 수 있다(2026-09-01 확인, `vercel whoami`/`vercel project ls`에는 정상적으로 뜨는데도 배포만 막힘) — 스코프를 명시하면 됨.

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
