# 파닉스 독립 인쇄물과 수업 자료 분리

## 검토 화면

로컬 개발 서버 `http://127.0.0.1:5260`에서 로그인 후 확인한다.

- 독립 알파벳 워크북: `/materials/phonics-stage-1`
- 기존 단어·소리 학습: `/phonics`
- 비공개 수업 구조: `/phonics?tab=course`
- 보존된 ABC 슬라이드·연계 워크북: `/phonics/stage-1` (개발 모드에서만 실행)

`PHONICS_TEACHING_PREVIEW = import.meta.env.DEV`로 제한한다. 운영 빌드에서는 탭을 노출하지 않고 `?tab=course`로도 활성화할 수 없다. 이전 슬라이드 URL도 검토 중 안내만 표시한다. 새로운 서버 자료·이미지 업로드·수업 등록은 수행하지 않았다. 사용자의 커밋·푸시·배포 지시에 따라 독립 인쇄물 변경을 운영에 반영한다. 새 수업 탭과 실행 화면은 운영 빌드에서 계속 비공개로 유지한다.

## 독립 인쇄용 1단계

- 공통 기준표의 알파벳별 26유닛·78학습 항목을 그대로 사용한다. 단어의 종류·순서·유닛 ID는 변경하지 않는다.
- `PhonicsWorkbookPage`와 기존 노란색 `CvcUnitPages`를 재사용해 유닛당 A4 2쪽, 6활동을 제공한다. 미니 리더스·사이트워드·문장 활동과 차시 실행 버튼은 인쇄 메뉴에서 제외했다.
- 제목에서 Aa처럼 대·소문자를 함께 표시한다. 빨간 강조와 빈칸은 공통 주석의 실제 위치를 따른다. Xx의 box·fox·six는 끝 x가 대상이다. Qq 인쇄에서는 q만 대상으로 삼지만 공통 음가 규칙 `{qu}`는 수정하지 않는다.
- Match는 기존 그림 순서 회전 로직으로 정답이 같은 줄에 오지 않게 배치한다. Color는 실제 선화만 사용한다.
- 전체 선택·선택 지우기·다중 선택·키보드·인쇄 준비 검사를 유지한다. 이미지 검사 중 전체 선택하더라도 뒤늦게 로딩되는 유닛을 빠뜨리지 않게 했다.
- 현재 저장소 자산 기준 18유닛·36쪽이 준비되었다. 아래 선화 문제로 8유닛은 준비 중이다. 빠진 단어나 빈 Color 활동으로 인쇄 완료 처리하지 않는다.

## 자산 현황

기준 단어 78항목의 컬러 이미지 파일은 모두 존재한다. 기존 DB 공개 조회에서 사용자 기록이 반환되지 않은 사실만으로 이미지 부재를 판단하지 않았으며, 공통 매핑과 실제 정적 파일을 함께 확인했다. 로그인한 계정의 최신 공유 미디어는 기존 `fetchPhonicsBank` 경로로 계속 반영된다.

| 유닛 | 단어 | 필요한 자료 / 확인 결과 |
|---|---|---|
| Aa | axe | 색칠용 선화 없음 |
| Bb | bat | 기준 뜻·컬러 그림은 박쥐인데 기존 선화는 야구방망이. 잘못된 선화 연결만 해제, 원본 파일 보존 |
| Gg | garden | 색칠용 선화 없음 |
| Ii | insect | 색칠용 선화 없음 |
| Qq | question | 색칠용 선화 없음 |
| Tt | top | 색칠용 선화 없음 |
| Uu | up, under | 색칠용 선화 없음 |
| Ww | watch | 색칠용 선화 없음 |

공통 `words.json` 변경은 `pw-bat.lineartUrl` 한 필드뿐이다. 단어·뜻·컬러 그림과 다른 선화는 변경하지 않았다. `leg` 선화는 원본을 열어 실제 다리 그림임을 확인하고 유지했다. 새 그림 제작은 하지 않았다.

## 비공개 수업 탭

- 단계 → 수업용 유닛 → 슬라이드/연계 워크북 순서. PC는 2열, 모바일은 1열이다.
- 기존 ABC 9단어 묶음과 기존 D~Z 알파벳별 수업 구조를 참조한다. 기존 슬라이드·하늘색 연계 교재·페이지 IDs는 삭제하지 않는다.
- CVC 수업용 Unit 1은 `cvc-ad`, `cvc-ag`, `cvc-am`을 참조해 dad·bad·sad·bag·tag·wag·jam·ram·ham 9단어로 구성한다. 독립 CVC 24유닛은 그대로다.
- 기존 ABC 수업과 8쪽 교재를 개발 미리보기에서만 재사용한다. 전체/낱장 선택을 연계 교재 화면으로 전달한다. 추가 복습은 본수업과 별도 영역으로 설명한다.
- CVC 수업 콘텐츠와 3~5단계 새 수업 묶음·교재는 확정 콘텐츠가 없어 실행 버튼을 활성화하지 않는다. 임시 슬라이드나 시안 이미지를 콘텐츠로 등록하지 않는다.
- 과거 저장 수업의 `phonicsStage1` 참조는 별도 수업 URL로 연결해 알파벳 인쇄 유닛으로 오해석하지 않는다. 새로운 독립 인쇄 자료를 추가할 때 과거 ABC 슬라이드 참조를 자동 생성하지 않는다.

## 주요 파일과 검증

- 공통 렌더링 확장: `src/data/phonicsWorkbook.ts`, `src/pages/PhonicsWorkbookPage.tsx`, `src/styles/workbook-selection.css`
- 화면·동선: `src/App.tsx`, `src/pages/PhonicsPage.tsx`, `src/pages/PhonicsStage1Page.tsx`, `src/lib/materialsCatalog.ts`
- 수업 구조·미리보기: `src/data/phonicsTeachingCourse.ts`, `src/components/phonicsStage1/PhonicsTeachingPreview.tsx`, `src/styles/phonics-teaching.css`, `src/i18n/phonicsTeachingLocales.ts`
- 저장 수업 호환: `src/context/LessonRunnerContext.tsx`, `src/components/LessonSlideSorter.tsx`
- 확인된 자산 연결 정정: `src/data/phonics/words.json`

검증은 테스트 계정·모의 DB 응답을 사용하며 운영 자료에 쓰지 않는다. 실제 로컬 이미지 파일과 실제 인쇄 렌더러를 사용한다.

```text
node scripts/phonics/check-print-course-separation.mjs
node scripts/phonics/check-workbook-navigation.mjs
python scripts/phonics/check-print-course-pdf.py
PHONICS_QA_URL=<vite preview 주소> node scripts/phonics/check-print-course-separation.mjs --production
```

결과: `output/phonics-print-course`와 `output/phonics-separation-*.log`. 기존 2~5단계 인쇄 내용은 이전 검증 결과와 비교했다. 새 알파벳은 전체 36쪽과 Xx 2쪽의 실제 PDF 크기·페이지 수·6활동 제목·텍스트 경계를 확인하고 PNG로 렌더링해 검수했다. 단어표와 유닛 ID, 4·5단계 선택 레이아웃, lk 제외 상태를 유지했다. 운영 빌드 비공개 게이트도 별도로 확인한다.
