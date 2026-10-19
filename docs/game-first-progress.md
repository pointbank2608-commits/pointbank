> 후속 개편: 공통 입력란을 제거하고 기존 항목 편집기·자료 생성·선택적 원본 저장·집중 플레이를 적용했다. 최신 화면·검증·제약은 [preparation-play-progress.md](preparation-play-progress.md)를 우선한다. 아래는 초기 재사용 모델의 기록이다.

# 게임 우선 홈·빠른 실행 개편 (2026-10-19)

## 확인한 구조와 범위

AGENTS.md는 저장소와 상위 경로에서 발견되지 않았다. CLAUDE.md, README 및 기존 게임 워크스페이스 인수인계를 확인했다. React/Vite/TypeScript + Supabase이며 UI는 ko/en 번역 구조를 사용한다.

- `/dashboard`: 종전에는 TodayLessons의 수업 시작·만들기가 상단이었다. 홈을 게임 → 활동지 → 자료 재사용 → 내 수업 → 반 관리 순서로 바꿨다.
- `/games`, `/games/:type`: 기존 GameWorkspace와 useGameTemplates를 재사용한다. 게임판이나 게임 규칙을 복제하지 않았다.
- `/wordlists`: word_lists의 kind가 word/sentence이고 class_id=null은 학원 공용이다. 원본 자료를 복사해 임시 활동에 사용한다.
- `game_templates`: 게임별 items/config, 선택적 classroomSource 스냅샷. 기존 DB 형식은 유지한다.
- `/curriculum`: curriculum_lessons의 playlist가 활동 목록이고 game 슬라이드는 templateId를 참조한다. 옛 playlist는 effectiveSlides로 읽는다.
- `/materials/worksheet`: 기존 materialsWords 전달 방식과 워크시트 생성·인쇄를 사용한다. 새 흐름은 자료 종류와 계정·학원도 함께 전달한다.

## 변경한 동작

1. 게임·활동지·단어장을 독립 주요 메뉴로 승격했다. 내 수업·우리 반과 나머지 그림 사전/파닉스/문법/영상/관리 메뉴를 유지한다. 기존 모바일 메뉴도 같은 StaffNav를 사용한다.
2. 실제 게임 4종의 코드 기반 미리보기와 실행 링크, 게임/활동지 CTA, 실제 단어장·문장 모음과 실제 수업을 홈에 표시한다. 자료가 없으면 샘플·새 자료 경로를 제공한다. 최근 사용 기록이 있으면 우선 정렬하고 나머지는 수정일을 사용한다. 가짜 사용자 기록은 없다.
3. 샘플·직접 입력·단어장 불러오기는 DB 게임 생성 없이 진행한다. 반 연결·이름·폴더·별도 저장은 실행 조건이 아니다. 학생이 없는 경우 임시 팀 이름으로 진행 보조 도구를 사용할 수 있다.
4. 임시 활동은 계정+학원+게임별 sessionStorage에 한 개씩 보존한다. 직접 입력 중인 원문도 계정별로 보호한다. 탭을 닫으면 보존이 끝나며, 저장소가 제한되면 활동은 메모리에서 유지한다. 명시적 저장과 복구용 보존은 화면에서 구분한다.
5. 같은 자료의 게임 전환과 워크시트 전달은 저장을 만들지 않는다. 워크시트에서 게임으로 돌아갈 때도 임시 실행을 사용한다. 입력 최소 수, 단어/문장, 중복 매칭, 이미지·카테고리 등 변환 조건을 확인한다.
6. 내 활동으로 저장할 때만 기존 game_templates에 저장한다. 저장 목록에서 다시 선택할 수 있다. 기존 저장 게임·수업 실행은 유지한다. 옛 라벨·매칭/플래시카드 자료는 원본을 수정하지 않고 게임 전환에 재사용한다.
7. 수업에 추가 창은 기존 수업 선택 또는 새 수업 생성 후 명시적 추가를 요구한다. 게임 스냅샷을 따로 연결하므로 이후 게임 편집이 기존 수업에 전파되지 않는다. 기존 수업 추가는 updated_at 조건으로 동시 편집을 거절한다. 반 없는 학원 공용 수업도 목록·편집·시작 가능하도록 연결했다.
8. 이동 state의 자료도 계정·학원 소유를 확인한다. 임시 API 편집은 현재 로그인 계정을 검사한 후 로컬 자료만 변경한다. 단어장 원본이나 기존 수업은 게임 설정에서 수정하지 않는다.
9. 휴대폰 참여 보카 대회는 임시 활동에서 기존 preview 기능으로 시연한다. 실제 온라인 방과 기록은 명시적 저장 뒤 사용하도록 안내한다. 기존 요금제·학원 기능 제한은 유지한다.
10. 기존 수업 만들기 매뉴얼 원본과 4쪽 PDF를 갱신하고 네 쪽을 렌더링해 확인했다.

