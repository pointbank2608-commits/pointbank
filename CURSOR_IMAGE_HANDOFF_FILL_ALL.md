# 단어 사전 그림 — 비어 있는 자리 전부 채우기

작성: Claude Code (2026-10-02). 대상 폴더: `app/public/word-bank-images/`.
이 문서 하나만 보면 된다(예전 `CURSOR_IMAGE_HANDOFF*.md`의 규격을 여기에 다시 적었고, **이 문서가 우선**이다).

- 다시 만들 그림: **37장** (+ 숫자 27장은 사용자에게 물어본 뒤)
- 새로 만들 그림: **1936장** (남은 493장)
- 그리지 않는 단어: `death`, `suicide`, `murder`, `torture`, `abuse`, `terror` — 빈 자리로 둔다.

## 가장 중요한 규칙: 사과로 만들지 않는다

지난 작업에서 화풍 참고로 준 `apple.webp`의 **모양까지** 따라가서, 사과와 상관없는 단어가 사과 모양·사과 색·사과 꼭지와 잎을 달고 나왔다(망원경에 잎이 달리거나, 나라·뿌리가 사과 안에 들어가는 식). 같은 이유로 `climb.webp`(나무를 타는 아이)의 장면이 엉뚱한 단어에 그대로 들어가기도 했다.

1. **`apple.webp`를 참고 이미지로 넣지 않는다.** 참고 그림은 아래 "화풍 참고"에 적힌 두 장만, 사람이 나오는 그림에만 붙인다. 사물이 있는 그림(의자·버스·시계·가방·돌고래 등)을 참고로 주면 그 물건이 엉뚱한 단어에 끼어든다(실제로 그랬다).
2. 참고 그림에서 가져올 것은 **질감·조명·색감·배경 처리뿐**이다. 모양, 구도, 등장하는 물건·인물의 자세는 가져오지 않는다.
3. 단어의 뜻이나 참고 문장에 사과가 **실제로 나올 때만** 사과를 그린다. 그 밖의 그림에는 사과, 빨갛고 둥근 과일 모양 몸통, 과일 꼭지, 꼭지 옆 초록 잎을 넣지 않는다. 소품으로도 넣지 않는다(책상 위, 선반 위, 화면 속, 책 속 그림 등).
4. 수를 보여 줄 때는 사과 대신 공·블록·별·단추 등 단어마다 다른 물건을 쓴다.
5. 나무를 타는 아이는 `climb`에만 나온다. 다른 단어에 나무 타는 장면을 넣지 않는다.
6. 프롬프트마다 이 문장을 붙인다: `no apple, no apple shape, no fruit stem, no leaf on top, do not copy the composition of the reference image`.
7. 한 묶음(50장)을 만들 때마다 썸네일을 모아 훑어본다. 사과·사과 잎·나무 타는 아이가 보이거나 글자가 박혀 있으면 그 자리에서 다시 만든다.

## 규격

- **화풍**: 점토(클레이) 3D 질감, 머리가 크고 통통한 3등신 인물(어른도 같은 비율로 조금 클 뿐), 밝고 따뜻한 파스텔 단색 배경.
- **화풍 참고**: 사람이 나오는 그림에만 `lean.webp`·`muscle.webp`(아이 한 명만 서 있어 베낄 물건이 없다) — 인물 비율·얼굴·점토 질감·배경 색감만 가져오고 자세·옷·머리는 장면에 맞게. 사물·풍경 그림은 참고 없이 글로만: `chunky plasticine clay figures, big round head about half of body height, short arms and legs, toddler-like proportions, big round black eyes, rosy cheeks, soft matte clay texture, plain warm pastel background, soft lighting`. 참고를 아예 빼면 인물이 키 큰 5~6등신으로 바뀐다(실제로 그랬다).
- **색**: 사물은 선명하고 다양한 색으로(베이지 한 가지로 칠하지 않는다). 배경은 크림·살구·연노랑·연두·연하늘색을 번갈아, 진한 색은 쓰지 않는다.
- **크기·형식**: 1024×1024 정사각 WebP, 장당 약 100~150KB.
- **파일명**: 표의 `id` 그대로 `<id>.webp`. 표에 없는 이름은 쓰지 않는다(사전과 연결이 안 된다).
- **글자·숫자·로고·말풍선 금지.** 간판, 책 표지, 화면, 옷, 차 옆면, 달력, 눈금 모두 글자 없이. 줄·색 띠·그림 모양으로 대신한다. ✓, 화살표, 음표, 하트 같은 **모양**은 괜찮다.
- **한 장에 뜻 하나**: 주제를 가운데 크게. 배경은 단순하게(같은 들판·구름 배경을 모든 그림에 반복하지 않는다).
- **인물**: 클레이 아이·어른 1~4명. 표정과 몸짓을 크게. 여러 아이가 고루 나오게(남자아이 한 명만 반복하지 않는다).
- **밝고 안전하게**: 피, 다친 모습, 우는 얼굴 클로즈업, 사람을 겨누는 무기, 술 마시는 모습, 담배 피우는 모습을 그리지 않는다. 무거운 뜻은 표의 "장면"에 적어 둔 대로만 그린다.

## 추상어를 그리는 법 (장면 칸이 비어 있는 단어)

중학·고등 단어 대부분은 눈에 보이는 물건이 아니다. 이렇게 한다.

1. **참고 문장을 그대로 한 장면으로 그린다.** 예: `able` "She is able to speak three languages." → 세 나라 아이와 번갈아 이야기하며 웃는 여자아이.
2. 그 장면 안에서 **그 단어의 뜻이 가장 크게 보이게** 한다. 동사는 그 동작을 하는 순간, 형용사는 그 상태가 과장되게, 명사는 그 대상이 가운데.
3. 문장이 그림으로 옮기기 어려우면 뜻을 보여 주는 **더 쉬운 일상 장면**으로 바꿔도 된다(학교, 집, 놀이터, 가게). 문장을 글자로 쓰지는 않는다.
4. 접속사·전치사·조동사처럼 뜻만으로는 그림이 안 되는 낱말도 참고 문장의 장면을 그린다. 화살표·점선 같은 단순한 모양을 하나 곁들여도 된다.
5. 뜻이 비슷한 단어끼리 같은 그림이 되지 않게, 참고 문장의 구체적인 물건·장소를 살린다.

## 하지 말 것

- 아래 "1. 다시 만들 그림"에 없는 기존 그림은 건드리지 않는다.
- 코드, SQL, 번역 문구는 고치지 않는다. 그림 파일만 추가·교체한다.
- 커밋·푸시·배포는 하지 않는다(사용자가 Claude Code에 요청한다).

## 순서

1번부터 차례로. 한 번에 50장씩 만들고, 묶음이 끝날 때마다 몇 장 했는지와 건너뛴 단어를 알려 준다.
`node app/scripts/vocab/build-image-fill-all.mjs`를 다시 돌리면 "만들어졌나" 칸이 채워져 남은 것을 볼 수 있다.

## 1. 다시 만들 그림 (37장 — 같은 파일 이름으로 덮어쓴다)

### 1-1. 사과가 끼어든 그림 (14장)

| id | 뜻 | 이렇게 다시 |
|---|---|---|
| `comic` | 만화책 | 펼친 만화책(칸마다 우주선·강아지·로봇 같은 서로 다른 그림, 글자 없이) |
| `blanket` | 담요 | 개어 놓은 체크무늬 담요 하나 |
| `shelf` | 선반 | 벽 선반 위에 책 몇 권과 작은 화분 |
| `workbook` | 문제집 | 연필이 놓인 펼친 문제집(줄과 빈칸 모양만, 글자·사과 없이) |
| `sentence` | 문장 | 낱말 카드 여러 장이 한 줄로 이어져 있고 끝에 둥근 점 카드(카드 안은 단순한 색 블록, 글자 없이) |
| `smaller` | 더 작은 | 큰 곰 인형 옆의 작은 곰 인형(작은 쪽을 밝게) |
| `laptop` | 노트북 | 열려 있는 노트북(화면은 하늘과 언덕 풍경) |
| `screen` | 화면 | 모니터 화면에 산과 해가 보이는 풍경 |
| `living-thing` | 생물 | 새·물고기·꽃·나비가 함께 있는 모습 |
| `underline` | 밑줄을 긋다 | 아이가 자를 대고 공책의 줄 아래에 연필로 선을 긋는 장면 |
| `lemon` | 레몬 | 끝이 뾰족한 타원형 노란 레몬과 반으로 자른 단면(사과 꼭지·잎 없이) |
| `mango` | 망고 | 타원형 노랑·주황 망고와 격자로 칼집 낸 망고 조각(사과 꼭지·잎 없이) |
| `pumpkin` | 호박 | 골이 깊게 진 주황 호박과 굵은 초록 꼭지(사과 잎 없이) |
| `onion` | 양파 | 갈색 껍질 양파와 반으로 자른 겹겹 단면(사과 꼭지·잎 없이) |

### 1-2. 글자·숫자가 박힌 그림 (15장)

| id | 뜻 | 이렇게 다시 |
|---|---|---|
| `bookstore` | 서점 | 진열창에 책이 가득한 가게(간판은 책 모양 그림, 글자 없이) |
| `freezer` | 냉동고 | 문이 열린 냉동고 안에 얼음과 아이스크림(글자 없이) |
| `fever` | 열 | 이마에 물수건을 얹고 볼이 빨간 아이와 체온계(눈금 숫자·글자 없이) |
| `sore-throat` | 목이 아픔 | 목에 목도리를 두르고 목을 만지며 찡그린 아이(글자 없이) |
| `shorter` | 더 짧은·작은 | 긴 연필과 짧은 연필이 나란히(짧은 쪽을 밝게, 글자 없이) |
| `sometimes` | 가끔 | 일곱 칸 중 두 칸에만 별 스티커가 붙은 빈 주간표(글자·숫자 없이) |
| `bookshelf` | 책장 | 색색의 책이 꽂힌 나무 책장(책등 글자 없이) |
| `click` | 클릭하다 | 아이가 마우스를 누르고 화면에 화살표 커서와 반짝임(글자 없이) |
| `school-bus` | 스쿨버스 | 창문으로 아이들이 손 흔드는 노란 버스(옆면 글자 없이) |
| `ambulance` | 구급차 | 빨간 십자 표시와 경광등이 있는 흰 구급차(글자 없이) |
| `fire-engine` | 소방차 | 사다리와 호스가 달린 빨간 소방차(글자·숫자 없이) |
| `title` | 제목 | 표지 위쪽에 넓은 색 띠가 있고 그 띠가 반짝이며 강조된 책(글자 없이, 띠 자리가 제목임을 화살표 모양으로) |
| `event` | 행사 | 풍선과 깃발 장식 아래 아이들이 모인 행사장(케이크·현수막 글자 없이) |
| `chapter` | 장(책의) | 색깔 띠지로 여러 묶음이 나뉜 두꺼운 책(숫자·글자 없이) |
| `height` | 키 | 벽의 눈금 막대 앞에 서서 키를 재는 아이(눈금은 줄만, 숫자 없이) |

### 1-3. 나무 타는 아이가 엉뚱하게 들어간 그림 (8장)

| id | 뜻 | 이렇게 다시 |
|---|---|---|
| `nod` | 고개를 끄덕이다 | 아이가 웃으며 고개를 아래로 끄덕이는 모습(머리 위아래 움직임 선) |
| `blond` | 금발의 | 밝은 금발 머리 남자아이 얼굴과 상반신 |
| `serious` | 진지한 | 입을 다물고 눈썹을 모은 채 책상에서 집중하는 아이 |
| `november` | 11월 | 낙엽이 거의 다 떨어진 나무 아래에서 목도리를 두르고 낙엽을 쓸어 모으는 아이 |
| `snowy` | 눈이 오는 | 눈이 펑펑 내리는 마을과 눈 쌓인 지붕 |
| `humid` | 습한 | 땀을 흘리며 부채질하는 아이와 김 서린 창문 |
| `freezing` | 몹시 추운 | 두꺼운 외투를 입고 덜덜 떠는 아이와 고드름 |
| `actor` | 배우 | 무대 조명 아래에서 의상을 입고 연기하는 아이 |

### 1-4. 숫자 27장 — 사용자에게 먼저 물어볼 것

`one` `two` `three` `four` `five` `six` `seven` `eight` `nine` `ten` `eleven` `twelve` `thirteen` `fourteen` `fifteen` `sixteen` `seventeen` `eighteen` `nineteen` `twenty` `thirty` `forty` `fifty` `sixty` `seventy` `eighty` `ninety`

지금은 전부 사과 개수로 그려져 있다(예전 안내서가 그렇게 시켰다). 사용자가 바꾸자고 하면 단어마다 다른 물건(공, 블록, 별, 단추, 구슬, 연필, 조개 등)으로 다시 만든다. 큰 수(thirty~ninety)는 열 개씩 묶은 블록 줄로. 숫자 글자는 넣지 않는다.

## 2. 중학·고등 — 눈에 보이는 사물·장면 (278장, 남은 0장)

장면이 이미 적혀 있다. 그대로 그린다.

