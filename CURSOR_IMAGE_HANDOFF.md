# 클래스뱅크 단어 사전 이미지 제작 인계

작성: Claude Code. 대상: `app/public/word-bank-images/`. 커밋·푸시·배포는 하지 않았고 이 문서의 이미지 제작 후 사용자가 Claude Code에 커밋/배포를 요청한다.

## 무엇을 만드나

사전에 새로 들어가는 단어의 그림. 전체 894개 중 **아직 없는 894개**를 만든다(시범 배치 166개 + 확장 배치 728개, 숙어·표현은 그림이 필요 없다). 기존 812개(`apple.webp`, `dolphin.webp`, `climb.webp` 등)와 **같은 화풍**이어야 한다.

**권장 순서**: 위에서부터 카테고리 단위로. 그림으로 옮기기 어려운 추상 단어(서수, 배수, 의문사 등)는 마지막에 하거나, 정말 어려우면 건너뛰어도 된다(파일이 없는 단어는 이미지 없이 글자 카드로 정상 동작한다). 표의 "만들어졌나"에 `완료`가 있으면 이미 있는 것이니 다시 만들지 않는다.

**특수 규칙**: 숫자(one~ninety)는 숫자 글자 없이 그 수만큼의 클레이 사과/공 등을 보여준다. 서수(first~tenth)는 줄 선 아이들 중 N번째 아이만 눈에 띄게(글자 없이). 요일·월·명절은 글자·달력 숫자 없이 계절/대표 활동으로 상징한다. 나라(Korea 등)는 그 나라의 대표 랜드마크·풍경(국기 무늬는 OK, 글자는 X). 언어 이름(Korean 등)은 그 나라 아이가 인사하는 장면.

## 규격 (반드시 지킬 것)

- **화풍**: 점토(클레이/플라스티신) 3D 질감, 둥글고 귀여운 형태, 밝은 파스텔 배경. 기존 `dolphin.webp`(동물), `apple.webp`(사물), `climb.webp`(동작: 클레이 남자아이)를 먼저 열어 보고 맞출 것.
- **크기·형식**: 1024×1024 정사각 WebP, 장당 약 100~150KB(기존과 동일).
- **파일명**: 아래 표의 `id` 그대로 `<id>.webp` (예: `puppy.webp`, `hot-dog.webp`, `fly-2.webp`). 이 규칙이 곧 DB의 이미지 경로다.
- **그림 안에 글자·숫자·로고·말풍선을 절대 넣지 않는다.** (AI 이미지에 박힌 글자, 특히 한글이 깨지는 문제를 피하기 위함. 순수 일러스트만.)
- **한 장에 주제 하나**: 단어의 뜻이 한눈에 보이게. 배경은 단순하게, 주제가 화면 중앙에 크게.
- **동사**는 기존 동작 그림처럼 클레이 남자아이/여자아이가 그 동작을 하는 장면. 아이가 나오는 그림은 밝고 안전하게(폭력·위험한 장면 X).
- 아래 "참고 문장"은 장면 힌트일 뿐이다. 문장을 그림에 쓰지 말 것.

## 하지 말 것

- 기존 812개 이미지 파일 수정/덮어쓰기 금지. 코드, DB(SQL), i18n 수정 금지 — 이미지 파일 추가만.
- id가 표에 없는 파일 이름 사용 금지(사전과 연결이 안 된다).

## 다 만든 뒤

`node app/scripts/vocab/make-image-url-sql.mjs` 를 실행하면 새 이미지가 있는 단어만 골라 `supabase/023_word_bank_new_image_urls.sql` 이 만들어진다(파일이 없는 단어는 이미지가 없는 채로 두어야 이미지 퀴즈 등에서 깨진 그림이 안 나온다). 그 SQL 실행과 배포는 사용자가 한다.

## 동물 (72개, 남은 72개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `puppy` | puppy | 강아지 | 강아지 하나를 중심에 | The puppy is small. |  |
| `kitten` | kitten | 새끼 고양이 | 새끼 고양이 하나를 중심에 | The kitten drinks milk. |  |
| `rabbit` | rabbit | 토끼 | 토끼 하나를 중심에 | The rabbit likes carrots. |  |
| `hamster` | hamster | 햄스터 | 햄스터 하나를 중심에 | My hamster is very small. |  |
| `mouse` | mouse | 생쥐 | 생쥐 하나를 중심에 | A mouse is under the table. |  |
| `rat` | rat | 쥐 | 쥐 하나를 중심에 | The rat is fast. |  |
| `squirrel` | squirrel | 다람쥐 | 다람쥐 하나를 중심에 | The squirrel has a big tail. |  |
| `hedgehog` | hedgehog | 고슴도치 | 고슴도치 하나를 중심에 | A hedgehog is small and round. |  |
| `fox` | fox | 여우 | 여우 하나를 중심에 | The fox is red. |  |
| `wolf` | wolf | 늑대 | 늑대 하나를 중심에 | The wolf is in the forest. |  |
| `deer` | deer | 사슴 | 사슴 하나를 중심에 | The deer runs fast. |  |
| `raccoon` | raccoon | 너구리 | 너구리 하나를 중심에 | The raccoon is cute. |  |
| `gorilla` | gorilla | 고릴라 | 고릴라 하나를 중심에 | The gorilla is very strong. |  |
| `chimpanzee` | chimpanzee | 침팬지 | 침팬지 하나를 중심에 | The chimpanzee likes bananas. |  |
| `leopard` | leopard | 표범 | 표범 하나를 중심에 | The leopard is fast. |  |
| `cheetah` | cheetah | 치타 | 치타 하나를 중심에 | The cheetah runs very fast. |  |
| `elephant` | elephant | 코끼리 | 코끼리 하나를 중심에 | The elephant has a long nose. |  |
| `giraffe` | giraffe | 기린 | 기린 하나를 중심에 | The giraffe has a long neck. |  |
| `zebra` | zebra | 얼룩말 | 얼룩말 하나를 중심에 | The zebra is black and white. |  |
| `hippo` | hippo | 하마 | 하마 하나를 중심에 | The hippo is in the water. |  |
| `rhino` | rhino | 코뿔소 | 코뿔소 하나를 중심에 | The rhino is big and strong. |  |
| `kangaroo` | kangaroo | 캥거루 | 캥거루 하나를 중심에 | The kangaroo can jump high. |  |
| `koala` | koala | 코알라 | 코알라 하나를 중심에 | The koala sleeps in a tree. |  |
| `panda` | panda | 판다 | 판다 하나를 중심에 | The panda is black and white. |  |
| `camel` | camel | 낙타 | 낙타 하나를 중심에 | The camel is tall. |  |
| `pony` | pony | 조랑말 | 조랑말 하나를 중심에 | The pony is small. |  |
| `goat` | goat | 염소 | 염소 하나를 중심에 | The goat eats grass. |  |
| `donkey` | donkey | 당나귀 | 당나귀 하나를 중심에 | The donkey is gray. |  |
| `chick` | chick | 병아리 | 병아리 하나를 중심에 | The chick is yellow. |  |
| `rooster` | rooster | 수탉 | 수탉 하나를 중심에 | The rooster wakes me up. |  |
| `goose` | goose | 거위 | 거위 하나를 중심에 | The goose is on the lake. |  |
| `turkey` | turkey | 칠면조 | 칠면조 하나를 중심에 | The turkey is a big bird. |  |
| `eagle` | eagle | 독수리 | 독수리 하나를 중심에 | The eagle flies high. |  |
| `owl` | owl | 부엉이 | 부엉이 하나를 중심에 | The owl sleeps in the day. |  |
| `parrot` | parrot | 앵무새 | 앵무새 하나를 중심에 | The parrot can talk. |  |
| `penguin` | penguin | 펭귄 | 펭귄 하나를 중심에 | The penguin can swim. |  |
| `flamingo` | flamingo | 플라밍고 | 플라밍고 하나를 중심에 | The flamingo is pink. |  |
| `peacock` | peacock | 공작 | 공작 하나를 중심에 | The peacock is beautiful. |  |
| `swan` | swan | 백조 | 백조 하나를 중심에 | The swan is on the lake. |  |
| `crow` | crow | 까마귀 | 까마귀 하나를 중심에 | The crow is black. |  |
| `sparrow` | sparrow | 참새 | 참새 하나를 중심에 | The sparrow is a small bird. |  |
| `frog` | frog | 개구리 | 개구리 하나를 중심에 | The frog can jump. |  |
| `toad` | toad | 두꺼비 | 두꺼비 하나를 중심에 | The toad is brown. |  |
| `snake` | snake | 뱀 | 뱀 하나를 중심에 | The snake is long. |  |
| `lizard` | lizard | 도마뱀 | 도마뱀 하나를 중심에 | The lizard is on the wall. |  |
| `turtle` | turtle | 거북이 | 거북이 하나를 중심에 | The turtle is slow. |  |
| `crocodile` | crocodile | 악어 | 악어 하나를 중심에 | The crocodile has big teeth. |  |
| `alligator` | alligator | 앨리게이터 | 앨리게이터 하나를 중심에 | The alligator is in the river. |  |
| `dinosaur` | dinosaur | 공룡 | 공룡 하나를 중심에 | The dinosaur is big. |  |
| `shark` | shark | 상어 | 상어 하나를 중심에 | The shark is in the sea. |  |
| `whale` | whale | 고래 | 고래 하나를 중심에 | The whale is very big. |  |
| `octopus` | octopus | 문어 | 문어 하나를 중심에 | The octopus has eight legs. |  |
| `squid` | squid | 오징어 | 오징어 하나를 중심에 | The squid lives in the sea. |  |
| `crab` | crab | 게 | 게 하나를 중심에 | The crab is red. |  |
| `lobster` | lobster | 바닷가재 | 바닷가재 하나를 중심에 | The lobster is red. |  |
| `shrimp` | shrimp | 새우 | 새우 하나를 중심에 | I like shrimp. |  |
| `seal` | seal | 물개 | 물개 하나를 중심에 | The seal can swim. |  |
| `starfish` | starfish | 불가사리 | 불가사리 하나를 중심에 | The starfish is on the beach. |  |
| `jellyfish` | jellyfish | 해파리 | 해파리 하나를 중심에 | The jellyfish is in the sea. |  |
| `seahorse` | seahorse | 해마 | 해마 하나를 중심에 | The seahorse is small. |  |
| `bee` | bee | 벌 | 벌 하나를 중심에 | The bee is on the flower. |  |
| `butterfly` | butterfly | 나비 | 나비 하나를 중심에 | The butterfly is beautiful. |  |
| `ant` | ant | 개미 | 개미 하나를 중심에 | The ant is small. |  |
| `spider` | spider | 거미 | 거미 하나를 중심에 | The spider has eight legs. |  |
| `beetle` | beetle | 딱정벌레 | 딱정벌레 하나를 중심에 | The beetle is on the leaf. |  |
| `ladybug` | ladybug | 무당벌레 | 무당벌레 하나를 중심에 | The ladybug is red. |  |
| `mosquito` | mosquito | 모기 | 모기 하나를 중심에 | A mosquito is on my arm. |  |
| `grasshopper` | grasshopper | 메뚜기 | 메뚜기 하나를 중심에 | The grasshopper can jump. |  |
| `snail` | snail | 달팽이 | 달팽이 하나를 중심에 | The snail is slow. |  |
| `worm` | worm | 벌레, 지렁이 | 벌레, 지렁이 하나를 중심에 | The worm is in the soil. |  |
| `fly-2` | fly | 파리 | 곤충 "파리" 한 마리(날아다니는 벌레). 동사 fly(날다) 그림과 달라야 함 | A fly is on the food. |  |
| `bat-2` | bat | 박쥐 | 거꾸로 매달린 박쥐 한 마리 | A bat flies at night. |  |

