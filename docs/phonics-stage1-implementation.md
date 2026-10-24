# 파닉스 1단계 수업·워크북 구현

2026-10-24. 파닉스 1단계 구현 및 검증 기록.

## 사용 경로

- 자료 → 파닉스 → 1단계 → **파닉스 1단계 · 슬라이드와 워크북**
- 활동지(인쇄) → 파닉스 1단계 카드
- `/materials/phonics-stage-1` (`/phonics/stage-1` 호환 경로)
- 유닛 선택 → 1차시/2차시 → 교사가 다음 장·정답 공개 → 필요할 때 선택 연습
- 워크북에서 전체 또는 필요한 쪽 선택 후 인쇄. 교사용 안내·정답은 별도 화면과 인쇄물.
- **내 수업에 저장하기**: 기존 수업의 자료 블록 3개(1차시, 2차시, 워크북)를 저장한다. 기존 편집기에서도 유닛·차시·선택 연습·워크북을 바꿀 수 있다.
- 방향키와 PageDown/PageUp 리모컨은 해당 차시 안에서 이동한다. 1차시 마지막의 다음 버튼은 2차시 시작으로 바뀐다.

## 확정 범위

- 기존 26개 알파벳 단위, 78개 학습 항목(77개 고유 단어)을 사용한다.
- Unit 1은 Aa/Bb/Cc를 묶고, Bb 대표 단어는 **bag**이다. Cc는 사용자 확정 순서 **cap, cat, cup**으로 정리했다. 다른 단계는 변경하지 않았다.
- Unit 1: 필수 78장(1차시 38장, 2차시 40장) + 선택 20장, 학생용 A4 8쪽.
- Dd~Zz: 사용자 답변에 따라 기존 단일 알파벳 구성을 유지한다. 각 30장 필수 + 7장 선택, 기본 워크북 4쪽. 새 유닛 번호·사이트워드·문장 패턴을 만들지 않았다.
- 미확정 읽기 콘텐츠는 선택 화면·편집기·교사용 안내에서 구분한다. Unit 1처럼 8쪽 완성으로 표시하지 않는다.

## 데이터와 이미지

- `app/src/data/phonicsStage1.ts`: 공통 기준 데이터에서 유닛을 구성하고 슬라이드·문제/정답 쌍·Missing 배치·워크북 연결을 만든다.
- `app/src/data/phonics/stage1Course.json`: Unit 1의 승인된 묶음, 대표 단어 ID, 네 읽기 문장 대상 ID와 고정 장면 좌표만 보관한다.
- 단어 표기·뜻·목표 철자·컬러 그림·음성 정보는 기존 `curriculumEntries` / `fetchPhonicsBank` 결과에서 가져온다. 수업 저장에는 단어 복사본 대신 유닛 ID와 차시 참조만 넣는다.
- 유닛·슬라이드·워크북·문제 쌍·Missing 라운드는 안정적인 ID로 연결한다. 표시 번호는 현재 구성 순서로 계산한다.
- X의 끝 글자와 Q의 `qu`는 공통 데이터의 목표 위치를 따른다. 같은 fox 이미지라도 F/X 강조 위치가 다르다.
- 최신 사용자 이미지 URL은 자료 카드와 워크북 모두 같은 공통 미디어 병합 결과를 따른다. 예전 이미지 URL만 따로 나열하지 않는다.
- Unit 1의 그림자 9개는 제공된 최신 슬라이드 PDF의 원본 내장 그림을 추출했다. 원본 페이지 PNG는 프로젝트의 `public/phonics-stage1-reference/`에 보관하고 SVG 뷰포트로 그림 부분만 표시한다.
- 색상 그림이 새 이미지로 바뀌면 이전 그림자를 짝지어 사용하지 않는다. 해당 퀴즈는 일반 그림을 제시하는 정적인 문제로 제공한다. D~Z도 그림자 자료가 없는 항목은 같은 방식이다.
- 읽기 슬라이드 7장과 워크북 p.7은 동일한 장면 컴포넌트·단어 ID·좌표를 공유한다. 읽기 장면의 위치와 크기는 고정하고 화살표·문장만 바꾼다.

## 인쇄와 정답

