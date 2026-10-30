# 출시 전 UX/UI 수정 — 2026-10-30

후속 요청: 사용자가 커밋·푸시·배포를 승인하여 이번 UX 수정과 앞서 완료한 STEM 블록 편집 작업을 함께 릴리스 대상으로 준비했습니다. 아래의 ‘배포하지 않음’ 기록은 최초 구현 완료 시점의 상태이며, 실제 릴리스 결과는 후속 완료 보고를 기준으로 확인합니다.

코드에 반영했으며 이번 변경은 커밋·푸시·배포하지 않았습니다. 운영 DB의 수업·단어장은 변경하지 않았습니다. 이전 STEM 작업과 다른 기존 변경도 유지했습니다.

## 변경 내용

1. **단어장 → 게임**: 현재 로그인 사용자·학원에 속한 전달 자료와 선택 게임이 호환되고 게임 준비 검증을 통과하면 준비 방식 선택창을 생략합니다. 미리보기의 큰 ‘게임 시작’을 눌러야 실행됩니다. 일반 게임 진입의 기존 준비 흐름은 유지합니다. 부족한 자료는 다른 샘플로 바꾸지 않고 해당 입력 단계와 안내를 표시합니다. ‘내용 수정’은 임시 게임만 수정합니다.
2. **돌림판**: 항목 수와 글자 너비를 조각 폭과 비교합니다. 긴 목록은 번호 조각 + 전체 단어 목록으로 표시하고, 짧은 3개 단어는 조각에 그대로 표시합니다. 목록은 터치·스크롤·키보드로 탐색할 수 있습니다. 결과는 전체 단어를 줄바꿈하며 표시하고 보조기기에 알립니다. 무작위 추첨·회전 계산·항목 제거 로직은 변경하지 않았습니다.
3. **수업에 추가**: 기존 스냅샷 생성·활동 추가·저장 함수와 동시 수정 보호 조건을 유지했습니다. 저장 성공 후 수업 이름이 포함된 완료 화면과 ‘수업 보기’를 제공합니다. 수업 보기에서 추가한 슬라이드를 선택하고 편집 화면의 초기 포커스 이동 이후 해당 활동으로 스크롤합니다. 중복 클릭 차단과 실패 시 선택 유지·재시도를 유지했습니다.
4. **스크립트**: 전체 스크립트와 자동 입력 도구를 기본 접힌 ‘스크립트 보기·수정’에 넣었습니다. DOM의 접힘만 바꾸므로 편집 값은 보존됩니다. 슬라이드 전환 시 다른 슬라이드의 편집 상태가 섞이지 않도록 슬라이드 ID를 편집 컴포넌트 키로 사용합니다.
5. **준비 화면 설정**: 미리보기 내부의 수업 설정·자막 선택·따라하기 전환을 숨기고 영상 아래 ‘수업 설정’으로 모았습니다. 기존 반복·속도·자막·배역·진행 방식 편집을 유지합니다. 실행 화면의 설정은 그대로 제공합니다. 저장 설정이 달라지면 이전 탭의 재생 보조 기억이 새 설정을 덮지 않도록 기억 키를 구분합니다.
6. **전체화면 설정**: 영상 아래 공간을 늘리던 인라인 패널을 오버레이로 바꿨습니다. 영상 영역의 실제 위치·높이를 기준으로 패널을 제한하고 패널 내부만 스크롤합니다. 영상·자막·진행바·조작부의 크기는 설정을 열어도 유지됩니다. 닫기·Escape·Tab 순환·설정 버튼으로 포커스 복귀를 지원합니다. Escape 한 번은 패널만 닫으며 전체화면은 유지됩니다.
7. **표현 카드**: 표현 영역은 한 열로 패널 너비를 사용하고 영어·한글 모두 자연스럽게 줄바꿈합니다. 학습 내용 전체는 기존처럼 기본 접힘이며 선택 영상의 실제 학습 데이터를 사용합니다.
8. **활동 이름**: 원본 영상 제목과 활동 종류를 구분하는 표시 전용 함수를 추가했습니다. 원본 영상에서 상속된 긴 제목은 활동 종류 이름으로 표시하고 사용자 지정 이름은 보존합니다. 실제 포함 활동만 저장 순서대로 표시하며 저장된 제목은 수정하지 않습니다. 이전 탭에 남은 수업 진행 상태도 처리합니다.

영상 오류 처리, YouTube URL·API 연결 방식, 재생 엔진은 변경하지 않았습니다. DB 스키마 변경은 없습니다.

## 수정 파일

| 역할 | 파일 |
|---|---|
| 단어장 전달·준비·임시 편집 | `app/src/components/GameWorkspace.tsx`, `app/src/components/GameSetupGuide.tsx`, `app/src/lib/useGameTemplates.ts` |
| 돌림판 표시 | `app/src/components/SpinWheel.tsx` |
| 수업 추가 완료·선택·스크롤 | `app/src/components/AddActivityToLesson.tsx`, `app/src/pages/CurriculumPage.tsx`, `app/src/components/LessonSlideSorter.tsx` |
| 영상 준비·실행 설정 UI | `app/src/components/ShadowBoard.tsx`, `app/src/components/TeachingVideoFrame.tsx`, `app/src/styles/video-classroom-v3.css` |
| 표현 카드 | `app/src/styles/video-library-v2.css` |
| 활동 이동 표시 이름 | `app/src/components/LessonVideoActivityNav.tsx`, `app/src/context/LessonRunnerContext.tsx`, `app/src/lib/lessonActivityLabels.ts` |
| 한국어·영어 안내 | `app/src/i18n/locales/ko.ts`, `app/src/i18n/locales/en.ts` |
| 검증 도구 | `app/scripts/prelaunch-ux/` |