## 음식 (56개, 남은 56개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `meal` | meal | 식사 | 식사 하나를 중심에 | We eat a meal together. |  |
| `snack` | snack | 간식 | 간식 하나를 중심에 | I eat a snack after school. |  |
| `toast` | toast | 토스트 | 토스트 하나를 중심에 | I eat toast for breakfast. |  |
| `cereal` | cereal | 시리얼 | 시리얼 하나를 중심에 | I eat cereal with milk. |  |
| `noodles` | noodles | 국수, 면 | 국수, 면 하나를 중심에 | I like noodles. |  |
| `pasta` | pasta | 파스타 | 파스타 하나를 중심에 | I like pasta. |  |
| `pizza` | pizza | 피자 | 피자 하나를 중심에 | I like pizza. |  |
| `sandwich` | sandwich | 샌드위치 | 샌드위치 하나를 중심에 | I make a sandwich. |  |
| `hot-dog` | hot dog | 핫도그 | 핫도그 하나를 중심에 | I eat a hot dog. |  |
| `beef` | beef | 소고기 | 소고기 하나를 중심에 | We eat beef. |  |
| `pork` | pork | 돼지고기 | 돼지고기 하나를 중심에 | This is pork. |  |
| `curry` | curry | 카레 | 카레 하나를 중심에 | I like curry and rice. |  |
| `dumpling` | dumpling | 만두 | 만두 하나를 중심에 | I like dumplings. |  |
| `pancake` | pancake | 팬케이크 | 팬케이크 하나를 중심에 | I eat pancakes on Sunday. |  |
| `waffle` | waffle | 와플 | 와플 하나를 중심에 | I like waffles. |  |
| `french-fries` | French fries | 감자튀김 | 감자튀김 하나를 중심에 | I eat French fries. |  |
| `sweet-potato` | sweet potato | 고구마 | 고구마 하나를 중심에 | The sweet potato is sweet. |  |
| `corn` | corn | 옥수수 | 옥수수 하나를 중심에 | I eat corn. |  |
| `carrot` | carrot | 당근 | 당근 하나를 중심에 | Rabbits like carrots. |  |
| `onion` | onion | 양파 | 양파 하나를 중심에 | I cut an onion. |  |
| `cucumber` | cucumber | 오이 | 오이 하나를 중심에 | The cucumber is green. |  |
| `lettuce` | lettuce | 상추 | 상추 하나를 중심에 | I put lettuce in the sandwich. |  |
| `cabbage` | cabbage | 양배추 | 양배추 하나를 중심에 | The cabbage is green. |  |
| `mushroom` | mushroom | 버섯 | 버섯 하나를 중심에 | I like mushrooms. |  |
| `broccoli` | broccoli | 브로콜리 | 브로콜리 하나를 중심에 | I eat broccoli. |  |
| `spinach` | spinach | 시금치 | 시금치 하나를 중심에 | Spinach is green. |  |
| `bean` | bean | 콩 | 콩 하나를 중심에 | I eat beans. |  |
| `pea` | pea | 완두콩 | 완두콩 하나를 중심에 | The peas are green. |  |
| `watermelon` | watermelon | 수박 | 수박 하나를 중심에 | The watermelon is big and sweet. |  |
| `peach` | peach | 복숭아 | 복숭아 하나를 중심에 | The peach is sweet. |  |
| `cherry` | cherry | 체리 | 체리 하나를 중심에 | I like cherries. |  |
| `pineapple` | pineapple | 파인애플 | 파인애플 하나를 중심에 | The pineapple is yellow. |  |
| `mango` | mango | 망고 | 망고 하나를 중심에 | I like mango. |  |
| `kiwi` | kiwi | 키위 | 키위 하나를 중심에 | The kiwi is green. |  |
| `lemon` | lemon | 레몬 | 레몬 하나를 중심에 | The lemon is sour. |  |
| `blueberry` | blueberry | 블루베리 | 블루베리 하나를 중심에 | I put blueberries in my yogurt. |  |
| `raspberry` | raspberry | 라즈베리 | 라즈베리 하나를 중심에 | The raspberry is red. |  |
| `coconut` | coconut | 코코넛 | 코코넛 하나를 중심에 | The coconut is hard. |  |
| `avocado` | avocado | 아보카도 | 아보카도 하나를 중심에 | I like avocado. |  |
| `cookie` | cookie | 쿠키 | 쿠키 하나를 중심에 | I eat a cookie. |  |
| `biscuit` | biscuit | 비스킷 | 비스킷 하나를 중심에 | I eat a biscuit. |  |
| `chocolate` | chocolate | 초콜릿 | 초콜릿 하나를 중심에 | I like chocolate. |  |
| `ice-cream` | ice cream | 아이스크림 | 아이스크림 하나를 중심에 | I want ice cream. |  |
| `donut` | donut | 도넛 | 도넛 하나를 중심에 | I eat a donut. |  |
| `pie` | pie | 파이 | 파이 하나를 중심에 | I like apple pie. |  |
| `pudding` | pudding | 푸딩 | 푸딩 하나를 중심에 | The pudding is sweet. |  |
| `yogurt` | yogurt | 요거트 | 요거트 하나를 중심에 | I eat yogurt. |  |
| `soda` | soda | 탄산음료 | 탄산음료 하나를 중심에 | I drink soda. |  |
| `lemonade` | lemonade | 레모네이드 | 레모네이드 하나를 중심에 | I drink lemonade in summer. |  |
| `pepper` | pepper | 후추 | 후추 하나를 중심에 | Add salt and pepper. |  |
| `jam` | jam | 잼 | 잼 하나를 중심에 | I put jam on my bread. |  |
| `honey` | honey | 꿀 | 꿀 하나를 중심에 | Honey is sweet. |  |
| `flour` | flour | 밀가루 | 밀가루 하나를 중심에 | We use flour for cake. |  |
| `chicken-2` | chicken | 닭고기 | 접시에 담긴 구운/튀긴 닭고기 요리(살아 있는 닭 아님) | I like chicken for dinner. |  |
| `fish-2` | fish | 생선 | 접시에 담긴 구운 생선 요리(살아 있는 물고기 아님) | We eat fish for dinner. |  |
| `noodle` | noodle | 국수, 면 | 국수, 면 하나를 중심에 | I eat noodles for lunch. |  |

## 동작 (42개, 남은 42개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `hop` | hop | 깡충깡충 뛰다 | 클레이 아이가 "깡충깡충 뛰다" 동작을 하는 장면 | The rabbit can hop. |  |
| `skip` | skip | 가볍게 뛰어가다 | 클레이 아이가 "가볍게 뛰어가다" 동작을 하는 장면 | The girl can skip. |  |
| `enter` | enter | 들어가다 | 클레이 아이가 "들어가다" 동작을 하는 장면 | Please enter the room. |  |
| `yell` | yell | 소리치다 | 클레이 아이가 "소리치다" 동작을 하는 장면 | Don't yell in class. |  |
| `whisper` | whisper | 속삭이다 | 클레이 아이가 "속삭이다" 동작을 하는 장면 | Please whisper in the library. |  |
| `fold` | fold | 접다 | 클레이 아이가 "접다" 동작을 하는 장면 | Fold the paper. |  |
| `glue` | glue | 풀로 붙이다 | 클레이 아이가 "풀로 붙이다" 동작을 하는 장면 | Glue the paper here. |  |
| `lift` | lift | 들어 올리다 | 클레이 아이가 "들어 올리다" 동작을 하는 장면 | I can lift the box. |  |
| `search` | search | 찾다, 뒤지다 | 클레이 아이가 "찾다, 뒤지다" 동작을 하는 장면 | I search for my pen. |  |
| `bounce` | bounce | 튀다 | 클레이 아이가 "튀다" 동작을 하는 장면 | The ball can bounce. |  |
| `crawl` | crawl | 기어가다 | 클레이 아이가 "기어가다" 동작을 하는 장면 | The baby can crawl. |  |
| `bake` | bake | 굽다 | 클레이 아이가 "굽다" 동작을 하는 장면 | I bake a cake. |  |
| `guess` | guess | 추측하다 | 클레이 아이가 "추측하다" 동작을 하는 장면 | Guess the answer. |  |
| `choose` | choose | 고르다 | 클레이 아이가 "고르다" 동작을 하는 장면 | Choose one card. |  |
| `decide` | decide | 결정하다 | 클레이 아이가 "결정하다" 동작을 하는 장면 | Let's decide together. |  |
| `wish` | wish | 바라다 | 클레이 아이가 "바라다" 동작을 하는 장면 | I wish for a puppy. |  |
| `share` | share | 나누다 | 클레이 아이가 "나누다" 동작을 하는 장면 | Let's share the snack. |  |
| `add` | add | 더하다 | 클레이 아이가 "더하다" 동작을 하는 장면 | Add two and three. |  |
| `freeze` | freeze | 얼다 | 클레이 아이가 "얼다" 동작을 하는 장면 | Water can freeze. |  |
| `melt` | melt | 녹다 | 클레이 아이가 "녹다" 동작을 하는 장면 | The ice will melt. |  |
| `tear` | tear | 찢다 | 클레이 아이가 "찢다" 동작을 하는 장면 | Don't tear the paper. |  |
| `pour` | pour | 붓다 | 클레이 아이가 "붓다" 동작을 하는 장면 | Pour the milk. |  |
| `mix` | mix | 섞다 | 클레이 아이가 "섞다" 동작을 하는 장면 | Mix the eggs and milk. |  |
| `shake` | shake | 흔들다 | 클레이 아이가 "흔들다" 동작을 하는 장면 | Shake the bottle. |  |
| `press` | press | 누르다 | 클레이 아이가 "누르다" 동작을 하는 장면 | Press the button. |  |
| `clap` | clap | 박수 치다 | 클레이 아이가 "박수 치다" 동작을 하는 장면 | Let's clap our hands. |  |
| `wave` | wave | 손을 흔들다 | 클레이 아이가 "손을 흔들다" 동작을 하는 장면 | I wave to my friend. |  |
| `nod` | nod | 고개를 끄덕이다 | 클레이 아이가 "고개를 끄덕이다" 동작을 하는 장면 | She nods her head. |  |
| `bow` | bow | 절하다 | 아이가 선생님께 허리 숙여 인사하는 장면 | We bow to the teacher. |  |
| `hug` | hug | 껴안다 | 아이와 엄마가 서로 꼭 껴안는 장면 | I hug my mom. |  |
| `kiss` | kiss | 입맞추다 | 아이가 아기 동생 볼에 뽀뽀하거나 손키스를 보내는 장면(입술 뽀뽀 X) | I kiss my baby sister. |  |
| `cheer` | cheer | 응원하다 | 클레이 아이가 "응원하다" 동작을 하는 장면 | Let's cheer for our team. |  |
| `color-2` | color | 색칠하다 | 아이가 크레용으로 그림에 색칠하는 장면(색깔 팔레트 그림 아님) | I color the picture. |  |
| `dress-2` | dress | 옷을 입다 | 아이가 스스로 옷을 입고 있는 장면(드레스 그림 아님) | I dress myself in the morning. |  |
| `brush-2` | brush | 솔질하다, 이를 닦다 | 아이가 칫솔로 이를 닦는 장면 | I brush my teeth. |  |
| `point-2` | point | 가리키다 | 아이가 손가락으로 무언가를 가리키는 장면 | Point to the picture. |  |
| `plant-2` | plant | 심다 | 아이가 모종/씨앗을 흙에 심는 장면(다 자란 식물 그림 아님) | Let's plant a tree. |  |
| `rest-2` | rest | 쉬다 | 아이가 편안히 쉬는 장면(의자·소파에 앉아 쉼) | I rest after lunch. |  |
| `practice-2` | practice | 연습하다 | 아이가 악기나 운동을 연습하는 장면 | I practice English every day. |  |
| `empty-2` | empty | 비우다 | 아이가 가방/통을 뒤집어 비우는 장면 | Empty the bag. |  |
| `circle-2` | circle | 동그라미 치다 | 아이가 책의 그림 하나에 동그라미를 그리는 장면 | Circle the answer. |  |
| `underline` | underline | 밑줄을 긋다 | 클레이 아이가 "밑줄을 긋다" 동작을 하는 장면 | Underline the word. |  |

## 외모 (18개, 남은 18개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `cute` | cute | 귀여운 | 귀여운 하나를 중심에 | The baby is cute. |  |
| `handsome` | handsome | 잘생긴 | 잘생긴 하나를 중심에 | He is a handsome man. |  |
| `lovely` | lovely | 사랑스러운 | 사랑스러운 하나를 중심에 | What a lovely dress! |  |
| `neat` | neat | 단정한 | 단정한 하나를 중심에 | Her desk is neat. |  |
| `messy` | messy | 지저분한 | 지저분한 하나를 중심에 | My room is messy. |  |
| `curly` | curly | 곱슬곱슬한 | 곱슬곱슬한 하나를 중심에 | She has curly hair. |  |
| `wavy` | wavy | 물결 모양의 | 물결 모양의 하나를 중심에 | He has wavy hair. |  |
| `blond` | blond | 금발의 | 금발의 하나를 중심에 | The boy has blond hair. |  |
| `brown-haired` | brown-haired | 갈색 머리의 | 갈색 머리의 하나를 중심에 | She is brown-haired. |  |
| `black-haired` | black-haired | 검은 머리의 | 검은 머리의 하나를 중심에 | He is black-haired. |  |
| `bald` | bald | 대머리의 | 대머리의 하나를 중심에 | My uncle is bald. |  |
| `beard` | beard | 턱수염 | 턱수염 하나를 중심에 | He has a long beard. |  |
| `mustache` | mustache | 콧수염 | 콧수염 하나를 중심에 | The man has a mustache. |  |
| `freckles` | freckles | 주근깨 | 주근깨 하나를 중심에 | She has freckles. |  |
| `glasses` | glasses | 안경 | 안경 하나를 중심에 | I wear glasses. |  |
| `cool-2` | cool | 멋진 | 선글라스를 쓰고 엄지를 세운 멋진 클레이 아이 | Your bag is cool! |  |
| `funny` | funny | 웃긴, 재미있는 | 웃긴, 재미있는 하나를 중심에 | The clown is funny. |  |
| `blonde` | blonde | 금발의 (여성) | 금발의 (여성) 하나를 중심에 | She has blonde hair. |  |

