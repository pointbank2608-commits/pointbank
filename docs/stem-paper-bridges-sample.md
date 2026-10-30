# Paper Bridges 검토용 수업 샘플

2026-10-30. 사용자 요청: STEM 영상 재검색·분류 → 한 수업을 표면장력 스타일로 제작 → 비교 검토 후 대량 제작 판단. 자동화·운영 공개는 이번에 시작하지 않았다.

## 디자인 2차 수정

사용자는 1차 샘플의 정적인 박스 배치보다 원본 표면장력의 역동적인 구성을 원했다. `StemIllustratedSlide.tsx`와 `stem-illustrated.css`에서 큰 윤곽선 제목·장면 전체 그림·투명 실험 대상·말풍선·강조 문구·입체 로봇을 조합했다. 표지, 실험 대상 강조, 비교, 말하기, 단어, 단계, 마무리의 배치를 구분한다. 글은 이미지에 합치지 않고 편집 가능한 상태로 유지한다.

이미지 생성 도구로 배경·표지·평면 다리·접은 다리·로봇을 제작했다. 접은 종이의 긴 주름이 두 책 더미 사이를 가로지르도록 수정하고 배경 알파를 재검수했다. 최종 경로는 `app/public/stem/paper-bridges/dynamic`과 공용 `app/public/stem/theme/science-sky.webp`, 출처는 `dynamic-artwork-audit.json`이다. 기존 원본·초기 그림은 보존했다.

새 `StemFrame.backgroundUrl`과 `StemMeta.mascotUrl`은 기존 저장 구조의 선택 필드다. 표지 그림을 변경하면 배경도 함께 변경하며, 편집기에서 ‘그림을 화면 전체 배경으로 사용’을 켜거나 끌 수 있다. 슬라이드·단어·활동·ID·보고서 내용·영상·공개 범위는 유지한다. 축소 보고서가 인쇄용 글자 크기를 유지하도록 캡션·선택지 CSS를 보정하고 마지막 쓰기 칸까지 보이는지 검사한다.

`before-redesign.png`는 첫 샘플 표지, `redesign-before-after.jpg`는 수정 전후 비교다. HTML·17장 PDF·샘플 화면을 같은 실제 렌더러에서 다시 생성했다. 문구와 그림의 자동 반복 생성은 아직 시작하지 않았다.

## 결과물

- `output/stem-paper-bridges/STEM-Video-Shortlist-22.md`: 후보 22편, 제작 우선 12편, 활동·영어·보고서·주의점.
- `output/stem-paper-bridges/video-candidates.json`: 2026-10-30 공개 YouTube 메타데이터 재조회. 22편 모두 제목·채널 조회 성공 및 임베드 허용 true. 전편 시청·음성 검수·모든 기기 재생을 확인했다는 의미는 아니다.
- `Paper-Bridges-Review.html`: 이동 버튼·방향키가 있는 독립 시각 검토 자료. 영상은 원본 외부 링크로 연다.
- `Paper-Bridges-17-Slides.pdf`, `Paper-Bridges-A4-Report.pdf`: 17장 수업과 A4 1쪽 보고서.
- `Teacher-Guide-and-Style-Review.md`: 50분 진행표·준비물·영어·과학 설명·정답·표면장력 비교표.
- `style-comparison.jpg`, `sample-overview.jpg`: 두 수업 비교와 대표 슬라이드.

## 구현 파일과 확인 위치

- `app/src/data/stemPaperBridges.ts`: 공통 STEM 모델에 17장·8단어·최종 보고서. 학생용 문장은 영어이며 교사 편집 도구에서 한국어 뜻을 확인한다.
- `app/public/stem/paper-bridges`: 새 그림 7개, 원본과 같은 의미의 동전 그림 재사용 1개, 새 준비물 그림에서 종이만 추출한 그림 1개. `artwork-audit.json`에 출처·작업 기록.
- `stemTypes.ts`의 선택적 `presentation`, `reviewSample`, `StemFrameView.tsx`, `stem.css`: 원본을 건드리지 않는 선택형 테마. 하늘색·파스텔·큰 둥근 제목·그림과 짧은 영어 문구를 분리하여 편집 가능.
- `stemLessons.ts`의 `REVIEW_STEM`, `StemLibraryPage.tsx`, `stemLocales.ts`: 개발 모드 `/stem`에만 ‘검토용 샘플 · 미공개’ 표시. production Ready STEM 목록에는 등록하지 않는다.
- 로그인 없는 개발 확인: `/scripts/stem/sample.html`; `?topic=surface`로 원본 비교, `?report=1`로 인쇄 보고서.

복제·편집·내 수업 추가·게임·보고서는 기존 STEM 기능을 재사용한다. 새 DB 테이블·별도 게임 시스템·자동 생성 관리 화면은 만들지 않았다.

## 수업 특성

평면 시험 → 영상 관찰 → 접어서 재시험 → 비교 → 재설계. 예측을 평면·접은 종이 각각 남긴다. 접으면 항상 정해진 개수 이상 버틴다는 답을 주지 않는다. 같은 종류의 새 종이, 같은 받침 간격·동전·시험 위치를 사용한다. 실패를 일으킨 마지막 동전을 제외한 직전 수를 기록한다. 모두 버티면 최대치가 아니라 ‘at least’로 기록한다.

공식 영상은 Science Buddies의 `CqYGVW2Eu6Y`이며 10번에서 자동 재생 없이 연결한다. 과학 설명의 근거는 https://www.sciencebuddies.org/teacher-resources/lesson-plans/paper-bridge-design 이다. 원 제작자의 영상·활동지는 복제하지 않았으며, 학생용 문구·보고서·삽화는 별도로 구성했다.

## 검증과 한계

- TypeScript·Vite 빌드 통과, 관련 파일 oxlint 및 공백 검사 통과.
- `check-bridge-sample.mjs`: 17장 이미지 로드·영어·넘침·카드 단어 잘림, 기존 게임 8단어 및 숨기기, 영상 URL, 보고서, 모바일, 기존 저장 형식 왕복 검사.
- 기존 `check-stem.mjs`의 표면장력·복제·저장·실패·기존 수업 통합 등 14개 회귀 검사 통과.
- 실제 출력 PDF 페이지 수: 슬라이드 17, 보고서 1. 렌더링으로 마지막 쓰기 칸까지 확인.
- API 저장 회귀 검사는 기존 격리 fixture를 사용하며 운영 DB에 쓰지 않는다. 실제 삼성 전자칠판 및 실물 실험은 미검증이다.
- 그림은 원본과 어울리도록 생성했지만 완전한 화풍 일치를 합격 처리하지 않았다. 선생님의 시각·내용 검토 후 제작 기준을 확정한다.
- HTML/PDF의 카드 게임은 시각 미리보기이며, 실제 상호작용은 웹 개발 미리보기의 기존 FindMissing에서 제공한다.

커밋·푸시·배포·예약 자동화는 하지 않았다. 대량 제작 전에는 실제 재료 사전 시험과 영상 전편 음성·자막 검토가 필요하다.