| id | 단어 | 품사 | 뜻 | 장면(비어 있으면 참고 문장을 그대로 한 장면으로) | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|---|
| `accept` | accept | 동사 | 받아들이다 | 아이가 두 손으로 선물을 받으며 웃는 장면 | Please accept my apology. | 완료 |
| `accident` | accident | 명사 | 사고 | 자전거가 넘어져 있고 아이가 무릎을 잡고 앉아 있는 장면(다친 모습 없이) | He hurt his leg in a car accident. | 완료 |
| `achieve` | achieve | 동사 | 이루다, 성취하다 | 산꼭대기에 올라 두 팔을 번쩍 든 아이 | She worked hard to achieve her goal. | 완료 |
| `adopt` | adopt | 동사 | 입양하다, 채택하다 | 가족이 강아지를 안고 집으로 데려오는 장면 | They adopted a puppy from the shelter. | 완료 |
| `adventure` | adventure | 명사 | 모험 | 배낭을 멘 아이가 지도를 들고 숲길을 걷는 장면 | We went on an adventure in the forest. | 완료 |
| `aim` | aim | 명사 | 목표, 겨냥 | 과녁 한가운데 꽂힌 화살 | My aim is to pass the test. | 완료 |
| `alarm` | alarm | 명사 | 경보, 알람 | 종이 달린 알람 시계가 울리며 흔들리는 모습(숫자 없이) | The alarm rang at seven. | 완료 |
| `aloud` | aloud | 부사 | 소리 내어 | 아이가 책을 펴고 입을 크게 벌려 읽는 장면(글자 없이) | Please read the story aloud. | 완료 |
| `angel` | angel | 명사 | 천사 | 날개와 동그란 후광이 있는 귀여운 천사 | She sang like an angel. | 완료 |
| `arrange` | arrange | 동사 | 정리하다, 마련하다 | 아이가 책을 크기 순서대로 책꽂이에 꽂는 장면 | She arranged the books by size. | 완료 |
| `asleep` | asleep | 형용사 | 잠든 | 아기가 이불을 덮고 곤히 자는 장면 | The baby is fast asleep. | 완료 |
| `attach` | attach | 동사 | 붙이다 | 아이가 종이에 사진을 풀로 붙이는 장면 | Attach the photo to the paper. | 완료 |
| `audience` | audience | 명사 | 관객, 청중 | 공연장 객석에 앉아 박수치는 사람들 | The audience clapped loudly. | 완료 |
| `award` | award | 명사 | 상 | 리본이 달린 트로피 | She won an award for her painting. | 완료 |
| `bacon` | bacon | 명사 | 베이컨 | 접시에 담긴 구운 베이컨 몇 줄 | I had bacon and eggs for breakfast. | 완료 |
| `balance` | balance | 명사 | 균형 | 아이가 두 팔을 벌리고 평균대 위를 걷는 장면 | He lost his balance and fell. | 완료 |
| `bar` | bar | 명사 | 막대, 술집 | 포장지를 반쯤 벗긴 초콜릿 바 | She ate a chocolate bar. | 완료 |
| `bark` | bark | 동사 | 짖다 | 강아지가 입을 벌리고 짖는 장면 | The dog barks at strangers. | 완료 |
| `bay` | bay | 명사 | 만(바다) | 산으로 둘러싸인 잔잔한 바다와 작은 배 몇 척 | Boats are sitting in the bay. | 완료 |
| `bend` | bend | 동사 | 구부리다, 굽히다 | 아이가 무릎을 굽혀 스트레칭하는 장면 | Bend your knees slowly. | 완료 |
| `bin` | bin | 명사 | 쓰레기통, 통 | 뚜껑 달린 쓰레기통 | Put the paper in the bin. | 완료 |
| `bite` | bite | 동사 | 물다 | 아이가 사과를 한 입 크게 베어 무는 장면 | The dog will not bite you. | 완료 |
| `blank` | blank | 형용사 | 빈, 공백의 | 아무것도 쓰이지 않은 흰 종이 한 장 | Write your name in the blank space. | 완료 |
| `bloom` | bloom | 동사 | 꽃이 피다 | 활짝 핀 꽃과 아직 봉오리인 꽃 | Roses bloom in June. | 완료 |
| `boot` | boot | 명사 | 부츠, 장화 | 긴 장화 한 켤레 | Wear your boots in the snow. | 완료 |
| `brake` | brake | 명사 | 브레이크 | 자전거 손잡이의 브레이크 레버 | Check the brakes on your bike. | 완료 |
| `brick` | brick | 명사 | 벽돌 | 쌓여 있는 붉은 벽돌 몇 장 | The house is made of red bricks. | 완료 |
| `bubble` | bubble | 명사 | 거품, 비눗방울 | 아이가 비눗방울을 불고 방울이 떠다니는 장면 | The kids are blowing bubbles. | 완료 |
| `bug` | bug | 명사 | 벌레 | 잎사귀 위의 작은 무당벌레 | There is a bug on the leaf. | 완료 |
| `bunch` | bunch | 명사 | 다발, 송이 | 포도 한 송이와 꽃 한 다발 | She bought a bunch of grapes. | 완료 |
| `burst` | burst | 동사 | 터지다 | 터지는 순간의 풍선(조각이 흩어지는 모습) | The balloon burst suddenly. | 완료 |
| `bury` | bury | 동사 | 묻다 | 강아지가 땅을 파고 뼈다귀를 묻는 장면 | The dog buried a bone. | 완료 |
| `bush` | bush | 명사 | 덤불 | 동글동글한 초록 덤불 | A rabbit hid in the bush. | 완료 |
| `cable` | cable | 명사 | 전선, 케이블 | 돌돌 말린 충전 케이블 | Plug in the cable. | 완료 |
| `cage` | cage | 명사 | 우리, 새장 | 작은 새가 들어 있는 새장 | The bird is in a cage. | 완료 |
| `cape` | cape | 명사 | 망토, 곶 | 빨간 망토 | The hero wears a red cape. | 완료 |
| `carpet` | carpet | 명사 | 카펫 | 무늬가 있는 네모난 카펫 | The cat is sleeping on the carpet. | 완료 |
| `castle` | castle | 명사 | 성 | 탑과 깃발이 있는 성 | The king lives in a castle. | 완료 |
| `chain` | chain | 명사 | 사슬, 체인 | 고리가 이어진 쇠사슬 | The bike chain came off. | 완료 |
| `champion` | champion | 명사 | 우승자 | 시상대 가운데에서 트로피를 든 아이 | She is the world champion. | 완료 |
| `charge` | charge | 동사 | 충전하다, 요금을 청구하다 | 충전기에 꽂혀 충전 중인 휴대폰(화면 글자 없이) | I need to charge my phone. | 완료 |
| `chart` | chart | 명사 | 도표 | 막대그래프가 그려진 종이(글자·숫자 없이) | Look at the chart on page ten. | 완료 |
| `chase` | chase | 동사 | 뒤쫓다 | 강아지가 고양이를 뒤쫓아 달리는 장면 | The dog chased the cat. | 완료 |
| `chip` | chip | 명사 | 칩, 조각 | 그릇에 담긴 감자칩 | I ate a bag of potato chips. | 완료 |
| `chop` | chop | 동사 | 썰다 | 도마 위에서 채소를 써는 장면 | Chop the onions into small pieces. | 완료 |
| `cinema` | cinema | 명사 | 영화관 | 큰 스크린과 의자가 줄지어 있는 영화관 안 | We went to the cinema last night. | 완료 |
| `cliff` | cliff | 명사 | 절벽 | 바다 위로 솟은 높은 절벽 | Do not go near the cliff. | 완료 |
| `clip` | clip | 명사 | 클립, 짧은 영상 | 종이 몇 장을 물고 있는 집게 클립 | Hold the papers with a clip. | 완료 |
| `clue` | clue | 명사 | 단서 | 돋보기로 발자국을 비추는 모습 | The detective found a clue. | 완료 |
| `coal` | coal | 명사 | 석탄 | 검은 석탄 덩어리 몇 개 | Coal is used to make electricity. | 완료 |
| `coast` | coast | 명사 | 해안 | 굽은 해안선과 파도 | We drove along the coast. | 완료 |
| `connect` | connect | 동사 | 연결하다 | 점 여러 개가 선으로 이어진 모습 | Connect the dots with a line. | 완료 |
| `correct` | correct | 형용사 | 맞는, 정확한 | 종이 위의 큰 동그라미 표시와 체크 모양(글자 없이) | Your answer is correct. | 완료 |
| `cottage` | cottage | 명사 | 작은 집, 오두막 | 호숫가의 작은 오두막 | They live in a cottage by the lake. | 완료 |
| `countryside` | countryside | 명사 | 시골 | 논밭과 작은 집이 있는 시골 풍경 | My grandparents live in the countryside. | 완료 |
| `crack` | crack | 명사 | 금, 갈라진 틈 | 금이 간 컵 | There is a crack in the cup. | 완료 |
| `crowd` | crowd | 명사 | 군중 | 광장에 빽빽이 모인 많은 사람들 | A crowd gathered in the square. | 완료 |
| `crown` | crown | 명사 | 왕관 | 보석이 박힌 금 왕관 | The queen wears a gold crown. | 완료 |
| `cycle` | cycle | 명사 | 순환, 자전거 | 화살표 세 개가 둥글게 이어진 순환 모양 | The seasons follow a cycle. | 완료 |
| `dawn` | dawn | 명사 | 새벽 | 산 너머로 해가 막 떠오르는 새벽 하늘 | We left at dawn. | 완료 |
| `decorate` | decorate | 동사 | 꾸미다 | 아이들이 나무에 장식을 다는 장면 | We decorated the Christmas tree. | 완료 |
| `deliver` | deliver | 동사 | 배달하다 | 배달원이 문 앞에서 상자를 건네는 장면 | They deliver pizza to our house. | 완료 |
| `dig` | dig | 동사 | 파다 | 아이가 삽으로 모래를 파는 장면 | The dog is digging a hole. | 완료 |
| `disc` | disc | 명사 | 원반, 디스크 | 반짝이는 둥근 디스크 한 장 | Put the disc into the player. | 완료 |
| `distance` | distance | 명사 | 거리 | 두 집 사이에 양쪽 화살표가 그어진 모습 | What is the distance to the station? | 완료 |
| `dive` | dive | 동사 | 뛰어들다, 잠수하다 | 아이가 다이빙대에서 수영장으로 뛰어드는 장면 | He dived into the pool. | 완료 |
| `divide` | divide | 동사 | 나누다 | 여섯 조각으로 나뉜 케이크 | Divide the cake into six pieces. | 완료 |
| `document` | document | 명사 | 서류, 문서 | 줄이 그어진 서류 몇 장(글자 없이 줄 모양만) | Save the document on your computer. | 완료 |
| `donate` | donate | 동사 | 기부하다 | 아이가 옷이 든 상자를 기부함에 넣는 장면 | We donated clothes to the poor. | 완료 |
| `dozen` | dozen | 명사 | 12개, 한 다스 | 열두 개가 든 달걀 한 판 | I bought a dozen eggs. | 완료 |
| `envelope` | envelope | 명사 | 봉투 | 우표 자리가 있는 흰 편지 봉투(글자 없이) | Put the letter in the envelope. | 완료 |
| `escape` | escape | 동사 | 탈출하다, 벗어나다 | 새가 열린 새장 밖으로 날아가는 장면 | The bird escaped from the cage. | 완료 |
| `examine` | examine | 동사 | 검사하다, 진찰하다 | 의사가 아이의 눈을 작은 불빛으로 살펴보는 장면 | The doctor examined my eyes. | 완료 |
| `exchange` | exchange | 동사 | 교환하다 | 두 아이가 서로 선물 상자를 주고받는 장면 | We exchanged gifts at the party. | 완료 |
| `exit` | exit | 명사 | 출구 | 열린 문과 문 쪽을 가리키는 초록 화살표(글자 없이) | Where is the exit? | 완료 |
| `experiment` | experiment | 명사 | 실험 | 아이가 실험복을 입고 시험관에 액체를 붓는 장면 | We did a science experiment. | 완료 |
| `feed` | feed | 동사 | 먹이를 주다 | 아이가 강아지 밥그릇에 사료를 부어 주는 장면 | I feed my dog twice a day. | 완료 |
| `fence` | fence | 명사 | 울타리 | 나무 울타리 | The dog jumped over the fence. | 완료 |
| `flame` | flame | 명사 | 불꽃 | 촛불의 작은 불꽃 | The candle flame is small. | 완료 |
| `flight` | flight | 명사 | 비행, 항공편 | 구름 위를 나는 여객기 | Our flight leaves at nine. | 완료 |
| `frame` | frame | 명사 | 틀, 액자 | 빈 나무 액자 | I put the photo in a frame. | 완료 |
| `fry` | fry | 동사 | 튀기다, 볶다 | 프라이팬 위의 달걀 프라이 | Fry the eggs in a pan. | 완료 |
| `furniture` | furniture | 명사 | 가구 | 소파·탁자·의자가 함께 놓인 모습 | We bought new furniture for the living room. | 완료 |
| `gather` | gather | 동사 | 모이다, 모으다 | 아이들이 모닥불 주위에 둥글게 모여 앉은 장면 | We gathered around the campfire. | 완료 |
| `ghost` | ghost | 명사 | 유령 | 하얀 천을 뒤집어쓴 듯한 귀여운 유령 | Do you believe in ghosts? | 완료 |
| `graph` | graph | 명사 | 그래프 | 오르내리는 선 그래프가 그려진 종이(글자·숫자 없이) | Draw a graph of the results. | 완료 |
| `greet` | greet | 동사 | 인사하다, 맞이하다 | 두 아이가 손을 흔들며 인사하는 장면 | She greeted me with a smile. | 완료 |
| `grocery` | grocery | 명사 | 식료품 | 채소와 빵이 담긴 종이 장바구니 | We buy groceries every weekend. | 완료 |
| `highway` | highway | 명사 | 고속도로 | 차들이 달리는 넓은 고속도로 | We drove on the highway. | 완료 |
| `increase` | increase | 동사 | 증가하다, 늘리다 | 오른쪽 위로 올라가는 막대들과 위쪽 화살표 | The price of milk increased. | 완료 |
| `invent` | invent | 동사 | 발명하다 | 아이가 작업대에서 로봇을 조립하고 머리 위에 전구가 켜진 장면 | Who invented the telephone? | 완료 |
| `iron` | iron | 명사 | 철, 다리미 | 다리미 한 개 | The gate is made of iron. | 완료 |
| `joy` | joy | 명사 | 기쁨 | 아이가 두 팔을 들고 기뻐서 뛰어오르는 장면 | She jumped for joy. | 완료 |
| `laboratory` | laboratory | 명사 | 실험실 | 실험 기구와 현미경이 놓인 실험실 책상 | We did the test in the laboratory. | 완료 |
| `lamb` | lamb | 명사 | 새끼 양 | 풀밭의 하얀 새끼 양 | A lamb is playing in the field. | 완료 |
| `lawn` | lawn | 명사 | 잔디밭 | 잘 깎인 초록 잔디밭과 잔디 깎는 기계 | Dad is cutting the lawn. | 완료 |
| `lean` | lean | 동사 | 기대다, 기울다 | 아이가 벽에 등을 기대고 서 있는 장면 | He leaned against the wall. | 완료 |
| `lid` | lid | 명사 | 뚜껑 | 뚜껑이 살짝 열린 냄비 | Put the lid on the pot. | 완료 |
| `lock` | lock | 동사 | 잠그다 | 자물쇠와 열쇠 | Lock the door when you leave. | 완료 |
| `log` | log | 명사 | 통나무 | 잘린 통나무 하나 | We sat on a log by the fire. | 완료 |
| `magazine` | magazine | 명사 | 잡지 | 표지 사진이 있는 잡지 몇 권(글자 없이) | I read a sports magazine. | 완료 |
| `mask` | mask | 명사 | 마스크, 가면 | 귀에 거는 흰 마스크 | Wear a mask when you are sick. | 완료 |
| `measure` | measure | 동사 | 재다, 측정하다 | 아이가 줄자로 책상 길이를 재는 장면(숫자 없이) | Measure the length of the desk. | 완료 |
| `mess` | mess | 명사 | 엉망인 상태 | 옷과 장난감이 여기저기 흩어진 방 | Your room is a mess. | 완료 |
| `mill` | mill | 명사 | 방앗간, 제분소 | 물레방아가 달린 방앗간 | The old mill is by the river. | 완료 |
| `monitor` | monitor | 명사 | 모니터, 화면 | 받침대가 있는 컴퓨터 모니터(화면 글자 없이) | Look at the computer monitor. | 완료 |
| `muscle` | muscle | 명사 | 근육 | 아이가 팔을 굽혀 알통을 자랑하는 장면 | Exercise makes your muscles strong. | 완료 |
| `nail` | nail | 명사 | 못, 손톱 | 나무판에 박힌 못과 망치 | Hit the nail with a hammer. | 완료 |
| `nest` | nest | 명사 | 둥지 | 알 세 개가 든 새 둥지 | The bird built a nest in the tree. | 완료 |
| `net` | net | 명사 | 그물, 네트 | 공이 들어간 축구 골대 그물 | The ball went into the net. | 완료 |
| `nut` | nut | 명사 | 견과 | 껍질째 놓인 호두와 땅콩 | Squirrels eat nuts. | 완료 |
| `oak` | oak | 명사 | 참나무 | 도토리가 달린 큰 참나무 | An old oak stands in the yard. | 완료 |
| `observe` | observe | 동사 | 관찰하다 | 아이가 돋보기로 개미를 관찰하는 장면 | We observed the ants carefully. | 완료 |
| `pack` | pack | 동사 | 짐을 싸다 | 아이가 여행 가방에 옷을 넣는 장면 | Pack your bag for the trip. | 완료 |
| `palace` | palace | 명사 | 궁전 | 기와지붕이 있는 웅장한 궁전 | We visited an old palace in Seoul. | 완료 |
| `pan` | pan | 명사 | 프라이팬, 냄비 | 손잡이가 달린 프라이팬 | Heat the pan first. | 완료 |
| `path` | path | 명사 | 길, 오솔길 | 숲 사이로 난 구불구불한 오솔길 | Follow the path through the forest. | 완료 |
| `pattern` | pattern | 명사 | 무늬, 양식 | 물방울·줄무늬·체크 무늬 천 조각 세 개 | The dress has a flower pattern. | 완료 |
| `perform` | perform | 동사 | 공연하다, 수행하다 | 무대 위에서 아이들이 악기를 연주하는 장면 | The band performed on stage. | 완료 |
| `pet` | pet | 명사 | 반려동물 | 아이가 강아지와 고양이를 안고 있는 장면 | Do you have a pet? | 완료 |
| `pile` | pile | 명사 | 더미 | 높이 쌓인 책 더미 | There is a pile of books on the desk. | 완료 |
| `pole` | pole | 명사 | 막대기, 극 | 깃발이 달린 높은 깃대 | The flag is on a tall pole. | 완료 |
| `port` | port | 명사 | 항구 | 배와 크레인이 있는 항구 | The ship arrived at the port. | 완료 |
| `pot` | pot | 명사 | 냄비, 화분 | 김이 나는 냄비 | The soup is in the pot. | 완료 |
| `pray` | pray | 동사 | 기도하다 | 아이가 두 손을 모으고 눈을 감은 장면 | They pray before meals. | 완료 |
| `prize` | prize | 명사 | 상, 상품 | 리본이 달린 상품 상자와 메달 | She won first prize in the contest. | 완료 |
| `promise` | promise | 명사 | 약속 | 두 아이가 새끼손가락을 걸고 약속하는 장면 | He kept his promise. | 완료 |
| `pump` | pump | 명사 | 펌프 | 자전거 바퀴에 꽂힌 손 펌프 | Use a pump to fill the tire. | 완료 |
| `rail` | rail | 명사 | 철로, 난간 | 곧게 뻗은 기찻길 | Hold the rail on the stairs. | 완료 |
| `raise` | raise | 동사 | 들어 올리다, 기르다 | 교실에서 아이가 손을 번쩍 든 장면 | Raise your hand if you know. | 완료 |
| `reach` | reach | 동사 | 도착하다, 닿다 | 아이가 까치발로 높은 선반의 물건에 손을 뻗는 장면 | We reached the top of the hill. | 완료 |
| `relax` | relax | 동사 | 쉬다, 긴장을 풀다 | 아이가 해먹에 누워 눈을 감고 쉬는 장면 | I relax by listening to music. | 완료 |
| `repair` | repair | 동사 | 수리하다 | 아이가 공구로 자전거 바퀴를 고치는 장면 | He repaired my bike. | 완료 |
| `rise` | rise | 동사 | 오르다, 뜨다 | 수평선 위로 떠오르는 해 | The sun rises in the east. | 완료 |
| `rope` | rope | 명사 | 밧줄 | 둥글게 감긴 밧줄 | Tie the boat with a rope. | 완료 |
| `row` | row | 명사 | 줄, 열 | 한 줄로 나란히 놓인 의자들 | We sat in the front row. | 완료 |
| `sauce` | sauce | 명사 | 소스 | 작은 그릇에 담긴 빨간 소스 | Put some tomato sauce on the pasta. | 완료 |
| `scale` | scale | 명사 | 저울, 규모 | 둥근 눈금판이 있는 저울(숫자 없이) | Step on the scale. | 완료 |
| `secret` | secret | 명사 | 비밀 | 한 아이가 친구 귀에 손을 대고 속삭이는 장면 | Can you keep a secret? | 완료 |
| `separate` | separate | 동사 | 분리하다 | 종이·플라스틱·캔이 따로 담긴 분리수거함 세 개(글자 없이) | Separate the paper from the plastic. | 완료 |
| `sew` | sew | 동사 | 바느질하다 | 할머니가 바늘과 실로 단추를 다는 장면 | Grandma sewed a button on my shirt. | 완료 |
| `shade` | shade | 명사 | 그늘 | 큰 나무 그늘 아래에 앉아 쉬는 아이 | We sat in the shade of a tree. | 완료 |
| `shadow` | shadow | 명사 | 그림자 | 아이와 바닥에 길게 드리운 그림자 | My shadow is long in the evening. | 완료 |
| `shell` | shell | 명사 | 조개껍데기, 껍질 | 여러 모양의 조개껍데기 | We collected shells on the beach. | 완료 |
| `shine` | shine | 동사 | 빛나다 | 반짝이는 별과 빛나는 해 | The stars shine at night. | 완료 |
| `slip` | slip | 동사 | 미끄러지다 | 아이가 얼음 위에서 미끄러져 엉덩방아를 찧는 장면(웃는 얼굴) | I slipped on the ice. | 완료 |
| `soldier` | soldier | 명사 | 군인 | 군복을 입고 경례하는 군인 | The soldier came home safely. | 완료 |
| `speech` | speech | 명사 | 연설, 말 | 아이가 단상에서 마이크 앞에 서서 말하는 장면 | She gave a speech at the school festival. | 완료 |
| `spin` | spin | 동사 | 돌다, 돌리다 | 빙글빙글 도는 팽이 | The top spins on the floor. | 완료 |
| `spray` | spray | 동사 | 뿌리다 | 분무기에서 물이 뿜어져 나오는 모습 | Spray water on the plants. | 완료 |
| `spread` | spread | 동사 | 펴다, 퍼지다 | 아이가 빵에 버터를 펴 바르는 장면 | Spread butter on the bread. | 완료 |
| `stage` | stage | 명사 | 무대, 단계 | 커튼과 조명이 있는 빈 무대 | The singer came onto the stage. | 완료 |
| `stir` | stir | 동사 | 젓다 | 아이가 냄비 안을 국자로 젓는 장면 | Stir the soup slowly. | 완료 |
| `stream` | stream | 명사 | 시내, 개울 | 돌 사이로 흐르는 작은 개울 | Fish swim in the stream. | 완료 |
| `stretch` | stretch | 동사 | 늘이다, 기지개를 켜다 | 아이가 두 팔을 위로 쭉 뻗어 기지개를 켜는 장면 | Stretch your arms before you swim. | 완료 |
| `string` | string | 명사 | 끈, 줄 | 둥글게 감긴 실뭉치와 끈 | Tie the box with string. | 완료 |
| `suit` | suit | 명사 | 정장 | 넥타이를 맨 남자 정장 한 벌 | Dad wore a suit to the wedding. | 완료 |
| `surround` | surround | 동사 | 둘러싸다 | 나무들로 빙 둘러싸인 작은 집 | Trees surround the house. | 완료 |
| `sweep` | sweep | 동사 | 쓸다 | 아이가 빗자루로 바닥을 쓰는 장면 | I swept the floor with a broom. | 완료 |
| `tank` | tank | 명사 | 수조, 탱크 | 물고기가 헤엄치는 어항 | There are three fish in the tank. | 완료 |
| `tin` | tin | 명사 | 깡통, 주석 | 뚜껑이 열린 깡통 | Open the tin of tuna. | 완료 |
| `tool` | tool | 명사 | 도구 | 망치·드라이버·렌치가 나란히 놓인 모습 | A hammer is a useful tool. | 완료 |
| `tower` | tower | 명사 | 탑 | 하늘로 높이 솟은 탑 | We went up the tower. | 완료 |
| `traffic` | traffic | 명사 | 교통 | 길게 줄지어 선 자동차들 | There is a lot of traffic in the morning. | 완료 |
| `tray` | tray | 명사 | 쟁반 | 컵 두 개가 놓인 쟁반 | Carry the cups on a tray. | 완료 |
| `twin` | twin | 명사 | 쌍둥이 | 똑같이 생긴 두 아이가 나란히 서 있는 장면 | My sister and I are twins. | 완료 |
| `view` | view | 명사 | 경치, 견해 | 아이가 창밖으로 바다 경치를 바라보는 장면 | The room has a view of the sea. | 완료 |
| `volunteer` | volunteer | 명사 | 자원봉사자 | 조끼를 입은 아이들이 쓰레기를 줍는 봉사 장면 | She works as a volunteer at the hospital. | 완료 |
| `vote` | vote | 동사 | 투표하다 | 아이가 투표함에 종이를 넣는 장면(글자 없이) | We voted for the class president. | 완료 |
| `wheel` | wheel | 명사 | 바퀴 | 자전거 바퀴 하나 | A bike has two wheels. | 완료 |
| `whistle` | whistle | 명사 | 호루라기, 휘파람 | 끈이 달린 호루라기 | The referee blew the whistle. | 완료 |
| `wipe` | wipe | 동사 | 닦다 | 아이가 행주로 식탁을 닦는 장면 | Wipe the table with a cloth. | 완료 |
| `wrap` | wrap | 동사 | 싸다, 포장하다 | 아이가 선물 상자를 포장지로 싸는 장면 | She wrapped the gift in blue paper. | 완료 |
| `agriculture` | agriculture | 명사 | 농업 | 밭에서 일하는 트랙터와 줄지어 자란 작물 | Agriculture is important in this region. | 완료 |
| `anchor` | anchor | 명사 | 닻, 뉴스 진행자 | 쇠사슬에 달린 닻 | The ship dropped its anchor near the island. | 완료 |
| `angle` | angle | 명사 | 각도, 관점 | 두 선이 만나 이루는 각과 그 사이의 둥근 호(숫자 없이) | Look at the problem from a different angle. | 완료 |
| `arrow` | arrow | 명사 | 화살, 화살표 | 오른쪽을 가리키는 굵은 화살표 | Follow the arrows to the exit. | 완료 |
| `atom` | atom | 명사 | 원자 | 가운데 핵 둘레를 작은 알갱이들이 궤도를 그리며 도는 원자 모형 | Everything is made of atoms. | 완료 |
| `blossom` | blossom | 명사 | 꽃 | 가지에 가득 핀 분홍 벚꽃 | Cherry blossoms are beautiful in spring. | 완료 |
| `bull` | bull | 명사 | 황소 | 뿔이 있는 튼튼한 황소 | A bull was standing in the field. | 완료 |
| `bundle` | bundle | 명사 | 묶음, 꾸러미 | 끈으로 묶은 나뭇가지 한 다발 | He carried a bundle of sticks. | 완료 |
| `canvas` | canvas | 명사 | 캔버스, 화폭 | 이젤 위에 놓인 빈 캔버스와 붓 | She painted flowers on the canvas. | 완료 |
| `cattle` | cattle | 명사 | 소(떼) | 풀을 뜯는 소 세 마리 | Cattle were grazing in the field. | 완료 |
| `cave` | cave | 명사 | 동굴 | 산기슭의 어두운 동굴 입구 | Bats live in the dark cave. | 완료 |
| `celebrate` | celebrate | 동사 | 축하하다, 기념하다 | 아이들이 고깔모자를 쓰고 케이크 앞에서 박수치는 장면 | We celebrated her birthday with a cake. | 완료 |
| `choir` | choir | 명사 | 합창단 | 아이들이 줄지어 서서 악보를 들고 노래하는 장면 | She sings in the school choir. | 완료 |
| `collar` | collar | 명사 | 옷깃, 목걸이(동물) | 방울이 달린 빨간 강아지 목걸이 | The dog wears a red collar. | 완료 |
| `column` | column | 명사 | 기둥, 칼럼, 세로줄 | 돌로 된 둥근 기둥 세 개 | Add the numbers in the first column. | 완료 |
| `construct` | construct | 동사 | 건설하다 | 크레인과 짓고 있는 건물이 있는 공사장 | They are constructing a new bridge. | 완료 |
| `continent` | continent | 명사 | 대륙 | 바다 위에 대륙들이 보이는 지구본(글자 없이) | Asia is the largest continent. | 완료 |
| `core` | core | 명사 | 핵심, 속 | 먹고 남은 사과 속(심) | The core of the problem is money. | 완료 |
| `corridor` | corridor | 명사 | 복도 | 양쪽에 문이 늘어선 긴 복도 | Do not run in the corridor. | 완료 |
| `crop` | crop | 명사 | 농작물 | 누렇게 익은 벼가 가득한 논 | Rice is the main crop in this area. | 완료 |
| `cruise` | cruise | 명사 | 유람선 여행 | 바다 위의 큰 유람선 | They went on a cruise around the islands. | 완료 |
| `crystal` | crystal | 명사 | 수정, 결정 | 반짝이는 뾰족한 수정 결정 | The glass is as clear as crystal. | 완료 |
| `dairy` | dairy | 명사 | 유제품, 낙농 | 우유·치즈·요거트가 함께 놓인 모습 | Milk and cheese are dairy products. | 완료 |
| `decrease` | decrease | 동사 | 줄다, 줄이다 | 오른쪽 아래로 내려가는 막대들과 아래쪽 화살표 | The temperature decreased at night. | 완료 |
| `drill` | drill | 명사 | 드릴, 반복 훈련 | 전동 드릴 한 개 | We had a fire drill at school today. | 완료 |
| `emergency` | emergency | 명사 | 비상사태, 응급 | 사이렌이 켜진 구급차 | Call 119 in an emergency. | 완료 |
| `erase` | erase | 동사 | 지우다 | 아이가 지우개로 공책의 글씨를 지우는 장면(글자 없이) | Erase the mistake and write it again. | 완료 |
| `explode` | explode | 동사 | 폭발하다 | 밤하늘에 터지는 불꽃놀이 폭죽 | The fireworks exploded in the sky. | 완료 |
| `explore` | explore | 동사 | 탐험하다, 탐구하다 | 탐험 모자를 쓴 아이가 손전등으로 동굴 안을 비추는 장면 | We explored the cave with a guide. | 완료 |
| `fasten` | fasten | 동사 | 매다, 채우다 | 아이가 자동차 좌석에서 안전벨트를 매는 장면 | Please fasten your seat belt. | 완료 |
| `flock` | flock | 명사 | (새·양의) 떼 | 하늘을 줄지어 나는 새 떼 | A flock of birds flew over the lake. | 완료 |
| `fountain` | fountain | 명사 | 분수 | 물이 솟아오르는 둥근 분수 | Children played around the fountain. | 완료 |
| `fraction` | fraction | 명사 | 분수, 일부 | 여러 조각 중 한 조각만 색칠된 원(숫자 없이) | One half is a simple fraction. | 완료 |
| `frown` | frown | 동사 | 얼굴을 찡그리다 | 아이가 눈썹을 찌푸리고 입을 삐죽 내민 얼굴 | He frowned at the bad news. | 완료 |
| `gallery` | gallery | 명사 | 미술관, 화랑 | 벽에 그림 액자가 줄지어 걸린 미술관 안 | We saw her paintings at the gallery. | 완료 |
| `globe` | globe | 명사 | 지구본, 세계 | 받침대 위의 지구본(글자 없이) | Find Korea on the globe. | 완료 |
| `graduate` | graduate | 동사 | 졸업하다 | 학사모를 쓰고 졸업장을 든 학생 | She graduated from high school last year. | 완료 |
| `grain` | grain | 명사 | 곡물, 낟알 | 자루에 담긴 곡식 낟알과 이삭 | Rice and wheat are grains. | 완료 |
| `hammer` | hammer | 명사 | 망치 | 나무 손잡이 망치 | Hit the nail with a hammer. | 완료 |
| `harbor` | harbor | 명사 | 항구 | 작은 어선들이 정박한 항구 | Fishing boats returned to the harbor. | 완료 |
| `harvest` | harvest | 명사 | 수확 | 농부가 바구니에 잘 익은 과일을 따 담는 장면 | Farmers are busy during the harvest. | 완료 |
| `hook` | hook | 명사 | 갈고리, 걸이 | 벽에 달린 옷걸이 고리와 걸린 모자 | Hang your coat on the hook. | 완료 |
| `horizon` | horizon | 명사 | 수평선, 지평선 | 바다 수평선에 걸린 해 | The sun sank below the horizon. | 완료 |
| `hut` | hut | 명사 | 오두막 | 나무로 지은 작은 오두막 | They rested in a hut on the mountain. | 완료 |
| `ingredient` | ingredient | 명사 | 재료, 성분 | 밀가루·달걀·버터·우유가 조리대에 놓인 모습 | Flour is the main ingredient of bread. | 완료 |
| `insect` | insect | 명사 | 곤충 | 개미·나비·잠자리가 함께 있는 모습 | An ant is a small insect. | 완료 |
| `jar` | jar | 명사 | 병, 단지 | 뚜껑이 있는 유리병에 든 딸기잼 | There is jam in the jar. | 완료 |
| `jog` | jog | 동사 | 조깅하다 | 운동복을 입은 아이가 공원 길을 가볍게 달리는 장면 | I jog in the park every morning. | 완료 |
| `kit` | kit | 명사 | 도구 세트 | 십자 표시가 있는 구급상자와 붕대(글자 없이) | Bring a first aid kit on the trip. | 완료 |
| `knight` | knight | 명사 | 기사 | 갑옷을 입고 방패를 든 기사 | The knight rode a white horse. | 완료 |
| `knot` | knot | 명사 | 매듭 | 밧줄에 묶인 매듭 | Tie a knot at the end of the rope. | 완료 |
| `ladder` | ladder | 명사 | 사다리 | 벽에 기대어 세운 나무 사다리 | He climbed the ladder to fix the roof. | 완료 |
| `landscape` | landscape | 명사 | 풍경 | 산과 강이 어우러진 넓은 풍경 | The landscape was covered with snow. | 완료 |
| `launch` | launch | 동사 | 발사하다, 시작하다 | 불꽃을 내뿜으며 발사되는 로켓 | The rocket was launched into space. | 완료 |
| `laundry` | laundry | 명사 | 빨래, 세탁물 | 빨랫줄에 널린 옷과 빨래 바구니 | I do the laundry on Sundays. | 완료 |
| `mechanic` | mechanic | 명사 | 정비사 | 작업복을 입은 정비사가 스패너로 자동차를 고치는 장면 | The mechanic fixed our car. | 완료 |
| `monster` | monster | 명사 | 괴물 | 뿔이 있고 털이 복슬복슬한 귀여운 괴물 | The child was afraid of the monster in the story. | 완료 |
| `monument` | monument | 명사 | 기념비, 기념물 | 광장 한가운데 높이 선 돌 기념탑 | A monument stands in the center of the square. | 완료 |
| `needle` | needle | 명사 | 바늘 | 실이 꿰어진 바늘 | Grandma passed thread through the needle. | 완료 |
| `novel` | novel | 명사 | 소설 | 표지가 덮인 두꺼운 책 한 권(글자 없이) | I am reading a novel by a Korean writer. | 완료 |
| `orbit` | orbit | 명사 | 궤도 | 지구 둘레에 타원 궤도가 그려지고 그 위에 작은 위성이 있는 모습 | The satellite is in orbit around the earth. | 완료 |
| `overlap` | overlap | 동사 | 겹치다 | 두 원이 가운데에서 겹쳐진 모습 | The two circles overlap in the middle. | 완료 |
| `palm` | palm | 명사 | 손바닥, 야자나무 | 쫙 편 손바닥 | He held the coin in his palm. | 완료 |
| `parallel` | parallel | 형용사 | 평행한 | 나란히 뻗은 두 직선 | The two roads are parallel. | 완료 |
| `passport` | passport | 명사 | 여권 | 표지에 무늬만 있는 여권 한 권(글자 없이) | Do not forget your passport. | 완료 |
| `pat` | pat | 동사 | 쓰다듬다, 토닥이다 | 아이가 강아지 머리를 쓰다듬는 장면 | She patted the dog on the head. | 완료 |
| `peak` | peak | 명사 | 봉우리, 절정 | 눈 덮인 뾰족한 산봉우리 | We reached the peak of the mountain at noon. | 완료 |
| `peel` | peel | 동사 | 껍질을 벗기다 | 아이가 귤껍질을 벗기는 장면 | Peel the orange before you eat it. | 완료 |
| `pill` | pill | 명사 | 알약 | 약통과 알약 몇 알 | Take one pill after each meal. | 완료 |
| `platform` | platform | 명사 | 승강장, 단, 플랫폼 | 기차가 서 있는 역 승강장(글자·숫자 없이) | The train leaves from platform two. | 완료 |
| `portrait` | portrait | 명사 | 초상화 | 액자에 든 인물 초상화 | A portrait of the king hangs on the wall. | 완료 |
| `praise` | praise | 동사 | 칭찬하다 | 선생님이 아이에게 엄지를 들어 보이며 칭찬하는 장면 | The teacher praised her for her hard work. | 완료 |
| `rescue` | rescue | 동사 | 구조하다 | 소방관이 나무 위의 고양이를 안아 내려오는 장면 | Firefighters rescued the cat from the tree. | 완료 |
| `roar` | roar | 동사 | 으르렁거리다, 포효하다 | 입을 크게 벌리고 포효하는 사자 | The lion roared loudly. | 완료 |
| `rod` | rod | 명사 | 막대, 낚싯대 | 물고기가 걸린 낚싯대 | He caught a fish with his new rod. | 완료 |
| `sack` | sack | 명사 | 자루 | 감자가 가득 든 자루 | He carried a sack of potatoes. | 완료 |
| `screw` | screw | 명사 | 나사 | 나사못과 드라이버 | Tighten the screw with a screwdriver. | 완료 |
| `sculpture` | sculpture | 명사 | 조각품 | 받침대 위에 놓인 돌 조각상 | There is a stone sculpture in the garden. | 완료 |
| `slice` | slice | 명사 | 얇은 조각 | 접시 위의 피자 한 조각 | I ate a slice of pizza. | 완료 |
| `slope` | slope | 명사 | 경사, 비탈 | 눈 덮인 비탈과 썰매 | The children slid down the snowy slope. | 완료 |
| `sphere` | sphere | 명사 | 구, 영역 | 매끈한 공 모양의 구 | The earth is a sphere. | 완료 |
| `spill` | spill | 동사 | 쏟다, 엎지르다 | 넘어진 컵에서 우유가 쏟아진 모습 | I spilled milk on the table. | 완료 |
| `splash` | splash | 동사 | 첨벙거리다, 튀기다 | 아이가 물웅덩이에서 첨벙 뛰어 물이 튀는 장면 | The children splashed in the pool. | 완료 |
| `squeeze` | squeeze | 동사 | 짜다, 꽉 쥐다 | 손으로 레몬을 짜서 즙이 떨어지는 장면 | Squeeze the lemon over the fish. | 완료 |
| `stack` | stack | 명사 | 쌓아 올린 더미 | 차곡차곡 쌓인 접시 | There is a stack of plates on the table. | 완료 |
| `statue` | statue | 명사 | 동상, 조각상 | 받침대 위에 서 있는 동상 | There is a statue of a general in the park. | 완료 |
| `stem` | stem | 명사 | 줄기 | 긴 줄기에 잎이 달린 꽃 한 송이 | The flower has a long green stem. | 완료 |
| `stripe` | stripe | 명사 | 줄무늬 | 줄무늬 티셔츠 한 벌 | A zebra has black and white stripes. | 완료 |
| `submarine` | submarine | 명사 | 잠수함 | 바닷속을 가는 노란 잠수함 | The submarine dived deep under the sea. | 완료 |
| `sweat` | sweat | 명사 | 땀 | 운동한 아이가 수건으로 이마의 땀을 닦는 장면 | He wiped the sweat from his face. | 완료 |
| `symbol` | symbol | 명사 | 상징, 기호 | 올리브 가지를 문 흰 비둘기 | A dove is a symbol of peace. | 완료 |
| `tag` | tag | 명사 | 꼬리표, 태그 | 끈이 달린 빈 가격표(글자·숫자 없이) | Check the price tag before you buy it. | 완료 |
| `terrace` | terrace | 명사 | 테라스 | 탁자와 의자가 놓인 집 테라스 | We had coffee on the terrace. | 완료 |
| `thread` | thread | 명사 | 실 | 색색의 실패 몇 개 | I need a needle and thread. | 완료 |
| `timber` | timber | 명사 | 목재 | 차곡차곡 쌓인 목재 널빤지 | The house is built of timber. | 완료 |
| `tissue` | tissue | 명사 | 화장지, (세포) 조직 | 휴지가 한 장 뽑혀 나온 티슈 상자 | Can you pass me a tissue? | 완료 |
| `treasure` | treasure | 명사 | 보물 | 금화와 보석이 가득한 보물 상자 | The pirates buried their treasure on the island. | 완료 |
| `tube` | tube | 명사 | 관, 튜브 | 치약이 조금 나온 치약 튜브 | Squeeze the toothpaste from the tube. | 완료 |
| `tunnel` | tunnel | 명사 | 터널 | 산을 뚫고 지나가는 터널 입구와 기찻길 | The train went through a long tunnel. | 완료 |
| `vaccine` | vaccine | 명사 | 백신 | 주사기와 작은 약병 | The vaccine protects children from the disease. | 완료 |
| `vacuum` | vacuum | 명사 | 진공, 진공청소기 | 진공청소기 한 대 | I cleaned the carpet with a vacuum cleaner. | 완료 |
| `vertical` | vertical | 형용사 | 수직의, 세로의 | 위아래로 곧게 그어진 세로선과 위아래 화살표 | Draw a vertical line on the paper. | 완료 |
| `victory` | victory | 명사 | 승리 | 선수들이 트로피를 들고 환호하는 장면 | The team celebrated their victory. | 완료 |
| `warehouse` | warehouse | 명사 | 창고 | 상자가 높이 쌓인 큰 창고 안 | The boxes are stored in a warehouse. | 완료 |
| `wheat` | wheat | 명사 | 밀 | 누렇게 익은 밀 이삭 다발 | Bread is made from wheat. | 완료 |

## 3. 초등 추상어 (17장, 남은 0장)

초등 단어라 가장 쉽고 귀엽게.

| id | 단어 | 품사 | 뜻 | 장면(비어 있으면 참고 문장을 그대로 한 장면으로) | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|---|
| `already` | already | 부사 | 이미, 벌써 |  | I already ate lunch. | 완료 |
| `also` | also | 부사 | 또한, ~도 |  | I like cats. I also like dogs. | 완료 |
| `believe` | believe | 동사 | 믿다 |  | I believe you. | 완료 |
| `certain` | certain | 형용사 | 확실한 |  | I am certain he will come. | 완료 |
| `condition` | condition | 명사 | 상태, 조건 |  | The car is in good condition. | 완료 |
| `could` | could | 조동사 | ~할 수 있었다 |  | I could swim when I was five. | 완료 |
| `culture` | culture | 명사 | 문화 |  | I want to learn about Korean culture. | 완료 |
| `during` | during | 전치사 | ~ 동안 |  | I slept during the movie. | 완료 |
| `form` | form | 명사 | 모양, 형태, 서식 |  | Ice is a form of water. | 완료 |
| `however` | however | 부사 | 그러나 |  | It was cold. However, we went out. | 완료 |
| `issue` | issue | 명사 | 문제, 쟁점 |  | Pollution is a big issue. | 완료 |
| `might` | might | 조동사 | ~일지도 모른다 |  | It might rain today. | 완료 |
| `mind` | mind | 명사 | 마음, 생각 |  | Keep it in mind. | 완료 |
| `should` | should | 조동사 | ~해야 한다 |  | You should wash your hands. | 완료 |
| `twenty-first` | twenty-first | 형용사 | 스물한 번째의 |  | Today is the twenty-first of May. | 완료 |
| `twenty-second` | twenty-second | 형용사 | 스물두 번째의 |  | My birthday is on the twenty-second. | 완료 |
| `twenty-third` | twenty-third | 형용사 | 스물세 번째의 |  | We will meet on the twenty-third. | 완료 |

## 4. 숙어·표현 (67장, 남은 0장)

표현을 쓰는 상황을 아이들 장면으로.

