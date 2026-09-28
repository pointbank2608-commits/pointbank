# 교육부 필수 영단어 그림 제작 인계 (확장 1차: 초등 빠진 단어)

작성: Claude Code (2026-09-28). 대상 폴더: `app/public/word-bank-images/`. 기존 인계서 `CURSOR_IMAGE_HANDOFF.md`의 **규격(화풍·크기·파일명·글자 금지)을 그대로 따른다.** 이 문서는 거기에 더해 "추상적인 단어를 어떻게 그릴지"와 이번 목록만 적는다.

앞으로 교육부 3000단어(중학 1200·고등 1000)까지 사전을 넓힌다. 같은 규칙으로 목록이 배치마다 이 문서 뒤에 붙는다.

## 그림 종류 4가지 (단어마다 이미 정해져 있음)

| 종류 | 뜻 | 그리는 법 |
|---|---|---|
| **사물** (object) | 눈에 보이는 물건·동물·장소 | 기존과 같다. 주제 하나를 가운데 크게 |
| **인물 장면** (scene) | 동작·감정·관계처럼 사람이 해야 보이는 뜻 | 기존 동작 그림(`climb.webp`)처럼 클레이 아이·어른이 그 뜻을 **한 장면**으로 보여 준다. 표정과 몸짓을 크게. 인물은 1~4명 |
| **도식·기호** (symbol) | 위치·방향·양·시간처럼 관계를 보여야 하는 뜻 | 같은 클레이 질감의 **단순한 모양**(화살표·막대·빈 상자·퍼즐 조각 등)으로. 사물 1~3개 + 모양 하나. 복잡한 그림 금지 |
| **그림 없음** (none) | 기능어·개념어처럼 그림으로 옮기면 오히려 헷갈리는 뜻 | **만들지 않는다.** 앱이 같은 크기의 "단서 카드"(뜻·예문)로 대신 보여 준다 |

### 공통 규칙 (추상 단어일수록 더 중요)
- **글자·숫자·기호 문자 금지는 그대로.** 말풍선·간판·달력 숫자·✓ 옆 글씨 모두 안 된다. ✓·화살표·음표 같은 **모양**은 괜찮다.
- **한 장에 뜻 하나**: 아이가 그림만 보고 그 단어를 떠올릴 수 있어야 한다. 헷갈리면 장면을 줄이고 핵심 몸짓 하나만 남긴다.
- **밝고 안전하게**: death·hunt·fail·worry처럼 무거운 뜻은 피·다침·우는 얼굴 없이 부드럽게(예: hunt는 몸을 낮춘 사자, fail은 무너진 블록 탑). death는 그림 없음으로 정했다.
- **도식 그림은 한 세트처럼**: 화살표·막대·상자 모양은 같은 색·굵기·질감으로 통일한다(뒤 배치에서 같은 모양을 여러 단어가 다시 쓴다).
- 표의 "장면"이 곧 지시다. "참고 문장"은 뜻 확인용일 뿐 그림에 쓰지 않는다.

## 이번 목록: 77개 (전체 95개 중 그림 없음 18개 제외)

그림 없음으로 정한 단어(만들지 말 것): `already`, `also`, `believe`, `certain`, `condition`, `could`, `culture`, `death`, `during`, `form`, `however`, `issue`, `might`, `mind`, `should`, `twenty-first`, `twenty-second`, `twenty-third`

### 사물 (26개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `clear` | clear | 맑은, 분명한 | 구름 한 점 없는 맑은 하늘과 투명한 물 | The sky is clear today. |  |
| `college` | college | 대학 | 큰 대학 건물과 학사모 | My sister goes to college. |  |
| `company` | company | 회사 | 높은 회사 건물(간판 글자 없이) | My mom works at a big company. |  |
| `court` | court | (운동) 코트, 법정 | 테니스 코트(선만 있고 글자 없이) | We play tennis on the court. |  |
| `double` | double | 두 배의, 두 개의 | 패티가 두 장 들어간 햄버거 | I want a double burger. |  |
| `file` | file | 파일, 서류철 | 종이가 꽂힌 서류철 | Put the paper in the file. |  |
| `gentleman` | gentleman | 신사 | 모자를 쓰고 양복을 입은 친절한 할아버지 신사 | He is a kind gentleman. |  |
| `gum` | gum | 껌 | 껌 한 통과 껌 한 조각 | Don't chew gum in class. |  |
| `guy` | guy | 남자, 녀석 | 웃고 있는 젊은 남자 | He is a nice guy. |  |
| `history` | history | 역사 | 오래된 두루마리와 옛 성(글자 없이) | I like history class. |  |
| `image` | image | 이미지, 그림 | 액자 속 풍경 그림 | Look at the image on the screen. |  |
| `laser` | laser | 레이저 | 레이저 포인터에서 빨간 빛줄기가 나오는 모습 | The laser light is red. |  |
| `nation` | nation | 국가, 나라 | 지구본 위에 여러 나라 깃발이 꽂힌 모습(실제 국기 대신 단순 색 깃발) | Korea is a small nation. |  |
| `newspaper` | newspaper | 신문 | 접힌 신문(글자 대신 회색 줄) | My dad reads the newspaper. |  |
| `prince` | prince | 왕자 | 작은 왕관을 쓴 왕자 아이 | The prince lives in a castle. |  |
| `program` | program | 프로그램 | 텔레비전 화면에 만화 장면이 나오는 모습(글자 없이) | This TV program is fun. |  |
| `restroom` | restroom | 화장실 | 화장실 문(남녀 그림 표시만, 글자 없이) | Where is the restroom? |  |
| `software` | software | 소프트웨어 | 노트북 화면에 둥근 아이콘들이 떠 있는 모습(글자 없이) | This software is easy to use. |  |
| `spaghetti` | spaghetti | 스파게티 | 토마토소스 스파게티 한 접시 | I love spaghetti. |  |
| `staff` | staff | 직원 | 같은 앞치마를 입은 가게 직원 세 명(이름표 글자 없이) | Ask the staff for help. |  |
| `steak` | steak | 스테이크 | 접시 위 스테이크와 채소 | Dad cooked steak for dinner. |  |
| `tail` | tail | 꼬리 | 강아지 뒷모습과 흔들리는 꼬리 | The dog wags its tail. |  |
| `tent` | tent | 텐트 | 숲속 캠핑 텐트 | We slept in a tent. |  |
| `tire` | tire | 타이어 | 자동차 타이어 하나 | The car has a flat tire. |  |
| `track` | track | 트랙, 길 | 운동장의 둥근 달리기 트랙(숫자 없이) | We run on the track. |  |
| `wine` | wine | 와인, 포도주 | 포도송이 옆 와인 병(라벨 글자 없이) | Grapes are used to make wine. |  |

