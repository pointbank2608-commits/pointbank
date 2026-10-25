# 목적별 워크시트 편집기

## 제공 범위

- `/materials/worksheet`: 9가지 수업 목적, 검색, 활동별 목표·사용법·시간·인원·수업 팁.
- 조사한 72가지 활동을 1차 15개, 2차 15개, 3차 42개로 제공한다. 기존 생성기를 재사용한 활동을 포함하며 72개의 별도 엔진을 만들었다는 의미가 아니다.
- 기존 기본 양식 9종도 같은 편집 흐름에서 제공한다. 기존 저장 수업의 `materialsTab` 진입과 `?legacy=1`은 이전 편집기로 연결한다.
- 완성형 파닉스 워크북의 단계·유닛·단어·페이지 구성은 변경하지 않는다.

## 편집과 저장

- 기존 단어장·문장 목록, 사전·공통 파닉스 자료를 불러와 교체하거나 추가한다. 원본 목록은 수정하지 않는다.
- 단어·뜻·예문·분류·목표 철자·발음 정보, 컬러 그림·별도 선화, 본문·문항·정답·선택지·순서를 편집한다. 활동에 필요한 필드만 표시한다.
- 본문형 자료는 교사가 본문과 문항을 함께 수정한다. 단어장 교체만으로 새로운 독해 지문을 자동 생성하지 않는다.
- 공통 파닉스의 최신 이미지 연결을 불러오며 교사가 별도 지정한 그림은 갱신으로 덮어쓰지 않는다. 색칠에는 실제 선화만 사용한다.
- 편집 내용·이름 붙인 사본은 **현재 브라우저·계정·학원 범위의 로컬 저장**이다. 서버 동기화 기능은 추가하지 않았다. 다른 기기에는 편집용 JSON 파일을 내려받아 가져온다. 저장 공간 부족은 화면에 알리고 파일 저장으로 복구할 수 있다.
- 학생용과 교사용 인쇄를 분리한다. 듣기 대본·정답을 학생용 뒤에 자동으로 붙이지 않는다.
- 불완전한 필드, 이미지 오류, 발음 정보 부족, 정답 모호성 등은 인쇄 전에 표시한다. 직접 수정한 문항은 단어 교체 시 보존하고 재검토를 요구한다.

## 샘플 보기

- 추천 72종과 기본 9종 카드에 실제 학생용 인쇄물에서 만든 썸네일과 샘플 쪽수를 표시한다. 그림이나 `샘플 보기`를 누르면 저장 자료를 건드리지 않는 미리보기 창이 열린다.
- 학생용 전 페이지와 교사용 설명·답안을 전환해서 볼 수 있다. A·B 짝 활동, 잘라 쓰는 카드, 가로 미니북도 필요한 모든 쪽을 제공한다. 전체 샘플 본문은 기존 `exampleWorksheet`와 `WorksheetActivitySheets`를 재사용하므로 별도의 단어·정답 목록을 복제하지 않는다.
- `이 샘플로 만들기`는 예시를 편집기에 연결한다. 같은 활동의 이전 수정본은 이름 붙인 사본으로 보관하고 바로 되돌릴 수도 있다. 사본 한도·저장 실패 시 이전 내용을 덮어쓰지 않으며 샘플 창 안에 이유를 표시한다.
- 썸네일 81개(WebP, 합계 약 0.8MB)는 `public/worksheets/samples`에 있다. 앞선 PDF 검증·렌더 후 `python scripts/workbooks/make-sample-thumbnails.py`로 갱신한다. manifest는 `worksheetSampleThumbnails.ts`에 생성된다. 전체 샘플 페이지는 열 때만 렌더링한다.
- `node scripts/workbooks/check-worksheet-samples.mjs`: 81개 썸네일과 학생·교사용 전체 페이지, 읽기 전용 보존, 모바일·125% 글자, Escape·포커스, 사본 보존·되돌리기·저장 공간 오류를 검사한다.

## 구현

- `worksheetActivityCatalog.ts`: 목적·활동·수업 도움말.
- `worksheetStudio.ts`: 문서 모델·검증·공통 자료 연결·파일·로컬 저장.
- `worksheetActivitySamples.ts`: 직접 작성한 예시 지문·문항과 기존 자산 연결.
- `worksheetActivityPrinting.ts`: 페이지 분할·교사용 읽기 대본·십자말 배치.
- `WorksheetStudio.tsx`, `WorksheetSourceEditor.tsx`, `WorksheetTaskEditor.tsx`: 목록·편집·저장·인쇄.
- `WorksheetActivitySheets.tsx`, `worksheet-studio.css`: 활동별 학생·교사용 A4 양식.
- 기존 `WorksheetSheets`, `worksheetGenerators`를 재사용한다. 전용 이미지나 화면별 파닉스 목록을 복제하지 않는다.
- 추가 DB 마이그레이션, 유료 API, 외부 이미지·음성 생성 없음. 외부 워크시트 원본을 복제하지 않고 활동 방식과 자체 작성 예시를 사용한다.

## 검증 명령

`app`에서 실행한다.

```text
node scripts/workbooks/check-activity-logic.mjs
node scripts/workbooks/check-activity-behavior.mjs
node scripts/workbooks/check-activity-ui.mjs --pdf
python scripts/workbooks/check-activity-pdf.py --render
node scripts/phonics/check-curriculum.mjs
node scripts/phonics/check-stage1-data.mjs
node scripts/phonics/check-workbook-navigation.mjs --ui-only
```

브라우저 검증은 테스트 계정·모의 DB 응답을 사용하고 운영 자료에 쓰지 않는다. 실제 공유 자산 파일을 로드하며 편집·복구·학생/교사 인쇄·모바일·확대 글자·긴 내용 분할을 검사한다. PDF는 실제 Chrome 인쇄 결과를 A4 크기·페이지 수·빈 쪽·텍스트 경계로 검사하고 PNG로 렌더링해 확인한다. 결과는 `output/worksheet-studio`에 남긴다.

검증 과정에서 쪽당 단어 수가 많은 정리표·가리고 쓰기 활동의 분량을 줄이고 긴 문항은 더 적은 수로 나누었다. 가로 미니북의 빈 첫 쪽과 공통 화면의 사이드바 인쇄 여백도 수정했다. 기존 파닉스 선택 화면·저장 참조 회귀 검사는 통과했다. 파닉스 기준표 검사에서 보고하는 기존 누락 자산은 이번 기능의 제작 범위와 별도이며, 선택한 활동에 필요한 이미지가 없으면 수정 안내와 함께 인쇄를 막는다.
