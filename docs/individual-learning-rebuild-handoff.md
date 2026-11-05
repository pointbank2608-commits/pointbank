> **최신 운영 체크포인트 (2026-11-06):** 분리된 Supabase 스테이징 `iazqbylirdmsnnliehpu`에서 운영의 빈 스키마 복원, 097~100 전체 31검사, 실제 DB 역할·권한, 중지/복구, 실제 Auth 비밀번호 로그인·TOTP MFA, 실제 API와 교사/학생/어드민 화면 검증을 통과했다. 글자 조합 답안 형식 결함을 수정하고 실제 서버 정답 처리·회귀 검사·타입 검사·격리 후보 빌드를 통과했다. **운영 `ajxforiicepnhizxwpyf`에 097→098→099→100 적용 완료**, 최종 31검사 및 14개 새 테이블 RLS, 기존 배정/채점 기록 수 보존을 확인했다. 운영에 테스트 자료는 넣지 않았다. 앱은 이번 main 푸시의 GitHub→Vercel 자동 배포 대상이며, 성공 여부는 해당 커밋의 배포 상태로 확인한다. 스테이징 임시 키·세션 파일 삭제, QA 계정 비활성화·관리자 권한 회수를 마쳤다. 이후 남은 것은 실제 학습의 지연 결과 축적·교사 승인형 비교 검증과 목표/블록 확장이다. **아래 이전 날짜의 미배포/대기 표현은 당시 기록이며 이 체크포인트가 우선한다.** 상세: [운영 검증 기록](learning-release-verification-2026-11-06.md)

> **학습 연구실 어드민 추가 (2026-11-05):** `/admin/learning`에 진단 집단·첫/최종 확인·지연 참여/정답·제공 버전 비교·자동 점검 제안·근거를 보존한 검토 이력을 구현했다. 실제 PostgreSQL 8연결 × 3라운드(어드민 동시 저장 포함), DB·브라우저·타입·최종 빌드를 통과했다. 100 SQL은 미배포다. 교사 배정 결정권을 유지하고 운영 DB·수집 활성화·커밋·배포는 변경하지 않았다. 상세: [학습 연구실 인수인계](learning-research-admin-handoff.md).

# 개별수업 재구축 인수인계 — 2026-11-05

## 먼저 읽기

AGENTS.md, CLAUDE.md, docs/learning-sensors-handoff.md와 이 문서를 먼저 읽는다. 작업 트리는 사용자 기존 변경과 이번 작업이 섞인 상태다. 전체 되돌리기/일괄 커밋하지 않는다. Popcorn 관련 코드 및 기존 출력물은 이번 작업과 무관한 기존 변경이다.

## 사용자 결정 — 최신 지시 포함

- 클래스뱅크의 최상위 목표: 효과적인 영어 수업을 발견·검증·개별수업으로 제공하여 좋은 교사를 만나는 운에 따른 차이를 줄이고 시간·공간의 제약을 줄인다.
- 수집·분석·추천 생성은 자동. 교사/부모에게 추가 기록·해석 업무를 요구하지 않는다.
- 내부 스탯은 공개하지 않아도 된다. 교사에게는 근거가 이해되는 구체적인 추천을 제공하고, 승인/수정/건너뛰기로 최종 결정권을 준다. 추천을 무단 배정하지 않는다.
- 기존 스탯을 유지하는 것이 목적이 아니다. 실제 성과·시간/연습량·도움·지속성이 우선이다.
- 개별수업은 미완성이므로 필요하면 전면 수정해도 된다고 사용자가 명시했다. 이어 “개별수업을 우리가 대화로 정한 기준으로 새로 만들어 버리자”라고 지시했다.
- 단체수업·개별수업·숙제에 필요한 블록은 자유롭게 새로 만들어도 된다고 승인했다. 기존 기록을 지우라는 지시는 아니다.
- 사용자는 토큰 등으로 작업이 중단되면 Claude가 같은 폴더의 AGENTS.md, CLAUDE.md, 이 문서를 읽고 이어받기를 원한다. 이 파일을 주요 검증 때마다 갱신한다.

## 운영 상태 — 중요한 구분