## 몸 (22개, 남은 22개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `forehead` | forehead | 이마 | 이마 하나를 중심에 | My forehead is hot. |  |
| `eyebrow` | eyebrow | 눈썹 | 눈썹 하나를 중심에 | She has thick eyebrows. |  |
| `eyelash` | eyelash | 속눈썹 | 속눈썹 하나를 중심에 | The baby has long eyelashes. |  |
| `cheek` | cheek | 볼 | 볼 하나를 중심에 | She has a red cheek. |  |
| `chin` | chin | 턱 | 턱 하나를 중심에 | He has a small chin. |  |
| `tongue` | tongue | 혀 | 혀 하나를 중심에 | Stick out your tongue. |  |
| `teeth` | teeth | 이, 치아 (복수) | 이, 치아 (복수) 하나를 중심에 | I brush my teeth. |  |
| `skin` | skin | 피부 | 피부 하나를 중심에 | The baby has soft skin. |  |
| `elbow` | elbow | 팔꿈치 | 팔꿈치 하나를 중심에 | My elbow hurts. |  |
| `wrist` | wrist | 손목 | 손목 하나를 중심에 | She wears a watch on her wrist. |  |
| `thumb` | thumb | 엄지손가락 | 엄지손가락 하나를 중심에 | I hurt my thumb. |  |
| `chest` | chest | 가슴 | 가슴 하나를 중심에 | My chest is warm. |  |
| `stomach` | stomach | 배, 위 | 배, 위 하나를 중심에 | My stomach hurts. |  |
| `waist` | waist | 허리 | 허리 하나를 중심에 | The belt is on my waist. |  |
| `hip` | hip | 엉덩이, 골반 | 엉덩이, 골반 하나를 중심에 | She put her hands on her hips. |  |
| `ankle` | ankle | 발목 | 발목 하나를 중심에 | I hurt my ankle. |  |
| `feet` | feet | 발 (복수) | 발 (복수) 하나를 중심에 | My feet are cold. |  |
| `toe` | toe | 발가락 | 발가락 하나를 중심에 | I have ten toes. |  |
| `bone` | bone | 뼈 | 뼈 하나를 중심에 | The dog has a bone. |  |
| `brain` | brain | 뇌, 머리 | 뇌, 머리 하나를 중심에 | Use your brain. |  |
| `blood` | blood | 피 | 피 하나를 중심에 | The cut has blood. |  |
| `back-2` | back | 등 | 클레이 아이가 뒤돌아서 등을 보이는 장면 | My back hurts. |  |

## 옷 (29개, 남은 29개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `t-shirt` | T-shirt | 티셔츠 | 티셔츠 하나를 중심에 | I wear a T-shirt. |  |
| `blouse` | blouse | 블라우스 | 블라우스 하나를 중심에 | She wears a white blouse. |  |
| `sweatshirt` | sweatshirt | 맨투맨 티셔츠 | 맨투맨 티셔츠 하나를 중심에 | I wear a sweatshirt. |  |
| `hoodie` | hoodie | 후드티 | 후드티 하나를 중심에 | My hoodie is warm. |  |
| `jacket` | jacket | 재킷, 점퍼 | 재킷, 점퍼 하나를 중심에 | Put on your jacket. |  |
| `vest` | vest | 조끼 | 조끼 하나를 중심에 | He wears a vest. |  |
| `trousers` | trousers | 바지 | 바지 하나를 중심에 | These trousers are long. |  |
| `jeans` | jeans | 청바지 | 청바지 하나를 중심에 | I like blue jeans. |  |
| `shorts` | shorts | 반바지 | 반바지 하나를 중심에 | I wear shorts in summer. |  |
| `pajamas` | pajamas | 잠옷 | 잠옷 하나를 중심에 | I wear pajamas at night. |  |
| `underwear` | underwear | 속옷 | 속옷 하나를 중심에 | Put your underwear in the bag. |  |
| `swimsuit` | swimsuit | 수영복 | 수영복 하나를 중심에 | I wear a swimsuit at the pool. |  |
| `uniform` | uniform | 교복, 제복 | 교복, 제복 하나를 중심에 | I wear a school uniform. |  |
| `sneakers` | sneakers | 운동화 | 운동화 하나를 중심에 | I run in my sneakers. |  |
| `boots` | boots | 부츠 | 부츠 하나를 중심에 | I wear boots in winter. |  |
| `sandals` | sandals | 샌들 | 샌들 하나를 중심에 | I wear sandals in summer. |  |
| `slippers` | slippers | 슬리퍼 | 슬리퍼 하나를 중심에 | Put on your slippers. |  |
| `helmet` | helmet | 헬멧 | 헬멧 하나를 중심에 | Wear a helmet on your bike. |  |
| `scarf` | scarf | 목도리 | 목도리 하나를 중심에 | I wear a scarf in winter. |  |
| `mittens` | mittens | 벙어리장갑 | 벙어리장갑 하나를 중심에 | The baby has red mittens. |  |
| `belt` | belt | 허리띠 | 허리띠 하나를 중심에 | He wears a black belt. |  |
| `zipper` | zipper | 지퍼 | 지퍼 하나를 중심에 | Close the zipper. |  |
| `sunglasses` | sunglasses | 선글라스 | 선글라스 하나를 중심에 | I wear sunglasses in summer. |  |
| `backpack` | backpack | 배낭, 책가방 | 배낭, 책가방 하나를 중심에 | My backpack is heavy. |  |
| `handbag` | handbag | 핸드백 | 핸드백 하나를 중심에 | Mom has a new handbag. |  |
| `tie-2` | tie | 넥타이 | 넥타이 하나를 중심에 | Dad wears a tie. |  |
| `socks` | socks | 양말 | 양말 하나를 중심에 | I wear socks in winter. |  |
| `shoes` | shoes | 신발 | 신발 하나를 중심에 | I put on my shoes. |  |
| `gloves` | gloves | 장갑 | 장갑 하나를 중심에 | I wear gloves in winter. |  |

## 색깔 (18개, 남은 18개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `purple` | purple | 보라색의 | 보라색의 하나를 중심에 | I like purple grapes. |  |
| `violet` | violet | 제비꽃색의, 보라색의 | 제비꽃색의, 보라색의 하나를 중심에 | The flower is violet. |  |
| `golden` | golden | 황금빛의 | 황금빛의 하나를 중심에 | She has golden hair. |  |
| `beige` | beige | 베이지색의 | 베이지색의 하나를 중심에 | The sofa is beige. |  |
| `navy` | navy | 남색의 | 남색의 하나를 중심에 | He wears a navy jacket. |  |
| `sky-blue` | sky blue | 하늘색의 | 하늘색의 하나를 중심에 | The sky is sky blue. |  |
| `light-blue` | light blue | 연한 파란색의 | 연한 파란색의 하나를 중심에 | I have a light blue bag. |  |
| `dark-blue` | dark blue | 진한 파란색의 | 진한 파란색의 하나를 중심에 | The sea is dark blue. |  |
| `light-green` | light green | 연두색의 | 연두색의 하나를 중심에 | The leaf is light green. |  |
| `dark-green` | dark green | 진한 초록색의 | 진한 초록색의 하나를 중심에 | The tree is dark green. |  |
| `turquoise` | turquoise | 청록색의 | 청록색의 하나를 중심에 | The water is turquoise. |  |
| `mint` | mint | 민트색의 | 민트색의 하나를 중심에 | I have a mint bag. |  |
| `coral` | coral | 산호색의 | 산호색의 하나를 중심에 | She wears a coral dress. |  |
| `colorful` | colorful | 알록달록한 | 알록달록한 하나를 중심에 | The kite is colorful. |  |
| `orange-2` | orange | 주황색의 | 주황색의 하나를 중심에 | The pumpkin is orange. |  |
| `peach-2` | peach | 복숭아색의 | 복숭아색의 하나를 중심에 | She has a peach dress. |  |
| `cream-2` | cream | 크림색의 | 크림색의 하나를 중심에 | The wall is cream. |  |
| `grey` | grey | 회색의 | 회색의 하나를 중심에 | The cat is grey. |  |

## 장소 (22개, 남은 22개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `neighborhood` | neighborhood | 동네 | 동네 하나를 중심에 | I live in a nice neighborhood. |  |
| `building` | building | 건물 | 건물 하나를 중심에 | The building is tall. |  |
| `factory` | factory | 공장 | 공장 하나를 중심에 | My uncle works in a factory. |  |
| `bus-stop` | bus stop | 버스 정류장 | 버스 정류장 하나를 중심에 | I wait at the bus stop. |  |
| `subway-station` | subway station | 지하철역 | 지하철역 하나를 중심에 | The subway station is near. |  |
| `playground` | playground | 놀이터, 운동장 | 놀이터, 운동장 하나를 중심에 | We play at the playground. |  |
| `movie-theater` | movie theater | 영화관 | 영화관 하나를 중심에 | We go to the movie theater. |  |
| `museum` | museum | 박물관 | 박물관 하나를 중심에 | We visit the museum. |  |
| `aquarium` | aquarium | 수족관 | 수족관 하나를 중심에 | I see fish at the aquarium. |  |
| `clinic` | clinic | 병원, 의원 | 병원, 의원 하나를 중심에 | The clinic is near my house. |  |
| `pharmacy` | pharmacy | 약국 | 약국 하나를 중심에 | I buy medicine at the pharmacy. |  |
| `post-office` | post office | 우체국 | 우체국 하나를 중심에 | I send a letter at the post office. |  |
| `police-station` | police station | 경찰서 | 경찰서 하나를 중심에 | The police station is on the street. |  |
| `fire-station` | fire station | 소방서 | 소방서 하나를 중심에 | The fire station has a red truck. |  |
| `bakery` | bakery | 빵집 | 빵집 하나를 중심에 | I buy bread at the bakery. |  |
| `cafe` | cafe | 카페 | 카페 하나를 중심에 | We drink juice at the cafe. |  |
| `bookstore` | bookstore | 서점 | 서점 하나를 중심에 | I buy a book at the bookstore. |  |
| `toy-store` | toy store | 장난감 가게 | 장난감 가게 하나를 중심에 | I want to go to the toy store. |  |
| `clothing-store` | clothing store | 옷 가게 | 옷 가게 하나를 중심에 | We go to the clothing store. |  |
| `department-store` | department store | 백화점 | 백화점 하나를 중심에 | Mom is at the department store. |  |
| `shopping-mall` | shopping mall | 쇼핑몰 | 쇼핑몰 하나를 중심에 | The shopping mall is big. |  |
| `grocery-store` | grocery store | 식료품점 | 식료품점 하나를 중심에 | We buy milk at the grocery store. |  |

## 나라/세계 (41개, 남은 41개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `korea` | Korea | 한국 | 한국 하나를 중심에 | I live in Korea. |  |
| `south-korea` | South Korea | 대한민국 | 대한민국 하나를 중심에 | South Korea is in Asia. |  |
| `china` | China | 중국 | 중국 하나를 중심에 | China is a big country. |  |
| `japan` | Japan | 일본 | 일본 하나를 중심에 | Japan is near Korea. |  |
| `india` | India | 인도 | 인도 하나를 중심에 | India is a big country. |  |
| `thailand` | Thailand | 태국 | 태국 하나를 중심에 | I want to visit Thailand. |  |
| `vietnam` | Vietnam | 베트남 | 베트남 하나를 중심에 | Vietnam is warm. |  |
| `philippines` | Philippines | 필리핀 | 필리핀 하나를 중심에 | The Philippines has many islands. |  |
| `indonesia` | Indonesia | 인도네시아 | 인도네시아 하나를 중심에 | Indonesia has many islands. |  |
| `singapore` | Singapore | 싱가포르 | 싱가포르 하나를 중심에 | Singapore is a small country. |  |
| `malaysia` | Malaysia | 말레이시아 | 말레이시아 하나를 중심에 | Malaysia is warm all year. |  |
| `australia` | Australia | 호주 | 호주 하나를 중심에 | Kangaroos live in Australia. |  |
| `new-zealand` | New Zealand | 뉴질랜드 | 뉴질랜드 하나를 중심에 | New Zealand has many sheep. |  |
| `canada` | Canada | 캐나다 | 캐나다 하나를 중심에 | It is cold in Canada. |  |
| `united-states` | United States | 미국 | 미국 하나를 중심에 | He is from the United States. |  |
| `america` | America | 미국, 아메리카 | 미국, 아메리카 하나를 중심에 | She lives in America. |  |
| `mexico` | Mexico | 멕시코 | 멕시코 하나를 중심에 | I want to visit Mexico. |  |
| `brazil` | Brazil | 브라질 | 브라질 하나를 중심에 | Brazil is a big country. |  |
| `argentina` | Argentina | 아르헨티나 | 아르헨티나 하나를 중심에 | Argentina is in South America. |  |
| `united-kingdom` | United Kingdom | 영국 | 영국 하나를 중심에 | London is in the United Kingdom. |  |
| `england` | England | 잉글랜드, 영국 | 잉글랜드, 영국 하나를 중심에 | England is a country. |  |
| `france` | France | 프랑스 | 프랑스 하나를 중심에 | Paris is in France. |  |
| `germany` | Germany | 독일 | 독일 하나를 중심에 | Germany is in Europe. |  |
| `italy` | Italy | 이탈리아 | 이탈리아 하나를 중심에 | Pizza is from Italy. |  |
| `spain` | Spain | 스페인 | 스페인 하나를 중심에 | Spain is a warm country. |  |
| `greece` | Greece | 그리스 | 그리스 하나를 중심에 | Greece is in Europe. |  |
| `egypt` | Egypt | 이집트 | 이집트 하나를 중심에 | The pyramids are in Egypt. |  |
| `south-africa` | South Africa | 남아프리카 공화국 | 남아프리카 공화국 하나를 중심에 | South Africa is in Africa. |  |
| `turkey-2` | Turkey | 튀르키예(터키) | 튀르키예를 상징하는 열기구 여러 개가 뜬 풍경(국기·글자 없이) | Turkey is a country. |  |
| `language` | language | 언어, 말 | 언어, 말 하나를 중심에 | English is a language. |  |
| `korean` | Korean | 한국어, 한국인 | 한국어, 한국인 하나를 중심에 | I speak Korean. |  |
| `chinese` | Chinese | 중국어, 중국인 | 중국어, 중국인 하나를 중심에 | She speaks Chinese. |  |
| `japanese` | Japanese | 일본어, 일본인 | 일본어, 일본인 하나를 중심에 | He speaks Japanese. |  |
| `english` | English | 영어, 영국인 | 영어, 영국인 하나를 중심에 | I study English. |  |
| `american` | American | 미국인, 미국의 | 미국인, 미국의 하나를 중심에 | He is American. |  |
| `canadian` | Canadian | 캐나다인, 캐나다의 | 캐나다인, 캐나다의 하나를 중심에 | She is Canadian. |  |
| `australian` | Australian | 호주인, 호주의 | 호주인, 호주의 하나를 중심에 | He is Australian. |  |
| `french` | French | 프랑스어, 프랑스인 | 프랑스어, 프랑스인 하나를 중심에 | She speaks French. |  |
| `german` | German | 독일어, 독일인 | 독일어, 독일인 하나를 중심에 | He speaks German. |  |
| `italian` | Italian | 이탈리아어, 이탈리아인 | 이탈리아어, 이탈리아인 하나를 중심에 | I like Italian food. |  |
| `spanish` | Spanish | 스페인어, 스페인인 | 스페인어, 스페인인 하나를 중심에 | She speaks Spanish. |  |