| id | 단어 | 품사 | 뜻 | 장면(비어 있으면 참고 문장을 그대로 한 장면으로) | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|---|
| `turn-on` | turn on | 숙어 | (전원을) 켜다 |  | Turn on the light. | 완료 |
| `turn-off` | turn off | 숙어 | (전원을) 끄다 |  | Turn off the TV. | 완료 |
| `how-many` | how many | 표현 | 몇 개 |  | How many apples do you have? | 완료 |
| `how-much` | how much | 표현 | 얼마, 얼마나 많이 |  | How much is it? | 완료 |
| `how-old` | how old | 표현 | 몇 살 |  | How old are you? | 완료 |
| `how-long` | how long | 표현 | 얼마나 오래, 얼마나 긴 |  | How long is the river? | 완료 |
| `how-often` | how often | 표현 | 얼마나 자주 |  | How often do you exercise? | 완료 |
| `what-time` | what time | 표현 | 몇 시 |  | What time is it? | 완료 |
| `what-color` | what color | 표현 | 무슨 색 |  | What color is your bag? | 완료 |
| `what-kind` | what kind | 표현 | 어떤 종류 |  | What kind of food do you like? | 완료 |
| `wake-up` | wake up | 숙어 | 잠에서 깨다 |  | I wake up at seven. | 완료 |
| `get-up` | get up | 숙어 | 일어나다 |  | I get up at seven. | 완료 |
| `wash-my-face` | wash my face | 숙어 | 세수하다 |  | I wash my face in the morning. | 완료 |
| `brush-my-teeth` | brush my teeth | 숙어 | 이를 닦다 |  | I brush my teeth after meals. | 완료 |
| `take-a-shower` | take a shower | 숙어 | 샤워하다 |  | I take a shower every day. | 완료 |
| `get-dressed` | get dressed | 숙어 | 옷을 입다 |  | I get dressed for school. | 완료 |
| `eat-breakfast` | eat breakfast | 숙어 | 아침을 먹다 |  | I eat breakfast at eight. | 완료 |
| `eat-lunch` | eat lunch | 숙어 | 점심을 먹다 |  | I eat lunch at school. | 완료 |
| `eat-dinner` | eat dinner | 숙어 | 저녁을 먹다 |  | We eat dinner together. | 완료 |
| `go-to-school` | go to school | 숙어 | 학교에 가다 |  | I go to school by bus. | 완료 |
| `come-home` | come home | 숙어 | 집에 오다 |  | I come home at four. | 완료 |
| `do-homework` | do homework | 숙어 | 숙제를 하다 |  | I do homework after school. | 완료 |
| `watch-tv` | watch TV | 숙어 | TV를 보다 |  | I watch TV after dinner. | 완료 |
| `read-a-book` | read a book | 숙어 | 책을 읽다 |  | I read a book before bed. | 완료 |
| `take-a-bath` | take a bath | 숙어 | 목욕하다 |  | I take a bath at night. | 완료 |
| `go-to-bed` | go to bed | 숙어 | 잠자리에 들다 |  | I go to bed at nine. | 완료 |
| `open-your-book` | open your book | 표현 | 책을 펴세요 |  | Open your book to page ten. | 완료 |
| `close-your-book` | close your book | 표현 | 책을 덮으세요 |  | Close your book, please. | 완료 |
| `raise-your-hand` | raise your hand | 표현 | 손을 드세요 |  | Raise your hand, please. | 완료 |
| `sit-down` | sit down | 표현 | 앉으세요 |  | Sit down, please. | 완료 |
| `stand-up` | stand up | 표현 | 일어서세요 |  | Stand up, please. | 완료 |
| `be-quiet` | be quiet | 표현 | 조용히 하세요 |  | Be quiet, please. | 완료 |
| `work-together` | work together | 표현 | 함께 활동하세요 |  | Let us work together. | 완료 |
| `make-a-group` | make a group | 표현 | 모둠을 만드세요 |  | Make a group of four. | 완료 |
| `take-turns` | take turns | 표현 | 차례를 지키다 |  | Take turns, please. | 완료 |
| `try-again` | try again | 표현 | 다시 해 보세요 |  | Try again! | 완료 |
| `good-job` | good job | 표현 | 잘했어요 |  | Good job! | 완료 |
| `well-done` | well done | 표현 | 참 잘했어요 |  | Well done! | 완료 |
| `are-you-ready` | are you ready? | 표현 | 준비됐나요? |  | Are you ready? | 완료 |
| `let-s-start` | let's start | 표현 | 시작하자 |  | Let's start the game. | 완료 |
| `hello` | hello | 표현 | 안녕하세요 |  | Hello, Mina! | 완료 |
| `hi` | hi | 표현 | 안녕 |  | Hi, Tom! | 완료 |
| `goodbye` | goodbye | 표현 | 안녕히 가세요 |  | Goodbye, see you! | 완료 |
| `please` | please | 표현 | 제발, 부탁합니다 |  | Help me, please. | 완료 |
| `thank-you` | thank you | 표현 | 고맙습니다 |  | Thank you very much. | 완료 |
| `sorry` | sorry | 표현 | 미안해요 |  | I am sorry. | 완료 |
| `excuse-me` | excuse me | 표현 | 실례합니다 |  | Excuse me, where is the library? | 완료 |
| `you-re-welcome` | you're welcome | 표현 | 천만에요 |  | You're welcome. | 완료 |
| `that-s-okay` | that's okay | 표현 | 괜찮아요 |  | That's okay. | 완료 |
| `yes` | yes | 표현 | 네 |  | Yes, I do. | 완료 |
| `no` | no | 표현 | 아니요 |  | No, I do not. | 완료 |
| `maybe` | maybe | 표현 | 아마도 |  | Maybe I can go. | 완료 |
| `really` | really | 표현 | 정말요? |  | Really? | 완료 |
| `sure` | sure | 표현 | 물론이죠 |  | Sure! | 완료 |
| `okay` | okay | 표현 | 좋아요, 알겠어요 |  | Okay, let us go. | 완료 |
| `of-course` | of course | 표현 | 물론이죠 |  | Of course you can. | 완료 |
| `great` | great | 표현 | 아주 좋아요 |  | Great! | 완료 |
| `wow` | wow | 표현 | 와! |  | Wow, it is big! | 완료 |
| `i-think` | I think | 표현 | 내 생각에는 |  | I think it is good. | 완료 |
| `i-know` | I know | 표현 | 알아요 |  | I know the answer. | 완료 |
| `i-don-t-know` | I don't know | 표현 | 모르겠어요 |  | I don't know. | 완료 |
| `i-agree` | I agree | 표현 | 동의해요 |  | I agree with you. | 완료 |
| `i-don-t-agree` | I don't agree | 표현 | 동의하지 않아요 |  | I don't agree. | 완료 |
| `me-too` | me too | 표현 | 나도요 |  | Me too! | 완료 |
| `not-me` | not me | 표현 | 난 아니에요 |  | Not me! | 완료 |
| `let-s-go` | let's go | 표현 | 가자 |  | Let's go to the park. | 완료 |
| `come-on` | come on | 표현 | 어서, 힘내 |  | Come on, let us play. | 완료 |

## 5. 중학 추상어 (Lv.5) (730장, 남은 1장)

