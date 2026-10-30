# STEM Ready Class — Surface Tension

2026-10-30. 코드 구현 및 로컬 검증 완료. 운영 DB 변경·커밋·푸시·배포는 하지 않았다.

## 검토 위치

- 기존 `/stem`: Ready STEM / My STEM. Surface Tension 미리보기, 내 수업 추가, 복제 편집, 보고서 인쇄.
- 기존 내 수업: STEM 슬라이드를 다른 활동과 함께 저장하고 기존 수업 실행기로 진행한다.
- PC 화면: `output/stem-tools/ready-desktop.png`, 모바일: `output/stem-tools/ready-mobile.png`.
- 실제 인쇄 PDF: `output/stem-tools/surface-tension-report.pdf`.

## 구현

기존 `curriculum_lessons.playlist`에 STEM 프레임과 메타데이터를 저장한다. 새 테이블이나 SQL 마이그레이션은 필요 없다. 기존 인증·학원 RLS·단어장·저장 게임·수업 이미지 업로드를 재사용한다. My STEM은 현재 교사가 만든 항목을 필터링하지만 저장 권한은 기존 학원 공유 권한이며 비공개 개인 보관함이 아니다. 기존 수업에 덧붙일 때 원래 활동을 보존하며 `updated_at` 비교로 오래된 편집의 덮어쓰기를 막는다.

8개 수업 블록과 11개 레이아웃, 이미지·텍스트·단어 카드·카드 숨기기·보고서·YouTube·저장 게임 연결을 지원한다. 제목·설명·학년·시간·학습 목표·준비물·안전 안내·단어·보고서를 편집하고 슬라이드를 추가·삭제·재정렬할 수 있다. 여러 이미지 업로드는 파일명의 숫자 순서를 따른다. 업로드는 기존 수업 이미지 저장 경로와 고유 파일명을 사용한다.

Surface Tension은 첨부 PPTX의 원본 17장을 바이트 그대로 추출하여 `app/public/stem/surface-tension`에 보관했다. SHA-256과 크기는 `output/stem-tools/source-audit.json`에 기록했다. 학생 콘텐츠는 영어이고 한국어 뜻은 교사 도구에서 확인한다. 5·6번은 원본에서 추출한 그림을 공통 8단어에 연결한 편집형 카드다. 11번은 `I counted ___ drops before the water spilled.`로 수정한 별도 콘텐츠이며 넘치게 만든 마지막 방울은 세지 않는다. 12번은 기존 FindMissing을 재사용하는 실제 카드 숨기기 게임이다. 16번은 최종 보고서 안내와 인쇄 미리보기다. 기본 YouTube 링크는 없다.

보고서는 5개 영역으로 구성한 A4 세로 한 장이다. 실험 그림은 3·1·4·2 순서로 섞었고 정답 번호를 미리 적지 않았다. Word Bank 표시를 선택할 수 있다. 인쇄 전에 글꼴·이미지를 기다리고 깨진 이미지나 편집 내용 넘침은 오류로 안내한다. 다른 인쇄 화면에 STEM 인쇄 CSS가 적용되지 않도록 격리했다.

## 주요 파일

- `app/src/pages/StemLibraryPage.tsx`, `StemReadyClassPage.tsx`
- `app/src/components/stem/{StemEditor,StemPlayer,StemFrameView,StemReport}.tsx`
- `app/src/data/stemLessons.ts`, `app/src/lib/{stem,stemTypes}.ts`
- `app/src/styles/stem.css`, `app/src/i18n/stemLocales.ts`
- 기존 통합: `LessonRunnerContext`, `LessonSlideContent`, `LessonSlideSorter`, `FindMissing`, `types`, 블록 레지스트리, 수업 단어 추출 및 커버.

## 검증

- `npm --prefix app run build`: TypeScript 및 Vite 빌드 통과. 기존 번들 크기 경고는 남아 있다.
- STEM 파일 범위 oxlint: 통과. `git diff --check`: 공백 오류 없음.
- `app/scripts/stem/check-stem.mjs`: Chrome 기반 14개 검사 통과, 페이지 오류 0개. 결과는 `output/stem-tools/checks.json`.
- 실제 기존 수업 실행기에 17단계·8단어가 전달됨. 기존 일반 수업의 자동 인쇄 단계는 유지됨.
- 복제·수정·저장·재로딩, 실패 시 초안 유지, 기존 수업에 추가, 오래된 수정 차단, 이미지 순서 업로드, 기존 VideoSlide 저장, 교사별 목록, 게임 숨기기·정답 확인 검증.
- PC·390px 모바일 가로 넘침 없음. 1280×720 터치 조작과 전체화면 거부 시 확장 화면·종료 버튼 검증.
- Chrome PDF 출력 1페이지. 렌더링 이미지 `output/stem-tools/report-render.png`에서 제목부터 마지막 쓰기 칸까지 잘림 없음 확인.

저장·업로드 통합 검사는 API/Supabase 대역을 사용하는 로컬 격리 검사다. 운영 DB·스토리지에는 쓰지 않았다. 실제 삼성 전자칠판 하드웨어와 외부 YouTube 재생은 이번 검증 범위에 포함하지 않았다.

## 남은 범위

필수 그림 누락은 없다. 동전은 원본의 미국 동전을 유지했으며 선택 사항인 100원 동전 재작화는 하지 않았다. 교사가 올리는 파일은 이미지(PNG/JPG/WebP)이며 임의 PPTX 자동 변환 업로드는 제공하지 않는다. 이미지 모드의 글자는 원본 픽셀을 보존하므로 텍스트 모드로 바꾸거나 교체 이미지를 올려 수정한다. 운영 배포 및 운영 계정 저장 확인은 별도 진행해야 한다.

## 과학 내용 확인 출처

- USGS: https://www.usgs.gov/water-science-school/science/surface-tension-and-water
- ACS: https://www.acs.org/middleschoolchemistry/lessonplans/chapter5/lesson2.html
- US Mint: https://kids.usmint.gov/resources/coin-activities/test-surface-tension

응집력을 쉽게 표현한 “Water sticks together”와 표면적을 줄이려는 성질을 구분하며 초등 수준 설명으로 사용한다.
