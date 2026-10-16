# 클래스뱅크 화면 정리 1단계 — "새 구조" 개발 지시서

> 이 문서 전체가 작업 지시입니다. 처음부터 끝까지 읽고 Step 1 → 6 순서대로 진행하세요.
> 저장소는 `C:\Users\likes\Desktop\pointbank` 이고 앱은 `app/` 입니다(React 19 + Vite + TypeScript + Tailwind 4 + react-router + i18next).
> `CLAUDE.md`(프로젝트 규칙)는 이미 읽었다고 가정합니다. 아래 지시와 충돌하면 **이 문서가 우선**합니다.
> 이 문서의 줄 번호·코드 조각은 작성 시점 기준 참고용입니다. **파일을 고치기 전에 반드시 열어서 지금 코드를 확인**하세요.

---

## 0. 목표와 배경

**목표.** 선생님이 보는 메뉴·이름·게임 목록·수업 카드를 "하루의 순서(준비 → 수업 → 마무리)"에 맞게 정리합니다. 다음 다섯 가지를 합니다.

1. 사이드바 메뉴 13개를 **5개 묶음**(오늘 · 수업 · 자료 · 우리 반 · 더보기)으로 묶는다.
2. 개발자 용어를 **선생님 말**로 바꾼다(한국어 + 영어).
3. 게임 47종을 **"수업의 순간" 6칸**으로 나누고, 게임 카드의 번호와 왕관을 없앤다.
4. 수업 카드의 글자 없는 작은 아이콘 버튼 5개를 **큰 버튼 2개 + "더보기"** 로 바꾼다.
5. **글자 크기** 설정(보통·크게·아주 크게)을 만들고 한글 글꼴을 보강한다.

**배경.** 선생님 피드백이 "기능은 많고 좋은데 정리가 안 된 느낌"이었습니다. 대상은 30~50대 여성 공부방·교습소 선생님입니다. 원인은 (1) 메뉴가 기능이 만들어진 순서로 늘어서 있고 (2) 같은 일의 입구가 여러 개이며 (3) 용어가 개발자 말이고 (4) 버튼이 작고 글자가 없다는 것입니다.

**이번 단계는 기능 추가가 아니라 정리입니다.** 이름·묶음·보이는 모양만 바꾸고, 기능은 지우지 않고 접습니다.

---

## 1. 지켜야 할 규칙 (어기면 실패)

1. **주소(라우트)를 바꾸지 않는다.** `app/src/App.tsx` 는 수정하지 않는다. 작업이 끝났을 때 `git diff --stat` 에 `App.tsx` 가 없어야 한다.
2. DB·SQL(`supabase/`)·Edge Function·`app/src/lib/api.ts` 는 건드리지 않는다. **새 npm 패키지를 설치하지 않는다.**
3. **기능을 삭제하지 않는다.** 접거나 이름을 바꿀 뿐이다.
4. 아래 화면의 글은 바꾸지 않는다: 학생 화면(`/me`, `/s`, `/hw`, `/join`, `/watch`), 관리자 화면(`Admin*` 페이지와 관련 문구), 약관·개인정보처리방침·환불정책 페이지. 학생용 메뉴(`AppLayout` 의 `isStaff === false` 분기)도 그대로 둔다.
5. 화면 글은 모두 `t()` 로 쓴다. `app/src/i18n/locales/ko.ts` 와 `en.ts` **둘 다** 고친다. `en.ts` 는 `Ko` 타입이라 키가 하나라도 빠지거나 남으면 빌드가 실패한다(안전장치다). **키 이름은 바꾸지 말고 값만 바꾼다**(코드가 키를 참조한다).
6. **커밋·푸시하지 않는다**(CLAUDE.md 룰 8). 끝나면 변경 파일 목록만 보고한다.
7. 질문하지 말고 이 문서의 기본값으로 정한다. 문서와 코드가 어긋나 정말 진행할 수 없는 항목만 건너뛰고 보고서에 적는다.
8. TypeScript 설정이 엄격하다.
   - `noUnusedLocals`/`noUnusedParameters`: 쓰지 않게 된 import·변수·인자는 지운다.
   - `verbatimModuleSyntax`: 타입은 `import type` 으로 가져온다.
   - `erasableSyntaxOnly`: `enum`·`namespace` 를 쓰지 않는다.
   - 훅은 조건부 `return` 앞에서만 부른다(oxlint 의 `react/rules-of-hooks` 가 error).
   - 컴포넌트 파일에는 컴포넌트만 `export` 한다. 상수·함수는 `app/src/lib/` 에 둔다(`react/only-export-components` 경고 방지).
9. 큰 파일(`ko.ts`·`en.ts` 약 6,400줄, `CurriculumPage.tsx` 약 1,200줄, `LessonSlideSorter.tsx` 2,000줄 이상)은 통째로 읽지 말고 `Grep` 으로 위치를 찾아 그 부분만 읽는다. `Edit` 할 때는 키 이름까지 포함한 줄처럼 **고유한 문자열**로 바꾼다(`dashboard:` 처럼 흔한 말만 쓰면 여러 곳이 걸린다).
10. 개발 서버를 켜 둔 채로 두지 않는다. 한 Step 이 끝날 때마다 **저장소 루트에서** `npm run build --prefix app` 을 돌려 통과를 확인한다(`tsc -b && vite build`).

**시작 전에** `npm run lint --prefix app` 을 한 번 돌려 경고·에러 수를 적어 둔다. 끝났을 때 **새 에러가 없어야** 한다.

---

## 2. 작업 순서

### Step 1. 이름 바꾸기 (i18n 값만)

**1-1. `nav` 블록부터.** `ko.ts`(약 6207줄)·`en.ts`(약 6212줄)의 `nav: { ... }` 에서 아래 값을 바꾼다.