## 행사/활동 (22개, 남은 22개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `festival` | festival | 축제 | 축제 하나를 중심에 | We go to the festival. |  |
| `celebration` | celebration | 축하, 기념 행사 | 축하, 기념 행사 하나를 중심에 | We have a big celebration. |  |
| `ceremony` | ceremony | 의식, 식 | 의식, 식 하나를 중심에 | The ceremony starts at ten. |  |
| `wedding` | wedding | 결혼식 | 결혼식 하나를 중심에 | We go to a wedding. |  |
| `concert` | concert | 음악회, 콘서트 | 음악회, 콘서트 하나를 중심에 | We go to a concert. |  |
| `parade` | parade | 퍼레이드, 행진 | 퍼레이드, 행진 하나를 중심에 | I see a parade. |  |
| `contest` | contest | 대회, 경연 | 대회, 경연 하나를 중심에 | She won the contest. |  |
| `competition` | competition | 시합, 경쟁 | 시합, 경쟁 하나를 중심에 | We have a dance competition. |  |
| `talent-show` | talent show | 장기 자랑 | 장기 자랑 하나를 중심에 | I sing in the talent show. |  |
| `flea-market` | flea market | 벼룩시장 | 벼룩시장 하나를 중심에 | We go to the flea market. |  |
| `bazaar` | bazaar | 바자회 | 바자회 하나를 중심에 | We sell toys at the bazaar. |  |
| `field-trip` | field trip | 현장 학습, 소풍 | 현장 학습, 소풍 하나를 중심에 | We go on a field trip. |  |
| `sports-day` | sports day | 운동회 | 운동회 하나를 중심에 | Sports day is in May. |  |
| `school-festival` | school festival | 학교 축제 | 학교 축제 하나를 중심에 | We sing at the school festival. |  |
| `graduation` | graduation | 졸업 | 졸업 하나를 중심에 | Graduation is in February. |  |
| `entrance-ceremony` | entrance ceremony | 입학식 | 입학식 하나를 중심에 | The entrance ceremony is in March. |  |
| `summer-camp` | summer camp | 여름 캠프 | 여름 캠프 하나를 중심에 | I go to summer camp. |  |
| `winter-camp` | winter camp | 겨울 캠프 | 겨울 캠프 하나를 중심에 | I go to winter camp. |  |
| `family-day` | family day | 가족의 날 | 가족의 날 하나를 중심에 | We eat out on family day. |  |
| `parents-day` | parents' day | 어버이날 | 어버이날 하나를 중심에 | Parents' day is in May. |  |
| `children-s-day` | children's day | 어린이날 | 어린이날 하나를 중심에 | Children's Day is on May 5. |  |
| `teacher-s-day` | teacher's day | 스승의 날 | 스승의 날 하나를 중심에 | I make a card for Teacher's Day. |  |

## 요일/달력 (19개, 남은 19개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `monday` | Monday | 월요일 | 월요일 하나를 중심에 | I go to school on Monday. |  |
| `tuesday` | Tuesday | 화요일 | 화요일 하나를 중심에 | We have art on Tuesday. |  |
| `wednesday` | Wednesday | 수요일 | 수요일 하나를 중심에 | I have piano on Wednesday. |  |
| `thursday` | Thursday | 목요일 | 목요일 하나를 중심에 | We swim on Thursday. |  |
| `friday` | Friday | 금요일 | 금요일 하나를 중심에 | Friday is fun. |  |
| `saturday` | Saturday | 토요일 | 토요일 하나를 중심에 | I play on Saturday. |  |
| `sunday` | Sunday | 일요일 | 일요일 하나를 중심에 | I rest on Sunday. |  |
| `weekday` | weekday | 평일 | 평일 하나를 중심에 | I go to school on a weekday. |  |
| `weekend` | weekend | 주말 | 주말 하나를 중심에 | I play soccer on the weekend. |  |
| `january` | January | 1월 | 1월 하나를 중심에 | It is cold in January. |  |
| `february` | February | 2월 | 2월 하나를 중심에 | February is short. |  |
| `april` | April | 4월 | 4월 하나를 중심에 | Flowers bloom in April. |  |
| `june` | June | 6월 | 6월 하나를 중심에 | My birthday is in June. |  |
| `july` | July | 7월 | 7월 하나를 중심에 | It is hot in July. |  |
| `august` | August | 8월 | 8월 하나를 중심에 | We go to the beach in August. |  |
| `september` | September | 9월 | 9월 하나를 중심에 | School starts in September. |  |
| `october` | October | 10월 | 10월 하나를 중심에 | Leaves fall in October. |  |
| `november` | November | 11월 | 11월 하나를 중심에 | It is cool in November. |  |
| `december` | December | 12월 | 12월 하나를 중심에 | Christmas is in December. |  |

## 취미/오락 (25개, 남은 25개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `cartoon` | cartoon | 만화 영화 | 만화 영화 하나를 중심에 | I watch a cartoon. |  |
| `animation` | animation | 애니메이션 | 애니메이션 하나를 중심에 | I like animation. |  |
| `comic` | comic | 만화책 | 만화책 하나를 중심에 | I read a comic. |  |
| `tv` | TV | 텔레비전 | 텔레비전 하나를 중심에 | I watch TV after dinner. |  |
| `youtube` | YouTube | 유튜브 | 유튜브 하나를 중심에 | I watch YouTube. |  |
| `theater` | theater | 극장 | 극장 하나를 중심에 | We go to the theater. |  |
| `photograph` | photograph | 사진 | 사진 하나를 중심에 | This is a photograph of my family. |  |
| `photo` | photo | 사진 | 사진 하나를 중심에 | I take a photo. |  |
| `puzzle` | puzzle | 퍼즐 | 퍼즐 하나를 중심에 | I like puzzles. |  |
| `board-game` | board game | 보드게임 | 보드게임 하나를 중심에 | We play a board game. |  |
| `card-game` | card game | 카드 게임 | 카드 게임 하나를 중심에 | We play a card game. |  |
| `computer-game` | computer game | 컴퓨터 게임 | 컴퓨터 게임 하나를 중심에 | I play a computer game. |  |
| `video-game` | video game | 비디오 게임 | 비디오 게임 하나를 중심에 | He plays a video game. |  |
| `karaoke` | karaoke | 노래방 | 노래방 하나를 중심에 | We go to karaoke. |  |
| `magic` | magic | 마술, 마법 | 마술, 마법 하나를 중심에 | I like magic. |  |
| `hobby` | hobby | 취미 | 취미 하나를 중심에 | My hobby is drawing. |  |
| `camping` | camping | 캠핑 | 캠핑 하나를 중심에 | We go camping. |  |
| `fishing` | fishing | 낚시 | 낚시 하나를 중심에 | Dad goes fishing. |  |
| `drawing` | drawing | 그림 그리기 | 그림 그리기 하나를 중심에 | Drawing is fun. |  |
| `painting` | painting | 그림, 색칠하기 | 그림, 색칠하기 하나를 중심에 | I like painting. |  |
| `reading` | reading | 독서 | 독서 하나를 중심에 | Reading is my hobby. |  |
| `singing` | singing | 노래 부르기 | 노래 부르기 하나를 중심에 | Singing is fun. |  |
| `dancing` | dancing | 춤추기 | 춤추기 하나를 중심에 | I like dancing. |  |
| `cooking` | cooking | 요리하기 | 요리하기 하나를 중심에 | Cooking is fun. |  |
| `collecting` | collecting | 수집하기 | 수집하기 하나를 중심에 | Collecting stamps is my hobby. |  |

## 감정 (30개, 남은 30개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `excited` | excited | 신나는, 들뜬 | 신나는, 들뜬 하나를 중심에 | I am excited about the trip. |  |
| `cheerful` | cheerful | 쾌활한, 명랑한 | 쾌활한, 명랑한 하나를 중심에 | She is a cheerful girl. |  |
| `joyful` | joyful | 아주 기쁜 | 아주 기쁜 하나를 중심에 | The children are joyful. |  |
| `proud` | proud | 자랑스러운 | 자랑스러운 하나를 중심에 | I am proud of you. |  |
| `thankful` | thankful | 감사하는 | 감사하는 하나를 중심에 | I am thankful for my friends. |  |
| `grateful` | grateful | 고마워하는 | 고마워하는 하나를 중심에 | I am grateful to my teacher. |  |
| `surprised` | surprised | 놀란 | 놀란 하나를 중심에 | I am surprised. |  |
| `scared` | scared | 무서워하는 | 무서워하는 하나를 중심에 | I am scared of dogs. |  |
| `frightened` | frightened | 겁먹은 | 겁먹은 하나를 중심에 | The kitten is frightened. |  |
| `worried` | worried | 걱정하는 | 걱정하는 하나를 중심에 | Mom is worried. |  |
| `nervous` | nervous | 긴장한 | 긴장한 하나를 중심에 | I am nervous before the test. |  |
| `shy` | shy | 수줍어하는 | 수줍어하는 하나를 중심에 | She is shy. |  |
| `embarrassed` | embarrassed | 부끄러운, 당황한 | 부끄러운, 당황한 하나를 중심에 | I am embarrassed. |  |
| `sleepy` | sleepy | 졸린 | 졸린 하나를 중심에 | I am sleepy. |  |
| `bored` | bored | 지루한 | 지루한 하나를 중심에 | I am bored. |  |
| `lonely` | lonely | 외로운 | 외로운 하나를 중심에 | The old man is lonely. |  |
| `upset` | upset | 속상한 | 속상한 하나를 중심에 | She is upset. |  |
| `disappointed` | disappointed | 실망한 | 실망한 하나를 중심에 | I am disappointed. |  |
| `jealous` | jealous | 질투하는 | 질투하는 하나를 중심에 | He is jealous of his brother. |  |
| `confused` | confused | 혼란스러운 | 혼란스러운 하나를 중심에 | I am confused. |  |
| `interested` | interested | 관심 있는 | 관심 있는 하나를 중심에 | I am interested in space. |  |
| `curious` | curious | 궁금한 | 궁금한 하나를 중심에 | The cat is curious. |  |
| `brave` | brave | 용감한 | 용감한 하나를 중심에 | The firefighter is brave. |  |
| `calm` | calm | 침착한, 고요한 | 침착한, 고요한 하나를 중심에 | Stay calm. |  |
| `relaxed` | relaxed | 느긋한 | 느긋한 하나를 중심에 | I feel relaxed. |  |
| `comfortable` | comfortable | 편안한 | 편안한 하나를 중심에 | The sofa is comfortable. |  |
| `uncomfortable` | uncomfortable | 불편한 | 불편한 하나를 중심에 | These shoes are uncomfortable. |  |
| `friendly` | friendly | 친절한, 다정한 | 친절한, 다정한 하나를 중심에 | My teacher is friendly. |  |
| `silly` | silly | 어리석은, 우스꽝스러운 | 어리석은, 우스꽝스러운 하나를 중심에 | You are so silly! |  |
| `serious` | serious | 진지한 | 진지한 하나를 중심에 | He looks serious. |  |

## 휴일/기념일 (20개, 남은 20개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `new-year-s-day` | New Year's Day | 설날 (1월 1일) | 설날 (1월 1일) 하나를 중심에 | We eat rice cake soup on New Year's Day. |  |
| `lunar-new-year` | Lunar New Year | 설날 (음력 새해) | 설날 (음력 새해) 하나를 중심에 | We bow to elders on Lunar New Year. |  |
| `seollal` | Seollal | 설날 | 설날 하나를 중심에 | We wear hanbok on Seollal. |  |
| `chuseok` | Chuseok | 추석 | 추석 하나를 중심에 | We see the full moon on Chuseok. |  |
| `valentine-s-day` | Valentine's Day | 밸런타인데이 | 밸런타인데이 하나를 중심에 | I give chocolate on Valentine's Day. |  |
| `easter` | Easter | 부활절 | 부활절 하나를 중심에 | We hunt for eggs at Easter. |  |
| `halloween` | Halloween | 핼러윈 | 핼러윈 하나를 중심에 | I wear a costume on Halloween. |  |
| `thanksgiving` | Thanksgiving | 추수감사절 | 추수감사절 하나를 중심에 | We eat turkey on Thanksgiving. |  |
| `christmas` | Christmas | 크리스마스 | 크리스마스 하나를 중심에 | I love Christmas. |  |
| `christmas-eve` | Christmas Eve | 크리스마스 이브 | 크리스마스 이브 하나를 중심에 | We eat cake on Christmas Eve. |  |
| `gift` | gift | 선물 | 선물 하나를 중심에 | This gift is for you. |  |
| `costume` | costume | 의상, 분장 옷 | 의상, 분장 옷 하나를 중심에 | I wear a witch costume. |  |
| `pumpkin` | pumpkin | 호박 | 호박 하나를 중심에 | The pumpkin is orange. |  |
| `santa-claus` | Santa Claus | 산타 할아버지 | 산타 할아버지 하나를 중심에 | Santa Claus brings gifts. |  |
| `reindeer` | reindeer | 순록 | 순록 하나를 중심에 | The reindeer pulls the sleigh. |  |
| `snowman` | snowman | 눈사람 | 눈사람 하나를 중심에 | We make a snowman. |  |
| `christmas-tree` | Christmas tree | 크리스마스 트리 | 크리스마스 트리 하나를 중심에 | The Christmas tree has lights. |  |
| `stocking` | stocking | (크리스마스) 양말 | (크리스마스) 양말 하나를 중심에 | I hang a stocking. |  |
| `lucky-bag` | lucky bag | 복주머니 | 복주머니 하나를 중심에 | I got a lucky bag. |  |
| `rice-cake` | rice cake | 떡 | 떡 하나를 중심에 | We eat rice cake soup. |  |