## 검증 범위와 한계

실제 React 페이지·컴포넌트를 실행하되, 인증/API/DB를 격리 테스트 저장소로 바꾼 로컬 브라우저에서 확인했습니다. 테스트 데이터의 수업 이름은 ‘QA 전용 추가 검증 수업’입니다. 실제 `appendActivityToLesson` 함수를 사용하고 Supabase 응답만 테스트 저장소로 연결했습니다. 생성된 스냅샷과 저장한 playlist를 확인하고 브라우저 새로고침 후 보존을 확인했습니다.

**운영 Supabase에 새 테스트 수업을 만들거나 저장하는 왕복 검증은 하지 않았습니다.** 운영 배포 이후의 실제 로그인·네트워크·RLS 환경은 이번 로컬 검증만으로 보장하지 않습니다. 영상 재생/외부 YouTube 임베드 성공 여부도 이번 검증 대상에서 제외했습니다. 화면 크기 테스트는 공유 영상 프레임과 편집 화면에서 수행했습니다.

검증 실행:

```powershell
npm --prefix app run build
# 아래 명령은 app 디렉터리에서 실행
node scripts/prelaunch-ux/check.mjs
node scripts/prelaunch-ux/extra.mjs
node scripts/prelaunch-ux/capture-before.mjs
```

- 주 검증: 단어장 자료 16개 전달, 자동 실행 없음, 일반 진입 준비창, 전체 스크립트 기본 접힘·값 보존, 준비 설정 값 반영, 전체화면 크기 유지·포커스 복귀·종료·뒤로가기, 추가 실패·재시도·중복 클릭·저장·새로고침, 실제 활동 순서·사용자 이름·이동, 모바일 설정·돌림판.
- 추가 검증: 실제 단어장 화면에서 게임 선택, 내용 수정 후 임시 게임 반영·원본 유지, 긴 추첨 결과, 빈 자료의 필요한 입력 화면·오류 안내, 짧은 3단어 표시, PC·모바일 표현 카드.
- `output/prelaunch-ux/checks.json`, `extra-checks.json`: 최종 브라우저 결과.
- `output/prelaunch-ux-build.txt`: 타입 검사·프로덕션 빌드 결과.
- `output/prelaunch-ux-lint.txt`: 변경 파일 검사. 기존 Fast Refresh 경고와 기존 LessonRunnerContext 훅 의존성 경고가 남아 있습니다. 새 변경의 lint 오류는 없습니다.

기존 화면에서는 전체화면 설정을 열 때 영상 높이가 약 **644px → 130px**로 줄어드는 것을 재현했습니다. 수정 후 설정창을 열기 전후의 영상 사각형이 동일함을 검사했습니다.

## 화면 기록

모두 격리 테스트 데이터로 캡처했습니다. 실제 수업 영상 썸네일이나 재생 성공을 보여주는 캡처가 아닙니다.

| 화면 | 수정 전 | 수정 후 |
|---|---|---|
| 단어장 중복 준비창 | `output/prelaunch-ux/before-duplicate-preparation.png` | `output/prelaunch-ux/list-preview-desktop.png` |
| 돌림판 긴 16단어 | `output/prelaunch-ux/before-wheel-desktop.png` | `output/prelaunch-ux/wheel-desktop.png`, `wheel-mobile.png` |
| 수업 준비 스크립트·설정 | `output/prelaunch-ux/before-video-editor.png` | `output/prelaunch-ux/video-editor-desktop.png` |
| 전체화면 설정 | `output/prelaunch-ux/before-fullscreen-settings.png` | `output/prelaunch-ux/fullscreen-settings-desktop.png`, `settings-mobile.png` |
| 수업 추가 | — | `output/prelaunch-ux/lesson-added-confirmation.png`, `added-activity-selected.png` |
| 표현 카드 | — | `output/prelaunch-ux/expressions-desktop.png`, `expressions-mobile.png` |
| 활동 이동 | — | `output/prelaunch-ux/lesson-activity-navigation.png` |
| 짧은 단어·긴 결과 | — | `output/prelaunch-ux/wheel-short-words.png`, `wheel-full-result.png` |

## 코드 반영·보류

- 로컬 코드 수정, 타입 검사·빌드·격리 브라우저 검증을 수행했습니다.
- 커밋·푸시·배포는 하지 않았습니다.
- 운영 DB의 수업 저장 검증과 실제 교실 기기의 터치·전체화면 검수는 남아 있습니다.
- 별도 진행 중이던 STEM 및 기타 기존 변경을 덮어쓰거나 되돌리지 않았습니다.
