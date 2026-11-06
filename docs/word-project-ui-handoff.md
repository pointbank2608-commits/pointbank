# 단어 프로젝트(wm-v2) 학생·교사 화면 인수인계

## 실제 앱 연결 상태 (2026-11-07) — 아래 시안 설명보다 이 절이 우선한다

시안을 실제 앱에 연결했다. 문제 풀이(run)·채점·답 재전송·센서는 기존 흐름 그대로다.

| 화면 | 연결 위치 | 비고 |
|---|---|---|
| 학생 오늘 할 학습·이어서 하기·오늘 끝·완료 | `pages/WordMemoryStudentPage.tsx`의 home/done/ended | 응답에 `project`가 있는 새 계획만. wm-v1은 기존 화면 |
| 교사 배정 승인 | `components/wordMemory/WordMemoryAssignModal.tsx` | 전체 범위·구간, 목표일, 예상 일정(`ProjectPlan.tsx`). 공부 기간 선택은 목표일로 대체 |
| 교사 학생별 진행 | `components/wordMemory/WordMemoryCoach.tsx`의 "진행·시험" 탭 | project 가 있는 계획만 `TeacherProgress`, 아니면 기존 표시 |

서버 계약에 맞춘 점(시안 설명과 달라진 것):
- 다음 날들에 나눠서 할 복습 수는 `wm_today_state.waiting_review`를 그대로 표시한다(`review_due`에서 계산하지 않는다).
- 날짜는 서버 한국 날짜(`today.day`, `next_due`, `project.goal_date`, `progress.today`)만 쓴다. 배정 **전** 미리보기만 서버 값이 없어 `kstToday()`(Asia/Seoul)를 쓴다.
- 서버 목표일 = `시작일 + study_days + review_days`다. 교사가 고른 목표일에서 복습 기간을 뺀 값을 `studyDays`로 넘긴다.
- 서버 구간(50개)은 화면에서 묶어 20구간 이하로 보여 준다(3,520개 → 200개씩 18구간). 구간 시험은 그대로 50개 단위다.
- 하루 분량 조정은 진행 화면에서 하지 않는다. "다음 단계 카드" 탭으로 안내만 하고, `pace.on_track`만으로 늘리기 버튼을 띄우지 않는다.
- 하루 분량 변경 RPC·`expected_verified`는 아직 필요 없다(기존 다음 단계 카드가 맡는다).

검증: `node app/scripts/wordmemory/check-wordmemory-browser.mjs`(실제 SQL 090·096·103을 임시 Postgres로 돌려 실제 화면과 연결, 32개). 3,520개 승인 → 학생 학습 → 복습만 하는 날(waiting_review 55) → 교사 진행 → 완료까지 포함한다. 호스팅 스테이징(`iazqbylirdmsnnliehpu`)에서는 아직 확인하지 않았다 — 103/103b가 적용돼 있지 않고 교사 계정이 없다.

---

(이하 2026-11-07 오전 분리 시안 설명. 위 표와 어긋나는 부분은 위 절을 따른다.)

작성: 2026-11-07. 합성 응답으로 만든 **분리된 시안**이다. 서버·DB·기존 화면 파일은 건드리지 않았다(Codex가 수정 중인 `WordMemoryStudentPage.tsx`, `WordMemoryAssignModal.tsx`, `lib/wordMemory/*`는 읽기만 했다). 커밋·배포·운영 변경 없음.

## 보는 법

개발 서버(`npm run dev --prefix app`)를 켜고 `/scripts/wm-project/prototype.html`을 연다. 목록에서 시나리오를 고른다.

- 학생: `?view=student&s=<first-day | absent-return | review-only | refresh | goal-passed | last-word | completed | nothing-today | done-today | legacy-v1 | legacy-ended>`
- 교사 승인: `?view=approval`, 응답 유실 후 재시도: `?view=approval&fail=1`
- 교사 진행: `?view=progress`
- 검증·캡처: `node app/scripts/wm-project/check-wm-project.mjs` → `output/wm-project/`(29개 확인, 모바일 390px·데스크톱 1280px)

## 만든 파일

| 파일 | 역할 |
|---|---|
| `app/src/components/wordMemoryProject/model.ts` | 순수 계산: 학생 오늘 상태, 예상 일정, 구간 나누기·묶기, 진행 분류 합계 검사 |
| `.../StudentToday.tsx` | 학생 "오늘 할 학습" 화면 |
| `.../TeacherApproval.tsx` | 교사 승인(범위·하루 분량 상한·목표일·학생) |
| `.../TeacherProgress.tsx` | 교사 진행(분류·구간·분량 제안) |
| `.../fixtures.ts` | 합성 시나리오(11개 학생, 6개 진행 행). 3,520개 범위 |
| `app/scripts/wm-project/prototype.html·tsx` | 비교용 하네스(서버 호출 없음) |
| `app/scripts/wm-project/check-wm-project.mjs` | 시나리오 검증 |