097 센서 1차는 이전 대화에서 로컬 구현/검증 완료. 098/099는 **로컬 검증을 마친 미배포 코드**다. 이 채팅에서는 운영 DB SQL 실행, 환경 설정 변경, 커밋/푸시/배포하지 않았다. VITE_LEARNING_SENSORS_ENABLED는 명시적 true일 때만 097/098 선택적 활동 수집. 새 학습 경로는 채점 일관성을 위해 제공 버전 고정을 필수 사용하므로 098/099 서버 준비가 필요하다.

## 구현한 파일/구조

### 097 기존 센서 기반

기존 handoff 참고. 학생 행동과 서버 채점을 분리하고, 미리보기 제외, 메모리 큐/중복 ID, 관리자 수집 현황을 구현했다.

### 098 제공 버전 및 채점 연결

- supabase/098_learning_delivery_runs.sql
- learning_delivery_runs / learning_solo_versions / learning_delivery_items / learning_goals / learning_evidence_links
- 실제 학생에게 제공한 공개 문제와 비공개 채점 정의를 함께 스냅샷으로 남긴다. 학생에게 정답/비공개 정의를 반환하지 않는다.
- 개별수업은 첫 measured open에서 배정별 버전을 고정한다. 이후 원본이 바뀌어도 같은 배정의 공개 문제와 measured answer/test/advance/reveal은 고정본을 사용한다.
- 시험 내부 문항은 위치로 정확히 연결한다. 원본 변경 여부와 실제 제공/채점 버전 일치를 구분한다.
- 숙제/단어암기는 기존 서버 채점 함수를 사용하고 제공 당시 내용과 현재 채점 내용의 일치 여부를 기록한다.
- 단어+뜻이 명확할 때만 공통 목표를 연결한다. 뜻이 불명확하면 미해결로 둔다.
- app/src/lib/learningSensors/delivery.ts: open endpoint 부재일 때만 이전 호출로 fallback. 네트워크/권한 오류를 endpoint 부재로 숨기지 않는다. 이미 받은 run의 제출은 자동 downgrade하지 않는다.
- 기존 soloApi / homework studentApi / wordMemory api와 학생 화면에 run 전달 연결. 숙제 오프라인 큐도 runId를 보존한다.
- WordMemoryStudentPage의 재시도 pending은 원래 runId를 보관하도록 수정·검증했다.
- **후속 확인 필요:** 기존 soloStartTestRetry, 게임 템플릿/게임 뒤 확인, 교사 legacy 집계는 전체 불변 버전 전환을 완료하지 않았다. 새 v1 학습 경로는 이 경로를 쓰지 않는다. “모든 개별수업 하위 기능 전환 완료”라고 주장하지 않는다.

### 099 새 개별수업 (어휘 회상 v1)

- supabase/099_learning_paths.sql
- app/src/lib/learningPaths.ts
- app/src/components/solo/LearningPathStudio.tsx
- app/src/components/solo/LearningPathPlayer.tsx
- SoloLessonsPanel의 기본을 새 Studio로 교체. 기존 기능은 “기존 개별수업 자료” 접힌 영역에 유지하며 learning-path-v1 자료는 legacy 편집 목록에서 제외한다.
- StudentSoloPage는 learning_path 또는 path_version 표식을 보고 새 Player를 사용한다.
- 교사: 반/학생, 1~12개 단어·뜻·선택 예문, 연습 방식(글자 조합/직접쓰기) → 실제 계획 미리보기 → 이후 복습 확인까지 명시적으로 승인 → 배정.
- 학생: 뜻을 보고 단어 쓰기 진단 → 처음 맞히면 설명/연습 생략 → 필요하면 단어·뜻·예시 → 연습 → 독립 확인. 독립 확인에서 어려우면 설명/연습을 한 번만 더 하고 넘어간다. 무한 반복 없음.
- 진단은 뜻 단서에서 단어를 회상해 쓰는 수행이다. 이를 어휘 의미 이해/철자 능력 각각의 독립 진단으로 과장하지 않는다.
- 진단에서는 정답을 바로 공개하지 않는다. 힌트는 연습 단계에서만 제공한다. 확인 전에 정답이 누출되지 않게 상태 API에서 first를 제거한다.
- 1일/7일 이후 확인을 같은 배정의 다음 학습으로 예약한다. 늦게 돌아와도 지연 확인을 같은 날 몰아서 하지 않도록 최소 다음 날 간격을 유지한다. 초깃값이지 최적 간격으로 검증한 것은 아니다.
- 요청 ID+내용 지문, 서버 상태 잠금, 현재 위치 검증으로 중복 제출/다른 탭의 오래된 제출을 다룬다. 완료/복귀는 서버 상태를 따른다.
- 교사 요약은 계획한 확인 수, 실제 응답, 그중 정답을 구분하며 미응답을 오답으로 세지 않는다.
- 실패 확인이 있으면 추가 수업을 추천한다. 교사의 “이대로 배정”에서만 새 계획을 생성하고 건너뛰기는 배정하지 않는다. 이미 처리한 추천은 반복 적용하지 않는다.
- 기존 solo_open wrapper를 추가하여 telemetry flag와 무관하게 새 경로를 식별한다. DB 099 미적용 상태에서 준비된 새 서비스를 운영 중이라고 주장하지 않는다.

