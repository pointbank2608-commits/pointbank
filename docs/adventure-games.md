# ClassBank 2차 인터랙티브 영어 게임 7종

2026-10-20 · 기존 Feed the Monster / Sentence Bridge / Sentence Tower에 추가하는 실제 React 게임입니다. 아래 화면은 샘플 데이터를 실제 플레이한 브라우저 캡처입니다.

| 게임 / 경로 | 핵심 동작 | 교사 입력 |
|---|---|---|
| Balloon Pop · `/games/balloonpop` | 움직이는 풍선, 정답 터짐·별, 오답 흔들림, 속도·시간 설정, 동의어 인정 | 단어 / 뜻, 보기 3~6개 |
| Word Train · `/games/wordtrain` | 객차 드래그, 두 번 탭 교환, 방향키 이동, 문장 확인 후 기차 출발 | 문장 목록, ` | `로 나눈 단어 블록 |
| Word Fishing · `/games/wordfishing` | 물고기 유영, 낚싯줄 하강·인양, 뜻/듣기 모드, 연속 성공 보너스 | 단어 / 뜻, 영어 음성이 없으면 뜻으로 전환 |
| Sentence Rocket · `/games/sentencerocket` | 문장 블록 배열, 누적 연료, 3·2·1 발사·행성 도착 | 원문과 교사가 확인한 단어/구 블록 경계 |
| Grammar Detective · `/games/grammardetective` | 오류 위치 선택·수정, 복수 오류, 전체 문장 입력, 해결 도장 | 틀린/바른 문장, 원문의 선택 범위, 수정 선택지, 인정 문장, 해설 |
| Treasure Hunt · `/games/treasurehunt` | 실제 지도 상대 위치 클릭, 해적 이동, 누적 탐험 경로·보물 | 장소 배치, 영어 힌트, 정답·오답의 장소+상대 위치 |
| Word Claw Machine · `/games/wordclaw` | 집게 위치 선택·하강·인양, 태그 일치 단어 모두 수집, 쉬운 직접 선택 | 단어별 태그, 미션 문장·정답 태그 |

## 교사 사용법

게임 목록에서 게임 선택 → 샘플 또는 기본 설정으로 준비 → 메뉴에서 게임 설정·수정 → 교사 설정을 편집 → **설정 적용 · 게임 다시 준비** → **새 게임으로 저장** 또는 **수업에 삽입**.

단어는 한 줄에 `apple / 사과 / noun, food` 형식으로 입력하거나 기존 단어장을 불러옵니다. 문장은 한 줄 하나로 입력하거나 문장 목록·문장 은행에서 가져옵니다. 문장 은행은 기존의 초안 표시와 교사 검수 흐름을 유지합니다. 로켓의 의미 구 경계와 문법 오류, 지도 정답, 분류 태그를 AI가 임의로 만들지 않습니다.

탐정의 오류는 원문에서 글자를 선택해 ‘선택 범위 추가’로 지정합니다. 같은 단어가 반복되어도 시작·끝 위치로 따로 저장합니다. 원문을 바꾸면 오래된 오류 범위를 비우고 다시 지정하게 합니다. 정답 수정 결과가 전체 정답 문장과 다르면 적용할 수 없습니다.

보물 지도는 장소를 선택한 뒤 배치 영역을 눌러 옮깁니다. 힌트별로 정답과 오답 지점을 직접 정합니다. 장소·클릭 지점 겹침, 없는 장소, 중복 지점은 검사합니다. 집게는 태그 일치 여부만으로 확정 판정하며 우연히 실패하지 않습니다.

최대 문제 수는 등록한 항목 수 이내에서 적용됩니다. 시간 제한은 기본적으로 꺼져 있습니다. 풍선은 시간을 켜면 속도에 따라 45/30/20초입니다. 미적용 편집이 있으면 저장·수업 삽입 버튼을 잠가 이전 내용이 저장되는 일을 방지합니다.

## 실제 화면

[7종 전체 화면 모아보기](../output/adventure/overview.png) · [로켓 발사](../output/adventure/sentencerocket-launch.png) · [마지막 보물 상자](../output/adventure/treasurehunt-chest.png)

각 게임에 `-desktop`, `-tablet`, `-mobile`, `-success` 캡처를 저장했습니다. 성공 화면은 학습 내용을 다시 읽는 단계입니다.

