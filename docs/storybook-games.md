# ClassBank 영어 인터랙티브 게임 3종

## 구현

| 게임 / 경로 | 학습과 조작 | 장면과 반응 |
|---|---|---|
| Feed the Monster `/games/feedmonster` | 한국어 뜻 ↔ 영어 단어, 교사가 직접 쓴 요청 문장 ↔ 정답 단어. 마우스·터치 드래그 또는 카드 선택 후 입 터치 | 일러스트 몬스터, 입 벌리기, 카드 먹기, 씹기, 눈웃음·하트, 오답 흔들기 |
| Sentence Bridge `/games/sentencebridge` | 빈칸 문장과 교사가 지정한 정답·오답. 5~10문제 중 설정한 개수로 발판 구성 | 동화 속 강, 탐험가, 물고기, 징검다리 활성화와 점프. 오답 시 제자리를 유지하고 재도전 |
| Sentence Tower `/games/sentencetower` | 시작 문장과 단계별 전체 정답 문장, 추가 표현, 글자 경계 삽입 위치. 클릭 또는 빈자리로 드래그 | 표현이 들어갈 위치와 목표 문장을 함께 표시. 추가한 표현 강조, 블록 낙하, 단계별 탑, 완성 지붕·깃발 |

공통: 별도의 게임 시작, 라운드·진행 표시, 효과음, 힌트, 문제별 시간 제한(끄기/30/60/90초), 결과·재시작, 준비 화면 복귀, 전체 화면 진입·종료, 브라우저 전체 화면 미지원 시 화면 채우기, 반응형 카드와 읽기 영역, 줄어든 움직임 설정 지원. 중복 정답 제출은 동기 잠금으로 막고, 게임 전환 시 예약된 콜백을 정리한다. 수업 공통 시계의 일시정지를 그대로 사용한다.

플레이 중 AI나 이미지 생성 API를 호출하지 않는다. 그래픽은 프로젝트에 저장된 동화 일러스트(WebP)와 SVG·CSS이며, 효과음은 기존 ClassBank 효과음을 사용한다.

## 교사 입력

1. 게임 목록에서 게임을 선택하고 **게임 설정·수정**을 연다.
2. 학습 콘텐츠를 편집한다.
   - **몬스터 / Vocabulary Match**: 기존 단어장을 가져오거나 한국어 뜻·정답 단어·오답을 직접 입력한다. 요청 문장과 관사를 자동 생성하지 않는다.
   - **몬스터 / Sentence Match**: 요청 문장, 정답, 오답 2~4개를 직접 입력한다.
   - **다리**: 빈칸 `___`을 하나 포함한 문장, 정답, 오답, 선택적 힌트를 입력한다. 저장 문장이나 문장 은행의 원문에서 일부를 선택해 빈칸으로 바꿀 수도 있다. 오답은 교사가 수정하고, 여러 정답이 가능한 문맥인지 직접 확인한다. 위·아래 버튼으로 문제를 정렬한다.
   - **탑**: 시작 문장과 각 단계의 전체 정답 문장·추가 표현·삽입 위치를 입력한다. 위치 메뉴의 `│`는 이전 문장의 글자 경계다. 문장 맨 앞·중간·끝 모두 지원하며, 삽입 미리보기와 전체 정답 문장이 일치하지 않으면 적용할 수 없다. 기존 문장 목록의 첫 문장을 시작 문장으로 가져올 수 있다.
3. **설정 적용 · 미리보기**를 누른다. 입력 오류가 있으면 이유를 표시한다. 미적용 수정이 남아 있으면 페이지의 저장·수업 삽입 버튼을 잠근다.
4. **새 게임으로 저장**을 누른다. 제목을 비우면 게임 이름·한국 날짜로 자동 생성된다. 저장한 게임 선택, 제목 변경, 콘텐츠 재편집을 지원한다.
5. **수업에 삽입**으로 기존 수업에 추가하거나 새 수업을 만든다. 기존 공통 기능이 게임 설정을 복사한 수업용 스냅샷을 저장하므로 원본 게임을 나중에 편집해도 수업은 유지된다.

