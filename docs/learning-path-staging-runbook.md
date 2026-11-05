# 097 → 098 → 099 스테이징 검증 런북 — 2026-11-05

**2026-11-06 실행 완료:** 스테이징의 실제 역할·로그인·MFA·화면·중지/복구를 통과한 뒤 운영에 097~100을 적용하고 31검사를 통과했다. [실행 기록](learning-release-verification-2026-11-06.md). 아래는 이후 재검증에 사용할 절차다. 먼저 **스테이징(운영과 분리된 Supabase 프로젝트 또는 운영 DB의 복제본)**에서 끝까지 수행하고, 통과한 뒤에만 운영에 같은 순서로 적용한다. 2026-11-05 읽기 전용 점검에서 확인된 운영 프로젝트(`ajxforiicepnhizxwpyf`, 화면에 PRODUCTION 표시)를 스테이징으로 쓰지 않는다.

## 운영 빌드의 수집 플래그 (2026-11-06 사용자 승인)

Vercel은 `npm run build:vercel`을 실행한다. `VERCEL_ENV=production`이고 플래그가 없으면 빌드 래퍼가 `VITE_LEARNING_SENSORS_ENABLED=true`를 명시적으로 주입한다. 로컬/preview는 여전히 기본 꺼짐이다. **운영에서 중지하려면 변수를 제거하지 말고 false로 지정**한다. 명시적 false/빈 값은 운영 기본값보다 우선한다. 097~100 스테이징/운영 DB 준비와 검증을 마쳤다. 코드 커밋 0db13443의 운영 자동 배포 성공과 실제 서비스의 센서 true를 확인했다.

## 0. 로컬에서 먼저 (이미 가능한 것)

```bash
cd app
node scripts/admin/test-learning-sensors.mjs
node scripts/admin/test-learning-delivery.mjs
node scripts/admin/test-learning-paths.mjs
node scripts/admin/test-learning-compat.mjs        # 099 호환 경계·재실행·후속 함수 교체
node scripts/admin/test-learning-concurrency.mjs --pglite-smoke   # 시나리오 코드 점검일 뿐 동시성 검증이 아님
```

## 1. 실제 PostgreSQL 다중 연결 검증 (로컬 통과, 2026-11-05)

실행 결과: 공식 EDB ZIP의 PostgreSQL 16.15에서 8개 연결 × 5라운드 통과(종료 코드 0). 의도적 setup 이후 실패도 종료 코드 1 및 잔여 scratch DB 0으로 확인했다. 서버는 작업 폴더에만 준비했고 시스템 서비스 등록 없이 검사 후 종료했다. 이는 합성 fixture의 실제 연결 경합 검사이며 Supabase 인증/운영 함수 동등성 검사를 대체하지 않는다.

필요한 것: PostgreSQL 14+ 일회용 localhost 서버, CREATE DATABASE/ROLE 가능한 계정, `pg` 패키지. 클러스터 공통 anon/authenticated 역할도 생성하므로 공유 서버를 사용하지 않는다. `LEARNING_TEST_DISPOSABLE=yes` 및 localhost 주소를 모두 요구한다. 연결 5초, 쿼리 20초, SQL 15초, 잠금 8초 제한을 적용한다.

```bash
docker run --rm -d --name lp-pg -p 127.0.0.1:5432:5432 -e POSTGRES_PASSWORD=secret postgres:16
cd app/scripts/admin && npm install --no-save --package-lock=false --ignore-scripts pg
LEARNING_TEST_DISPOSABLE=yes PG_ADMIN_URL=postgres://postgres:secret@localhost:5432/postgres node test-learning-concurrency.mjs --research --workers=8 --rounds=10
docker stop lp-pg
```

