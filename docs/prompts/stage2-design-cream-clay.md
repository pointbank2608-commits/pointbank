# 클래스뱅크 디자인 개편 — "크림 + 점토 + 제품 화면" 개발 지시서

> 이 문서 전체가 작업 지시입니다. 처음부터 끝까지 읽고 Step 0 → 5 순서대로 진행하세요.
> 저장소는 `C:\Users\likes\Desktop\pointbank` 이고 앱은 `app/` 입니다(React 19 + Vite + TypeScript + Tailwind 4 + react-router + i18next).
> `CLAUDE.md`(프로젝트 규칙)는 이미 읽었다고 가정합니다. 아래 지시와 충돌하면 **이 문서가 우선**합니다.
> 줄 번호·코드 조각은 작성 시점 기준 참고용입니다. **파일을 고치기 전에 반드시 열어서 지금 코드를 확인**하세요.

---

## 0. 목표와 배경

**목표.** 랜딩 페이지와 서비스 안쪽 화면의 분위기를 **"따뜻한 교실 도구"** 로 바꿉니다. 한 줄로: 크림 바탕, 둥근 흰 카드, 점토 일러스트, 그리고 실제 앱 화면을 보여 주는 랜딩.

| 영역 | 방향 |
|---|---|
| 서비스 안쪽(앱) | 크림 바탕 + 부드러운 둥근 카드 + 메뉴 묶음별 색 태그. "오늘" 화면 맨 위에 큰 진입 카드 3개(수업 시작 · 수업 만들기 · 활동지 인쇄) |
| 랜딩 | 크림 바탕 히어로. 왼쪽에 문구·체크리스트 3줄·버튼, 오른쪽에 **코드로 그린 앱 화면 목업**과 점토 소품. 어두운 구간은 한 곳만 남김 |
| 게임 화면 | 칩·소제목에 가벼운 색 포인트만(과하게 장난스럽게 만들지 않는다) |

**배경(조사 결과).** 한국 교육 서비스(클래스카드·칭찬모아·ClassDojo 등)는 보라색 쏠림이 심합니다. 클래스뱅크의 네이비·민트·노랑은 그 사이에서 눈에 띄고, 이미 있는 **점토 그림**(게임 표지·사전 그림·소품)이 가장 큰 차별점입니다. 대상은 30~50대 여성 공부방·교습소 선생님이라 차갑고 어두운 SaaS 느낌보다 문구점·교구 같은 따뜻함이 맞습니다. 다만 유치원 앱처럼 지나치게 아기자기하면 전문성이 떨어져 보입니다.

**이번 작업은 "겉모양 개편"입니다.** 기능·주소·DB는 바꾸지 않습니다. 단, 랜딩 문구 중 **사실과 어긋난 숫자·약속은 고칩니다**(Step 3-6).

---

## 1. 지켜야 할 규칙 (어기면 실패)

1. **라우트 주소·DB·SQL(`supabase/`)·Edge Function·`app/src/lib/api.ts` 는 건드리지 않는다.** `app/src/App.tsx` 도 수정하지 않는다(`git diff --stat` 에 없어야 함). 새 npm 패키지를 설치하지 않는다.
2. **기능을 지우지 않는다.** "오늘" 화면의 기존 블록(출석·통장 요약, 학급 통계, 체크리스트)은 아래로 내릴 뿐 지우지 않는다.
3. 화면 글은 모두 `t()` 로 쓰고 `app/src/i18n/locales/ko.ts` 와 `en.ts` **둘 다** 고친다(`en.ts` 는 `Ko` 타입이라 키가 하나라도 빠지거나 남으면 빌드가 실패한다 — 안전장치). 키 이름은 바꾸지 말고, 새 키는 둘 다에 추가한다.
4. 학생 화면(`/me`, `/s`, `/hw`, `/join`, `/watch`)·관리자 화면(`Admin*`)·약관·방침·환불 페이지·게임 내부 화면(`GameThemeFrame`, 각 게임 컴포넌트의 배경)은 **스타일을 직접 고치지 않는다.** 색 토큰이 바뀌면서 자연히 달라지는 것은 괜찮다.
5. **가짜 후기·가짜 수치를 넣지 않는다**(CLAUDE.md). 숫자는 코드에서 센 값(`GAME_CATALOG.length` 등)만 쓴다.
6. 이모지를 UI에 쓰지 않는다. 아이콘은 이미 쓰는 Material Symbols(`<span className="material-symbols-outlined">`)를 쓴다.
7. **커밋·푸시하지 않는다**(CLAUDE.md 룰 8). 끝나면 변경 파일 목록만 보고한다.
8. 질문하지 말고 이 문서의 기본값으로 정한다. 문서와 코드가 어긋나 정말 진행할 수 없는 항목만 건너뛰고 보고서에 적는다.
9. TypeScript 설정이 엄격하다: `noUnusedLocals`/`noUnusedParameters`(안 쓰는 import·변수는 지운다), `verbatimModuleSyntax`(타입은 `import type`), `erasableSyntaxOnly`(enum 금지). 훅은 조건부 `return` 앞에서만 부른다. 컴포넌트 파일에는 컴포넌트만 `export` 하고 상수·함수는 `app/src/lib/` 에 둔다.
10. 큰 파일(`ko.ts`·`en.ts` 약 6,500줄, `tailwind.css` 약 5,400줄, `LandingPage.tsx` 420줄)은 필요한 부분만 읽는다. `Edit` 할 때는 키 이름까지 포함한 줄처럼 **고유한 문자열**로 바꾼다.
11. 한 Step 이 끝날 때마다 **저장소 루트에서** `npm run build --prefix app` 을 돌려 통과를 확인한다. 개발 서버를 켜 둔 채로 두지 않는다.