## 최신 검증 상태 — Codex 재개, 2026-11-05

이 절이 과거 Claude 답변이나 중간 메모보다 우선한다. 사용자 요청으로 Codex가 작업을 재개했다. 운영 DB 적용·수집 활성화·커밋·푸시·배포는 하지 않았다.

### 이번에 수정한 결함

- 099의 표식 주석만 확인하는 검사는 표식을 남긴 함수 변경을 놓쳤다. 실제로 새 본문이 재실행 때 덮이는 것을 재현했다.
- 이제 `learning_path_compat.wrapper_hash`에 설치한 `pg_get_functiondef`와 소유자의 지문을 저장한다. 본문·시그니처·설정·보안 모드·소유자가 달라지거나 기존 지문이 없으면 재실행은 `compat_newer_function`으로 전체 롤백한다. 표식은 신뢰 근거가 아니다. 권한 검사는 별도로 유지한다.
- 검토 후 운영자 전용 `learning_path_adopt_legacy`로 변경한 본문을 명시적으로 채택할 수 있다. 표식을 유지한 변경도 채택 가능하며, 정상 래퍼를 채택하는 것은 막는다. 기존 표식 전용 레지스트리에 지문이 없는 경우 자동으로 현 상태를 신뢰하지 않는다. 이번 읽기 전용 점검에서 운영에는 099가 없었으므로 운영 레지스트리 전환은 필요하지 않았다.
- 098 선행조건도 함수 이름이 아닌 정확한 인자 타입과 반환 타입을 검사한다. 같은 이름의 잘못된 overload/반환 타입은 테이블 생성 전에 중단되는 회귀 검사를 추가했다.
- 실제 동시성 검사: 폐기 가능한 localhost 서버만 허용하고 `LEARNING_TEST_DISPOSABLE=yes`를 요구한다. 연결·쿼리·잠금 제한, 동시 출발 게이트, 시나리오별 연결 종료, setup/실패를 포함한 finally 정리를 추가했다. 이 검사는 클러스터 공통 anon/authenticated 역할도 만들므로 공유 서버에서 실행하지 않는다.

### 이번 재실행 결과

- **실제 PostgreSQL 16.15: 8개 연결 × 5라운드, 종료 코드 0.** 같은 배정 열기, 같은 위치의 다른 요청, 같은 요청 재시도, 같은 ID의 다른 내용, 열기/완료 경합, 교사 승인 재시도를 검증했다. 교착·중복 채점·중복 계획·진도 건너뜀 없음. 합성 기존 API fixture를 사용한 실제 다중 연결 검사이며 운영 인증 검증을 대신하지 않는다.
- `--fail-after-setup` 의도적 실패는 종료 코드 1, 이후 scratch DB 수 0으로 실패 정리도 확인했다.
- 설치 없이 공식 EDB ZIP을 작업 폴더에 풀어 127.0.0.1:55439에 임시 서버를 실행했다. 검사 후 종료했고 임시 비밀번호 파일도 제거했다. 시스템 서비스는 등록하지 않았다. `pg`는 admin 도구의 node_modules에만 설치했고 배포 의존성/잠금 파일은 바꾸지 않았다.
- 최종 재검증: 센서·제공 버전·학습 경로·호환 DB, 센서 core, 숙제 check-logic, 새 경로/포털/관리자/센서(플래그 켬·끔) 합성 브라우저, tsc 모두 종료 코드 0. npm run build도 종료 코드 0이며 기존 청크·플러그인 시간 경고가 있다.
- 환경이 없으면 실제 동시성 검사는 NOT RUN/종료 코드 2이고, 원격 Supabase 주소는 접속 전에 거부/종료 코드 1인 것도 확인했다.
- 이전 접근성 select 실패는 aria-label 수정으로 해결됐고 잠금 순서는 배정 → 상태로 통일됐다. 이 둘을 다시 미완료 작업으로 취급하지 않는다.

