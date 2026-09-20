# 클래스뱅크 색칠용 선화 제작 인계

작성: Claude Code. 커밋·푸시·배포는 하지 않았고, 이미지 제작 후 사용자가 Claude Code에 요청한다.

## 무엇을 만드나

색칠 워크시트에 쓸 **윤곽선(선화) 그림 330개**(아직 없는 92개). 대상은 유치~초등 저학년이 색칠하기 좋은 구체적인 명사만 골랐다. 각 단어마다 이미 클레이 그림이 `app/public/word-bank-images/<id>.webp`(파닉스 카테고리는 `app/public/phonics-images/<id>.webp`)에 있으니, **같은 대상을 같은 구도**로 색칠하기 좋은 선화로 옮겨 그린다.

색칠 페이지는 이 **단어 선화 + 주제별 장식 부품(59개, 아직 없는 0개)** 을 코드가 조립해서 만든다. 제목·단어 라벨·테두리는 앱이 그리므로 그림에 글자를 넣지 않는다.

## 화풍 기준 (견본: `app/scripts/vocab/ref/lineart-style-sample.webp`)

견본은 이 프로젝트가 AI로 만든 색칠용 예시다. **선의 굵기, 둥글고 통통한 비율, 단순한 형태**를 이 견본에 맞춘다. 견본의 글자(제목·단어)는 흉내 내지 않는다.

- 동물·사람: 동그란 눈과 작은 미소가 있는 귀여운 얼굴, 짧고 통통한 다리, 털·무늬는 큰 덩어리 몇 개로만(견본의 젖소 무늬처럼 칠할 수 있는 크기).
- 물건·음식·탈 것: 표정 없이 단순하고 둥근 윤곽. 바퀴·창문 같은 부속은 큼직하게 하나씩만.
- 견본처럼 바닥선·그림자·배경 소품은 그리지 않는다(그건 앱이 조립할 때 장식 부품으로 붙인다).

## 규격 (반드시 지킬 것)