| id | 단어 | 품사 | 뜻 | 장면(비어 있으면 참고 문장을 그대로 한 장면으로) | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|---|
| `able` | able | 형용사 | ~할 수 있는 |  | She is able to speak three languages. | 완료 |
| `absolute` | absolute | 형용사 | 완전한, 절대적인 |  | I have absolute trust in you. | 완료 |
| `accent` | accent | 명사 | 말씨, 억양 |  | He speaks English with a French accent. | 완료 |
| `access` | access | 명사 | 접근, 이용 |  | Students have access to the library. | 완료 |
| `accuse` | accuse | 동사 | 비난하다, 고발하다 |  | They accused him of lying. | 완료 |
| `adapt` | adapt | 동사 | 적응하다 |  | Animals adapt to cold weather. | 완료 |
| `admire` | admire | 동사 | 존경하다, 감탄하다 |  | I admire my grandfather. | 완료 |
| `admit` | admit | 동사 | 인정하다, 입장을 허락하다 |  | He admitted his mistake. | 완료 |
| `advance` | advance | 동사 | 나아가다, 발전하다 |  | Science advances every year. | 완료 |
| `advantage` | advantage | 명사 | 유리한 점, 장점 |  | Being tall is an advantage in basketball. | 완료 |
| `advertise` | advertise | 동사 | 광고하다 |  | They advertise the new phone on TV. | 완료 |
| `advice` | advice | 명사 | 조언, 충고 |  | Can you give me some advice? | 완료 |
| `advise` | advise | 동사 | 조언하다 |  | The doctor advised me to rest. | 완료 |
| `affair` | affair | 명사 | 일, 사건 |  | It is a private affair. | 완료 |
| `affect` | affect | 동사 | 영향을 주다 |  | Weather can affect your mood. | 완료 |
| `afford` | afford | 동사 | ~할 여유가 있다 |  | I cannot afford a new bike. | 완료 |
| `agent` | agent | 명사 | 대리인, 요원 |  | A travel agent booked our tickets. | 완료 |
| `aid` | aid | 명사 | 도움, 원조 |  | They sent food aid to the village. | 완료 |
| `airline` | airline | 명사 | 항공사 |  | Which airline are you flying with? | 완료 |
| `alcohol` | alcohol | 명사 | 술, 알코올 | 뚜껑 닫힌 병과 빈 유리잔(라벨 글자 없이, 사람 없이) | Alcohol is bad for your health. | 완료 |
| `alive` | alive | 형용사 | 살아 있는 |  | The fish is still alive. | 완료 |
| `allow` | allow | 동사 | 허락하다 |  | My parents allow me to stay up late. | 완료 |
| `alter` | alter | 동사 | 바꾸다, 고치다 |  | We had to alter our plans. | 완료 |
| `although` | although | 접속사 | 비록 ~이지만 |  | Although it rained, we went out. | 완료 |
| `altogether` | altogether | 부사 | 모두 합쳐, 완전히 |  | There are ten of us altogether. | 완료 |
| `amaze` | amaze | 동사 | 놀라게 하다 |  | The magic trick amazed everyone. | 완료 |
| `amount` | amount | 명사 | 양, 액수 |  | A small amount of salt is enough. | 완료 |
| `amuse` | amuse | 동사 | 즐겁게 하다 |  | The clown amused the children. | 완료 |
| `analysis` | analysis | 명사 | 분석 |  | The analysis of the data took a week. | 완료 |
| `anger` | anger | 명사 | 화, 분노 |  | He shouted in anger. | 완료 |
| `announce` | announce | 동사 | 발표하다, 알리다 |  | The teacher announced the test date. | 완료 |
| `annoy` | annoy | 동사 | 짜증 나게 하다 |  | The noise annoys me. | 완료 |
| `annual` | annual | 형용사 | 해마다의 |  | Our school has an annual festival. | 완료 |
| `anxious` | anxious | 형용사 | 걱정하는, 불안한 |  | I feel anxious before a test. | 완료 |
| `apart` | apart | 부사 | 떨어져 |  | The two houses are far apart. | 완료 |
| `appeal` | appeal | 동사 | 호소하다, 마음을 끌다 |  | The idea appeals to me. | 완료 |
| `appear` | appear | 동사 | 나타나다, ~처럼 보이다 |  | A rainbow appeared in the sky. | 완료 |
| `apply` | apply | 동사 | 지원하다, 적용하다 |  | She applied for the job. | 완료 |
| `appoint` | appoint | 동사 | 임명하다, 정하다 |  | They appointed her class leader. | 완료 |
| `appreciate` | appreciate | 동사 | 고마워하다, 진가를 알다 |  | I really appreciate your help. | 완료 |
| `approach` | approach | 동사 | 다가가다 |  | The cat approached the bird slowly. | 완료 |
| `appropriate` | appropriate | 형용사 | 알맞은 |  | Wear appropriate clothes for hiking. | 완료 |
| `argue` | argue | 동사 | 말다툼하다, 주장하다 |  | They argue about small things. | 완료 |
| `army` | army | 명사 | 군대 |  | His brother joined the army. | 완료 |
| `arrest` | arrest | 동사 | 체포하다 |  | The police arrested the thief. | 완료 |
| `article` | article | 명사 | 기사, 글 |  | I read an article about space. | 완료 |
| `aside` | aside | 부사 | 옆으로, 따로 |  | She put her phone aside. | 완료 |
| `assess` | assess | 동사 | 평가하다 |  | Teachers assess students fairly. | 완료 |
| `assign` | assign | 동사 | 맡기다, 배정하다 |  | The teacher assigned us homework. | 완료 |
| `assist` | assist | 동사 | 돕다 |  | A nurse assists the doctor. | 완료 |
| `associate` | associate | 동사 | 연관 짓다 |  | I associate summer with the beach. | 완료 |
| `assume` | assume | 동사 | 가정하다, 짐작하다 |  | I assume you are hungry. | 완료 |
| `atmosphere` | atmosphere | 명사 | 분위기, 대기 |  | The cafe has a warm atmosphere. | 완료 |
| `attack` | attack | 동사 | 공격하다 |  | The dog did not attack anyone. | 완료 |
| `attempt` | attempt | 명사 | 시도 |  | He passed on his second attempt. | 완료 |
| `attend` | attend | 동사 | 참석하다, 다니다 |  | I attend a middle school. | 완료 |
| `attention` | attention | 명사 | 주의, 관심 |  | Pay attention to the teacher. | 완료 |
| `attitude` | attitude | 명사 | 태도 |  | She has a positive attitude. | 완료 |
| `attract` | attract | 동사 | 끌다, 마음을 끌다 |  | Flowers attract bees. | 완료 |
| `automatic` | automatic | 형용사 | 자동의 |  | This is an automatic door. | 완료 |
| `average` | average | 명사 | 평균 |  | My average score is eighty. | 완료 |
| `avoid` | avoid | 동사 | 피하다 |  | Try to avoid junk food. | 완료 |
| `awake` | awake | 형용사 | 깨어 있는 |  | I was awake all night. | 완료 |
| `aware` | aware | 형용사 | 알고 있는 |  | Are you aware of the danger? | 완료 |
| `awkward` | awkward | 형용사 | 어색한, 서투른 |  | There was an awkward silence. | 완료 |
| `background` | background | 명사 | 배경 |  | The photo has a blue background. | 완료 |
| `bang` | bang | 명사 | 쾅 하는 소리 |  | The door closed with a bang. | 완료 |
| `bare` | bare | 형용사 | 벌거벗은, 맨 | 모래밭 위 맨발 두 개 | He walked on the sand with bare feet. | 완료 |
| `basis` | basis | 명사 | 기초, 근거 |  | Trust is the basis of friendship. | 완료 |
| `battle` | battle | 명사 | 전투 |  | The battle lasted three days. | 완료 |
| `beer` | beer | 명사 | 맥주 |  | Beer is a drink for adults. | 완료 |
| `beg` | beg | 동사 | 간청하다, 구걸하다 |  | The dog begged for food. | 완료 |
| `belief` | belief | 명사 | 믿음 |  | It is my belief that he is honest. | 완료 |
| `belong` | belong | 동사 | ~에 속하다 |  | This bag belongs to me. | 완료 |
| `beneath` | beneath | 전치사 | ~의 아래에 |  | The cat hid beneath the table. | 완료 |
| `benefit` | benefit | 명사 | 이익, 혜택 |  | Exercise has many benefits. | 완료 |
| `bet` | bet | 동사 | 내기하다, 장담하다 |  | I bet you will like this movie. | 완료 |
| `beyond` | beyond | 전치사 | ~너머에 |  | The village is beyond the hill. | 완료 |
| `billion` | billion | 수사 | 10억 |  | There are billions of stars. | 완료 |
| `bind` | bind | 동사 | 묶다 |  | Bind the sticks with a rope. | 완료 |
| `bit` | bit | 명사 | 조금, 작은 조각 |  | I am a bit tired. | 완료 |
| `blame` | blame | 동사 | 탓하다 |  | Don't blame others for your mistake. | 완료 |
| `bless` | bless | 동사 | 축복하다 |  | May God bless you. | 완료 |
| `blind` | blind | 형용사 | 눈이 먼, 보이지 않는 |  | The dog helps the blind man. | 완료 |
| `bomb` | bomb | 명사 | 폭탄 | 만화처럼 둥근 검은 폭탄과 짧은 심지(터지지 않은 모습, 사람 없이) | The bomb did not go off. | 완료 |
| `bond` | bond | 명사 | 유대, 끈 |  | There is a strong bond between them. | 완료 |
| `boom` | boom | 명사 | 쿵 소리, 급성장 |  | We heard a loud boom. | 완료 |
| `bore` | bore | 동사 | 지루하게 하다 |  | Long speeches bore me. | 완료 |
| `boss` | boss | 명사 | 상사, 사장 |  | My boss is very kind. | 완료 |
| `bother` | bother | 동사 | 괴롭히다, 귀찮게 하다 |  | Don't bother your sister. | 완료 |
| `brand` | brand | 명사 | 상표, 브랜드 |  | This is my favorite brand of shoes. | 완료 |
| `breast` | breast | 명사 | 가슴 |  | I ate chicken breast for lunch. | 완료 |
| `breath` | breath | 명사 | 숨 |  | Take a deep breath. | 완료 |
| `breathe` | breathe | 동사 | 숨 쉬다 |  | Fish breathe under water. | 완료 |
| `brief` | brief | 형용사 | 짧은, 간단한 |  | He gave a brief answer. | 완료 |
| `brilliant` | brilliant | 형용사 | 훌륭한, 눈부신 |  | That is a brilliant idea! | 완료 |
| `broad` | broad | 형용사 | 넓은 |  | He has broad shoulders. | 완료 |
| `budget` | budget | 명사 | 예산 |  | We have a small budget for the trip. | 완료 |
| `bump` | bump | 동사 | 부딪치다 |  | I bumped my head on the door. | 완료 |
| `calculate` | calculate | 동사 | 계산하다 |  | Calculate the total price. | 완료 |
| `capable` | capable | 형용사 | ~할 능력이 있는 |  | She is capable of doing it alone. | 완료 |
| `career` | career | 명사 | 직업, 경력 |  | She wants a career in music. | 완료 |
| `cast` | cast | 동사 | 던지다, 배역을 맡기다 |  | He cast his fishing line into the lake. | 완료 |
| `catalog` | catalog | 명사 | 목록, 카탈로그 |  | I looked at the toy catalog. | 완료 |
| `category` | category | 명사 | 범주, 종류 |  | Put the words into three categories. | 완료 |
| `cause` | cause | 명사 | 원인 |  | What was the cause of the fire? | 완료 |
| `cell` | cell | 명사 | 세포, 작은 방 |  | Our bodies are made of cells. | 완료 |
| `century` | century | 명사 | 100년, 세기 |  | We live in the twenty-first century. | 완료 |
| `chairman` | chairman | 명사 | 의장, 회장 |  | The chairman opened the meeting. | 완료 |
| `challenge` | challenge | 명사 | 도전 |  | Climbing the mountain was a big challenge. | 완료 |
| `channel` | channel | 명사 | 채널, 수로 |  | Change the TV channel, please. | 완료 |
| `characteristic` | characteristic | 명사 | 특징 |  | Kindness is her best characteristic. | 완료 |
| `charm` | charm | 명사 | 매력 |  | The old town has a lot of charm. | 완료 |
| `chat` | chat | 동사 | 수다 떨다 |  | We chat online every night. | 완료 |
| `chew` | chew | 동사 | 씹다 |  | Chew your food well. | 완료 |
| `chief` | chief | 형용사 | 주된, 최고의 |  | Rice is our chief food. | 완료 |
| `choice` | choice | 명사 | 선택 |  | You made a good choice. | 완료 |
| `cigarette` | cigarette | 명사 | 담배 | 담배 한 개비 위에 빨간 금지 사선이 그어진 둥근 표지(글자 없이) | Cigarettes are harmful to your body. | 완료 |
| `circumstance` | circumstance | 명사 | 상황, 환경 |  | Under the circumstances, we had to wait. | 완료 |
| `citizen` | citizen | 명사 | 시민 |  | Every citizen has the right to vote. | 완료 |
| `civil` | civil | 형용사 | 시민의 |  | They fought for civil rights. | 완료 |
| `claim` | claim | 동사 | 주장하다 |  | He claims that he saw a ghost. | 완료 |
| `client` | client | 명사 | 고객, 의뢰인 |  | The lawyer met her client. | 완료 |
| `climate` | climate | 명사 | 기후 |  | The climate here is warm and dry. | 완료 |
| `code` | code | 명사 | 암호, 코드 |  | Enter the secret code. | 완료 |
| `combine` | combine | 동사 | 결합하다, 섞다 |  | Combine the flour and eggs. | 완료 |
| `comedy` | comedy | 명사 | 코미디 |  | I like watching comedy shows. | 완료 |
| `comfort` | comfort | 명사 | 편안함, 위로 |  | She gave me comfort when I was sad. | 완료 |
| `command` | command | 명사 | 명령 |  | The dog follows my commands. | 완료 |
| `comment` | comment | 명사 | 의견, 댓글 |  | He left a kind comment on my post. | 완료 |
| `commerce` | commerce | 명사 | 상업 |  | The city is a center of commerce. | 완료 |
| `committee` | committee | 명사 | 위원회 |  | The committee meets every Monday. | 완료 |
| `common` | common | 형용사 | 흔한, 공통의 |  | Kim is a common name in Korea. | 완료 |
| `communicate` | communicate | 동사 | 의사소통하다 |  | We communicate by email. | 완료 |
| `community` | community | 명사 | 지역 사회, 공동체 |  | Our community has a nice park. | 완료 |
| `compare` | compare | 동사 | 비교하다 |  | Compare the two pictures. | 완료 |
| `complain` | complain | 동사 | 불평하다 |  | He always complains about the food. | 완료 |
| `complete` | complete | 동사 | 끝내다, 완성하다 |  | Complete the sentence. | 완료 |
| `complex` | complex | 형용사 | 복잡한 |  | The machine is very complex. | 완료 |
| `complicate` | complicate | 동사 | 복잡하게 하다 |  | Do not complicate the problem. | 완료 |
| `concentrate` | concentrate | 동사 | 집중하다 |  | I cannot concentrate with that noise. | 완료 |
| `concept` | concept | 명사 | 개념 |  | The concept is easy to understand. | 완료 |
| `concern` | concern | 명사 | 걱정, 관심사 |  | Thank you for your concern. | 완료 |
| `confirm` | confirm | 동사 | 확인하다 |  | Please confirm your address. | 완료 |
| `conflict` | conflict | 명사 | 갈등, 충돌 |  | They solved the conflict by talking. | 완료 |
| `confuse` | confuse | 동사 | 혼란스럽게 하다 |  | The map confused me. | 완료 |
| `conscious` | conscious | 형용사 | 의식하는, 깨어 있는 |  | He was conscious after the accident. | 완료 |
| `consider` | consider | 동사 | 고려하다 |  | Please consider my idea. | 완료 |
| `constant` | constant | 형용사 | 끊임없는, 변함없는 |  | The baby needs constant care. | 완료 |
| `consume` | consume | 동사 | 소비하다, 먹다 |  | We consume too much sugar. | 완료 |
| `contact` | contact | 동사 | 연락하다 |  | Contact me if you need help. | 완료 |
| `contain` | contain | 동사 | 담고 있다, 포함하다 |  | This box contains old photos. | 완료 |
| `content` | content | 명사 | 내용, 내용물 |  | The content of the book is interesting. | 완료 |
| `context` | context | 명사 | 문맥, 맥락 |  | Guess the meaning from the context. | 완료 |
| `continue` | continue | 동사 | 계속하다 |  | Please continue your story. | 완료 |
| `contract` | contract | 명사 | 계약 |  | They signed a contract. | 완료 |
| `contribute` | contribute | 동사 | 기여하다, 기부하다 |  | Everyone contributed to the project. | 완료 |
| `converse` | converse | 동사 | 대화하다 |  | They conversed in English. | 완료 |
| `convince` | convince | 동사 | 설득하다, 확신시키다 |  | She convinced me to join the club. | 완료 |
| `cop` | cop | 명사 | 경찰관 |  | A cop helped the lost child. | 완료 |
| `cope` | cope | 동사 | 대처하다 |  | He copes well with stress. | 완료 |
| `council` | council | 명사 | 의회, 협의회 |  | The student council planned the festival. | 완료 |
| `county` | county | 명사 | 군(행정 구역) |  | The county has many farms. | 완료 |
| `crash` | crash | 동사 | 충돌하다, 부서지다 |  | The car crashed into a tree. | 완료 |
| `create` | create | 동사 | 만들다, 창조하다 |  | She created a beautiful painting. | 완료 |
| `credit` | credit | 명사 | 신용, 학점 |  | I paid by credit card. | 완료 |
| `crime` | crime | 명사 | 범죄 | 창문으로 들어가려는 복면 도둑과 손전등을 비추는 경찰(우스꽝스럽게) | Stealing is a crime. | 완료 |
| `crisis` | crisis | 명사 | 위기 |  | The country is in an economic crisis. | 완료 |
| `crisp` | crisp | 형용사 | 바삭바삭한 |  | I like crisp toast. | 완료 |
| `cruel` | cruel | 형용사 | 잔인한 |  | It is cruel to hurt animals. | 완료 |
| `cure` | cure | 동사 | 치료하다 |  | This medicine can cure a cold. | 완료 |
| `curl` | curl | 동사 | 곱슬하게 하다, 말다 |  | The cat curled up on the sofa. | 완료 |
| `current` | current | 형용사 | 현재의 |  | What is your current address? | 완료 |
| `damage` | damage | 명사 | 피해, 손상 | 찌그러진 장난감 자동차 | The storm caused a lot of damage. | 완료 |
| `dare` | dare | 동사 | 감히 ~하다 |  | I did not dare to jump. | 완료 |
| `darling` | darling | 명사 | 사랑하는 사람 |  | Good night, my darling. | 완료 |
| `deal` | deal | 명사 | 거래, 처리 |  | We made a deal with the store. | 완료 |
| `debate` | debate | 명사 | 토론 |  | We had a debate about school uniforms. | 완료 |
| `debt` | debt | 명사 | 빚 |  | He paid off his debt. | 완료 |
| `deck` | deck | 명사 | 갑판, 카드 한 벌 |  | We stood on the deck of the ship. | 완료 |
| `defense` | defense | 명사 | 방어, 수비 |  | Our team has a strong defense. | 완료 |
| `define` | define | 동사 | 정의하다 |  | Can you define this word? | 완료 |
| `definite` | definite | 형용사 | 확실한, 분명한 |  | I need a definite answer. | 완료 |
| `delay` | delay | 동사 | 미루다, 지연시키다 |  | The flight was delayed by rain. | 완료 |
| `delight` | delight | 명사 | 큰 기쁨 |  | The children laughed with delight. | 완료 |
| `demand` | demand | 동사 | 요구하다 |  | They demanded an answer. | 완료 |
| `demonstrate` | demonstrate | 동사 | 보여 주다, 증명하다 |  | The teacher demonstrated the experiment. | 완료 |
| `deny` | deny | 동사 | 부인하다 |  | He denied breaking the window. | 완료 |
| `depend` | depend | 동사 | 의존하다, ~에 달려 있다 |  | It depends on the weather. | 완료 |
| `depress` | depress | 동사 | 우울하게 하다 |  | Rainy days depress me. | 완료 |
| `describe` | describe | 동사 | 묘사하다, 설명하다 |  | Describe your best friend. | 완료 |
| `deserve` | deserve | 동사 | ~을 받을 만하다 |  | You deserve a rest. | 완료 |
| `desire` | desire | 명사 | 욕구, 바람 |  | She has a strong desire to win. | 완료 |
| `desperate` | desperate | 형용사 | 절박한, 필사적인 |  | He was desperate for water. | 완료 |
| `despite` | despite | 전치사 | ~에도 불구하고 |  | We played despite the rain. | 완료 |
| `destroy` | destroy | 동사 | 파괴하다 |  | The fire destroyed the forest. | 완료 |
| `detail` | detail | 명사 | 세부 사항 |  | Tell me every detail. | 완료 |
| `detect` | detect | 동사 | 발견하다, 감지하다 |  | Dogs can detect smells very well. | 완료 |
| `determine` | determine | 동사 | 결정하다, 알아내다 |  | We must determine the cause. | 완료 |
| `develop` | develop | 동사 | 발달시키다, 개발하다 |  | Reading develops your mind. | 완료 |
| `diet` | diet | 명사 | 식단, 다이어트 |  | A healthy diet includes vegetables. | 완료 |
| `direct` | direct | 형용사 | 직접적인, 곧장 가는 |  | Is there a direct bus to the airport? | 완료 |
| `dirt` | dirt | 명사 | 흙, 먼지 |  | Wash the dirt off your hands. | 완료 |
| `disappoint` | disappoint | 동사 | 실망시키다 |  | I do not want to disappoint my parents. | 완료 |
| `discipline` | discipline | 명사 | 규율, 훈련 |  | Sports teach discipline. | 완료 |
| `disgust` | disgust | 명사 | 역겨움 |  | He looked at the trash with disgust. | 완료 |
| `display` | display | 동사 | 전시하다, 보여 주다 |  | The shop displays toys in the window. | 완료 |
| `district` | district | 명사 | 지역, 구역 |  | This is a shopping district. | 완료 |
| `disturb` | disturb | 동사 | 방해하다 |  | Please do not disturb me. | 완료 |
| `divorce` | divorce | 명사 | 이혼 |  | They got a divorce last year. | 완료 |
| `domestic` | domestic | 형용사 | 국내의, 가정의 |  | This is a domestic flight. | 완료 |
| `doubt` | doubt | 명사 | 의심 |  | I have no doubt about it. | 완료 |
| `drag` | drag | 동사 | 끌다 |  | He dragged the heavy bag. | 완료 |
| `drama` | drama | 명사 | 연극, 드라마 |  | She is in the drama club. | 완료 |
| `drug` | drug | 명사 | 약, 마약 | 약병과 알약 몇 알 | This drug helps with pain. | 완료 |
| `due` | due | 형용사 | ~하기로 되어 있는, 마감인 |  | The homework is due tomorrow. | 완료 |
| `dump` | dump | 동사 | 버리다 |  | Do not dump trash in the river. | 완료 |
| `dust` | dust | 명사 | 먼지 |  | The shelf is covered with dust. | 완료 |
| `duty` | duty | 명사 | 의무, 임무 |  | It is my duty to feed the dog. | 완료 |
| `each` | each | 형용사 | 각각의 |  | Each student has a locker. | 완료 |
| `earn` | earn | 동사 | 벌다, 얻다 |  | She earns money by babysitting. | 완료 |
| `ease` | ease | 명사 | 쉬움, 편안함 |  | She passed the test with ease. | 완료 |
| `economy` | economy | 명사 | 경제 |  | The country's economy is growing. | 완료 |
| `edge` | edge | 명사 | 가장자리, 모서리 |  | Do not stand at the edge of the pool. | 완료 |
| `edit` | edit | 동사 | 편집하다, 고치다 |  | I edited my video. | 완료 |
| `educate` | educate | 동사 | 교육하다 |  | Schools educate children. | 완료 |
| `effect` | effect | 명사 | 영향, 효과 |  | The medicine had a good effect. | 완료 |
| `effort` | effort | 명사 | 노력 |  | Thank you for your effort. | 완료 |
| `either` | either | 부사 | (둘 중) 어느 하나, ~도 또한 |  | You can take either bus. | 완료 |
| `elect` | elect | 동사 | 선출하다 |  | We elected a new class president. | 완료 |
| `electric` | electric | 형용사 | 전기의 |  | He plays the electric guitar. | 완료 |
| `element` | element | 명사 | 요소, 원소 |  | Trust is an important element of a team. | 완료 |
| `else` | else | 부사 | 그 밖에, 다른 |  | Do you want anything else? | 완료 |
| `embarrass` | embarrass | 동사 | 당황하게 하다 |  | His question embarrassed me. | 완료 |
| `emotion` | emotion | 명사 | 감정 |  | Music can show strong emotions. | 완료 |
| `emphasize` | emphasize | 동사 | 강조하다 |  | The teacher emphasized safety. | 완료 |
| `empire` | empire | 명사 | 제국 |  | Rome was a great empire. | 완료 |
| `employ` | employ | 동사 | 고용하다 |  | The factory employs 200 workers. | 완료 |
| `enemy` | enemy | 명사 | 적 |  | The two cats are enemies. | 완료 |
| `engage` | engage | 동사 | 참여하다, 약속하다 |  | Students engage in group work. | 완료 |
| `enormous` | enormous | 형용사 | 거대한 |  | An enormous whale swam by the boat. | 완료 |
| `entertain` | entertain | 동사 | 즐겁게 하다 |  | The magician entertained the kids. | 완료 |
| `entire` | entire | 형용사 | 전체의 |  | I read the entire book in a day. | 완료 |
| `especially` | especially | 부사 | 특히 |  | I like fruit, especially apples. | 완료 |
| `essay` | essay | 명사 | 수필, 글 |  | I wrote an essay about my family. | 완료 |
| `establish` | establish | 동사 | 설립하다 |  | The school was established in 1990. | 완료 |
| `estimate` | estimate | 동사 | 어림잡다, 추정하다 |  | I estimate that it will take an hour. | 완료 |
| `even` | even | 부사 | ~조차, 훨씬 |  | Even a child can do it. | 완료 |
| `ever` | ever | 부사 | 언젠가, 지금까지 |  | Have you ever been to Jeju? | 완료 |
| `evidence` | evidence | 명사 | 증거 |  | There is no evidence that he did it. | 완료 |
| `evil` | evil | 형용사 | 사악한 |  | The story has an evil witch. | 완료 |
| `exact` | exact | 형용사 | 정확한 |  | What is the exact time? | 완료 |
| `except` | except | 전치사 | ~을 제외하고 |  | Everyone came except Tom. | 완료 |
| `exhaust` | exhaust | 동사 | 지치게 하다 |  | The long hike exhausted us. | 완료 |
| `exist` | exist | 동사 | 존재하다 |  | Do aliens really exist? | 완료 |
| `expand` | expand | 동사 | 넓히다, 팽창하다 |  | Air expands when it is heated. | 완료 |
| `expect` | expect | 동사 | 기대하다, 예상하다 |  | I expect her to come soon. | 완료 |
| `expense` | expense | 명사 | 비용 |  | Travel expenses were high. | 완료 |
| `experience` | experience | 명사 | 경험 |  | It was a great experience for me. | 완료 |
| `expert` | expert | 명사 | 전문가 |  | She is an expert on dinosaurs. | 완료 |
| `explain` | explain | 동사 | 설명하다 |  | Can you explain the rule again? | 완료 |
| `expose` | expose | 동사 | 드러내다, 노출시키다 |  | Do not expose your skin to the sun too long. | 완료 |
| `express` | express | 동사 | 표현하다 |  | She expressed her thanks with a card. | 완료 |
| `extend` | extend | 동사 | 늘이다, 연장하다 |  | They extended the deadline. | 완료 |
| `extra` | extra | 형용사 | 추가의, 여분의 |  | Bring an extra pencil. | 완료 |
| `extreme` | extreme | 형용사 | 극심한, 극도의 |  | The desert has extreme heat. | 완료 |
| `factor` | factor | 명사 | 요인 |  | Sleep is an important factor in health. | 완료 |
| `faint` | faint | 형용사 | 희미한, 어지러운 |  | I heard a faint sound. | 완료 |
| `faith` | faith | 명사 | 믿음, 신뢰 |  | I have faith in my team. | 완료 |
| `familiar` | familiar | 형용사 | 익숙한, 낯익은 |  | Her face looks familiar. | 완료 |
| `fancy` | fancy | 형용사 | 화려한, 고급의 |  | They ate at a fancy restaurant. | 완료 |
| `fantastic` | fantastic | 형용사 | 환상적인, 멋진 |  | We had a fantastic time. | 완료 |
| `fascinate` | fascinate | 동사 | 매혹하다 |  | Stars fascinate me. | 완료 |
| `fashion` | fashion | 명사 | 패션, 유행 |  | She is interested in fashion. | 완료 |
| `fault` | fault | 명사 | 잘못, 결점 |  | It was not your fault. | 완료 |
| `favor` | favor | 명사 | 부탁, 호의 |  | Can you do me a favor? | 완료 |
| `fear` | fear | 명사 | 두려움 |  | She has a fear of heights. | 완료 |
| `feature` | feature | 명사 | 특징, 기능 |  | The phone has many new features. | 완료 |
| `fee` | fee | 명사 | 요금, 수수료 |  | The entrance fee is five dollars. | 완료 |
| `fellow` | fellow | 명사 | 동료, 녀석 |  | He is a friendly fellow. | 완료 |
| `female` | female | 형용사 | 여성의, 암컷의 |  | The female lion hunts for food. | 완료 |
| `figure` | figure | 명사 | 숫자, 모습, 인물 |  | Look at the figures in the table. | 완료 |
| `final` | final | 형용사 | 마지막의 |  | This is the final game of the season. | 완료 |
| `finance` | finance | 명사 | 재정, 금융 |  | She works in finance. | 완료 |
| `firm` | firm | 형용사 | 단단한, 확고한 |  | The bed is too firm for me. | 완료 |
| `fit` | fit | 동사 | (크기가) 맞다 |  | These shoes fit me well. | 완료 |
| `flash` | flash | 명사 | 번쩍임 |  | We saw a flash of lightning. | 완료 |
| `flood` | flood | 명사 | 홍수 |  | The heavy rain caused a flood. | 완료 |
| `flow` | flow | 동사 | 흐르다 |  | The river flows into the sea. | 완료 |
| `folk` | folk | 형용사 | 민속의 |  | We learned a Korean folk song. | 완료 |
| `foreign` | foreign | 형용사 | 외국의 |  | I want to learn a foreign language. | 완료 |
| `forever` | forever | 부사 | 영원히 |  | We will be friends forever. | 완료 |
| `forgive` | forgive | 동사 | 용서하다 |  | Please forgive me for being late. | 완료 |
| `forth` | forth | 부사 | 앞으로 |  | The swing moved back and forth. | 완료 |
| `fortunate` | fortunate | 형용사 | 운이 좋은 |  | We were fortunate to find seats. | 완료 |
| `fortune` | fortune | 명사 | 운, 큰돈 |  | He made a fortune in business. | 완료 |
| `found` | found | 동사 | 설립하다 |  | She founded a school for girls. | 완료 |
| `frankly` | frankly | 부사 | 솔직히 |  | Frankly, I do not like it. | 완료 |
| `fright` | fright | 명사 | 놀람, 공포 |  | The loud noise gave me a fright. | 완료 |
| `frustrate` | frustrate | 동사 | 좌절시키다, 답답하게 하다 |  | The hard puzzle frustrated him. | 완료 |
| `function` | function | 명사 | 기능 |  | What is the function of this button? | 완료 |
| `fund` | fund | 명사 | 기금, 자금 |  | We raised funds for the animal shelter. | 완료 |
| `fur` | fur | 명사 | 털 |  | The rabbit has soft white fur. | 완료 |
| `gain` | gain | 동사 | 얻다, 늘다 |  | He gained a lot of experience. | 완료 |
| `gear` | gear | 명사 | 장비, 기어 |  | Bring your camping gear. | 완료 |
| `general` | general | 형용사 | 일반적인 |  | This is a general rule. | 완료 |
| `gesture` | gesture | 명사 | 몸짓 |  | She made a gesture to come in. | 완료 |
| `glance` | glance | 동사 | 흘끗 보다 |  | He glanced at his watch. | 완료 |
| `glory` | glory | 명사 | 영광 |  | The team returned home in glory. | 완료 |
| `gorgeous` | gorgeous | 형용사 | 아주 멋진, 아름다운 |  | What a gorgeous sunset! | 완료 |
| `govern` | govern | 동사 | 다스리다 |  | The king governed the country wisely. | 완료 |
| `grab` | grab | 동사 | 움켜잡다 |  | He grabbed my hand. | 완료 |
| `grace` | grace | 명사 | 우아함 |  | The dancer moved with grace. | 완료 |
| `grade` | grade | 명사 | 학년, 성적 |  | I am in the second grade of middle school. | 완료 |
| `grand` | grand | 형용사 | 웅장한 |  | They live in a grand house. | 완료 |
| `grant` | grant | 동사 | 주다, 허락하다 |  | The fairy granted her three wishes. | 완료 |
| `guarantee` | guarantee | 동사 | 보장하다 |  | I guarantee you will like it. | 완료 |
| `guard` | guard | 명사 | 경비원, 지키는 사람 |  | A guard stands at the gate. | 완료 |
| `guest` | guest | 명사 | 손님 |  | We have guests for dinner. | 완료 |
| `guide` | guide | 명사 | 안내인, 안내서 |  | Our guide showed us the old town. | 완료 |
| `guilt` | guilt | 명사 | 죄책감, 유죄 |  | He felt guilt about lying. | 완료 |
| `gun` | gun | 명사 | 총 | 장난감 물총 하나(사람 없이, 누구도 겨누지 않게) | The police officer carries a gun. | 완료 |
| `harm` | harm | 명사 | 해, 피해 | 뜨거운 냄비에 손을 대려는 아이를 어른이 막는 장면 | Smoking does harm to your body. | 완료 |
| `heaven` | heaven | 명사 | 천국, 하늘 |  | The stars look like lights in heaven. | 완료 |
| `hell` | hell | 명사 | 지옥 |  | The trip was hell because of the heat. | 완료 |
| `hesitate` | hesitate | 동사 | 망설이다 |  | Do not hesitate to ask questions. | 완료 |
| `hint` | hint | 명사 | 힌트, 암시 |  | Give me a hint, please. | 완료 |
| `hire` | hire | 동사 | 고용하다 |  | They hired a new cook. | 완료 |
| `honor` | honor | 명사 | 명예, 영광 |  | It is an honor to meet you. | 완료 |
| `humor` | humor | 명사 | 유머 |  | He has a good sense of humor. | 완료 |
| `hunger` | hunger | 명사 | 배고픔, 굶주림 |  | Many children suffer from hunger. | 완료 |
| `identity` | identity | 명사 | 정체성, 신원 |  | The police checked his identity. | 완료 |
| `ignore` | ignore | 동사 | 무시하다 |  | Do not ignore the warning sign. | 완료 |
| `illustrate` | illustrate | 동사 | 삽화를 넣다, 예를 들어 설명하다 |  | She illustrates books for children. | 완료 |
| `immediate` | immediate | 형용사 | 즉각적인 |  | We need an immediate answer. | 완료 |
| `impress` | impress | 동사 | 깊은 인상을 주다 |  | Her speech impressed everyone. | 완료 |
| `improve` | improve | 동사 | 나아지다, 향상시키다 |  | Reading improves your English. | 완료 |
| `include` | include | 동사 | 포함하다 |  | The price includes lunch. | 완료 |
| `income` | income | 명사 | 소득, 수입 |  | His income is not very high. | 완료 |
| `indeed` | indeed | 부사 | 정말로, 참으로 |  | It is indeed a great idea. | 완료 |
| `indicate` | indicate | 동사 | 가리키다, 나타내다 |  | The sign indicates the way out. | 완료 |
| `individual` | individual | 명사 | 개인 |  | Every individual is different. | 완료 |
| `industry` | industry | 명사 | 산업 |  | The car industry is important in Korea. | 완료 |
| `influence` | influence | 명사 | 영향 |  | Friends have a big influence on us. | 완료 |
| `inform` | inform | 동사 | 알리다 |  | Please inform me of any changes. | 완료 |
| `injure` | injure | 동사 | 다치게 하다 |  | He injured his arm while skating. | 완료 |
| `innocent` | innocent | 형용사 | 죄 없는, 순진한 |  | The man was innocent. | 완료 |
| `insist` | insist | 동사 | 주장하다, 고집하다 |  | She insisted on paying for lunch. | 완료 |
| `inspect` | inspect | 동사 | 점검하다 |  | They inspect the bridge every year. | 완료 |
| `instance` | instance | 명사 | 사례, 경우 |  | For instance, cats sleep a lot. | 완료 |
| `instant` | instant | 형용사 | 즉각적인, 즉석의 |  | I ate instant noodles. | 완료 |
| `instead` | instead | 부사 | 대신에 |  | I had tea instead of coffee. | 완료 |
| `instruct` | instruct | 동사 | 가르치다, 지시하다 |  | The coach instructed us to run. | 완료 |
| `insure` | insure | 동사 | 보험에 들다 |  | We insured our house against fire. | 완료 |
| `intend` | intend | 동사 | ~할 작정이다 |  | I intend to study abroad. | 완료 |
| `intense` | intense | 형용사 | 강렬한, 극심한 |  | The heat was intense. | 완료 |
| `intent` | intent | 명사 | 의도 |  | It was not my intent to hurt you. | 완료 |
| `internal` | internal | 형용사 | 내부의 |  | The heart is an internal organ. | 완료 |
| `interrupt` | interrupt | 동사 | 방해하다, 끼어들다 |  | Do not interrupt when others talk. | 완료 |
| `invest` | invest | 동사 | 투자하다 |  | He invested money in the company. | 완료 |
| `investigate` | investigate | 동사 | 조사하다 |  | The police are investigating the case. | 완료 |
| `involve` | involve | 동사 | 포함하다, 관련시키다 |  | The job involves a lot of travel. | 완료 |
| `item` | item | 명사 | 물품, 항목 |  | There are ten items on the list. | 완료 |
| `jaw` | jaw | 명사 | 턱 |  | The shark has strong jaws. | 완료 |
| `joke` | joke | 명사 | 농담 |  | He told a funny joke. | 완료 |
| `journey` | journey | 명사 | 여행, 여정 |  | The journey took three days. | 완료 |
| `judge` | judge | 명사 | 판사, 심판 |  | The judge listened to both sides. | 완료 |
| `junior` | junior | 형용사 | 후배의, 어린 |  | He is my junior at school. | 완료 |
| `justice` | justice | 명사 | 정의 |  | They fought for justice. | 완료 |
| `knowledge` | knowledge | 명사 | 지식 |  | She has a lot of knowledge about plants. | 완료 |
| `label` | label | 명사 | 상표, 꼬리표 |  | Read the label on the bottle. | 완료 |
| `labor` | labor | 명사 | 노동 |  | Building a house takes a lot of labor. | 완료 |
| `lack` | lack | 명사 | 부족 |  | The plant died from lack of water. | 완료 |
| `lane` | lane | 명사 | 좁은 길, 차선 |  | Stay in the right lane. | 완료 |
| `law` | law | 명사 | 법 |  | Everyone must follow the law. | 완료 |
| `lawyer` | lawyer | 명사 | 변호사 |  | My aunt is a lawyer. | 완료 |
| `lay` | lay | 동사 | 놓다, (알을) 낳다 |  | Lay the book on the table. | 완료 |
| `league` | league | 명사 | 리그, 연맹 |  | Our team won the league. | 완료 |
| `leap` | leap | 동사 | 뛰다, 도약하다 |  | The frog leaped into the pond. | 완료 |
| `legal` | legal | 형용사 | 합법적인, 법률의 |  | It is not legal to park here. | 완료 |
| `lend` | lend | 동사 | 빌려주다 |  | Can you lend me your pen? | 완료 |
| `level` | level | 명사 | 수준, 높이 |  | This book is at my level. | 완료 |
| `license` | license | 명사 | 면허, 허가증 |  | My brother got his driver license. | 완료 |
| `limit` | limit | 명사 | 한계, 제한 |  | There is a speed limit on this road. | 완료 |
| `link` | link | 명사 | 연결, 링크 |  | Click the link to see the video. | 완료 |
| `load` | load | 명사 | 짐 |  | The truck carries a heavy load. | 완료 |
| `loan` | loan | 명사 | 대출 |  | They got a loan to buy a house. | 완료 |
| `local` | local | 형용사 | 지역의, 현지의 |  | We ate at a local restaurant. | 완료 |
| `locate` | locate | 동사 | 위치를 찾다, 두다 |  | The school is located near the park. | 완료 |
| `loose` | loose | 형용사 | 헐거운, 풀린 |  | My tooth is loose. | 완료 |
| `loss` | loss | 명사 | 손실, 패배 |  | The team had its first loss. | 완료 |
| `main` | main | 형용사 | 주된, 가장 중요한 |  | What is the main idea of the story? | 완료 |
| `maintain` | maintain | 동사 | 유지하다 |  | Exercise helps you maintain your health. | 완료 |
| `major` | major | 형용사 | 주요한, 큰 |  | Traffic is a major problem in the city. | 완료 |
| `male` | male | 형용사 | 남성의, 수컷의 |  | The male bird has bright feathers. | 완료 |
| `manage` | manage | 동사 | 관리하다, 해내다 |  | She manages a small shop. | 완료 |
| `manner` | manner | 명사 | 방식, 예절 |  | He has good table manners. | 완료 |
| `manufacture` | manufacture | 동사 | 제조하다 |  | The factory manufactures cars. | 완료 |
| `mark` | mark | 명사 | 표시, 점수 |  | Put a mark next to the right answer. | 완료 |
| `marvel` | marvel | 동사 | 경탄하다 |  | We marveled at the view. | 완료 |
| `mass` | mass | 명사 | 덩어리, 다량 |  | A mass of clouds covered the sky. | 완료 |
| `master` | master | 명사 | 주인, 달인 |  | The dog ran to its master. | 완료 |
| `mate` | mate | 명사 | 친구, 짝 |  | He is my classmate and best mate. | 완료 |
| `maximum` | maximum | 명사 | 최대 |  | The maximum number of players is five. | 완료 |
| `mean` | mean | 동사 | 의미하다 |  | What does this word mean? | 완료 |
| `medical` | medical | 형용사 | 의학의, 의료의 |  | She needs medical care. | 완료 |
| `mental` | mental | 형용사 | 정신의, 마음의 |  | Sleep is good for your mental health. | 완료 |
| `mention` | mention | 동사 | 언급하다 |  | He did not mention his name. | 완료 |
| `menu` | menu | 명사 | 메뉴, 차림표 |  | Can I see the menu, please? | 완료 |
| `method` | method | 명사 | 방법 |  | This is an easy method to learn words. | 완료 |
| `military` | military | 형용사 | 군대의 |  | He wore a military uniform. | 완료 |
| `minor` | minor | 형용사 | 작은, 중요하지 않은 |  | It is only a minor problem. | 완료 |
| `mission` | mission | 명사 | 임무 |  | The astronauts finished their mission. | 완료 |
| `modern` | modern | 형용사 | 현대의 |  | This is a modern building. | 완료 |
| `moment` | moment | 명사 | 순간, 잠깐 |  | Wait a moment, please. | 완료 |
| `mood` | mood | 명사 | 기분 |  | She is in a good mood today. | 완료 |
| `moral` | moral | 형용사 | 도덕적인 |  | The story has a moral lesson. | 완료 |
| `moreover` | moreover | 부사 | 게다가 |  | It is cheap. Moreover, it tastes good. | 완료 |
| `motion` | motion | 명사 | 움직임, 운동 |  | The motion of the boat made me sick. | 완료 |
| `motor` | motor | 명사 | 모터, 전동기 |  | The toy car has a small motor. | 완료 |
| `mount` | mount | 동사 | 오르다, 올라타다 |  | He mounted his horse. | 완료 |
| `mystery` | mystery | 명사 | 수수께끼, 신비 |  | The cause is still a mystery. | 완료 |
| `native` | native | 형용사 | 태어난 곳의, 토박이의 |  | Korean is my native language. | 완료 |
| `necessary` | necessary | 형용사 | 필요한 |  | Water is necessary for life. | 완료 |
| `neither` | neither | 부사 | (둘 중) 어느 것도 아니다 |  | Neither answer is correct. | 완료 |
| `nerve` | nerve | 명사 | 신경, 용기 |  | It takes nerve to speak on stage. | 완료 |
| `none` | none | 대명사 | 아무도, 하나도 ~않다 |  | None of us knew the answer. | 완료 |
| `nor` | nor | 접속사 | ~도 또한 아니다 |  | He does not sing, nor does he dance. | 완료 |
| `notice` | notice | 동사 | 알아차리다 |  | Did you notice her new haircut? | 완료 |
| `nowadays` | nowadays | 부사 | 요즘에는 |  | Nowadays, many people shop online. | 완료 |
| `nowhere` | nowhere | 부사 | 어디에도 ~없다 |  | My keys are nowhere to be found. | 완료 |
| `object` | object | 명사 | 물건, 대상 |  | What is that strange object? | 완료 |
| `obvious` | obvious | 형용사 | 분명한 |  | The answer is obvious. | 완료 |
| `occasion` | occasion | 명사 | 때, 특별한 행사 |  | A wedding is a special occasion. | 완료 |
| `occur` | occur | 동사 | 일어나다, 발생하다 |  | The accident occurred at night. | 완료 |
| `odd` | odd | 형용사 | 이상한, 홀수의 |  | One, three, and five are odd numbers. | 완료 |
| `offer` | offer | 동사 | 제안하다, 내주다 |  | She offered me a seat. | 완료 |
| `officer` | officer | 명사 | 경찰관, 장교, 공무원 |  | A police officer helped us. | 완료 |
| `opera` | opera | 명사 | 오페라 |  | We saw an opera at the theater. | 완료 |
| `operate` | operate | 동사 | 작동하다, 수술하다 | 아이가 버튼을 눌러 기계를 작동시키는 장면 | Do you know how to operate this machine? | 완료 |
| `opinion` | opinion | 명사 | 의견 |  | In my opinion, the movie was great. | 완료 |
| `oppose` | oppose | 동사 | 반대하다 |  | Many people oppose the plan. | 완료 |
| `order` | order | 명사 | 순서, 주문, 명령 |  | Put the words in the right order. | 완료 |
| `ordinary` | ordinary | 형용사 | 평범한, 보통의 |  | It was an ordinary day. | 완료 |
| `otherwise` | otherwise | 부사 | 그렇지 않으면 |  | Hurry up; otherwise, we will be late. | 완료 |
| `ought` | ought | 조동사 | ~해야 한다 |  | You ought to see a doctor. | 완료 |
| `overall` | overall | 형용사 | 전반적인 |  | The overall result was good. | 완료 |
| `own` | own | 형용사 | 자기 자신의 |  | I have my own room. | 완료 |
| `panic` | panic | 명사 | 공포, 당황 |  | Do not panic in an emergency. | 완료 |
| `paragraph` | paragraph | 명사 | 문단 |  | Read the first paragraph aloud. | 완료 |
| `particular` | particular | 형용사 | 특정한, 특별한 |  | Is there a particular color you like? | 완료 |
| `past` | past | 명사 | 과거 |  | In the past, people rode horses. | 완료 |
| `pause` | pause | 동사 | 잠시 멈추다 |  | Pause the video for a minute. | 완료 |
| `per` | per | 전치사 | ~당, ~마다 |  | The speed limit is 50 kilometers per hour. | 완료 |
| `perfect` | perfect | 형용사 | 완벽한 |  | Your pronunciation is perfect. | 완료 |
| `perhaps` | perhaps | 부사 | 아마도 |  | Perhaps it will snow tomorrow. | 완료 |
| `period` | period | 명사 | 기간, 교시 |  | We have math in the first period. | 완료 |
| `physical` | physical | 형용사 | 신체의, 물리적인 |  | Physical exercise is good for you. | 완료 |
| `pitch` | pitch | 동사 | 던지다 |  | He pitched the ball fast. | 완료 |
| `pity` | pity | 명사 | 동정, 유감 |  | It is a pity that you cannot come. | 완료 |
| `plain` | plain | 형용사 | 무늬 없는, 분명한 |  | She wore a plain white shirt. | 완료 |
| `plenty` | plenty | 명사 | 많음, 충분함 |  | We have plenty of time. | 완료 |
| `poem` | poem | 명사 | 시 |  | She wrote a poem about spring. | 완료 |
| `poet` | poet | 명사 | 시인 |  | Yun Dong-ju was a famous poet. | 완료 |
| `poison` | poison | 명사 | 독 | 보라색 액체가 든 병에 빨간 X 모양 표시(해골·글자 없이) | Some mushrooms have poison. | 완료 |
| `policy` | policy | 명사 | 정책, 방침 |  | The school has a new uniform policy. | 완료 |
| `politics` | politics | 명사 | 정치 |  | He is interested in politics. | 완료 |
| `pollute` | pollute | 동사 | 오염시키다 |  | Cars pollute the air. | 완료 |
| `pop` | pop | 동사 | 펑 터지다 |  | The balloon popped. | 완료 |
| `popular` | popular | 형용사 | 인기 있는 |  | Soccer is a popular sport. | 완료 |
| `possess` | possess | 동사 | 소유하다 |  | He possesses a great talent. | 완료 |
| `possible` | possible | 형용사 | 가능한 |  | Is it possible to finish today? | 완료 |
| `potential` | potential | 명사 | 잠재력 |  | She has the potential to be a great singer. | 완료 |
| `powder` | powder | 명사 | 가루 |  | Add some baking powder. | 완료 |
| `practical` | practical | 형용사 | 실용적인, 실제의 |  | This bag is very practical. | 완료 |
| `prefer` | prefer | 동사 | 더 좋아하다 |  | I prefer tea to coffee. | 완료 |
| `pregnant` | pregnant | 형용사 | 임신한 |  | My aunt is pregnant. | 완료 |
| `prepare` | prepare | 동사 | 준비하다 |  | I prepared for the test. | 완료 |
| `presence` | presence | 명사 | 존재, 참석 |  | Your presence makes me happy. | 완료 |
| `pretend` | pretend | 동사 | ~인 척하다 |  | He pretended to be asleep. | 완료 |
| `prevent` | prevent | 동사 | 막다, 예방하다 |  | Washing hands prevents colds. | 완료 |
| `previous` | previous | 형용사 | 이전의 |  | I saw him the previous day. | 완료 |
| `pride` | pride | 명사 | 자부심, 자존심 |  | She takes pride in her work. | 완료 |
| `prime` | prime | 형용사 | 주요한, 최고의 |  | Safety is our prime concern. | 완료 |
| `principle` | principle | 명사 | 원칙, 원리 |  | Honesty is my first principle. | 완료 |
| `prison` | prison | 명사 | 감옥 | 창살이 있는 빈 방(사람 없이) | The thief was sent to prison. | 완료 |
| `privacy` | privacy | 명사 | 사생활 |  | Please respect my privacy. | 완료 |
| `private` | private | 형용사 | 개인의, 사적인 |  | This is a private room. | 완료 |
| `probable` | probable | 형용사 | 있을 법한 |  | Rain is probable this afternoon. | 완료 |
| `proceed` | proceed | 동사 | 계속하다, 나아가다 |  | Please proceed to gate five. | 완료 |
| `process` | process | 명사 | 과정 |  | Learning is a slow process. | 완료 |
| `produce` | produce | 동사 | 생산하다 |  | This farm produces fresh milk. | 완료 |
| `profession` | profession | 명사 | 직업 |  | Teaching is a respected profession. | 완료 |
| `profit` | profit | 명사 | 이익 |  | The shop made a small profit. | 완료 |
| `progress` | progress | 명사 | 진전, 발전 |  | You are making good progress. | 완료 |
| `promote` | promote | 동사 | 홍보하다, 승진시키다 |  | The singer is promoting her new album. | 완료 |
| `pronounce` | pronounce | 동사 | 발음하다 |  | How do you pronounce this word? | 완료 |
| `proper` | proper | 형용사 | 알맞은, 올바른 |  | Use the proper tool for the job. | 완료 |
| `property` | property | 명사 | 재산, 특성 |  | This land is private property. | 완료 |
| `propose` | propose | 동사 | 제안하다, 청혼하다 |  | I propose that we start early. | 완료 |
| `protest` | protest | 동사 | 항의하다 |  | People protested against the plan. | 완료 |
| `prove` | prove | 동사 | 증명하다 |  | Can you prove that you are right? | 완료 |
| `provide` | provide | 동사 | 제공하다 |  | The hotel provides breakfast. | 완료 |
| `pub` | pub | 명사 | 술집 | 나무 간판이 달린 작은 가게 앞모습(간판 글자 없이) | The pub is closed today. | 완료 |
| `public` | public | 형용사 | 공공의, 대중의 |  | This is a public library. | 완료 |
| `punch` | punch | 동사 | 주먹으로 치다 |  | He punched the bag in the gym. | 완료 |
| `punish` | punish | 동사 | 벌주다 | 벽을 보고 서서 반성하는 아이와 팔짱 낀 어른(무섭지 않게) | The teacher did not punish him. | 완료 |
| `purchase` | purchase | 동사 | 구입하다 |  | You can purchase tickets online. | 완료 |
| `pure` | pure | 형용사 | 순수한, 깨끗한 |  | The water is pure and clean. | 완료 |
| `purpose` | purpose | 명사 | 목적 |  | What is the purpose of your visit? | 완료 |
| `quality` | quality | 명사 | 품질, 자질 |  | This bag is of good quality. | 완료 |
| `quit` | quit | 동사 | 그만두다 |  | He quit the soccer team. | 완료 |
| `quite` | quite | 부사 | 꽤, 상당히 |  | The test was quite easy. | 완료 |
| `quote` | quote | 동사 | 인용하다 |  | She quoted a line from the poem. | 완료 |
| `range` | range | 명사 | 범위 |  | The store sells a wide range of toys. | 완료 |
| `rapid` | rapid | 형용사 | 빠른 |  | The city saw rapid growth. | 완료 |
| `rare` | rare | 형용사 | 드문, 희귀한 |  | This bird is very rare. | 완료 |
| `rate` | rate | 명사 | 비율, 속도, 요금 |  | The birth rate is falling. | 완료 |
| `rather` | rather | 부사 | 오히려, 꽤 |  | I would rather stay home. | 완료 |
| `react` | react | 동사 | 반응하다 |  | How did she react to the news? | 완료 |
| `reason` | reason | 명사 | 이유 |  | What is the reason for your choice? | 완료 |
| `receive` | receive | 동사 | 받다 |  | I received a letter from my friend. | 완료 |
| `recent` | recent | 형용사 | 최근의 |  | This is a recent photo of me. | 완료 |
| `recipe` | recipe | 명사 | 요리법 |  | This is my grandma's recipe. | 완료 |
| `recognize` | recognize | 동사 | 알아보다, 인정하다 |  | I did not recognize you at first. | 완료 |
| `recommend` | recommend | 동사 | 추천하다 |  | Can you recommend a good book? | 완료 |
| `recover` | recover | 동사 | 회복하다 |  | She recovered from her cold. | 완료 |
| `refer` | refer | 동사 | 참고하다, 가리키다 |  | Refer to the map on page five. | 완료 |
| `reflect` | reflect | 동사 | 비추다, 반영하다 |  | The lake reflects the mountains. | 완료 |
| `refuse` | refuse | 동사 | 거절하다 |  | He refused to answer. | 완료 |
| `regard` | regard | 동사 | ~로 여기다 |  | I regard him as my best friend. | 완료 |
| `region` | region | 명사 | 지역 |  | This region is famous for apples. | 완료 |
| `register` | register | 동사 | 등록하다 |  | I registered for the swimming class. | 완료 |
| `regular` | regular | 형용사 | 규칙적인, 보통의 |  | Regular exercise keeps you healthy. | 완료 |
| `relate` | relate | 동사 | 관련시키다 |  | The two events are closely related. | 완료 |
| `release` | release | 동사 | 놓아주다, 발표하다 |  | They released the bird into the sky. | 완료 |
| `relief` | relief | 명사 | 안심, 완화 |  | It was a relief to find my bag. | 완료 |
| `rely` | rely | 동사 | 의지하다 |  | You can rely on me. | 완료 |
| `remain` | remain | 동사 | 남다, 계속 ~이다 |  | Please remain in your seat. | 완료 |
| `remark` | remark | 명사 | 말, 발언 |  | She made a kind remark about my work. | 완료 |
| `remind` | remind | 동사 | 생각나게 하다 |  | Remind me to call my mom. | 완료 |
| `remove` | remove | 동사 | 없애다, 치우다 |  | Remove your shoes before you enter. | 완료 |
| `rent` | rent | 동사 | 빌리다, 세내다 |  | We rented a car for the trip. | 완료 |
| `replace` | replace | 동사 | 바꾸다, 대신하다 |  | We need to replace the battery. | 완료 |
| `reply` | reply | 동사 | 대답하다, 답장하다 |  | She replied to my message quickly. | 완료 |
| `report` | report | 명사 | 보고서, 보도 |  | I wrote a report on dolphins. | 완료 |
| `represent` | represent | 동사 | 대표하다, 나타내다 |  | She represents our class. | 완료 |
| `request` | request | 명사 | 요청 |  | I have a small request. | 완료 |
| `require` | require | 동사 | 필요로 하다, 요구하다 |  | This job requires patience. | 완료 |
| `research` | research | 명사 | 연구, 조사 |  | She does research on sea animals. | 완료 |
| `reserve` | reserve | 동사 | 예약하다, 남겨 두다 |  | I reserved a table for four. | 완료 |
| `resist` | resist | 동사 | 저항하다, 참다 |  | I cannot resist chocolate. | 완료 |
| `resource` | resource | 명사 | 자원 |  | Water is a valuable resource. | 완료 |
| `respect` | respect | 동사 | 존중하다, 존경하다 |  | We should respect our elders. | 완료 |
| `respond` | respond | 동사 | 응답하다 |  | He did not respond to my question. | 완료 |
| `responsible` | responsible | 형용사 | 책임 있는 |  | You are responsible for your pet. | 완료 |
| `result` | result | 명사 | 결과 |  | The test results came out today. | 완료 |
| `retire` | retire | 동사 | 은퇴하다 |  | My grandfather retired last year. | 완료 |
| `risk` | risk | 명사 | 위험 |  | There is a risk of fire. | 완료 |
| `rob` | rob | 동사 | 강탈하다, 털다 |  | Two men robbed the bank. | 완료 |
| `role` | role | 명사 | 역할 |  | She played the role of a princess. | 완료 |
| `route` | route | 명사 | 길, 노선 |  | This is the shortest route to school. | 완료 |
| `royal` | royal | 형용사 | 왕의, 왕실의 |  | The royal family lives in the palace. | 완료 |
| `rub` | rub | 동사 | 문지르다 |  | He rubbed his eyes. | 완료 |
| `rude` | rude | 형용사 | 무례한 |  | It is rude to talk with your mouth full. | 완료 |
| `ruin` | ruin | 동사 | 망치다 |  | The rain ruined our picnic. | 완료 |
| `rule` | rule | 명사 | 규칙 |  | Follow the school rules. | 완료 |
| `rush` | rush | 동사 | 서두르다, 급히 가다 |  | We rushed to the station. | 완료 |
| `salary` | salary | 명사 | 월급 |  | She gets a good salary. | 완료 |
| `sample` | sample | 명사 | 견본, 표본 |  | Try a free sample of the cheese. | 완료 |
| `satisfy` | satisfy | 동사 | 만족시키다 |  | The meal satisfied everyone. | 완료 |
| `scare` | scare | 동사 | 겁주다 |  | The loud noise scared the cat. | 완료 |
| `scene` | scene | 명사 | 장면, 현장 |  | I liked the last scene of the movie. | 완료 |
| `schedule` | schedule | 명사 | 일정, 시간표 |  | I have a busy schedule today. | 완료 |
| `scratch` | scratch | 동사 | 긁다, 할퀴다 |  | The cat scratched the sofa. | 완료 |
| `scream` | scream | 동사 | 비명을 지르다 |  | She screamed when she saw the spider. | 완료 |
| `secretary` | secretary | 명사 | 비서 |  | The secretary answered the phone. | 완료 |
| `section` | section | 명사 | 부분, 구역 |  | The fruit section is over there. | 완료 |
| `secure` | secure | 형용사 | 안전한, 확실한 |  | Keep your money in a secure place. | 완료 |
| `seek` | seek | 동사 | 찾다, 구하다 |  | They are seeking a new home. | 완료 |
| `seem` | seem | 동사 | ~처럼 보이다 |  | You seem tired today. | 완료 |
| `select` | select | 동사 | 선택하다 |  | Select the best answer. | 완료 |
| `self` | self | 명사 | 자기 자신 |  | Be your true self. | 완료 |
| `senior` | senior | 형용사 | 선배의, 고령의 |  | She is my senior at school. | 완료 |
| `sense` | sense | 명사 | 감각, 의미 |  | Dogs have a good sense of smell. | 완료 |
| `series` | series | 명사 | 연속, 시리즈 |  | I watched a series about animals. | 완료 |
| `serve` | serve | 동사 | 음식을 내다, 봉사하다 |  | They serve lunch at noon. | 완료 |
| `session` | session | 명사 | 시간, 모임 |  | We have a training session after school. | 완료 |
| `settle` | settle | 동사 | 정착하다, 해결하다 |  | They settled in a small town. | 완료 |
| `several` | several | 형용사 | 몇몇의 |  | I have several questions. | 완료 |
| `sex` | sex | 명사 | 성, 성별 |  | Write your name, age, and sex. | 완료 |
| `shame` | shame | 명사 | 부끄러움, 유감 |  | It is a shame that you missed the show. | 완료 |
| `sharp` | sharp | 형용사 | 날카로운 |  | Be careful with the sharp knife. | 완료 |
| `shave` | shave | 동사 | 면도하다 |  | Dad shaves every morning. | 완료 |
| `shelter` | shelter | 명사 | 보호소, 피난처 |  | The dog lives in an animal shelter. | 완료 |
| `shift` | shift | 동사 | 옮기다, 바꾸다 |  | He shifted the box to the corner. | 완료 |
| `shock` | shock | 명사 | 충격 |  | The news was a big shock. | 완료 |
| `shore` | shore | 명사 | 바닷가, 호숫가 |  | We walked along the shore. | 완료 |
| `sight` | sight | 명사 | 시력, 광경 |  | The sunset was a beautiful sight. | 완료 |
| `similar` | similar | 형용사 | 비슷한 |  | Our bags are very similar. | 완료 |
| `simple` | simple | 형용사 | 간단한, 단순한 |  | The rule is simple. | 완료 |
| `since` | since | 접속사 | ~한 이후로, ~이므로 |  | I have lived here since 2020. | 완료 |
| `single` | single | 형용사 | 단 하나의, 혼자의 |  | I did not say a single word. | 완료 |
| `site` | site | 명사 | 장소, 현장, 사이트 |  | This is the site of the old castle. | 완료 |
| `situate` | situate | 동사 | 위치시키다 |  | The hotel is situated by the sea. | 완료 |
| `skill` | skill | 명사 | 기술, 솜씨 |  | Cooking is a useful skill. | 완료 |
| `slave` | slave | 명사 | 노예 |  | Slaves were not free long ago. | 완료 |
| `slight` | slight | 형용사 | 약간의 |  | I have a slight headache. | 완료 |
| `smash` | smash | 동사 | 박살 내다 | 바닥에 떨어져 깨진 접시(사람 없이) | The ball smashed the window. | 완료 |
| `snap` | snap | 동사 | 딱 부러지다, 사진을 찍다 |  | The stick snapped in two. | 완료 |
| `social` | social | 형용사 | 사회의, 사교적인 |  | Humans are social animals. | 완료 |
| `society` | society | 명사 | 사회 |  | We live in a changing society. | 완료 |
| `solve` | solve | 동사 | 풀다, 해결하다 |  | Can you solve this math problem? | 완료 |
| `somewhat` | somewhat | 부사 | 다소, 약간 |  | The test was somewhat difficult. | 완료 |
| `sore` | sore | 형용사 | 아픈, 쓰린 |  | I have a sore throat. | 완료 |
| `sort` | sort | 명사 | 종류 |  | What sort of music do you like? | 완료 |
| `soul` | soul | 명사 | 영혼 |  | Music is good for the soul. | 완료 |
| `source` | source | 명사 | 원천, 출처 |  | The sun is a source of energy. | 완료 |
| `spare` | spare | 형용사 | 여분의 |  | Do you have a spare pen? | 완료 |
| `species` | species | 명사 | (생물) 종 |  | There are many species of birds. | 완료 |
| `specific` | specific | 형용사 | 구체적인, 특정한 |  | Give me a specific example. | 완료 |
| `spirit` | spirit | 명사 | 정신, 영혼 |  | The team has a strong spirit. | 완료 |
| `spoil` | spoil | 동사 | 망치다, 상하다 |  | The milk spoiled in the sun. | 완료 |
| `sponsor` | sponsor | 명사 | 후원자 |  | The company is a sponsor of the team. | 완료 |
| `spot` | spot | 명사 | 점, 장소 |  | This is a good spot for a picnic. | 완료 |
| `spy` | spy | 명사 | 스파이, 첩자 |  | The movie is about a spy. | 완료 |
| `stable` | stable | 형용사 | 안정된 |  | The ladder is not stable. | 완료 |
| `standard` | standard | 명사 | 기준, 표준 |  | The hotel has high standards. | 완료 |
| `stare` | stare | 동사 | 빤히 쳐다보다 |  | It is rude to stare at people. | 완료 |
| `state` | state | 명사 | 상태, 주(州) |  | The house is in a bad state. | 완료 |
| `steady` | steady | 형용사 | 꾸준한, 안정된 |  | She made steady progress. | 완료 |
| `steal` | steal | 동사 | 훔치다 |  | Someone stole my bike. | 완료 |
| `steel` | steel | 명사 | 강철 |  | The bridge is made of steel. | 완료 |
| `still` | still | 부사 | 아직도, 여전히 |  | It is still raining. | 완료 |
| `stock` | stock | 명사 | 재고, 주식 |  | The shop has a large stock of shoes. | 완료 |
| `strategy` | strategy | 명사 | 전략 |  | Our team needs a new strategy. | 완료 |
| `stress` | stress | 명사 | 스트레스, 강세 |  | Exercise helps reduce stress. | 완료 |
| `structure` | structure | 명사 | 구조, 건축물 |  | The bridge is a huge structure. | 완료 |
| `struggle` | struggle | 동사 | 애쓰다, 싸우다 |  | He struggled to open the jar. | 완료 |
| `studio` | studio | 명사 | 작업실, 스튜디오 |  | The artist works in her studio. | 완료 |
| `stuff` | stuff | 명사 | 물건, 것 |  | Put your stuff in the bag. | 완료 |
| `succeed` | succeed | 동사 | 성공하다 |  | If you try hard, you will succeed. | 완료 |
| `success` | success | 명사 | 성공 |  | The festival was a great success. | 완료 |
| `such` | such | 형용사 | 그러한, 매우 ~한 |  | It was such a nice day. | 완료 |
| `sudden` | sudden | 형용사 | 갑작스러운 |  | There was a sudden noise. | 완료 |
| `suffer` | suffer | 동사 | 고통받다, 겪다 |  | She suffers from headaches. | 완료 |
| `suggest` | suggest | 동사 | 제안하다 |  | I suggest we take a break. | 완료 |
| `sum` | sum | 명사 | 합계, 금액 |  | The sum of two and three is five. | 완료 |
| `super` | super | 형용사 | 대단한, 굉장한 |  | We had a super time at the park. | 완료 |
| `supply` | supply | 동사 | 공급하다 |  | The river supplies water to the town. | 완료 |
| `support` | support | 동사 | 지지하다, 받치다 |  | My family always supports me. | 완료 |
| `suppose` | suppose | 동사 | 생각하다, 가정하다 |  | I suppose you are right. | 완료 |
| `surface` | surface | 명사 | 표면 |  | The surface of the lake is calm. | 완료 |
| `survey` | survey | 명사 | 설문 조사 |  | We did a survey about favorite foods. | 완료 |
| `survive` | survive | 동사 | 살아남다 | 무인도에서 작은 불을 피우고 손을 흔드는 아이 | Plants need water to survive. | 완료 |
| `suspect` | suspect | 동사 | 의심하다 |  | I suspect he is hiding something. | 완료 |
| `swallow` | swallow | 동사 | 삼키다 |  | Chew well before you swallow. | 완료 |
| `system` | system | 명사 | 체계, 시스템 |  | The subway system is easy to use. | 완료 |
| `tale` | tale | 명사 | 이야기 |  | Grandpa told us a fairy tale. | 완료 |
| `tap` | tap | 동사 | 가볍게 두드리다 |  | She tapped me on the shoulder. | 완료 |
| `target` | target | 명사 | 목표, 과녁 |  | The arrow hit the target. | 완료 |
| `tax` | tax | 명사 | 세금 |  | People pay tax to the government. | 완료 |
| `technique` | technique | 명사 | 기법, 기술 |  | She learned a new painting technique. | 완료 |
| `teenage` | teenage | 형용사 | 십 대의 |  | She has two teenage brothers. | 완료 |
| `tend` | tend | 동사 | ~하는 경향이 있다 |  | I tend to wake up early. | 완료 |
| `tense` | tense | 형용사 | 긴장한 |  | I felt tense before the game. | 완료 |
| `term` | term | 명사 | 학기, 용어 |  | The new term starts in March. | 완료 |
| `terrible` | terrible | 형용사 | 끔찍한, 심한 |  | I had a terrible headache. | 완료 |
| `text` | text | 명사 | 글, 문자 |  | Read the text and answer the questions. | 완료 |
| `theory` | theory | 명사 | 이론 |  | He has a theory about the stars. | 완료 |
| `therefore` | therefore | 부사 | 그러므로 |  | It rained; therefore, we stayed home. | 완료 |
| `thief` | thief | 명사 | 도둑 |  | The thief ran away. | 완료 |
| `though` | though | 접속사 | 비록 ~이지만 |  | Though he was tired, he kept working. | 완료 |
| `threat` | threat | 명사 | 위협 |  | Pollution is a threat to the ocean. | 완료 |
| `throat` | throat | 명사 | 목구멍 |  | My throat hurts. | 완료 |
| `thus` | thus | 부사 | 따라서, 이렇게 |  | He studied hard and thus passed the test. | 완료 |
| `tide` | tide | 명사 | 밀물과 썰물, 조수 |  | The tide is coming in. | 완료 |
| `tight` | tight | 형용사 | 꽉 끼는, 단단한 |  | These shoes are too tight. | 완료 |
| `tip` | tip | 명사 | 끝, 조언, 팁 |  | She gave me a tip for studying. | 완료 |
| `tone` | tone | 명사 | 어조, 음색 |  | He spoke in a friendly tone. | 완료 |
| `topic` | topic | 명사 | 주제 |  | The topic of today is animals. | 완료 |
| `total` | total | 명사 | 합계, 총 |  | The total is twenty dollars. | 완료 |
| `tough` | tough | 형용사 | 힘든, 강한 |  | It was a tough game. | 완료 |
| `tour` | tour | 명사 | 여행, 관광 |  | We took a bus tour of the city. | 완료 |
| `toward` | toward | 전치사 | ~쪽으로 |  | He walked toward the door. | 완료 |
| `trace` | trace | 동사 | 따라 그리다, 추적하다 |  | Trace the letters with your pencil. |  |
| `trade` | trade | 명사 | 무역, 거래 |  | Trade between the two countries grew. | 완료 |
| `tradition` | tradition | 명사 | 전통 |  | It is a Korean tradition to bow. | 완료 |
| `transfer` | transfer | 동사 | 옮기다, 갈아타다 |  | Transfer to line two at this station. | 완료 |
| `transport` | transport | 명사 | 수송, 교통수단 |  | I use public transport every day. | 완료 |
| `trap` | trap | 명사 | 덫 |  | The mouse did not go into the trap. | 완료 |
| `treat` | treat | 동사 | 대하다, 치료하다, 대접하다 |  | Treat others kindly. | 완료 |
| `trick` | trick | 명사 | 속임수, 마술 |  | He showed us a card trick. | 완료 |
| `trouble` | trouble | 명사 | 문제, 곤란 |  | I had trouble opening the door. | 완료 |
| `trunk` | trunk | 명사 | 나무 줄기, (자동차) 트렁크, 코끼리 코 |  | The elephant lifted its trunk. | 완료 |
| `trust` | trust | 동사 | 믿다, 신뢰하다 |  | I trust my best friend. | 완료 |
| `truth` | truth | 명사 | 진실 |  | Always tell the truth. | 완료 |
| `tune` | tune | 명사 | 곡조, 선율 |  | She hummed a happy tune. | 완료 |
| `twist` | twist | 동사 | 비틀다, 꼬다 |  | Twist the cap to open the bottle. | 완료 |
| `unit` | unit | 명사 | 단원, 단위 |  | We are on unit three of the book. | 완료 |
| `unite` | unite | 동사 | 합치다, 단결하다 |  | The players united as one team. | 완료 |
| `university` | university | 명사 | 대학교 |  | My brother studies at a university. | 완료 |
| `unless` | unless | 접속사 | ~하지 않으면 |  | You will be late unless you hurry. | 완료 |
| `upon` | upon | 전치사 | ~위에 |  | Once upon a time, there was a king. | 완료 |
| `upper` | upper | 형용사 | 위쪽의 |  | My room is on the upper floor. | 완료 |
| `value` | value | 명사 | 가치 |  | This ring has great value. | 완료 |
| `various` | various | 형용사 | 다양한 |  | The shop sells various kinds of bread. | 완료 |
| `vary` | vary | 동사 | 서로 다르다, 달라지다 |  | Prices vary from shop to shop. | 완료 |
| `vehicle` | vehicle | 명사 | 차량, 탈것 |  | A bus is a large vehicle. | 완료 |
| `version` | version | 명사 | 버전, 판 |  | This is the new version of the game. | 완료 |
| `victim` | victim | 명사 | 피해자 | 넘어진 아이를 다른 아이가 일으켜 주는 장면 | They helped the victims of the flood. | 완료 |
| `villa` | villa | 명사 | 별장, 빌라 |  | They stayed at a villa by the sea. | 완료 |
| `violent` | violent | 형용사 | 폭력적인, 격렬한 | 거센 파도와 번개가 치는 폭풍우 바다(사람 없이) | I do not like violent movies. | 완료 |
| `vision` | vision | 명사 | 시력, 전망 |  | He has good vision. | 완료 |
| `volume` | volume | 명사 | 음량, 부피, 권 |  | Turn down the volume, please. | 완료 |
| `wage` | wage | 명사 | 임금 |  | The workers asked for higher wages. | 완료 |
| `warn` | warn | 동사 | 경고하다 |  | I warned him about the dog. | 완료 |
| `weapon` | weapon | 명사 | 무기 | 박물관 유리장 안의 옛 칼과 방패(사람 없이) | A sword is an old weapon. | 완료 |
| `weigh` | weigh | 동사 | 무게가 ~이다, 무게를 달다 |  | How much do you weigh? | 완료 |
| `whether` | whether | 접속사 | ~인지 아닌지 |  | I do not know whether he will come. | 완료 |
| `while` | while | 접속사 | ~하는 동안 |  | I read a book while I waited. | 완료 |
| `whole` | whole | 형용사 | 전체의 |  | I ate the whole pizza. | 완료 |
| `wild` | wild | 형용사 | 야생의 |  | Wild animals live in the forest. | 완료 |
| `wire` | wire | 명사 | 철사, 전선 |  | The fence is made of wire. | 완료 |
| `wise` | wise | 형용사 | 현명한 |  | My grandmother is very wise. | 완료 |
| `within` | within | 전치사 | ~이내에 |  | Come back within an hour. | 완료 |
| `without` | without | 전치사 | ~없이 |  | I cannot see without my glasses. | 완료 |
| `worth` | worth | 형용사 | ~의 가치가 있는 |  | The book is worth reading. | 완료 |
| `would` | would | 조동사 | ~할 것이다, ~하곤 했다 |  | I would like some water. | 완료 |
| `wound` | wound | 명사 | 상처 |  | The nurse cleaned the wound. | 완료 |