### 인물 장면 (42개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `agree` | agree | 동의하다 | 두 아이가 웃으며 고개를 끄덕이고 엄지를 드는 장면 | I agree with you. |  |
| `alone` | alone | 혼자 | 넓은 방에 아이 한 명만 앉아 있는 장면 | The boy is alone in the room. |  |
| `alright` | alright | 괜찮은 | 넘어진 친구에게 다른 아이가 손을 내밀며 괜찮은지 묻는 장면 | Are you alright? |  |
| `beauty` | beauty | 아름다움 | 꽃밭과 무지개가 있는 아름다운 풍경을 바라보는 아이 | We love the beauty of nature. |  |
| `birth` | birth | 탄생, 출생 | 갓 태어난 아기를 안은 엄마와 기뻐하는 가족 | The birth of the baby made us happy. |  |
| `borrow` | borrow | 빌리다 | 한 아이가 친구에게서 연필을 받아 가는 장면 | Can I borrow your pencil? |  |
| `business` | business | 사업, 일 | 가게 앞에서 앞치마를 두른 어른이 손님을 맞는 장면 | My father has his own business. |  |
| `campaign` | campaign | 캠페인, 운동 | 아이들이 함께 공원 쓰레기를 줍는 장면 | We joined a clean-up campaign. |  |
| `check` | check | 확인하다 | 아이가 돋보기로 공책을 확인하는 장면 | Please check your answers. |  |
| `collect` | collect | 모으다 | 아이가 상자에 조개껍데기를 모으는 장면 | I collect stickers. |  |
| `compute` | compute | 계산하다 | 아이가 계산기를 누르고 있는 장면(화면 숫자 없이) | The machine can compute fast. |  |
| `congratulate` | congratulate | 축하하다 | 친구들이 상을 받은 아이에게 박수치며 축하하는 장면 | We congratulate you on winning. |  |
| `control` | control | 조종하다, 통제하다 | 아이가 리모컨으로 장난감 로봇을 조종하는 장면 | He can control the robot. |  |
| `couple` | couple | 한 쌍, 부부 | 공원에서 손잡고 걷는 두 어른 | A couple is walking in the park. |  |
| `design` | design | 디자인하다, 설계하다 | 아이가 종이에 옷 그림을 그리며 디자인하는 장면 | She designs clothes. |  |
| `dialogue` | dialogue | 대화 | 두 아이가 마주 보고 대화하는 장면(말풍선 없이) | Read the dialogue with your partner. |  |
| `discuss` | discuss | 토론하다, 의논하다 | 아이 네 명이 둥근 탁자에 모여 이야기하는 장면 | Let's discuss the problem. |  |
| `fail` | fail | 실패하다 | 블록 탑이 무너져 아쉬워하는 아이 | Don't be afraid to fail. |  |
| `favorite` | favorite | 가장 좋아하는 | 피자를 꼭 안고 하트 눈을 한 아이 | Pizza is my favorite food. |  |
| `focus` | focus | 집중하다 | 아이가 책상에서 눈을 크게 뜨고 책에 집중하는 장면 | Focus on your work. |  |
| `future` | future | 미래 | 아이가 하늘을 보며 조종사가 된 자신을 상상하는 장면(생각 구름 모양 가능, 글자 없이) | I want to be a pilot in the future. |  |
| `habit` | habit | 습관 | 아이가 매일 아침 양치하는 장면(작은 달력 칸 체크 표시, 숫자 없이) | Brushing your teeth is a good habit. |  |
| `hang` | hang | 걸다, 매달다 | 아이가 옷걸이에 외투를 거는 장면 | Hang your coat on the hook. |  |
| `hero` | hero | 영웅 | 망토를 두른 아이가 고양이를 구해 안고 있는 장면 | The firefighter is my hero. |  |
| `hike` | hike | 하이킹하다, 걷다 | 배낭을 멘 가족이 산길을 걷는 장면 | We hike in the mountains. |  |
| `human` | human | 인간, 사람 | 여러 나이·모습의 사람들이 나란히 선 장면 | Humans need water to live. |  |
| `hunt` | hunt | 사냥하다, 찾다 | 사자가 풀숲에서 몸을 낮추고 먹이를 노리는 장면(피 없이) | Lions hunt for food. |  |
| `husband` | husband | 남편 | 결혼식 옷을 입은 신랑 신부 중 신랑이 눈에 띄게 | Her husband is a doctor. |  |
| `invite` | invite | 초대하다 | 아이가 친구에게 초대장 봉투를 건네는 장면(글자 없이) | I invite you to my party. |  |
| `life` | life | 삶, 생명 | 작은 새싹이 흙에서 돋아나는 모습 | Water is important for life. |  |
| `marathon` | marathon | 마라톤 | 번호표 없이 여러 사람이 긴 길을 달리는 마라톤 장면 | My uncle ran a marathon. |  |
| `member` | member | 회원, 구성원 | 같은 색 티셔츠를 입은 동아리 아이들 중 한 아이가 손을 드는 장면 | I am a member of the club. |  |
| `memory` | memory | 기억, 추억 | 아이가 사진 앨범을 보며 웃는 장면 | I have a happy memory of the trip. |  |
| `partner` | partner | 짝, 동료 | 두 아이가 한 책상에서 함께 문제를 푸는 장면 | Work with your partner. |  |
| `project` | project | 과제, 프로젝트 | 아이들이 함께 화산 모형 과제를 만드는 장면 | We did a science project. |  |
| `recreation` | recreation | 오락, 레크리에이션 | 아이들이 운동장에서 줄다리기·공놀이를 하는 장면 | We have recreation time after lunch. |  |
| `ski` | ski | 스키를 타다 | 아이가 눈 덮인 언덕에서 스키를 타는 장면 | We ski in winter. |  |
| `style` | style | 스타일, 방식 | 거울 앞에서 새 머리 모양을 보고 웃는 아이 | I like your hair style. |  |
| `thirst` | thirst | 목마름, 갈증 | 더운 날 땀 흘리는 아이가 물병을 바라보는 장면 | Water helps your thirst. |  |
| `voice` | voice | 목소리 | 아이가 입을 벌려 노래하고 음표 모양이 떠오르는 장면 | She has a beautiful voice. |  |
| `wife` | wife | 아내 | 결혼식 옷을 입은 신랑 신부 중 신부가 눈에 띄게 | His wife is a teacher. |  |
| `worry` | worry | 걱정하다 | 아이가 이마를 찡그리고 걱정하는 얼굴, 옆에서 친구가 어깨를 토닥임 | Don't worry. It's okay. |  |