## 집/가구 (33개, 남은 33개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `living-room` | living room | 거실 | 거실 하나를 중심에 | We watch TV in the living room. |  |
| `bedroom` | bedroom | 침실 | 침실 하나를 중심에 | I sleep in my bedroom. |  |
| `bathroom` | bathroom | 욕실, 화장실 | 욕실, 화장실 하나를 중심에 | The bathroom is clean. |  |
| `dining-room` | dining room | 식당 (집의) | 식당 (집의) 하나를 중심에 | We eat in the dining room. |  |
| `balcony` | balcony | 발코니 | 발코니 하나를 중심에 | I have plants on the balcony. |  |
| `yard` | yard | 마당 | 마당 하나를 중심에 | The dog plays in the yard. |  |
| `garage` | garage | 차고 | 차고 하나를 중심에 | The car is in the garage. |  |
| `sofa` | sofa | 소파 | 소파 하나를 중심에 | I sit on the sofa. |  |
| `couch` | couch | 긴 의자, 소파 | 긴 의자, 소파 하나를 중심에 | The cat is on the couch. |  |
| `pillow` | pillow | 베개 | 베개 하나를 중심에 | I hug my pillow. |  |
| `blanket` | blanket | 담요 | 담요 하나를 중심에 | I have a warm blanket. |  |
| `shelf` | shelf | 선반 | 선반 하나를 중심에 | The book is on the shelf. |  |
| `bookshelf` | bookshelf | 책장 | 책장 하나를 중심에 | The bookshelf has many books. |  |
| `closet` | closet | 옷장, 벽장 | 옷장, 벽장 하나를 중심에 | My clothes are in the closet. |  |
| `wardrobe` | wardrobe | 옷장 | 옷장 하나를 중심에 | The wardrobe is big. |  |
| `drawer` | drawer | 서랍 | 서랍 하나를 중심에 | Open the drawer. |  |
| `refrigerator` | refrigerator | 냉장고 | 냉장고 하나를 중심에 | The milk is in the refrigerator. |  |
| `fridge` | fridge | 냉장고 | 냉장고 하나를 중심에 | Put it in the fridge. |  |
| `freezer` | freezer | 냉동실 | 냉동실 하나를 중심에 | The ice cream is in the freezer. |  |
| `oven` | oven | 오븐 | 오븐 하나를 중심에 | The cake is in the oven. |  |
| `microwave` | microwave | 전자레인지 | 전자레인지 하나를 중심에 | Heat it in the microwave. |  |
| `sink` | sink | 싱크대, 세면대 | 싱크대, 세면대 하나를 중심에 | Wash your hands in the sink. |  |
| `dishwasher` | dishwasher | 식기세척기 | 식기세척기 하나를 중심에 | The dishwasher is on. |  |
| `washing-machine` | washing machine | 세탁기 | 세탁기 하나를 중심에 | The washing machine is loud. |  |
| `fan` | fan | 선풍기, 부채 | 선풍기, 부채 하나를 중심에 | Turn on the fan. |  |
| `air-conditioner` | air conditioner | 에어컨 | 에어컨 하나를 중심에 | Turn on the air conditioner. |  |
| `bathtub` | bathtub | 욕조 | 욕조 하나를 중심에 | I take a bath in the bathtub. |  |
| `toilet` | toilet | 변기, 화장실 | 변기, 화장실 하나를 중심에 | Where is the toilet? |  |
| `towel` | towel | 수건 | 수건 하나를 중심에 | I dry my hands with a towel. |  |
| `toothbrush` | toothbrush | 칫솔 | 칫솔 하나를 중심에 | This is my toothbrush. |  |
| `toothpaste` | toothpaste | 치약 | 치약 하나를 중심에 | I need toothpaste. |  |
| `plate` | plate | 접시 | 접시 하나를 중심에 | The plate is on the table. |  |
| `chopsticks` | chopsticks | 젓가락 | 젓가락 하나를 중심에 | I use chopsticks. |  |

## 건강/질병 (19개, 남은 19개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `healthy` | healthy | 건강한 | 건강한 하나를 중심에 | Vegetables are healthy. |  |
| `unhealthy` | unhealthy | 건강하지 않은 | 건강하지 않은 하나를 중심에 | Too much candy is unhealthy. |  |
| `health` | health | 건강 | 건강 하나를 중심에 | Health is important. |  |
| `pain` | pain | 아픔, 통증 | 아픔, 통증 하나를 중심에 | I feel pain in my leg. |  |
| `flu` | flu | 독감 | 독감 하나를 중심에 | I have the flu. |  |
| `fever` | fever | 열 | 열 하나를 중심에 | I have a fever. |  |
| `cough` | cough | 기침 | 기침 하나를 중심에 | I have a cough. |  |
| `headache` | headache | 두통 | 두통 하나를 중심에 | I have a headache. |  |
| `stomachache` | stomachache | 복통 | 복통 하나를 중심에 | I have a stomachache. |  |
| `toothache` | toothache | 치통 | 치통 하나를 중심에 | I have a toothache. |  |
| `earache` | earache | 귀앓이 | 귀앓이 하나를 중심에 | I have an earache. |  |
| `sore-throat` | sore throat | 목이 아픔 | 목이 아픔 하나를 중심에 | I have a sore throat. |  |
| `runny-nose` | runny nose | 콧물 | 콧물 하나를 중심에 | I have a runny nose. |  |
| `sneeze` | sneeze | 재채기하다 | 클레이 아이가 "재채기하다" 동작을 하는 장면 | I sneeze a lot. |  |
| `bruise` | bruise | 멍 | 멍 하나를 중심에 | I have a bruise on my knee. |  |
| `broken` | broken | 부러진, 고장 난 | 부러진, 고장 난 하나를 중심에 | My arm is broken. |  |
| `medicine` | medicine | 약 | 약 하나를 중심에 | Take your medicine. |  |
| `bandage` | bandage | 붕대, 반창고 | 붕대, 반창고 하나를 중심에 | I put a bandage on my finger. |  |
| `cold-2` | cold | 감기 | 아이가 콧물을 훌쩍이며 담요를 두르고 체온계를 물고 있는 감기 걸린 장면 | I have a cold. |  |

## 쇼핑 (19개, 남은 19개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `mall` | mall | 쇼핑센터 | 쇼핑센터 하나를 중심에 | We go to the mall. |  |
| `customer` | customer | 손님, 고객 | 손님, 고객 하나를 중심에 | The customer buys a toy. |  |
| `clerk` | clerk | 점원 | 점원 하나를 중심에 | The clerk is kind. |  |
| `cashier` | cashier | 계산원 | 계산원 하나를 중심에 | I pay the cashier. |  |
| `seller` | seller | 파는 사람 | 파는 사람 하나를 중심에 | The seller has fruit. |  |
| `buyer` | buyer | 사는 사람 | 사는 사람 하나를 중심에 | The buyer likes the bag. |  |
| `cart` | cart | 카트, 수레 | 카트, 수레 하나를 중심에 | Put it in the cart. |  |
| `counter` | counter | 계산대 | 계산대 하나를 중심에 | Pay at the counter. |  |
| `receipt` | receipt | 영수증 | 영수증 하나를 중심에 | Keep the receipt. |  |
| `price` | price | 가격 | 가격 하나를 중심에 | What is the price? |  |
| `cost` | cost | 값, 비용 | 값, 비용 하나를 중심에 | The cost is ten dollars. |  |
| `sale` | sale | 할인 판매, 세일 | 할인 판매, 세일 하나를 중심에 | The shoes are on sale. |  |
| `discount` | discount | 할인 | 할인 하나를 중심에 | I get a discount. |  |
| `expensive` | expensive | 비싼 | 비싼 하나를 중심에 | This bag is expensive. |  |
| `cash` | cash | 현금 | 현금 하나를 중심에 | I pay in cash. |  |
| `closed` | closed | 닫은, 영업이 끝난 | 닫은, 영업이 끝난 하나를 중심에 | The shop is closed. |  |
| `medium` | medium | 중간의, M 사이즈의 | 중간의, M 사이즈의 하나를 중심에 | I want a medium size. |  |
| `free-2` | free | 무료의 | 선물처럼 가게 진열대에서 그냥 가져가라며 건네는 장면(글자 없이) | The book is free. |  |
| `open-2` | open | 열려 있는, 영업 중인 | 문이 활짝 열린 가게 하나(글자 없이) | The store is open. |  |

## 돈 (11개, 남은 11개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `bill` | bill | 지폐, 계산서 | 지폐, 계산서 하나를 중심에 | I have a one-dollar bill. |  |
| `credit-card` | credit card | 신용카드 | 신용카드 하나를 중심에 | Mom pays with a credit card. |  |
| `wallet` | wallet | 지갑 | 지갑 하나를 중심에 | My wallet is in my bag. |  |
| `purse` | purse | 작은 지갑, 핸드백 | 작은 지갑, 핸드백 하나를 중심에 | She has a red purse. |  |
| `won` | won | 원 (한국 돈) | 원 (한국 돈) 하나를 중심에 | It is one thousand won. |  |
| `cent` | cent | 센트 | 센트 하나를 중심에 | This candy is fifty cents. |  |
| `penny` | penny | 1센트 동전 | 1센트 동전 하나를 중심에 | I found a penny. |  |
| `save` | save | 저축하다, 아끼다 | 클레이 아이가 "저축하다, 아끼다" 동작을 하는 장면 | I save my money. |  |
| `account` | account | 계좌 | 계좌 하나를 중심에 | I have a bank account. |  |
| `allowance` | allowance | 용돈 | 용돈 하나를 중심에 | I get an allowance every week. |  |
| `change-2` | change | 거스름돈 | 손바닥 위의 동전 몇 개(거스름돈) | Here is your change. |  |

## 음악 (22개, 남은 22개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `instrument` | instrument | 악기 | 악기 하나를 중심에 | The piano is an instrument. |  |
| `keyboard` | keyboard | 건반, 키보드 | 건반, 키보드 하나를 중심에 | I play the keyboard. |  |
| `electric-guitar` | electric guitar | 전기 기타 | 전기 기타 하나를 중심에 | He plays the electric guitar. |  |
| `bass` | bass | 베이스 (악기) | 베이스 (악기) 하나를 중심에 | He plays the bass. |  |
| `cello` | cello | 첼로 | 첼로 하나를 중심에 | She plays the cello. |  |
| `drums` | drums | 드럼 | 드럼 하나를 중심에 | I play the drums. |  |
| `flute` | flute | 플루트 | 플루트 하나를 중심에 | She plays the flute. |  |
| `recorder` | recorder | 리코더 | 리코더 하나를 중심에 | I play the recorder. |  |
| `trumpet` | trumpet | 트럼펫 | 트럼펫 하나를 중심에 | He plays the trumpet. |  |
| `trombone` | trombone | 트롬본 | 트롬본 하나를 중심에 | The trombone is loud. |  |
| `saxophone` | saxophone | 색소폰 | 색소폰 하나를 중심에 | He plays the saxophone. |  |
| `clarinet` | clarinet | 클라리넷 | 클라리넷 하나를 중심에 | She plays the clarinet. |  |
| `harmonica` | harmonica | 하모니카 | 하모니카 하나를 중심에 | I play the harmonica. |  |
| `tambourine` | tambourine | 탬버린 | 탬버린 하나를 중심에 | I shake the tambourine. |  |
| `triangle` | triangle | 트라이앵글 (악기, 삼각형) | 트라이앵글 (악기, 삼각형) 하나를 중심에 | I hit the triangle. |  |
| `xylophone` | xylophone | 실로폰 | 실로폰 하나를 중심에 | I play the xylophone. |  |
| `cymbal` | cymbal | 심벌즈 | 심벌즈 하나를 중심에 | The cymbal is loud. |  |
| `microphone` | microphone | 마이크 | 마이크 하나를 중심에 | I sing into the microphone. |  |
| `orchestra` | orchestra | 오케스트라 | 오케스트라 하나를 중심에 | The orchestra plays a song. |  |
| `melody` | melody | 멜로디, 가락 | 멜로디, 가락 하나를 중심에 | I like this melody. |  |
| `rhythm` | rhythm | 리듬 | 리듬 하나를 중심에 | Clap to the rhythm. |  |
| `beat` | beat | 박자 | 박자 하나를 중심에 | I like the beat. |  |