### Supabase 읽기 전용 확인

로그인된 프로젝트 `ajxforiicepnhizxwpyf`는 화면에서 main PRODUCTION이다. `BEGIN READ ONLY` 안에서 시스템 메타데이터만 조회했다. 097/098/099 핵심 테이블은 모두 없고 `_before_paths` 함수 수는 0이다. 기존 9개 엔드포인트의 시그니처·반환 타입·정의 해시를 확인했다. 특히 `solo_assign(uuid,uuid[],timestamptz,text) -> integer`이다. 전체 운영 함수 본문과 저장소의 동등성, 실제 역할별 동작은 아직 검증하지 않았다.

## 남은 작업 — 이 순서로 진행

1. 운영과 분리된 스테이징 Supabase를 준비한다. 운영 프로젝트에 테스트 fixture나 동시성 스크립트를 실행하지 않는다.
2. 운영의 최신 함수 본문을 읽기 전용으로 비교해 의도한 동작을 확인하고, 스테이징에서 097 → check → 098 → check → 099 → check를 적용한다. 절차는 `docs/learning-path-staging-runbook.md`를 따른다.
3. 실제 anon/학생/교사/관리자 역할과 앱 화면, 중지·복구를 스테이징에서 검증한다. 합성 브라우저 통과와 실제 Supabase 역할 통과를 구분한다.
4. 운영 적용이 승인되면 097 수집부터 제한적으로 켜서 실제 도착·누락·연결 품질을 확인한다. 이후 098/099를 검증한 순서로 적용한다.
5. 지연 확인 결과로 간격·추천 규칙을 검증한다. 1일/7일은 초깃값이다. 학습 효과가 검증됐다고 주장하지 않는다.
6. 레거시 재시험/게임 뒤 확인/교사 집계의 제공 버전 전환과 단체·숙제 편집기의 근거 블록 어댑터를 확장한다. 현재 evidenceProfiles 계약은 편집기 완성 구현이 아니다.
7. 읽기·문법·말하기는 별도 목표·평가 설계 후 확장한다. 어휘 회상 v1이 전체 영어 개별수업 완성을 의미하지 않는다.

래퍼가 교체되는 순간 기존 학생 엔드포인트를 완벽히 막는 DB 이벤트 트리거는 없다. 새 배정은 호환 검사로 중지되지만, 배포 직후 `099_check.sql`의 `compat_boundary_intact` 확인이 필수다. rollback은 권한 회수와 데이터 보존 방식이며 완전한 스키마 원복이 아니다.

## 검증 명령 / 작업 주의

작업 폴더 `C:/Users/likes/Desktop/pointbank/app`.

```text
node scripts/admin/test-learning-sensors.mjs
node scripts/admin/test-learning-delivery.mjs
node scripts/admin/test-learning-paths.mjs
node scripts/admin/test-learning-compat.mjs
node scripts/admin/test-learning-concurrency.mjs --pglite-smoke
node scripts/learning-sensors/check-core.mjs
node scripts/learning-sensors/check-path-browser.mjs
node scripts/learning-sensors/check-portal-coverage-browser.mjs
node scripts/learning-sensors/check-browser.mjs
node scripts/learning-sensors/check-browser.mjs --disabled
node scripts/homework/check-logic.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

실제 PostgreSQL 명령은 런북 1절을 따른다. PGlite smoke는 동시성 증거가 아니다. `pg`가 없거나 연결 환경이 없으면 실제 검사는 NOT RUN/종료 코드 2다.

기존 변경을 보존한다. 오래된 work/sensors 또는 work/sensors2 prepare/apply 스크립트는 재실행하지 않는다. 최신 프로젝트 파일이 원본이다.