**Step 0 (시작 전).** `npm run lint --prefix app` 을 돌려 경고·에러 수를 적어 둔다(끝났을 때 새 에러가 없어야 한다). `git status` 로 이미 수정된 파일이 있는지 본다.

---

## 2. 디자인 기준 (이 값들로 통일)

**색(크림 + 브랜드).** 브랜드 색(네이비 `#1E4B7A`·`#2765A8`, 민트 `#006B5D`, 노랑 `#FFD54F`)은 **그대로** 둔다. 바탕과 경계선만 따뜻하게 바꾼다.

**메뉴 묶음 색 태그** — 사이드바·"오늘" 진입 카드·랜딩 목업이 같은 색을 쓴다.

| 묶음 | 배경 | 글자·아이콘 |
|---|---|---|
| 오늘 | `#FFE9B8` (연노랑) | `#5A4300` |
| 수업 | `#D7E6FA` (연파랑) | `#14375F` |
| 자료 | `#E8E3FF` (연보라) | `#3C3489` |
| 우리 반 | `#FFE0CC` (연주황) | `#7A3E12` |
| 더보기 | `#ECE6DA` (연회색) | `#4A4538` |

**점토 포인트 색**(소품·점·강조에만): 노랑 `#F2B705`, 민트 `#3DBEA8`, 산호 `#E8836A`, 하늘 `#8FB6E8`.

**모양.** 카드 모서리는 16px(`rounded-xl`) 이상, 큰 카드·랜딩 카드는 24~28px. 그림자는 얕고 따뜻하게(`shadow-card`). 주요 버튼은 알약(`rounded-full`)이고 높이 48px(`min-h-12`) 이상. 본문 글자 크기는 바꾸지 않는다.

**한 화면에 강한 색 버튼은 하나.** 주 버튼(네이비 또는 노랑 알약) 하나 + 나머지는 외곽선.

---

## 3. 작업 순서

### Step 1. 디자인 토큰 — 앱 전체 분위기 (`app/src/tailwind.css`)

**1-1. 바탕·표면·경계 색을 따뜻하게.** 맨 위 `@theme { ... }` 의 `--color-*` 값만 바꾼다(이름은 그대로).

| 토큰 | 지금 | 새 값 |
|---|---|---|
| `--color-background` | `#f6faff` | `#FFF8EC` |
| `--color-surface` | `#f6faff` | `#FFF8EC` |
| `--color-surface-bright` | `#f6faff` | `#FFF8EC` |
| `--color-surface-container-low` | `#edf4fc` | `#FBF2E2` |
| `--color-surface-container` | `#e8eff7` | `#F6EBD6` |
| `--color-surface-container-high` | `#e2e9f1` | `#F0E3CB` |
| `--color-surface-container-highest` | `#dce3eb` | `#EADCC1` |
| `--color-surface-variant` | `#dce3eb` | `#EADFC8` |
| `--color-surface-dim` | `#d4dbe3` | `#E2D6BD` |
| `--color-outline-variant` | `#c2c6d2` | `#DDD0B4` |

그대로 두는 것: `--color-surface-container-lowest`(흰색), 모든 `primary`·`secondary`·`tertiary`·`error`·`on-*` 계열, `--color-outline`, `--color-inverse-*`.

**1-2. 새 토큰 추가** (같은 `@theme` 안).

```css
/* 메뉴 묶음 색 태그(사이드바·오늘 진입 카드·랜딩 목업 공용) */
--color-tag-today: #ffe9b8;   --color-tag-today-ink: #5a4300;
--color-tag-lesson: #d7e6fa;  --color-tag-lesson-ink: #14375f;
--color-tag-library: #e8e3ff; --color-tag-library-ink: #3c3489;
--color-tag-class: #ffe0cc;   --color-tag-class-ink: #7a3e12;
--color-tag-more: #ece6da;    --color-tag-more-ink: #4a4538;
/* 점토 포인트 색 */
--color-clay-yellow: #f2b705; --color-clay-mint: #3dbea8;
--color-clay-coral: #e8836a;  --color-clay-sky: #8fb6e8;
/* 카드 그림자(따뜻한 갈색 계열) */
--shadow-card: 0 4px 20px rgba(122, 88, 32, 0.1);
```

그러면 `bg-tag-today`, `text-tag-today-ink`, `bg-clay-mint`, `shadow-card` 같은 유틸리티를 쓸 수 있다.

**1-3. 모서리 반경.** `--radius-lg: 0.5rem` → `0.75rem`, `--radius-xl: 0.75rem` → `1rem`. (`rounded-lg`·`rounded-xl` 이 앱 전체에서 쓰이므로 카드·입력칸이 한꺼번에 조금 더 둥글어진다. `--radius-full` 은 그대로.)