## 자연/날씨 (30개, 남은 30개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `nature` | nature | 자연 | 자연 하나를 중심에 | I love nature. |  |
| `valley` | valley | 계곡, 골짜기 | 계곡, 골짜기 하나를 중심에 | The valley is green. |  |
| `pond` | pond | 연못 | 연못 하나를 중심에 | Ducks swim in the pond. |  |
| `ocean` | ocean | 바다, 대양 | 바다, 대양 하나를 중심에 | The ocean is big. |  |
| `waterfall` | waterfall | 폭포 | 폭포 하나를 중심에 | The waterfall is beautiful. |  |
| `forest` | forest | 숲 | 숲 하나를 중심에 | Deer live in the forest. |  |
| `woods` | woods | 숲, 삼림 | 숲, 삼림 하나를 중심에 | We walk in the woods. |  |
| `desert` | desert | 사막 | 사막 하나를 중심에 | The desert is hot. |  |
| `leaves` | leaves | 나뭇잎 (복수) | 나뭇잎 (복수) 하나를 중심에 | The leaves turn red. |  |
| `branch` | branch | 나뭇가지 | 나뭇가지 하나를 중심에 | A bird is on the branch. |  |
| `root` | root | 뿌리 | 뿌리 하나를 중심에 | The plant has long roots. |  |
| `seed` | seed | 씨앗 | 씨앗 하나를 중심에 | I plant a seed. |  |
| `soil` | soil | 흙 | 흙 하나를 중심에 | Plants grow in the soil. |  |
| `mud` | mud | 진흙 | 진흙 하나를 중심에 | My shoes are in the mud. |  |
| `sunny` | sunny | 화창한 | 화창한 하나를 중심에 | It is sunny today. |  |
| `cloudy` | cloudy | 흐린 | 흐린 하나를 중심에 | It is cloudy today. |  |
| `rainy` | rainy | 비가 오는 | 비가 오는 하나를 중심에 | It is a rainy day. |  |
| `snowy` | snowy | 눈이 오는 | 눈이 오는 하나를 중심에 | It is a snowy day. |  |
| `windy` | windy | 바람 부는 | 바람 부는 하나를 중심에 | It is windy today. |  |
| `foggy` | foggy | 안개 낀 | 안개 낀 하나를 중심에 | It is foggy this morning. |  |
| `stormy` | stormy | 폭풍우 치는 | 폭풍우 치는 하나를 중심에 | It is a stormy night. |  |
| `humid` | humid | 습한 | 습한 하나를 중심에 | Summer is hot and humid. |  |
| `freezing` | freezing | 몹시 추운 | 몹시 추운 하나를 중심에 | It is freezing outside. |  |
| `temperature` | temperature | 온도, 기온 | 온도, 기온 하나를 중심에 | The temperature is low. |  |
| `degree` | degree | 도 (온도 단위) | 도 (온도 단위) 하나를 중심에 | It is twenty degrees. |  |
| `sunshine` | sunshine | 햇빛 | 햇빛 하나를 중심에 | I like the sunshine. |  |
| `fog` | fog | 안개 | 안개 하나를 중심에 | There is fog on the road. |  |
| `thunder` | thunder | 천둥 | 천둥 하나를 중심에 | I hear thunder. |  |
| `lightning` | lightning | 번개 | 번개 하나를 중심에 | I see lightning. |  |
| `snowflake` | snowflake | 눈송이 | 눈송이 하나를 중심에 | A snowflake is on my hand. |  |

## 숫자/시간 (50개, 남은 50개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `one` | one | 하나, 1 | 하나, 1 하나를 중심에 | I have one pencil. |  |
| `two` | two | 둘, 2 | 둘, 2 하나를 중심에 | I have two eyes. |  |
| `three` | three | 셋, 3 | 셋, 3 하나를 중심에 | I see three birds. |  |
| `four` | four | 넷, 4 | 넷, 4 하나를 중심에 | A cat has four legs. |  |
| `five` | five | 다섯, 5 | 다섯, 5 하나를 중심에 | I have five fingers. |  |
| `six` | six | 여섯, 6 | 여섯, 6 하나를 중심에 | I am six years old. |  |
| `seven` | seven | 일곱, 7 | 일곱, 7 하나를 중심에 | There are seven days. |  |
| `eight` | eight | 여덟, 8 | 여덟, 8 하나를 중심에 | A spider has eight legs. |  |
| `nine` | nine | 아홉, 9 | 아홉, 9 하나를 중심에 | I get up at nine. |  |
| `ten` | ten | 열, 10 | 열, 10 하나를 중심에 | I have ten toes. |  |
| `eleven` | eleven | 열하나, 11 | 열하나, 11 하나를 중심에 | A soccer team has eleven players. |  |
| `twelve` | twelve | 열둘, 12 | 열둘, 12 하나를 중심에 | There are twelve months. |  |
| `thirteen` | thirteen | 열셋, 13 | 열셋, 13 하나를 중심에 | My brother is thirteen. |  |
| `fourteen` | fourteen | 열넷, 14 | 열넷, 14 하나를 중심에 | She is fourteen. |  |
| `fifteen` | fifteen | 열다섯, 15 | 열다섯, 15 하나를 중심에 | I have fifteen cards. |  |
| `sixteen` | sixteen | 열여섯, 16 | 열여섯, 16 하나를 중심에 | He is sixteen. |  |
| `seventeen` | seventeen | 열일곱, 17 | 열일곱, 17 하나를 중심에 | She is seventeen. |  |
| `eighteen` | eighteen | 열여덟, 18 | 열여덟, 18 하나를 중심에 | He is eighteen. |  |
| `nineteen` | nineteen | 열아홉, 19 | 열아홉, 19 하나를 중심에 | She is nineteen. |  |
| `twenty` | twenty | 스물, 20 | 스물, 20 하나를 중심에 | I have twenty stickers. |  |
| `thirty` | thirty | 서른, 30 | 서른, 30 하나를 중심에 | There are thirty days. |  |
| `forty` | forty | 마흔, 40 | 마흔, 40 하나를 중심에 | My uncle is forty. |  |
| `fifty` | fifty | 쉰, 50 | 쉰, 50 하나를 중심에 | I have fifty won. |  |
| `sixty` | sixty | 예순, 60 | 예순, 60 하나를 중심에 | One hour is sixty minutes. |  |
| `seventy` | seventy | 일흔, 70 | 일흔, 70 하나를 중심에 | My grandpa is seventy. |  |
| `eighty` | eighty | 여든, 80 | 여든, 80 하나를 중심에 | She is eighty years old. |  |
| `ninety` | ninety | 아흔, 90 | 아흔, 90 하나를 중심에 | The bus has ninety seats. |  |
| `first` | first | 첫 번째의 | 첫 번째의 하나를 중심에 | I am first. |  |
| `second` | second | 두 번째의, 초 | 두 번째의, 초 하나를 중심에 | I am second. |  |
| `third` | third | 세 번째의 | 세 번째의 하나를 중심에 | She is third. |  |
| `fourth` | fourth | 네 번째의 | 네 번째의 하나를 중심에 | I am in the fourth grade. |  |
| `fifth` | fifth | 다섯 번째의 | 다섯 번째의 하나를 중심에 | Today is the fifth. |  |
| `sixth` | sixth | 여섯 번째의 | 여섯 번째의 하나를 중심에 | I am in the sixth grade. |  |
| `seventh` | seventh | 일곱 번째의 | 일곱 번째의 하나를 중심에 | July is the seventh month. |  |
| `eighth` | eighth | 여덟 번째의 | 여덟 번째의 하나를 중심에 | August is the eighth month. |  |
| `ninth` | ninth | 아홉 번째의 | 아홉 번째의 하나를 중심에 | September is the ninth month. |  |
| `tenth` | tenth | 열 번째의 | 열 번째의 하나를 중심에 | October is the tenth month. |  |
| `plus` | plus | 더하기 | 더하기 하나를 중심에 | Two plus two is four. |  |
| `minus` | minus | 빼기 | 빼기 하나를 중심에 | Five minus two is three. |  |
| `equal` | equal | 같은 | 같은 하나를 중심에 | Two and two equal four. |  |
| `more` | more | 더 많은 | 더 많은 하나를 중심에 | I want more. |  |
| `less` | less | 더 적은 | 더 적은 하나를 중심에 | I want less. |  |
| `o-clock` | o'clock | ~시 (정각) | ~시 (정각) 하나를 중심에 | It is three o'clock. |  |
| `quarter` | quarter | 4분의 1, 15분 | 4분의 1, 15분 하나를 중심에 | It is a quarter past two. |  |
| `noon` | noon | 정오 | 정오 하나를 중심에 | We eat lunch at noon. |  |
| `midnight` | midnight | 한밤중, 자정 | 한밤중, 자정 하나를 중심에 | I sleep at midnight. |  |
| `daily` | daily | 매일의 | 매일의 하나를 중심에 | I have a daily routine. |  |
| `every-day` | every day | 매일 | 매일 하나를 중심에 | I read every day. |  |
| `usually` | usually | 보통, 대개 | 보통, 대개 하나를 중심에 | I usually walk to school. |  |
| `sometimes` | sometimes | 가끔 | 가끔 하나를 중심에 | I sometimes play games. |  |

## 사람/가족 (14개, 남은 14개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `person` | person | 사람 | 사람 하나를 중심에 | He is a nice person. |  |
| `children` | children | 아이들 (복수) | 아이들 (복수) 하나를 중심에 | The children play outside. |  |
| `adult` | adult | 어른 | 어른 하나를 중심에 | The adult is kind. |  |
| `neighbor` | neighbor | 이웃 | 이웃 하나를 중심에 | My neighbor is friendly. |  |
| `teacher` | teacher | 선생님 | 선생님 하나를 중심에 | My teacher is kind. |  |
| `grandma` | grandma | 할머니 | 할머니 하나를 중심에 | I love my grandma. |  |
| `grandpa` | grandpa | 할아버지 | 할아버지 하나를 중심에 | I love my grandpa. |  |
| `grandfather` | grandfather | 할아버지 | 할아버지 하나를 중심에 | My grandfather is old. |  |
| `parents` | parents | 부모님 | 부모님 하나를 중심에 | My parents are kind. |  |
| `grandparents` | grandparents | 조부모님 | 조부모님 하나를 중심에 | I visit my grandparents. |  |
| `older-sister` | older sister | 언니, 누나 | 언니, 누나 하나를 중심에 | I have an older sister. |  |
| `younger-sister` | younger sister | 여동생 | 여동생 하나를 중심에 | I have a younger sister. |  |
| `older-brother` | older brother | 형, 오빠 | 형, 오빠 하나를 중심에 | I have an older brother. |  |
| `younger-brother` | younger brother | 남동생 | 남동생 하나를 중심에 | I have a younger brother. |  |

## 학교/문구 (22개, 남은 22개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `classroom` | classroom | 교실 | 교실 하나를 중심에 | Our classroom is big. |  |
| `gym` | gym | 체육관 | 체육관 하나를 중심에 | We play in the gym. |  |
| `cafeteria` | cafeteria | 구내식당 | 구내식당 하나를 중심에 | We eat in the cafeteria. |  |
| `recess` | recess | 쉬는 시간 | 쉬는 시간 하나를 중심에 | We play at recess. |  |
| `subject` | subject | 과목 | 과목 하나를 중심에 | My favorite subject is art. |  |
| `math` | math | 수학 | 수학 하나를 중심에 | I like math. |  |
| `science` | science | 과학 | 과학 하나를 중심에 | Science is fun. |  |
| `social-studies` | social studies | 사회 | 사회 하나를 중심에 | We study maps in social studies. |  |
| `art` | art | 미술 | 미술 하나를 중심에 | I like art. |  |
| `p-e` | P.E. | 체육 | 체육 하나를 중심에 | We have P.E. today. |  |
| `textbook` | textbook | 교과서 | 교과서 하나를 중심에 | Open your textbook. |  |
| `workbook` | workbook | 문제집, 워크북 | 문제집, 워크북 하나를 중심에 | Do your workbook. |  |
| `notebook` | notebook | 공책 | 공책 하나를 중심에 | I write in my notebook. |  |
| `scissors` | scissors | 가위 | 가위 하나를 중심에 | I cut paper with scissors. |  |
| `marker` | marker | 마커, 매직펜 | 마커, 매직펜 하나를 중심에 | I draw with a marker. |  |
| `colored-pencil` | colored pencil | 색연필 | 색연필 하나를 중심에 | I have colored pencils. |  |
| `pencil-case` | pencil case | 필통 | 필통 하나를 중심에 | My pencil case is blue. |  |
| `whiteboard` | whiteboard | 화이트보드 | 화이트보드 하나를 중심에 | Write on the whiteboard. |  |
| `tablet` | tablet | 태블릿 | 태블릿 하나를 중심에 | I use a tablet in class. |  |
| `homework` | homework | 숙제 | 숙제 하나를 중심에 | I do my homework. |  |
| `quiz` | quiz | 퀴즈, 간단한 시험 | 퀴즈, 간단한 시험 하나를 중심에 | We have a quiz today. |  |
| `sentence` | sentence | 문장 | 문장 하나를 중심에 | Read the sentence. |  |

