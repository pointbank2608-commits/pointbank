# 게임 준비: 단어 입력과 문장 입력 분리 (2026-10-28)

게임 준비 창(`GameSetupGuide`)에서 **"단어로 만들기"는 단어 입력만, "문장으로 만들기"는 문장 입력만** 받는다. 시한폭탄에서 시작 메뉴는 문장을 막아 두고 입력 화면은 문장 불러오기를 보여 주던 어긋남(`docs/bomb-sentence-import.md`)을 모든 게임으로 넓힌 규칙이다.

## 규칙

1. **불러오기**: 단어 모드는 "내 단어장 불러오기"만, 문장 모드는 "내 문장 모음 불러오기"만 보인다(`GameSourcePicker kind`). 다른 종류의 불러오기·입력 칸을 모드와 상관없이 붙이지 않는다.
2. **열 이름·안내**: 단어 모드는 `단어/뜻`, 문장 모드는 `문장/해석`을 쓴다. 한 열짜리 게임(돌림판·사다리·랜덤공)도 단어 모드는 `단어`, 문장 모드는 `문장`이고, 이름 모드만 `항목`이다. 글 입력(타자 정답)은 `정답 (단어)` / `정답 (문장)`. 붙여넣기·준비 안내 문구도 모드별이다(`guide.pasteHint_*`, `guide.hints.<family>_word|_sentence`).
3. **직접 입력 검사**: 완료를 누르면 입력한 내용이 모드와 맞는지 확인한다(`guideKindProblem`, `lib/gameGuide.ts`). 어긋난 첫 줄 번호를 알려 주고 그 칸에 포커스를 둔다.
   - 단어 모드: 다섯 단어 이상이거나, 두 단어 이상이면서 `. ! ?`로 끝나면 문장으로 본다. 한 단어 또는 짧은 표현(`ice cream`, `look at`)은 통과한다.
   - 문장 모드: 한 단어이고 끝 부호가 없으면 문장이 아니라고 본다(`Hello.`는 통과).
   - 검사하는 칸: 단어·문장 목록, 짝 맞추기류의 첫 칸, 글 입력의 정답 칸, 그룹 정렬의 단어 칸, 문장 틀의 단어 칸, 그림 퀴즈의 정답 칸.
   - **검사하지 않는 게임**: 퀴즈 계열(문제·보기), 참거짓(`참·거짓 문장`), 휴대폰 대회, 괴물 먹이 주기, 빈칸 다리·문장 탑, 명칭 다이어그램. 문제나 문장이 곧 게임 형식이라 단어/문장 구분이 없다.
4. **시한폭탄**: 단어·문장은 "읽을 내용"(`config.words`), 이름은 참가자(`items`)다.

## 코드

- `lib/gameGuide.ts`: `looksLikeSentence`, `looksLikeWordOnly`, `guideKindProblem`.
- `components/GameSetupGuide.tsx`: 열 이름, 안내 문구, 완료 시 검사.
- `i18n/guideLocales.ts`, `i18n/launchUxLocales.ts`: `answerWord`, `answerSentence`, `statementColumn`, `pasteHint_*`, `hints.*_word|_sentence`, `launchUx.kind_sentenceInWords|kind_wordInSentences`.

## 범위 밖

- 게임 화면 안의 "자세히 설정"(각 게임이 가진 기존 편집기)은 단어와 문장 불러오기를 둘 다 가진 곳이 있다. 모드가 없는 고급 편집 화면이라 건드리지 않았다.
- 메뉴의 "내 자료 불러오기"는 단어장과 문장 모음을 종류 표시와 함께 보여 주고, 게임이 못 쓰는 것은 막는다.
- 불러온 목록 안에 문장이 섞여 있어도 불러오기 자체는 막지 않는다. 완료할 때 위 검사에 걸린다.

## 검증

`node app/scripts/games/check-input-kinds.mjs` — 단어·문장 모드를 가진 61개 게임/모드 화면 전체에서 불러오기 버튼, 열 이름, 안내 문구가 모드와 맞는지 확인하고, 대표 게임에서 직접 입력 검사(문장→단어 모드 차단, 한 단어→문장 모드 차단, 정상 입력 통과, 영어 안내)를 확인한다. `check-bomb-sentences.mjs`, `check-guide-sources.mjs`(돌림판 열 이름을 `단어`/`문장`으로 갱신), `check-prelaunch-ux.mjs`, `check-guide-logic.mjs`, `check-workspace-logic.mjs`도 통과한다.
`check-ladder-guide.mjs`(저장 단계), `check-order-design.mjs`, `check-bomb-sound.mjs`, `check-turns.mjs`는 이 변경 이전 상태에서도 같은 자리에서 실패한다(안내 창 개편 이후 어긋난 조작을 기다린다).
합성 인증/API로 실행했고 운영 DB에 쓰지 않는다. 커밋·운영 배포 전 상태의 구현 기록이다.
