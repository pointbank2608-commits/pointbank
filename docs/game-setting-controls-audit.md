# 게임 개별 설정 노출 점검 — 2026-10-27

## 범위와 원인
공통 준비 화면으로 옮기는 과정에서 게임 본체에 남은 설정, itemsHidden으로 숨는 편집 영역, GameManagement 메뉴와 페이지 편집기의 연결을 대조했다. 설정 저장 버튼 검사만으로 각 옵션의 누락을 확인할 수 없으므로 별도로 조사했다. 전체 게임의 모든 문제·점수·그림을 전수 플레이한 결과는 아니다.

## 발견 및 수정
| 게임 | 준비 창에서 빠졌거나 찾기 어려웠던 설정 | 수정 |
|---|---|---|
| 시한폭탄 (이전 요청) | 최소·최대 폭발 시간 | 기존 bombRange와 엔진을 그대로 연결, 공통 시간 입력 재사용 |
| 문장 잡기 | 1–5단계, 문장 표시 시간 | 기존 catchLevel/catchSeconds를 준비 창과 게임에서 공유 |
| 돌림판 | 당첨된 항목 제거하며 진행 | 준비 창에도 노출, wheelEliminate로 게임별 저장 |
| 타이머 맞추기 | 공용 도전판/참가자별 순위, 숫자 보임/숨김 | 준비 창에도 노출, timerMode/timerShowClock으로 게임별 저장 |

타이머의 목표 시간과 패스 더 볼의 최소·최대 시간은 기존 페이지 편집기에 연결돼 있어 유지했다. 이름·참가자·문항 편집은 이미 페이지에 있는 기능을 중복 복원하지 않았다. 신규 옵션이 없는 과거 게임은 기존 기본값(돌림판 제거 끔, 타이머 공용 도전판·숫자 숨김)을 사용한다. 문장 잡기 설정을 변경하면 진행 중 표시 타이머를 취소하고 준비 상태로 돌아간다. 기존 단어·팀·목표 시간·소리 설정은 보존한다.

## 검증
- check-setting-controls.mjs: 문장 잡기 3단계/4.5초, 돌림판 제거 켬, 타이머 순위/숫자 보임을 실제 준비 창에서 변경 → 저장 → 다시 열기 → 같은 ID 갱신 확인. PC 1440px/모바일 390px 설정 영역 확인, 런타임 오류 없음.
- check-settings-all.mjs: 일반 게임 59종 저장·같은 ID 갱신·모바일 회귀 검사 59/59 통과, 오류 없음. 휴대폰 참여 보카 대회는 별도 전용 흐름이며 이번 일반 설정 검사에 포함하지 않았다.
- 시한폭탄 check-bomb-range.mjs는 이전 작업에서 12–18초/고정 12초, 실제 엔진 타이머 12000ms를 검증했다.
- TypeScript 빌드 검사와 Vite 프로덕션 빌드 통과.
- 합성 API/사용자로 실행. 운영 자료 변경 없음. 사용자 요청에 따라 이번 설정 복원 변경을 선별 커밋·푸시하고 자동 운영 배포한다.

## 파일
공유 입력: BombRangePicker.tsx, CatchSentenceSettings.tsx, TimerPlaySettings.tsx.
연결: BombPage.tsx, CatchSentencePage.tsx, TimerMatchPage.tsx, WheelPage.tsx, TimeBomb.tsx, CatchSentence.tsx, TimerMatch.tsx.
타입·문구: lib/types.ts, i18n/locales/ko.ts, en.ts.
검사: scripts/games/check-setting-controls.mjs, check-bomb-range.mjs.
화면: output/{catchsentence,wheel,timer}-settings-{desktop,mobile}.png.