| 키 | 지금(ko) | 새 값(ko) | 새 값(en) |
|---|---|---|---|
| `nav.dashboard` | 대시보드 | **오늘** | Today |
| `nav.attendance` | 학생관리 | **학생·출석** | Students & Attendance |
| `nav.board` | 포인트 뱅크 | **칭찬 통장** | Praise Passbook |
| `nav.gameCenter` | 게임 센터 | **게임** | Games |
| `nav.dictionary` | 단어 사전 | **그림 사전** | Picture Dictionary |
| `nav.videoLibrary` | 영상 라이브러리 | **수업 영상** | Lesson Videos |
| `nav.wordLists` | 내 단어장 | **단어장** | Word Lists |
| `nav.classroomMaterials` | 수업 자료실 | **활동지(인쇄)** | Worksheets (print) |
| `nav.reports` | 리포트 | **기록** | Records |

그대로 두는 값: `nav.curriculum`(내 수업) · `nav.homework`(숙제) · `nav.grammar` · `nav.phonics` · `nav.help` · `nav.settings` · `nav.premiumPageBadge`.

`nav` 블록에 **새 키**를 추가한다.

| 키 | ko | en |
|---|---|---|
| `nav.group_today` | 오늘 | Today |
| `nav.group_lesson` | 수업 | Lessons |
| `nav.group_library` | 자료 | Library |
| `nav.group_class` | 우리 반 | My Class |
| `nav.group_more` | 더보기 | More |
| `nav.billing` | 요금제 | Plan & billing |

**1-2. 화면 제목과 문장 속 이름.** 아래 옛 이름을 `ko.ts`·`en.ts`·`app/src/data/faq.ts` 에서 `Grep` 으로 **모두** 찾아 한 줄씩 판단한다. 메뉴·화면·버튼을 가리키면 바꾸고, 다른 뜻이면 둔다.

| 옛 이름 | 새 이름 | 적용 범위와 주의 |
|---|---|---|
| 게임 센터 | **게임** | 제목(`gamesList.title`)은 "게임". 문장 속은 "게임 메뉴"로 다듬는다("게임 센터에서 먼저 만들어 두세요" → "게임 메뉴에서 …"). |
| 수업 자료실 | **활동지(인쇄)** | 제목(`materials.pageTitle`)·`backToMaterials`·슬라이드 종류 이름. 문장 속은 "활동지". |
| 포인트 뱅크 | **칭찬 통장** | 문장 속 언급 포함. |
| 학생관리 | **학생·출석** | 문장 속은 "우리 반 → 학생·출석"처럼 풀어 쓴다. |
| 대시보드 | **오늘** | "대시보드의 '처음 시작하기'" → "오늘 화면의 '처음 시작하기'". 단 "Supabase 대시보드"(관리자 MFA 문구)는 그대로. |
| 리포트 | **기록** | 메뉴·`results` 화면 제목·언급. **"학부모 리포트"·"주간 리포트"는 그대로.** |
| 단어 사전 | **그림 사전** | 메뉴·화면 제목 언급. |
| 영상 라이브러리 | **수업 영상** | 선생님 화면의 메뉴·제목(`videoLibrary.pageTitle`). 관리자 화면은 제외. |
| 내 단어장 | **단어장** | **메뉴 이름과 화면 제목만.** "내 단어장에 담기" 같은 동작 문구는 그대로. |
| 발표하기 | **수업 시작** | 버튼·안내 문구. `curriculum.startButton` 도 "수업 시작하기" → "수업 시작". "발표 중" 같은 상태 표현은 그대로. |
| 쉐도잉 | **따라 말하기** | **한국어만.** 슬라이드 종류를 고르는 자리(블록 보관함·종류 칩 등)는 "따라 말하기(쉐도잉)"로 병기한다. 영어는 Shadowing 그대로. |
| 수업 세트 | **추천 수업** | `recipes.setsTab` 등. |
| 레시피로 시작하기 | **추천 수업으로 시작하기** | `recipes.title` 및 같은 말을 쓰는 안내 문구(`faq.ts` 의 "레시피로 시작하기" 포함). |
| 수업 라이브러리 | **완성 수업** | `lessonLibrary.open` 버튼 이름. |
| 슬라이드 N장 | **활동 N개** | **수업 카드·이전 버전·임시저장 배너**처럼 "수업이 몇 개로 이뤄졌는지" 세는 곳만(`curriculum.slideCount`, `curriculum.history.slides`, `curriculum.draft.desc`). 슬라이드 **편집기 안**(슬라이드 추가·목록 등)의 말은 바꾸지 않는다. |

영어(`en.ts`) 대응: Dashboard → Today, Game Center → Games, Classroom Materials → Worksheets (print), Point Bank → Praise Passbook, Student Management → Students & Attendance, Reports → Records("Parent report"는 그대로), Word Dictionary → Picture Dictionary, Video library → Lesson Videos, Present → Start lesson.

**바꾸지 않는 것**: 코드 식별자·키 이름·라우트 주소·코드 주석, "클래스뱅크"(브랜드), "포인트"·"통장"(일반 명사로 쓰인 곳, 예: "오늘 통장 마감"), "숙제 캘린더", 슬라이드 편집기 안의 용어(슬라이드·블록), 마케팅 문구와 숫자.

**랜딩**(`landing.*`)도 **메뉴 이름을 가리키는 곳만** 같은 이름으로 맞춘다(예: `landing.mockPresent` "발표하기" → "수업 시작", `landing.show2Eyebrow`, `landing.pricingPaidF3` 의 "수업 자료실").

**1-3. 수업 화면의 글 몇 군데.** `curriculum` 블록(`ko.ts` 약 5078줄).

