# 문장 로켓 발사 준비 방식 (2026-10-28)

문장 로켓은 문장과 교사가 지정한 구 블록을 사용하는 게임이지만, `gamePreparation`의 기본 콘텐츠 전용 분류 때문에 지원 입력 목록이 비어 있었다. `guideKinds`가 이 목록을 사용해 문장 버튼도 비활성화했다.

`sentencerocket`의 지원 입력을 문장으로 지정했다. 기존 전용 편집기, 직접 문장 입력, 문장 목록 불러오기, 구 블록 경계, 완료 시 검증, 정답 판정과 샘플은 유지한다. 단어·학생 이름 방식은 활성화하지 않는다. 자동 저장·새 게임 모드를 추가하지 않는다.

검증:

- `app/scripts/games/check-sentence-rocket-setup.mjs`: Chrome + 합성 API. 문장 버튼 활성/단어·이름 비활성, 빈 입력 오류, 직접 입력→구 블록 3개 지정→완료→시작 전→중앙 시작, 기존 문장 목록 불러오기, 기존 샘플을 확인했다. 명시 저장 없이 서버 쓰기 0회, 브라우저 예외 없음.
- 결과 `output/ux-remaining/sentence-rocket-results.json`.
- 타입 검사를 포함한 `npm run build` 통과(`sentence-rocket-build.txt`, 기존 번들 크기 경고).
- 수정 소스/검사 파일 oxlint 통과.
- 지침의 `check-input-kinds.mjs` 통과: 게임/방식 62개 화면의 불러오기·열 이름·안내와 직접 입력 구분 검사. 기존 검사처럼 quizshow:word는 제외했다. 기록 `output/ux-remaining/rocket-input-kinds.txt`.

후속 사용자 요청으로 이 수정만 선별 커밋·푸시하고 운영 배포를 진행한다. 운영 자료를 변경하지 않았다.