저장된 게임에서 설정을 적용하면 해당 게임의 설정을 갱신한다. 원본 단어장·문장 목록은 수정하지 않는다. 문장 탑은 단계 순서가 문장 의존성을 가지므로 순서 섞기를 제공하지 않는다.

## 통합과 저장 구조

- 실제 기존 `useGameTemplates`, `createGameTemplate`, `updateGameTemplate`, `renameGameTemplate`, `AddActivityToLesson`을 사용한다.
- 기존 인증, 학원·반 범위, 임시 활동 복구, Supabase RLS를 유지한다.
- 기존 `game_templates.game_type`은 `text`, `config`는 JSONB이므로 SQL 스키마나 저장 데이터를 변경할 필요가 없다.
- 새 식별자: `feedmonster`, `sentencebridge`, `sentencetower`.
- 새 콘텐츠는 `GameTemplateConfig.storybook`에 저장된다. 몬스터/다리는 `questions`, 탑은 `start`와 `steps`를 사용한다. 각 설정에는 시간·힌트·효과음 등 공통 옵션이 포함된다.
- 교사·학생 라우트, 게임 카탈로그, 수업용 `GAME_PAGES` 매핑, 게임 준비 검증, 게임 메타 정보, 한국어·영어 목록 설명과 커버 SVG를 등록했다.
- 단어 → 몬스터 변환은 실제 저장된 뜻과 단어만 사용한다. 원문만으로 다리의 정답이나 탑의 삽입 위치를 임의 추론하지 않는다.
- 공통 준비 화면의 자동 이름 생성 함수와 입력 상태 이름이 충돌하는 부분은 import 별칭으로 보완했다.

## 주요 파일

새 구현:

- `app/src/lib/storybook.ts`: 데이터 타입, 샘플, 기존 단어 변환, 문장 삽입·입력 검증
- `app/src/lib/useStoryRound.ts`: 공통 라운드·타이머·잠금·정오답·결과 로직
- `app/src/components/storybook/StoryArt.tsx`: 동화 배경·캐릭터 일러스트와 음식 카드 SVG
- `app/src/components/storybook/storybook-art.css`: 일러스트 레이어·표정·그림자 스타일
- `app/public/skins/storybook/`: 배경 3종, 몬스터 표정 3종, 탐험가 WebP
- `app/src/components/storybook/StoryGame.tsx`: 학생 조작·장면·상태별 피드백
- `app/src/components/storybook/StoryEditor.tsx`: 교사 입력과 가져오기·검증
- `app/src/components/storybook/storybook.css`: 반응형 장면·애니메이션
- `app/src/pages/StorybookGamePage.tsx`: 기존 저장·준비·수업 연결
- `app/public/covers/game-{feedmonster,sentencebridge,sentencetower}-v2.svg`: 게임 목록 커버
- `app/scripts/games/{check-storybook,check-storybook-page}.mjs`: 플레이·통합 검증
- `app/scripts/games/check-story-touch.mjs`: 실제 터치 드래그·전체 화면 대체 동작 검증
- `app/scripts/games/capture-storybook.mjs`: 데스크톱·태블릿·모바일 최종 화면 캡처
- `app/scripts/games/storybook{,-page}.{html,tsx}`: 배포 진입점과 분리된 합성 테스트 화면

등록·연결 수정:

`App.tsx`, `lib/types.ts`, `lib/gameCatalog.ts`, `lib/gameMeta.ts`, `lib/gamePages.ts`, `lib/gamePreparation.ts`, `lib/gameFromWords.ts`, `components/GameThemeFrame.tsx`, `components/GameWorkspace.tsx`, `i18n/locales/{ko,en}.ts`.

같은 저장소에서 별도로 변경 중인 텔레파시 게임·공통 작업 화면 변경은 보존했다. 위 목록은 이번 게임 3종과 관련된 변경만 설명한다.

배경·캐릭터 품질 개선 내역과 제작 프롬프트는 [아트 v2 문서](storybook-art-v2.md)에 정리했다.

## 실제 화면

