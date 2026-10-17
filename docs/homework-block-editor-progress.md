# 숙제 블록 편집기 진행 기록

## 범위와 조사 (2026-10-18)
- 요청 원문: 첨부된 붙여넣은 텍스트. ZIP 내부 지시문은 적용하지 않고 디자인만 참고한다.
- 저장소 규칙: CLAUDE.md, 기존 통장/출석/수업/게임 유지, 요청 없는 커밋·배포 금지.
- 시작 시 기존 변경: scripts/vocab/out 아래 생성 자료 및 docs의 제안서 PDF가 미추적 상태. 수정하지 않는다.
- React/Vite/TypeScript + Supabase RPC. 숙제는 homework_assignments/items/targets/attempts/answers/learning_events 사용.
- 기존 Wizard(대상→자료→시간→확인), 서버 채점, 오프라인 큐, 개인 배정, 수동 포인트 지급/중복 방지 유지.
- 수업 실행 기록 lesson_runs 없음. Wizard는 수업 블록이 아닌 word_list_id 전체를 읽어 단어 중심 숙제를 생성한다. 72개라는 수치는 운영 데이터 없이 재현 불가.
- build.otherValues는 meaning을 검증 없이 보기로 사용한다. 설명 메모가 오답으로 들어갈 수 있다.
- 추천 재료가 비면 common_review 표시에도 items가 비어 있을 수 있다.
- 학생 /s는 학원 코드+이름+보호자 전화번호, /hw는 숙제 번호+이름+PIN 또는 개인 QR. 기존 토큰을 보존한다.
- Google 그림 생성 스크립트 gemini-image.mjs는 Vertex generateContent + IMAGE 응답을 사용한다. 이번 작업은 기존 에셋을 재사용하며 유료 호출은 실행하지 않는다.

## 구현 상태

코드 구현 및 합성 로컬 검증 완료. 운영 적용은 하지 않았다. 실제 Supabase 배포 환경·실기기 검증은 아래에 별도로 남겼다.

| 영역 | 구현 |
| --- | --- |
| 시작 | 기존 빠른 생성 유지, 빈 블록 편집기, 단어·말하기·영상 시작 틀, 저장한 템플릿 복사 |
| 편집 | 3열 편집기, 선택 블록의 실제 학생 화면, 추가·복제·삭제, 드래그·위/아래 버튼·Alt+방향키, 50단계 실행취소·다시 실행 |
| 저장 | 교사/학원/반 단위 서버 초안, 낙관적 revision 충돌 검사, 기기 복구 저장, JSON 내려받기/불러오기, 저장 실패 안내, 새 사본, 저장 중 수정 보존 |
| 이탈 | 닫기·링크 이동·새로고침 경고, 기기 복구본. 브라우저 뒤로가기는 브라우저별 추가 확인 필요 |
| 5종 | 보고 듣기(명시적 자기 확인), 기억해서 답하기(기존 서버 채점), 말하기(대표 녹음), 문장 만들기(정답형/교사 확인형), YouTube 구간 미션 |
| 문제 수정 | 뜻/듣기/그림/빈칸/철자/낱말·청크 순서, 문제·보기·정답 수정. 직접 쓰기 복수 정답은 기존 `/` 구분 규칙 유지 |
| 말하기 | 문장 1개로 전체 문장→가리기→그림/독립 말하기, 단계 선택·낱말별 가리기·반복 설정, 힌트/듣기 횟수, 녹음 듣기·다시 녹음·실패 재시도, IndexedDB 복구 |
| 수업 가져오기 | 수업 목록 및 편집기 연결. 저장된 수업으로 표시. 단어/공부/그림 말하기/문법 예문/대사/영상 변환, 팀 게임은 단어장 기반 개인 복습 제안, 출석 등은 변환 불가 표시 |
| 내용 선택 | 블록 및 변환 결과의 핵심 내용 선택/제외, 가져온 후 내용 수정, 출처 수업/슬라이드/자료 ID·수정 시각 스냅샷 |
| 배정 | 기존 반/일부 학생/마감 유지. 빠른 생성에서 선택한 학생·마감일도 편집기로 전달하고 초안에 보존. 요청 UUID+내용 지문+DB 잠금으로 재요청 방지 |
| 버전 | 배정본 JSON 복사와 DB UPDATE 차단. 원본 초안·템플릿·수업 변경과 독립. 기존 배정은 새 버전으로만 재배정 |
| 학생 | 기존 /s→개인 숙제 링크와 /hw 토큰 유지, 한 블록씩 수행, 기존 오프라인 답변 대기열 재사용, 응답·힌트 단계·대표 녹음 새로고침 복구 |
| 결과 | 숙제별/학생별/블록별 확인, 확인 필요 먼저, 열린 답변·대표 녹음, 첫 시도/최종 정답·재시도·힌트·듣기. 미시작은 평가 전, 비채점 활동에 점수 없음 |
| 포인트 | 기존 hw_reward와 캘린더 연동 유지, 자동 지급 추가 없음. 완료/답변/배정 요청 직렬화·중복 방지 보완 |
| 권한 | 서버에서 학원 기능 잠금, 교사 소속 반, 학생 토큰-활동 소유권 확인. 정답·카드 스냅샷·출처 등 교사 정보는 학생 payload에서 제거 |
| 미리보기 | 기존 HomeworkRunner를 로컬 API로 실행. 실제 RPC·업로드·학생 기록·알림·포인트 호출 없음. 네이티브 dialog로 포커스 제한·Escape 복귀 |
| 녹음 | private 버킷, WebM/Ogg/MP4 서명·8MB·0.5~120초 검증, 실제 파일 길이 파싱, 학생 토큰으로 업로드 승인, 교사 권한으로 120초 서명 URL 발급 |
| 보존 | 제출 녹음 180일, 미참조 업로드 24시간 정책/정리 도구. 자동 삭제 스케줄은 등록하지 않음. 제출·검토 기록은 유지 |

