# 인터랙티브 영어 게임 효과음

2026-10-22. 기존 10종에 연결되어 있던 공통 정답·오답 MP3 외에, 각 게임의 실제 동작을 구분할 수 있는 오리지널 효과음 25개를 추가했다. Sentence Splash 및 다른 게임의 소리 설정은 변경하지 않았다.

| 게임 | 효과음 |
|---|---|
| Feed the Monster | 카드 선택, 몬스터 냠냠, 다음 먹이, 완료 |
| Sentence Bridge | 점프와 작은 물소리, 오답 재도전, 도착 |
| Sentence Tower | 블록 선택·쌓기, 층 완성, 성 완성 |
| Balloon Pop | 풍선 터짐과 반짝임, 정답·오답, 완료 |
| Word Train | 객차 선택·연결·섞기, 기적·바퀴 출발, 다음 역 |
| Word Fishing | 낚싯줄 던지기, 물소리·인양, 실패·완료 |
| Sentence Rocket | 블록 연결·연료 충전, 3·2·1, 엔진 발사, 도착 |
| Grammar Detective | 단서 선택, 수정 블록, 사건 해결 도장 |
| Treasure Hunt | 이동 발걸음, 마지막 보물 상자·동전, 완료 |
| Word Claw Machine | 집게 이동·하강·인양·획득, 실패·완료 |

시작·선택·연결·오답·다음 문제·시간 종료·완료 소리는 게임 간 일관되게 사용한다. 낚시·집게는 하강 소리 뒤에 인양/실패 소리가 이어지고, 로켓 발사는 실제 카운트다운 시간에 맞춘다. 설명 음성이나 학습 문장 읽기는 기존 기능을 유지한다.

## 파일과 구현

- `app/scripts/sfx/build-minigame-sfx.py`: 표준 Python의 사인파·배음·필터 노이즈로 합성하는 재현 가능한 생성기. 외부 녹음이나 샘플·AI API를 사용하지 않는다.
- `app/public/sounds/minigames/`: 32kHz, 모노, 16bit PCM WAV 25개(합계 약 1.37MB)와 길이·음량·SHA-256 매니페스트.
- `app/src/lib/miniGameSfx.ts`: 게임별 소리 배정, 프리로드·캐시, 첫 실제 클릭/터치/키 입력에서 Web Audio 활성화, 게임별 오디오 수명 관리.
- `useStoryRound.ts`, `useAdventureEngine.ts`, `StoryGame.tsx`, `AdventureGame.tsx`, `ArrangePieces.tsx`: 실제 동작 시점의 재생 연결.

기존 전역 음소거와 교사 설정의 ‘효과음’을 모두 따른다. 어느 하나가 꺼져 있으면 소리를 내지 않는다. 일시정지·설정 열기·탭 숨김·게임 변경 시 재생 중인 소리와 지연 예약을 취소한다. 재개할 때 취소했던 소리를 다시 재생하지 않는다. 게임별 동시 효과음은 최대 4개로 제한한다. 게임 진행·채점은 오디오 로딩이나 재생 성공에 의존하지 않는다.

재생성: `python app/scripts/sfx/build-minigame-sfx.py`.

## 검증과 미리 듣기

- `app/scripts/games/check-minigame-sound.mjs`: 10종의 실제 게임 입력과 디코딩된 오디오 재생, 터치 활성화, 교사 설정 OFF, 전역 음소거/해제, 일시정지·지연 효과음 취소, 탭 숨김·게임 해제, 실제 로켓 카운트다운·발사 및 최종 보물·완료를 검사한다.
- 25개 WAV 전체를 Chrome의 실제 `decodeAudioData`로 디코딩해 길이·채널 수·유효 신호·클리핑 부재를 확인한다. 결과는 `output/minigame-sound/results.json`.
- TypeScript·프로덕션 빌드와 변경 코드 Oxlint 검사 통과.
- 기존 3종 및 신규 7종의 정답·오답·완료·재시작·전체 화면·터치 회귀 검사도 수행한다.
- [효과음별 플레이어](../output/minigame-sound/preview.html), [약 19초 모음](../output/minigame-sound/effects-preview.wav), [모음 재생 순서](../output/minigame-sound/preview-timeline.json).

브라우저 검사는 Chrome 데스크톱과 모바일 터치 에뮬레이션이다. 실제 iOS/Android 기기의 스피커 청취는 별도 확인 범위다. 구현·검증 후 사용자의 후속 요청에 따라 효과음 변경만 선별해 main에 커밋·푸시하고 Vercel 운영 배포를 진행한다.
