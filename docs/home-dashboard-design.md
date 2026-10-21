# 로그인 후 홈 시각 개선 (2026-10-21)

## 범위

`DashboardPage`와 홈 전용 CSS·번역·이미지만 변경했다. AppLayout/StaffNav의 남색 메뉴, 기존 메뉴·학원 코드·프로필·설정, 게임 설정·저장 구조는 변경하지 않았다. 홈에 없던 분류 필터를 장식용으로 추가하지 않았고 전체 게임의 기존 필터는 그대로다.

게임/활동지 실행 카드 → 민트색 자료 생성 영역 → 추천 게임 4종 → 최근 자료/내 수업 → 관리 링크 순서로 배치했다. 기존 최근 자료/수업의 각각 3개 표시, 실제 데이터 조회, 로딩·오류·빈 상태와 모든 원래 이동 상태를 유지했다. 넓은 화면에서는 자료/수업을 나란히, 좁은 화면에서는 세로로 표시한다.

## 실제 이미지

기존 로그인 전 화면의 `app/public/landing2/m-wave.webp` 책 캐릭터를 정체성 참고 원본으로 사용했다. 기존 게임 그림은 요청한 대상·구도와 맞지 않아 홈 전용 그림 6개를 새로 제작했다. 이모지 대체나 시안 잘라 붙이기는 사용하지 않았다.

| 경로 (`app/public/home/`) | 크기 | 용도 |
| --- | --- | --- |
| hero-games.webp | 800×533 | 돌림판·그림 카드·책 캐릭터, 실제 투명 배경 |
| hero-worksheet.webp | 480×480 | 종이·연필, 실제 투명 배경 |
| game-wheel.webp | 640×400 | 돌림판 |
| game-matchup.webp | 640×400 | 그림과 낱말 짝 |
| game-unscramble.webp | 640×400 | 책 캐릭터와 문장 조각 |
| game-treasuredig.webp | 640×400 | 보물상자·삽·모래 |

WebP 6개 합계 183,956바이트. 히어로는 즉시 로드하고 추천 썸네일은 지연 로드한다. 이미지 크기·비율을 예약했다. 생성 원본/투명도/용량은 `home-assets-manifest.json`, 정확한 생성 프롬프트는 `home-assets-prompts.json`에 기록했다.

## 주요 파일

- app/src/pages/DashboardPage.tsx
- app/src/styles/home-dashboard.css (홈 루트 아래로 스타일 한정)
- app/src/i18n/homeLocales.ts 및 locales/ko.ts, en.ts
- app/public/home/*.webp
- app/scripts/home/{home.html,home.tsx,check-home.mjs} (로컬 합성 브라우저 검증)

## 검증

- `npm --prefix app run build`: TypeScript + Vite 성공. 기존 대형 청크 안내만 남음.
- `npm --prefix app run lint`: 성공. 저장소의 기존 경고는 남음.
- `node app/scripts/home/check-home.mjs`: 로컬 Chrome 성공. 실제 React 페이지/라우터를 사용하며 인증/API만 합성 데이터로 대체한다. 운영 데이터를 생성하거나 수정하지 않는다.
- 단어장/문장 생성 진입 상태, 내 자료 불러오기, 게임/활동지 선택, 추천 4종 준비 화면, 기존 게임 만들기 대화상자, 자료 재사용 시 소유자·학원·항목 전달, 수업 추가 대화상자 진입(자동 생성 없음), 기존 수업 시작/새 수업 진입 상태를 확인했다.
- 빈 상태·샘플 진입, 조회 실패/재시도, 영어 전환, 아주 큰 글자/긴 이름, 이미지 6개 정상 로드, 자료/수업 각 3개 유지, 가로 넘침 없음, 브라우저 런타임 오류 없음.
- 화면: 데스크톱 1586×1050, 노트북 1366×900, 태블릿 820×1180, 모바일 390×844.
- 실제 스크린샷을 시안과 비교해 히어로 그림 크기·간격, 카드 높이, 자료 생성 버튼, 추천 카드와 큰 글자 활동지 버튼을 조정했다. 기존 첫 방문 안내는 유지하며 캡처에서만 실제 닫기 버튼으로 닫았다.

스크린샷: `output/home-desktop.png`, `home-desktop-viewport.png`, `home-laptop.png`, `home-tablet.png`, `home-mobile.png`, `home-english.png`, `home-large-text.png`.

## 확인 한계 및 로컬 실행

운영 계정 인증·실제 DB 권한/RLS·수업 추가 확정 저장은 이번 합성 검증에서 확인하지 않았다. 데이터/저장 코드는 변경하지 않았다. Safari와 실제 휴대폰 장치는 확인하지 않았다. 필요한 이미지 누락은 없다. 운영 배포·커밋·푸시는 하지 않았다.

`npm --prefix app run dev` 실행 후 로그인하여 `/dashboard`에서 확인한다. 로그인 없이 동일 UI의 검증은 위 Chrome 검사 스크립트를 사용한다.
