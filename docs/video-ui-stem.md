# 수업 영상 UI · STEM Ready Class 검토본

2026-10-29 요청 범위를 구현·검증한 뒤 사용자가 커밋·푸시·배포를 요청했습니다. 운영 DB 변경은 없습니다.

## 변경 화면

- `/videos`: 검색과 주제 선택 아래에 준비 화면을 표시합니다. 준비 화면에는 썸네일과 큰 재생 버튼만 있으며 iframe/문장 조작/설정창을 상시 생성하지 않습니다.
- 오늘 배울 표현과 핵심 단어를 다른 제목으로 구분합니다. 표현·뜻은 원본 대사/pack에서만 읽으며 임의 문장을 만들지 않습니다. 단어 데이터에 연결된 `imageUrl`이 있는 경우만 사용하고 실패 시 그림을 숨깁니다.
- 원본 전체 단어·질문은 학습 내용 미리보기에서 펼칩니다. 기존 제공 가능한 활동 최대 7종을 유지하고, 큰 체크 카드로 줄바꿈합니다. 선택한 활동만 기존 수업 생성 인자로 전달합니다. 활동별 임의 시간은 넣지 않았습니다.
- 영상 보기/썸네일은 상세 수업 플레이어를 별도 확대 화면에 엽니다. 닫으면 영상이 파괴되고 소리가 멈춥니다. 검색·필터·활동 선택은 준비 화면에 남습니다.
- 자료와 기존 수업에서 공통 플레이어를 계속 사용합니다. 문장 데이터 없는 영상에는 이전/다음 문장이나 배역을 만들지 않고 기존 구간 시작·끝·반복을 유지합니다.
- 남색 배경의 문장 조작·툴 버튼과 설명 글씨를 키웠습니다. 주요 터치 버튼은 44px 이상입니다. 반복 1~5회, 속도 0.5/0.75/1/1.25/1.5/2, 배역 끔/2/3/4를 즉시 적용하는 버튼으로 제공합니다. 기존 3가지 재생 모드는 별도 펼침에 보존했습니다. 자막 버튼은 현재 상태를 표시합니다.
- 설정창은 버튼 위에 연결됩니다. 자막·진행바·핵심 버튼을 가리지 않도록 문서 흐름 안에서 펼칩니다. 큰 화면에서 팝업 내부 스크롤은 없습니다. 작은 세로 화면은 전체 플레이어를 세로로 스크롤하여 모든 항목에 접근합니다.
- 수동 숨김/마우스·터치·키보드 다시 표시를 추가했습니다. 숨김 상태에서도 자막과 영상 배치 크기를 유지합니다. 자동 숨김과 항상 표시·설정창·정지·키보드 예외를 유지합니다.
- 실제 저장 슬라이드만 활동 버튼에 표시합니다. 기존 실행기가 자동 추가하는 인쇄 바로가기는 실행기에 보존하되 선택한 학습 활동처럼 표시하지 않습니다. 기존 수업/슬라이드 ID·순서를 변경하지 않았습니다.
- `/stem`: 수업 메뉴의 파닉스(Ready Class) 바로 아래 STEM(Ready Class)을 추가했습니다. 기존 정상 이용자 라우팅과 같은 AppLayout 경로입니다. 로그인/학생 분기와 접근 정책을 바꾸지 않았습니다. 제목·설명·준비 중 안내만 있으며 콘텐츠·등록 도구·가짜 실행 버튼은 없습니다.

## 주요 코드

