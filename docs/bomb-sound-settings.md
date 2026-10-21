# 시한폭탄 진행 소리 선택 (2026-10-21)

- 게임 준비 안내 및 기존 게임 설정·수정 화면에 `진행 소리` 선택을 추가했다. 선택지는 `초시계 소리`와 `음악 (PassTheBallBGM)`이다.
- 기존 게임과 새 게임은 설정이 없으면 기존 `/sounds/bomb-tick.m4a?v=2`를 재생한다. 폭발 효과음은 유지한다.
- 선택은 기존 게임 구성 JSON의 선택적 `bombSound: 'clock' | 'music'` 필드로 저장한다. DB 마이그레이션은 없다. 임시 활동의 복구 보존과 명시적 게임 저장 흐름을 그대로 사용한다.
- 사용자 제공 `C:/Users/likes/Downloads/PassTheBallBGM.wav`는 WAV 컨테이너 안에 MP3 오디오(48kHz, 스테레오, 320kbps, 약 11.54초)가 들어 있었다. `ffmpeg -i <원본> -vn -c:a copy app/public/sounds/pass-the-ball-bgm.mp3`로 재인코딩 없이 추출했다. 원본 파일은 변경하지 않았다. 배포용 에셋은 462,734바이트다.
- 게임 진행 중 반복 재생한다. 소리 변경 시 이전 오디오를 정지하고 선택한 소리로 바꾼다. 설정 창을 열면 멈추고 복귀하면 재개하며, 전체 음소거도 따른다. 차례를 넘길 때 폭발 타이머는 초기화하지 않는다.
- 저장 실패 시 이전 선택을 복구하고 기존 토스트로 안내한다. 라디오 그룹은 인스턴스마다 고유 이름을 갖고, 한글·영어를 지원한다.

주요 파일: `BombSoundPicker.tsx`, `lib/bombSound.ts`, `pages/BombPage.tsx`, `components/GameSetupGuide.tsx`, `components/TimeBomb.tsx`, `i18n/bombSoundLocales.ts`, `lib/types.ts`.

검증:

- `npm --prefix app run build`: 타입 검사 + Vite 성공.
- `npm --prefix app run lint`: 성공. 저장소 기존 경고는 유지.
- `node app/scripts/games/check-bomb-sound.mjs`: 실제 Chrome MP3 디코딩/재생/반복, 초시계 전환, 메뉴 정지/복귀, 음소거, 명시적 저장/다시 열기, 저장 실패 복원, 저장 게임 설정 변경, 항목 6개 유지, 모바일 라디오 조작, 가로 넘침 없음, 런타임 오류 없음.
- `TURN_FOCUS=1 node app/scripts/games/check-turns.mjs`: 폭탄 차례·폭발 결과·타이머 유지·타이머 맞추기·모바일 터치·큰 글자·영문·전체화면 회귀 검증 통과. PowerShell에서는 `$env:TURN_FOCUS='1'`로 지정한다.
- 화면: `output/bomb-sound-settings.png`, `output/bomb-sound-mobile.png`.

브라우저 테스트는 실제 페이지를 사용하고 인증/API만 합성 데이터로 대체했다. 실제 운영 계정 DB 저장 권한, 실물 모바일/Safari의 자동 재생 및 스피커의 실제 청감은 검증하지 않았다. 커밋·푸시·운영 배포는 하지 않았다.

로컬: `npm --prefix app run dev` → `/games/bomb` → 게임 준비에서 진행 소리 선택. 플레이 중에는 메뉴 → 게임 설정·수정에서도 바꿀 수 있다.
