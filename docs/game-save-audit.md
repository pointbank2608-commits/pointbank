# 게임 저장·수업 연결 점검 (2026-10-25)

## 확인한 오류

Sentence Splash 저장 문제를 계기로 게임 카탈로그 60종의 같은 경로를 조사했다. 추가로 다음 10종에서 **새 수업의 게임 슬라이드에 저장된 게임이 없는 상태**에서 설정을 적용하면 화면의 임시 미리보기만 바뀌고, 바깥 수업 저장에는 게임 템플릿 ID가 전달되지 않는 문제가 재현됐다. 다시 열거나 발표하면 기본 샘플로 돌아갈 수 있었다.

- 모험 게임 7종: Balloon Pop, Word Train, Word Fishing, Sentence Rocket, Grammar Detective, Treasure Hunt, Word Claw Machine
- 스토리북 게임 3종: Feed the Monster, Sentence Bridge, Sentence Tower

재현 결과: `output/game-save-audit/reproduction.json`. 수정 전 실제 수업 편집 화면에서 각 게임의 제한 시간을 바꾸고 설정 적용 → 수업 저장을 눌러 10종 모두 저장 참조가 빠지는 것을 확인했다. 이미 저장된 게임을 편집할 때는 기존 업데이트 경로가 있어 이 오류가 가려졌다.

## 수정

`useGameTemplates.persistConfig`가 기존 템플릿은 업데이트하고, 수업 안의 새 게임이면 레슨 반에 새 템플릿을 만든 뒤 선택 ID를 갱신한다. 기존 GameEmbedContext의 onSelect가 그 ID를 수업 블록에 전달한다. 독립 게임 미리보기는 기존 임시 자료·명시적 저장 흐름을 유지한다.

- `app/src/lib/useGameTemplates.ts`
- `app/src/pages/AdventureGamePage.tsx`
- `app/src/pages/StorybookGamePage.tsx`

저장 실패 시 선택/입력을 바꾸지 않는다. 다시 누르면 같은 입력으로 재시도할 수 있고, 기존 자료 수정 실패 시 저장된 원본을 유지한다. DB 스키마·실제 사용자 자료·수업 ID는 바꾸지 않았다.

## 검증 범위와 재실행

`app/`에서 실행한다.

```powershell
node scripts/games/check-game-save-audit.mjs
node scripts/games/check-game-save-audit.mjs --native-only
node scripts/games/check-splash-lesson-save.mjs
node scripts/games/check-adventure-page.mjs
node scripts/games/check-storybook-page.mjs
node node_modules/typescript/bin/tsc -b
node node_modules/oxlint/bin/oxlint src/lib/useGameTemplates.ts src/pages/AdventureGamePage.tsx src/pages/StorybookGamePage.tsx
node node_modules/vite/bin/vite.js build
```

### 전체 게임의 공통 저장 경로

`check-game-save-audit.mjs`는 실제 앱과 실제 공통 훅/API 코드를 실행한다. 인증·Supabase 응답만 상태가 보존되는 로컬 모의 응답으로 대체한다. 각 페이지의 실제 작업 브리지를 읽는 테스트 서버 전용 탐침을 사용하며 운영 번들에는 탐침이 없다.

60/60종에서 단어/문장 자료를 지원하는 45종은 해당 자료를 불러오고, 전용 설정을 쓰는 15종은 유효한 전용 설정을 준비한 뒤 아래를 확인했다.

1. 준비한 items/config가 저장 API에 그대로 전달됨
2. 저장된 ID로 수업 편집 화면을 다시 열면 같은 자료가 표시됨
3. 수업 저장에 해당 게임 ID가 남음
4. 해당 슬라이드 발표 및 브라우저 새로고침 뒤 같은 자료를 읽음
5. 잡히지 않은 브라우저 오류 없음

결과: `output/game-save-audit/checks.json` (60종 + 10종 신규 설정 저장·복원).

### 확인된 10종의 실제 버튼 경로

`--native-only`는 공통 브리지 대신 각 게임의 실제 시간 선택·설정 적용·수업 저장 버튼을 사용한다. 저장된 게임이 없는 새 수업 상태에서 시작한다.

10/10종에서 신규 저장 실패 시 입력 보존 → 재시도 → 올바른 반/수업 참조 → 다시 열기, 기존 게임 수정 실패 시 원본 보존 → 재시도 → 같은 ID에 반영(중복 생성 없음)을 확인했다.

결과: `output/game-save-audit/native-checks.json`.

Sentence Splash는 별도 회귀 검사에서 문장 불러오기·현재 수정본 복사·실패/재시도·내 수업 문장 선택·발표/새로고침·Unscramble·다른 반 자료 보존·예전 샘플 재불러오기 보정을 통과했다. 상세는 `docs/sentence-splash-save-fix.md`.

기존 모험·스토리북 페이지 검사에서도 7종+3종 모두 시작/준비 화면 복귀·저장·기존 설정 수정·새로고침·수업 삽입/재생·학생 편집 UI 숨김을 통과했다. 몬스터 먹이 주기는 카드 끌어서 먹이 주기도 확인했다. 결과는 `output/adventure/integration-results.json`, `output/storybook/integration-results.json`에 있다. 바뀐 게임 시작 안내/메뉴에 맞춰 테스트 선택자를 보완했으며, 구현의 버튼 이름이나 게임 규칙을 이 검사 때문에 변경하지 않았다.

타입 검사·수정 코드 lint·프로덕션 빌드 통과. 빌드 기록: `output/game-save-audit/build.log`.

## 한계와 반영 상태

- 이 점검은 보고된 문제와 연관된 자료 준비·저장·수업 연결·발표 복원에 집중했다. 60종의 모든 게임 규칙, 모든 정답 조합, 실시간 다중 접속, 실제 교실 하드웨어까지 전수 검증했다는 뜻은 아니다.
- 서버 응답은 로컬 모의 DB다. 실제 운영 반/수업에는 시험 자료를 저장하지 않았다.
- 점검 당시 코드는 로컬 작업 트리에만 있었다. 이후 2026-10-25 사용자 요청으로 Sentence Splash 수정·파닉스 화면 개선과 함께 커밋·푸시하고 자동 배포한다. 배포 결과는 해당 커밋의 Vercel 상태로 확인한다.
- 이전에 저장되지 않은 내용은 서버에서 복구할 수 없다. 배포 후 해당 자료를 다시 적용하고 수업을 저장해야 한다.