## 주요 파일

- `app/src/pages/DashboardPage.tsx`, `GamesPage.tsx`, `WordListsPage.tsx`, `WorksheetPrintPage.tsx`, `CurriculumPage.tsx`, `QuizShowPage.tsx`
- `app/src/lib/navGroups.ts`, `useGameTemplates.ts`, `quickActivity.ts`, `gameWorkspace.ts`, `materialsHandoff.ts`, `useMaterialsWordLists.ts`, `api.ts`
- `app/src/components/GameWorkspace.tsx`, `ActivityPreview.tsx`, `AddActivityToLesson.tsx`, `WordListGameLauncher.tsx`, `OpenInOtherGame.tsx`
- `app/src/context/GameWorkspaceContext.tsx`, `app/src/i18n/locales/ko.ts`, `en.ts`
- `docs/manuals/수업-만들기-매뉴얼.md`, `output/pdf/수업-만들기-매뉴얼.pdf`

같은 작업 폴더에서 별도로 진행 중인 SentenceSplash 관련 변경 및 기존 생성 이미지/PDF는 이 작업의 결과로 간주하지 않는다. 해당 변경을 되돌리거나 커밋하지 않았다.

## 검증

- `npm run build` (app 폴더): TypeScript + Vite 프로덕션 빌드. 번들 크기 경고가 남아 있다.
- `npm run lint` (app 폴더): 오류 없이 종료. 기존 hook/fast-refresh 등의 경고가 남아 있다.
- `node app/scripts/games/check-quick-integrity.mjs`: 실제 API 함수 + 기록용 transport. 임시 편집의 DB 쓰기 0회, 로그아웃/다른 계정 차단, 계정/학원별 복구·이동 자료 격리, 샘플 반복의 보존량 제한, 원본 불변, 저장 게임 업데이트, 옛 수업 변환, 동시 편집 거절.
- `node app/scripts/games/check-quick-activity.mjs`: 실제 홈/게임/단어장/워크시트/내 수업 컴포넌트 + 합성 API. 반·단어장·수업 없는 샘플 실행, 직접 입력 검증/보존, 게임 전환, 기존 단어장 불러오기, 명시적 저장/다시 열기, 활동지 전달, 새 수업/기존 수업 추가, 반 없는 원본 단어장 생성, 반 없는 저장 수업에서 게임 시작. 1440/768/390px 확인.
- `node app/scripts/games/check-workspace.mjs`: 현재 48개 게임 설정 열기/닫기, 게임판 portal 및 일시정지 유지, 자료 변환, 실제 반 명단/팀 설정, 태블릿/모바일, 기존 수업 발표 중 게임 교체.
- `node app/scripts/games/check-workspace-logic.mjs`: 변환 호환성·정답 유효성·원본 보존·게임 시계.
- `git diff --check`: 수정한 코드 공백 검사.
- 홈 화면: `output/game-first-home-desktop.png`, `output/game-first-home-mobile.png` (합성 데이터 예시).

## 검증의 한계와 남은 제약

- 브라우저 및 API 검사는 합성 로컬 데이터와 transport로 수행했다. 운영 계정, 실제 Supabase RLS/배포 환경, 실제 다인 온라인 대회는 검증하지 않았다.
- 48개 게임은 공통 설정창 회귀를 확인한 범위이며 모든 게임의 전체 라운드를 완료한 것은 아니다.
- 임시 보존은 이 탭 기준이다. 다른 기기·새 탭에서도 사용할 활동은 명시적으로 저장해야 한다.
- 이미지/카테고리/전용 답안이 필요한 게임과 기본 대본 역할극은 모든 단어장을 지원하지 않는다. 지원하지 않는 선택에는 필요한 조건을 안내한다.
- 수업 추가 중 서버 오류나 동시 편집 충돌이 나면 다시 선택해야 한다. 이미 만들어진 게임 스냅샷은 저장 활동으로 남을 수 있으며 수업을 덮어쓰지는 않는다.
- 운영 DB 변경, 마이그레이션, 커밋, 푸시, 배포는 수행하지 않았다.

## 로컬 확인

저장소 루트에서 `npm run dev --prefix app` 실행 후 `http://localhost:5173/dashboard`를 연다. 실제 로그인 확인에는 기존 `app/.env.local`과 테스트 계정이 필요하다. 자동 검사는 로컬 Chrome 및 기존 homework-test-tools의 Playwright를 사용하며 실제 운영 데이터에 접근하지 않는다. 이번 실행은 번들 Node 24.19.0을 사용했다.
