# 활동지(인쇄) 파닉스 이름·진입 경로·유닛 선택 화면

2026-10-24 구현·검증 완료. 이전 1단계 구현 커밋 `de6d230`의 프로덕션 배포와 실제 서비스 화면 검증은 완료했다. 2026-10-25 사용자 요청으로 이 문서의 추가 변경도 게임 저장 오류 수정과 함께 커밋·푸시하고 자동 배포한다. 배포 결과는 해당 커밋의 Vercel 상태로 확인한다.

## 화면 변경

- 파닉스 목록은 생성기 1개 + 워크북 5개, 총 6개다. 바로가기·영역 제목·자료 개수는 모두 같은 카탈로그로 집계한다.
- `/materials/phonics`는 **파닉스 워크시트 생성기**로 표시한다. 배지 **규칙·단어 선택**, 버튼 **활동지 만들기**, 설명은 사용자 확정 문구를 사용한다. 내부 제목·설명과 관련 진입 링크도 맞췄다.
- 워크북은 모두 **유닛별 완성 교재** 배지와 **유닛 선택하기** 버튼을 사용한다. 제목은 1–5단계와 알파벳/단모음 CVC/매직 e/자음군과 이중자음/모음 조합·이중모음·R 모음으로 통일했다.
- 2–5단계는 실제 지원하는 선택 유닛 인쇄와 유닛당 A4 두 쪽만 설명한다. 기존 저장 자료 이전 안내는 주요 카드 설명에서 제거하고, 저장 자료 복원 동작은 유지했다.
- 1단계는 이미 배포한 `/materials/phonics-stage-1`을 재사용한다. 카드나 중간 화면을 중복 생성하지 않았다. 유닛 선택에서 워크북 버튼을 먼저 배치하고, 활동지 경로로 들어오면 뒤로가기는 활동지 목록으로 연결한다.
- 1단계 Unit 1은 Aa apple/ant/axe, Bb bag/bat/bus, Cc cap/cat/cup의 8쪽이다. p.3 학생용과 교사용 제목은 **Read and Match**, 학생 지시문은 **Read the words. Match them to the pictures.** 그대로다.
- D~Z는 기존 단일 알파벳별 기본 4쪽을 제공하고 문장 읽기는 확정 대기로 표시한다. 새 알파벳 묶음·사이트워드·문장은 추가하지 않았다.

## 선택 화면과 접근성

- 기존 CVC의 `WorkbookRuleLabel`과 `WorkbookUnitChip`을 그대로 사용한다.
- 4·5단계에서 `fieldset > legend`와 별도 버튼 블록으로 라벨이 위에 놓이던 구조를 `role="group"`과 `aria-labelledby`가 있는 가로 행으로 바꿨다.
- 규칙 라벨 열의 폭을 맞추고, 옆 버튼 영역 안에서 자연스럽게 줄바꿈한다. PC에서는 규칙 그룹 두 열, 모바일에서는 한 열이다. 실제 패널 너비를 기준으로 열을 줄이므로 좁은 창에서도 긴 단어가 화면 밖으로 나가지 않는다.
- CVC·매직 e·4·5단계가 하나의 공통 선택 패널과 전체 선택/선택 지우기 버튼을 사용한다. CVC의 기존 규칙별 줄 배치는 유지한다.
- 체크박스·선택 색상·키보드 Space·포커스 표시·다중 선택을 유지한다. 준비되지 않은 유닛은 비활성 상태와 짧은 준비 중 표시, 툴팁 사유, 기존 자료 준비 현황을 제공한다.
- 현재 실제 선택 가능한 수는 4단계 47/48, 5단계 31/32다. 준비 중인 them/then, her/fern/term 유닛의 기존 자산 부족 상태를 숨기거나 다른 단어로 바꾸지 않았다.

## 주요 파일

- `app/src/lib/materialsCatalog.ts`: 기존 ID·URL 유지, 생성기/워크북 준비 방식 메타데이터 구분.
- `app/src/i18n/locales/ko.ts`, `en.ts`, `materialBrowserLocales.ts`, `phonicsStage1Locales.ts`, `phonicsCourseLocales.ts`: 제목·설명·배지·버튼·관련 링크 문구.
- `app/src/components/worksheets/WorkbookSelectionPanel.tsx`: 기존 CVC 형태를 추출한 공통 패널.
- `app/src/styles/workbook-selection.css`: 4·5단계 공통 가로 행·열·줄바꿈 배치.
- `app/src/components/worksheets/CvcWorkbookSheets.tsx`: 기존 칩에 비활성 사유 툴팁만 추가. 인쇄 템플릿은 변경하지 않았다.
- `app/src/pages/CvcWorkbookPage.tsx`, `PhonicsWorkbookPage.tsx`: 공통 선택 패널 적용, 목록과 같은 제목 사용.
- `app/src/pages/PhonicsStage1Page.tsx`, `PhonicsWorksheetLibraryPage.tsx`: 기존 워크북 진입·뒤로가기·생성기 설명 연결.
- `app/scripts/phonics/check-workbook-navigation.mjs`, `check-workbook-navigation-pdf.py`: 실제 UI와 수정 전후 인쇄 비교.
- `app/scripts/phonics/check-stage1-integration.mjs`: 새 제목에 맞춰 기존 테스트 선택자 갱신.

## 검증 결과

- TypeScript 빌드, Vite 프로덕션 빌드, 변경 화면과 새 컴포넌트의 lint 통과. 기존 큰 번들 경고는 남아 있다.
- 기존 `check-curriculum.mjs` 통과. 공통 단어표·단어 자산 데이터·유닛 생성 로직·1단계 콘텐츠 원본의 SHA-256이 수정 전과 같다.
- 목록 6개 카드의 이름·설명·배지·버튼·기존 URL, 카테고리 개수, 1–5단계 내부 제목 확인.
- 1단계 기존 24개 학습 묶음과 Unit 1 8쪽 진입, p.3 학생용·교사용 제목 확인.
- 1440px PC 두 열, 390px 모바일 한 열, 글자 크게/아주 크게, 모든 실제 규칙명·단어 버튼의 줄바꿈·화면 넘침 없음 확인.
- 선택·해제·키보드 Space·포커스·두 유닛 다중 선택·전체 선택·선택 지우기 확인. 준비 중인 유닛은 전체 선택에서 제외되고, 선택 유닛 수×2와 실제 인쇄 페이지 수가 일치한다.
- 저장된 4·5단계 유닛 ID 두 개를 복원해 체크 상태와 실제 인쇄 네 쪽이 유지되는지 확인.
- 1–5단계 대표 워크북 6종의 수정 전후 PDF 12개를 만들었다. Unit 1 8쪽, 나머지 5종 각 2쪽, 총 18쪽 비교에서 글·그림·배치가 **픽셀 단위로 동일**하다. 모두 A4이며 빈 페이지나 잘림은 없다.

화면 캡처와 검증 결과는 `output/phonics-workbook-navigation/`에 있다. 학생용 인쇄물의 원래 레이아웃에는 선택 화면 스타일을 적용하지 않는다.
