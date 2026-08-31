# 클래스뱅크 — Claude 협업 메모

이 파일을 **현재 진실**로 본다. 초기 히스토리·옛 결정 세부는 `handoff.md`. 설치/스키마 적용은 `README.md`.

마지막 갱신: **2026-09-01** (Claude 세션: 미니게임 14종 신규 추가 + 번호/카테고리 체계 + 게임별 소개 패널)

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

선생님(staff): 사이드/하단 내비 — 대시보드, 출석부, 통장(`/board`), 게임, 리포트(`/results`). 기본 진입 `/dashboard`.

- `/dashboard` — 오늘 할 일, 실데이터
- `/attendance` — 등원·하원, 월별
- `/board` — 반 통장. 프리셋 버튼으로 지급/차감
- `/games` — 게임 19종 카드, 카테고리 필터 탭 + 번호 배지. 전체 목록은 `app/src/lib/gameCatalog.ts`가 단일 소스.
  - 1~13번 (`category: simple`, 커버 이미지 있는 5개는 `app/public/covers/game-*.jpg`): `/games/wheel` 돌림판, `/games/ladder` 사다리, `/games/order` 랜덤 공 뽑기, `/games/bomb` 시한폭탄, `/games/timer` 타이머 맞추기, `/games/tictactoe` 틱택토, `/games/saveorgive` Save it or Give it, `/games/findmissing` 사라진 항목 찾기, `/games/baskin31` 베스킨라빈스31, `/games/connect4` 4 in a row, `/games/popcorn` 팝콘 게임, `/games/passball` 공 돌리기, `/games/twodice` 두 주사위 읽기
  - 14~19번 (`category: vocabulary`, 워드월 스타일 — 이미지 없이 만든 것): `/games/quiz` 퀴즈, `/games/hangman` 행맨, `/games/truefalse` 참 또는 거짓, `/games/matchup` 매치업, `/games/whackamole` 두더지잡기, `/games/flashcards` 플래시카드
  - 각 게임 페이지 상단에 `GameInfoPanel`(접이식 "게임 소개 및 방법") — `gameXxx.infoDescription`/`infoSteps` i18n 키, 19개 전부 적용됨
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

- 이미지가 필요한 워드월 스타일 템플릿(크로스워드, 워드서치, 이미지 퀴즈 등): 이미지 업로드·생성 기능이 없어 보류. `GameItem.imageUrl?` 필드 + 업로드 UI(기존 `GameMusicPicker` 업로드 패턴 재사용 가능) 나오면 재검토.
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
| 숙제 연동 | `PassbookCard.tsx`, `ClassBoardPage.tsx`, 프리셋 `is_homework` |
| 숙제 캘린더 UI | `HomeworkCalendarPage.tsx` |
| 내비 | `AppLayout.tsx` |
| 디자인 토큰 | `app/src/tailwind.css` `@theme` |