검사 내용(라운드마다 새 배정): ① 같은 배정을 N개 연결이 동시에 열기 → 상태 행 1개, 교착 없음 ② 같은 위치에 서로 다른 요청 ID로 동시 제출 → 정확히 1개만 성공, 나머지는 `path_changed`, 위치는 한 칸만 이동, 채점 관찰 1건 ③ 같은 요청 ID 동시 재시도 → 모두 같은 결과, 효과 1건 ④ 같은 요청 ID에 다른 내용 → 거부(`bad_request`) ⑤ 열기·마지막 제출 경합 → 완료 1회, 확인 기록 정확히 3건 ⑥ 교사 승인 동일 요청 동시 재시도 → 수업 1개. 교착(40P01)이나 예상 밖 오류가 있으면 실패하며 메시지에 시나리오 이름이 나온다. 종료 코드 2 = 환경이 없어 **미실행**.

## 2. 스테이징 적용 (순서 고정, 한 단계마다 확인)

0. 스테이징이 운영과 같은 선행 마이그레이션(041, 047/060, 053, 057~065, 074, 090 등)을 가졌는지 확인. 아래 읽기 전용 쿼리로 시그니처 확인(선행조건 점검이 099 안에도 있다):
   ```sql
   select proname, pg_get_function_identity_arguments(oid), prorettype::regtype
   from pg_proc where pronamespace='public'::regnamespace
     and proname in ('solo_open','student_home','solo_answer','solo_advance','solo_reveal','solo_test_submit','solo_assign','solo_assignment_for','solo_public_step','solo_correct_text','hw_staff_academy','academy_feature');
   ```
1. SQL Editor에서 `097_learning_sensors.sql` → `097_check.sql`(전 칸 true).
2. `098_learning_delivery_runs.sql` → `098_check.sql`(전 칸 true). 빠진 선행 객체가 있으면 이름과 함께 전체가 롤백된다.
3. `099_learning_paths.sql` → `099_check.sql`(전 칸 true, 특히 `compat_boundary_intact`).
   - `compat_newer_function` 오류: 099 이후에 누군가 래핑 대상 함수(`solo_open` 등)를 바꿨다는 뜻이다. **새 본문은 덮어쓰지 않았다.** 새 본문을 검토한 뒤 의도한 최신 동작이면 `select public.learning_path_adopt_legacy('<함수>','<인자 타입>');` 후 099를 다시 적용한다. 의도한 변경이 아니면 변경한 마이그레이션을 되돌린다. 이전 표식 전용 레지스트리에 지문이 없으면 자동 신뢰하지 않고 중단하므로 모든 대상 정의를 검토한 후 명시적 전환이 필요하다.
4. 앱은 `VITE_LEARNING_SENSORS_ENABLED`를 **켜지 않은 채** 스테이징에 배포해 새 개별수업 기능이 동작하는지부터 확인(수집 플래그와 새 경로는 독립).
5. 그 뒤에만 플래그를 켜고 `/admin/system`에서 도착 확인.

**후속 마이그레이션 규칙:** 래핑 대상 6개 함수(`solo_open`, `student_home`, `solo_answer`, `solo_advance`, `solo_reveal`, `solo_test_submit`)를 고치는 마이그레이션은 래퍼의 정의 지문을 바꾸므로(표식을 유지해도 탐지) 반드시 `<함수>_before_paths`를 고치거나, 위 adopt 절차를 쓴다. 래퍼가 사라져도 서버는 새 배정(`learning_path_assign`)을 `learning_path_protection_changed`로 막고, 교사 화면에 경고 배너가 뜬다. 다만 **이미 배정된 학생이 쓰는 `solo_open` 자체가 교체되면 그 순간부터 보호가 없는 상태**이므로 배포 직후 `099_check.sql`의 `compat_boundary_intact`를 반드시 확인한다.

## 2a. 학습 연구실 어드민 (100, 운영 DB 적용 완료)

099/check 다음에 `100_learning_research.sql` → `100_check.sql`을 적용한다. `/admin/learning`에서 집단 필터 → 분석 → 첫/최종 확인·지연 분모·내용 버전 → 제안 선택 → 검토 방향 저장 → 당시 근거 이력을 확인한다. 다른 교사/학생에게 RPC가 거부되는지, 플랫폼 관리자 MFA 조건, 저장 중 새 학습 데이터가 들어오면 재조회가 필요한지도 확인한다. 검토 저장은 수업/숙제 배정을 변경하지 않아야 한다. 자세한 기준은 `docs/learning-research-admin-handoff.md`.