**1-4. 파란 그림자 일괄 교체.** 코드에 `shadow-[0_4px_20px_rgba(39,101,168,0.08)]` 가 약 170곳 있다. 저장소 루트에서 아래 명령으로 `shadow-card` 로 바꾼다(문자열 그대로 치환).

```bash
grep -rl "shadow-\[0_4px_20px_rgba(39,101,168,0.08)\]" app/src --include=*.tsx | xargs sed -i 's/shadow-\[0_4px_20px_rgba(39,101,168,0.08)\]/shadow-card/g'
```

확인: 치환 뒤 `grep -rn "rgba(39,101,168" app/src` 가 거의 없어야 한다(랜딩의 다른 변형 그림자는 Step 3 에서 처리).

**1-5. 하드코딩된 파란 회색.** `app/src/pages/DashboardPage.tsx` 의 출석 도넛 `conic-gradient(#90f1dd …, #e8eff7 0deg)` 의 `#e8eff7` 을 `#f6ebd6` 으로 바꾼다. 그 외 `#f6faff`·`#edf4fc`·`#dce3eb` 같은 옛 값이 `.tsx`/`.css`(토큰 정의 줄 제외)에 남아 있으면 같은 방식으로 따뜻한 값으로 바꾼다(`grep -rn "#f6faff\|#edf4fc\|#e8eff7\|#dce3eb" app/src`).

**1-6. 인쇄는 계속 흰 종이.** `tailwind.css` 의 `@media print { ... }`(약 4970줄)를 보고, 인쇄할 때 바탕이 크림으로 나오지 않게 `html, body { background: #fff !important; }` 가 없으면 더한다.

**1-7. 대비 확인(WCAG AA 4.5:1).** 아래 글자색/바탕색 쌍을 계산해 4.5 미만이면 글자색을 조금 어둡게 고친다(바탕을 다시 바꾸지 않는다). 특히 `--color-outline`(`#727782`)이 `#FFF8EC` 위에서 4.5 미만이면 `#6A6F7A` 로 낮춘다.

```js
// node -e 로 실행 (app 폴더가 아니어도 됨)
const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const R=(a,b)=>{const[x,y]=[L(a),L(b)].sort((p,q)=>q-p);return ((x+.05)/(y+.05)).toFixed(2)};
console.log(R('#151c22','#FFF8EC'),R('#424750','#FFF8EC'),R('#727782','#FFF8EC'),R('#424750','#FBF2E2'),R('#004d8b','#FFF8EC'),R('#5a4300','#ffe9b8'),R('#14375f','#d7e6fa'),R('#3c3489','#e8e3ff'),R('#7a3e12','#ffe0cc'),R('#4a4538','#ece6da'));
```

**1-8. PWA 설정.** `app/public/manifest.webmanifest` 의 `background_color` 를 `#FFF8EC` 로, `name` 을 `클래스뱅크 · 영어 수업 도구` 로, `description` 을 `초등 영어 수업 도구 · 단어장 하나로 게임과 활동지가 바로` 로 바꾼다(옛 "포인트 통장 · 출석 · 미니게임" 문구 제거). `theme_color` 는 그대로.

**완료 기준**: 빌드 통과. 앱 어느 화면을 열어도 바탕이 크림이고 카드는 흰색이며 파란 그림자가 없다. 1-7 의 모든 쌍이 4.5 이상.

---

### Step 2. 서비스 안쪽 — 사이드바 색 태그 + "오늘" 큰 진입 카드

**2-1. 사이드바 묶음 색 태그** (`app/src/components/StaffNav.tsx`).
- 묶음 행의 아이콘을 **36px 원 안**에 넣고, 원 배경·아이콘 색을 위 표(`tag-<id>` / `tag-<id>-ink`)로 칠한다. `id` 는 `NavGroup.id`(`today|lesson|library|class|more`).
- 선택된 묶음 행 배경은 지금의 `bg-secondary-container` 대신 **그 묶음의 태그색**(`bg-tag-<id>`)으로 한다. 선택 안 된 행은 지금처럼 투명 + hover.
- 펼쳐진 하위 항목(`Link`)의 선택 상태는 `bg-tag-<id>/60 text-tag-<id>-ink font-bold`.
- Tailwind 는 클래스 이름을 문자열로 조립(`` `bg-tag-${id}` ``)하면 못 찾는다. **묶음별 클래스를 객체로 전부 적어 둔다**:
  ```ts
  const TAG = {
    today:   { chip: 'bg-tag-today text-tag-today-ink',     row: 'bg-tag-today',     child: 'bg-tag-today/60 text-tag-today-ink' },
    lesson:  { chip: 'bg-tag-lesson text-tag-lesson-ink',   row: 'bg-tag-lesson',    child: 'bg-tag-lesson/60 text-tag-lesson-ink' },
    library: { chip: 'bg-tag-library text-tag-library-ink', row: 'bg-tag-library',   child: 'bg-tag-library/60 text-tag-library-ink' },
    class:   { chip: 'bg-tag-class text-tag-class-ink',     row: 'bg-tag-class',     child: 'bg-tag-class/60 text-tag-class-ink' },
    more:    { chip: 'bg-tag-more text-tag-more-ink',       row: 'bg-tag-more',      child: 'bg-tag-more/60 text-tag-more-ink' },
  } as const;
  ```