- **저장 위치·파일명**: `app/public/word-bank-lineart/<id>.webp` (폴더가 없으면 만든다). 표의 `id` 그대로. 클레이 그림과 같은 id를 쓰는 게 핵심이다.
- **크기·형식**: 1024×1024 정사각 WebP, 순백(#FFFFFF) 배경. 장당 100KB 이하(선화라 작게 나온다).
- **선**: 순검정, **굵고 균일한 선**(1024px 기준 약 8~10px), 둥근 끝. 색칠 칸이 **모두 닫혀 있게** 그린다(선이 끊겨 있으면 색칠할 때 번진다).
- **채우기·그림자·회색·질감·그라데이션 금지**. 오직 흰 바탕에 검은 윤곽선만. 클레이의 입체감은 전부 뺀다.
- **단순화**: 색칠하는 아이(만 4~8세)가 크레용으로 칠할 수 있게 디테일을 줄인다. 털 한 올 한 올, 작은 무늬, 복잡한 배경은 그리지 않는다. 색칠 칸이 너무 작으면 안 된다.
- **구도**: 대상 하나를 화면 가운데에 크게(화면의 약 70~80%). 배경 소품은 넣지 않는다. 사람·동물은 귀엽고 둥근 비율, 정면 또는 옆면 중 알아보기 쉬운 쪽.
- **그림 안에 글자·숫자·로고를 절대 넣지 않는다.** (단어 라벨은 앱이 따로 붙인다.)
- **장식 부품**은 위와 같은 규격이고 `app/public/word-bank-lineart/decor/<id>.webp` 에 저장한다. 부품 하나에 대상 하나(헛간이면 헛간만), 화면 가운데에 크게.
- **저작권**: 다른 사이트(잉글리시 플러스, 티처플러스, Twinkl 등)의 그림을 따라 그리거나 트레이싱하지 않는다. 클레이 그림 원본을 보고 새로 그린 순수 창작 선화만 쓴다.

## 하지 말 것

- `word-bank-images/` 의 기존 클레이 이미지를 수정하거나 덮어쓰지 않는다. 코드, SQL, i18n 수정 금지 — 이미지 파일 추가만.
- 표에 없는 id로 파일 이름을 짓지 않는다.

## 진행 방식

- 카테고리 단위로 진행하고, 한 카테고리를 끝낼 때마다 만든 개수와 건너뛴 id를 보고한다. 이미 만든 파일은 다시 만들지 않는다.
- **처음 카테고리(동물)를 4~5장 + 장식 부품(공통) 3~4장을 만든 시점에 멈추고 사용자에게 화풍을 확인받는다.** 선 굵기와 단순화 정도가 마음에 들어야 나머지를 이어서 만든다.
- 순서: 단어 선화(카테고리별) → 장식 부품(주제별).

## 동물 (32개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `dog` | dog | 완료 |
| `cat` | cat | 완료 |
| `rabbit` | rabbit | 완료 |
| `mouse` | mouse | 완료 |
| `bear` | bear | 완료 |
| `monkey` | monkey | 완료 |
| `lion` | lion | 완료 |
| `tiger` | tiger | 완료 |
| `elephant` | elephant | 완료 |
| `giraffe` | giraffe | 완료 |
| `zebra` | zebra | 완료 |
| `horse` | horse | 완료 |
| `cow` | cow | 완료 |
| `pig` | pig | 완료 |
| `sheep` | sheep | 완료 |
| `duck` | duck | 완료 |
| `chicken` | chicken | 완료 |
| `bird` | bird | 완료 |
| `frog` | frog | 완료 |
| `turtle` | turtle | 완료 |
| `fish` | fish | 완료 |
| `whale` | whale | 완료 |
| `dolphin` | dolphin | 완료 |
| `shark` | shark | 완료 |
| `octopus` | octopus | 완료 |
| `crab` | crab | 완료 |
| `butterfly` | butterfly | 완료 |
| `bee` | bee | 완료 |
| `penguin` | penguin | 완료 |
| `panda` | panda | 완료 |
| `snake` | snake | 완료 |
| `owl` | owl | 완료 |

## 음식 (30개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `apple` | apple | 완료 |
| `banana` | banana | 완료 |
| `orange` | orange | 완료 |
| `grape` | grape | 완료 |
| `strawberry` | strawberry | 완료 |
| `watermelon` | watermelon | 완료 |
| `pineapple` | pineapple | 완료 |
| `lemon` | lemon | 완료 |
| `cherry` | cherry | 완료 |
| `peach` | peach | 완료 |
| `carrot` | carrot | 완료 |
| `tomato` | tomato | 완료 |
| `potato` | potato | 완료 |
| `corn` | corn | 완료 |
| `broccoli` | broccoli | 완료 |
| `mushroom` | mushroom | 완료 |
| `egg` | egg | 완료 |
| `bread` | bread | 완료 |
| `pizza` | pizza | 완료 |
| `hamburger` | hamburger | 완료 |
| `hot-dog` | hot dog | 완료 |
| `sandwich` | sandwich | 완료 |
| `cake` | cake | 완료 |
| `cookie` | cookie | 완료 |
| `ice-cream` | ice cream | 완료 |
| `candy` | candy | 완료 |
| `milk` | milk | 완료 |
| `juice` | juice | 완료 |
| `rice` | rice | 완료 |
| `cheese` | cheese | 완료 |

## 몸 (16개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `body` | body | 완료 |
| `head` | head | 완료 |
| `eye` | eye | 완료 |
| `ear` | ear | 완료 |
| `nose` | nose | 완료 |
| `mouth` | mouth | 완료 |
| `hand` | hand | 완료 |
| `finger` | finger | 완료 |
| `arm` | arm | 완료 |
| `leg` | leg | 완료 |
| `foot` | foot | 완료 |
| `hair` | hair | 완료 |
| `tooth` | tooth | 완료 |
| `knee` | knee | 완료 |
| `shoulder` | shoulder | 완료 |
| `heart` | heart | 완료 |

## 옷 (16개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `shirt` | shirt | 완료 |
| `pants` | pants | 완료 |
| `skirt` | skirt | 완료 |
| `dress` | dress | 완료 |
| `jacket` | jacket | 완료 |
| `coat` | coat | 완료 |
| `hat` | hat | 완료 |
| `cap` | cap | 완료 |
| `socks` | socks | 완료 |
| `shoes` | shoes | 완료 |
| `boots` | boots | 완료 |
| `gloves` | gloves | 완료 |
| `scarf` | scarf | 완료 |
| `umbrella` | umbrella | 완료 |
| `backpack` | backpack | 완료 |
| `glasses` | glasses | 완료 |

## 장소 (13개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `school` | school | 완료 |
| `hospital` | hospital | 완료 |
| `library` | library | 완료 |
| `park` | park | 완료 |
| `bank` | bank | 완료 |
| `zoo` | zoo | 완료 |
| `farm` | farm | 완료 |
| `restaurant` | restaurant | 완료 |
| `supermarket` | supermarket | 완료 |
| `airport` | airport | 완료 |
| `museum` | museum | 완료 |
| `church` | church | 완료 |
| `bridge` | bridge | 완료 |

## 학교/문구 (13개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `pencil` | pencil | 완료 |
| `pen` | pen | 완료 |
| `eraser` | eraser | 완료 |
| `ruler` | ruler | 완료 |
| `scissors` | scissors | 완료 |
| `glue` | glue | 완료 |
| `crayon` | crayon | 완료 |
| `notebook` | notebook | 완료 |
| `book` | book | 완료 |
| `desk` | desk | 완료 |
| `chair` | chair | 완료 |
| `clock` | clock | 완료 |
| `computer` | computer | 완료 |

## 집/가구 (18개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `house` | house | 완료 |
| `door` | door | 완료 |
| `window` | window | 완료 |
| `bed` | bed | 완료 |
| `table` | table | 완료 |
| `sofa` | sofa | 완료 |
| `lamp` | lamp | 완료 |
| `mirror` | mirror | 완료 |
| `refrigerator` | refrigerator | 완료 |
| `television` | television | 완료 |
| `cup` | cup | 완료 |
| `plate` | plate | 완료 |
| `bowl` | bowl | 완료 |
| `spoon` | spoon | 완료 |
| `fork` | fork | 완료 |
| `knife` | knife | 완료 |
| `toothbrush` | toothbrush | 완료 |
| `towel` | towel | 완료 |

## 교통 (13개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `car` | car | 완료 |
| `bus` | bus | 완료 |
| `taxi` | taxi | 완료 |
| `truck` | truck | 완료 |
| `train` | train | 완료 |
| `bicycle` | bicycle | 완료 |
| `motorcycle` | motorcycle | 완료 |
| `plane` | plane | 완료 |
| `helicopter` | helicopter | 완료 |
| `ship` | ship | 완료 |
| `boat` | boat | 완료 |
| `rocket` | rocket | 완료 |
| `traffic-light` | traffic light | 완료 |

## 장난감 (12개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `ball` | ball | 완료 |
| `doll` | doll | 완료 |
| `teddy-bear` | teddy bear | 완료 |
| `robot` | robot | 완료 |
| `block` | block | 완료 |
| `kite` | kite | 완료 |
| `balloon` | balloon | 완료 |
| `yo-yo` | yo-yo | 완료 |
| `skateboard` | skateboard | 완료 |
| `dice` | dice | 완료 |
| `jump-rope` | jump rope | 완료 |
| `scooter` | scooter | 완료 |

## 직업 (12개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `doctor` | doctor | 완료 |
| `nurse` | nurse | 완료 |
| `teacher` | teacher | 완료 |
| `police-officer` | police officer | 완료 |
| `firefighter` | firefighter | 완료 |
| `farmer` | farmer | 완료 |
| `chef` | chef | 완료 |
| `pilot` | pilot | 완료 |
| `singer` | singer | 완료 |
| `dancer` | dancer | 완료 |
| `artist` | artist | 완료 |
| `baker` | baker | 완료 |

## 자연/날씨 (19개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `sun` | sun | 완료 |
| `moon` | moon | 완료 |
| `star` | star | 완료 |
| `cloud` | cloud | 완료 |
| `rain` | rain | 완료 |
| `snow` | snow | 완료 |
| `wind` | wind | 완료 |
| `rainbow` | rainbow | 완료 |
| `mountain` | mountain | 완료 |
| `river` | river | 완료 |
| `sea` | sea | 완료 |
| `beach` | beach | 완료 |
| `tree` | tree | 완료 |
| `flower` | flower | 완료 |
| `leaf` | leaf | 완료 |
| `rock` | rock | 완료 |
| `fire` | fire | 완료 |
| `snowflake` | snowflake | 완료 |
| `lightning` | lightning | 완료 |

## 스포츠 (13개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `soccer` | soccer | 완료 |
| `baseball` | baseball | 완료 |
| `basketball` | basketball | 완료 |
| `volleyball` | volleyball | 완료 |
| `tennis` | tennis | 완료 |
| `badminton` | badminton | 완료 |
| `golf` | golf | 완료 |
| `swimming` | swimming | 완료 |
| `skiing` | skiing | 완료 |
| `bowling` | bowling | 완료 |
| `bat` | bat | 완료 |
| `racket` | racket | 완료 |
| `glove` | glove | 완료 |

## 음악 (11개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `piano` | piano | 완료 |
| `guitar` | guitar | 완료 |
| `violin` | violin | 완료 |
| `drum` | drum | 완료 |
| `flute` | flute | 완료 |
| `trumpet` | trumpet | 완료 |
| `recorder` | recorder | 완료 |
| `bell` | bell | 완료 |
| `microphone` | microphone | 완료 |
| `xylophone` | xylophone | 완료 |
| `harmonica` | harmonica | 완료 |

## 우주 (7개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `earth` | earth | 완료 |
| `planet` | planet | 완료 |
| `spaceship` | spaceship | 완료 |
| `astronaut` | astronaut | 완료 |
| `alien` | alien | 완료 |
| `telescope` | telescope | 완료 |
| `satellite` | satellite | 완료 |

## 사람/가족 (13개, 남은 0개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `baby` | baby | 완료 |
| `boy` | boy | 완료 |
| `girl` | girl | 완료 |
| `man` | man | 완료 |
| `woman` | woman | 완료 |
| `mom` | mom | 완료 |
| `dad` | dad | 완료 |
| `brother` | brother | 완료 |
| `sister` | sister | 완료 |
| `grandma` | grandma | 완료 |
| `grandpa` | grandpa | 완료 |
| `family` | family | 완료 |
| `friend` | friend | 완료 |

## 파닉스 (92개, 남은 92개)

| id | 단어 | 만들어졌나 |
|---|---|---|
| `alligator` | alligator |  |
| `ant` | ant |  |
| `bag` | bag |  |
| `bench` | bench |  |
| `bike` | bike |  |
| `bin` | bin |  |
| `bone` | bone |  |
| `box` | box |  |
| `brush` | brush |  |
| `cape` | cape |  |
| `cave` | cave |  |
| `chin` | chin |  |
| `chip` | chip |  |
| `coin` | coin |  |
| `cone` | cone |  |
| `crown` | crown |  |
| `cub` | cub |  |
| `cube` | cube |  |
| `dam` | dam |  |
| `dish` | dish |  |
| `dot` | dot |  |
| `elbow` | elbow |  |
| `engine` | engine |  |
| `fan` | fan |  |
| `fin` | fin |  |
| `flag` | flag |  |
| `fog` | fog |  |
| `fox` | fox |  |
| `gate` | gate |  |
| `gift` | gift |  |
| `glass` | glass |  |
| `gorilla` | gorilla |  |
| `grass` | grass |  |
| `ham` | ham |  |
| `hen` | hen |  |
| `hive` | hive |  |
| `hole` | hole |  |
| `hut` | hut |  |
| `igloo` | igloo |  |
| `iguana` | iguana |  |
| `jam` | jam |  |
| `jet` | jet |  |
| `jug` | jug |  |
| `kangaroo` | kangaroo |  |
| `key` | key |  |
| `king` | king |  |
| `lake` | lake |  |
| `log` | log |  |
| `mail` | mail |  |
| `map` | map |  |
| `mask` | mask |  |
| `mole` | mole |  |
| `mop` | mop |  |
| `mud` | mud |  |
| `mule` | mule |  |
| `nest` | nest |  |
| `net` | net |  |
| `nut` | nut |  |
| `ostrich` | ostrich |  |
| `ox` | ox |  |
| `peg` | peg |  |
| `pin` | pin |  |
| `pipe` | pipe |  |
| `plant` | plant |  |
| `pot` | pot |  |
| `queen` | queen |  |
| `quilt` | quilt |  |
| `rag` | rag |  |
| `rake` | rake |  |
| `rat` | rat |  |
| `road` | road |  |
| `rope` | rope |  |
| `rose` | rose |  |
| `seed` | seed |  |
| `shell` | shell |  |
| `soap` | soap |  |
| `sock` | sock |  |
| `stem` | stem |  |
| `tail` | tail |  |
| `tea` | tea |  |
| `teeth` | teeth |  |
| `vase` | vase |  |
| `van` | van |  |
| `vest` | vest |  |
| `water` | water |  |
| `wave` | wave |  |
| `web` | web |  |
| `wheel` | wheel |  |
| `wig` | wig |  |
| `yacht` | yacht |  |
| `yam` | yam |  |
| `zipper` | zipper |  |

# 장식 부품

## 장식 · 공통 (6개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-sun` | 웃는 얼굴 없이 둥근 해와 짧은 햇살 | 완료 |
| `decor-cloud` | 몽글몽글한 구름 한 덩이 | 완료 |
| `decor-grass` | 풀 무더기(작은 풀잎 3~5개) | 완료 |
| `decor-flower` | 꽃 한 송이(줄기와 잎 포함) | 완료 |
| `decor-star` | 별 하나 | 완료 |
| `decor-heart` | 하트 하나 | 완료 |

## 장식 · 농장 (5개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-barn` | 헛간(지붕과 X자 문) | 완료 |
| `decor-fence` | 나무 울타리 한 토막 | 완료 |
| `decor-haystack` | 건초더미 | 완료 |
| `decor-tractor` | 트랙터 | 완료 |
| `decor-pond` | 작은 연못과 갈대 | 완료 |

## 장식 · 바다 (6개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-waves` | 물결 무늬 3줄 | 완료 |
| `decor-bubbles` | 물방울 여러 개 | 완료 |
| `decor-seaweed` | 해초 두세 가닥 | 완료 |
| `decor-seashell` | 조개껍데기 | 완료 |
| `decor-coral` | 산호 | 완료 |
| `decor-sailboat` | 돛단배 | 완료 |

## 장식 · 숲 (5개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-bush` | 덤불 | 완료 |
| `decor-log` | 쓰러진 통나무 | 완료 |
| `decor-vine` | 덩굴과 잎 | 완료 |
| `decor-rocks` | 돌멩이 몇 개 | 완료 |
| `decor-stump` | 나무 그루터기 | 완료 |

## 장식 · 우주 (5개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-comet` | 꼬리 있는 혜성 | 완료 |
| `decor-planet-ring` | 고리가 있는 행성 | 완료 |
| `decor-stars` | 작은 별 여러 개 | 완료 |
| `decor-ufo` | 접시 모양 우주선 | 완료 |
| `decor-crater` | 분화구 있는 달 표면 | 완료 |

## 장식 · 마을 (5개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-road` | 구불구불한 길 한 토막 | 완료 |
| `decor-cone` | 삼각 표지 콘 | 완료 |
| `decor-streetlight` | 가로등 | 완료 |
| `decor-building` | 건물 한 채(창문 몇 개) | 완료 |
| `decor-hydrant` | 소화전 | 완료 |

## 장식 · 소풍 (4개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-blanket` | 체크무늬 돗자리(무늬는 굵은 선으로 단순하게) | 완료 |
| `decor-picnic-basket` | 소풍 바구니 | 완료 |
| `decor-pot` | 냄비 | 완료 |
| `decor-tray` | 쟁반 | 완료 |

## 장식 · 학교 (4개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-blackboard` | 글자 없는 칠판(틀만) | 완료 |
| `decor-bookshelf` | 책이 꽂힌 책장 | 완료 |
| `decor-globe` | 지구본 | 완료 |
| `decor-school-bell` | 종 | 완료 |

## 장식 · 집 (5개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-rug` | 동그란 러그 | 완료 |
| `decor-potted-plant` | 화분 | 완료 |
| `decor-curtains` | 커튼이 달린 창문 | 완료 |
| `decor-photo-frame` | 빈 액자 | 완료 |
| `decor-fireplace` | 벽난로 | 완료 |

## 장식 · 운동장 (5개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-soccer-goal` | 축구 골대와 그물 | 완료 |
| `decor-slide` | 미끄럼틀 | 완료 |
| `decor-swing` | 그네 | 완료 |
| `decor-seesaw` | 시소 | 완료 |
| `decor-hoop` | 농구 골대 | 완료 |

## 장식 · 파티 (4개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-party-hat` | 고깔모자 | 완료 |
| `decor-gift` | 리본 달린 선물 상자 | 완료 |
| `decor-bunting` | 삼각 깃발 줄(깃발에 글자 없음) | 완료 |
| `decor-confetti` | 색종이 조각 흩날림 | 완료 |

## 장식 · 계절 (5개, 남은 0개)

| id | 그릴 것 | 만들어졌나 |
|---|---|---|
| `decor-snow-pile` | 눈 쌓인 언덕 | 완료 |
| `decor-raindrops` | 빗방울 | 완료 |
| `decor-autumn-leaves` | 낙엽 몇 장 | 완료 |
| `decor-sunflower` | 해바라기 | 완료 |
| `decor-blossoms` | 벚꽃 가지 | 완료 |