| 키 | 지금 | 새 값 |
|---|---|---|
| `curriculum.editButton` | 수정 | **고치기** (en: Edit) |
| `curriculum.moreButton` (새 키) | — | **더보기** (en: More) |
| `curriculum.pageSubtitle` | 이미지·영상·게임을 슬라이드로 배치해서, 반마다 오늘 수업을 발표하듯 순서대로 진행해요. | **게임·영상·활동지를 순서대로 모아 두고, 수업 시간에 "▶ 수업 시작"만 누르세요.** (en 도 같은 뜻으로) |

**완료 기준**: 옛 이름이 사용자에게 보이는 글에 남아 있다면 "바꾸지 않는 것" 목록에 해당하는 것뿐이다. `npm run build --prefix app` 통과.

---

### Step 2. 메뉴 5개 묶기

**지금 구조.** `app/src/pages/AppLayout.tsx` 의 `navItems`(선생님 13개 평면 목록)를 `sidebarContent` 가 그린다. `sidebarContent` 는 **데스크톱 사이드바와 모바일 서랍이 같이** 쓴다. 유료 전용 메뉴에는 항상 👑 이 붙어 있다.

**새 구조.**

| 묶음(`id`) | 이름 | 아이콘 | 안에 들어가는 화면 (주소 · 이름 키 · 아이콘 · 기능 스위치) |
|---|---|---|---|
| `today` | 오늘 | `today` | `/dashboard` · `nav.dashboard` · `dashboard` |
| `lesson` | 수업 | `auto_stories` | `/curriculum` · `nav.curriculum` · `auto_stories` · `group` |
| `library` | 자료 | `inventory_2` | `/games` `nav.gameCenter` `sports_esports` → `/materials` `nav.classroomMaterials` `print` → `/wordlists` `nav.wordLists` `library_books` → `/dictionary` `nav.dictionary` `menu_book` → `/phonics` `nav.phonics` `spellcheck` → `/grammar` `nav.grammar` `rule` → `/videos` `nav.videoLibrary` `video_library`(`group`) |
| `class` | 우리 반 | `groups` | `/attendance` `nav.attendance` `calendar_today` → `/board` `nav.board` `payments` → `/homework` `nav.homework` `assignment`(`homework`) → `/results` `nav.reports` `assessment` |
| `more` | 더보기 | `more_horiz` | `/settings` `nav.settings` `settings` → `/help` `nav.help` `support_agent` → `/settings/billing` `nav.billing` `credit_card` |

(`group`·`homework` 는 학원별 기능 스위치. 지금 `AppLayout` 의 `useFeature('group')`, `useFeature('homework')` 와 같은 것이다. 스위치가 닫히면 그 항목은 **숨긴다.**)

**2-1. `app/src/lib/navGroups.ts` 를 새로 만든다** (데이터와 순수 함수만). 뼈대:

```ts
export type NavFeature = 'group' | 'homework';

export interface NavChild {
  to: string;
  labelKey: string; // i18n 키
  icon: string; // Material Symbols 이름
  feature?: NavFeature; // 학원별 기능 스위치가 닫히면 숨긴다
}

export interface NavGroup {
  id: 'today' | 'lesson' | 'library' | 'class' | 'more';
  labelKey: string;
  icon: string;
  children: NavChild[];
}

export const STAFF_NAV_GROUPS: NavGroup[] = [ /* 위 표 그대로, 위에서 아래 순서 */ ];

/** pathname 이 to 자체이거나 to 아래 경로인가 */
export function pathMatches(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** 기능 스위치가 닫힌 항목을 빼고, 항목이 하나도 안 남은 묶음은 뺀다 */
export function visibleGroups(groups: NavGroup[], open: Record<NavFeature, boolean>): NavGroup[] { /* ... */ }

/** 지금 주소가 속한 묶음과 항목. 가장 긴 주소가 맞는 항목을 고른다(`/settings/billing` 은 `/settings` 가 아니라 요금제). 없으면 null */
export function findActive(groups: NavGroup[], pathname: string): { group: NavGroup; child: NavChild } | null { /* ... */ }
```

**2-2. `app/src/components/StaffNav.tsx` 를 새로 만든다.** 선생님 메뉴 목록 전체를 그린다. 동작은 다음과 같다.

- 묶음마다 행 하나를 `Link`(**`NavLink` 쓰지 않는다** — 같은 주소가 겹쳐 두 군데가 선택돼 보이는 것을 막는다)로 그린다. 행 모양은 기존 `navLinkClass` 와 같게(아이콘 + 이름, `px-4 py-3 rounded-lg`), 선택된 묶음은 기존 선택 색(`bg-secondary-container text-on-secondary-container font-bold`).
- **지금 화면이 속한 묶음만 펼쳐서** 안의 항목을 보여 준다(`findActive` 사용). 항목은 들여쓴 `Link`(`pl-12 pr-4 py-2.5 rounded-lg`, 작은 아이콘 + 이름), 선택된 항목은 굵게·배경색, `aria-current="page"`.
- 묶음 행을 누르면 **그 묶음의 첫 번째 보이는 항목 주소**로 이동한다. 이미 그 묶음 안에 있으면 이동하지 않고 그대로 둔다(같은 주소면 `Link` 이동은 무해하다).
- 항목이 하나뿐인 묶음(오늘·수업)은 화살표 없이 그 화면으로 바로 가는 링크처럼 보인다. 항목이 여럿인 묶음은 행 오른쪽에 장식용 화살표(`expand_more`/`chevron_right`, `aria-hidden`)를 둔다.
- **왕관(👑)을 없애고 자물쇠로 바꾼다.** `FREE_BLOCKED_PATHS.includes(child.to) && !hasFullAccess` 일 때만 작은 자물쇠 아이콘(`material-symbols-outlined`의 `lock`, `title={t('nav.premiumPageBadge')}`)을 붙인다. 14일 체험 중이거나 유료(`hasFullAccess === true`)면 아무것도 붙이지 않는다. 묶음에 항목이 하나뿐이면 그 항목의 자물쇠를 묶음 행에 붙인다. (`hasFullAccess` 는 `useAuth()` 에 있다. `GamesPage.tsx` 가 이미 쓴다.)
- 링크를 누르면 모바일 서랍이 닫혀야 하므로 `onNavigate?: () => void` prop 을 받아 모든 링크의 `onClick` 에서 부른다.
- 기능 스위치는 컴포넌트 안에서 `useFeature('group')`, `useFeature('homework')` 로 읽는다(`app/src/lib/features.ts`, `AppLayout.tsx` 맨 위 import 를 보면 된다).
- 가장 바깥 `<ul>` 은 지금 `AppLayout` 의 것과 같은 클래스(`flex-1 flex flex-col gap-1 px-2`)로 둔다. 아래 영역(플랜 배지·언어·로그아웃)을 바닥으로 미는 역할이다.
- 접근성: 목록은 `<ul>`/`<li>`, 묶음 이름과 항목 이름은 `t()`.

