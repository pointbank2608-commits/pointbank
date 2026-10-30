# STEM 블록 편집기

2026-10-30. 사용자가 승인한 종이 다리 디자인을 유지하고, 기존 ‘수업 만들기’처럼 내용·영상·게임을 조합하는 편집 흐름을 구현했다. 운영 배포는 하지 않았다.

## 사용 방법

1. 자료 → STEM Ready Class → 수업의 ‘복제해서 편집하기’. 로컬 샘플 하단의 ‘복제해서 블록 편집’도 같은 진입점이다.
2. 왼쪽 블록 목록에서 활동을 고르고 오른쪽에서 문장·그림·배치·영상 주소·저장 게임을 수정한다. 모바일에서는 위아래로 표시하며 블록을 누르면 수정 영역으로 이동한다.
3. 블록 사이의 ‘＋ 활동 추가’로 도입·개념·단어·예측·실험·복습·보고서·마무리·그림·기존 카드 게임 또는 저장 게임·영상을 삽입한다.
4. 손잡이 끌기 또는 위/아래 버튼으로 이동한다. 키보드는 손잡이에서 Space → 화살표 → Space. 복제는 바로 다음 위치에 새 ID로 추가하며, 마지막으로 삭제한 블록은 되돌릴 수 있다.
5. ‘이 블록 미리보기’는 선택한 위치에서 시작한다. 전체 수업 미리보기와 구분한다. 저장 후 My STEM에서 다시 사용한다.

로컬 개발 진입: `/stem?copy=paper-bridges-review-v1` 또는 `/stem?copy=surface-tension-v1`. 정상 앱 로그인·기존 학원 권한을 사용한다. 신규 복제 진입 요청은 열 때 한 번 소비하여 저장 후 원본이 다시 복제되는 문제를 막는다.

## 유지와 재사용

- `curriculum_lessons.playlist`, 기존 내 수업 저장·실행·CAS 갱신·학원 RLS를 유지한다. 새 DB·SQL 적용은 없다.
- 기존 dnd-kit 정렬 도구, 공통 그림 선택기·업로드, YouTube URL 검사, 기존 저장 게임 목록과 게임 실행기를 재사용한다. 게임은 원본 설정을 복제하거나 덮어쓰지 않고 저장 ID로 연결한다.
- 학생용 제목·문장·그림과 승인된 동적 디자인은 그대로 수정·미리보기할 수 있다. 비교 그림의 설명과 그림도 편집한다.
- 보고서 블록의 선택적 `report` 필드를 추가했다. 예전 데이터는 기존 `stemMeta.report`를 그대로 사용하며, 복제한 보고서는 독립 문항으로 수정할 수 있다. 화면·미리보기·인쇄는 같은 보고서 컴포넌트다.
- 기존 기본 수업·단어·유닛 ID를 변경하지 않는다. 교사 복제본만 저장한다. 새로운 수업의 원래 공개 범위를 확대하지 않는다.

## 수정 파일

- `app/src/components/stem/StemEditor.tsx`: 좌우 블록 편집, 삭제 복구, 개별 보고서·그림 편집.
- `StemBlockList.tsx`, `StemBlockPicker.tsx`: 목록·정렬·삽입 선택창.
- `StemPlayer.tsx`, `StemFrameView.tsx`, `StemIllustratedSlide.tsx`: 선택 위치 미리보기, 블록별 보고서, 그림 없는 내용의 배치.
- `app/src/lib/stemBlocks.ts`, `stemTypes.ts`, `stem.ts`: 기존 프레임 삽입·이동·복제 및 보고서별 검증.
- `app/src/pages/StemLibraryPage.tsx`: 복제 링크·저장·보고서 미리보기 연결.
- `app/src/i18n/stemBlockLocales.ts`, `stemLocales.ts`, `app/src/styles/stem-blocks.css`.
- `app/scripts/stem/sample.tsx`: 실제 편집기로 연결하는 링크.

## 검증

`app/scripts/stem/check-block-editor.mjs`의 브라우저 검사 8개 통과: 원본 17블록 보존, 게임 중간 삽입·복제·삭제 복구, 영상 주소 검증·교체, 버튼·키보드 정렬, 문장 수정·선택 위치 미리보기, 실제 저장 형식에 저장·재로딩, 개별 보고서 분리, 모바일 가로 넘침 없음, 원본 및 보고서 검증.

기존 `check-stem.mjs`의 14개 회귀 검사도 통과했다. TypeScript·Vite 빌드, 관련 파일 oxlint 및 공백 검사 통과. 기존 번들 크기 경고는 남아 있다.

검사 결과·화면: `output/stem-block-editor/checks.json`, `blocks-desktop.png`, `blocks-mobile.png`. 저장·업로드 검사는 API/Supabase를 대체한 격리 환경이다. 운영 DB에는 쓰지 않았고 실제 외부 영상 재생·삼성 칠판 하드웨어 시험은 하지 않았다. 기존 로그인 상태에서의 운영 저장 확인은 배포 후 별도로 필요하다.

커밋·푸시·배포·대량 생성 자동화는 하지 않았다.
