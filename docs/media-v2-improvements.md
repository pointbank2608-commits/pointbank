# 수업 영상 · 개인 노래/챈트 검토본

수업 영상과 개인 노래·챈트 기능의 구현·검증 기록입니다. 검토본 준비 후 사용자가 운영 SQL을 실행했고, 확인 쿼리 6개 항목 모두 OK인 캡처를 제공했습니다. 이어 커밋·푸시·배포를 요청했습니다.

## 화면과 파일

- `/videos`: 학습 내용은 기본 접힘. 표현/핵심 단어 요약과 실제 활동 선택은 유지합니다. `VideoClipLibrary.tsx`, `video-library-v2.css`.
- 자료 영상과 기존 내 수업의 공통 남색 플레이어: `TeachingVideoFrame.tsx`, `ShadowBoard.tsx`, `PlainTeachingVideo.tsx`, `YoutubeShadowingPlayer.tsx`, `teaching-video-v2.css`.
- 문장 자료가 없는 기존 영상에는 문장 버튼을 만들지 않고 구간 시작/끝·반복·속도·음량을 제공합니다.
- 실제 재생 이벤트를 받아 상태를 변경합니다. 오류/로딩 시간 초과 시 재시도·유튜브 이동을 제공합니다. 활동 복귀 시 재생 위치·설정을 복원하며 자동 재생하지 않습니다.
- 실제 수업 순서의 활동 이동: `LessonVideoActivityNav.tsx`, `LessonRunnerContext.tsx`, `LessonSlideContent.tsx`.
- `/phonics?tab=songs`: 전체/기본 제공/내 자료, 검색/단계, 개인 링크 추가·수정·삭제, 기본 자료의 개인 숨김/복원, 큰 미리보기. `phonicsStage1/PhonicsSongs.tsx`, `SongAddToLesson.tsx`, `personalPhonicsSongs.ts`, `phonics-songs-v2.css`.
- 기존 관리자 등록 화면은 `AdminPhonicsSongs.tsx`로 보존했습니다. 일반 교사의 개인 링크는 별도 테이블에 저장합니다.
- 한국어/영어 문구는 `mediaV2Locales.ts`에 모았습니다.

## 개인 링크의 서버 적용 전제

`supabase/091_phonics_personal_songs.sql`과 읽기 전용 확인용 `091_check.sql`을 추가했습니다. 사용자가 운영 SQL Editor에서 실행 후 확인 결과 6개 항목 모두 OK인 캡처를 제공했습니다. 서버 구조가 없는 환경에서는 링크 추가·수업 추가 등 해당 기능을 비활성화하고 서버 설정 안내를 표시합니다. 로컬 저장으로 성공한 것처럼 처리하지 않습니다.

- `phonics_personal_songs`: 본인·같은 학원·교직원 RLS. 다른 교사·학생의 접근과 소유자/학원 위조를 차단합니다.
- `phonics_song_hides`: 개인별 숨김이며 제공 자료 원본을 수정하지 않습니다.
- `append_song_to_lesson`: 서버가 자료와 수업 소유자를 확인하고 영상 정보를 수업 안에 저장합니다. 이후 개인 링크를 삭제해도 수업 영상 정보는 남습니다.
- 기존 수업은 유효 슬라이드 변환 방식과 기존 영상 URL을 보존합니다. 수정 시각 비교와 행 잠금으로 동시 변경을 감지합니다.
- Ready Class 관련 노래와 자료 목록은 동일 조회 훅을 사용합니다. 화면별 복사 자료는 없습니다.

## 캡처와 시안 비교

아래는 실제 구현을 로컬 검증 데이터로 실행한 캡처입니다. **영상 영역의 “Synthetic … QA only”는 테스트용 재생 상태 대역이며 실제 등록 콘텐츠가 아닙니다.** 썸네일도 테스트용 ID의 경우 대체 화면입니다. 시안 이미지나 가짜 영상 길이를 운영 콘텐츠로 등록하지 않았습니다.

| 시안 | 구현 화면 |
|---|---|
| 영상 상세 | `output/media-v2/video-detail-desktop.png` |
| 남색 전체화면·설정 | `output/media-v2/video-settings-desktop.png` |
| 노래 목록·링크 입력 | `output/media-v2/songs-desktop.png`, `song-add-desktop.png` |
| 큰 미리보기 | `output/media-v2/song-preview-desktop.png` |
| 휴대폰 | `output/media-v2/songs-mobile.png`, `video-settings-touch.png`, `song-preview-touch.png` |

남색 배경, 파란 강조, 둥근 흰 설정창, 하늘색 필터, 썸네일 카드, 흰 미리보기와 어두운 배경을 적용했습니다. 사이트 기존 사이드바는 보존했습니다.

차이: 기존의 3가지 진행 모드와 전체 속도/반복 범위를 유지하기 위해 작은 설정창에는 선택 상자를 사용합니다. 좁은 화면에서는 설정 버튼 위에 인라인으로 펼쳐 자막·조작 겹침을 피합니다. 넓은 화면에서 설정이 열리면 자막/문장 버튼은 왼쪽에 배치합니다. 제목은 수동 입력할 수 있으며 외부 메타데이터 자동 조회는 추가하지 않았습니다.

## 검증

- `npm --prefix app run build`: TypeScript + 프로덕션 빌드. 기존 번들 크기 경고는 남습니다.
- 변경된 새 핵심 컴포넌트/저장 모듈 oxlint: 오류·경고 없음.
- `app/scripts/ready-media/check-personal-db.mjs`: 실제 마이그레이션을 PGlite에 적용, RLS/수업 RPC 8개 시나리오 통과. 결과 `output/media-v2/db-results.json`.
- `app/scripts/ready-media/check-v2.mjs`: 실제 React 화면 + 격리한 DB/유튜브 이벤트 대역. 접힘, 옵션 범위, 전체화면, 자동 숨김/예외, 재방문 복원, CRUD/재로그인, Ready Class, 내 수업 추가, 삭제 후 보호, 숨김/복원, 오류/재시도, 터치 첫 탭, 가로 넘침을 검사합니다. 결과 `output/media-v2/browser-results.json`.
- `check-v2-real.mjs`: 기존 등록된 `hyacEIXP3oc`의 실제 YouTube API 연결을 별도 확인했습니다. 이 로컬 환경에서 **오류 150**이 반환됐습니다. 오류 안내/재시도/외부 링크가 표시되고 재생 중으로 잘못 진행하지 않는 것을 확인했습니다. 결과 `real-youtube-results.json`, `real-youtube-check.png`.

## 남은 확인

- 실제 유튜브 정상 재생·오디오와 임베드 허용 여부는 해당 영상/접속 환경에서 다시 확인해야 합니다. 대역 테스트의 통과를 실제 영상 재생 성공으로 간주하지 않습니다.
- 운영 DB 구조 적용은 사용자 확인 캡처로 확인했습니다. 실제 로그인 계정의 저장·재로그인·수업 연결 검증은 아직 하지 않았습니다. 동작 검증은 격리 브라우저 + 로컬 PostgreSQL 호환 엔진입니다.
- 터치 검증은 Chrome 터치 에뮬레이션입니다. 실물 태블릿/iOS 기기는 확인하지 않았습니다.