**2-3. `AppLayout.tsx` 를 고친다.**

- 선생님(`isStaff`)일 때 `sidebarContent` 의 `<ul>…navItems…</ul>` 자리에 `<StaffNav onNavigate={() => setMobileOpen(false)} />` 를 넣는다. 학생일 때는 **기존 코드 그대로** 둔다(`NavItem`·학생용 목록·`navLinkClass` 유지).
- 사이드바 맨 아래 영역의 **"도움말·문의"와 "설정" 링크는 지운다**(이제 "더보기" 안에 있다). 플랜 배지 링크(`/settings/billing`)·`LanguageToggle`·로그아웃은 그대로 둔다. 상단바의 설정 톱니와 프로필 아이콘도 그대로 둔다.
- 안 쓰게 된 import·변수(`isPremiumPage`, 선생님용 `navItems` 분기 등)를 정리한다. 발표 모드(`isPresenting`) 분기와 `LessonRunnerBar`·`PlanRouteGuard` 는 **건드리지 않는다.**
- `AcademyCodeButton`(맨 위 "학원 코드 보기")은 그대로 둔다.

**2-4. 새 메뉴 안내를 한 번만 보여 준다.** `app/src/components/CoachTip.tsx` 의 `TIPS` 에 `'/dashboard': 'menuMoved'` 를 더하고, `ko.ts`·`en.ts` 의 `coach` 블록(`ko.ts` 약 3283줄)에 `menuMovedTitle`·`menuMovedBody` 를 쓴다.

- ko 제목: `메뉴는 5개예요`
- ko 본문: `오늘 · 수업 · 자료 · 우리 반 · 더보기. 게임·활동지·단어장·그림 사전은 "자료"에, 학생·출석·칭찬 통장·숙제·기록은 "우리 반"에 있어요.`
- en 은 같은 뜻으로(Today · Lessons · Library · My Class · More).

**2-5. 도움말에 "예전 메뉴는 어디로 갔나요?"를 1개 더한다.** `app/src/data/faq.ts` 의 `FAQ` 배열 맨 앞(`start` 분류)에 항목 하나를 **기존 항목과 같은 형식**으로 추가한다(`id: 'start-menu'`).

- 질문: `메뉴 이름이 바뀐 것 같아요. 예전 메뉴는 어디 있나요?`
- 답(ko): `대시보드 → 오늘 / 게임 센터 → 자료 안의 게임 / 수업 자료실 → 자료 안의 활동지(인쇄) / 내 단어장 → 자료 안의 단어장 / 단어 사전 → 자료 안의 그림 사전 / 영상 라이브러리 → 자료 안의 수업 영상 / 학생관리 → 우리 반 안의 학생·출석 / 포인트 뱅크 → 우리 반 안의 칭찬 통장 / 리포트 → 우리 반 안의 기록 / 설정·도움말·요금제 → 더보기`
- 답(en)과 질문(en)도 같은 뜻으로. `link` 는 `/dashboard`.

**완료 기준**
- 데스크톱(폭 768px 이상)에서 선생님 사이드바에 **묶음 5개 행**만 보이고, 현재 화면이 속한 묶음만 펼쳐져 안의 항목이 보인다. 모바일 서랍도 같다.
- `/games/wheel`, `/materials/worksheet`, `/results/homework/아무값`, `/settings/billing`, `/curriculum/아이디/slide/아이디` 같은 **안쪽 주소에서도 올바른 묶음·항목이 선택**된다. 선택 표시가 두 군데에 동시에 나타나지 않는다.
- 학원 기능 스위치가 닫힌 항목(`/curriculum`, `/videos`, `/homework`)은 보이지 않고, 항목이 모두 사라진 묶음은 보이지 않는다.
- 체험 중·유료 선생님에게는 왕관도 자물쇠도 없다. 체험이 끝난 무료 선생님에게는 `FREE_BLOCKED_PATHS` 화면(`/dictionary`, `/phonics`, `/grammar`, `/videos`, `/homework`, `/curriculum`, `/materials`) 항목에 자물쇠가 보인다.
- `App.tsx` 변경 없음. 학생 메뉴는 이전과 같다.

---

### Step 3. 게임 6분류와 카드 정리

**3-1. `app/src/lib/gameCatalog.ts`.** 타입과 상수를 더하고, 47개 항목 모두에 `moment` 를 **필수 필드**로 붙인다(빠뜨리면 TypeScript 가 알려 준다).

