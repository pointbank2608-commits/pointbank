# 게임 편집기 버튼 글자 대비 (2026-11-03)

## 원인과 수정

풍선 터뜨리기 ‘단어장에서 불러오기’의 흰 글씨가 밝은 배경에 겹쳤다. `adventure/editor.css`의 `.ad-editor button`이 레이어 없는 CSS로 모든 버튼 배경을 밝게 지정해 Tailwind 유틸리티 배경을 덮어썼다. 글자색은 유틸리티의 흰색이 유지됐다. Storybook 편집기의 `.sb-editor button`에도 같은 구조가 있었다.

두 편집기의 **기본 버튼 배경만 components 레이어로 옮겼다**. 버튼 자체에 배경/글자색 쌍이 있으면 utilities가 우선하며, 자체 색상이 없는 기존 편집 버튼의 기본 배경은 유지한다. 개별 버튼마다 강제로 색을 덮거나 CSS 전체의 배치/크기 우선순위를 바꾸지 않았다.

문장 목록 불러오기·선택 버튼과 문장 은행의 선택된 칩/추가 버튼도 같은 원인으로 영향을 받아 함께 해결됐다. 문장 은행의 옅은 배경 버튼·텍스트 액션은 더 진한 파란색으로 조정했다. 게임 로직, 데이터/저장/가져오기 처리는 변경하지 않았다.

## 확인

- Chrome + 실제 게임 페이지/공통 편집기, 합성 API로 운영 쓰기 없이 검사했다.
- 수정 전 풍선 버튼의 계산된 글자/배경은 white / rgb(242,247,251), 대비 약 1.08:1이었다. 문장 기차와 Sentence Bridge에서도 같은 흰색 충돌을 재현했다.
- Adventure 7종(풍선, 낚시, 문장 기차, 문장 로켓, 문법 탐정, 보물찾기, 단어 뽑기)과 Storybook 3종(Feed the Monster, Sentence Bridge, Sentence Tower)의 **활성 버튼 363개 상태**를 검사했다. 기본·호버·목록 열림·선택 상태 및 대표 2종의 모바일 포함. 실제 계산 색상의 알파/oklab을 캔버스로 변환해 배경과 합성하고 4.5:1 이상을 확인했다. disabled 버튼은 대비 검사 대상에서 제외했다.
- 키보드 입력 후 포커스 표시도 확인했다. 예외/서버 저장 요청 없음.
- 검사: `app/scripts/games/check-editor-button-contrast.mjs`, 결과 `output/ux-remaining/button-contrast-results.json`. 앞선 기준 진단은 `button-contrast-baseline.json`.
- `npm run build`(TypeScript 포함) 통과, 기존 번들 크기 경고. `output/ux-remaining/editor-button-build.txt`.
- 수정 TSX/검사 파일 oxlint 통과. 실제 전자칠판 하드웨어·모든 게임의 모든 화면 조합을 전수 검사한 것은 아니다. 공통 컴포넌트가 두 편집기 밖에서 쓰일 때도 문장 은행의 진한 텍스트 색상은 공통 적용된다.

후속 사용자 요청으로 이 수정만 선별 커밋·푸시하고 운영 배포를 진행한다. 시작 시 존재한 수업 만들기/레시피/커리큘럼 작업 및 기타 사용자 수정은 보존했다.