## 모양 (10개, 남은 10개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `rectangle` | rectangle | 직사각형 | 직사각형 하나를 중심에 | The door is a rectangle. |  |
| `oval` | oval | 타원형 | 타원형 하나를 중심에 | The mirror is an oval. |  |
| `diamond` | diamond | 마름모, 다이아몬드 | 마름모, 다이아몬드 하나를 중심에 | The kite is a diamond. |  |
| `pentagon` | pentagon | 오각형 | 오각형 하나를 중심에 | A pentagon has five sides. |  |
| `hexagon` | hexagon | 육각형 | 육각형 하나를 중심에 | A hexagon has six sides. |  |
| `octagon` | octagon | 팔각형 | 팔각형 하나를 중심에 | A stop sign is an octagon. |  |
| `dot` | dot | 점 | 점 하나를 중심에 | Draw a dot. |  |
| `curve` | curve | 곡선 | 곡선 하나를 중심에 | The road has a curve. |  |
| `flat` | flat | 평평한 | 평평한 하나를 중심에 | The table is flat. |  |
| `bottom` | bottom | 맨 아래, 바닥 | 맨 아래, 바닥 하나를 중심에 | Look at the bottom of the page. |  |

## 스포츠 (29개, 남은 29개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `football` | football | 축구, 미식축구 | 축구, 미식축구 하나를 중심에 | He plays football. |  |
| `baseball` | baseball | 야구 | 야구 하나를 중심에 | I play baseball. |  |
| `basketball` | basketball | 농구 | 농구 하나를 중심에 | I play basketball. |  |
| `volleyball` | volleyball | 배구 | 배구 하나를 중심에 | We play volleyball. |  |
| `badminton` | badminton | 배드민턴 | 배드민턴 하나를 중심에 | We play badminton. |  |
| `table-tennis` | table tennis | 탁구 | 탁구 하나를 중심에 | I play table tennis. |  |
| `golf` | golf | 골프 | 골프 하나를 중심에 | Dad plays golf. |  |
| `bowling` | bowling | 볼링 | 볼링 하나를 중심에 | We go bowling. |  |
| `swimming` | swimming | 수영 | 수영 하나를 중심에 | I like swimming. |  |
| `running` | running | 달리기 | 달리기 하나를 중심에 | Running is fun. |  |
| `jogging` | jogging | 조깅 | 조깅 하나를 중심에 | I go jogging. |  |
| `cycling` | cycling | 자전거 타기 | 자전거 타기 하나를 중심에 | Cycling is fun. |  |
| `skating` | skating | 스케이트 타기 | 스케이트 타기 하나를 중심에 | I like skating. |  |
| `skiing` | skiing | 스키 타기 | 스키 타기 하나를 중심에 | We go skiing in winter. |  |
| `snowboarding` | snowboarding | 스노보드 타기 | 스노보드 타기 하나를 중심에 | Snowboarding is exciting. |  |
| `surfing` | surfing | 서핑 | 서핑 하나를 중심에 | Surfing is fun. |  |
| `boxing` | boxing | 권투 | 권투 하나를 중심에 | He likes boxing. |  |
| `wrestling` | wrestling | 레슬링 | 레슬링 하나를 중심에 | Wrestling is a strong sport. |  |
| `gymnastics` | gymnastics | 체조 | 체조 하나를 중심에 | She does gymnastics. |  |
| `taekwondo` | taekwondo | 태권도 | 태권도 하나를 중심에 | I learn taekwondo. |  |
| `karate` | karate | 가라테 | 가라테 하나를 중심에 | He learns karate. |  |
| `yoga` | yoga | 요가 | 요가 하나를 중심에 | Mom does yoga. |  |
| `player` | player | 선수, 경기자 | 선수, 경기자 하나를 중심에 | He is a good player. |  |
| `coach` | coach | 코치, 감독 | 코치, 감독 하나를 중심에 | The coach is kind. |  |
| `bat` | bat | 야구 방망이 | 야구 방망이 하나를 중심에 | He has a baseball bat. |  |
| `racket` | racket | 라켓 | 라켓 하나를 중심에 | I hold a racket. |  |
| `goal` | goal | 골, 목표 | 골, 목표 하나를 중심에 | He scores a goal. |  |
| `race` | race | 경주, 달리기 시합 | 경주, 달리기 시합 하나를 중심에 | I win the race. |  |
| `match` | match | 경기, 시합 | 경기, 시합 하나를 중심에 | We win the match. |  |

## 크기 (15개, 남은 15개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `huge` | huge | 거대한 | 거대한 하나를 중심에 | The whale is huge. |  |
| `giant` | giant | 아주 큰 | 아주 큰 하나를 중심에 | The giant tree is old. |  |
| `tiny` | tiny | 아주 작은 | 아주 작은 하나를 중심에 | The ant is tiny. |  |
| `shallow` | shallow | 얕은 | 얕은 하나를 중심에 | The pond is shallow. |  |
| `different` | different | 다른 | 다른 하나를 중심에 | We are different. |  |
| `bigger` | bigger | 더 큰 | 더 큰 하나를 중심에 | A lion is bigger than a cat. |  |
| `smaller` | smaller | 더 작은 | 더 작은 하나를 중심에 | A mouse is smaller than a cat. |  |
| `taller` | taller | 더 키가 큰 | 더 키가 큰 하나를 중심에 | He is taller than me. |  |
| `shorter` | shorter | 더 짧은, 더 키가 작은 | 더 짧은, 더 키가 작은 하나를 중심에 | My hair is shorter now. |  |
| `longer` | longer | 더 긴 | 더 긴 하나를 중심에 | The river is longer than the road. |  |
| `heavier` | heavier | 더 무거운 | 더 무거운 하나를 중심에 | The rock is heavier than the ball. |  |
| `lighter` | lighter | 더 가벼운 | 더 가벼운 하나를 중심에 | The feather is lighter than a coin. |  |
| `height` | height | 키, 높이 | 키, 높이 하나를 중심에 | What is your height? |  |
| `length` | length | 길이 | 길이 하나를 중심에 | Measure the length. |  |
| `weight` | weight | 무게 | 무게 하나를 중심에 | What is your weight? |  |

## 우주 (20개, 남은 20개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `universe` | universe | 우주 | 우주 하나를 중심에 | The universe is big. |  |
| `galaxy` | galaxy | 은하 | 은하 하나를 중심에 | Our galaxy has many stars. |  |
| `solar-system` | solar system | 태양계 | 태양계 하나를 중심에 | The solar system has eight planets. |  |
| `planet` | planet | 행성 | 행성 하나를 중심에 | Earth is a planet. |  |
| `mercury` | Mercury | 수성 | 수성 하나를 중심에 | Mercury is near the sun. |  |
| `venus` | Venus | 금성 | 금성 하나를 중심에 | Venus is bright. |  |
| `mars` | Mars | 화성 | 화성 하나를 중심에 | Mars is red. |  |
| `jupiter` | Jupiter | 목성 | 목성 하나를 중심에 | Jupiter is a big planet. |  |
| `saturn` | Saturn | 토성 | 토성 하나를 중심에 | Saturn has rings. |  |
| `uranus` | Uranus | 천왕성 | 천왕성 하나를 중심에 | Uranus is a cold planet. |  |
| `neptune` | Neptune | 해왕성 | 해왕성 하나를 중심에 | Neptune is far from the sun. |  |
| `comet` | comet | 혜성 | 혜성 하나를 중심에 | A comet has a long tail. |  |
| `asteroid` | asteroid | 소행성 | 소행성 하나를 중심에 | An asteroid is a small rock. |  |
| `meteor` | meteor | 유성 | 유성 하나를 중심에 | I see a meteor at night. |  |
| `gravity` | gravity | 중력 | 중력 하나를 중심에 | Gravity pulls things down. |  |
| `spaceship` | spaceship | 우주선 | 우주선 하나를 중심에 | The spaceship flies to Mars. |  |
| `astronaut` | astronaut | 우주 비행사 | 우주 비행사 하나를 중심에 | The astronaut is in space. |  |
| `alien` | alien | 외계인 | 외계인 하나를 중심에 | The alien is green. |  |
| `satellite` | satellite | 인공위성 | 인공위성 하나를 중심에 | A satellite goes around Earth. |  |
| `telescope` | telescope | 망원경 | 망원경 하나를 중심에 | I see stars with a telescope. |  |

## 장난감 (19개, 남은 19개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `teddy-bear` | teddy bear | 곰 인형 | 곰 인형 하나를 중심에 | I hug my teddy bear. |  |
| `stuffed-animal` | stuffed animal | 동물 인형 | 동물 인형 하나를 중심에 | I have a stuffed animal. |  |
| `puppet` | puppet | 꼭두각시, 손인형 | 꼭두각시, 손인형 하나를 중심에 | The puppet is funny. |  |
| `toy-car` | toy car | 장난감 자동차 | 장난감 자동차 하나를 중심에 | I have a toy car. |  |
| `airplane` | airplane | 비행기 | 비행기 하나를 중심에 | The airplane flies high. |  |
| `helicopter` | helicopter | 헬리콥터 | 헬리콥터 하나를 중심에 | The helicopter is loud. |  |
| `block` | block | 블록, 덩어리 | 블록, 덩어리 하나를 중심에 | I stack a block. |  |
| `blocks` | blocks | 블록들, 쌓기 나무 | 블록들, 쌓기 나무 하나를 중심에 | I play with blocks. |  |
| `lego` | lego | 레고 | 레고 하나를 중심에 | I build with Lego. |  |
| `kite` | kite | 연 | 연 하나를 중심에 | I fly a kite. |  |
| `yo-yo` | yo-yo | 요요 | 요요 하나를 중심에 | I play with a yo-yo. |  |
| `marble` | marble | 구슬 | 구슬 하나를 중심에 | I have a blue marble. |  |
| `spinning-top` | spinning top | 팽이 | 팽이 하나를 중심에 | I spin the spinning top. |  |
| `dice` | dice | 주사위 | 주사위 하나를 중심에 | Roll the dice. |  |
| `jump-rope` | jump rope | 줄넘기 줄 | 줄넘기 줄 하나를 중심에 | I jump rope every day. |  |
| `hula-hoop` | hula hoop | 훌라후프 | 훌라후프 하나를 중심에 | I spin a hula hoop. |  |
| `scooter` | scooter | 킥보드 | 킥보드 하나를 중심에 | I ride a scooter. |  |
| `bike` | bike | 자전거 | 자전거 하나를 중심에 | I ride my bike. |  |
| `skateboard` | skateboard | 스케이트보드 | 스케이트보드 하나를 중심에 | He rides a skateboard. |  |

## 교통 (13개, 남은 13개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `transportation` | transportation | 교통, 교통수단 | 교통, 교통수단 하나를 중심에 | A bus is transportation. |  |
| `van` | van | 승합차 | 승합차 하나를 중심에 | We go by van. |  |
| `motorcycle` | motorcycle | 오토바이 | 오토바이 하나를 중심에 | He rides a motorcycle. |  |
| `ferry` | ferry | 여객선 | 여객선 하나를 중심에 | We take a ferry. |  |
| `ambulance` | ambulance | 구급차 | 구급차 하나를 중심에 | The ambulance is fast. |  |
| `police-car` | police car | 경찰차 | 경찰차 하나를 중심에 | The police car is loud. |  |
| `fire-engine` | fire engine | 소방차 | 소방차 하나를 중심에 | The fire engine is red. |  |
| `school-bus` | school bus | 통학 버스 | 통학 버스 하나를 중심에 | I take the school bus. |  |
| `traffic-light` | traffic light | 신호등 | 신호등 하나를 중심에 | Stop at the traffic light. |  |
| `crosswalk` | crosswalk | 횡단보도 | 횡단보도 하나를 중심에 | Use the crosswalk. |  |
| `passenger` | passenger | 승객 | 승객 하나를 중심에 | The passenger gets on the bus. |  |
| `driver` | driver | 운전사 | 운전사 하나를 중심에 | The driver is kind. |  |
| `sail` | sail | 항해하다 | 클레이 아이가 "항해하다" 동작을 하는 장면 | We sail on the sea. |  |

## 과학기술 (24개, 남은 24개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `technology` | technology | 기술 | 기술 하나를 중심에 | Technology is helpful. |  |
| `laptop` | laptop | 노트북 컴퓨터 | 노트북 컴퓨터 하나를 중심에 | I use a laptop. |  |
| `smartphone` | smartphone | 스마트폰 | 스마트폰 하나를 중심에 | Mom has a smartphone. |  |
| `phone` | phone | 전화기 | 전화기 하나를 중심에 | The phone is ringing. |  |
| `machine` | machine | 기계 | 기계 하나를 중심에 | This machine is loud. |  |
| `screen` | screen | 화면 | 화면 하나를 중심에 | The screen is bright. |  |
| `printer` | printer | 프린터 | 프린터 하나를 중심에 | The printer is broken. |  |
| `speaker` | speaker | 스피커 | 스피커 하나를 중심에 | The speaker is loud. |  |
| `headphone` | headphone | 헤드폰 | 헤드폰 하나를 중심에 | I use headphones. |  |
| `earphone` | earphone | 이어폰 | 이어폰 하나를 중심에 | I use earphones. |  |
| `charger` | charger | 충전기 | 충전기 하나를 중심에 | I need a charger. |  |
| `battery` | battery | 건전지, 배터리 | 건전지, 배터리 하나를 중심에 | The battery is low. |  |
| `internet` | internet | 인터넷 | 인터넷 하나를 중심에 | I use the internet. |  |
| `website` | website | 웹사이트 | 웹사이트 하나를 중심에 | This website is fun. |  |
| `app` | app | 앱 | 앱 하나를 중심에 | I have a new app. |  |
| `message` | message | 메시지 | 메시지 하나를 중심에 | I send a message. |  |
| `email` | email | 이메일 | 이메일 하나를 중심에 | I send an email. |  |
| `password` | password | 비밀번호 | 비밀번호 하나를 중심에 | Do not tell your password. |  |
| `click` | click | 클릭하다 | 클레이 아이가 "클릭하다" 동작을 하는 장면 | Click the button. |  |
| `type` | type | (글자를) 입력하다 | 클레이 아이가 "(글자를) 입력하다" 동작을 하는 장면 | Type your name. |  |
| `download` | download | 내려받다 | 클레이 아이가 "내려받다" 동작을 하는 장면 | I download a game. |  |
| `upload` | upload | 올리다 | 클레이 아이가 "올리다" 동작을 하는 장면 | I upload a photo. |  |
| `delete` | delete | 지우다 | 클레이 아이가 "지우다" 동작을 하는 장면 | Delete the file. |  |
| `mouse-2` | mouse | (컴퓨터) 마우스 | 컴퓨터 마우스 하나를 중심에(쥐 동물 그림 아님) | Click with the mouse. |  |