- 사이드바 자체(`AppLayout.tsx` 의 `bg-surface-container-low`)는 Step 1 토큰으로 이미 따뜻해진다. 학생 메뉴·모바일 서랍 동작은 바꾸지 않는다.

**2-2. "오늘" 화면 위쪽 재구성** (`app/src/pages/DashboardPage.tsx`).
- 맨 위의 **파란 환영 배너**(`bg-primary text-on-primary …`)를 **크림 노랑 인사 카드**로 바꾼다: `rounded-[28px] bg-tag-today`, 글자 `text-tag-today-ink`, 제목은 기존 `dashboard.greeting`, 아래 줄은 기존 `dashboard.summaryLine`(데이터·로직은 그대로). 오른쪽에 점토 소품 하나(`/skins/chain/star.webp`, 높이 64px, `aria-hidden`, `alt=""`)를 장식으로 둔다.
- 배너 바로 아래에 `TodayLessons`(오늘 수업 카드)를 두고, 그 **맨 위에 큰 진입 카드 3개**를 넣는다(2-3). 그 아래 `OnboardingChecklist` → (기존) "오늘 할 일 + 학급 통계" 블록 → 빠른 실행 3개 순서는 그대로 둔다.
- 지금 있는 "오늘 수업, 여기서 시작하세요" 블록(`classroomUx.lessonTitle` 의 두 버튼 "내 단어장으로 수업 준비 / 게임 둘러보기")은 진입 카드 3개가 대신하므로 **JSX 에서 제거**한다(번역 키는 남겨 둔다).

**2-3. 큰 진입 카드 3개** (`app/src/components/TodayLessons.tsx` 의 맨 위, 카드 목록 위).
- 레이아웃: `grid grid-cols-1 gap-3 sm:grid-cols-3`. 카드는 `min-h-[132px] rounded-[24px] border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-card text-left transition hover:-translate-y-0.5`, **글자가 있는 버튼**(`<button>`)이다. 안에는 위에서부터 48px 원 아이콘(태그색) → 제목(`font-title-md text-title-md`, 20px) → 설명 한 줄(`font-caption`보다 큰 14px, `text-on-surface-variant`).
- 카드 3개:

| 카드 | 아이콘 | 색 | 동작 | 설명 줄 |
|---|---|---|---|---|
| 수업 시작 | `play_arrow` | `tag-today` | 아래 "다음 수업" 이 있으면 지금 카드의 ▶ 시작과 **같은 동작**(`navigate('/curriculum', { state: { focusClassId, startLessonId } })`). 없으면 `/curriculum` 으로 이동 | 다음 수업이 있으면 `3:30 1반 · 수업 이름`, 없으면 "오늘 수업을 골라 시작해요" |
| 수업 만들기 | `add` | `tag-lesson` | `navigate('/curriculum', { state: { openQuick: true } })` | "질문 3개면 구성이 나와요" |
| 활동지 인쇄 | `print` | `tag-library` | `navigate('/materials')` | "단어로 바로 만들어 인쇄해요" |

- **로딩 중에도 카드 3개는 보인다.** 지금 `TodayLessons` 는 목록을 다 불러오기 전(`cards === null`)에 `return null` 한다. 진입 카드 3개는 데이터 없이도 그릴 수 있으니, 로딩 중에는 카드 3개만(설명 줄 중 "수업 시작"의 다음 수업 부분은 기본 문구로) 먼저 그리고 오늘 수업 목록 자리만 비워 둔다.
- **다음 수업**: 이미 컴포넌트 안에서 불러오는 오늘 수업 카드 목록(`cards`) 중 수업(`lesson`)이 있고 시작 시각(`cls.schedule.time`)이 **지금 이후인 첫 카드**, 없으면 수업이 있는 첫 카드, 그것도 없으면 `null`. 같은 데이터를 다시 불러오지 말고 `cards` 를 재사용한다.
- **카드가 안 떠야 할 때**: 학원 기능 스위치 `useFeature('group')` 이 닫혀 있으면(`/curriculum` 이 막혀 있다) "수업 시작"·"수업 만들기" 카드는 그리지 않는다. "활동지 인쇄" 카드는 항상 보인다. 오늘 수업이 하나도 없어도(`cards.length === 0`) 진입 카드 3개는 **항상 보인다**(기존 "오늘은 수업이 없는 날이에요" 문구는 목록 자리에 그대로).
- 컴포넌트가 길어지면 진입 카드 부분을 같은 파일 안 작은 컴포넌트(`EntryCard`)로 뺀다.
- i18n(새 블록 `todayEntry`, ko/en 둘 다): `start`(수업 시작 / Start lesson), `startNone`(오늘 수업을 골라 시작해요 / Pick a lesson to start), `create`(수업 만들기 / Make a lesson), `createDesc`(질문 3개면 구성이 나와요 / Answer 3 questions and get a plan), `print`(활동지 인쇄 / Print worksheets), `printDesc`(단어로 바로 만들어 인쇄해요 / Make printables from your words).

