# Claude 인수인계 — 숙제 블록 편집기

작성: Codex · 2026-10-18 · 저장소: `C:/Users/likes/Desktop/pointbank`

## 현재 상태

사용자가 요청한 PPT형 숙제 블록 편집기를 기존 프로젝트 안에 구현했다. 변경은 현재 작업 디렉터리에 있으며 **커밋·푸시·배포하지 않았다**. 운영 DB 마이그레이션, 실제 학생 배정, 알림 발송, 포인트 지급, 기존 데이터 삭제도 실행하지 않았다.

이 문서는 Codex 변경 사항의 인수인계다. 상세 조사·검증·환경 설정·되돌리기·교사 사용법은 [homework-block-editor-progress.md](homework-block-editor-progress.md)를 함께 읽으면 된다. 아래 검사 결과는 앞선 구현 작업에서 실제 실행한 기록이며, 이번 인수인계 문서 작성 과정에서 검사를 다시 실행한 것은 아니다.

`ClassBank_Complete_Kit.zip`은 디자인 참고로만 사용했다. ZIP 안의 관리자 구현 프롬프트는 작업 지침으로 적용하지 않았다.

## 구현한 기능

- **기존 `/homework`에 블록 편집기 통합**: 왼쪽 블록 목록, 가운데 실제 학생 화면, 오른쪽 내용/활동 설정. 추가·복제·삭제·드래그·위/아래 버튼·Alt+방향키·실행취소/다시 실행.
- **초안과 템플릿**: 서버 초안, revision 충돌 검사, 기기 복구 저장, 저장 실패 안내, JSON 복구본 내려받기/불러오기, 새 사본, 템플릿 복사. 배정 대상과 마감일도 초안에 보존한다.
- **숙제 5종**: 보고 듣기, 기억해서 답하기, 말하기, 문장 만들기, YouTube 구간 영상 미션.
- **말하기**: 문장 한 번 입력 → 전체 문장/일부 가리기/그림 단계 선택, 숨길 낱말·반복 설정, 힌트/듣기 기록, 마지막 대표 녹음 1개 제출. 재녹음·듣기·마이크 거부·업로드 실패·IndexedDB 복구.
- **수업 가져오기**: 수업 목록과 편집기에서 연결. 블록과 핵심 내용 선택/제외, 변환 가능/개인 활동 대체/변환 불가 안내, 출처·수정 시각 스냅샷. 실행 기록이 없으므로 ‘저장된 수업’으로 표시한다.
- **기존 빠른 생성 재사용**: 생성한 활동을 블록 편집기로 넘겨 수정한다. 선택 학생·마감일을 유지한다. 기존 숙제 플레이어도 유지한다.
- **배정 버전 고정**: 내용 복사, DB에서 배정 활동 UPDATE 차단, 요청 UUID/내용 지문/잠금으로 중복 배정 방지. 빠른/맞춤 숙제의 그룹과 대상도 보존한다.
- **학생 수행**: 기존 `/s` 및 `/hw` 인증·토큰·개인 QR 흐름 유지. 한 활동씩 수행, 기존 답변 대기열 재사용, 응답/말하기 단계/녹음 복구.
- **교사 결과**: 블록별 첫 시도/최종 정답·재시도, 열린 답변·대표 녹음·힌트/듣기, 교사 확인 필요/완료. 비채점 활동에 0/0점이나 정답률 별점을 붙이지 않는다.
- **권한·녹음**: 학원 기능 잠금, 학생 토큰과 활동 소유권 검증, 학생 payload의 정답/카드 스냅샷/출처 제거. private 오디오 버킷, 형식·크기·파일 실제 길이 검사, 교사 전용 서명 URL.
- **기존 보상 유지**: `hw_reward`와 숙제 캘린더 서버 기능을 재사용한다. 자동 지급은 추가하지 않았다. 미리보기는 실제 학생 RPC·업로드·알림·포인트를 호출하지 않는다.

## 설계와 주요 파일

### 공통 모델과 API