## 상태 (13개, 남은 13개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `ugly` | ugly | 못생긴, 보기 흉한 | 못생긴, 보기 흉한 하나를 중심에 | The monster is ugly. |  |
| `shiny` | shiny | 반짝이는 | 반짝이는 하나를 중심에 | The coin is shiny. |  |
| `smooth` | smooth | 매끄러운 | 매끄러운 하나를 중심에 | The stone is smooth. |  |
| `rough` | rough | 거친 | 거친 하나를 중심에 | The wall is rough. |  |
| `smart` | smart | 똑똑한 | 똑똑한 하나를 중심에 | She is smart. |  |
| `clever` | clever | 영리한 | 영리한 하나를 중심에 | The fox is clever. |  |
| `difficult` | difficult | 어려운 | 어려운 하나를 중심에 | This question is difficult. |  |
| `dangerous` | dangerous | 위험한 | 위험한 하나를 중심에 | Fire is dangerous. |  |
| `special` | special | 특별한 | 특별한 하나를 중심에 | Today is a special day. |  |
| `important` | important | 중요한 | 중요한 하나를 중심에 | It is important. |  |
| `careful` | careful | 조심하는 | 조심하는 하나를 중심에 | Be careful. |  |
| `useful` | useful | 유용한 | 유용한 하나를 중심에 | A map is useful. |  |
| `light-2` | light | 가벼운 | 깃털처럼 가벼운 가방을 한 손으로 드는 장면 | The bag is light. |  |

## 위치/방향 (7개, 남은 7개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `above` | above | ~보다 위에 | ~보다 위에 하나를 중심에 | The bird is above the tree. |  |
| `next-to` | next to | ~ 옆에 | ~ 옆에 하나를 중심에 | I sit next to Ben. |  |
| `in-front-of` | in front of | ~ 앞에 | ~ 앞에 하나를 중심에 | The dog is in front of the door. |  |
| `inside` | inside | 안에 | 안에 하나를 중심에 | Come inside. |  |
| `outside` | outside | 밖에 | 밖에 하나를 중심에 | Let us play outside. |  |
| `forward` | forward | 앞으로 | 앞으로 하나를 중심에 | Move forward. |  |
| `backward` | backward | 뒤로 | 뒤로 하나를 중심에 | Step backward. |  |

## 의문사 (1개, 남은 1개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `whose` | whose | 누구의 | 누구의 하나를 중심에 | Whose bag is this? |  |

## 성격 (10개, 남은 10개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `helpful` | helpful | 도움이 되는 | 도움이 되는 하나를 중심에 | She is helpful. |  |
| `active` | active | 활동적인 | 활동적인 하나를 중심에 | He is an active boy. |  |
| `honest` | honest | 정직한 | 정직한 하나를 중심에 | He is honest. |  |
| `polite` | polite | 예의 바른 | 예의 바른 하나를 중심에 | She is polite. |  |
| `patient` | patient | 참을성 있는 | 참을성 있는 하나를 중심에 | Be patient. |  |
| `lazy` | lazy | 게으른 | 게으른 하나를 중심에 | The cat is lazy. |  |
| `hardworking` | hardworking | 부지런한 | 부지런한 하나를 중심에 | My mom is hardworking. |  |
| `creative` | creative | 창의적인 | 창의적인 하나를 중심에 | She is creative. |  |
| `generous` | generous | 너그러운 | 너그러운 하나를 중심에 | He is generous. |  |
| `selfish` | selfish | 이기적인 | 이기적인 하나를 중심에 | Do not be selfish. |  |

## 맛/질감 (12개, 남은 12개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `sour` | sour | 신 | 신 하나를 중심에 | The lemon is sour. |  |
| `salty` | salty | 짠 | 짠 하나를 중심에 | The soup is salty. |  |
| `bitter` | bitter | 쓴 | 쓴 하나를 중심에 | Medicine is bitter. |  |
| `spicy` | spicy | 매운 | 매운 하나를 중심에 | Kimchi is spicy. |  |
| `delicious` | delicious | 아주 맛있는 | 아주 맛있는 하나를 중심에 | The cake is delicious. |  |
| `yummy` | yummy | 맛있는 | 맛있는 하나를 중심에 | This pizza is yummy. |  |
| `tasty` | tasty | 맛있는 | 맛있는 하나를 중심에 | The soup is tasty. |  |
| `juicy` | juicy | 즙이 많은 | 즙이 많은 하나를 중심에 | The peach is juicy. |  |
| `crunchy` | crunchy | 바삭바삭한 | 바삭바삭한 하나를 중심에 | The apple is crunchy. |  |
| `crispy` | crispy | 바삭한 | 바삭한 하나를 중심에 | The chicken is crispy. |  |
| `chewy` | chewy | 쫄깃한 | 쫄깃한 하나를 중심에 | The candy is chewy. |  |
| `sticky` | sticky | 끈적끈적한 | 끈적끈적한 하나를 중심에 | My hands are sticky. |  |

## 직업 (22개, 남은 22개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `dentist` | dentist | 치과 의사 | 치과 의사 하나를 중심에 | The dentist checks my teeth. |  |
| `veterinarian` | veterinarian | 수의사 | 수의사 하나를 중심에 | The veterinarian helps animals. |  |
| `scientist` | scientist | 과학자 | 과학자 하나를 중심에 | The scientist does an experiment. |  |
| `engineer` | engineer | 기술자, 공학자 | 기술자, 공학자 하나를 중심에 | My dad is an engineer. |  |
| `programmer` | programmer | 프로그래머 | 프로그래머 하나를 중심에 | She is a programmer. |  |
| `police-officer` | police officer | 경찰관 | 경찰관 하나를 중심에 | The police officer helps people. |  |
| `firefighter` | firefighter | 소방관 | 소방관 하나를 중심에 | The firefighter is brave. |  |
| `farmer` | farmer | 농부 | 농부 하나를 중심에 | The farmer grows rice. |  |
| `chef` | chef | 요리사 | 요리사 하나를 중심에 | The chef makes pasta. |  |
| `baker` | baker | 제빵사 | 제빵사 하나를 중심에 | The baker makes bread. |  |
| `flight-attendant` | flight attendant | 승무원 | 승무원 하나를 중심에 | The flight attendant is kind. |  |
| `artist` | artist | 화가, 예술가 | 화가, 예술가 하나를 중심에 | The artist paints a picture. |  |
| `singer` | singer | 가수 | 가수 하나를 중심에 | She is a singer. |  |
| `dancer` | dancer | 무용수 | 무용수 하나를 중심에 | He is a dancer. |  |
| `actor` | actor | 배우 | 배우 하나를 중심에 | He is an actor. |  |
| `writer` | writer | 작가 | 작가 하나를 중심에 | She is a writer. |  |
| `photographer` | photographer | 사진작가 | 사진작가 하나를 중심에 | The photographer takes photos. |  |
| `designer` | designer | 디자이너 | 디자이너 하나를 중심에 | She is a designer. |  |
| `athlete` | athlete | 운동선수 | 운동선수 하나를 중심에 | He is an athlete. |  |
| `soccer-player` | soccer player | 축구 선수 | 축구 선수 하나를 중심에 | He is a soccer player. |  |
| `baseball-player` | baseball player | 야구 선수 | 야구 선수 하나를 중심에 | He is a baseball player. |  |
| `office-worker` | office worker | 회사원 | 회사원 하나를 중심에 | My dad is an office worker. |  |

## 재료 (9개, 남은 9개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `metal` | metal | 금속 | 금속 하나를 중심에 | The spoon is metal. |  |
| `plastic` | plastic | 플라스틱 | 플라스틱 하나를 중심에 | The bottle is plastic. |  |
| `fabric` | fabric | 천, 직물 | 천, 직물 하나를 중심에 | The fabric is soft. |  |
| `cloth` | cloth | 천 | 천 하나를 중심에 | I wipe it with a cloth. |  |
| `rubber` | rubber | 고무 | 고무 하나를 중심에 | The ball is rubber. |  |
| `clay` | clay | 찰흙 | 찰흙 하나를 중심에 | I make a cup with clay. |  |
| `cotton` | cotton | 면, 목화 | 면, 목화 하나를 중심에 | The shirt is cotton. |  |
| `wool` | wool | 양털, 털실 | 양털, 털실 하나를 중심에 | The sweater is wool. |  |
| `leather` | leather | 가죽 | 가죽 하나를 중심에 | The bag is leather. |  |

## 과학 (14개, 남은 14개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `solid` | solid | 고체 | 고체 하나를 중심에 | Ice is a solid. |  |
| `liquid` | liquid | 액체 | 액체 하나를 중심에 | Water is a liquid. |  |
| `material` | material | 재료, 물질 | 재료, 물질 하나를 중심에 | What is this material? |  |
| `heat` | heat | 열, 더위 | 열, 더위 하나를 중심에 | I feel the heat. |  |
| `force` | force | 힘 | 힘 하나를 중심에 | Force moves things. |  |
| `energy` | energy | 에너지 | 에너지 하나를 중심에 | The sun gives us energy. |  |
| `magnet` | magnet | 자석 | 자석 하나를 중심에 | A magnet pulls a nail. |  |
| `electricity` | electricity | 전기 | 전기 하나를 중심에 | A lamp uses electricity. |  |
| `boil` | boil | 끓이다 | 클레이 아이가 "끓이다" 동작을 하는 장면 | Boil the water. |  |
| `float` | float | 뜨다 | 클레이 아이가 "뜨다" 동작을 하는 장면 | The boat floats. |  |
| `dissolve` | dissolve | 녹다, 녹이다 | 클레이 아이가 "녹다, 녹이다" 동작을 하는 장면 | Sugar dissolves in water. |  |
| `living-thing` | living thing | 생물 | 생물 하나를 중심에 | A plant is a living thing. |  |
| `habitat` | habitat | 서식지 | 서식지 하나를 중심에 | The forest is the bird's habitat. |  |
| `environment` | environment | 환경 | 환경 하나를 중심에 | We protect the environment. |  |

## 환경 (7개, 남은 7개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `trash` | trash | 쓰레기 | 쓰레기 하나를 중심에 | Put the trash in the bin. |  |
| `garbage` | garbage | 쓰레기 | 쓰레기 하나를 중심에 | Take out the garbage. |  |
| `recycle` | recycle | 재활용하다 | 클레이 아이가 "재활용하다" 동작을 하는 장면 | We recycle paper. |  |
| `reuse` | reuse | 다시 쓰다 | 클레이 아이가 "다시 쓰다" 동작을 하는 장면 | Reuse the bag. |  |
| `reduce` | reduce | 줄이다 | 클레이 아이가 "줄이다" 동작을 하는 장면 | Reduce trash. |  |
| `protect` | protect | 보호하다 | 클레이 아이가 "보호하다" 동작을 하는 장면 | We protect nature. |  |
| `pollution` | pollution | 오염 | 오염 하나를 중심에 | Air pollution is bad. |  |

## 독해/이야기 (12개, 남은 12개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `title` | title | 제목 | 제목 하나를 중심에 | What is the title? |  |
| `author` | author | 저자, 작가 | 저자, 작가 하나를 중심에 | Who is the author? |  |
| `illustrator` | illustrator | 삽화가 | 삽화가 하나를 중심에 | The illustrator draws the pictures. |  |
| `character` | character | 등장인물 | 등장인물 하나를 중심에 | Who is the main character? |  |
| `setting` | setting | 배경 | 배경 하나를 중심에 | The setting is a forest. |  |
| `beginning` | beginning | 시작, 처음 | 시작, 처음 하나를 중심에 | The beginning is fun. |  |
| `solution` | solution | 해결책 | 해결책 하나를 중심에 | Find a solution. |  |
| `event` | event | 사건, 행사 | 사건, 행사 하나를 중심에 | What is the main event? |  |
| `chapter` | chapter | (책의) 장 | (책의) 장 하나를 중심에 | Read chapter one. |  |
| `predict` | predict | 예측하다 | 클레이 아이가 "예측하다" 동작을 하는 장면 | Predict what happens next. |  |
| `imagine` | imagine | 상상하다 | 클레이 아이가 "상상하다" 동작을 하는 장면 | Imagine a big castle. |  |
| `finally` | finally | 마침내, 드디어 | 마침내, 드디어 하나를 중심에 | Finally, we arrive. |  |

## 사물 (1개, 남은 1개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `watch-2` | watch | 손목시계 | 손목시계 하나를 중심에 | I have a new watch. |  |