## 화면 규칙(검증으로 고정한 것)

**학생**
- 버튼은 하나다. 처음이면 "오늘 할 학습 시작", 하던 게 있으면 "이어서 하기"(남은 문항 수 표시).
- 새 단어(하늘색)·복습(초록)·다시 확인(노랑)을 타일로 구분하고, 0인 타일은 숨긴다. 새 단어가 0이면 "오늘은 복습만 해요".
- 결석 뒤에도 "밀렸다"는 말을 쓰지 않는다. 오늘 분량(`counts`)과 나머지(`project.review_due - (counts.review + counts.hard)`)를 나누어 "남은 복습 N개는 다음 날들에 나눠서 해요"로만 안내한다.
- 목표일은 "(예상 일정이에요)". 지나도 "남은 단어도 이어서 배워요"이며 시작 버튼은 그대로다.
- 내부 점수·정확도·단계 이름은 보이지 않는다(검증이 금지어를 검사). "내가 익힌 단어 n / 전체"는 `project.verified`만 쓴다.
- 오늘 분량 없음: 다음 복습일(`next_due`)과 대기 수(`waiting_review`), 만나지 않은 단어 수(`unseen`)만 보여 준다. 완료(`project.completed`)는 기간 종료(`ended`)와 다른 화면이다.
- 기존 `wm-v1`(응답에 `project` 없음)은 익힌 단어 막대·목표일 없이 기존 방식 그대로다.

**교사 승인**
- 전체 범위, 하루 분량 상한(가볍게 새 3개·보통 5개·많이 10개, `plan.ts`의 `dailyBudget`), 목표일, 소개 뒤 확인 복습 기간을 보고 한 번 승인한다. 목표일은 `studyDays = 목표일 − 시작일 + 1`로 `wm_project_assign`에 넘긴다.
- 목표일에 못 맞으면 경고만 하고 **자동으로 바꾸지 않는다**. "하루 분량을 ○○로 바꾸기", "목표일을 예상 일정으로 바꾸기"는 교사가 눌러야 한다. 그대로 승인해도 된다.
- 승인한 하루 분량은 고정이라는 문구를 보여 준다. 늘리려면 다시 승인이 필요하다.
- 한 승인에 요청 번호 하나(`requestId`)를 쓰고, 응답이 유실돼 재시도해도 같은 번호를 쓴다. 하네스의 가짜 서버로 "2번 호출, 3명 생성, 번호 1개"를 검증했다.

**교사 진행**
- 학생마다 확인됨 / 오답 후 다시 확인 / 아직 확인 부족을 한 막대로 보여 준다. **오늘 복습 대기(`review_due`)는 겹칠 수 있어 막대에 더하지 않고** 따로 숫자로 둔다. 세 분류 합이 `total`과 다르면 화면에 집계 확인 안내가 뜬다.
- "확인됨"은 며칠 간격을 두고 도움 없이 맞힌 근거가 있는 단어다(범례에 적음).
- 목표일이 지난 행은 "목표일 지남 · 학습은 이어져요"로만 표시한다.
- 구간별 보기: 서버 구간(50개)을 화면에서 묶어 20구간 이하로 보여 준다(3,520개 → 200개씩 18구간).
- 하루 분량 늘리기는 **제안만** 한다. 교사가 "승인"을 누르기 전에는 아무것도 바뀌지 않는다.
- 기존 `wm-v1` 행은 "기존 방식(wm-v1)" 배지와 만난 단어·기억한 단어만 보여 준다.

## API에서 더 필요한 것(Codex에 요청)

