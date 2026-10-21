# 활동지 탐색 개선 (2026-10-21)

## 변경 범위

- `/materials`의 카테고리 바로가기, 준비 방식 배지, 카드 배치만 개선했다.
- 기존 AppLayout/StaffNav의 남색 메뉴·로고·프로필·학원 코드·하위 메뉴와 자료 생성/편집/인쇄 페이지는 수정하지 않았다.
- 자료 14종의 제목·설명·썸네일·경로 및 기존 섹션 내 순서를 유지한다. 이미지 신규 제작/교체, 데이터 모델 변경은 없다.
- 모든 자료는 같은 페이지에 남는다. 카테고리는 필터가 아닌 실제 `#materials-…` 앵커 링크다.

## 카탈로그와 배지

`app/src/lib/materialsCatalog.ts`에서 각 자료의 `category`, `preparation`, `displayOrder`를 관리한다. `materialSections()` 결과 하나로 바로가기·섹션·개수를 모두 렌더링한다. 현재 단어 학습 4종, 파닉스 3종, 게임 카드·기록지 3종, 역할극 4종이다. 카테고리가 지정되지 않은 신규 자료도 기타 영역에 나타난다.

배지 색/동작 표시는 `MATERIAL_PREPARATIONS`, 한국어/영어 문구는 `app/src/i18n/materialBrowserLocales.ts`에 있다.

| 자료 | 준비 방식 | 카드 동작 문구 |
| --- | --- | --- |
| 주제별 워크시트 | 주제 선택 | 만들기 |
| 워크시트·시험지, 플래시카드, 메모리 카드, 빙고 | 단어장·직접 입력 | 만들기 |
| 파닉스 워크시트 | 규칙 선택 | 만들기 |
| CVC·장모음 워크북 | 유닛 선택 | 유닛 고르기 |
| 미스터리 박스·번개 피하기·역할극 | 자료 종류·옵션 선택 | 인쇄 설정 |

`MaterialsWordPicker`의 단어장/사전 불러오기와 직접 입력을 확인했다. 게임 카드/역할극은 원래 화면에 종류·언어·정답·배치 등의 옵션이 있어 바로 인쇄로 표시하지 않는다. 카드 전체는 하나의 링크이며 하단 동작 표시는 비대화형 span이다.

## 이동 및 접근성

- `useMaterialNavigation.ts`: 실제 스크롤 조상을 탐색한다. 현재 AppLayout은 문서 스크롤이다.
- 보이는 공통 헤더 및 카테고리 바를 ResizeObserver로 측정해 sticky 위치와 제목 여백을 계산한다. 글자 크기·반응형·모바일 안전 영역 높이도 반영한다.
- 클릭 이동 중 활성 표시를 유지하고 직접 스크롤/바닥 도달 시 갱신한다. 모바일 활성 앵커가 가로 영역 밖이면 다시 노출한다.
- 클릭 시 해시만 replaceState로 갱신하여 방문 기록을 추가하지 않는다. 최초 해시/새로고침/hashchange를 지원한다.
- `prefers-reduced-motion`에서는 즉시 이동한다. 키보드 앵커 활성화 후 해당 제목으로 포커스를 옮긴다. 현재 카테고리는 `aria-current="location"`으로 제공한다.
- 스타일은 `.materials-browser` 아래로 한정한다. 카테고리 z-index는 15로 공통 헤더/드로어보다 낮다. 모바일 바는 한 줄 가로 스크롤이다.

## 검증

- `npm --prefix app run build`: 타입 검사 및 Vite 빌드 성공. 기존 대형 청크 안내는 남는다.
- `npm --prefix app run lint`: 성공. 기존 저장소 경고는 남으며 이번 변경 파일 경고는 없다.
- `git diff --check`: 통과(기존 LF/CRLF 안내 제외).
- `node app/scripts/materials/check-materials.mjs`: 로컬 Chrome 통과. 실제 AppLayout과 자료 14종 페이지를 사용하고 인증/API만 합성 데이터로 대체한다.
- 카테고리별 실제 개수, 자료 14종 유지, 신규 미분류 자료 자동 노출, 중첩 링크/버튼 없음.
- 부드러운 앵커 이동·제목 가림 없음·키보드 이동 및 제목 포커스·방문 기록 추가 없음·직접 스크롤·마지막 영역 활성·고정 바.
- 해시 직접 진입/새로고침, 동작 줄이기 설정.
- 모든 카드의 실제 기존 페이지 진입, 직접 입력/저장 단어장 불러오기 후 미리보기, 활동지 인쇄 호출, CVC/장모음 유닛 선택과 인쇄 호출.
- 영어, 큰 글자, 1586×1050 데스크톱/820×1180 태블릿/390×844 모바일. 이미지 정상 로드 및 페이지 가로 넘침 없음.
- 모바일 터치 이벤트 가로 스와이프와 탭, 스크롤 시 활성 버튼 노출. 브라우저 런타임 오류 없음.

최종 스크린샷을 직접 확인했다. `output/materials-desktop.png`, `materials-desktop-viewport.png`, `materials-mobile.png`, `materials-mobile-viewport.png`, `materials-mobile-sticky.png`, `materials-tablet-viewport.png`, `materials-large-text.png`, `materials-mobile-large.png`.

## 한계와 로컬 확인

운영 계정의 인증/DB 권한, 실제 프린터 출력 및 운영체제 인쇄 대화상자는 검증하지 않았다. 인쇄 테스트는 window.print 호출을 가로채는 방식이다. 실물 휴대폰과 Safari는 확인하지 않았다. 운영 배포·커밋·푸시·파괴적 데이터 변경은 하지 않았다.

`npm --prefix app run dev` 실행 후 로그인하여 `/materials`에서 확인한다. 로그인 없는 합성 검증은 위 브라우저 스크립트를 실행한다.