### 도식·기호 (9개)

| id | 단어 | 뜻 | 장면 | 참고 문장 | 만들어졌나 |
|---|---|---|---|---|---|
| `against` | against | ~에 맞서, ~에 기대어 | 두 팀의 화살표가 서로 마주 보고 부딪치는 도식(글자 없이) | We played against their team. |  |
| `ahead` | ahead | 앞에, 앞으로 | 길 위의 아이 앞쪽으로 뻗은 큰 화살표 | Look ahead when you walk. |  |
| `almost` | almost | 거의 | 거의 다 찬 진행 막대(끝만 조금 비어 있음), 글자 없이 | I am almost done. |  |
| `another` | another | 또 하나의, 다른 | 접시 위 쿠키 하나 옆으로 쿠키 하나가 더 들어오는 모습 | Can I have another cookie? |  |
| `area` | area | 지역, 구역 | 지도 위 한 구역만 색칠되어 있는 모습(글자 없이) | This area is for children. |  |
| `both` | both | 둘 다 | 두 아이 모두에게 체크 표시(✓ 모양만, 글자 없이) | Both of them are my friends. |  |
| `nothing` | nothing | 아무것도 (없음) | 뚜껑이 열린 텅 빈 상자 | There is nothing in the box. |  |
| `part` | part | 부분 | 한 조각이 빠진 퍼즐, 빠진 조각이 옆에 있음 | This is my favorite part of the movie. |  |
| `power` | power | 힘, 전력 | 번개 모양 기호와 전구가 켜진 모습 | The sun gives us power. |  |

## 다 만든 뒤

`node app/scripts/vocab/make-image-url-sql.mjs`로 그림이 생긴 단어의 image_url SQL을 만든다(없는 단어는 그대로 둔다). SQL 실행과 배포는 사용자가 한다. 이 문서의 "만들어졌나" 칸은 `node app/scripts/vocab/build-moe-elem.mjs`를 다시 돌리면 채워진다.