```ts
/** 수업의 순간 — 선생님이 "지금 수업에 뭐가 필요하지?"로 고르는 6칸(+기타). 게임 목록·수업 만들기의 게임 고르기가 같이 쓴다. */
export type GameMoment = 'warmup' | 'learn' | 'practice' | 'speak' | 'team' | 'wrapup' | 'other';
export const GAME_MOMENTS: GameMoment[] = ['warmup', 'learn', 'practice', 'speak', 'team', 'wrapup', 'other'];
```

옛 `category` 필드와 `GameCategory` 타입은 **지우지 않는다**(호환용). 주석에 "옛 분류 — 새 화면은 `moment` 를 쓴다"고 적는다. (`BlockLibraryPanel` 의 `category` 는 블록 분류라 전혀 다른 것이다. 건드리지 않는다.)

**47개 매핑 (이대로 붙인다)**

| `moment` | 이름 | 개수 | 게임 `type` |
|---|---|---|---|
| `warmup` | 몸 풀기 | 7 | `wheel` `ladder` `order` `bomb` `timer` `popcorn` `passball` |
| `learn` | 새로 배우기 | 2 | `flashcards` `labeleddiagram` |
| `practice` | 연습하기 | 16 | `matchup` `whackamole` `hangman` `anagram` `groupsort` `spellword` `typeanswer` `rankorder` `wordsearch` `crossword` `mazechase` `airplane` `findmissing` `unscramble` `watermelon` `catchsentence` |
| `speak` | 말하기·역할극 | 7 | `shopping` `airport` `restaurant` `icecream` `doctor` `lastbox` `lightning` |
| `team` | 팀 대결 | 10 | `tictactoe` `connect4` `baskin31` `saveorgive` `twodice` `gameshowquiz` `winlosequiz` `treasuredig` `fourclues` `mysterybox` |
| `wrapup` | 정리·평가 | 4 | `quiz` `truefalse` `imagequiz` `quizshow` |
| `other` | 기타 | 1 | `mathgen` |

합계 47. 매핑을 다 붙인 뒤 `GAME_CATALOG.length === 47` 이고 모든 항목에 `moment` 가 있는지 눈으로 확인한다.

**3-2. i18n.** `ko.ts`·`en.ts` 에 새 블록 `gameMoment`(`gameCategory` 블록 바로 아래)를 둔다. `gameCategory` 블록은 **남겨 둔다**(`gameCategory.all` 은 "전체" 칩에 계속 쓴다).

| 키 | ko | en |
|---|---|---|
| `gameMoment.warmup` | 몸 풀기 | Warm-up |
| `gameMoment.learn` | 새로 배우기 | Learn |
| `gameMoment.practice` | 연습하기 | Practice |
| `gameMoment.speak` | 말하기·역할극 | Speaking & role-play |
| `gameMoment.team` | 팀 대결 | Team battle |
| `gameMoment.wrapup` | 정리·평가 | Wrap-up & quiz |
| `gameMoment.other` | 기타 | Other |

그리고 `gamesList.title` 은 "게임"(en: Games)으로 한다(Step 1 에서 이미 했으면 확인만).

**3-3. `app/src/pages/GamesPage.tsx`.**

- `CATEGORIES`·`activeCategory`·`GameCategory` 를 `GAME_MOMENTS`·`activeMoment`(`GameMoment | 'all'`)로 바꾼다. 필터에 `g.moment` 를 쓴다.
- 칩 줄: `전체` + 지금 보기(내 라이브러리/전체 보기)에 게임이 하나라도 있는 칸만, 칩 글자는 `"{칸 이름} {개수}"`(예: `연습하기 16`). 개수는 지금 보기·검색어를 반영한 값이어도 되고 칸 전체 개수여도 된다(하나로 통일). 칩 높이는 `min-h-11` 이상.
- **"전체" 칩 + 검색어 없음**일 때는 카드를 **칸별 소제목으로 묶어서** 보여 준다(`<h3>` "몸 풀기 7" 아래 격자, 그 아래 다음 칸 …). 한 칸을 고르거나 검색어가 있으면 소제목 없이 격자 하나로 보여 준다. 카드 순서는 `GAME_CATALOG` 원래 순서를 유지한다.
- 카드 JSX 가 두 번 나오지 않도록 같은 파일 안에 `GameCard` 컴포넌트(파일 밖으로 export 하지 않는다)로 뺀다.
- **카드에서 번호 배지(`g.number`)와 왕관(👑, `isPremiumGame`)을 지운다.** 잠금 표시는 지금처럼 `locked`(= 선생님이고 `!hasFullAccess` 이고 무료 게임이 아님)일 때만 자물쇠 아이콘 + "업그레이드 필요" 배지 + 회색 표지를 쓴다. `locked` 가 아니면 오른쪽 위에는 아무것도 없다.
- 내 라이브러리/전체 보기 탭, 반 칩(`ClassChipRow`), 검색 입력, 오류·빈 상태 화면은 **지금 그대로** 동작해야 한다.

**3-4. `app/src/components/LessonSlideSorter.tsx`.** 수업 만들기 안의 게임 고르기 두 곳이 같은 6칸을 쓰게 한다.

- 파일 위쪽의 `CATEGORY_ORDER`(옛 7분류)를 `GAME_MOMENTS` 로 바꾼다.
- 게임 칩을 그리는 두 곳(슬라이드 추가의 `addMode === 'game'` 목록, 게임 슬라이드의 "게임 바꾸기" 목록 — `GAME_CATALOG.filter((g) => g.category === cat)` 로 검색하면 나온다)에서 `g.moment === m` 로 거르고, **줄마다 칸 이름 소제목**(`font-caption text-caption text-on-surface-variant`, 줄 전체 폭)을 앞에 붙인다. 게임이 없는 칸은 그리지 않는다.

