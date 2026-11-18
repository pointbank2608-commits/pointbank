# 학부모 페이지 `/p`

선생님은 학생관리의 **학부모 계정**에서 학생을 선택하고 보호자의 동의를 확인한 뒤 성함과 전화번호를 등록한다. 성함과 번호는 암호화해 보관하고 관리 화면에는 성함과 번호 끝 네 자리만 표시한다. 연결 링크는 등록된 보호자에게 개별적으로 전달한다. 링크는 7일 동안 한 번만 쓸 수 있다. 새 링크는 이전의 미사용 링크를 만료시킨다. 기기 연결은 최대 180일이다. 보호자 성함이나 전화번호를 변경하거나 계정을 삭제하면 기존 기기와 대기 중인 링크가 해제된다. 한 기기에서 자녀를 여러 명 연결할 수 있고 푸시 수신은 자녀별로 켠다.

학생은 `/s`에서 이름과 등록된 학생 또는 보호자 번호로 들어간다. 선생님이 미등록 학생의 첫 로그인 번호를 등록할 수 있고, 기존 번호 변경·조회·삭제는 원장이 관리한다.

안드로이드는 Chrome에서 `/p`를 열고 **푸시 켜기**를 누른다. iOS/iPadOS 16.4 이상은 Safari에서 **홈 화면에 추가**를 먼저 한다. 홈 화면 앱에서 연결이 이어지지 않는 경우 복사한 초대 링크를 붙여 넣은 뒤 알림을 허용한다. 별도 앱스토어 등록은 필요하지 않다.

| 종류 | 발행 기준 | 완료 기준 |
|---|---|---|
| 온라인 숙제 | 개인 배정 대상이 생성됨 | 서버 제출 완료 |
| 개별 숙제 | 개별수업을 숙제로 배정 | 서버 전체 완료 |
| 문법 숙제 | 문법 숙제로 배정 | 서버 최종 완료. 필요한 복습이 남으면 별도 표시 |
| 단어암기 프로젝트 | 개인 배정 대상이 생성됨 | 전체 완료 표시 없음. 하루 분량 완료를 전체 완료로 처리하지 않음 |

알림함은 기존 배정·완료 기록을 사용한다. 휴대폰 푸시는 수신을 켠 뒤의 새 변화를 대상으로 하고, 잠금 화면에 이름·숙제 제목·점수를 넣지 않는다. 미완료는 페이지에서 확인한다. 마감 전후 미완료 독촉, 오프라인 과제, 일반 개별수업은 푸시 범위에 들지 않는다. 표시된 완료는 수행 기록이며 학습 성과 판정이 아니다. 미리보기나 별도 학습 센서를 추가하지 않았다.

## 적용 및 확인

1. 스테이징에서 `supabase/133_parent_portal.sql` → `supabase/133_parent_portal_check.sql` → `supabase/134_student_account_staff_creation.sql`을 실행한다.
2. 환경마다 VAPID 키를 한 번 생성한다(예: `npx web-push generate-vapid-keys`). 공개 키는 Edge Function의 `PARENT_PUSH_PUBLIC_KEY`로 저장하고 개인 키는 함수 비밀 `PARENT_PUSH_PRIVATE_KEY`로만 저장한다. `PARENT_PUSH_SUBJECT`에는 운영 연락용 HTTPS 주소 또는 `mailto:` URI를 쓴다. 별도의 32자 이상 무작위 `PARENT_PUSH_CRON_SECRET`을 Edge Function과 Vault(`parent_push_cron_secret`)에 같은 값으로 보관한다.
3. Vault에 해당 프로젝트의 `https://<project-ref>.supabase.co`를 `parent_push_project_url`로 저장한다. `supabase functions deploy parent-push --no-verify-jwt --project-ref <project-ref>`로 함수 배포 후 `supabase/133_parent_push_schedule.sql`을 적용한다. 이 함수는 JWT 대신 별도 크론 비밀을 검증한다. 발송 준비를 확인한 뒤 `public.private_config`의 `parent_push_public_key`에 공개 키를 저장하면 학부모 API가 연결된 기기에 그 키를 제공한다. 대기열은 1분마다 처리하며 일시 실패는 최대 5회 시도한다.
4. 실기기에서 Android Chrome 및 iPhone 홈 화면 앱 각각을 보호자 링크로 연결한다. 푸시를 켠 뒤 교사가 시험 숙제 발행, 학생이 완료할 때 페이지와 잠금 화면을 모두 확인한다. 푸시 탭으로 해당 자녀의 알림함 열기, 푸시 끄기, 개인 연결 끊기, 원장의 전체 해제도 확인한다.

푸시를 즉시 중지하려면 `select cron.unschedule('parent-push');`를 실행한다. 페이지의 현황과 알림함은 계속 확인할 수 있다. 공개 키를 교체할 때는 이전 브라우저 구독을 다시 등록해야 한다.

로컬 합성 권한·상태·대기열 검사: `node app/scripts/homework/check-parent-portal.mjs`. 모바일 화면과 등록·해제·알림함 검사는 `node app/scripts/homework/check-parent-portal-browser.mjs`(API와 브라우저 구독은 합성). 도구를 다른 경로에 설치했다면 `PARENT_TEST_NODE_MODULES`에 PGlite·Playwright Core가 들어 있는 `node_modules` 경로를, 별도로 설치한 Chrome을 쓸 경우 `PARENT_TEST_CHROME`에 실행 파일 경로를 지정한다. Deno에서는 서버 함수 타입 검사와 합성 푸시 서비스에 대한 VAPID 암호화·HTTP 결과 처리를 확인했다. 운영 반영과 실기기 수신은 별도로 확인한다.
