# 출시 전 게임·수업 UX 정리 (2026-10-27)

## 확인한 원인과 변경

- GameSetupGuide에 참여자/팀/검토 단계가 섞여 있었다. 일반 준비는 방식 선택 → 항목 입력의 두 단계로 줄였다. 네 카드(샘플/단어/문장/이름)의 위치는 고정하고 기존 guideKinds의 실제 지원 범위만 활성화한다. 비활성 카드에는 이유와 disabled/aria-disabled를 제공한다. 숫자 채우기·사다리 결과·그림 위치 등 필수 전용 입력은 유지한다. 보물찾기 전용 편집은 변경하지 않는다.
- 샘플은 안내창을 닫고 시작 전 화면으로 간다. 완료는 임시 적용이며 새 영구 저장/자동 시작을 하지 않는다. 직접 입력, 독립적인 붙여넣기, 원본을 수정하지 않는 자료/명단 불러오기를 유지한다. 오류에는 항목 번호나 현재/필요 개수를 표시한다.
- 게임 프레임의 시작 버튼과 내부 시작 단추가 중복돼 있었다. 필요한 내부 시작 게이트를 명시적 data-initial-game-start로 연결하고 중앙 시작으로 한 번만 실행한다. 기존 모험/스토리 게임의 running 연결은 그대로 사용한다. 시작 전/설정 중에는 기존 gameClock과 inert로 진행·입력을 막는다. 재개는 진행을 이어간다.
- 내용 수정은 현재 항목으로 두 번째 단계를 바로 연다. 이름·숫자 입력 모드를 선택 설정이나 점수 참가자와 혼동하지 않도록 setupKind를 선택적 JSON 메타데이터로 남긴다. 바뀐 내용을 적용하면 다시 준비된다는 안내를 적용 전에 표시한다.
- 저장 게임을 안내창에서 고치면 editingTemplateId를 가진 임시 사본을 편집한다. 완료는 기존 레코드를 건드리지 않고 게임 저장이 같은 ID/반 범위를 갱신한다. 기존 상세 편집기의 개별 필드 저장 정책은 변경하지 않았다. 선택적 단어장/문장 저장은 게임 저장과 별도 선택으로 유지했다. 중복된 내 활동 저장 입구는 제거했다.
- 더보기는 카드 안 absolute 메뉴라 overflow-hidden에 잘릴 수 있었다. 팝오버 top layer와 위치 보정, 바깥 클릭/Escape/방향키/Home/End/Tab을 제공한다. API가 없는 기기는 dialog/body 포털로 표시한다. 기존 메뉴 동작은 유지한다.
- 내 수업 고치기는 폼만 위에 생성하고 스크롤은 남겨 두었다. 폼으로 이동해 입력에 초점을 주고, 저장/취소 후 기존 목록의 스크롤·트리거 초점을 복원한다. 반/검색/정렬 상태는 같은 컴포넌트에 유지한다.
- 풍선·낚시 단어 span의 max-height:95%/overflow:auto가 내부 스크롤을 만들었다. 글자에 따라 버튼 높이가 늘고 줄바꿈하도록 수정했다. 단순 잘라 숨기기를 사용하지 않았다.
- 문법 탐정은 틀린 문장/올바른 문장이 기본 입력이다. 연속된 동일 토큰 수의 변경만 오류 구간으로 제안하며, 교사가 정답/선택지를 확인·수정하고 적용한다. 삽입/삭제/떨어진 여러 변경은 임의 확정하지 않는다. 수동 구절 선택과 기존 범위/선택지/허용 문장/대소문자·문장부호 판정은 보존한다. 내부 문자 인덱스는 표시하지 않는다.
- 일반 게임과 파닉스 게임은 전체화면/전체화면 종료 명칭을 사용한다. 파닉스도 Fullscreen API, fullscreenchange/Escape, 지원하지 않는 기기의 화면 채우기를 연결했다.

## 수업 메뉴와 저장 구조

수업 → 내 수업 / 내 게임 / 전자칠판 / 파닉스(Ready Class). 기존 주소를 바꾸지 않고 Ready Class는 /phonics?tab=course를 다시 사용한다.

내 게임(/my-games)은 기존 game_templates를 academy 필터 및 기존 RLS로 페이지별 조회한다. 검색/학원 공용·반 필터/실행/수정/기존 AddActivityToLesson 연결을 제공한다. 테이블·공유 범위·기존 ID를 옮기거나 복제하지 않았다. 새로운 수업용 스냅샷은 lessonSnapshot으로 구분해 내 게임에서 제외한다. 명시적인 게임 저장은 이 내부 표시를 제거한다. **과거 레코드는 명시 저장과 내부 생성의 구분 정보가 없을 수 있으므로 추측해서 숨기지 않고 유지한다.**

SQL 변경은 없다. 새로운 콘텐츠·숙제 기능·플레이 기록 자동 저장·자동 저장 정책은 추가하지 않았다. 파닉스 수업의 문장 검토 상태와 콘텐츠 공개 정책도 변경하지 않았다.