**완료 기준**
- 게임 화면: 칩이 `전체`·몸 풀기·새로 배우기·연습하기·말하기·역할극·팀 대결·정리·평가(·기타)이고 칩을 눌러 거르기가 된다. "전체"에서는 칸별 소제목이 보인다. 카드에 번호·왕관이 없다.
- 수업 만들기의 게임 고르기도 칸 이름이 붙어 같은 6칸으로 묶인다.
- 무료 플랜(체험 종료 후)에서 유료 게임 카드를 누르면 `/settings/billing` 으로 가는 기존 동작이 유지된다(코드로 확인).
- 빌드 통과.

---

### Step 4. 수업 카드 정리

**4-1. `app/src/components/MoreMenu.tsx` 를 새로 만든다.** 작은 "더보기" 메뉴 컴포넌트다.

```ts
export interface MoreMenuItem {
  key: string;
  label: string; // 이미 번역된 글
  icon?: string; // Material Symbols 이름
  danger?: boolean; // 삭제처럼 위험한 항목(글자색 text-error, 위에 구분선)
  onSelect: () => void;
}
interface Props {
  triggerLabel: string; // 이미 번역된 글 — "더보기"
  items: MoreMenuItem[]; // 호출하는 쪽이 숨길 항목은 미리 걸러서 넘긴다
  className?: string; // 바깥 래퍼에 붙는 클래스(폭 조절용)
}
```

- 버튼은 `more_horiz` 아이콘 **+ 보이는 글자**(`triggerLabel`). 모양: `inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-outline-variant px-4 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary`. `aria-haspopup="menu"`, `aria-expanded`.
- 펼침 상자: `role="menu"`, 항목은 `role="menuitem"` 버튼(`min-h-11 w-full text-left rounded-lg px-3 font-label-md text-label-md hover:bg-surface-container-low`, 앞에 18px 아이콘). 상자는 `absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg`.
- 바깥을 누르거나 `Esc` 를 누르거나 항목을 고르면 닫힌다(`Esc` 로 닫으면 버튼에 포커스를 돌려준다). 포털은 쓰지 않는다(카드에 `overflow-hidden` 이 없는지 확인).

**4-2. `app/src/pages/CurriculumPage.tsx` 의 단체수업 카드**(약 1050~1146줄의 `sortedLessons.map`).

지금: 제목 줄 오른쪽에 **글자 없는 작은 아이콘 5개**(고치기·공유·이전 버전·복사·삭제 — 삭제가 고치기 바로 옆), 아래에 "▶ 수업 시작하기" 버튼, 그 아래에 "이 수업으로 숙제 내기" 버튼.

새 모양:

```
[ 수업 이름 ]  [모든 반 공용] [레벨]      ← 제목 줄에서 아이콘 5개 제거
단어장: … (n)
활동 N개
[        ▶ 수업 시작        ]            ← 전체 폭, min-h-12, 기존 주 버튼 색
[ ✎ 고치기 ]  [ ⋯ 더보기 ]               ← 두 버튼 반반(flex-1), 둘 다 min-h-12
```

- 주 버튼 글자: `▶ {t('curriculum.startButton')}`. 고치기 버튼은 외곽선(`border border-primary text-primary`) + `edit` 아이콘 + `t('curriculum.editButton')`.
- 더보기 메뉴 항목(이 순서): ① `homeworkOpen` 일 때만 "이 수업으로 숙제 내기"(`curriculum.homeworkButton`, 기존 `navigate('/homework', { state: { fromLessonId: lesson.id } })` 그대로) ② 공유(`lessonShare.button` → `setShareLesson`) ③ 다른 반으로 복사(`curriculum.copy.button` → `setCopyLesson`) ④ 이전 버전(`curriculum.history.button` → `setHistoryLesson`) ⑤ 삭제(`common.delete`, `danger`, 기존 `handleDelete` — 안에 이미 `confirm()` 확인이 있으므로 유지).
- 슬라이드 수 줄은 "활동 N개"로(Step 1 에서 바꾼 `curriculum.slideCount` 사용).
- 위쪽 버튼 두 개는 이름만 맞춘다: "+ 새 수업 만들기"는 그대로, "수업 라이브러리" 버튼은 Step 1 의 `lessonLibrary.open` 변경("완성 수업")이 그대로 반영된다.

**4-3. `app/src/components/solo/SoloLessonsPanel.tsx` 의 개별수업 카드**(약 140~195줄).

- 제목 줄의 **글자 없는 아이콘 버튼 둘(이름 바꾸기 `edit`, 삭제 `delete`)을 지운다.**
- 지금의 `<details>` 더보기를 `MoreMenu` 로 바꾸고 항목을 ① 미리보기(`solo.preview`) ② 오늘의 수업으로 내기(`solo.assign`) ③ 이름 바꾸기(`solo.rename`) ④ 삭제(`common.delete`, `danger`)로 한다. 각 항목의 동작은 지금 코드의 핸들러(`setPreview`, `setAssigning`, `rename`, `remove`)를 그대로 쓴다. 더보기 글자는 `solo.more` 키가 이미 있으면 그것을 쓴다.
- 이미 있는 글자 버튼 셋(숙제로 내기·현황·고치기)은 그대로 두고 높이만 `min-h-11` 이상으로 맞춘다.

**완료 기준**
- 두 종류 수업 카드 어디에도 **글자 없는 아이콘 단독 버튼이 없다.**
- 단체수업 카드에서 삭제 버튼이 고치기 바로 옆에 있지 않고, 삭제는 더보기 안에서 확인을 거친다. 공유·복사·이전 버전·숙제 내기 모두 기존과 똑같이 동작한다(핸들러를 새로 만들지 말고 기존 것을 연결한다).
- 더보기 메뉴가 열려 있을 때 바깥을 누르면 닫힌다. 카드가 격자의 맨 아래 줄에 있어도 메뉴가 잘리지 않는다(잘리면 `bottom-full` 로 위로 여는 방식으로 바꾼다).