## 6. 고등 추상어 (Lv.6) (844장, 남은 492장)

| id | 단어 | 품사 | 뜻 | 장면(비어 있으면 참고 문장을 그대로 한 장면으로) | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|---|
| `abandon` | abandon | 동사 | 버리다, 포기하다 |  | They had to abandon the sinking ship. | 완료 |
| `aboard` | aboard | 부사 | (배·비행기에) 탑승하여 |  | All the passengers are now aboard. | 완료 |
| `abort` | abort | 동사 | 중단하다 |  | The mission was aborted because of bad weather. | 완료 |
| `abound` | abound | 동사 | 풍부하다, 많이 있다 |  | Fish abound in this river. | 완료 |
| `abroad` | abroad | 부사 | 해외에, 해외로 |  | She wants to study abroad next year. | 완료 |
| `absent` | absent | 형용사 | 결석한, 없는 |  | He was absent from school yesterday. | 완료 |
| `absorb` | absorb | 동사 | 흡수하다 |  | A sponge absorbs water quickly. | 완료 |
| `abstract` | abstract | 형용사 | 추상적인 |  | Love is an abstract idea. |  |
| `absurd` | absurd | 형용사 | 터무니없는 |  | It is absurd to blame the weather for everything. | 완료 |
| `academy` | academy | 명사 | 학원, 학회 |  | She attends a music academy after school. | 완료 |
| `accelerate` | accelerate | 동사 | 가속하다 |  | The car accelerated on the highway. | 완료 |
| `accommodate` | accommodate | 동사 | 수용하다, 숙박시키다 |  | The hotel can accommodate 200 guests. | 완료 |
| `accompany` | accompany | 동사 | 동행하다, 반주하다 |  | I will accompany you to the station. | 완료 |
| `accomplish` | accomplish | 동사 | 성취하다, 해내다 |  | We accomplished our goal in a month. | 완료 |
| `accord` | accord | 명사 | 합의, 일치 |  | The two countries signed a peace accord. | 완료 |
| `accumulate` | accumulate | 동사 | 모으다, 축적하다 |  | Dust accumulated on the shelf. | 완료 |
| `accurate` | accurate | 형용사 | 정확한 |  | The weather forecast was accurate. | 완료 |
| `ache` | ache | 명사 | 아픔, 통증 |  | I have an ache in my back. | 완료 |
| `acid` | acid | 명사 | 산(酸) |  | Lemons contain a lot of acid. | 완료 |
| `acknowledge` | acknowledge | 동사 | 인정하다 |  | He acknowledged that he had made a mistake. | 완료 |
| `acquire` | acquire | 동사 | 얻다, 습득하다 |  | Children acquire language naturally. | 완료 |
| `acquisition` | acquisition | 명사 | 습득, 취득 |  | Language acquisition takes time. | 완료 |
| `addict` | addict | 명사 | 중독자 | 주변에 장난감이 있어도 게임기 화면에서 눈을 못 떼는 아이 | He is a game addict. | 완료 |
| `adequate` | adequate | 형용사 | 충분한, 적절한 |  | Make sure you get adequate sleep. | 완료 |
| `adjust` | adjust | 동사 | 조정하다, 적응하다 |  | Adjust the seat to your height. | 완료 |
| `administer` | administer | 동사 | 관리하다, 집행하다 |  | The office administers the school budget. | 완료 |
| `adolescent` | adolescent | 명사 | 청소년 |  | Adolescents need a lot of sleep. | 완료 |
| `adverse` | adverse | 형용사 | 불리한, 해로운 |  | The drug had no adverse effects. | 완료 |
| `advocate` | advocate | 동사 | 옹호하다, 지지하다 |  | She advocates equal rights for all. |  |
| `aesthetic` | aesthetic | 형용사 | 미적인, 미학의 |  | The building has great aesthetic value. | 완료 |
| `agency` | agency | 명사 | 대행사, 기관 |  | She works for a travel agency. | 완료 |
| `agenda` | agenda | 명사 | 의제, 안건 |  | What is on the agenda for the meeting? | 완료 |
| `aggressive` | aggressive | 형용사 | 공격적인 |  | The dog became aggressive when it was scared. | 완료 |
| `alert` | alert | 형용사 | 경계하는, 기민한 |  | Stay alert while you are driving. | 완료 |
| `alike` | alike | 형용사 | 서로 닮은 |  | The two brothers look alike. | 완료 |
| `allocate` | allocate | 동사 | 할당하다 |  | The school allocated money for new books. | 완료 |
| `ally` | ally | 명사 | 동맹국, 협력자 |  | The two nations became allies. | 완료 |
| `alongside` | alongside | 전치사 | ~와 나란히, ~와 함께 |  | A path runs alongside the river. | 완료 |
| `alternate` | alternate | 동사 | 번갈아 하다 |  | Rainy days alternated with sunny ones. | 완료 |
| `ambassador` | ambassador | 명사 | 대사 |  | The ambassador met the president. | 완료 |
| `ambition` | ambition | 명사 | 야망, 포부 |  | Her ambition is to become a pilot. | 완료 |
| `analyze` | analyze | 동사 | 분석하다 |  | We analyzed the results of the survey. | 완료 |
| `ancient` | ancient | 형용사 | 고대의, 아주 오래된 |  | We visited the ancient temple. | 완료 |
| `anniversary` | anniversary | 명사 | 기념일 |  | Today is our tenth wedding anniversary. | 완료 |
| `anticipate` | anticipate | 동사 | 예상하다, 기대하다 |  | We anticipate a large crowd at the festival. | 완료 |
| `anxiety` | anxiety | 명사 | 불안, 걱정 |  | She felt anxiety before the interview. | 완료 |
| `apology` | apology | 명사 | 사과 |  | Please accept my sincere apology. | 완료 |
| `apparent` | apparent | 형용사 | 분명한, 겉보기의 |  | It was apparent that he was tired. | 완료 |
| `approve` | approve | 동사 | 승인하다, 찬성하다 |  | The teacher approved our project plan. | 완료 |
| `approximate` | approximate | 형용사 | 대략의 |  | What is the approximate cost of the trip? | 완료 |
| `architect` | architect | 명사 | 건축가 |  | The architect designed a new library. | 완료 |
| `arise` | arise | 동사 | 생기다, 발생하다 |  | A problem arose during the meeting. | 완료 |
| `artificial` | artificial | 형용사 | 인공의 |  | The cake has no artificial colors. | 완료 |
| `aspect` | aspect | 명사 | 측면 |  | We discussed every aspect of the plan. | 완료 |
| `aspire` | aspire | 동사 | 열망하다 |  | She aspires to be a great scientist. | 완료 |
| `assault` | assault | 명사 | 폭행, 공격 |  | He was arrested for assault. | 완료 |
| `assemble` | assemble | 동사 | 모이다, 조립하다 |  | We assembled the bookshelf ourselves. | 완료 |
| `assert` | assert | 동사 | 주장하다 |  | She asserted that she was innocent. | 완료 |
| `asset` | asset | 명사 | 자산 |  | Good health is a great asset. | 완료 |
| `assure` | assure | 동사 | 확신시키다, 보장하다 |  | I assure you that everything is fine. | 완료 |
| `astonish` | astonish | 동사 | 깜짝 놀라게 하다 |  | The news astonished everyone. | 완료 |
| `attribute` | attribute | 동사 | ~의 덕분으로 돌리다 |  | She attributes her success to hard work. | 완료 |
| `auction` | auction | 명사 | 경매 |  | The painting was sold at auction. | 완료 |
| `authentic` | authentic | 형용사 | 진짜의, 진품인 |  | This restaurant serves authentic Italian food. | 완료 |
| `available` | available | 형용사 | 이용할 수 있는 |  | Are there any seats available? | 완료 |
| `await` | await | 동사 | 기다리다 |  | A surprise awaits you at home. | 완료 |
| `awe` | awe | 명사 | 경외감 |  | We looked at the mountain in awe. | 완료 |
| `ban` | ban | 동사 | 금지하다 |  | Smoking is banned in this building. | 완료 |
| `bankrupt` | bankrupt | 형용사 | 파산한 |  | The company went bankrupt last year. |  |
| `bargain` | bargain | 명사 | 싸게 산 물건, 흥정 |  | This jacket was a real bargain. | 완료 |
| `barrier` | barrier | 명사 | 장벽, 장애물 |  | Language can be a barrier to communication. | 완료 |
| `beam` | beam | 명사 | 빛줄기, 들보 |  | A beam of light came through the window. | 완료 |
| `beast` | beast | 명사 | 짐승 |  | The lion is called the king of beasts. | 완료 |
| `behalf` | behalf | 명사 | 대신, 이익 |  | I thanked them on behalf of my class. | 완료 |
| `behave` | behave | 동사 | 행동하다 |  | The children behaved well at the museum. | 완료 |
| `betray` | betray | 동사 | 배신하다 |  | He would never betray his friends. | 완료 |
| `bias` | bias | 명사 | 편견, 치우침 |  | A good judge has no bias. | 완료 |
| `biography` | biography | 명사 | 전기(傳記) |  | I read a biography of King Sejong. | 완료 |
| `biology` | biology | 명사 | 생물학 |  | We learned about cells in biology class. |  |
| `blast` | blast | 명사 | 폭발, 돌풍 | 밤하늘에 터지는 불꽃놀이 | A blast of cold wind came through the door. | 완료 |
| `blend` | blend | 동사 | 섞다 |  | Blend the fruit and milk together. | 완료 |
| `blink` | blink | 동사 | 눈을 깜박이다 |  | She blinked in the bright light. | 완료 |
| `bold` | bold | 형용사 | 대담한, 굵은 |  | It was a bold decision to move abroad. | 완료 |
| `boost` | boost | 동사 | 끌어올리다, 북돋우다 |  | The win boosted the team's confidence. | 완료 |
| `border` | border | 명사 | 국경, 가장자리 |  | They crossed the border by train. | 완료 |
| `boundary` | boundary | 명사 | 경계 |  | The river forms the boundary of the park. | 완료 |
| `breed` | breed | 동사 | 기르다, 새끼를 낳다 |  | They breed horses on the farm. | 완료 |
| `breeze` | breeze | 명사 | 산들바람 |  | A cool breeze blew from the sea. | 완료 |
| `broadcast` | broadcast | 동사 | 방송하다 |  | The game will be broadcast live. | 완료 |
| `brute` | brute | 명사 | 짐승 같은 사람 |  | He acted like a brute in the fight. | 완료 |
| `bulk` | bulk | 명사 | 대부분, 큰 부피 |  | The bulk of the work is finished. | 완료 |
| `bully` | bully | 명사 | 괴롭히는 사람 |  | We should stand up to a bully. | 완료 |
| `burden` | burden | 명사 | 부담, 짐 |  | I do not want to be a burden to you. | 완료 |
| `butcher` | butcher | 명사 | 정육점 주인 |  | We bought meat from the butcher. | 완료 |
| `buzz` | buzz | 동사 | 윙윙거리다 |  | Bees buzzed around the flowers. | 완료 |
| `cancel` | cancel | 동사 | 취소하다 |  | The game was canceled because of rain. | 완료 |
| `cancer` | cancer | 명사 | 암 |  | Doctors are looking for a cure for cancer. |  |
| `candidate` | candidate | 명사 | 후보자, 지원자 |  | There are three candidates for class president. | 완료 |
| `capture` | capture | 동사 | 붙잡다, 포착하다 |  | The photo captured a beautiful moment. | 완료 |
| `carve` | carve | 동사 | 조각하다, 새기다 |  | He carved a bear out of wood. | 완료 |
| `cater` | cater | 동사 | 음식을 공급하다, 요구를 채우다 |  | The restaurant caters for large parties. | 완료 |
| `caution` | caution | 명사 | 조심, 주의 |  | Cross the road with caution. | 완료 |
| `cease` | cease | 동사 | 그치다, 중단하다 |  | The rain ceased in the evening. | 완료 |
| `celebrity` | celebrity | 명사 | 유명인 |  | The celebrity waved to her fans. | 완료 |
| `censor` | censor | 동사 | 검열하다 |  | Some scenes were censored from the film. | 완료 |
| `certificate` | certificate | 명사 | 증명서, 자격증 |  | She received a certificate for the course. | 완료 |
| `chamber` | chamber | 명사 | 방, 회의실 |  | The meeting was held in the council chamber. | 완료 |
| `chaos` | chaos | 명사 | 혼돈, 대혼란 |  | The traffic jam caused chaos in the city. | 완료 |
| `charity` | charity | 명사 | 자선, 자선 단체 |  | She gives money to charity every month. | 완료 |
| `chemical` | chemical | 명사 | 화학 물질 |  | Some chemicals are harmful to the skin. | 완료 |
| `chill` | chill | 명사 | 냉기, 한기 |  | There is a chill in the air this morning. | 완료 |
| `chorus` | chorus | 명사 | 합창, 후렴 |  | Everyone joined in the chorus. | 완료 |
| `chronic` | chronic | 형용사 | 만성의 |  | He suffers from chronic back pain. | 완료 |
| `circulate` | circulate | 동사 | 순환하다, 돌다 |  | Blood circulates through the body. | 완료 |
| `cite` | cite | 동사 | 인용하다, 예로 들다 |  | She cited two studies in her report. | 완료 |
| `clash` | clash | 명사 | 충돌 |  | There was a clash between the two groups. | 완료 |
| `clause` | clause | 명사 | 절, 조항 |  | This sentence has two clauses. | 완료 |
| `cling` | cling | 동사 | 달라붙다, 매달리다 |  | The child clung to her mother. | 완료 |
| `cluster` | cluster | 명사 | 무리, 송이 |  | A cluster of stars shone in the sky. | 완료 |
| `coincide` | coincide | 동사 | 동시에 일어나다, 일치하다 |  | My birthday coincides with the holiday. | 완료 |
| `collaborate` | collaborate | 동사 | 협력하다 |  | The two teams collaborated on the project. | 완료 |
| `collapse` | collapse | 동사 | 무너지다 |  | The old bridge collapsed in the storm. | 완료 |
| `colleague` | colleague | 명사 | 동료 |  | She had lunch with her colleagues. | 완료 |
| `colony` | colony | 명사 | 식민지, 군집 |  | The country was once a colony. | 완료 |
| `combat` | combat | 명사 | 전투 |  | The soldiers were trained for combat. | 완료 |
| `commit` | commit | 동사 | 저지르다, 전념하다 |  | He committed himself to helping others. | 완료 |
| `commodity` | commodity | 명사 | 상품, 원자재 |  | Oil is a valuable commodity. | 완료 |
| `communist` | communist | 명사 | 공산주의자 |  | The country was ruled by a communist party. | 완료 |
| `companion` | companion | 명사 | 동반자, 친구 |  | A dog is a loyal companion. | 완료 |
| `compatible` | compatible | 형용사 | 호환되는, 잘 맞는 |  | Is this charger compatible with my phone? | 완료 |
| `compel` | compel | 동사 | 강요하다 |  | The rain compelled us to stay inside. | 완료 |
| `compensate` | compensate | 동사 | 보상하다 |  | The company compensated him for the damage. | 완료 |
| `compete` | compete | 동사 | 경쟁하다 |  | Ten teams will compete in the tournament. | 완료 |
| `compile` | compile | 동사 | 엮다, 편집하다 |  | She compiled a list of useful websites. | 완료 |
| `complement` | complement | 동사 | 보완하다 |  | The sauce complements the fish perfectly. | 완료 |
| `component` | component | 명사 | 구성 요소, 부품 |  | The engine has many components. | 완료 |
| `compose` | compose | 동사 | 구성하다, 작곡하다 |  | He composed a song for his mother. | 완료 |
| `compound` | compound | 명사 | 화합물, 복합체 |  | Water is a compound of hydrogen and oxygen. | 완료 |
| `comprehend` | comprehend | 동사 | 이해하다 |  | I could not comprehend the long sentence. | 완료 |
| `comprise` | comprise | 동사 | 구성되다, 포함하다 |  | The team comprises ten members. | 완료 |
| `compromise` | compromise | 명사 | 타협 |  | After a long talk, they reached a compromise. | 완료 |
| `conceal` | conceal | 동사 | 숨기다 |  | He tried to conceal his feelings. |  |
| `conceive` | conceive | 동사 | 생각해 내다, 상상하다 |  | She conceived the idea during a walk. | 완료 |
| `conclude` | conclude | 동사 | 결론짓다, 끝내다 |  | We concluded that the plan would work. | 완료 |
| `concrete` | concrete | 형용사 | 구체적인, 콘크리트의 |  | Give me a concrete example. | 완료 |
| `condemn` | condemn | 동사 | 비난하다 |  | Many people condemned the unfair decision. | 완료 |
| `conduct` | conduct | 동사 | 실시하다, 지휘하다 |  | The students conducted a survey. | 완료 |
| `confer` | confer | 동사 | 상의하다, 수여하다 |  | The doctors conferred about the patient. | 완료 |
| `confess` | confess | 동사 | 고백하다, 자백하다 |  | He confessed that he had broken the vase. | 완료 |
| `confide` | confide | 동사 | 비밀을 털어놓다 |  | She confided her worries to her sister. | 완료 |
| `confine` | confine | 동사 | 가두다, 한정하다 |  | The bird was confined in a small cage. | 완료 |
| `conform` | conform | 동사 | 따르다, 순응하다 |  | Students must conform to the school rules. | 완료 |
| `confront` | confront | 동사 | 맞서다, 직면하다 |  | She confronted her fear of water. | 완료 |
| `congress` | congress | 명사 | 의회, 회의 |  | The law was passed by congress. | 완료 |
| `conscience` | conscience | 명사 | 양심 |  | My conscience told me to tell the truth. | 완료 |
| `consent` | consent | 명사 | 동의, 허락 |  | You need your parents' consent to join. | 완료 |
| `conserve` | conserve | 동사 | 보존하다, 아끼다 |  | We must conserve water and energy. | 완료 |
| `consist` | consist | 동사 | ~로 이루어지다 |  | The class consists of thirty students. | 완료 |
| `constitute` | constitute | 동사 | 구성하다 |  | Women constitute half of the team. | 완료 |
| `constrain` | constrain | 동사 | 제한하다, 억누르다 |  | Lack of money constrained our plans. | 완료 |
| `consult` | consult | 동사 | 상담하다, 참고하다 |  | You should consult a doctor about that cough. | 완료 |
| `contemporary` | contemporary | 형용사 | 현대의, 동시대의 |  | She likes contemporary art. | 완료 |
| `contend` | contend | 동사 | 주장하다, 겨루다 |  | Three teams are contending for the title. | 완료 |
| `contradict` | contradict | 동사 | 모순되다, 반박하다 |  | His actions contradict his words. | 완료 |
| `contrary` | contrary | 형용사 | 반대의 |  | Contrary to my fears, the test was easy. | 완료 |
| `contrast` | contrast | 명사 | 대조, 차이 |  | There is a sharp contrast between the two cities. | 완료 |
| `controversy` | controversy | 명사 | 논란 |  | The new rule caused a lot of controversy. | 완료 |
| `convene` | convene | 동사 | 소집하다, 모이다 |  | The committee will convene next week. | 완료 |
| `convert` | convert | 동사 | 전환하다, 바꾸다 |  | We converted the garage into a study. | 완료 |
| `convey` | convey | 동사 | 전달하다 |  | Colors can convey different feelings. | 완료 |
| `convict` | convict | 동사 | 유죄를 선고하다 |  | He was convicted of stealing. | 완료 |
| `cooperate` | cooperate | 동사 | 협력하다 |  | Everyone cooperated to clean the park. | 완료 |
| `coordinate` | coordinate | 동사 | 조정하다, 조화시키다 |  | She coordinated the school event. | 완료 |
| `copyright` | copyright | 명사 | 저작권 |  | The song is protected by copyright. | 완료 |
| `cord` | cord | 명사 | 끈, 전선 |  | Do not pull the cord of the lamp. | 완료 |
| `corporate` | corporate | 형용사 | 기업의, 법인의 |  | He works in a corporate office. | 완료 |
| `correspond` | correspond | 동사 | 일치하다, 편지를 주고받다 |  | The results correspond with our guess. | 완료 |
| `corrupt` | corrupt | 형용사 | 부패한 |  | The corrupt official was arrested. | 완료 |
| `counsel` | counsel | 명사 | 조언, 상담 |  | She gave me wise counsel. | 완료 |
| `counterpart` | counterpart | 명사 | 상대방, 대응하는 것 |  | The minister met his Japanese counterpart. | 완료 |
| `coupon` | coupon | 명사 | 쿠폰 |  | I used a coupon to get a free drink. | 완료 |
| `courage` | courage | 명사 | 용기 |  | It takes courage to say sorry. | 완료 |
| `craft` | craft | 명사 | 공예, 기술 |  | She sells her crafts at the market. | 완료 |
| `craze` | craze | 명사 | 열풍, 대유행 |  | The dance became a craze among teenagers. | 완료 |
| `credible` | credible | 형용사 | 믿을 만한 |  | The witness gave a credible account. | 완료 |
| `creep` | creep | 동사 | 살금살금 가다 |  | The cat crept toward the bird. | 완료 |
| `crew` | crew | 명사 | 승무원, 팀 |  | The crew welcomed us onto the plane. | 완료 |
| `criterion` | criterion | 명사 | 기준 |  | Price is one criterion for choosing a phone. |  |
| `critic` | critic | 명사 | 비평가 |  | The critic praised the new film. | 완료 |
| `crucial` | crucial | 형용사 | 결정적인, 매우 중요한 |  | Sleep is crucial for good health. | 완료 |
| `crush` | crush | 동사 | 으깨다, 눌러 부수다 |  | Crush the garlic before you cook it. | 완료 |
| `cultivate` | cultivate | 동사 | 경작하다, 기르다 |  | Farmers cultivate rice in this valley. | 완료 |
| `currency` | currency | 명사 | 통화, 화폐 |  | The won is the currency of Korea. | 완료 |
| `curriculum` | curriculum | 명사 | 교육 과정 |  | Music is part of the school curriculum. |  |
| `curse` | curse | 명사 | 저주, 욕 |  | The witch put a curse on the prince. | 완료 |
| `custody` | custody | 명사 | 양육권, 구금 |  | The mother was given custody of the child. | 완료 |
| `custom` | custom | 명사 | 관습, 풍습 |  | It is a custom to take off shoes at home. | 완료 |
| `cynical` | cynical | 형용사 | 냉소적인 |  | He is cynical about politics. | 완료 |
| `damp` | damp | 형용사 | 축축한 |  | The towel is still damp. | 완료 |
| `dash` | dash | 동사 | 돌진하다, 급히 가다 |  | She dashed to catch the bus. | 완료 |
| `database` | database | 명사 | 데이터베이스 |  | The names are stored in a database. | 완료 |
| `data` | data | 명사 | 자료, 데이터 |  | We collected data from fifty students. | 완료 |
| `decade` | decade | 명사 | 10년 |  | The city has changed a lot in a decade. | 완료 |
| `decay` | decay | 동사 | 썩다, 부패하다 |  | Sugar can cause your teeth to decay. | 완료 |
| `decent` | decent | 형용사 | 괜찮은, 예의 바른 |  | He earns a decent salary. | 완료 |
| `declare` | declare | 동사 | 선언하다, 신고하다 |  | The country declared its independence. | 완료 |
| `decline` | decline | 동사 | 감소하다, 거절하다 |  | The number of students has declined. | 완료 |
| `dedicate` | dedicate | 동사 | 바치다, 헌신하다 |  | She dedicated her life to teaching. | 완료 |
| `defeat` | defeat | 동사 | 이기다, 패배시키다 |  | Our team defeated the champions. | 완료 |
| `defend` | defend | 동사 | 방어하다, 지키다 |  | The players defended their goal well. | 완료 |
| `deficiency` | deficiency | 명사 | 결핍, 부족 |  | A vitamin deficiency can make you tired. | 완료 |
| `deficit` | deficit | 명사 | 적자, 부족액 |  | The company has a large deficit. | 완료 |
| `delegate` | delegate | 명사 | 대표, 대리인 |  | Each school sent two delegates. | 완료 |
| `deliberate` | deliberate | 형용사 | 고의적인, 신중한 |  | It was a deliberate choice, not an accident. | 완료 |
| `delicate` | delicate | 형용사 | 섬세한, 깨지기 쉬운 |  | Be careful with the delicate glass. | 완료 |
| `democracy` | democracy | 명사 | 민주주의 |  | Voting is an important part of democracy. | 완료 |
| `democrat` | democrat | 명사 | 민주주의자, 민주당원 |  | He is a strong democrat. | 완료 |
| `demon` | demon | 명사 | 악마 |  | The hero fought a demon in the story. | 완료 |
| `dense` | dense | 형용사 | 빽빽한, 짙은 |  | We walked through a dense forest. | 완료 |
| `depart` | depart | 동사 | 출발하다, 떠나다 |  | The train departs at six o'clock. | 완료 |
| `depict` | depict | 동사 | 묘사하다, 그리다 |  | The painting depicts a quiet village. | 완료 |
| `deposit` | deposit | 명사 | 예금, 보증금 |  | I made a deposit at the bank. | 완료 |
| `deprive` | deprive | 동사 | 빼앗다 |  | The noise deprived me of sleep. | 완료 |
| `derive` | derive | 동사 | 끌어내다, 유래하다 |  | The word derives from Latin. | 완료 |
| `descend` | descend | 동사 | 내려가다 |  | The plane began to descend. | 완료 |
| `designate` | designate | 동사 | 지정하다 |  | This area is designated as a park. | 완료 |
| `despair` | despair | 명사 | 절망 |  | He cried out in despair. | 완료 |
| `destination` | destination | 명사 | 목적지 |  | We reached our destination at noon. | 완료 |
| `destiny` | destiny | 명사 | 운명 |  | She believes it was her destiny to become a doctor. | 완료 |
| `destruction` | destruction | 명사 | 파괴 |  | The storm caused great destruction. | 완료 |
| `detach` | detach | 동사 | 떼어 내다 |  | Detach the form and send it back. | 완료 |
| `device` | device | 명사 | 장치, 기기 |  | A phone is a useful device. | 완료 |
| `devil` | devil | 명사 | 악마 |  | The devil appears in many old stories. | 완료 |
| `devise` | devise | 동사 | 고안하다 |  | They devised a new way to save water. | 완료 |
| `devote` | devote | 동사 | 바치다, 쏟다 |  | He devotes his weekends to his family. | 완료 |
| `diabetes` | diabetes | 명사 | 당뇨병 |  | People with diabetes must watch their diet. | 완료 |
| `dictate` | dictate | 동사 | 받아쓰게 하다, 지시하다 |  | The teacher dictated a short passage. | 완료 |
| `differ` | differ | 동사 | 다르다 |  | Opinions differ on this issue. | 완료 |
| `dignity` | dignity | 명사 | 존엄, 품위 |  | Everyone deserves to be treated with dignity. | 완료 |
| `dimension` | dimension | 명사 | 치수, 차원 |  | What are the dimensions of the room? | 완료 |
| `diminish` | diminish | 동사 | 줄어들다, 줄이다 |  | The pain diminished after an hour. | 완료 |
| `dine` | dine | 동사 | 식사하다 |  | We dined at a restaurant by the river. | 완료 |
| `dip` | dip | 동사 | 살짝 담그다 |  | Dip the bread in the soup. | 완료 |
| `diplomat` | diplomat | 명사 | 외교관 |  | Her father works as a diplomat in France. | 완료 |
| `disaster` | disaster | 명사 | 재난, 재해 |  | The flood was a terrible disaster. | 완료 |
| `discourse` | discourse | 명사 | 담화, 담론 |  | The book is a discourse on education. | 완료 |
| `discriminate` | discriminate | 동사 | 차별하다, 구별하다 |  | It is wrong to discriminate against anyone. | 완료 |
| `dismiss` | dismiss | 동사 | 해고하다, 묵살하다 |  | The class was dismissed early today. | 완료 |
| `dispute` | dispute | 명사 | 분쟁, 논쟁 |  | The two neighbors settled their dispute. | 완료 |
| `disrupt` | disrupt | 동사 | 방해하다, 지장을 주다 |  | The storm disrupted train services. | 완료 |
| `distinct` | distinct | 형용사 | 뚜렷한, 별개의 |  | The two languages are quite distinct. | 완료 |
| `distinguish` | distinguish | 동사 | 구별하다 |  | Can you distinguish between the twins? | 완료 |
| `distort` | distort | 동사 | 왜곡하다, 비틀다 |  | The mirror distorted my face. | 완료 |
| `distract` | distract | 동사 | 주의를 흩뜨리다 |  | The noise distracted me from my homework. | 완료 |
| `distribute` | distribute | 동사 | 나누어 주다, 분배하다 |  | The teacher distributed the test papers. | 완료 |
| `diverse` | diverse | 형용사 | 다양한 |  | The city has a diverse population. | 완료 |
| `divine` | divine | 형용사 | 신의, 신성한 |  | The temple was a divine place to them. | 완료 |
| `domain` | domain | 명사 | 영역, 분야 |  | This question is outside my domain. | 완료 |
| `dominate` | dominate | 동사 | 지배하다, 우세하다 |  | Our team dominated the second half. | 완료 |
| `dose` | dose | 명사 | (약의) 1회분 |  | Take one dose of the medicine after meals. | 완료 |
| `draft` | draft | 명사 | 초안 |  | I wrote the first draft of my essay. | 완료 |
| `drain` | drain | 동사 | 물을 빼다 |  | Drain the water from the pasta. | 완료 |
| `dread` | dread | 동사 | 몹시 두려워하다 |  | I dread going to the dentist. | 완료 |
| `drown` | drown | 동사 | 물에 빠져 죽다, 익사하다 | 수영장에서 구명 튜브를 던져 주는 안전요원(위험한 모습 없이) | Wear a life jacket so you do not drown. | 완료 |
| `dual` | dual | 형용사 | 이중의 |  | The room serves a dual purpose. | 완료 |
| `dull` | dull | 형용사 | 지루한, 무딘 |  | The lecture was long and dull. | 완료 |
| `dwell` | dwell | 동사 | 살다, 거주하다 |  | They dwell in a small village by the sea. | 완료 |
| `dynamic` | dynamic | 형용사 | 역동적인 |  | Seoul is a dynamic city. |  |
| `eager` | eager | 형용사 | 간절히 바라는, 열심인 |  | The children were eager to open their gifts. | 완료 |
| `efficient` | efficient | 형용사 | 효율적인 |  | This is an efficient way to study. | 완료 |
| `elaborate` | elaborate | 형용사 | 정교한, 공들인 |  | She wore an elaborate costume. | 완료 |
| `electronic` | electronic | 형용사 | 전자의 |  | Turn off all electronic devices. | 완료 |
| `elegant` | elegant | 형용사 | 우아한 |  | She looked elegant in her black dress. | 완료 |
| `elevate` | elevate | 동사 | 올리다, 높이다 |  | Elevate your leg to reduce the swelling. | 완료 |
| `eliminate` | eliminate | 동사 | 제거하다, 탈락시키다 |  | Our team was eliminated in the first round. | 완료 |
| `elite` | elite | 명사 | 엘리트, 최상류층 |  | Only the elite could attend the school. | 완료 |
| `embassy` | embassy | 명사 | 대사관 |  | I went to the embassy to get a visa. | 완료 |
| `embrace` | embrace | 동사 | 껴안다, 받아들이다 |  | The mother embraced her child. | 완료 |
| `emerge` | emerge | 동사 | 나타나다, 드러나다 |  | The sun emerged from behind the clouds. | 완료 |
| `emit` | emit | 동사 | 내뿜다, 방출하다 |  | Cars emit harmful gases. | 완료 |
| `emphasis` | emphasis | 명사 | 강조 |  | The school puts emphasis on reading. | 완료 |
| `encounter` | encounter | 동사 | 마주치다, 맞닥뜨리다 |  | We encountered a deer on the trail. | 완료 |
| `endure` | endure | 동사 | 견디다, 참다 |  | She endured the pain without complaining. | 완료 |
| `enhance` | enhance | 동사 | 높이다, 향상시키다 |  | Good lighting enhances the photo. | 완료 |
| `enterprise` | enterprise | 명사 | 기업, 사업 |  | He started a small enterprise. | 완료 |
| `enthusiastic` | enthusiastic | 형용사 | 열정적인 |  | The fans were enthusiastic about the concert. | 완료 |
| `entry` | entry | 명사 | 입장, 참가, 항목 |  | Entry to the museum is free. | 완료 |
| `envy` | envy | 동사 | 부러워하다 |  | I envy your beautiful voice. | 완료 |
| `equip` | equip | 동사 | 장비를 갖추다 |  | The gym is equipped with new machines. | 완료 |
| `era` | era | 명사 | 시대 |  | We live in the era of the internet. | 완료 |
| `erect` | erect | 동사 | 세우다, 건립하다 |  | They erected a statue in the square. | 완료 |
| `error` | error | 명사 | 오류, 실수 |  | There is an error in your calculation. | 완료 |
| `essence` | essence | 명사 | 본질, 정수 |  | The essence of teamwork is trust. | 완료 |
| `estate` | estate | 명사 | 사유지, 재산 |  | The family owns a large estate. | 완료 |
| `ethic` | ethic | 명사 | 윤리, 도덕 |  | She has a strong work ethic. | 완료 |
| `ethnic` | ethnic | 형용사 | 민족의 |  | The city has many ethnic restaurants. |  |
| `evacuate` | evacuate | 동사 | 대피시키다 | 아이들이 선생님을 따라 줄지어 건물 밖으로 나가는 장면 | People were evacuated from the building. | 완료 |
| `evaluate` | evaluate | 동사 | 평가하다 |  | Teachers evaluate each student's work. | 완료 |
| `inevitable` | inevitable | 형용사 | 피할 수 없는 |  | Change is inevitable as we grow up. | 완료 |
| `evolution` | evolution | 명사 | 진화, 발전 |  | Darwin studied the evolution of animals. | 완료 |
| `evolve` | evolve | 동사 | 진화하다, 발전하다 |  | Languages evolve over time. | 완료 |
| `exaggerate` | exaggerate | 동사 | 과장하다 |  | He tends to exaggerate his stories. | 완료 |
| `exceed` | exceed | 동사 | 넘다, 초과하다 |  | Do not exceed the speed limit. | 완료 |
| `excel` | excel | 동사 | 뛰어나다 |  | She excels at mathematics. | 완료 |
| `excess` | excess | 명사 | 과잉, 초과 |  | An excess of sugar is bad for you. | 완료 |
| `exclude` | exclude | 동사 | 제외하다 |  | The price excludes delivery. | 완료 |
| `executive` | executive | 명사 | 경영진, 임원 |  | She is a senior executive at the bank. | 완료 |
| `exhibit` | exhibit | 동사 | 전시하다 |  | The museum exhibits ancient coins. | 완료 |
| `exotic` | exotic | 형용사 | 이국적인 |  | We tasted exotic fruits on the island. | 완료 |
| `expertise` | expertise | 명사 | 전문 지식 |  | We need her expertise in computers. | 완료 |
| `explicit` | explicit | 형용사 | 명백한, 분명한 |  | The teacher gave explicit instructions. | 완료 |
| `export` | export | 동사 | 수출하다 |  | Korea exports cars to many countries. | 완료 |
| `extent` | extent | 명사 | 정도, 범위 |  | To some extent, I agree with you. | 완료 |
| `external` | external | 형용사 | 외부의 |  | The external walls need painting. | 완료 |
| `extinct` | extinct | 형용사 | 멸종한 |  | Dinosaurs became extinct long ago. | 완료 |
| `extract` | extract | 동사 | 뽑아내다, 추출하다 |  | They extract oil from the seeds. | 완료 |
| `extraordinary` | extraordinary | 형용사 | 비범한, 놀라운 |  | She has an extraordinary memory. | 완료 |
| `facilitate` | facilitate | 동사 | 쉽게 하다, 촉진하다 |  | Technology facilitates communication. | 완료 |
| `facility` | facility | 명사 | 시설 |  | The school has excellent sports facilities. | 완료 |
| `faculty` | faculty | 명사 | 교수진, 능력 |  | She joined the faculty of the university. | 완료 |
| `fade` | fade | 동사 | 바래다, 서서히 사라지다 |  | The color faded in the sun. | 완료 |
| `false` | false | 형용사 | 틀린, 거짓의 |  | Is this sentence true or false? | 완료 |
| `fame` | fame | 명사 | 명성 |  | The singer gained fame overnight. |  |
| `fare` | fare | 명사 | (교통) 요금 |  | The bus fare went up this year. | 완료 |
| `fate` | fate | 명사 | 운명 |  | Nobody knows what fate has in store. | 완료 |
| `federal` | federal | 형용사 | 연방의 |  | It is against federal law. | 완료 |
| `fertile` | fertile | 형용사 | 비옥한 |  | The valley has fertile soil. | 완료 |
| `fiber` | fiber | 명사 | 섬유, 섬유질 |  | Vegetables are rich in fiber. | 완료 |
| `fiction` | fiction | 명사 | 소설, 허구 |  | I enjoy reading science fiction. | 완료 |
| `fierce` | fierce | 형용사 | 사나운, 격렬한 |  | A fierce wind blew all night. | 완료 |
| `filter` | filter | 명사 | 여과 장치, 필터 |  | Change the water filter every month. | 완료 |
| `finite` | finite | 형용사 | 유한한 |  | The earth has finite resources. | 완료 |
| `flavor` | flavor | 명사 | 맛, 풍미 |  | Which flavor of ice cream do you want? | 완료 |
| `flaw` | flaw | 명사 | 결함, 흠 |  | There is a small flaw in the glass. | 완료 |
| `flee` | flee | 동사 | 달아나다 |  | The deer fled into the woods. | 완료 |
| `flesh` | flesh | 명사 | 살, 과육 |  | The flesh of the peach is soft. | 완료 |
| `flexible` | flexible | 형용사 | 유연한, 융통성 있는 |  | My work hours are flexible. | 완료 |
| `flip` | flip | 동사 | 뒤집다 |  | Flip the pancake when it turns brown. | 완료 |
| `flourish` | flourish | 동사 | 번창하다 |  | The town flourished because of trade. | 완료 |
| `flush` | flush | 동사 | 물을 내리다, 붉어지다 |  | Do not forget to flush the toilet. | 완료 |
| `fond` | fond | 형용사 | 좋아하는 |  | I am very fond of my grandmother. | 완료 |
| `forbid` | forbid | 동사 | 금지하다 |  | The school forbids phones in class. | 완료 |
| `forecast` | forecast | 명사 | 예보, 예측 |  | The weather forecast says it will snow. | 완료 |
| `format` | format | 명사 | 형식 |  | Save the file in a different format. | 완료 |
| `former` | former | 형용사 | 이전의 |  | He is a former teacher of mine. | 완료 |
| `formula` | formula | 명사 | 공식 |  | Learn the formula for the area of a circle. | 완료 |
| `foster` | foster | 동사 | 기르다, 육성하다 |  | Reading fosters imagination. | 완료 |
| `framework` | framework | 명사 | 틀, 뼈대 |  | We need a clear framework for the project. | 완료 |
| `frequent` | frequent | 형용사 | 잦은, 빈번한 |  | She is a frequent visitor to the library. | 완료 |
| `frost` | frost | 명사 | 서리 |  | The grass was white with frost. | 완료 |
| `fuel` | fuel | 명사 | 연료 |  | The car ran out of fuel. | 완료 |
| `fulfil` | fulfil | 동사 | 이행하다, 달성하다 |  | She fulfilled her dream of becoming a pilot. | 완료 |
| `fundamental` | fundamental | 형용사 | 근본적인, 기본적인 |  | Reading is a fundamental skill. | 완료 |
| `funeral` | funeral | 명사 | 장례식 |  | Many people attended the funeral. | 완료 |
| `furnish` | furnish | 동사 | 가구를 갖추다, 제공하다 |  | The room is furnished with a desk and a bed. | 완료 |
| `furthermore` | furthermore | 부사 | 게다가 |  | The plan is cheap; furthermore, it is simple. | 완료 |
| `fury` | fury | 명사 | 격분, 분노 |  | He slammed the door in fury. | 완료 |
| `fuse` | fuse | 명사 | 퓨즈, 도화선 |  | The fuse blew and the lights went out. | 완료 |
| `gamble` | gamble | 동사 | 도박하다, 모험하다 | 주사위 두 개와 카드 몇 장(숫자·글자 없이 무늬만) | He gambled all his money away. | 완료 |
| `gang` | gang | 명사 | 패거리, 무리 |  | A gang of boys ran down the street. | 완료 |
| `gap` | gap | 명사 | 틈, 격차 |  | Mind the gap between the train and the platform. | 완료 |
| `gasoline` | gasoline | 명사 | 휘발유 |  | The price of gasoline keeps rising. |  |
| `gaze` | gaze | 동사 | 응시하다 |  | She gazed at the stars for hours. | 완료 |
| `gender` | gender | 명사 | 성, 성별 |  | Jobs should be open to every gender. |  |
| `gene` | gene | 명사 | 유전자 |  | Eye color is decided by genes. | 완료 |
| `generate` | generate | 동사 | 만들어 내다, 발생시키다 |  | Wind turbines generate electricity. |  |
| `genius` | genius | 명사 | 천재 |  | Einstein was a genius. |  |
| `genuine` | genuine | 형용사 | 진짜의, 진심의 |  | This bag is made of genuine leather. |  |
| `geography` | geography | 명사 | 지리학 |  | We studied rivers in geography class. |  |
| `geology` | geology | 명사 | 지질학 |  | Geology is the study of rocks and the earth. |  |
| `glare` | glare | 동사 | 노려보다, 눈부시게 빛나다 |  | She glared at him angrily. |  |
| `glow` | glow | 동사 | 빛나다, 은은히 빛을 내다 |  | The fire glowed in the dark. |  |
| `grasp` | grasp | 동사 | 꽉 잡다, 이해하다 |  | He grasped the rope with both hands. |  |
| `grave` | grave | 명사 | 무덤 |  | We put flowers on the grave. |  |
| `greed` | greed | 명사 | 탐욕 |  | His greed for money ruined him. |  |
| `grief` | grief | 명사 | 큰 슬픔 |  | She was filled with grief after the loss. |  |
| `grip` | grip | 동사 | 꽉 쥐다 |  | Grip the bat tightly. |  |
| `gross` | gross | 형용사 | 총, 역겨운 |  | The gross income was ten million won. |  |
| `guardian` | guardian | 명사 | 보호자, 수호자 |  | A parent or guardian must sign the form. |  |
| `guideline` | guideline | 명사 | 지침 |  | Follow the safety guidelines. |  |
| `gulf` | gulf | 명사 | 만, 큰 격차 |  | The ship sailed across the gulf. |  |
| `gymnasium` | gymnasium | 명사 | 체육관 |  | We play basketball in the gymnasium. |  |
| `halt` | halt | 동사 | 멈추다 |  | The bus halted at the red light. |  |
| `handicap` | handicap | 명사 | 장애, 불리한 조건 |  | He overcame his handicap and won the race. |  |
| `harmony` | harmony | 명사 | 조화, 화음 |  | The choir sang in perfect harmony. |  |
| `harsh` | harsh | 형용사 | 가혹한, 거친 |  | The desert has a harsh climate. |  |
| `haunt` | haunt | 동사 | (유령이) 출몰하다, 계속 떠오르다 |  | People say a ghost haunts the old house. |  |
| `hazard` | hazard | 명사 | 위험 요소 |  | Ice on the road is a hazard. |  |
| `headquarters` | headquarters | 명사 | 본부, 본사 |  | The company headquarters is in Seoul. |  |
| `heal` | heal | 동사 | 낫다, 치유하다 |  | The cut on my finger healed quickly. |  |
| `heel` | heel | 명사 | 발뒤꿈치, 굽 |  | I have a blister on my heel. |  |
| `heir` | heir | 명사 | 상속인, 후계자 |  | The prince is the heir to the throne. |  |
| `hence` | hence | 부사 | 그러므로 |  | It rained all week; hence the flood. |  |
| `heritage` | heritage | 명사 | 유산 |  | The temple is part of our cultural heritage. |  |
| `hierarchy` | hierarchy | 명사 | 계급, 위계 |  | There is a clear hierarchy in the army. |  |
| `highlight` | highlight | 동사 | 강조하다 |  | Highlight the important words in yellow. |  |
| `holy` | holy | 형용사 | 신성한 |  | This is a holy place for many people. |  |
| `horror` | horror | 명사 | 공포 |  | I do not like horror movies. |  |
| `host` | host | 명사 | 주인, 진행자 |  | The host welcomed the guests warmly. |  |
| `hostile` | hostile | 형용사 | 적대적인 |  | The two groups were hostile to each other. |  |
| `household` | household | 명사 | 가정, 가구 |  | Most households have a computer. |  |
| `hypothesis` | hypothesis | 명사 | 가설 |  | The experiment proved the hypothesis. |  |
| `ideal` | ideal | 형용사 | 이상적인 |  | This is an ideal place for a picnic. |  |
| `identical` | identical | 형용사 | 똑같은 |  | The two pictures look identical. |  |
| `ideology` | ideology | 명사 | 이념 |  | The two parties have different ideologies. |  |
| `illusion` | illusion | 명사 | 환상, 착각 |  | The magician created an illusion. |  |
| `imitate` | imitate | 동사 | 모방하다, 흉내 내다 |  | Children imitate their parents. |  |
| `immense` | immense | 형용사 | 엄청난 |  | The universe is immense. |  |
| `immigrate` | immigrate | 동사 | 이민 오다 |  | His family immigrated to Canada. |  |
| `immune` | immune | 형용사 | 면역의 |  | Sleep keeps your immune system strong. |  |
| `impact` | impact | 명사 | 영향, 충격 |  | Social media has a big impact on teenagers. |  |
| `imperial` | imperial | 형용사 | 제국의, 황제의 |  | We visited the imperial palace. |  |
| `implement` | implement | 동사 | 실행하다 |  | The school implemented a new rule. |  |
| `imply` | imply | 동사 | 암시하다 |  | His silence implied that he agreed. |  |
| `import` | import | 동사 | 수입하다 |  | Korea imports oil from other countries. |  |
| `impose` | impose | 동사 | 부과하다, 강요하다 |  | The city imposed a fine for littering. |  |
| `incentive` | incentive | 명사 | 장려책, 동기 |  | Prizes are an incentive to study harder. |  |
| `incident` | incident | 명사 | 사건 |  | The incident happened late at night. |  |
| `incline` | incline | 동사 | ~하는 경향이 있다, 기울다 |  | I am inclined to agree with you. |  |
| `incorporate` | incorporate | 동사 | 포함하다, 통합하다 |  | The design incorporates students' ideas. |  |
| `index` | index | 명사 | 색인, 지수 |  | Look up the word in the index. |  |
| `induce` | induce | 동사 | 유도하다, 일으키다 |  | Warm milk can induce sleep. |  |
| `infant` | infant | 명사 | 유아, 아기 |  | The infant slept in her mother's arms. |  |
| `infect` | infect | 동사 | 감염시키다 |  | The virus infected many people. |  |
| `infer` | infer | 동사 | 추론하다 |  | What can you infer from the passage? |  |
| `inflate` | inflate | 동사 | 부풀리다 |  | He inflated the balloons for the party. |  |
| `inhabit` | inhabit | 동사 | 살다, 서식하다 |  | Many birds inhabit the island. |  |
| `inherent` | inherent | 형용사 | 내재하는, 타고난 |  | There are risks inherent in every sport. |  |
| `inhibit` | inhibit | 동사 | 억제하다 |  | Fear can inhibit learning. |  |
| `initial` | initial | 형용사 | 처음의 |  | My initial plan was to go by train. |  |
| `inject` | inject | 동사 | 주사하다, 주입하다 |  | The nurse injected the medicine into his arm. |  |
| `inn` | inn | 명사 | 여관 |  | We stayed at a small inn in the village. |  |
| `innovate` | innovate | 동사 | 혁신하다 |  | Companies must innovate to survive. |  |
| `input` | input | 명사 | 투입, 입력 |  | We need more input from the students. |  |
| `inquire` | inquire | 동사 | 문의하다 |  | I called to inquire about the price. |  |
| `insert` | insert | 동사 | 끼워 넣다 |  | Insert a coin into the machine. |  |
| `insight` | insight | 명사 | 통찰력 |  | The book gave me insight into her life. |  |
| `inspire` | inspire | 동사 | 영감을 주다, 격려하다 |  | Her story inspired me to try harder. |  |
| `install` | install | 동사 | 설치하다 |  | I installed a new app on my phone. |  |
| `instinct` | instinct | 명사 | 본능 |  | Birds fly south by instinct. |  |
| `institute` | institute | 명사 | 연구소, 기관 |  | She works at a research institute. |  |
| `insult` | insult | 동사 | 모욕하다 |  | He did not mean to insult you. |  |
| `integrate` | integrate | 동사 | 통합하다 |  | The app integrates maps and photos. |  |
| `intellect` | intellect | 명사 | 지성, 지적 능력 |  | She is a woman of great intellect. |  |
| `intelligent` | intelligent | 형용사 | 똑똑한, 지능이 있는 |  | Dolphins are intelligent animals. |  |
| `interfere` | interfere | 동사 | 간섭하다, 방해하다 |  | Do not interfere in other people's business. |  |
| `interior` | interior | 명사 | 내부, 실내 |  | The interior of the car is clean. |  |
| `intermediate` | intermediate | 형용사 | 중간의, 중급의 |  | This class is for intermediate learners. |  |
| `interpret` | interpret | 동사 | 해석하다, 통역하다 |  | How do you interpret this poem? |  |
| `interval` | interval | 명사 | 간격 |  | Buses come at ten-minute intervals. |  |
| `intervene` | intervene | 동사 | 개입하다 |  | The teacher intervened to stop the fight. |  |
| `intimate` | intimate | 형용사 | 친밀한 |  | They are intimate friends. |  |
| `intrigue` | intrigue | 동사 | 호기심을 불러일으키다 |  | The mystery intrigued the detective. |  |
| `invade` | invade | 동사 | 침략하다, 침입하다 |  | The army invaded the neighboring country. |  |
| `irony` | irony | 명사 | 아이러니, 반어 |  | The irony is that the fire station burned down. |  |
| `irritate` | irritate | 동사 | 짜증 나게 하다, 자극하다 |  | The smoke irritated my eyes. |  |
| `isolate` | isolate | 동사 | 고립시키다, 격리하다 |  | The village was isolated by heavy snow. |  |
| `jail` | jail | 명사 | 감옥 | 창살문이 달린 빈 방과 열쇠 꾸러미(사람 없이) | He spent two years in jail. |  |
| `joint` | joint | 명사 | 관절, 이음매 |  | My knee joint hurts when I run. |  |
| `journal` | journal | 명사 | 일기, 학술지 |  | She writes in her journal every night. |  |
| `jury` | jury | 명사 | 배심원단 |  | The jury found him not guilty. |  |
| `keen` | keen | 형용사 | 열심인, 예리한 |  | He is keen on learning to swim. |  |
| `lap` | lap | 명사 | 무릎, 한 바퀴 |  | The cat sat on my lap. |  |
| `latter` | latter | 형용사 | 후자의, 후반의 |  | Of tea and coffee, I prefer the latter. |  |
| `leak` | leak | 동사 | 새다 |  | Water is leaking from the pipe. |  |
| `lease` | lease | 명사 | 임대차 계약 |  | We signed a two-year lease on the apartment. |  |
| `lecture` | lecture | 명사 | 강의 |  | The professor gave a lecture on history. |  |
| `legend` | legend | 명사 | 전설 |  | There is a legend about a dragon in this lake. |  |
| `legislate` | legislate | 동사 | 법률을 제정하다 |  | The government legislated to protect workers. |  |
| `legitimate` | legitimate | 형용사 | 정당한, 합법적인 |  | She had a legitimate reason for being late. |  |
| `leisure` | leisure | 명사 | 여가 |  | What do you do in your leisure time? |  |
| `liberal` | liberal | 형용사 | 자유로운, 진보적인 |  | Her parents have liberal views. |  |
| `liberty` | liberty | 명사 | 자유 |  | People fought for their liberty. |  |
| `likewise` | likewise | 부사 | 마찬가지로 |  | He bowed, and I did likewise. |  |
| `linguistic` | linguistic | 형용사 | 언어의 |  | Children have amazing linguistic ability. |  |
| `literature` | literature | 명사 | 문학 |  | She studies English literature. |  |
| `logic` | logic | 명사 | 논리 |  | I cannot follow the logic of his argument. |  |
| `lone` | lone | 형용사 | 혼자의, 단 하나의 |  | A lone tree stood on the hill. |  |
| `loyal` | loyal | 형용사 | 충실한 |  | A dog is loyal to its owner. |  |
| `lump` | lump | 명사 | 덩어리, 혹 |  | There is a lump of sugar in the tea. |  |
| `luxury` | luxury | 명사 | 사치, 호화로움 |  | They stayed in a luxury hotel. |  |
| `magnificent` | magnificent | 형용사 | 웅장한, 훌륭한 |  | The view from the top was magnificent. |  |
| `manifest` | manifest | 동사 | 나타내다, 드러내다 |  | His fear manifested itself as anger. |  |
| `manipulate` | manipulate | 동사 | 조종하다, 조작하다 |  | He tried to manipulate the results. |  |
| `margin` | margin | 명사 | 여백, 차이 |  | Write your notes in the margin. |  |
| `marine` | marine | 형용사 | 바다의, 해양의 |  | She studies marine animals. |  |
| `mature` | mature | 형용사 | 성숙한 |  | She is very mature for her age. |  |
| `mayor` | mayor | 명사 | 시장(市長) |  | The mayor opened the new library. |  |
| `meanwhile` | meanwhile | 부사 | 그동안에, 한편 |  | I cooked dinner; meanwhile, he set the table. |  |
| `mechanism` | mechanism | 명사 | 기계 장치, 구조 |  | The clock has a complex mechanism. |  |
| `mediate` | mediate | 동사 | 중재하다 |  | A teacher mediated between the two students. |  |
| `medieval` | medieval | 형용사 | 중세의 |  | We visited a medieval castle. |  |
| `merchant` | merchant | 명사 | 상인 |  | The merchant sold silk and spices. |  |
| `mere` | mere | 형용사 | 단지 ~에 불과한 |  | He was a mere child at the time. |  |
| `merge` | merge | 동사 | 합치다, 합병하다 |  | The two companies merged last year. |  |
| `merit` | merit | 명사 | 장점, 가치 |  | Each plan has its own merits. |  |
| `metropolitan` | metropolitan | 형용사 | 대도시의 |  | Seoul is a large metropolitan area. |  |
| `migrate` | migrate | 동사 | 이동하다, 이주하다 |  | Birds migrate south in winter. |  |
| `mild` | mild | 형용사 | 온화한, 순한 |  | We had a mild winter this year. |  |
| `mine` | mine | 명사 | 광산 |  | Gold was found in the old mine. |  |
| `mineral` | mineral | 명사 | 광물, 무기질 |  | Milk contains important minerals. |  |
| `minimal` | minimal | 형용사 | 최소의, 아주 적은 |  | The storm caused minimal damage. |  |
| `minimum` | minimum | 명사 | 최소 |  | You need a minimum of eight hours of sleep. |  |
| `ministry` | ministry | 명사 | (정부의) 부처 |  | He works for the Ministry of Education. |  |
| `miracle` | miracle | 명사 | 기적 |  | It was a miracle that no one was hurt. |  |
| `missile` | missile | 명사 | 미사일 |  | The army tested a new missile. |  |
| `mobile` | mobile | 형용사 | 이동하는, 움직일 수 있는 |  | Most people carry a mobile phone. |  |
| `mock` | mock | 동사 | 놀리다, 조롱하다 |  | It is unkind to mock others. |  |
| `mode` | mode | 명사 | 방식, 모드 |  | Put your phone on silent mode. |  |
| `modify` | modify | 동사 | 수정하다, 변경하다 |  | We modified the plan slightly. |  |
| `moderate` | moderate | 형용사 | 적당한, 온건한 |  | Cook the soup over moderate heat. |  |
| `modest` | modest | 형용사 | 겸손한, 수수한 |  | She is modest about her success. |  |
| `moist` | moist | 형용사 | 촉촉한 |  | The cake is soft and moist. |  |
| `molecule` | molecule | 명사 | 분자 |  | A water molecule has three atoms. |  |
| `mortal` | mortal | 형용사 | 죽을 운명의, 치명적인 | 시든 꽃과 옆에서 새로 돋는 새싹 | All humans are mortal. |  |
| `motive` | motive | 명사 | 동기 |  | What was his motive for helping us? |  |
| `multiple` | multiple | 형용사 | 다수의, 복합적인 |  | There are multiple ways to solve it. |  |
| `mutual` | mutual | 형용사 | 서로의, 공통의 |  | Friendship is based on mutual respect. |  |
| `myth` | myth | 명사 | 신화, 근거 없는 믿음 |  | There is a Greek myth about the sun. |  |
| `naive` | naive | 형용사 | 순진한 |  | It was naive of me to believe him. |  |
| `naked` | naked | 형용사 | 벌거벗은 | 거품 가득한 욕조에서 어깨까지 잠겨 웃는 아기 | The stars are visible to the naked eye. |  |
| `narrate` | narrate | 동사 | 이야기하다, 서술하다 |  | An old man narrates the story. |  |
| `nasty` | nasty | 형용사 | 고약한, 불쾌한 |  | The medicine has a nasty taste. |  |
| `negative` | negative | 형용사 | 부정적인, 음성의 |  | Try not to have negative thoughts. |  |
| `neglect` | neglect | 동사 | 소홀히 하다, 방치하다 |  | Do not neglect your health. |  |
| `negotiate` | negotiate | 동사 | 협상하다 |  | They negotiated a lower price. |  |
| `nephew` | nephew | 명사 | 남자 조카 |  | My nephew is five years old. |  |
| `network` | network | 명사 | 망, 네트워크 |  | The city has a good bus network. |  |
| `neutral` | neutral | 형용사 | 중립의 |  | The judge must remain neutral. |  |
| `nevertheless` | nevertheless | 부사 | 그럼에도 불구하고 |  | It was raining; nevertheless, we went out. |  |
| `nightmare` | nightmare | 명사 | 악몽 |  | I had a nightmare last night. |  |
| `noble` | noble | 형용사 | 고귀한, 귀족의 |  | It was a noble act to save the child. |  |
| `nominate` | nominate | 동사 | 지명하다, 추천하다 |  | She was nominated for the best actor award. |  |
| `nonetheless` | nonetheless | 부사 | 그렇더라도 |  | The task was hard; nonetheless, he finished it. |  |
| `norm` | norm | 명사 | 규범, 표준 |  | Wearing a uniform is the norm at our school. |  |
| `nuclear` | nuclear | 형용사 | 원자력의, 핵의 |  | The country uses nuclear power. |  |
| `numerous` | numerous | 형용사 | 수많은 |  | She has won numerous awards. |  |
| `obey` | obey | 동사 | 따르다, 복종하다 |  | Drivers must obey the traffic rules. |  |
| `oblige` | oblige | 동사 | 의무를 지우다, 돕다 |  | Students are obliged to wear uniforms. |  |
| `obsess` | obsess | 동사 | 사로잡다, 집착하게 하다 |  | He is obsessed with video games. |  |
| `obtain` | obtain | 동사 | 얻다, 획득하다 |  | You can obtain a ticket at the door. |  |
| `occupy` | occupy | 동사 | 차지하다, 점령하다 |  | The piano occupies half the room. |  |
| `offend` | offend | 동사 | 기분을 상하게 하다 |  | I did not mean to offend you. |  |
| `opportunity` | opportunity | 명사 | 기회 |  | This is a great opportunity to learn. |  |
| `option` | option | 명사 | 선택, 선택권 |  | You have two options: stay or leave. |  |
| `optimist` | optimist | 명사 | 낙천주의자 |  | An optimist always sees the bright side. |  |
| `oral` | oral | 형용사 | 구두의, 입의 |  | We have an oral test in English tomorrow. |  |
| `organ` | organ | 명사 | 장기, 오르간 |  | The heart is a vital organ. |  |
| `orient` | orient | 동사 | 방향을 맞추다, 적응시키다 |  | It took time to orient myself in the new city. |  |
| `origin` | origin | 명사 | 기원, 출신 |  | What is the origin of this word? |  |
| `outcome` | outcome | 명사 | 결과 |  | We are waiting for the outcome of the vote. |  |
| `outline` | outline | 명사 | 개요, 윤곽 |  | Write an outline before you start your essay. |  |
| `output` | output | 명사 | 생산량, 출력 |  | The factory doubled its output. |  |
| `outrage` | outrage | 명사 | 격분, 분노 |  | The decision caused public outrage. |  |
| `outstanding` | outstanding | 형용사 | 뛰어난 |  | She is an outstanding student. |  |
| `overcome` | overcome | 동사 | 극복하다 |  | He overcame his fear of speaking. |  |
| `overhead` | overhead | 부사 | 머리 위에 |  | A plane flew overhead. |  |
| `overlook` | overlook | 동사 | 간과하다, 내려다보다 |  | The hotel overlooks the sea. |  |
| `overnight` | overnight | 부사 | 밤사이에, 하룻밤 동안 |  | It snowed overnight. |  |
| `overseas` | overseas | 부사 | 해외로, 해외에 |  | My uncle works overseas. |  |
| `overwhelm` | overwhelm | 동사 | 압도하다 |  | She was overwhelmed by the amount of homework. |  |
| `owe` | owe | 동사 | 빚지다, 신세를 지다 |  | I owe you five dollars. |  |
| `pace` | pace | 명사 | 속도, 걸음 |  | Walk at your own pace. |  |
| `pad` | pad | 명사 | 패드, 메모장 |  | Write the number on the note pad. |  |
| `pale` | pale | 형용사 | 창백한, 옅은 |  | You look pale. Are you all right? |  |
| `panel` | panel | 명사 | 판, 토론자단 |  | A panel of experts answered the questions. |  |
| `parliament` | parliament | 명사 | 의회, 국회 |  | The law was passed by parliament. |  |
| `participate` | participate | 동사 | 참가하다 |  | Everyone participated in the game. |  |
| `particle` | particle | 명사 | 입자, 작은 조각 |  | Dust particles floated in the air. |  |
| `passage` | passage | 명사 | 글의 한 단락, 통로 |  | Read the passage and answer the questions. |  |
| `passion` | passion | 명사 | 열정 |  | She has a passion for music. |  |
| `patch` | patch | 명사 | 헝겊 조각, 작은 땅 |  | She sewed a patch on her jeans. |  |
| `patent` | patent | 명사 | 특허 |  | He got a patent for his invention. |  |
| `pave` | pave | 동사 | (길을) 포장하다 |  | The road was paved last year. |  |
| `peasant` | peasant | 명사 | 소작농, 농민 |  | The peasants worked in the fields all day. |  |
| `peer` | peer | 명사 | 또래, 동료 |  | Teenagers are influenced by their peers. |  |
| `penalty` | penalty | 명사 | 벌칙, 처벌 | 축구 심판이 노란 카드를 들어 보이는 장면 | The penalty for speeding is a fine. |  |
| `perceive` | perceive | 동사 | 인지하다, 알아차리다 |  | Dogs perceive sounds that we cannot hear. |  |
| `permanent` | permanent | 형용사 | 영구적인 |  | He found a permanent job. |  |
| `permit` | permit | 동사 | 허락하다 |  | Photography is not permitted in the museum. |  |
| `persist` | persist | 동사 | 고집하다, 지속되다 |  | If the pain persists, see a doctor. |  |
| `perspective` | perspective | 명사 | 관점, 시각 |  | Try to see it from her perspective. |  |
| `persuade` | persuade | 동사 | 설득하다 |  | I persuaded my parents to get a dog. |  |
| `phase` | phase | 명사 | 단계, 국면 |  | The project is in its final phase. |  |
| `phenomenon` | phenomenon | 명사 | 현상 |  | A rainbow is a natural phenomenon. |  |
| `philosophy` | philosophy | 명사 | 철학 |  | She studies philosophy at university. |  |
| `phrase` | phrase | 명사 | 구, 구절 |  | Learn this useful phrase by heart. |  |
| `physics` | physics | 명사 | 물리학 |  | We learned about light in physics class. |  |
| `pinch` | pinch | 동사 | 꼬집다 |  | She pinched my arm to wake me up. |  |
| `pioneer` | pioneer | 명사 | 개척자, 선구자 |  | She was a pioneer in computer science. |  |
| `plot` | plot | 명사 | 줄거리, 음모 |  | The plot of the movie was exciting. |  |
| `polish` | polish | 동사 | 닦다, 윤을 내다 |  | He polished his shoes until they shone. |  |
| `poll` | poll | 명사 | 여론 조사, 투표 |  | The poll shows that most students like the idea. |  |
| `populate` | populate | 동사 | 거주하다, 살다 |  | The island is populated by fishermen. |  |
| `portion` | portion | 명사 | 부분, 1인분 |  | The restaurant serves large portions. |  |
| `pose` | pose | 동사 | 자세를 취하다, (문제를) 제기하다 |  | They posed for a photo in front of the tower. |  |
| `position` | position | 명사 | 위치, 입장, 자리 |  | What position do you play on the team? |  |
| `preach` | preach | 동사 | 설교하다 |  | He preaches kindness to everyone. |  |
| `precede` | precede | 동사 | 앞서다, 선행하다 |  | A short speech preceded the concert. |  |
| `precise` | precise | 형용사 | 정확한, 정밀한 |  | Can you give me the precise time? |  |
| `predator` | predator | 명사 | 포식자 |  | Lions are powerful predators. |  |
| `prejudice` | prejudice | 명사 | 편견 |  | We should fight against prejudice. |  |
| `premium` | premium | 명사 | 할증금, 보험료 |  | Customers pay a premium for faster delivery. |  |
| `prescribe` | prescribe | 동사 | 처방하다 |  | The doctor prescribed some medicine for my cough. |  |
| `preserve` | preserve | 동사 | 보존하다 |  | We must preserve the forest for the future. |  |
| `preside` | preside | 동사 | (회의를) 주재하다 |  | The principal presided over the meeting. |  |
| `presume` | presume | 동사 | 추정하다 |  | I presume that she is at home. |  |
| `prevail` | prevail | 동사 | 우세하다, 널리 퍼지다 |  | Justice will prevail in the end. |  |
| `prey` | prey | 명사 | 먹이, 사냥감 |  | The eagle caught its prey. |  |
| `priest` | priest | 명사 | 성직자, 사제 |  | The priest spoke to the people in the church. |  |
| `primitive` | primitive | 형용사 | 원시의 |  | Primitive people used stone tools. |  |
| `principal` | principal | 명사 | 교장 |  | The principal gave a speech at the ceremony. |  |
| `prior` | prior | 형용사 | 이전의, 사전의 |  | No prior experience is needed for this job. |  |
| `privilege` | privilege | 명사 | 특권, 특혜 |  | It is a privilege to work with you. |  |
| `professor` | professor | 명사 | 교수 |  | The professor explained the theory clearly. |  |
| `profile` | profile | 명사 | 옆얼굴, 프로필 |  | She changed her profile picture. |  |
| `profound` | profound | 형용사 | 깊은, 심오한 |  | The book had a profound effect on me. |  |
| `prohibit` | prohibit | 동사 | 금지하다 |  | Smoking is prohibited in the school. |  |
| `prominent` | prominent | 형용사 | 유명한, 두드러진 |  | She is a prominent scientist. |  |
| `prompt` | prompt | 형용사 | 즉각적인, 신속한 |  | Thank you for your prompt reply. |  |
| `proof` | proof | 명사 | 증거, 증명 |  | Do you have any proof of your age? |  |
| `proportion` | proportion | 명사 | 비율, 부분 |  | A large proportion of the class passed the test. |  |
| `prospect` | prospect | 명사 | 전망, 가능성 |  | The job has good prospects. |  |
| `prosper` | prosper | 동사 | 번영하다 |  | The town prospered after the bridge was built. |  |
| `protein` | protein | 명사 | 단백질 |  | Eggs are a good source of protein. |  |
| `province` | province | 명사 | 도(道), 지방 |  | Jeonju is in North Jeolla Province. |  |
| `provoke` | provoke | 동사 | 도발하다, 유발하다 |  | The joke provoked laughter in the class. |  |
| `psychology` | psychology | 명사 | 심리학 |  | She wants to study psychology. |  |
| `publish` | publish | 동사 | 출판하다, 발표하다 |  | Her first book was published last year. |  |
| `pupil` | pupil | 명사 | 학생, 눈동자 |  | There are twenty pupils in the class. |  |
| `pursue` | pursue | 동사 | 추구하다, 뒤쫓다 |  | She decided to pursue a career in music. |  |
| `quantity` | quantity | 명사 | 양, 수량 |  | Add a small quantity of salt. |  |
| `questionnaire` | questionnaire | 명사 | 설문지 |  | Please fill out this questionnaire. |  |
| `rage` | rage | 명사 | 격노 |  | He shouted in rage. |  |
| `rally` | rally | 명사 | 집회, 랠리 |  | Thousands joined the peace rally. |  |
| `random` | random | 형용사 | 무작위의 |  | The teacher chose a student at random. |  |
| `rank` | rank | 명사 | 순위, 계급 |  | Our team is first in rank. |  |
| `rational` | rational | 형용사 | 합리적인, 이성적인 |  | Try to make a rational decision. |  |
| `raw` | raw | 형용사 | 날것의, 가공하지 않은 |  | Some people enjoy eating raw fish. |  |
| `rear` | rear | 명사 | 뒤쪽 |  | Please move to the rear of the bus. |  |
| `rebel` | rebel | 명사 | 반항아, 반역자 |  | He was a rebel who never followed rules. |  |
| `recruit` | recruit | 동사 | 모집하다, 채용하다 |  | The club is recruiting new members. |  |
| `refine` | refine | 동사 | 정제하다, 다듬다 |  | She refined her essay before handing it in. |  |
| `reform` | reform | 명사 | 개혁 |  | The country needs education reform. |  |
| `refrigerate` | refrigerate | 동사 | 냉장하다 |  | Refrigerate the milk after opening. |  |
| `regret` | regret | 동사 | 후회하다 |  | I regret not studying harder. |  |
| `regulate` | regulate | 동사 | 규제하다, 조절하다 |  | The body regulates its own temperature. |  |
| `reinforce` | reinforce | 동사 | 강화하다 |  | Practice reinforces what you learn. |  |
| `reject` | reject | 동사 | 거절하다, 거부하다 |  | The committee rejected the proposal. |  |
| `relevant` | relevant | 형용사 | 관련 있는 |  | Please ask only relevant questions. |  |
| `relieve` | relieve | 동사 | 완화하다, 안도하게 하다 |  | This medicine relieves headaches. |  |
| `religion` | religion | 명사 | 종교 |  | People of every religion are welcome here. |  |
| `reluctant` | reluctant | 형용사 | 꺼리는, 마지못한 |  | He was reluctant to speak in public. |  |
| `remedy` | remedy | 명사 | 치료법, 해결책 |  | Honey is an old remedy for a sore throat. |  |
| `remote` | remote | 형용사 | 외딴, 먼 |  | They live in a remote mountain village. |  |
| `republic` | republic | 명사 | 공화국 |  | Korea is a democratic republic. |  |
| `reputation` | reputation | 명사 | 평판, 명성 |  | The school has a good reputation. |  |
| `resemble` | resemble | 동사 | 닮다 |  | She resembles her mother. |  |
| `reside` | reside | 동사 | 거주하다 |  | Many foreigners reside in this area. |  |
| `resign` | resign | 동사 | 사임하다, 그만두다 |  | The manager resigned last month. |  |
| `resolve` | resolve | 동사 | 해결하다, 결심하다 |  | They resolved the problem by talking. |  |
| `resort` | resort | 명사 | 휴양지 |  | We spent a week at a ski resort. |  |
| `restore` | restore | 동사 | 복원하다, 회복시키다 |  | The old palace was carefully restored. |  |
| `restrain` | restrain | 동사 | 억제하다, 제지하다 |  | He could not restrain his laughter. |  |
| `restrict` | restrict | 동사 | 제한하다 |  | The school restricts the use of phones. |  |
| `resume` | resume | 동사 | 다시 시작하다 |  | Classes will resume after lunch. |  |
| `retail` | retail | 명사 | 소매 |  | She works in retail. |  |
| `retain` | retain | 동사 | 유지하다, 간직하다 |  | The soil retains water well. |  |
| `retreat` | retreat | 동사 | 물러나다, 후퇴하다 |  | The army retreated to the hills. |  |
| `reveal` | reveal | 동사 | 드러내다, 밝히다 |  | The test revealed the cause of the illness. |  |
| `revenge` | revenge | 명사 | 복수 |  | He wanted revenge for the insult. |  |
| `reverse` | reverse | 동사 | 뒤집다, 거꾸로 하다 |  | He reversed the car into the garage. |  |
| `revise` | revise | 동사 | 수정하다, 복습하다 |  | I revised my essay three times. |  |
| `revive` | revive | 동사 | 되살리다, 회복하다 |  | The rain revived the dry plants. |  |
| `revolution` | revolution | 명사 | 혁명, 회전 |  | The internet caused a revolution in communication. |  |
| `reward` | reward | 명사 | 보상 |  | She got a reward for finding the lost dog. |  |
| `rid` | rid | 동사 | 없애다, 제거하다 |  | We need to get rid of this old sofa. |  |
| `ridicule` | ridicule | 동사 | 비웃다, 조롱하다 |  | They ridiculed his idea at first. |  |
| `riot` | riot | 명사 | 폭동 |  | The police stopped the riot. |  |
| `rival` | rival | 명사 | 경쟁자, 라이벌 |  | The two teams are old rivals. |  |
| `roast` | roast | 동사 | 굽다 |  | We roasted a chicken for dinner. |  |
| `romantic` | romantic | 형용사 | 낭만적인 |  | They had a romantic dinner by the sea. |  |
| `rot` | rot | 동사 | 썩다 |  | The apples rotted on the ground. |  |
| `routine` | routine | 명사 | 일과, 틀에 박힌 일 |  | Brushing my teeth is part of my daily routine. |  |
| `rumor` | rumor | 명사 | 소문 |  | There is a rumor that the shop will close. |  |
| `rural` | rural | 형용사 | 시골의 |  | She grew up in a rural area. |  |
| `sacred` | sacred | 형용사 | 신성한 |  | The mountain is sacred to the local people. |  |
| `sacrifice` | sacrifice | 명사 | 희생 |  | Parents make many sacrifices for their children. |  |
| `scan` | scan | 동사 | 훑어보다, 스캔하다 |  | Scan the QR code with your phone. |  |
| `scandal` | scandal | 명사 | 추문, 스캔들 |  | The scandal shocked the whole country. |  |
| `scarce` | scarce | 형용사 | 부족한, 드문 |  | Water is scarce in the desert. |  |
| `scatter` | scatter | 동사 | 흩뿌리다, 흩어지다 |  | The wind scattered the leaves. |  |
| `scheme` | scheme | 명사 | 계획, 제도 |  | The city started a new recycling scheme. |  |
| `scholar` | scholar | 명사 | 학자 |  | He is a famous scholar of Korean history. |  |
| `scope` | scope | 명사 | 범위 |  | That question is beyond the scope of this class. |  |
| `scramble` | scramble | 동사 | 재빨리 움직이다, 뒤섞다 |  | We scrambled up the rocky hill. |  |
| `sector` | sector | 명사 | 부문, 분야 |  | She works in the public sector. |  |
| `seize` | seize | 동사 | 붙잡다, 장악하다 |  | She seized the chance to study abroad. |  |
| `sensible` | sensible | 형용사 | 분별 있는, 합리적인 |  | It was sensible to bring an umbrella. |  |
| `sentiment` | sentiment | 명사 | 감정, 정서 |  | The song is full of warm sentiment. |  |
| `sequence` | sequence | 명사 | 순서, 연속 |  | Put the pictures in the correct sequence. |  |
| `severe` | severe | 형용사 | 심각한, 혹독한 | 눈보라 속에서 옷깃을 여미고 걷는 아이 | The storm caused severe damage. |  |
| `sigh` | sigh | 동사 | 한숨을 쉬다 |  | She sighed with relief. |  |
| `silent` | silent | 형용사 | 조용한, 말이 없는 |  | The classroom was silent during the test. |  |
| `simulate` | simulate | 동사 | 모의실험하다, 흉내 내다 |  | The game simulates flying a plane. |  |
| `simultaneous` | simultaneous | 형용사 | 동시의 |  | The two events were simultaneous. |  |
| `sin` | sin | 명사 | 죄 |  | Lying is considered a sin in many religions. |  |
| `slim` | slim | 형용사 | 날씬한, 얇은 |  | She is tall and slim. |  |
| `sneak` | sneak | 동사 | 몰래 움직이다 |  | The cat sneaked into the kitchen. |  |
| `soak` | soak | 동사 | 담그다, 흠뻑 적시다 |  | Soak the beans in water overnight. |  |
| `sociology` | sociology | 명사 | 사회학 |  | Sociology is the study of society. |  |
| `sole` | sole | 형용사 | 유일한 |  | He was the sole survivor of the accident. |  |
| `sophisticated` | sophisticated | 형용사 | 세련된, 정교한 |  | This is a very sophisticated machine. |  |
| `span` | span | 명사 | 기간, 폭 |  | The bridge has a span of 200 meters. |  |
| `spark` | spark | 명사 | 불꽃, 불똥 |  | A spark from the fire landed on the carpet. |  |
| `spectacle` | spectacle | 명사 | 장관, 구경거리 |  | The fireworks were a wonderful spectacle. |  |
| `spectrum` | spectrum | 명사 | 스펙트럼, 범위 |  | A rainbow shows the spectrum of light. |  |
| `spit` | spit | 동사 | 침을 뱉다 |  | It is rude to spit on the street. |  |
| `split` | split | 동사 | 쪼개다, 나누다 |  | We split the bill equally. |  |
| `spouse` | spouse | 명사 | 배우자 |  | You may bring your spouse to the party. |  |
| `stain` | stain | 명사 | 얼룩 |  | There is a coffee stain on my shirt. |  |
| `starve` | starve | 동사 | 굶주리다 |  | Many animals starve in a long winter. |  |
| `statistic` | statistic | 명사 | 통계 |  | The statistics show that sales are rising. |  |
| `status` | status | 명사 | 지위, 상태 |  | Check the status of your order online. |  |
| `steep` | steep | 형용사 | 가파른 |  | The path up the hill is very steep. |  |
| `stiff` | stiff | 형용사 | 뻣뻣한 |  | My neck is stiff from sleeping badly. |  |
| `stimulate` | stimulate | 동사 | 자극하다, 활발하게 하다 |  | Good books stimulate the imagination. |  |
| `stitch` | stitch | 명사 | 바늘땀, 꿰맨 자리 |  | The cut needed three stitches. |  |
| `strain` | strain | 명사 | 부담, 긴장 |  | The heavy bag put a strain on my back. |  |
| `strict` | strict | 형용사 | 엄격한 |  | Our coach is strict but fair. |  |
| `strip` | strip | 명사 | 가늘고 긴 조각 |  | Cut the paper into thin strips. |  |
| `stroke` | stroke | 명사 | 뇌졸중, 한 번 긋기 |  | He recovered slowly after a stroke. |  |
| `submit` | submit | 동사 | 제출하다 |  | Submit your homework by Friday. |  |
| `subscribe` | subscribe | 동사 | 구독하다 |  | I subscribe to a science magazine. |  |
| `substance` | substance | 명사 | 물질, 본질 |  | Ice and water are the same substance. |  |
| `substitute` | substitute | 명사 | 대리인, 대체물 |  | We had a substitute teacher today. |  |
| `subtle` | subtle | 형용사 | 미묘한 |  | There is a subtle difference between the two colors. |  |
| `suburb` | suburb | 명사 | 교외 |  | They moved to a quiet suburb. |  |
| `suck` | suck | 동사 | 빨다 |  | The baby is sucking her thumb. |  |
| `sufficient` | sufficient | 형용사 | 충분한 |  | We have sufficient food for three days. |  |
| `suite` | suite | 명사 | 스위트룸, 한 벌 |  | They stayed in a hotel suite. |  |
| `summit` | summit | 명사 | 정상, 정상 회담 |  | We reached the summit before sunset. |  |
| `superb` | superb | 형용사 | 최고의, 훌륭한 |  | The food at the wedding was superb. |  |
| `superior` | superior | 형용사 | 우수한, 상급의 |  | This phone is superior to the old one. |  |
| `supervise` | supervise | 동사 | 감독하다 |  | A teacher supervised the students on the trip. |  |
| `supplement` | supplement | 명사 | 보충, 보충제 |  | She takes a vitamin supplement every day. |  |
| `surgery` | surgery | 명사 | 수술 | 수술복과 마스크를 쓴 의사 두 명이 수술등 아래 서 있는 장면(환자·피 없이) | He had surgery on his knee. |  |
| `surrender` | surrender | 동사 | 항복하다 |  | The soldiers refused to surrender. |  |
| `suspend` | suspend | 동사 | 중단하다, 매달다 |  | The game was suspended because of rain. |  |
| `sustain` | sustain | 동사 | 유지하다, 지탱하다 |  | We need food and water to sustain life. |  |
| `swear` | swear | 동사 | 맹세하다, 욕하다 |  | I swear that I am telling the truth. |  |
| `swell` | swell | 동사 | 붓다, 부풀다 |  | My ankle swelled after I fell. |  |
| `swift` | swift | 형용사 | 신속한, 빠른 |  | She gave a swift answer. |  |
| `sympathy` | sympathy | 명사 | 동정, 공감 |  | I have sympathy for the victims. |  |
| `symphony` | symphony | 명사 | 교향곡 |  | The orchestra played a symphony by Beethoven. |  |
| `symptom` | symptom | 명사 | 증상 |  | A cough is a common symptom of a cold. |  |
| `tackle` | tackle | 동사 | 다루다, 태클하다 |  | We need to tackle this problem together. |  |
| `talent` | talent | 명사 | 재능 |  | She has a talent for drawing. |  |
| `task` | task | 명사 | 과제, 일 |  | Our task is to clean the classroom. |  |
| `tease` | tease | 동사 | 놀리다 |  | Do not tease your little brother. |  |
| `telegraph` | telegraph | 명사 | 전신, 전보 |  | News once traveled by telegraph. |  |
| `temporary` | temporary | 형용사 | 일시적인, 임시의 |  | This is only a temporary job. |  |
| `tempt` | tempt | 동사 | 유혹하다 |  | The smell of the cake tempted me. |  |
| `tenant` | tenant | 명사 | 세입자 |  | The tenant pays rent every month. |  |
| `tender` | tender | 형용사 | 부드러운, 다정한 |  | The meat was soft and tender. |  |
| `terminal` | terminal | 명사 | 터미널, 종점 |  | The bus terminal is near the station. |  |
| `terminate` | terminate | 동사 | 끝내다, 종료하다 |  | The contract was terminated last month. |  |
| `terrific` | terrific | 형용사 | 아주 좋은, 굉장한 |  | You did a terrific job! |  |
| `territory` | territory | 명사 | 영토, 영역 |  | Cats mark their territory. |  |
| `theme` | theme | 명사 | 주제, 테마 |  | The theme of the party is the ocean. |  |
| `therapy` | therapy | 명사 | 치료, 요법 |  | Music therapy helped him relax. |  |
| `thorough` | thorough | 형용사 | 철저한 |  | The doctor gave me a thorough examination. |  |
| `thrill` | thrill | 명사 | 전율, 설렘 |  | Riding the roller coaster was a thrill. |  |
| `tick` | tick | 동사 | 째깍거리다, 체크 표시를 하다 |  | Tick the box next to the right answer. |  |
| `toss` | toss | 동사 | 가볍게 던지다 |  | She tossed the ball to her friend. |  |
| `toxic` | toxic | 형용사 | 유독한 | 초록 연기가 나는 통과 빨간 X 모양 표시(해골·글자 없이) | The factory released toxic gas. |  |
| `tragic` | tragic | 형용사 | 비극적인 |  | The story has a tragic ending. |  |
| `trail` | trail | 명사 | 오솔길, 자취 |  | We followed the trail through the woods. |  |
| `transaction` | transaction | 명사 | 거래 |  | The transaction took only a few seconds. |  |
| `transform` | transform | 동사 | 변형시키다, 바꾸다 |  | The caterpillar transforms into a butterfly. |  |
| `transition` | transition | 명사 | 전환, 변화 |  | The transition to high school can be hard. |  |
| `translate` | translate | 동사 | 번역하다 |  | Can you translate this sentence into Korean? |  |
| `transmit` | transmit | 동사 | 전송하다, 전염시키다 |  | The tower transmits radio signals. |  |
| `treaty` | treaty | 명사 | 조약 |  | The two countries signed a peace treaty. |  |
| `tremendous` | tremendous | 형용사 | 엄청난 |  | The concert was a tremendous success. |  |
| `trend` | trend | 명사 | 경향, 유행 |  | Short videos are a popular trend. |  |
| `tribe` | tribe | 명사 | 부족 |  | The tribe lives deep in the forest. |  |
| `trigger` | trigger | 동사 | 촉발하다, 일으키다 |  | Dust can trigger an allergy. |  |
| `trim` | trim | 동사 | 다듬다, 손질하다 |  | Dad trimmed the bushes in the garden. |  |
| `triumph` | triumph | 명사 | 승리, 대성공 |  | The team returned home in triumph. |  |
| `troop` | troop | 명사 | 군대, 무리 |  | Troops were sent to help after the flood. |  |
| `turnover` | turnover | 명사 | 매출액, 이직률 |  | The shop has a high turnover. |  |
| `ultimate` | ultimate | 형용사 | 궁극적인, 최종의 |  | Our ultimate goal is to win the final. |  |
| `undergo` | undergo | 동사 | 겪다, 받다 |  | He will undergo surgery next week. |  |
| `underlie` | underlie | 동사 | ~의 밑바탕이 되다 |  | Trust underlies every good friendship. |  |
| `undermine` | undermine | 동사 | 약화시키다 |  | Lies undermine trust. |  |
| `undertake` | undertake | 동사 | 맡다, 착수하다 |  | She undertook the difficult task alone. |  |
| `unify` | unify | 동사 | 통일하다 |  | The leader tried to unify the country. |  |
| `unique` | unique | 형용사 | 독특한, 유일한 |  | Every snowflake is unique. |  |
| `update` | update | 동사 | 갱신하다, 최신화하다 |  | Update the app to the latest version. |  |
| `upward` | upward | 부사 | 위쪽으로 |  | The balloon floated upward. |  |
| `urban` | urban | 형용사 | 도시의 |  | Most people live in urban areas. |  |
| `urge` | urge | 동사 | 강력히 권하다, 재촉하다 |  | The doctor urged him to stop smoking. |  |
| `utilize` | utilize | 동사 | 활용하다 |  | We should utilize solar energy more. |  |
| `utter` | utter | 동사 | 말하다, 소리를 내다 |  | She did not utter a word. |  |
| `vacate` | vacate | 동사 | 비우다, 떠나다 |  | Guests must vacate their rooms by noon. |  |
| `vague` | vague | 형용사 | 모호한, 희미한 |  | He gave a vague answer. |  |
| `valid` | valid | 형용사 | 유효한, 타당한 |  | Your ticket is valid for one day. |  |
| `vanish` | vanish | 동사 | 사라지다 |  | The rabbit vanished into the hat. |  |
| `vast` | vast | 형용사 | 광대한, 막대한 |  | The desert is vast and empty. |  |
| `venture` | venture | 명사 | 모험, 벤처 사업 |  | They started a new business venture. |  |
| `verb` | verb | 명사 | 동사 |  | "Run" is a verb. |  |
| `verse` | verse | 명사 | 시, (노래의) 절 |  | We sang the first verse together. |  |
| `versus` | versus | 전치사 | ~대(對) |  | It is Korea versus Japan in the final. |  |
| `vessel` | vessel | 명사 | 배, 그릇, 혈관 |  | A large vessel sailed into the port. |  |
| `via` | via | 전치사 | ~을 거쳐, ~을 통해 |  | We flew to Paris via London. |  |
| `vice` | vice | 명사 | 악덕, 나쁜 습관 |  | Greed is a vice. |  |
| `vigor` | vigor | 명사 | 활력, 힘 |  | He works with great vigor. |  |
| `virgin` | virgin | 형용사 | 손대지 않은, 처음의 |  | The hikers crossed a virgin forest. |  |
| `virtue` | virtue | 명사 | 미덕, 장점 |  | Patience is a virtue. |  |
| `virus` | virus | 명사 | 바이러스 |  | Wash your hands to avoid the virus. |  |
| `visible` | visible | 형용사 | 눈에 보이는 |  | The mountain is visible from my window. |  |
| `visual` | visual | 형용사 | 시각의 |  | The teacher used visual aids in class. |  |
| `vital` | vital | 형용사 | 필수적인, 생명의 |  | Water is vital for all living things. |  |
| `vivid` | vivid | 형용사 | 생생한, 선명한 |  | I have vivid memories of that day. |  |
| `vocabulary` | vocabulary | 명사 | 어휘 |  | Reading helps you build your vocabulary. |  |
| `vocation` | vocation | 명사 | 천직, 직업 |  | Teaching is her true vocation. |  |
| `wander` | wander | 동사 | 돌아다니다, 헤매다 |  | We wandered around the old town. |  |
| `warrant` | warrant | 명사 | 영장, 보증 |  | The police had a warrant to search the house. |  |
| `wealth` | wealth | 명사 | 부, 재산 |  | Health is more important than wealth. |  |
| `weave` | weave | 동사 | 짜다, 엮다 |  | She weaves baskets from straw. |  |
| `weed` | weed | 명사 | 잡초 |  | We pulled the weeds from the garden. |  |
| `weird` | weird | 형용사 | 이상한, 기묘한 |  | I had a weird dream last night. |  |
| `welfare` | welfare | 명사 | 복지, 안녕 |  | The government spends more on welfare now. |  |
| `whereas` | whereas | 접속사 | 반면에 |  | I like tea, whereas my sister likes coffee. |  |
| `whip` | whip | 명사 | 채찍 |  | The rider held a whip in his hand. |  |
| `wicked` | wicked | 형용사 | 사악한, 못된 |  | The wicked queen gave her a poisoned apple. |  |
| `wit` | wit | 명사 | 재치 |  | He is known for his quick wit. |  |
| `withdraw` | withdraw | 동사 | 철회하다, (돈을) 인출하다 |  | I need to withdraw some money from the bank. |  |
| `witness` | witness | 명사 | 목격자, 증인 |  | A witness saw the accident. |  |
| `worship` | worship | 동사 | 숭배하다, 예배하다 |  | People come here to worship. |  |
| `wreck` | wreck | 명사 | 난파선, 잔해 |  | Divers found the wreck of an old ship. |  |
| `yield` | yield | 동사 | 산출하다, 양보하다 |  | The farm yields a lot of rice. |  |
| `zone` | zone | 명사 | 구역, 지대 |  | This is a no-parking zone. |  |

## 다 만든 뒤

`node app/scripts/vocab/make-image-url-sql.mjs`를 돌리면 그림 파일이 생긴 단어만 골라 `supabase/023_word_bank_new_image_urls.sql`이 만들어진다. 그 SQL 실행과 배포는 사용자가 한다(다시 만든 그림은 주소가 그대로라 SQL이 필요 없다).