- `app/src/lib/homework/blocks.ts`: `HomeworkBlock`, `HomeworkDraft`, 블록 생성/검증, 손상된 복구본 검사, 수업 변환.
- `app/src/lib/homework/types.ts`: 기존 `HwItemConfig`에 선택적 `block` 정의 추가.
- **기존 `quiz/worksheet/game/shadowing` kind를 유지**하고 `config.block`의 `schemaVersion: 1`로 새 활동을 구분한다. 기존 숙제를 강제 변환하지 않는다.
- `app/src/lib/homework/blockApi.ts`: 초안·배정·블록 결과·교사 확인·녹음 업로드/재생 API.
- `app/src/lib/homework/quality.ts`, `build.ts`: 뜻 보기에 문법 설명 메모가 섞이지 않도록 검증/생성 필터.
- `app/src/lib/homework/recordingCache.ts`: 대표 녹음의 IndexedDB 복구 저장.
- `app/src/lib/homework/studentApi.ts`: 진행/답변 큐를 전송하는 동안 추가된 요청을 잃지 않도록 flush 직렬화와 최신 큐 반영.
- `app/src/lib/homework.ts`: 기존 생성 호출을 중복 방지 RPC `hw_create_once`로 연결.

### 화면과 기존 기능 연결

- 신규: `app/src/components/homework/teacher/HomeworkBlockEditor.tsx`, `BlockResults.tsx`, `app/src/components/homework/BlockActivity.tsx`.
- 수정: `app/src/components/homework/HomeworkRunner.tsx`, `runnerTypes.ts`.
- 수정: `app/src/components/homework/teacher/{HomeworkWizard,HomeworkPreview,HomeworkResults,HomeworkSharePanel,RecommendReview}.tsx`.
- 수정: `app/src/pages/{HomeworkPage,HomeworkStudentPage,CurriculumPage}.tsx`.
- 수정: `app/src/i18n/locales/{ko,en}.ts`.
- 공통 학생 플레이어·문제 카드·미리보기·접근성 dialog·기존 그림/색을 재사용한다. 별도 사이트나 학생 계정 시스템은 만들지 않았다.

### DB·Edge Function

- **정방향:** `supabase/087_homework_blocks.sql`.
- **수동 되돌리기 전용:** `supabase/087_homework_blocks_rollback.sql`.
- `supabase/functions/homework-recording/index.ts`: 기존 학생 숙제 토큰으로 업로드 승인, 교사 JWT로 재생 승인. 실제 파일 길이는 `music-metadata@12.2.1`의 `parseBuffer`로 검사한다. 외부 AI에 음성을 보내지 않는다.
- `app/scripts/homework/cleanup-recordings.mjs`: 제출 녹음 180일/미참조 업로드 24시간 정책. 기본 dry run이며 자동 스케줄은 등록하지 않았다. 실제 서버를 대상으로 실행하지 않았다.

087은 기존 생성/제출/진행/완료 함수를 `*_before_blocks`로 보존하고 검증·잠금 wrapper를 둔다. 초안은 RPC로만 접근한다. 녹음 파일은 서비스 키를 가진 Edge Function을 통해서만 접근하도록 구성했다.

### 검사 중 수정한 기존 오류

- `AcademyCodeButton.tsx`, `AttendancePage.tsx`, `ResultsPage.tsx`: `useFeature('solo') || useFeature('homework')`의 조건부 훅 호출을 각각 호출한 뒤 OR하도록 수정.
- `WordSearch.tsx`: 이른 반환 뒤에 있던 훅을 반환 전으로 이동.
- `LessonSlideSorter.tsx`: 일반 작업 함수 `useSentenceList`를 `applySentenceList`로 이름 변경. 훅으로 잘못 인식되는 린트 오류 수정.

## 관찰 문제에 대한 처리

1. 수업에서 단어 72개가 넘어온다는 관찰: 기존 Wizard가 수업 블록 대신 연결 단어장 전체를 사용함을 확인했다. 새 가져오기는 블록/내용을 고른다. 운영 데이터의 72개 사례 자체는 조회하지 않았다.
2. 뜻 보기의 문법 설명: `meaningQ`의 재료 검증과 서버 검증을 추가했다.
3. 영상 0/0점: 비채점 표시와 시청 결과를 분리했다.
4. 공통 복습 추천인데 0개: 자료 부족 이유와 ‘최근 수업으로 공통 복습 만들기’ 진입을 제공했다.

## 실제 통과한 검사

