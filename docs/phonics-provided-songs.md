# 파닉스 기본 제공 노래·챈트 34편

2026-10-29 사용자 요청으로 공식 업로드를 검색·선별하고 운영 SQL Editor에서 등록했습니다. 단계별 등록 결과는 5/6/5/9/9편이며 운영 목록에서도 표시를 확인했습니다. 기존 자료는 덮어쓰거나 삭제하지 않았습니다.

출처는 Super Simple ABCs, Jack Hartmann Kids Music Channel, English4abc의 공식 YouTube 업로드입니다. 공식 oEmbed의 채널/제목과 공개 플레이어 메타데이터의 영상 길이·임베드 허용 여부를 대조했습니다. 모든 영상 전체를 시청·청취했다는 의미는 아닙니다. 영상·음원 파일과 전체 가사는 저장하지 않고 원본 링크만 제공합니다.

수업 연결은 기존 teachingPlan.json의 실제 course ID를 참조합니다. 유닛의 모든 단어가 영상에 나온다고 가정하지 않습니다. 일부 규칙만 다루는 자료 및 선행·확장 규칙을 섞은 영상은 활용 팁에 명시했습니다. 예: L 자음군 영상의 sl은 확장이며 fl/pl을 대신 가르치는 자료가 아닙니다. 모음 oo의 두 소리와 ow의 두 소리는 별도로 구분합니다.

4단계 Unit 5(st/sk)의 전용 노래는 이번 목록에 없으며, 관련 없는 노래로 연결을 채우지 않았습니다.

## 반영 상태

- **운영 반영:** 기본 제공 34편과 단계·유닛 연결·원본 길이. SQL 결과와 실제 목록 확인.
- **화면 코드:** 카드의 용도 배지·활용 팁·원본 정보, 긴 유닛 연결 표기의 축약, 관리자 수정 시 큐레이션 메타데이터 보존. 검증 후 사용자가 커밋·푸시·배포를 요청했습니다.
- **실제 재생 점검:** 운영 Super Simple 알파벳 영상의 재생 진행을 관찰했습니다. 이때 초기 seek가 자동 재생을 유발하는 문제를 발견해 자동 재생 방지를 보완했습니다. 사용자 재생 요청이 있기 전에는 플레이어의 재생 이벤트도 중지하도록 수정했습니다.
- **수정 후 실제 API 재검증:** 같은 공식 영상을 로컬 수정본에서 열었을 때 초기 재생 상태 0, 사용자 재생 후 위치 7.3초 진행, 브라우저 오류 0개를 확인했습니다(`output/media-v2/curated-real-playback.json`). API 준비 전 현재 시간 호출도 방어했습니다.
- **검증:** check-provided-songs.mjs(34편 중복/규칙/유닛·SQL 반복 실행·기존 수정 보존), check-curated-browser.mjs(34개 팁·배지/검색/단계/모바일), 기존 check-v2.mjs 회귀 검사, TypeScript·Vite 빌드.

## 편성표