## 검증

모두 로컬 합성 계정/API 또는 네트워크 차단/대체 환경으로 검증했다. 운영 수업/게임/단어장을 테스트 목적으로 수정하지 않았다.

- check-prelaunch-ux.mjs: 일반 게임 59종 네 카드 활성 상태, 샘플 → 시작 전, 서버 저장 없음, 중앙 버튼 한 번 시작. 직접 입력/이전 복원/자료 가져오기/오류 유지/내용 바로 수정/내 게임 재사용/같은 ID 명시 저장/일반 전체화면·Escape/390px.
- check-settings-all.mjs: 59/59 설정 저장·같은 ID 갱신·미적용 수정 보호·모바일 저장 푸터.
- check-guide-sources.mjs: 단어/문장/학생 선택, 원본 불변, 다른 학원 제외, 빠른 반 전환, 빈 명단, 로딩 실패·재시도, 모바일.
- check-prelaunch-extras.mjs: 메뉴 클리핑 탈출/키보드/바깥 클릭, 보수적인 문법 제안/기존 복수 범위 보존, 수업 편집 초점과 목록 위치 복원.
- check-prelaunch-layout.mjs: 풍선/낚시 PC·390px, 짧은/긴 단어, 글자 150%, 키보드, 전체화면 (8가지 조합).
- check-prelaunch-lesson-add.mjs: 홈 최근 자료 및 내 게임 → 합성 수업 추가, 블록 1→2, 4단어 스냅샷·범위 유지, 합성 저장소 재조회/새로고침, 중복 클릭 1회 추가, 실패 안내. 보고된 미반영은 이 조건에서 재현되지 않았다. 성공 안내와 재진입 방지/유효 대상 확인을 보강하고 실제 append API는 변경하지 않았다.
- check-guide-logic.mjs/check-adventure.mjs: 기존 문제 형식·정답 판정·허용 변형·토큰/범위 보존, 보물찾기 포함 모험 7종 플레이/재시도/결과/전체화면 및 모바일·태블릿.
- check-contest-setup.mjs: 대회 전용 준비/저장/기존 대회 호환, 37단어 131문제, 12문장, 대량 324문제.
- phonics/check-games.mjs --edges-only: 7,000개 데이터 조합, 일반 Fullscreen/Escape/미지원 fallback, 정답 재시도·일시정지·Q/X·음성 실패·깨진 그림·영문·모바일. 파닉스 40종 전체의 UI 전수 플레이를 했다는 뜻은 아니다.
- npm run build(TypeScript 포함), npm run lint: 실행. 기존 린트 경고는 별도 로그에 남는다.

사다리 상세 결과 입력/랜덤 배치/복구/저장·전체화면, 게임 저장 실패 시 창 유지·재시도·동일 ID 갱신 검사도 통과했다. 팝오버 API 미지원 포털 동작까지 확인했다.

## 검토 화면과 파일

- /games/wheel, /games/quiz, /games/bomb: 두 단계 준비와 명시 실행·저장.
- /my-games: 저장 게임. /curriculum: 편집 진입과 더보기.
- /games/grammardetective: 두 문장 입력·제안·수동 수정.
- /games/balloonpop, /games/wordfishing: 긴 단어 표시.
- /phonics-games/sound-fishing: 전체화면.

주요 파일: GameSetupGuide.tsx, GameWorkspace.tsx, GameThemeFrame.tsx, useGameTemplates.ts, MyGamesPage.tsx, api.ts, navGroups.ts/StaffNav.tsx, MoreMenu.tsx, CurriculumPage.tsx, AddActivityToLesson.tsx, DetectiveCaseEditor.tsx/detectiveSuggestion.ts, adventure.css, PhonicsGamesPage.tsx, launchUxLocales.ts.

캡처: output/prelaunch-guide-{desktop,mobile}.png, prelaunch-my-games-desktop.png, prelaunch-grammar-desktop.png, prelaunch-lesson-edit-desktop.png, prelaunch-menu-mobile.png, prelaunch-{balloonpop,wordfishing}-large-mobile.png.

## 한계·공개

- 제보한 수업 추가 문제의 운영 계정/운영 네트워크 조건은 아직 재현하지 않았다. 합성 테스트 성공을 운영 DB 실측으로 표현하지 않는다.
- 과거 자동 생성 게임과 명시 저장 게임의 식별 한계는 위 저장 구조 절에 기재했다. 기존 자료를 보존하는 쪽을 택했다.
- 보류 범위(보물찾기 전용 개편, 기타 활동지 분류, 문법 활동지 진입, 새 게임/콘텐츠, 자동 실행 기록)는 그대로 보류다.
- 사용자의 후속 지시로 검증 완료 후 관련 변경만 선별 커밋·푸시하고 main 운영 자동 배포를 진행한다.
