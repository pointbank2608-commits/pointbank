# 학생 포털 단어 프로젝트 링크 검증 — 2026-11-08

## 원인

- 저장소에서 `student_session_student(uuid)`를 정의하는 최신 마이그레이션은 `045_student_portal.sql`이다. 유효한 세션을 찾으면 5분 조건이 있는 `UPDATE student_sessions` 문을 실행한다. 로그인 직후처럼 수정 대상이 없더라도 `UPDATE` 문 자체는 읽기 전용 트랜잭션에서 허용되지 않는다.
- `090l`과 `103`의 `wm_student_links(uuid)`는 `STABLE`이며 이 세션 헬퍼를 호출했다. PostgREST의 읽기 전용 실행에서 `25006`이 발생하고, `WHEN OTHERS`가 이를 `[]`로 바꿨다. 역할 차이가 아니라 트랜잭션 모드 차이다. PGlite에서 `090l` 및 `103` 원본의 읽기/쓰기 결과 차이를 재현했다. 스테이징에서 실제 헬퍼가 `25006`을 반환하는 것도 확인했다.
- 기존 `103c_word_project_portal_links.sql`은 유효한 세션과 배정을 쓰기 없이 조인하고 포괄 예외 처리를 제거한다. 만료·없는 세션, 보관 학생, 비공개 배정에는 빈 목록이 정상이다. 실제 조회 오류는 RPC 오류로 전파된다.

## 스테이징 확인

- `iazqbylirdmsnnliehpu` 카탈로그에서 기존 `103c`의 읽기 전용 방식이 이미 적용돼 있음을 확인했다. 이번에 새 DDL을 적용할 필요는 없었다.
- `BEGIN READ ONLY`, `SET LOCAL ROLE anon`: 실제 세션 헬퍼 SQLSTATE `25006`, 수정된 목록에서 `wm-v1`·`wm-v2` 링크 2건, `wm_open`과 `wm_collection` 정상.
- 로컬 서버에 스테이징 공개 환경 변수만 덮어썼다. 운영용 `.env.local`은 편집하지 않았으며 학습 센서는 껐다. 별도 포트에서 교사 로그인 없이 합성 학생으로 `/s`에 로그인했다. 실제 PostgREST를 통해 두 버전 카드 표시와 각 `/wm` 오늘 학습 화면 열기(`wm_open`, `wm_today_state`), v1 단어 수집장 열기(`wm_collection`)를 확인했다. 별도 SQL로 두 버전의 합성 배정을 준비했으며 교사 배정 UI 자체는 로컬 브라우저 회귀에서 검증했다.
- 확인 후 포털에서 로그아웃했다. 이번 검증용 배정·진단 세션·합성 학생·보호자 레코드 잔여 0건을 읽기 전용으로 확인했다. 기존 QA 학생의 보호자 정보 및 다른 배정은 변경하지 않았다.

## 코드 및 회귀

- 성공한 빈 목록과 실패를 구분한다. 실패 시 학생에게 안내와 재시도 버튼을 보이고, 기술 오류 문자열은 학생 화면에 표시하지 않는다.
- 공통 PGlite fixture가 `045`의 실제 세션 함수 본문을 읽는다. `test-wordmemory.mjs`는 `090l`의 실패, SQLSTATE, `103c` 이후 v1, 없는/만료된 세션을 검증한다. `test-word-projects.mjs`는 v2와 anon/authenticated 읽기 전용을 검증한다.
- 브라우저 하네스는 지정된 익명 RPC에 함수 속성에 맞춰 실제 PGlite 읽기 전용 또는 읽기/쓰기 트랜잭션과 anon 역할을 적용한다. 교사 세션 없이 두 링크를 클릭하고, 오류 메시지와 재시도도 확인한다.
- 결과: `npx tsc --noEmit -p tsconfig.app.json` 통과. `test-wordmemory.mjs` 91개, `test-word-projects.mjs` 통과, `check-wordmemory-browser.mjs` 35개 통과.

## 운영 판단

운영 `ajxforiicepnhizxwpyf`에서는 함수 메타데이터만 읽기 전용으로 조회했다. `wm_student_links`가 `STABLE`이지만 세션 헬퍼를 부르지 않고 `WHEN OTHERS`도 사용하지 않는다. **이 결함을 고치기 위한 운영 SQL 재적용은 필요하지 않다.** 운영 계정으로 실제 배정을 열어보지는 않았다.

다른 환경에서 `090l` 또는 `103`의 구형 함수가 확인되면: 현재 함수 정의와 권한을 먼저 보관 → 기존 `103c`만 적용 → anon 읽기 전용에서 배정과 범위 확인 → 실제 포털 확인. 운영 적용 및 새 오류 안내의 앱 배포는 별도 요청 이후에만 진행한다. 이번 작업에서는 운영 DB 변경·커밋·푸시·배포를 하지 않았다.