**2-4. `/curriculum` 이 `openQuick` 을 받는다** (`app/src/pages/CurriculumPage.tsx`).
- 이미 있는 `quickOpen` 상태와 `location.state` 처리 방식(`pendingFocus`, `wrapUp` 효과)을 참고한다. `location.state?.openQuick` 이 true 이고 **반 목록이 로드되어 `staffClassId` 가 정해졌으면** `setQuickOpen(true)` 를 부르고 `navigate('/curriculum', { replace: true })` 로 state 를 지운다(새로고침해도 다시 열리지 않게). 반이 아직 없으면(`!staffClassId`) 기다린다.

**2-5. 게임 화면에 가벼운 색 포인트만** (`app/src/pages/GamesPage.tsx`).
- 칸 칩 선택 상태를 `bg-warm-yellow text-deep-navy` 로, 칸 소제목(`<h3>`) 앞에 칸별 색 점(`h-3 w-3 rounded-full`)을 단다: 몸 풀기 `bg-clay-yellow` · 새로 배우기 `bg-clay-sky` · 연습하기 `bg-clay-mint` · 말하기·역할극 `bg-clay-coral` · 팀 대결 `bg-tag-library-ink` · 정리·평가 `bg-deep-navy` · 기타 `bg-outline`. 카드 구조·잠금 표시·번호/왕관 없음은 **그대로 둔다**.

**완료 기준**
- 사이드바: 묶음마다 색 원 아이콘이 보이고, 선택된 묶음이 그 색으로 칠해진다. 학생 메뉴는 이전과 같다.
- 오늘 화면: 크림 노랑 인사 카드 → 진입 카드 3개 → 오늘 수업 카드 순. 파란 배너가 없다. 진입 카드 3개가 각각 맞는 곳으로 간다(수업 만들기는 `/curriculum` 에서 빠른 만들기 창이 바로 열림).
- 반이 하나도 없는 새 계정에서도 오늘 화면이 깨지지 않는다(진입 카드가 보이고 오류 없음).

---

### Step 3. 랜딩 페이지 (`app/src/pages/LandingPage.tsx` + `app/src/tailwind.css` 의 `.landing*`)

**3-0. 글꼴.** `tailwind.css` 의 랜딩 블록(약 4910줄 `.landing`)을 바꾼다: `.landing { font-family: 'Noto Sans KR', 'IBM Plex Sans KR', sans-serif; }`, `.landing-display`·`.landing-logo` 는 `font-family: 'Noto Sans KR', sans-serif; font-weight: 800; letter-spacing: -0.03em;` (세리프 제목을 둥근 산세리프로). 안 쓰게 되는 `.landing-hero-media`·`.landing-pain-card*` 규칙이 있으면 정리한다(쓰는 곳이 있으면 남김).

**3-1. 이미지 준비 (한 번만 실행하는 스크립트).** 원본이 커서(사전 그림 1024px ≈ 100KB) 랜딩에 그대로 쓰지 않는다. 임시 스크립트(저장소에 커밋하지 않을 파일은 `scratch` 에 두거나 실행 후 지운다)로 작은 WebP 를 만들어 `app/public/landing/` 에 둔다.

```python
# python (Pillow 설치돼 있음). 저장소 루트에서 실행
from PIL import Image
import os
os.makedirs('app/public/landing/games', exist_ok=True)
for name in ['dog','cat','rabbit','bear','pig']:
    im = Image.open(f'app/public/word-bank-images/{name}.webp').convert('RGB').resize((256, 256), Image.LANCZOS)
    im.save(f'app/public/landing/{name}.webp', 'WEBP', quality=80)
for name in ['wheel','ladder','hangman','matchup','treasuredig','quizshow','airport','icecream']:
    im = Image.open(f'app/public/covers/game-{name}.jpg').convert('RGB')
    w = 480; h = round(im.height * w / im.width)
    im.resize((w, h), Image.LANCZOS).save(f'app/public/landing/games/{name}.webp', 'WEBP', quality=78)
```

각 파일이 25KB 안팎이어야 한다(넘으면 quality 를 낮춘다). 소품 이미지(`/skins/clues/trophy.webp`, `/skins/chain/megaphone.webp`, `/skins/chain/star.webp`, `/skins/dig/starfish.webp`)는 이미 작은 투명 WebP(8~20KB)라 그대로 쓴다. 랜딩의 모든 `<img>` 에 `loading="lazy"`(히어로 위쪽 이미지는 제외)·`width`·`height`·`alt=""`(장식) 를 준다.