1. **`review_due` 의미 확정.** 학생 화면의 "나눠서 하는 복습" 수는 `review_due`가 오늘 분량 상한과 무관한 전체 당일 복습 수라는 가정으로 계산한다. 아니라면 `counts` 옆에 `carried`(또는 상한 전 총 복습 수)를 달라.
2. **진행 응답에 계획 값:** `wm_plan_progress`에 `daily_mode`(승인한 하루 분량), `goal_date`, `start_date`, `study_days`, `review_days`가 없다. 지금은 `students[].project.goal_date`만 있다. 시안의 "늘릴까요?"와 목표일 표시에 필요하다.
3. **하루 분량 변경 RPC:** `wm_project_change_cap(p_plan, p_request_id, p_daily_mode)`처럼 교사 승인만 받는 함수와 변경 기록(언제부터 적용, 누가 승인)이 필요하다. 시안은 호출하지 않고 이벤트만 기록한다.
4. **뒤처짐 판정:** `pace.on_track`이 wm-v2에서 의미가 있는지 정의가 필요하다. 시안은 `on_track === false`일 때만 분량 제안을 띄운다. 서버가 `expected_verified`(오늘 기준 예상 확인 수)를 주면 임의 규칙 없이 비교할 수 있다.
5. **합계 보장:** `verified + needs_review + unconfirmed = total`을 서버가 보장하는지 확인. 시안은 어긋나면 경고를 띄운다.
6. **구간 크기:** `wm_plan_progress`의 `section_size`가 50으로 고정이라 3,520개면 71구간이다. 시안은 화면에서 묶지만, 응답 크기가 문제면 서버가 총 단어 수에 맞춰 키우는 편이 낫다.
7. **하루 상한 보장:** 결석 뒤에도 오늘 문항 수가 승인한 상한(`asks`)을 넘지 않는지 서버 테스트가 필요하다. 화면은 그 가정에 기대어 "한꺼번에 하라"는 표시를 하지 않는다.
8. **날짜 기준:** `goal_passed`, `next_due`의 기준 시간대(한국 날짜인지) 명시.
9. **큰 범위의 단어 모음:** `wm_collection`이 3,500개를 한 번에 주는지 확인(페이지네이션 필요 여부).
10. **`ended`일 때도 `project`가 오는지** 확인(완료 화면이 `project.completed`에 의존한다).
11. 단어 상한: `plan.ts`에 아직 `WM_MAX_WORDS = 1000`이 있고 `analyzeCards`만 상한 인수를 받는다. 배정 화면의 3,500개 입력 경로 확인이 필요하다.

## 실제 화면에 연결할 파일

- **학생:** `app/src/pages/WordMemoryStudentPage.tsx`의 `home`(약 229~260행)·`done`(261~282)·`ended`(213~228) 화면을 `StudentToday`로 교체한다. 실행(`run`) 화면과 답 제출·재전송 코드는 그대로 둔다. 문구는 `app/src/i18n/wordMemoryLocales.ts`로 옮긴다(시안은 한글 직접 입력). 이 파일은 현재 Codex가 수정 중이다.
- **교사 승인:** `app/src/components/wordMemory/WordMemoryAssignModal.tsx`에 승인 단계(범위 → 하루 분량 → 목표일 → 예상 일정)를 `TeacherApproval` 구조로 넣고, `lib/wordMemory/api.ts`의 `wmProjectAssign`(42행)에 `studyDays`·`reviewDays`를 넘긴다.
- **교사 진행:** `app/src/components/wordMemory/WordMemoryCoach.tsx`(진행 상태 `progress`를 `wmPlanProgress`로 읽는 곳)와 `WordMemoryResults.tsx`에 `TeacherProgress`를 연결한다.
- 공용: `model.ts`는 `lib/wordMemory/types.ts`와 `plan.ts`(`dailyBudget`)만 읽는다. 연결할 때 `StudioKit`(`components/studio/StudioKit.tsx`)의 아이보리 카드와 같은 스타일을 쓴다.

## 사전 전체에서 범위를 고르는 화면(별도 제안)

기존 단어장·초등 800 배정 화면을 먼저 쓰고, 사전 전체 범위 선택은 따로 만든다.

- 진입: 단어 사전(`/dictionary`)의 "교과과정 단어" 칩(학교급 → 학년군 → 주제)에서 "이 범위로 프로젝트 만들기". 지금 선택 바의 "숙제로 내기"(`state.pickedCards`)와 같은 방식으로 카드 목록을 승인 화면에 넘긴다.
- 선택 단위는 낱개가 아니라 **묶음**(학교급·학년군·주제·교육부 800 DAY)이다. 묶음 체크로 범위를 쌓고, 합계(개수)와 겹침(중복 제거 후 개수)을 즉시 보여 준다.
- 정렬은 진도순(교육부 800 DAY·레벨) 기본, 알파벳순 선택. 빈도순은 이전 결정으로 제외.
- 3,500개 이상은 저장 전에 구간(200개씩)으로 쪼갠 미리보기를 보여 주고, 서버 상한·중복(`wm_clean_cards`) 결과를 확인한 뒤 승인 화면으로 넘긴다.
- 카드를 요청에 실어 보내는 방식이라 큰 범위는 요청 크기가 커진다. 서버가 `source`(사전 쿼리 조건)로 카드를 만드는 방식이 필요한지 Codex와 정할 것.

## 남은 일 / 한계

- 시안은 합성 응답이라 실제 `wm_today_state`·`wm_plan_progress`와의 필드 일치는 `types.ts` 기준으로만 맞췄다. 연결 후 스테이징으로 다시 확인해야 한다.
- 문제 풀이(run) 화면의 스튜디오 스타일 적용은 이번 범위가 아니다.
- 교사 화면은 앱의 사이드바·탭 안에 넣은 모습이 아니라 단독 시안이다.
- 학생 6명 이상, 학생 수백 명일 때의 목록 정렬·필터·검색은 아직 없다(필요 시 "도움 필요한 학생 먼저" 정렬 제안).