- A4 세로, 기존 앱 인쇄 여백 12mm, 학생 페이지 186×273mm.
- p.3은 최신 지시에 맞춰 **Read and Match / Read the words. Match them to the pictures.**
- 쓰기는 그림·단어·회색 따라 쓰기·독립 쓰기를 구분한다. 독립 칸에 답을 넣지 않는다.
- 듣기 문항의 읽을 단어와 정답, 그림 선택 위치, 연결 슬라이드 번호는 별도 교사용 문서에서 제공한다.
- 그림을 미리 디코딩하고 현재 유닛 그림이 모두 확인됐을 때 인쇄를 허용한다.
- 앱 메뉴와 발표 조작부는 인쇄에서 제외한다. 학생용과 교사용 내용을 한 DOM에 숨겨 섞지 않는다.

## 부족하거나 미확정인 자료

- 확정된 1단계 컬러 그림: 파일 및 브라우저 디코딩 기준 누락 없음.
- 실제 알파벳 음가 녹음과 단어·문장 녹음 파일: 없음. 기존 브라우저 영어 읽기를 실제 스피커 버튼에 연결했고, 음가는 선생님이 모델링하도록 안내한다. 녹음이나 새로운 음원을 제작했다고 표시하지 않는다.
- Dd~Zz의 사이트워드·읽기 문장·여러 글자 묶음표: 미확정. 기본 알파벳·단어 활동만 제공한다.
- D~Z 별도 그림자 그림은 제작하지 않았다. 이번에 허용된 정적인 원래 그림 퀴즈를 사용한다.

## 검증

- `check-stage1-data.mjs`: 24개 학습 묶음, 26개 원본 알파벳, 모든 단어 ID·목표 위치·그림 파일, Unit 1 98장·8쪽, 문제/정답 쌍과 Missing 배치, 기존 유닛 참조.
- `check-stage1-browser.mjs`: Unit 1 98장 실제 전환, 그림 로딩·정답 공개·동일 장면 좌표·화면 넘침, 24개 워크북, 전체/해제/낱장 선택, 최신 이미지 URL, 모의 수업 저장, PC/모바일 선택 화면.
- `check-stage1-integration.mjs`: 기존 수업 편집기의 유닛·차시 변경, 저장 후 발표, 리모컨, 1→2차시 전환, 발표에서 워크북 열기, D~Z 851장 전체 렌더링.
- `check-stage1-pdf.py`: 실제 PDF 26개·103쪽의 A4 크기와 정확한 페이지 수, 빈 쪽 없음. 모든 쪽을 PNG로 렌더링하고 접촉 시트로 육안 확인한다.
- 기존 `check-curriculum.mjs` 통과. TypeScript, 프로덕션 빌드, 새 구현 파일의 lint 통과. 빌드의 기존 큰 번들 경고는 남아 있다.
- 브라우저의 저장·복원은 운영 자료를 바꾸지 않는 모의 API로 검증했다. 배포는 저장소의 기존 main 푸시 → Vercel 프로덕션 자동 배포를 사용한다.

검증 결과와 학생용·교사용 PDF: `output/phonics-stage1/`.

## 주요 수정 파일

- 공통 콘텐츠와 정답: `app/src/data/phonicsStage1.ts`, `phonicsStage1Workbook.ts`, `phonics/stage1Course.json`, `phonics/stage1Artwork.json`.
- 수업·워크북 화면: `app/src/pages/PhonicsStage1Page.tsx`, `app/src/components/phonicsStage1/Stage1Art.tsx`, `Stage1SlideView.tsx`, `Stage1Workbook.tsx`, `Stage1LessonOptions.tsx`.
- 전용 스타일·문구: `app/src/phonicsStage1.css`, `app/src/i18n/phonicsStage1Locales.ts`, 한국어·영어 locale 등록.
- 기존 화면 연결: `App.tsx`, `pages/PhonicsPage.tsx`, `pages/PhonicsWorksheetLibraryPage.tsx`, `lib/materialsCatalog.ts`.
- 저장·발표·인쇄: `lib/types.ts`, `components/LessonSlideSorter.tsx`, `context/LessonRunnerContext.tsx`, `pages/AppLayout.tsx`. `context/ToastContext.tsx`에서는 저장 알림이 인쇄에 남지 않도록 `no-print`만 추가했다.
- 승인 단어 순서: `data/phonics/curriculum.json`, `scripts/phonics/approved-words.json`의 1단계 Cc만 수정.
- 검증 스크립트: `app/scripts/phonics/check-stage1-data.mjs`, `check-stage1-browser.mjs`, `check-stage1-integration.mjs`, `check-stage1-pdf.py`.