| 검사 | 결과 |
| --- | --- |
| `npm run build` | TypeScript + Vite 성공. 기존 큰 청크 경고 있음 |
| 전체 oxlint | 오류 0 / 기존 경고 58 |
| `scripts/homework/check-logic.mjs` | 기존 숙제 등 38개 통과 |
| `scripts/homework/check-blocks.mjs` | 합성 PGlite DB 17개 통과. 정방향/롤백 실행 포함 |
| `scripts/homework/check-browser.mjs` | 합성 백엔드 Chrome: 5종 작성/저장/재열기, 수업 가져오기/합성 배정, 학생 수행, 녹음·권한 거부·실패 복구, 390/768/1440px, KO/EN 통과 |
| `scripts/homework/check-recording-edge.mjs` | 실제 핸들러 + 합성 인증/Storage 8개 통과. 실제 합성 WebM 파싱 포함 |
| `scripts/blocks/check-blocks.mjs` | 기존 블록 112개·인쇄 블록 14종 등의 등록 회귀 통과 |
| `scripts/test-classroom.mjs` | 주사위 144회, 퀴즈/단어장 회귀 통과 |
| 문법/단어/개별수업 생성 검사 | `grammar/check-curriculum-grammar.mjs`, `vocab/check-curriculum-words.mjs`, `solo/check-standard.mjs` 통과 |
| `git diff --check` | 공백 오류 없음 |

검사는 **운영 서비스에 연결하지 않았다**. DB는 전체 Supabase가 아닌 실제 기존 함수들을 로드한 합성 스키마다. 브라우저는 Supabase 모듈을 합성 구현으로 교체하고 외부 HTTPS 요청을 차단했다. 영상 성공 경로는 합성 YouTube 시계이며, Edge 검사는 실제 Deno 배포 대신 로컬 핸들러 실행이다.

추가 검사 도구는 `app/node_modules/homework-test-tools`에만 설치했다. `package.json`/lockfile은 바꾸지 않았다. 브라우저 경로는 현재 PC의 Chrome, 포트는 5186으로 되어 있다. 녹음 Edge 검사는 브라우저 검사에서 생성한 합성 파일을 사용하므로 브라우저 검사 뒤에 실행한다. 재현 명령은 진행 문서에 있다.

## 적용 전 확인사항과 남은 작업

1. **실제 Supabase 테스트 프로젝트**에서 086u 이후 087 정방향 파일만 적용하고 Auth/RLS·Storage·Edge를 연결한 종단 검증이 필요하다. 실제 학생 계정은 사용하지 않는다.
2. `homework-recording`은 학생이 기존 숙제 토큰을 사용하므로 배포 시 `--no-verify-jwt`가 필요하다. 함수 내부에서 학생 토큰/교사 JWT를 각각 검사한다. Supabase의 URL/anon/service-role 환경이 필요하며 service key를 프런트에 넣으면 안 된다.
3. Deno에서 npm 파서 import와 Storage `user_metadata.duration` 지원, 실제 signed URL/CORS 동작을 확인해야 한다.
4. Safari/iPhone/iPad의 MP4 녹음, 실제 마이크 권한 UI·통신 단절·저장소 제한, 실제 YouTube 제한, 글자 확대·스크린리더·브라우저 뒤로가기 경고·인쇄물 육안 검증은 남아 있다.
5. 기존 포인트/캘린더 실제 통합 회귀도 테스트 프로젝트에서 확인해야 한다. 이번 작업에서는 지급·알림·달력 데이터를 변경하지 않았다.
6. 영상 시청/녹음 제출은 이해도나 발음 정확도 점수가 아니다. 열린 답변과 녹음은 교사가 확인한다.
7. 수업 실행 기록을 새로 만들지 않았다. 게임의 임의 템플릿 문제는 변환하지 않고 연결 단어장 기반 개인 활동만 제안한다. 문법 동적 변형 예문도 제외 안내한다.

되돌리기는 백업·새 배정 중지·기존 새 블록 배정 처리 방침을 정한 뒤 진행 문서의 순서대로 한다. rollback 파일은 초안/배정/제출/녹음을 삭제하지 않는다. **정방향과 롤백 파일을 함께 실행하거나 모든 SQL을 glob으로 실행하지 않는다.** 롤백 후에는 데이터 구조가 남으므로 정방향 SQL의 무조건 재실행 대신 별도 재적용 마이그레이션이 필요하다.

## 기존 작업 보존

작업 시작 전부터 미추적 상태였던 `app/scripts/vocab/out/`의 여러 생성 자료와 `docs/클래스뱅크_제안서_2026-10-16.pdf`는 Codex 변경이 아니다. 수정하거나 삭제하지 않았다. 이어서 작업할 때 현재 `git status`를 확인하고 이 자료를 이번 변경으로 일괄 추가하지 않도록 주의한다.