---

### Step 5. 글자 크기 설정과 한글 글꼴

**5-1. 글자 크기 토큰을 `px` 에서 `rem` 으로 바꾼다.** `app/src/tailwind.css` 맨 위 `@theme { ... }` 의 `--text-*` 값만 바꾼다. 기본(루트 16px)에서는 **계산된 픽셀이 지금과 똑같아야 한다**(보통 크기에서 화면이 한 픽셀도 달라지면 안 된다).

| 토큰 | 지금 | 바꿀 값(글자 / 줄간격) |
|---|---|---|
| `--text-body-md` | 16px / 24px | `1rem` / `1.5rem` |
| `--text-title-md` | 20px / 28px | `1.25rem` / `1.75rem` |
| `--text-display-lg` | 48px / 56px | `3rem` / `3.5rem` |
| `--text-caption` | 12px / 16px | `0.75rem` / `1rem` |
| `--text-headline-lg-mobile` | 24px / 32px | `1.5rem` / `2rem` |
| `--text-headline-lg` | 32px / 40px | `2rem` / `2.5rem` |
| `--text-label-md` | 14px / 20px | `0.875rem` / `1.25rem` |
| `--text-body-lg` | 18px / 28px | `1.125rem` / `1.75rem` |

(`--text-…--line-height` 값도 같은 표대로 바꾼다. `letter-spacing`·`font-weight` 는 그대로.)

**5-2. 크기 단계.** `@theme` 아래에 다음을 둔다.

```css
@layer base {
  html[data-font-scale='large'] { font-size: 112.5%; }  /* 18px 기준 */
  html[data-font-scale='xlarge'] { font-size: 125%; }   /* 20px 기준 */
}
```

토큰이 `rem` 이 되었으므로 이 두 줄만으로 토큰 글자와 `text-sm`·`text-lg` 같은 `rem` 기반 글자가 **함께** 커진다. `text-[13px]` 같은 픽셀 고정 글자와 아이콘은 그대로다(의도된 한계).

**5-3. `app/src/lib/fontScale.ts` (새 파일).**

- `export type FontScale = 'normal' | 'large' | 'xlarge'`, 저장 키 `classbank.fontScale`(localStorage, 읽기·쓰기는 `try/catch` — 저장소를 못 써도 앱은 보통 크기로 정상 동작).
- `getFontScale()`, `applyFontScale(scale)`(`normal` 이면 `document.documentElement` 의 `data-font-scale` 속성을 지우고, 아니면 값을 넣는다), `setFontScale(scale)`(저장 + 적용 + `window` 에 `CustomEvent('classbank:fontscale')` 발행), `useFontScale()`(`useSyncExternalStore` 로 그 이벤트를 구독해 `[scale, setScale]` 을 돌려줌 — 토글이 두 군데 있어도 서로 맞는다).
- `app/src/main.tsx` 맨 위(`createRoot` 보다 앞)에서 `applyFontScale(getFontScale())` 를 한 번 부른다(첫 화면에서 크기가 깜빡이지 않게).

**5-4. `app/src/components/FontSizeToggle.tsx` (새 파일).**

- `role="group"` + `aria-label={t('fontScale.label')}` 안에 버튼 3개. 버튼 글자는 모두 "가"이고 크기만 다르게 **픽셀 고정**(13px · 16px · 19px — 토글 자체가 크기 설정에 따라 커지지 않게). 각 버튼에 `aria-pressed`, `aria-label`(보통/크게/아주 크게), `title`. 버튼 높이 `min-h-9` 이상, 모양은 `LanguageToggle` 과 같은 알약.
- 데스크톱 상단바에서는 알약 옆에 보이는 글자 `글자 크기`(`hidden lg:inline`)를 붙인다.
- i18n(`ko.ts`·`en.ts`, 새 최상위 블록 `fontScale`): `label`(글자 크기 / Text size) · `normal`(보통 / Normal) · `large`(크게 / Large) · `xlarge`(아주 크게 / Extra large).
- **둘 다 넣는다**: `AppLayout` 의 데스크톱 상단바(`<LanguageToggle />` 바로 앞)와 `sidebarContent` 아래쪽(`<LanguageToggle />` 가 있는 줄 — 모바일 서랍에서 쓰는 자리).

**5-5. 한글 글꼴.** `@theme` 의 `--font-*` 에서 영문 폰트 **바로 뒤에** `'Noto Sans KR'` 을 끼운다(이미 파일 맨 위에서 불러오고 있다). 영문은 지금처럼 Hanken Grotesk·Quicksand 로, 한글은 어느 기기에서나 Noto Sans KR 로 나오게 하려는 것이다.

```css
--font-body-md: 'Hanken Grotesk', 'Noto Sans KR', sans-serif;   /* caption·label-md·body-lg 도 같은 식 */
--font-title-md: 'Quicksand', 'Noto Sans KR', sans-serif;       /* display-lg·headline-lg·headline-lg-mobile 도 같은 식 */
```

**완료 기준**
- 글자 크기 "보통"에서 화면이 이전과 같다. "크게"·"아주 크게"에서 사이드바·수업 카드·게임 카드·설정 화면의 글자가 눈에 띄게 커지고 줄바꿈 때문에 버튼이 깨지거나 잘리지 않는다(확인 방법은 6-2).
- 선택이 새로고침 뒤에도 유지되고, 상단바 토글과 서랍 토글이 서로 맞는다.
- 한글이 Noto Sans KR 로 그려진다(브라우저 개발자 도구의 렌더된 글꼴 또는 `document.fonts` 로 확인할 수 있으면 확인, 어려우면 CSS 값 확인으로 대신).