| 게임 | 플레이 | 성공 |
|---|---|---|
| 풍선 | [데스크톱](../output/adventure/balloonpop-desktop.png) · [모바일](../output/adventure/balloonpop-mobile.png) | [정답](../output/adventure/balloonpop-success.png) |
| 기차 | [데스크톱](../output/adventure/wordtrain-desktop.png) · [모바일](../output/adventure/wordtrain-mobile.png) | [정답](../output/adventure/wordtrain-success.png) |
| 낚시 | [데스크톱](../output/adventure/wordfishing-desktop.png) · [모바일](../output/adventure/wordfishing-mobile.png) | [정답](../output/adventure/wordfishing-success.png) |
| 로켓 | [데스크톱](../output/adventure/sentencerocket-desktop.png) · [모바일](../output/adventure/sentencerocket-mobile.png) | [정답](../output/adventure/sentencerocket-success.png) |
| 탐정 | [데스크톱](../output/adventure/grammardetective-desktop.png) · [모바일](../output/adventure/grammardetective-mobile.png) | [정답](../output/adventure/grammardetective-success.png) |
| 보물 | [데스크톱](../output/adventure/treasurehunt-desktop.png) · [모바일](../output/adventure/treasurehunt-mobile.png) | [정답](../output/adventure/treasurehunt-success.png) |
| 집게 | [데스크톱](../output/adventure/wordclaw-desktop.png) · [모바일](../output/adventure/wordclaw-mobile.png) | [정답](../output/adventure/wordclaw-success.png) |

## 통합과 주요 파일

- `app/src/lib/adventureGames.ts`: 설정 타입, 샘플, 정답·범위·공간·태그 검증, 저장 자료 변환.
- `app/src/lib/useAdventureEngine.ts`: 문제 진행, 입력 잠금, 결과·재도전, 공통 시계·효과음·탭 일시정지.
- `app/src/components/adventure/`: 플레이 화면, 포인터/키보드 문장 블록, 교사 편집기와 스타일.
- `app/src/pages/AdventureGamePage.tsx`: 기존 `useGameTemplates` 및 실제 API를 통한 저장·수정·수업 삽입.
- `app/public/skins/adventure/`: 로컬 WebP 배경·캐릭터. 원본과 프롬프트 기록은 별도 아트 기록 참조.
- `App.tsx`, `gamePages.ts`, `gameCatalog.ts`, `gameMeta.ts`, `types.ts`, `gamePreparation.ts`, `gameFromWords.ts`, `gameWorkspace.ts`, `gameGuide.ts`, `GameThemeFrame.tsx`, 한국어/영어 카탈로그 문구: 7종 등록·경로·자료 변환·준비 상태 연결.

기존 `game_templates.config` JSON에 `adventure`를 저장하므로 DB 스키마 변경이 필요하지 않습니다. 로그인·학원별 권한은 기존 API/RLS를 사용합니다. 수업 삽입은 기존 `AddActivityToLesson` 스냅샷 방식을 그대로 사용합니다. 전체 화면·공통 메뉴·음소거·교사 패널은 기존 공통 컴포넌트가 담당합니다. 플레이 도중 AI·이미지 생성 API를 호출하지 않습니다.

아트는 배경 7개와 투명 캐릭터 8개, 총 15개 로컬 WebP(약 2.5MB)입니다. 생성 원본을 보존했으며, [전체 생성·편집 프롬프트와 원본 경로](adventure-art-prompts.json)를 기록했습니다.

## 검증

- 프로덕션 빌드 및 TypeScript 검사 통과. 기존 대형 청크 경고는 남아 있습니다.
- 신규 코드 대상 Oxlint 오류·경고 없음.
- `app/scripts/games/check-adventure.mjs`: 7종 설정·JSON 왕복·동의어·반복 토큰·복수 오류·지도/태그 검증, 전 문제 완료, 오답 재도전, 결과·재시작·전체 화면, 태블릿/모바일 실제 탭, 긴 문장 실제 터치 드래그와 스크롤·가로 넘침 검사.
- `check-adventure-edge.mjs`: 탭 숨김 시 시계·CSS 애니메이션 일시정지, 시간 초과 후 같은 문제 재도전, 기차 방향키, 탐정 전체 문장 Enter 제출, 집게 키보드 조종·중복 입력 잠금, 쉬운 터치 모드, 영어 음성 불가 시 뜻 표시.
- `check-adventure-page.mjs`: 실제 훅/페이지에 모의 인증·저장 API를 연결해 7종 목록·시작·메뉴, 저장·수정·재접속, 저장 실패 후 재시도, 수업 스냅샷 생성·재실행, 학생 편집기 숨김 확인. 운영 DB에는 쓰지 않습니다.
- `check-storybook.mjs`: 기존 3종 회귀 15개 검사 통과. 정답/오답, 드래그·터치, 완료·재시작·전체 화면·긴 문장·시간 제한 포함.

실행 기록: `output/adventure/test-results.json`, `edge-results.json`, `integration-results.json`, 기존 3종은 `output/storybook/test-results.json`.

## 남은 확인 범위

운영 계정의 실제 DB 권한·수업 발표 기기·배포 서버는 별도 확인이 필요합니다. 자동 검사는 Chrome 데스크톱과 태블릿/모바일 터치 에뮬레이션이며 실제 iPad Safari/안드로이드 실기기 검사는 하지 않았습니다. 영어 듣기는 기기의 Web Speech 영어 음성에 의존하며 사용할 수 없으면 안내와 한국어 뜻으로 전환합니다. 기존 다른 작업의 수정 파일은 보존했습니다.