설명 메모를 뜻 보기로 쓰던 `meaningQ`를 보수적으로 필터링하고 서버에서도 거절한다. 단어 72개라는 운영 관찰 수치는 실제 학생 데이터를 조회하지 않아 재현하지 않았으나, 전체 단어장을 그대로 쓰던 원인을 확인하고 핵심 내용 선택을 추가했다. 추천 결과가 0개이면 성공 문구 대신 자료 부족과 수업 가져오기 대안을 표시한다. 비채점 결과와 진행에서 0/0 표시 및 정답률 별점 표시를 없앴다.

그림은 저장소의 단어 그림·rainbow 그림과 기존 공통 색/컴포넌트를 재사용한다. ZIP의 DESIGN_OVERVIEW.jpg만 시각 참고로 열었고 관리자 구현 프롬프트는 지침으로 적용하지 않았다. 추가 제작이 필요한 에셋은 없다. Google API의 현재 계정 권한·할당량은 호출하지 않았으므로 확인되지 않았다.

오디오 길이 파서는 [music-metadata 공식 문서](https://github.com/borewit/music-metadata)의 parseBuffer를 확인하고 12.2.1로 고정했다. 브라우저에서 만든 실제 합성 WebM(약 1초)을 같은 파서로 검증했다. 음성은 외부 AI 서비스에 보내지 않는다.

## 변경 파일

- 공통 모델/검증/가져오기: `app/src/lib/homework/{blocks,quality,blockApi,recordingCache}.ts`, `types.ts`, `build.ts`.
- 편집/실행/결과: `app/src/components/homework/teacher/{HomeworkBlockEditor,BlockResults}.tsx`, `app/src/components/homework/BlockActivity.tsx`.
- 기존 연결: `HomeworkPage.tsx`, `HomeworkStudentPage.tsx`, `CurriculumPage.tsx`, `HomeworkWizard.tsx`, `HomeworkPreview.tsx`, `HomeworkRunner.tsx`, `runnerTypes.ts`, `HomeworkResults.tsx`, `HomeworkSharePanel.tsx`, `RecommendReview.tsx`, `homework.ts`, `studentApi.ts`.
- KO/EN: `app/src/i18n/locales/{ko,en}.ts`.
- DB/녹음: `supabase/087_homework_blocks.sql`, `supabase/087_homework_blocks_rollback.sql`, `supabase/functions/homework-recording/index.ts`.
- 검증: `app/scripts/homework/{check-blocks,check-browser,check-recording-edge,cleanup-recordings}.mjs`, `harness.html`, `harness.tsx`. harness는 운영 앱의 엔트리에 연결되지 않는 합성 검증용이다.
- 회귀 검사 중 발견한 기존 훅 오류 5곳을 최소 수정: `AcademyCodeButton.tsx`, `AttendancePage.tsx`, `ResultsPage.tsx`(단축 OR의 조건부 훅), `WordSearch.tsx`(이른 반환 뒤 훅), `LessonSlideSorter.tsx`(일반 작업 함수를 use 접두사로 잘못 이름 붙인 부분).

## 실제 검증 기록 (2026-10-18)

| 실행 | 결과·범위 |
| --- | --- |
| `npm run build` | 성공. TypeScript 프로젝트 빌드 + Vite 운영 번들 생성. 기존 큰 청크 경고 유지 |
| `npm run lint` / oxlint | 오류 0, 경고 58. 남은 경고는 기존 Fast Refresh·훅 의존성 등 |
| `node scripts/homework/check-logic.mjs` | 기존 숙제/채점/추천/영상/기능 잠금 등 38개 검사 통과 |
| `node scripts/homework/check-blocks.mjs` | 합성 PGlite DB 17개 통과. 5종 저장·재열기·배정·수행·결과, 빠른/맞춤 생성의 대상·그룹 보존, revision 충돌, 실제 초안 수정 후 배정 유지, DB UPDATE 금지, 중복 요청, 학원/학생 분리, 잠금, 정답 제거, 교사 검토, 정리 대상, 롤백 실행 |
| `node scripts/homework/check-browser.mjs` | headless Chrome 합성 백엔드. 5종 작성·저장·재열기, 미리보기·복제·실행취소, 저장 실패·새로고침, 수업 내용 선택·변환 불가·합성 배정, 390/768/1440px, KO/EN, 학습 확인, 정답형, 열린 답변, 말하기 단계·녹음·듣기·거부·업로드 실패·IndexedDB 복구, 영상 실패·완료 조건 통과 |
| `node scripts/homework/check-recording-edge.mjs` | 실제 Edge 핸들러 + 합성 인증/Storage 어댑터 8개 통과. 실제 녹음 길이 파싱, 잘못된 토큰/형식/크기/길이, 비공개 재생 권한 |
| `node scripts/blocks/check-blocks.mjs` | 112개 기존 블록 등록·게임·인쇄 14종 등 8개 검사 통과 |
| `node scripts/test-classroom.mjs` | 주사위 144회 연속 회전, 중복/복수 답 퀴즈, 단어장 payload 통과 |
| `node scripts/grammar/check-curriculum-grammar.mjs` | 문법 단원/학년/예문 검사 통과 |
| `node scripts/vocab/check-curriculum-words.mjs` | 단어 학교급/중복/뜻/주제/세트 검사 통과 |
| `node scripts/solo/check-standard.mjs` | 기존 단어·문법·주제·영상 개별수업 생성 검사 통과 |
| `git diff --check` | 공백 오류 없음. Windows LF/CRLF 안내만 있음 |

DB 검사는 040/041의 실제 테이블·채점/진행/배정 함수와 074의 기능 잠금 함수를 합성 스키마에 로드한 뒤 087을 적용한다. 전체 Supabase 인스턴스를 띄운 검증은 아니다. 브라우저의 API는 도구 실행 전에 합성 모듈로 교체하고 외부 HTTPS 요청을 차단했다. 영상 성공 경로는 합성 YouTube 시계이며 실제 영상 서비스 가용성을 뜻하지 않는다. Edge 검사는 Deno 배포 런타임 대신 실제 핸들러를 로컬에서 실행했다.

처음 브라우저 검사에서 복제→실행취소 뒤 선택 인덱스가 범위를 벗어나는 문제를 발견·수정했다. 재실행으로 통과를 확인했다. 초안 입력란의 접근성 이름도 명시적으로 고쳤다.

## 로컬 검증 재현

기존 앱 의존성은 변경하지 않았다. 추가 도구는 무시되는 `app/node_modules/homework-test-tools`에 설치했다.

```powershell
cd app
npm install --prefix node_modules/homework-test-tools --no-save --package-lock=false @electric-sql/pglite @playwright/test music-metadata@12.2.1 prettier
node scripts/homework/check-blocks.mjs
node scripts/homework/check-browser.mjs
node scripts/homework/check-recording-edge.mjs
```

브라우저 스크립트는 현재 PC의 Chrome 경로와 localhost:5186을 사용한다. 다른 환경에서는 executablePath를 맞춰야 한다. Edge 검사는 앞선 브라우저 검사가 만든 합성 녹음 파일을 사용한다. music-metadata는 Node 22 이상을 권장하며 현재 Node 20.20.2에서도 검증 코드는 실행됐지만 설치 시 엔진 경고가 있었다. 화면/검사 로그는 같은 무시 디렉터리에 있다.

## 환경 설정·마이그레이션·되돌리기 (아직 실행하지 않음)

1. 운영과 분리된 Supabase 테스트 프로젝트를 준비하고 기존 마이그레이션을 086u까지 적용한다. 체크/롤백/seed 파일을 무차별 실행하지 않는다.
2. **forward 파일 `087_homework_blocks.sql`만** 적용한다. 초안 테이블, 배정 키, 함수, 스냅샷 트리거, private 녹음 버킷을 한 트랜잭션으로 생성한다. 기존 제출 데이터의 백필·삭제는 없다.
3. 테스트 프로젝트에 `homework-recording` Edge Function을 `--no-verify-jwt`로 배포한다. 학생은 Supabase Auth JWT 대신 기존 숙제 capability token을 쓰기 때문에 이 설정이 필요하다. 함수 안에서 토큰·소유권을 확인하며 교사 재생은 JWT를 별도 검증한다. 배포 명령은 이번 작업에서 실행하지 않았다.
4. Edge에는 기존 Supabase 제공 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`가 필요하다. service key를 Vite 환경변수나 클라이언트에 넣지 않는다. 기존 프런트 Supabase URL/anon key 외 추가 공개 환경변수는 없다.
5. 녹음 버킷은 private 상태와 MIME/크기 제한을 유지한다. Edge의 npm 의존성 해결 및 Storage `user_metadata.duration` 지원을 테스트 배포에서 확인한다.
6. 녹음 정리는 운영자가 정책을 확인한 뒤 `cleanup-recordings.mjs`의 기본 dry run을 실행한다. `--execute`를 붙여야 Storage API로 삭제한다. 이번 작업에서 dry run도 실제 서버 대상으로 실행하지 않았고 스케줄도 등록하지 않았다.
7. 되돌릴 때는 새 배정을 중지하고 데이터·녹음을 백업한다. 새 블록 배정은 기존 플레이어에서 실행할 수 없으므로 유지/닫기 방침을 먼저 정한다. `087_homework_blocks_rollback.sql`은 새 엔트리 권한과 트리거를 해제하고 원래 함수를 복원한다. 초안·배정·제출·버킷은 삭제하지 않는다. 원복 앱은 `hw_create_once`를 사용하지 않는 이전 버전이어야 한다. 롤백 후 forward SQL을 그대로 재적용하면 이미 남은 테이블과 충돌하므로 별도의 재적용 마이그레이션이 필요하다.

## 남은 실환경 확인·제한

- 실제 Supabase Auth/RLS·Storage 업로드·서명 URL·Deno 배포를 합성 계정으로 연결한 종단 검증. 실제 학생을 사용하지 않는다.
- iPhone/iPad Safari의 MP4 녹음, 마이크 권한 UI, 실제 연결 끊김, 저장소 제한, YouTube 임베드/연령/지역 제한 및 서버 배포 환경 CORS.
- 실제 확대 글자 설정, 브라우저 뒤로가기 이탈 안내, 스크린리더 및 프린터/PDF의 육안 검증. 픽셀 폭 검사와 기존 인쇄 블록 등록 회귀는 통과했지만 실제 출력물 검수와 다르다.
- 영상 완료는 플레이어 구간 재생량에 따른 시청 기록이다. 이해도·독립 발화 능력·발음 정확도를 자동 평가하지 않는다. 열린 답변·녹음은 교사 확인이 필요하다.
- 수업 실행 이력은 새로 만들지 않았다. 게임은 연결된 단어장 기반 대체 활동이며 게임 템플릿 안에만 있는 임의 문제를 읽어 변환하지 않는다. 문법은 저장된 예문을 사용하며 수업 실행 중 동적으로 만든 변형 예문은 제외 안내를 한다.
- 임의 동영상 사이트는 지원하지 않고 기존 YouTube 주소만 지원한다. 사진 제출·추가 개인 게임·AI 발음 채점 버튼은 노출하지 않는다.
- 포인트/캘린더 서버 함수를 변경하거나 실제 지급하지 않았다. 실제 Supabase에서의 기존 보상·달력 통합 회귀는 테스트 프로젝트에서 추가 확인한다.

## 교사 사용법

1. 숙제 화면에서 **숙제 블록 편집기**를 연다. 빈 활동을 추가하거나 템플릿을 열고, **저장된 수업에서 가져오기**로 블록과 핵심 내용만 고른다. 수업 목록·수업 편집기의 가져오기 버튼도 같은 편집기로 연결된다.
2. 왼쪽에서 순서를 정하고 가운데 실제 학생 화면을 보며 오른쪽 내용을 고친다. 말하기는 한 문장에 단계/숨길 낱말/반복을 정하고, 문장 만들기는 정답형과 교사 확인형을 구분한다.
3. **초안 저장** 후 나중에 목록에서 다시 연다. **템플릿으로 저장**한 구성은 새 초안으로 복사해서 쓴다. 저장 실패 시 복구본을 내려받거나 새 사본으로 저장한다.
4. 처음부터 또는 현재 블록을 미리 본 뒤 반 전체/일부 학생·마감일을 확인하고 배정한다. 배정 후 수정한 내용은 새 숙제에만 반영된다.
5. 학생은 기존 /s 포털이나 숙제 번호/개인 QR로 수행한다. 교사는 숙제 결과의 **교사 확인 필요**에서 열린 답변·대표 녹음을 먼저 확인한다. 포인트는 기존 지급 패널을 사용한다.

## 운영 제한
운영 DB 접근·마이그레이션 적용·배포·학생 배정·알림·포인트 지급·데이터 삭제를 실행하지 않는다.