| 단계 | 제목/원본 | 용도 | 길이 | 수업 유닛 | 활용 팁 |
|---|---|---|---|---|---|
| 1 | [ABC 글자 이름 따라 부르기](https://www.youtube.com/watch?v=9o3RmdiLnI8) | 수업 시작용 | 1:33 | 1, 2, 3, 4, 5, 6, 7, 8, 9 | 수업 시작에 알파벳표를 짚으며 불러요. 글자 이름과 실제 소리는 따로 확인해 주세요. |
| 1 | [알파벳 소리 A–Z 따라 부르기](https://www.youtube.com/watch?v=Wvns1A5hmOs) | 수업 시작용 | 1:23 | 1, 2, 3, 4, 5, 6, 7, 8, 9 | 오늘 배울 글자가 나오면 손을 들어요. 노래가 끝나면 해당 글자의 소리를 다시 말해요. |
| 1 | [A–I 소리 복습 챈트](https://www.youtube.com/watch?v=SRycDOK-_eE) | 마무리 복습용 | 1:27 | 3 | Aa–Ii를 배운 뒤 사용해요. 오늘 유닛에 없는 글자는 복습 범위로 구분해 주세요. |
| 1 | [J–R 소리 복습 챈트](https://www.youtube.com/watch?v=ZKMUaPCF5L0) | 마무리 복습용 | 1:27 | 6 | Jj–Rr를 배운 뒤 소리를 따라 말해요. 교재와 다른 예시 단어는 뜻을 짧게 확인해 주세요. |
| 1 | [R–Z 소리 복습 챈트](https://www.youtube.com/watch?v=zqAKir8FJL0) | 마무리 복습용 | 1:27 | 9 | Rr–Zz를 배운 뒤 사용해요. Rr는 이전 학습 복습으로 연결해 주세요. |
| 2 | [단모음 a·e·i·o·u 소리 준비](https://www.youtube.com/watch?v=-EbzKgs6Aiw) | 수업 시작용 | 3:04 | 1, 2, 3, 4, 5, 6, 7, 8 | 모음 소리를 따라 말한 뒤 오늘 배울 모음 하나를 찾아요. CVC 단어 읽기는 별도로 이어 가요. |
| 2 | [단모음 a · 세 소리 합쳐 읽기](https://www.youtube.com/watch?v=oDVAhDyHZaA) | 규칙 연습용 | 2:19 | 1, 2 | 각 소리를 손가락으로 짚고 합쳐 읽어요. 영상 뒤에는 우리 유닛 단어 3개로 다시 연습해요. |
| 2 | [단모음 e · 세 소리 합쳐 읽기](https://www.youtube.com/watch?v=_lM8cVG_xoQ) | 규칙 연습용 | 2:19 | 3 | 각 소리를 손가락으로 짚고 합쳐 읽어요. 영상 뒤에는 우리 유닛 단어 3개로 다시 연습해요. |
| 2 | [단모음 i · 세 소리 합쳐 읽기](https://www.youtube.com/watch?v=13clYehVJHo) | 규칙 연습용 | 2:19 | 4, 5 | 각 소리를 손가락으로 짚고 합쳐 읽어요. 영상 뒤에는 우리 유닛 단어 3개로 다시 연습해요. |
| 2 | [단모음 o · 세 소리 합쳐 읽기](https://www.youtube.com/watch?v=tkYDoNKit6o) | 규칙 연습용 | 2:19 | 6 | 각 소리를 손가락으로 짚고 합쳐 읽어요. 영상 뒤에는 우리 유닛 단어 3개로 다시 연습해요. |
| 2 | [단모음 u · 세 소리 합쳐 읽기](https://www.youtube.com/watch?v=FLfl_uY83Os) | 규칙 연습용 | 2:19 | 7, 8 | 각 소리를 손가락으로 짚고 합쳐 읽어요. 영상 뒤에는 우리 유닛 단어 3개로 다시 연습해요. |
| 3 | [매직 e 규칙 알아보기](https://www.youtube.com/watch?v=mxVWScxsOsc) | 수업 시작용 | 2:55 | 1, 2, 3, 4, 5, 6, 7, 8 | 끝의 e를 더하기 전과 후를 비교해요. 모든 끝 e에 적용되는 규칙으로 일반화하지 않아요. |
| 3 | [매직 e a_e 소리 연습](https://www.youtube.com/watch?v=hryR-aXaOaQ) | 규칙 연습용 | 3:25 | 1, 2 | 앞 모음과 끝 e를 함께 찾아요. 소리가 달라지는 것을 듣고 우리 교재의 단어로 다시 읽어요. |
| 3 | [매직 e i_e 소리 연습](https://www.youtube.com/watch?v=S5URW8zhbw0) | 규칙 연습용 | 2:43 | 3, 4 | 앞 모음과 끝 e를 함께 찾아요. 소리가 달라지는 것을 듣고 우리 교재의 단어로 다시 읽어요. |
| 3 | [매직 e o_e 소리 연습](https://www.youtube.com/watch?v=r_yWJQzDhxY) | 규칙 연습용 | 2:38 | 5, 6 | 앞 모음과 끝 e를 함께 찾아요. 소리가 달라지는 것을 듣고 우리 교재의 단어로 다시 읽어요. |
| 3 | [매직 e u_e 소리 연습](https://www.youtube.com/watch?v=cl82zAHzkmM) | 규칙 연습용 | 2:50 | 7, 8 | 앞 모음과 끝 e를 함께 찾아요. 소리가 달라지는 것을 듣고 우리 교재의 단어로 다시 읽어요. |
| 4 | [첫소리 자음군 소리 합치기](https://www.youtube.com/watch?v=RCCFqWV8S7E) | 마무리 복습용 | 3:32 | 4 | 첫소리 자음군을 배운 뒤 복습해요. 두 자음의 소리를 각각 살려 이어 말해요. |
| 4 | [L 자음군 bl·cl·gl 소리 연습](https://www.youtube.com/watch?v=QZ1Uu2MRXTY) | 규칙 연습용 | 2:06 | 1, 2 | 각 자음의 소리를 살려 붙여 읽어요. 영상의 sl은 확장 예시이며 fl·pl은 교재로 별도 연습해요. |
| 4 | [R 자음군 br·cr·dr·fr 소리 연습](https://www.youtube.com/watch?v=pQgJnpE7IL8) | 규칙 연습용 | 2:06 | 2, 3 | 두 소리를 하나씩 말한 뒤 빠르게 이어 말해요. gr·pr·tr까지 배운 자료로 오해하지 않게 해요. |
| 4 | [끝소리 자음군 합쳐 읽기](https://www.youtube.com/watch?v=hFBu8wkO_fM) | 마무리 복습용 | 2:56 | 6 | 끝소리 자음군을 배운 뒤 활용해요. 영상 예시와 별도로 mp·nd·nk 및 끝 sk를 교재에서 확인해요. |
| 4 | [sh 소리 따라 부르기](https://www.youtube.com/watch?v=HfMtsRVZWfE) | 규칙 연습용 | 2:17 | 7 | 두 글자를 함께 찾아 소리를 따라 말해요. 노래 뒤에는 해당 유닛의 단어 카드로 다시 읽어요. |
| 4 | [ch 소리 따라 부르기](https://www.youtube.com/watch?v=FWg2uzAuSe4) | 규칙 연습용 | 2:20 | 7 | 두 글자를 함께 찾아 소리를 따라 말해요. 노래 뒤에는 해당 유닛의 단어 카드로 다시 읽어요. |
| 4 | [th 소리 따라 부르기](https://www.youtube.com/watch?v=o3INXFPrfJM) | 규칙 연습용 | 2:17 | 7, 8 | 두 글자를 함께 찾아 소리를 따라 말해요. thin의 /θ/와 this의 /ð/는 나누어 확인해요. |
| 4 | [wh 소리 따라 부르기](https://www.youtube.com/watch?v=GO3UxDydumA) | 규칙 연습용 | 2:17 | 8 | 두 글자를 함께 찾아 소리를 따라 말해요. 노래 뒤에는 해당 유닛의 단어 카드로 다시 읽어요. |
| 4 | [ng 소리 따라 부르기](https://www.youtube.com/watch?v=94eOpBrVmwY) | 규칙 연습용 | 2:44 | 8 | 두 글자를 함께 찾아 소리를 따라 말해요. 노래 뒤에는 해당 유닛의 단어 카드로 다시 읽어요. |
| 5 | [ee·ea 긴 e 소리 연습](https://www.youtube.com/watch?v=3PJGqbCeRU4) | 규칙 연습용 | 2:50 | 1 | ee와 ea 예시를 나눠 읽어요. ea가 언제나 같은 소리를 낸다고 설명하지 않아요. |
| 5 | [ai·ay와 a_e 비교 복습](https://www.youtube.com/watch?v=m-uLFJp5ZtI) | 마무리 복습용 | 2:26 | 2 | ai·ay를 배우고 이전 a_e와 비교해요. 같은 긴 a 소리를 서로 다른 철자로 찾아요. |
| 5 | [oa·ow와 o_e 비교 복습](https://www.youtube.com/watch?v=NZHn2UhrLZM) | 마무리 복습용 | 2:22 | 3 | 긴 o의 oa·ow를 o_e와 비교해요. cow의 ow /aʊ/는 다음 규칙으로 구분해 주세요. |
| 5 | [oo의 두 소리 나눠 듣기](https://www.youtube.com/watch?v=Dbvp5ZNxabI) | 규칙 연습용 | 3:02 | 4 | book의 /ʊ/와 moon의 /uː/를 따로 듣고 두 모둠으로 분류해요. |
| 5 | [oi·oy /ɔɪ/ 소리 연습](https://www.youtube.com/watch?v=OdWkgYQnFcw) | 규칙 연습용 | 2:43 | 5 | 같은 /ɔɪ/ 소리를 듣고 oi와 oy 철자를 나눠 찾아요. 일반 장모음과 구분해요. |
| 5 | [ou·ow /aʊ/ 소리 연습](https://www.youtube.com/watch?v=i-6i0INcX40) | 규칙 연습용 | 2:28 | 6 | 입모양이 변하는 /aʊ/를 따라 해요. snow의 긴 o ow와 별도로 분류해요. |
| 5 | [ar 소리 따라 부르기](https://www.youtube.com/watch?v=QI4bVIW4qK4) | 규칙 연습용 | 3:39 | 7 | ar를 함께 표시하고 소리를 말해요. 노래 후 우리 유닛 단어를 찾아 읽어요. |
| 5 | [er·ir·ur 같은 소리 비교](https://www.youtube.com/watch?v=mr6TitJodII) | 마무리 복습용 | 4:09 | 8, 9 | er·ir를 배운 뒤 ur 예시도 함께 비교해요. 철자는 달라도 소리가 비슷한 단어를 분류해요. |
| 5 | [or 소리 따라 부르기](https://www.youtube.com/watch?v=jpZvFbTXW_o) | 규칙 연습용 | 3:56 | 9 | or를 함께 짚으며 소리를 따라 말해요. 교재의 ur 소리와는 따로 비교해요. |

## 파일

- `supabase/092_phonics_provided_songs.sql`: 실제 등록에 사용한 추가 전용 SQL. 동일 URL·시작 시각은 건너뛰므로 재실행해도 기존 자료를 바꾸지 않습니다.
- `app/scripts/ready-media/provided-phonics-songs.json`: 편성표·출처·검증 범위를 포함한 등록 원본. 화면별로 별도 목록을 만들지 않고 운영 DB를 계속 참조합니다.
- `output/phonics-song-curation/production-level1.png`: 실제 운영 목록 캡처.
- `output/media-v2/curated-desktop.png`, `curated-mobile.png`: 새 활용 팁 표시의 로컬 캡처.