**3-2. 히어로 — 크림 바탕 + 제품 목업.**
- 지금의 **사진 배경(`landing-hero.jpg`)·어두운 그라데이션을 걷어낸다**(파일은 남겨 둠). 히어로 섹션 바탕은 `bg-background`(크림), 글자는 `text-deep-navy`.
- 레이아웃: `md:grid-cols-[1.05fr_0.95fr]`. **왼쪽**: 칩 두 개(`heroEyebrow` 는 흰 바탕 테두리 칩, `heroBadge` 는 `bg-warm-yellow text-deep-navy` 칩) → H1(`landing-display`, 모바일 40px·데스크톱 60px, `heroLine3` 에 `text-primary-container` 또는 노랑 형광펜 밑줄 `bg-warm-yellow/70` 강조) → 설명 → 체크리스트 3줄(`CheckIcon` 재사용, 색은 `bg-secondary`) → 주 버튼 1개(`bg-deep-navy text-white rounded-full min-h-14 px-8`, 글자 `landing.startFree`, 오른쪽 화살표 아이콘) + 보조 텍스트 링크 "요금 보기"(`#pricing`).
- 왼쪽 맨 아래: **점토 친구들 줄** — `/landing/dog.webp`·`cat`·`rabbit`·`bear`·`pig` 5장을 한 줄로(`h-[84px] w-[84px] rounded-[24px] object-cover`, 카드마다 `-rotate-3`/`rotate-2` 번갈아, 작은 화면에서는 4장만, `flex-wrap` 금지·`overflow-hidden`). 이 사진들은 단어 사전의 그림이라는 점을 코드 주석으로만 적는다.
- **오른쪽**: 새 컴포넌트 `app/src/components/landing/ProductMock.tsx`(디렉터리가 없으면 만든다)를 둔다. **스크린샷 이미지를 쓰지 않는다**(실제 계정의 이름·학생이 노출되면 안 된다). 앱의 "오늘" 화면을 같은 토큰으로 코드로 그린 정적 목업이다:
  - 바깥: `rounded-[24px] border border-outline-variant/50 bg-surface-container-lowest shadow-card overflow-hidden`. 위쪽 얇은 바(`h-9 bg-surface-container`)에 점 3개.
  - 안쪽 왼쪽 열(폭 150px, `md` 이상에서만): `STAFF_NAV_GROUPS`(`app/src/lib/navGroups.ts`)의 5개 묶음을 **아이콘 원(태그색) + 이름**으로 정적으로 나열(클릭 불가, 첫 번째 "오늘"이 선택 상태).
  - 안쪽 오른쪽: 인사 한 줄 → "오늘 수업 2개"(`landing.mockToday`) → 카드 2줄(`1반 · 단어 수업 · 40분`에 `▶ 시작` 알약, `파닉스 반 · 수업 만들기 필요`에 `만들기` 알약) → 진입 카드 3개 축소판(아이콘 원 + 라벨).
  - 목업 바깥 모서리에 **점토 소품**을 겹쳐 둔다(`absolute`, `pointer-events-none`, `aria-hidden`): 우상단 `/skins/clues/trophy.webp`(높이 88px, `-top-6 -right-4 rotate-6`), 좌하단 `/skins/chain/megaphone.webp`(72px, `-bottom-4 -left-4 -rotate-12`), 우하단 `/skins/dig/starfish.webp`(56px). 모바일에서는 소품이 화면 밖으로 나가 가로 스크롤이 생기지 않게 `overflow-hidden` 래퍼를 둔다.
  - 목업의 글은 모두 `t()`. 새 키는 3-6 표 참고.
- 기존 히어로의 "슬라이드 6장" 목업(`mockSlides`·`landing.mockLessonTitle` 등)과 떠 있는 작은 카드(`mockFloat*`)는 JSX 에서 제거한다(번역 키는 남겨도 됨 — `en.ts` 와 키 일치만 유지).
- 헤더(`sticky`, 이미 크림 `#fff8ee/70`)는 유지하되 갈색 `#3d2e22` 버튼·글자를 `deep-navy` 로 맞춘다(로그인은 외곽선, 시작 버튼은 `bg-deep-navy text-white`). **헤더의 시작 버튼은 짧은 새 키 `landing.startShort`(ko `무료 체험`, en `Free trial`)를 쓴다** — `startFree`("14일 무료로 시작하기")는 길어서 375px 폭에서 로고·언어 토글과 함께 넘친다. 히어로·마지막 CTA 버튼은 `startFree` 를 쓴다.

