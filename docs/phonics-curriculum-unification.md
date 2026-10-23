# 파닉스 기준 데이터 통합

> 후속 수정: 자산 누락으로 유닛 전체를 막던 정책을 활동 단위 대체로 변경했다. 현재 상태는 [워크북 선택·인쇄 수정](phonics-workbook-fallbacks.md)을 따른다.

## 조사와 변경

자료-파닉스와 자동 워크시트는 Supabase `phonics_bank`, CVC·장모음 워크북은 별도 정적 목록, 4·5단계 워크북은 DB 규칙별 묶음을 사용했다. 단어 경계와 순서, 확장 여부가 서로 달랐다. 새 기본 과정은 로컬 공통 기준에서 읽고, 기존 DB는 과거 참조를 찾을 때만 읽는다. DB 및 사용자 저장 자료를 수정하지 않는다.

## 기준 데이터와 수정 방법

- `app/src/data/phonics/curriculum.json`: 단계·규칙·소리 ID, 순서, 기본/확장 연결, `{목표 철자}`, 유닛의 명시적 ID·순서. 단어 목록은 규칙 그룹에 한 번만 기록한다.
- `app/src/data/phonics/words.json`: 단어 ID, 대소문자, 한국어 뜻, 기존 그림·선화·발음 참조, 검토 상태.
- `app/src/data/phonics/legacyWorkbookRefs.json`: 기존 숫자 참조를 안정적인 유닛 ID로 연결.
- `app/src/data/phonicsCurriculum.ts`: 목록 조회·유닛 분할·강조 위치·기본/확장 선택. 4개→2+2, 5개→3+2, 6개→3+3으로 분할한다.

수정 시 기존 ID는 유지한다. 순서를 바꾸려면 order를 바꾸고, 새 유닛은 새 ID를 명시한다. 기본 단어 변경은 승인된 표와 대조한다. 그림 경로는 words.json에서 수정하고 실제 로컬 파일 및 자산 manifest도 확인한다. 자산이 없으면 null을 유지한다. 검증용 `scripts/phonics/approved-words.json`은 별도의 승인 표이며 런타임에 사용하지 않는다. 승인 표 자체가 바뀐 경우에만 함께 수정한다.

## 메뉴 연결과 파일 역할

| 파일 | 역할 |
|---|---|
| `lib/api.ts`, `lib/types.ts` | 기본 조회를 공통 데이터로 연결, 확장/legacy 명시 조회, 메타데이터 타입 |
| `components/PhonicsUnitControls.tsx`, `i18n/phonicsCourseLocales.ts` | 공통 단계·유닛·확장 UI와 번역 |
| `pages/PhonicsPage.tsx` | 자료-파닉스의 단계→규칙→유닛 탐색, 워크시트 전달 |
| `pages/PhonicsWorksheetLibraryPage.tsx` | 유닛 전체 기본 선택, 확장 opt-in, 기존 혼합 규칙 활동 유지 |
| `data/cvcWorkbook.ts`, `pages/CvcWorkbookPage.tsx` | 공통 CVC24·매직 e22, 과거 번호 해석 |
| `data/phonicsWorkbook.ts`, `pages/PhonicsWorkbookPage.tsx` | 공통 4·5단계, 자산 검증·인쇄 제한, PC2열/모바일1열 |
| `components/worksheets/CvcWorkbookSheets.tsx` | 기존 A4 렌더러 유지, 검증용 data 속성 |
| `lib/phonicsSelection.ts`, `lib/phonicsFill.ts` | 저장 카드의 표기·뜻·규칙·이미지 보존, 불명확한 규칙 추정 금지 |
| `lib/materialsHandoff.ts`, `context/LessonRunnerContext.tsx`, `components/LessonSlideSorter.tsx` | 기존 연결에 안정적 유닛 ID 전달·숫자 호환 |
| `components/LessonWordSources.tsx`, `components/worksheets/PhonicsSlidePreview.tsx` | 기존 기능의 기본 단어 선택/과거 스냅샷 보존 |
| `lib/wordBankCategories.ts`, `i18n/locales/ko.ts`, `i18n/locales/en.ts` | 공통 단계 순서 및 매직 e 제목 |

