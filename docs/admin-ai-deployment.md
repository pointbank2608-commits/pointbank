# 어드민 AI 배포

오류 묶음은 한 번 분석하고, 문의 초안은 최신 사용자 메시지를 기준으로 교체한다. 자동 작업은 5분마다 최대 4건을 처리한다. 문의 초안은 관리자만 열람하며 기존 답변 입력란에 가져온 뒤 직접 보내야 한다.

## 활성화

1. 대상 Supabase 프로젝트에 `supabase/130_admin_ai.sql`을 적용한다. 최근 7일 오류 묶음과 답변을 기다리는 문의가 처음 작업 목록에 들어간다.
2. `npx supabase functions deploy admin-ai --project-ref <project-ref> --no-verify-jwt`를 실행한다. 함수는 요청의 `x-cron-secret`을 검증한 후 작업을 가져온다.
3. 대상 프로젝트의 Edge Function Secrets에 `OPENAI_API_KEY`와 별도로 32자 이상 무작위 `ADMIN_AI_CRON_SECRET`을 설정한다. 같은 값을 Vault 전용 화면의 `admin_ai_cron_secret`에 넣고, 프로젝트 기본 URL을 `admin_ai_project_url`에 등록한다. 값을 리포지토리나 SQL 편집기 기록에 남기지 않는다. `ADMIN_AI_MODEL`을 생략하면 `gpt-6-luna`를 사용한다.
4. `supabase/130_admin_ai_schedule.sql`을 적용한 뒤 앱을 배포한다.

## 검증

- 시스템 상태에서 실제 오류 묶음에 AI 분석이 표시되는지 확인한다. 모델에 배포 내역을 넘기지 않는다. 구버전 파일 오류에 대해 현재 운영 도메인의 공개 JS 파일 검사 결과를 제공한다.
- 테스트 문의에 초안이 표시되는지 확인한다. 보내기 전에는 사용자 문의 대화에 새 메시지가 없어야 한다. 사용자에게서 후속 메시지가 오면 이전 초안은 더 이상 표시되지 않는다.
- 모델에 보내는 입력은 일부 오류 로그, 문의 텍스트와 관련 기본·발행 FAQ다. 기존 문의 유사도 검색으로 관련 FAQ를 고른다. 첨부파일과 계정 식별자는 조회하지 않고, 텍스트 안의 이메일·전화번호·키 등 알려진 패턴을 마스킹한다.

```sql
select kind, state, count(*) from public.admin_ai_jobs group by kind, state;
select jobname, schedule, active from cron.job where jobname = 'admin-ai';
```

자동 처리를 일시 중지하려면 `select cron.unschedule('admin-ai');`를 실행한다. 다시 시작할 때는 예약 SQL을 다시 적용한다.

## 관리자 로그인과 기록

사용자 승인에 따라 `138_admin_auth_activity.sql`과 `139_admin_password_login.sql`을 적용하고 관리자 화면의 MFA 단계를 제거한다. 관리자 계정 역할을 서버에서 확인한다. Supabase Authentication의 Audit Logs에서 DB 저장을 켜면, 이후의 로그인·로그아웃이 어드민 설정의 기록에 표시된다. 기존 DB 저장이 꺼져 있던 기간의 접속 이력은 이 화면에 소급해서 생기지 않는다.

탭 종료는 로그아웃으로 취급하지 않는다. 학부모·학생 전용 열쇠로 여는 화면의 접속은 Supabase 계정 로그인과 별개다.

## 2026-11-23 운영 적용

운영 프로젝트 `ajxforiicepnhizxwpyf`에 130·138·139와 `admin-ai` 함수를 적용했다. Vault와 함수에 전용 비밀값을 등록하고 5분 간격 자동 작업을 활성화했다. 관리자 설정 화면에서 실제 로그인·로그아웃 이력이 표시되는 것을 확인했다. 검증용 문의는 `[운영 AI 검증] 활동지 인쇄 방법`이며 고객에게 발송하는 메시지는 생성하지 않았다.