**3-3. 나머지 구간 정리.**
- **"고민" 구간**(지금 `bg-[#12263d]` 어두운 남색 + 사진 카드 3장): 구간 바탕을 `bg-tag-today/50`(연노랑)으로, 제목·eyebrow 는 `text-deep-navy`/`text-primary` 로 바꾼다. 사진 카드(`landing-pain-*.jpg`)와 그 안의 어두운 글자 오버레이는 **그대로** 둔다(카드 안만 어둡다).
- **3단계 흐름**(`flow`): 카드 바탕 흰색 유지, 번호 원은 `bg-deep-navy`, 아이콘 원은 태그색(순서대로 `today`·`lesson`·`library`)으로. 그림자는 `shadow-card`.
- **쇼케이스 2개 + 돌림판 구간 + "한곳에" 8칸**: 구조 유지. 그림자·모서리만 토큰으로(`shadow-card`), "한곳에" 8칸의 아이콘 원 `bg-soft-mint/50` 은 항목마다 태그색 5가지를 돌려 쓴다.
- **새 구간 "게임 미리보기"**(쇼케이스 아래, 돌림판 구간 위): 제목 `landing.gamesStripTitle`(게임 `{{count}}`종, 단어만 넣으면 바로), 설명 한 줄, 그 아래 **게임 표지 8장 격자**(`grid grid-cols-2 md:grid-cols-4 gap-4`, 각 `rounded-[24px] overflow-hidden bg-surface-container-lowest shadow-card`, 위 이미지 `/landing/games/<type>.webp` + 아래 게임 이름). 이름은 `getGameCatalogEntry(type)?.nameKey` 를 `t()` 로. 대상 8개는 `wheel` `ladder` `hangman` `matchup` `treasuredig` `quizshow` `airport` `icecream`. `{{count}}` 는 `GAME_CATALOG.length`. 격자 아래 작은 글 "전체 게임은 14일 체험에서 모두 열려요"(`landing.gamesStripNote`).
- **어두운 구간은 하나만**: "이미 쓰는 앱이 있어도 괜찮아요"(`place*`) 구간만 어둡게 두고 바탕을 `bg-deep-navy` 로 통일(`#12263d` 제거). CTA 사진 구간(`landing-cta.jpg`)은 그대로 둔다.
- 비교표·요금·푸터: 구조 유지, `bg-[#fff8ee]` 같은 하드코딩은 토큰(`bg-background`)으로, 파란 그림자는 `shadow-card` 로. 요금 카드의 유료 카드(`bg-deep-navy`)는 유지.
- 랜딩 전체에서 `rgba(30,75,122` 등 하드코딩 그림자를 `shadow-card`(또는 얕은 `shadow-sm`)로 바꾼다.

**3-4. 모바일(375px).** 히어로는 한 열: 문구 → 버튼 → 목업(왼쪽 열 숨김) → 점토 친구들. 체크리스트는 세로. 가로 스크롤이 없어야 한다. 버튼 높이 56px 이상.

**3-5. 접근성.** 장식 이미지는 `alt=""`, 의미 있는 이미지는 없다. 목업 안의 `button` 처럼 보이는 요소는 실제 `<button>` 이 아니라 `<div>`(클릭 불가)로 만든다. 제목 순서는 h1 → h2.

**3-6. 문구 갱신(사실과 맞추기).** `ko.ts`·`en.ts` 의 `landing` 블록(`ko.ts` 약 6331줄)에서 아래를 바꾼다. **숫자는 `{{count}}` 로 받고 호출부에서 코드 값을 넘긴다**(`GAME_CATALOG.length`, 레시피 수는 `LESSON_RECIPES.length` — 둘 다 `app/src/lib` 에서 가져온다).

| 키 | 지금(ko) | 새 값(ko) |
|---|---|---|
| `landing.startFree` | 무료로 시작하기 | **14일 무료로 시작하기** |
| `landing.heroCheck1` | 수업 레시피 8가지 | **단어 한 번 입력 → 게임 {{count}}종** |
| `landing.heroCheck2` | 게임 37종 · 워크시트 20여 유형 | **활동지 인쇄까지 한 번에** |
| `landing.heroCheck3` | 오지선다 오답 자동 생성 | **학생 앱 없이 칠판에서 바로** |
| `landing.show3Title` | 게임 37종, 같은 단어장으로 | **게임 {{count}}종, 같은 단어장으로** |
| `landing.allGameTitle` | 수업 게임 37종 | **수업 게임 {{count}}종** |
| `landing.ctaDesc` | 가입은 1분이면 됩니다. 무료로 둘러보고, 필요할 때 유료로 바꾸세요. | **가입은 1분이면 됩니다. 14일 동안 모든 기능을 써 보고, 계속 쓸지는 그때 정하세요.** |
| `landing.pricingTitle` | 무료로 시작하고, 필요할 때 유료로 | **14일 전체 체험 뒤, 필요하면 유료로** |
| `landing.pricingDesc` | 학생 수와 상관없이 월 9,900원 정액입니다. 언제든 해지할 수 있어요. | **14일 동안은 모든 기능을 무료로 써 볼 수 있어요. 이후에는 학생 수와 상관없이 월 9,900원 정액이고, 언제든 해지할 수 있어요.** |

en 도 같은 뜻으로(예: `startFree` = "Start your 14-day free trial", `heroCheck1` = "Type words once → {{count}} games", `heroCheck2` = "Printables in one click", `heroCheck3` = "On the classroom screen, no student app"). **새 키**(ko/en 둘 다, `landing` 블록에 추가): `mockToday`(오늘 수업 2개 / 2 lessons today), `mockClass1`(1반), `mockClass1Sub`(단어 수업 · 40분 / Word lesson · 40 min), `mockClass2`(파닉스 반 / Phonics class), `mockClass2Sub`(수업 만들기 필요 / Needs a lesson), `mockStart`(시작 / Start), `mockCreate`(만들기 / Create), `startShort`(무료 체험 / Free trial), `gamesStripTitle`, `gamesStripDesc`, `gamesStripNote`. 문구에서 "레시피"가 남아 있으면 Step 1 에서 정한 이름("추천 수업")에 맞춘다.