- `app/src/components/VideoClipLibrary.tsx`, `styles/video-library-v2.css`: 준비 화면과 별도 확대 플레이어.
- `TeachingVideoFrame.tsx`, `VideoSettingChoices.tsx`, `ShadowBoard.tsx`, `PlainTeachingVideo.tsx`, `styles/video-classroom-v3.css`: 공통 조작/설정/반응형.
- `LessonVideoActivityNav.tsx`, `styles/video-teaching.css`, `lib/videoChrome.ts`: 실제 활동 버튼·가독성·숨김.
- `pages/StemReadyClassPage.tsx`, `lib/navGroups.ts`, `App.tsx`: 메뉴·빈 페이지·라우트.
- `i18n/videoUiLocales.ts`, `i18n/locales/{ko,en}.ts`: 한국어·영어 UI 문구.
- `lib/videoClips.ts`: 단어에 이미 연결된 그림 URL을 선택적으로 표시하는 타입. DB 스키마 변경은 없습니다.

## 화면 캡처

아래는 실제 로컬 컴포넌트를 격리된 검증용 데이터로 실행한 캡처입니다. `Synthetic … QA only`는 재생 상태 검증용 대역이며 운영 콘텐츠가 아닙니다.

- `output/video-ui-stem/preparation-desktop.png`, `preparation-mobile.png`
- `output/video-ui-stem/player-desktop.png`, `settings-desktop.png`, `touch-settings.png`
- `output/video-ui-stem/lesson-activities-desktop.png`
- `output/video-ui-stem/stem-desktop.png`, `stem-mobile.png`
- `output/video-ui-stem/real-video-player.png`: 공식 Super Simple 영상의 실제 유튜브 API 재생 화면. 문장 데이터가 없는 일반 영상 경로를 확인했습니다.

## 시안과 차이

- 시안의 예시 돼지/도시락 그림·문장을 제품 데이터로 등록하지 않았습니다. 실제 썸네일과 등록된 표현·단어 수를 그대로 사용합니다.
- 설정창은 영상 위에 겹치는 부유창 대신 버튼 바로 위에 연결된 흐름형 패널입니다. 모든 기존 선택 범위와 큰 글씨를 유지하면서 자막/조작을 가리지 않기 위한 선택입니다. 열 때 영상 영역이 줄어들 수 있지만 메뉴 표시/숨김만으로는 레이아웃이 변하지 않습니다.
- 시안의 고정 5개 활동 대신 실제 제공·선택된 활동을 사용합니다. 긴 수업 버튼은 가로 스크롤합니다.
- 그림 자산이 단어에 직접 연결되지 않은 경우 임의 사전 이미지나 이모지로 대체하지 않습니다.

## 검증과 한계

- `npm --prefix app run build`: TypeScript·프로덕션 빌드 통과. 기존 큰 번들 크기 경고가 있습니다.
- 변경된 핵심 컴포넌트/신규 페이지의 oxlint 통과.
- `app/scripts/ready-media/check-v3.mjs`: 실제 React AppLayout + 격리 DB/유튜브 이벤트 대역으로 준비 화면, 7활동 유지, 선택 전달, 설정 범위, 가림 여부, 자막 상태, 전체화면/미지원 대체 확대, 수동/자동 숨김 예외, 실제 3활동 이동, 복귀 위치·속도, 소리 정지, STEM 메뉴/직접 주소/새로고침/모바일 메뉴, 터치 첫 탭을 검사했습니다. 결과 `output/video-ui-stem/results.json`.
- `check-v3-real.mjs`: 공식 Super Simple 알파벳 영상으로 초기 대기→사용자 재생→2.7초 이상 진행→정지/닫기를 실제 API로 확인했고 브라우저 오류는 0개였습니다(`real-results.json`). 문장별 시크·따라하기 전체는 대역 검사이며 모든 등록 영상의 실제 오디오를 전수 검수한 것은 아닙니다.
- 직접 접속/새로고침은 로컬 검증 서버의 SPA fallback에서 확인했습니다. 기존 Vercel rewrite는 그대로 보존했습니다.
- 터치 검증은 Chrome 터치 에뮬레이션입니다. 실제 태블릿·iOS 기기는 확인하지 않았습니다.
- 파닉스 워크북과 노래·챈트 데이터/관리 화면은 변경하지 않았습니다. 공유 플레이어의 수업용 확대 스타일은 `data-simple=false`로 한정했습니다.