100 중지는 `100_rollback.sql`이며 학생 학습과 기존 결정 이력을 보존한다. 전체 중지는 100 → 099 → 098 → 097이다. 복구는 097 → 098 → 099 → 100. 100의 실제 DB/브라우저 권한 확인도 운영 적용 승인 기준에 포함한다.

## 3. 역할별 스모크 테스트 (스테이징에서 실제 역할로)

테스트 학원·반·학생·열쇠(token)를 스테이징에만 만든다. 운영 학생 데이터를 쓰지 않는다.

| 역할 | 확인 | 기대 |
|---|---|---|
| anon(학생 열쇠 없음/틀림) | `select learning_path_open(gen_random_uuid(), gen_random_uuid())` | `not_found` 오류, 데이터 없음 |
| anon + 학생 열쇠 | 배정 열기 → 진단 문제만, 정답·미래 설명 카드 없음 | `step`에 `answer` 없음, 힌트 없음 |
| anon + 학생 열쇠 | 같은 요청 ID 재전송 / 다른 위치로 제출 | 저장된 같은 결과 / `path_changed` |
| anon + 학생 열쇠 | 옛 `solo_answer/advance/reveal/test_submit`를 경로 배정에 호출 | `use_path_flow` |
| anon | `select learning_path_assign(...)`, `learning_path_adopt_legacy(...)`, `solo_open_before_paths(...)` | `permission denied` |
| 다른 학원 학생 열쇠 | 남의 배정 열기 | `not_found` |
| authenticated(교사) | 같은 학원 학생에게 `learning_path_assign` → 미리보기 없이 승인 흐름 | 다른 학원 학생/반은 `bad_student`/`bad_class` |
| authenticated(교사) | `learning_path_teacher_summary(반)` | 실제 응답/정답 구분, `protection: []` |
| authenticated(교사) | 기능 닫힘(`academies.features.solo=false`) 학원에서 assign | `feature_closed` |
| authenticated(일반 사용자) | `admin_learning_run_summary(7)` | 관리자만 허용 |
| 관리자 | `/admin/system` 센서 수집 현황, 제공 버전 연결 패널 | 버튼을 눌러야 조회, 오류 시 문구 |
| 브라우저(실제 앱) | 교사: 단어 입력 → 계획 미리보기 → 승인 → 배정 / 학생: 진단 → 연습 → 확인 → 오늘 완료 대기 / 포털에 "다음 확인" 표시 / 모바일 | 승인 전에는 배정 0건 |

## 4. 중지 절차 (데이터 보존)

1. 클라이언트: `VITE_LEARNING_SENSORS_ENABLED=false`를 명시한 뒤 재배포(수집 중지, 학습은 계속).
2. 새 배정만 막기: `099_rollback.sql`(assign/feedback 권한 회수; 이미 배정된 학생의 학습·복습은 계속).
3. 선택 수집 중지: `098_rollback.sql`, 그다음 `097_rollback.sql`(RPC 권한 회수만).
4. 모두 기록을 지우지 않는다. 래퍼(`*_before_paths`)를 제거하는 완전 원복은 제공하지 않는다(경로 학생의 보호가 풀리므로). 필요하면 별도 검토.
5. 복구: 해당 SQL 파일을 다시 적용하면 권한이 복구된다(재실행 안전, 단 위 `compat_newer_function` 규칙).

## 5. 승인 기준

스테이징에서 ①~④ 로컬 검사 전부 통과 ② 실제 PostgreSQL 동시성 검사 통과(종료 코드 0) ③ 위 역할 표 통과 ④ 중지·복구 1회 리허설 ⑤ 교사·학생 실제 화면 확인. 하나라도 미실시면 운영 적용을 권하지 않는다.