| 게임 | 데스크톱 | 태블릿 | 모바일 |
|---|---|---|---|
| 몬스터 | [화면](../output/storybook/feedmonster-desktop.png) | [화면](../output/storybook/feedmonster-tablet.png) | [화면](../output/storybook/feedmonster-mobile.png) |
| 다리 | [화면](../output/storybook/sentencebridge-desktop.png) | [화면](../output/storybook/sentencebridge-tablet.png) | [화면](../output/storybook/sentencebridge-mobile.png) |
| 탑 | [화면](../output/storybook/sentencetower-desktop.png) | [화면](../output/storybook/sentencetower-tablet.png) | [화면](../output/storybook/sentencetower-mobile.png) |

[문장 중간 삽입 화면](../output/storybook/sentencetower-insertion.png). 추가로 `*-long-mobile.png`에 긴 문장 검수 화면을 보관한다. 캡처는 실제 게임 컴포넌트를 로컬 합성 테스트 화면에서 플레이한 결과다.

## 실행·검증

앱 실행: `cd app` → `npm run dev` → 로그인 후 게임 목록에서 선택.

빌드: `npm run build`. 정적 검사: `npm run lint`.

브라우저 테스트는 Node 22 이상과 Chrome, 저장소의 기존 Playwright 테스트 도구를 사용한다.

```
node scripts/games/check-storybook.mjs
node scripts/games/check-storybook-page.mjs
node scripts/games/check-story-touch.mjs
node scripts/games/capture-storybook.mjs
```

- 독립 플레이: 정답·오답·재도전, 실제 마우스 드래그, 터치 선택, 중복 제출 잠금, 전체 라운드 완료, 재시작 초기화, 전체 화면 진입·종료, 준비 화면 복귀, 문제별 시간 제한, 긴 문장, 모바일 가로 넘침을 검사한다.
- 교사·수업 통합: 실제 페이지·공통 훅·준비 화면을 실행하면서 인증과 API 응답만 합성한다. 게임 목록 등록, 이름 없이 저장, 저장된 게임 재편집·새로고침 후 실행, 수업용 스냅샷 저장·재실행, 학생 편집기 미노출을 검사한다.
- 결과 JSON과 스크린샷: `output/storybook/`.

2026-10-20 최종 검증: 독립 플레이 **15항목**, 저장·수업 통합 **12항목**, 별도 터치 드래그·전체 화면 대체 동작 **2항목** 통과. 통합 검사는 저장 실패 때 수정 내용과 원본 설정을 유지하고 다시 저장할 수 있는지도 확인했다. 기존 `check-workspace-logic.mjs`의 자료 변환·원본 보존·공통 시계 일시정지 검사도 통과했다. 새 게임 구현 파일의 oxlint 검사는 경고·오류가 없다. 전체 TypeScript·Vite 빌드가 성공했다.

스크린샷은 데스크톱 1280×1000, 태블릿 820×1180, 모바일 390×844 뷰포트에서 검토했다. 모바일 카드를 2열로 보완했고, 카드 드래그가 페이지 스크롤에 취소되지 않도록 터치 동작의 CSS 우선순위를 수정했다. 확대된 공통 게임 프레임에서도 드래그 카드가 손가락·마우스 좌표를 따르도록 별도 레이어로 렌더링한다. [완성된 성 검수 화면](../output/storybook/sentencetower-completed.png)은 결과 창을 잠시 숨기고 실제 완성 장면을 캡처한 것이다.

## 확인 범위와 남은 작업

- 라이브 Supabase 계정에 게임을 만들거나 운영 수업 데이터를 변경하는 검사는 하지 않았다. 저장·편집·수업 재실행은 합성 API를 사용한 통합 테스트로 확인했다. 실제 운영 인증·RLS·네트워크에 대한 최종 확인은 로그인한 환경에서 필요하다.
- 터치 검증은 Chrome의 태블릿·모바일 에뮬레이션이다. 실제 iPad Safari·전자칠판 기기의 최종 조작·오디오 검수는 별도다.
- 기존 전역 lint 경고와 대형 번들 경고는 저장소 전체의 기존 상태를 포함한다. 새 게임 파일의 정적 검사와 전체 빌드 결과는 최종 실행 기록을 따른다.
- 정답 판정에 필요한 콘텐츠가 준비되지 않은 게임은 교사가 편집해야 한다. 자연어 문장의 모든 가능한 정답을 자동 판단하는 기능은 제공하지 않는다.