새 슬라이드·활동·숙제·Review 콘텐츠는 추가하지 않았다. 기존 분류·다른 하나 찾기, 수동 편집, CVC 파란 라벨·유닛 버튼, A4 인쇄 CSS를 유지했다. 기본 전체 표시 항목은 376개이며 단계 간 중복이 있으므로 고유 단어 수와 구분한다. 확장·후보까지 포함한 메타데이터는 394단어다.

| 단계 | 유닛 | 기본 표시 항목 | 단계 내 고유 단어 |
|---|---:|---:|---:|
| 1 | 26 | 78 | 77 |
| 2 | 24 | 68 | 68 |
| 3 | 22 | 59 | 59 |
| 4 | 48 | 105 | 104 |
| 5 | 32 | 66 | 66 |

## 호환성

기존 장모음 23~26은 seed/feed/weed, feet/meet/beet, jeep/deep/keep, seat/meat/heat의 동결된 과거 유닛으로 연결한다. 새 5단계 숫자로 추정하지 않는다. 현재 기본 목록에서 빠진 DB 항목은 삭제하지 않는다. 저장 카드의 명시적 pattern·word·meaning·imageUrl(null 포함)을 유지한다. 찾지 못한 ID나 규칙은 안내하고 관련 없는 기본 유닛을 대신 선택하지 않는다. 기존 사용자 단어장/교재에 쓰기 작업은 하지 않았다.

## 검증

- `scripts/phonics/check-curriculum.mjs`: 별도 확정표 대조, 모든 기본/확장 순서·분할·ID, Q/X·매직 e·brush 강조, th/oo/ow, 대문자, 선택지 정답, 기존1~26 참조·저장 스냅샷·잘못된 참조, 실제 자산 경로. 통과.
- `scripts/phonics/check-browser.mjs`: 실제 앱에서 -ad/-an 3메뉴 대조, 확장 off/on, 추천8개여도 기본3개 유지, 저장 카드·누락 ID, PC/모바일·인쇄·텍스트 대체 학습. 통과.
- `scripts/workbooks/check-data.mjs`: 위 기준 검사 및 기존 문법 미션 회귀 검사.
- `scripts/workbooks/render-review.mjs`, `check-flow.mjs`, `check-pdfs.py`: Fredoka/Andika 로드, 넘침 없음, 유닛당 A4 2쪽, 인쇄 메뉴 숨김, 그림 실패 시 활동 대체, DB 실패 시 로컬 자료 유지, 영문 UI. CVC/매직 e 대표 출력의 기존 대비 픽셀 차이0. 현재 전체 4단계96쪽·5단계64쪽 확인.
- TypeScript 빌드·Vite 프로덕션 빌드 통과. Oxlint 오류 없음. 기존 Fast Refresh 경고 및 빌드 번들 크기 안내는 남아 있다.

검사는 로컬에서 Supabase 응답을 가로채며 실제 사용자 데이터를 읽거나 변경하지 않는다. 상세 결과는 `output/phonics-curriculum/` 및 `output/pdf/flow-checks.json`에 있다.

## 자료 보완과 완료 범위

[자산 점검 목록](phonics-asset-review.md)에 단어·용도·유닛을 기록했다. 컬러18개·선화86개가 없으며 대상은 고유86단어다. 뜻 누락은0개다. 녹음 파일은394단어 모두 없고 기존 무료 브라우저 발음을 유지한다. glob/glum/bran/prim/prop은 교사용 친숙도·그림 표현 검토 목록으로만 노출한다.

기존 그림 활동을 모두 유지하는 유닛은 4단계19/48, 5단계25/32다. 나머지는 자산이 필요한 활동을 읽기·쓰기형으로 대체하여 4단계48/48, 5단계32/32 모두 인쇄할 수 있다. 데이터 자체의 오류는 계속 차단한다. 자산 신규 제작은 요청 범위 밖이므로 수행하지 않았다. 외부 유료 API·이미지 생성·음성 생성·배포는 하지 않았다.