---

### Step 6. 문서와 마무리 점검

**6-1. `CLAUDE.md` 를 고친다**(저장소 루트). 늘리지 말고 **25줄 안**에서 끝낸다.

1. "정보 구조 (로그인 후)"의 첫 줄 `선생님(staff): 사이드/하단 내비 — 대시보드, 학생관리, 통장(/board), 게임, 단어 사전, 파닉스, 리포트(/results). 기본 진입 /dashboard.` 를 새 구조로 바꾼다: `선생님(staff): 사이드바 5개 묶음 — 오늘(/dashboard) · 수업(/curriculum) · 자료(게임 /games · 활동지(인쇄) /materials · 단어장 /wordlists · 그림 사전 /dictionary · 파닉스 /phonics · 문법 /grammar · 수업 영상 /videos) · 우리 반(학생·출석 /attendance · 칭찬 통장 /board · 숙제 /homework · 기록 /results) · 더보기(설정 · 도움말 · 요금제). 정의는 app/src/lib/navGroups.ts. 기본 진입 /dashboard.`
2. "꼭 지킬 것" 6번의 "`number`(참고용…)와 `category`(…)를 붙인다"에 **`moment`(수업의 순간, 필수 — `GAME_MOMENTS` 7칸)** 를 더하고 `category` 는 옛 분류라고 적는다. 카드에 번호·왕관을 달지 않는다는 것도 한 줄.
3. "정보 구조"에 짧은 항목 하나를 더한다 — **"화면 정리 1단계(2026-10-16)"**: ① 이름 통일표(옛 → 새) ② 게임 `moment` 매핑 위치(`gameCatalog.ts`) ③ `StaffNav`·`navGroups.ts`·`MoreMenu`·`FontSizeToggle`·`fontScale.ts` 가 어디 있는지 ④ 글자 크기가 `html[data-font-scale]` + `rem` 토큰으로 동작한다는 것 ⑤ **아직 안 한 것(2·3단계)** 목록(아래 7번 그대로).

**6-2. 점검.**

1. `npm run build --prefix app` 통과, `npm run lint --prefix app` 에서 시작 전 기준선보다 **에러가 늘지 않았음**.
2. 옛 이름 점검: `Grep` 으로 `ko.ts`·`en.ts`·`faq.ts` 에서 `게임 센터|수업 자료실|포인트 뱅크|학생관리|대시보드|발표하기|영상 라이브러리|단어 사전|수업 세트|수업 라이브러리` 를 다시 찾아, 남은 것이 모두 "바꾸지 않는 것" 목록에 해당하는지 확인한다.
3. `git diff --stat` 에 `App.tsx`·`supabase/`·`api.ts` 가 **없어야** 한다. `app/src` 아래에 새로 생긴 파일은 `navGroups.ts` · `StaffNav.tsx` · `MoreMenu.tsx` · `fontScale.ts` · `FontSizeToggle.tsx` 다섯 개뿐이어야 한다(`docs/` 아래 파일과 이미 있던 untracked 폴더는 무시).
4. **화면 확인은 로그인 없이 열릴 때만** 한다. 개발 서버가 로그인을 요구해 막히면 **우회하지 말고**(자격증명 입력·인증 코드 수정 금지) 코드 읽기와 빌드로 대신하고, 보고서에 "화면 미확인"이라고 적는다. 화면 확인이 되면 다음을 본다: 사이드바 묶음 펼침/접힘, 게임 화면 칩과 소제목, 수업 카드 버튼과 더보기 메뉴, 글자 크기 3단계(폭 1280px 과 375px 에서 각각 — 특히 "아주 크게"에서 사이드바 글자 잘림, 수업 카드 버튼 줄바꿈).
5. 발표 모드(수업 진행바)는 이번에 건드리지 않았다. "아주 크게"에서 진행바가 넘치는지만 보고서에 적는다(고치지 않는다).

---

## 3. 이번에 하지 않는 것 (2·3단계로 미룸 — 손대지 말 것)

- "오늘" 화면 재설계(반 요일·시간, 오늘 수업 카드), 반 테이블에 요일·시간 칸 추가
- 수업 마치기 화면(출석·칭찬·숙제·알림장 자동 작성), 수업 진행 기록 저장
- 샘플 수업·첫 수업 1분 체험, 시작 전 30초 점검, 수업 중 바 단순화
- 질문 3개 수업 만들기 마법사, 교재 사진·붙여넣기 단어장
- 모바일 하단 탭 바(지금은 기존 햄버거 서랍을 그대로 쓴다)
- 슬라이드 편집기 안의 용어 통일(슬라이드·블록·레시피), 수업 카드의 색 띠·준비 체크·"활동지 한 번에 인쇄"·단원 폴더
- 게임 카드 미리보기·상단 통합 검색, 게임 소개 문구 수정, 새 게임 추가

---

## 4. 끝났을 때 보고 형식 (40줄 이내)

1. **변경 파일 목록** (새 파일 / 수정 파일 구분)
2. **이름 바꾸기 결과**: 바꾼 곳 수, 일부러 남긴 옛 이름과 이유
3. **확인한 것 / 못 한 것**: 빌드·린트 결과(기준선 대비), 화면 확인 여부
4. **눈에 띈 위험·이상한 점** (있으면): 예) 글자가 잘리는 화면, 코드와 문서가 어긋난 곳
5. 사용자 결정이 필요한 것이 있으면 한 줄로 (없으면 "없음")

커밋은 하지 않는다.
