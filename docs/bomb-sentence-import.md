# 시한폭탄 연습 문장 불러오기 (2026-10-26)

- 게임 준비의 `연습할 단어·문장` 영역에 `BombPracticeInput`을 추가했다. `GameSourcePicker kind="sentence"`로 내 문장 모음만 불러오며, 불러온 영어 문장은 기존 입력 뒤에 추가한다. 동일한 문장을 재가져와도 중복 추가하지 않고 참가자 행은 바꾸지 않는다. 직접 입력 버튼은 연습 입력 칸에 포커스를 둔다.
- 연습 초안은 기존 `useRecoverableField`를 그대로 사용해 계정·학원별로 분리된다. 다음 단계에서 기존 방식대로 config.words에 적용되며, 원본 문장 모음·수업·반 데이터는 변경하지 않는다.
- 기존 상세 편집기에는 공통 `SentenceSources`(문장 목록 + 문장 은행)를 추가했다. BombPage의 목록 종류는 all로 읽고, 단어장 버튼은 word만/문장 버튼은 sentence만 보여준다.
- 참가자·차례·시한폭탄 소리·시간·게임 규칙은 변경하지 않는다.

검증: `node app/scripts/games/check-bomb-sentences.mjs`.
실제 페이지와 게임을 합성 인증/API로 실행해 기존 입력·참가자 유지, 원본 미변경, 타 학원/단어장 제외, 중복 방지, 임시 실행, 상세 설정 가져오기, 오류/재시도, 초안 복구, 빈 상태, 모바일, 영어를 확인했다. 운영 DB에 쓰지 않는다. 빌드(타입 검사 포함)·린트 통과.

코드: BombPracticeInput.tsx, GameSetupGuide.tsx의 시한폭탄 연습 입력 한 곳, BombPage.tsx, sourceLocales.ts.
GameSetupGuide/Workspace/CreateButton 등에 남아 있는 숫자 준비 흐름 변경은 다른 진행 작업이므로 이 작업의 커밋에 함께 포함하지 않는다.
커밋·운영 배포 전 상태의 구현 기록이다.