**완료 기준**
- 랜딩 히어로가 크림 바탕이고, 오른쪽에 앱 화면 목업(사이드바 5묶음 색 원 포함)과 점토 소품이 보인다. 사진 배경·어두운 그라데이션이 히어로에 없다.
- 어두운 구간은 "place" 구간(+ CTA 사진 구간)뿐이다. 모든 구간이 번갈아 크림/흰색이다.
- 문구에 "37종"·"레시피 8가지"가 남아 있지 않고, 14일 체험이 버튼·요금 문구에 드러난다.
- 랜딩 관련 이미지 합계(첫 화면에서 받는 것)가 과하지 않다(`/landing/*.webp` 각 25KB 안팎).
- 375px 에서 가로 스크롤이 없다.

---

### Step 4. 마무리

**4-1. `CLAUDE.md` 를 고친다**(저장소 루트, **25줄 안**).
- "랜딩 (2026-08-31)" 섹션 아래에 **"디자인 개편(2026-10-17)"** 항목을 더한다: ① 크림 바탕+점토+제품 목업 방향과 이유(보라 쏠림 회피) ② 색·모서리·그림자 토큰(`--color-background #FFF8EC`, `tag-*`, `clay-*`, `shadow-card`, `rounded-xl` 16px) — **새 카드는 `shadow-card` 와 흰 바탕을 쓰고 파란 그림자를 쓰지 않는다** ③ 메뉴 묶음 색 태그 표 ④ 오늘 화면 진입 카드 3개와 `openQuick` state ⑤ 랜딩 목업은 스크린샷이 아니라 코드(`ProductMock.tsx`) — 실제 계정 정보가 노출되지 않게 ⑥ 랜딩 숫자는 코드에서 센 값을 쓴다 ⑦ 아직 안 한 것(랜딩 영상/실제 후기, 점토 캐릭터 전용 일러스트 제작, 앱 안쪽 나머지 화면의 개별 다듬기).
- "정보 구조"의 `/dashboard` 항목에 "맨 위 인사 카드 → 진입 카드 3개 → 오늘 수업"이라고 한 줄 고친다.

**4-2. 점검.**
1. `npm run build --prefix app` 통과, `npm run lint --prefix app` 에서 시작 전 기준선보다 **에러가 늘지 않았음**.
2. `grep -rn "12263d\|rgba(39,101,168\|rgba(30,75,122" app/src` 에 남은 것이 없거나 이유가 있다.
3. `git diff --stat` 에 `App.tsx`·`supabase/`·`api.ts` 가 **없어야** 한다. 새 파일은 `ProductMock.tsx`(+필요하면 작은 컴포넌트)와 `app/public/landing/**` 뿐이어야 한다.
4. **화면 확인**: 개발 서버(`npm run dev --prefix app`, 주소 `http://localhost:5173`)를 Browser 미리보기로 열어 본다. **랜딩(`/`)은 로그인 없이 열리므로 반드시 확인**한다(폭 1280px 와 375px, 위에서 아래까지 스크롤하며). 앱 안쪽(`/dashboard`·`/curriculum`·`/games`)은 **이미 로그인된 상태일 때만** 확인하고, 로그인 화면이 나오면 **우회하지 말고**(자격증명 입력·인증 코드 수정 금지) 코드 읽기로 대신한 뒤 보고서에 "앱 화면 미확인"이라고 적는다. 확인이 끝나면 화면 크기 에뮬레이션을 원래대로(desktop) 돌린다.
5. 눈으로 볼 것: 글자가 배경에 묻히는 곳 없음(특히 크림 바탕 위 회색 캡션), 카드 안 글자 잘림 없음, 사이드바 색 원이 어긋나지 않음, 인쇄 미리보기(`/materials/...`)는 흰 종이.

---

## 4. 이번에 하지 않는 것 (손대지 말 것)

- 다크 모드, 글자 크기·글꼴 설정 로직(이전 작업에서 완료), 본문 글자 크기 변경
- 점토 **캐릭터** 새로 그리기(지금 있는 사전 그림·소품만 쓴다), 실제 선생님 후기·사진 넣기
- 게임 내부 화면·인쇄물 디자인, 학생 화면, 관리자 화면, 약관류 페이지
- 메뉴 구조·라우트 변경, 모바일 하단 탭 바
- 기능 추가(진입 카드 3개의 동작은 기존 화면으로 가는 연결뿐)

---

## 5. 끝났을 때 보고 형식 (40줄 이내)

1. **변경 파일 목록** (새 파일 / 수정 파일 구분)
2. **토큰 변경 요약**: 바뀐 색·반경·그림자, 대비 계산 결과(가장 낮았던 쌍과 값)
3. **랜딩에서 바뀐 구간 목록**, 문구를 바꾼 키 수
4. **확인한 것 / 못 한 것**: 빌드·린트 결과(기준선 대비), 랜딩 화면 확인(1280/375), 앱 안쪽 화면 확인 여부
5. **눈에 띈 위험·이상한 점**(있으면): 예) 대비가 모자란 곳, 깨진 레이아웃, 코드와 문서가 어긋난 곳
6. 사용자 결정이 필요한 것이 있으면 한 줄로 (없으면 "없음")

커밋은 하지 않는다.
