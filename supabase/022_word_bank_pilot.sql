-- 022. 시범 배치: 동물·음식·동작 (020_word_bank_levels.sql, 021 다음에 실행. 여러 번 실행해도 안전)
-- app/scripts/vocab/pilot-build.mjs 로 생성. 뜻·예문·레벨은 초안 — 검수는 pilot-review.csv.

-- 1) 이미 있는 행에 추가 카테고리 붙이기(뜻이 같은 단어가 다른 카테고리에도 걸릴 때)
update public.word_bank set extra_categories = array_append(extra_categories, '음식')
where id in ('water') and category <> '음식' and not ('음식' = any(extra_categories));
update public.word_bank set extra_categories = array_append(extra_categories, '동작')
where id in ('be', 'have', 'do', 'need', 'happen', 'feel', 'like', 'love', 'hate', 'hope', 'want', 'smile') and category <> '동작' and not ('동작' = any(extra_categories));

-- 2) 새 단어(이미 있는 단어의 다른 뜻 행 포함). image_url은 그림 파일이 생긴 뒤 별도로 채운다.
insert into public.word_bank
  (id, word, sense_number, part_of_speech, meaning, example_sentence, category, extra_categories, subcategory, level, origin, image_url, sort_order)
values
  ('puppy', 'puppy', 1, '명사', '강아지', 'The puppy is small.', '동물', '{}', '집·농장 동물', 1, 'classbank', null, 1000),
  ('kitten', 'kitten', 1, '명사', '새끼 고양이', 'The kitten drinks milk.', '동물', '{}', '집·농장 동물', 1, 'classbank', null, 1001),
  ('rabbit', 'rabbit', 1, '명사', '토끼', 'The rabbit likes carrots.', '동물', '{}', '집·농장 동물', 1, 'classbank', null, 1002),
  ('hamster', 'hamster', 1, '명사', '햄스터', 'My hamster is very small.', '동물', '{}', '집·농장 동물', 2, 'classbank', null, 1003),
  ('mouse', 'mouse', 1, '명사', '생쥐', 'A mouse is under the table.', '동물', '{}', '야생 동물', 1, 'classbank', null, 1004),
  ('rat', 'rat', 1, '명사', '쥐', 'The rat is fast.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1005),
  ('squirrel', 'squirrel', 1, '명사', '다람쥐', 'The squirrel has a big tail.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1006),
  ('hedgehog', 'hedgehog', 1, '명사', '고슴도치', 'A hedgehog is small and round.', '동물', '{}', '야생 동물', 3, 'classbank', null, 1007),
  ('fox', 'fox', 1, '명사', '여우', 'The fox is red.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1008),
  ('wolf', 'wolf', 1, '명사', '늑대', 'The wolf is in the forest.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1009),
  ('deer', 'deer', 1, '명사', '사슴', 'The deer runs fast.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1010),
  ('raccoon', 'raccoon', 1, '명사', '너구리', 'The raccoon is cute.', '동물', '{}', '야생 동물', 3, 'classbank', null, 1011),
  ('gorilla', 'gorilla', 1, '명사', '고릴라', 'The gorilla is very strong.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1012),
  ('chimpanzee', 'chimpanzee', 1, '명사', '침팬지', 'The chimpanzee likes bananas.', '동물', '{}', '야생 동물', 3, 'classbank', null, 1013),
  ('leopard', 'leopard', 1, '명사', '표범', 'The leopard is fast.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1014),
  ('cheetah', 'cheetah', 1, '명사', '치타', 'The cheetah runs very fast.', '동물', '{}', '야생 동물', 3, 'classbank', null, 1015),
  ('elephant', 'elephant', 1, '명사', '코끼리', 'The elephant has a long nose.', '동물', '{}', '야생 동물', 1, 'classbank', null, 1016),
  ('giraffe', 'giraffe', 1, '명사', '기린', 'The giraffe has a long neck.', '동물', '{}', '야생 동물', 1, 'classbank', null, 1017),
  ('zebra', 'zebra', 1, '명사', '얼룩말', 'The zebra is black and white.', '동물', '{}', '야생 동물', 1, 'classbank', null, 1018),
  ('hippo', 'hippo', 1, '명사', '하마', 'The hippo is in the water.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1019),
  ('rhino', 'rhino', 1, '명사', '코뿔소', 'The rhino is big and strong.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1020),
  ('kangaroo', 'kangaroo', 1, '명사', '캥거루', 'The kangaroo can jump high.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1021),
  ('koala', 'koala', 1, '명사', '코알라', 'The koala sleeps in a tree.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1022),
  ('panda', 'panda', 1, '명사', '판다', 'The panda is black and white.', '동물', '{}', '야생 동물', 1, 'classbank', null, 1023),
  ('camel', 'camel', 1, '명사', '낙타', 'The camel is tall.', '동물', '{}', '야생 동물', 2, 'classbank', null, 1024),
  ('pony', 'pony', 1, '명사', '조랑말', 'The pony is small.', '동물', '{}', '집·농장 동물', 2, 'classbank', null, 1025),
  ('goat', 'goat', 1, '명사', '염소', 'The goat eats grass.', '동물', '{}', '집·농장 동물', 2, 'classbank', null, 1026),
  ('donkey', 'donkey', 1, '명사', '당나귀', 'The donkey is gray.', '동물', '{}', '집·농장 동물', 2, 'classbank', null, 1027),
  ('chick', 'chick', 1, '명사', '병아리', 'The chick is yellow.', '동물', '{}', '집·농장 동물', 2, 'classbank', null, 1028),
  ('rooster', 'rooster', 1, '명사', '수탉', 'The rooster wakes me up.', '동물', '{}', '집·농장 동물', 2, 'classbank', null, 1029),
  ('goose', 'goose', 1, '명사', '거위', 'The goose is on the lake.', '동물', '{}', '새', 2, 'classbank', null, 1030),
  ('turkey', 'turkey', 1, '명사', '칠면조', 'The turkey is a big bird.', '동물', '{}', '새', 2, 'classbank', null, 1031),
  ('eagle', 'eagle', 1, '명사', '독수리', 'The eagle flies high.', '동물', '{}', '새', 2, 'classbank', null, 1032),
  ('owl', 'owl', 1, '명사', '부엉이', 'The owl sleeps in the day.', '동물', '{}', '새', 1, 'classbank', null, 1033),
  ('parrot', 'parrot', 1, '명사', '앵무새', 'The parrot can talk.', '동물', '{}', '새', 2, 'classbank', null, 1034),
  ('penguin', 'penguin', 1, '명사', '펭귄', 'The penguin can swim.', '동물', '{}', '새', 1, 'classbank', null, 1035),
  ('flamingo', 'flamingo', 1, '명사', '플라밍고', 'The flamingo is pink.', '동물', '{}', '새', 2, 'classbank', null, 1036),
  ('peacock', 'peacock', 1, '명사', '공작', 'The peacock is beautiful.', '동물', '{}', '새', 3, 'classbank', null, 1037),
  ('swan', 'swan', 1, '명사', '백조', 'The swan is on the lake.', '동물', '{}', '새', 2, 'classbank', null, 1038),
  ('crow', 'crow', 1, '명사', '까마귀', 'The crow is black.', '동물', '{}', '새', 2, 'classbank', null, 1039),
  ('sparrow', 'sparrow', 1, '명사', '참새', 'The sparrow is a small bird.', '동물', '{}', '새', 2, 'classbank', null, 1040),
  ('frog', 'frog', 1, '명사', '개구리', 'The frog can jump.', '동물', '{}', '파충류·양서류', 1, 'classbank', null, 1041),
  ('toad', 'toad', 1, '명사', '두꺼비', 'The toad is brown.', '동물', '{}', '파충류·양서류', 3, 'classbank', null, 1042),
  ('snake', 'snake', 1, '명사', '뱀', 'The snake is long.', '동물', '{}', '파충류·양서류', 1, 'classbank', null, 1043),
  ('lizard', 'lizard', 1, '명사', '도마뱀', 'The lizard is on the wall.', '동물', '{}', '파충류·양서류', 2, 'classbank', null, 1044),
  ('turtle', 'turtle', 1, '명사', '거북이', 'The turtle is slow.', '동물', '{}', '파충류·양서류', 1, 'classbank', null, 1045),
  ('crocodile', 'crocodile', 1, '명사', '악어', 'The crocodile has big teeth.', '동물', '{}', '파충류·양서류', 2, 'classbank', null, 1046),
  ('alligator', 'alligator', 1, '명사', '앨리게이터', 'The alligator is in the river.', '동물', '{}', '파충류·양서류', 3, 'classbank', null, 1047),
  ('dinosaur', 'dinosaur', 1, '명사', '공룡', 'The dinosaur is big.', '동물', '{}', '파충류·양서류', 1, 'classbank', null, 1048),
  ('shark', 'shark', 1, '명사', '상어', 'The shark is in the sea.', '동물', '{}', '물속 동물', 1, 'classbank', null, 1049),
  ('whale', 'whale', 1, '명사', '고래', 'The whale is very big.', '동물', '{}', '물속 동물', 1, 'classbank', null, 1050),
  ('octopus', 'octopus', 1, '명사', '문어', 'The octopus has eight legs.', '동물', '{}', '물속 동물', 2, 'classbank', null, 1051),
  ('squid', 'squid', 1, '명사', '오징어', 'The squid lives in the sea.', '동물', '{}', '물속 동물', 2, 'classbank', null, 1052),
  ('crab', 'crab', 1, '명사', '게', 'The crab is red.', '동물', '{}', '물속 동물', 1, 'classbank', null, 1053),
  ('lobster', 'lobster', 1, '명사', '바닷가재', 'The lobster is red.', '동물', '{}', '물속 동물', 2, 'classbank', null, 1054),
  ('shrimp', 'shrimp', 1, '명사', '새우', 'I like shrimp.', '동물', '{}', '물속 동물', 2, 'classbank', null, 1055),
  ('seal', 'seal', 1, '명사', '물개', 'The seal can swim.', '동물', '{}', '물속 동물', 2, 'classbank', null, 1056),
  ('starfish', 'starfish', 1, '명사', '불가사리', 'The starfish is on the beach.', '동물', '{}', '물속 동물', 2, 'classbank', null, 1057),
  ('jellyfish', 'jellyfish', 1, '명사', '해파리', 'The jellyfish is in the sea.', '동물', '{}', '물속 동물', 2, 'classbank', null, 1058),
  ('seahorse', 'seahorse', 1, '명사', '해마', 'The seahorse is small.', '동물', '{}', '물속 동물', 3, 'classbank', null, 1059),
  ('bee', 'bee', 1, '명사', '벌', 'The bee is on the flower.', '동물', '{}', '곤충·벌레', 1, 'classbank', null, 1060),
  ('butterfly', 'butterfly', 1, '명사', '나비', 'The butterfly is beautiful.', '동물', '{}', '곤충·벌레', 1, 'classbank', null, 1061),
  ('ant', 'ant', 1, '명사', '개미', 'The ant is small.', '동물', '{}', '곤충·벌레', 1, 'classbank', null, 1062),
  ('spider', 'spider', 1, '명사', '거미', 'The spider has eight legs.', '동물', '{}', '곤충·벌레', 1, 'classbank', null, 1063),
  ('beetle', 'beetle', 1, '명사', '딱정벌레', 'The beetle is on the leaf.', '동물', '{}', '곤충·벌레', 3, 'classbank', null, 1064),
  ('ladybug', 'ladybug', 1, '명사', '무당벌레', 'The ladybug is red.', '동물', '{}', '곤충·벌레', 2, 'classbank', null, 1065),
  ('mosquito', 'mosquito', 1, '명사', '모기', 'A mosquito is on my arm.', '동물', '{}', '곤충·벌레', 2, 'classbank', null, 1066),
  ('grasshopper', 'grasshopper', 1, '명사', '메뚜기', 'The grasshopper can jump.', '동물', '{}', '곤충·벌레', 2, 'classbank', null, 1067),
  ('snail', 'snail', 1, '명사', '달팽이', 'The snail is slow.', '동물', '{}', '곤충·벌레', 1, 'classbank', null, 1068),
  ('worm', 'worm', 1, '명사', '벌레, 지렁이', 'The worm is in the soil.', '동물', '{}', '곤충·벌레', 2, 'classbank', null, 1069),
  ('fly-2', 'fly', 2, '명사', '파리', 'A fly is on the food.', '동물', '{}', '곤충·벌레', 2, 'classbank', null, 1070),
  ('meal', 'meal', 1, '명사', '식사', 'We eat a meal together.', '음식', '{}', '식사', 2, 'classbank', null, 1071),
  ('snack', 'snack', 1, '명사', '간식', 'I eat a snack after school.', '음식', '{}', '간식·디저트', 2, 'classbank', null, 1072),
  ('toast', 'toast', 1, '명사', '토스트', 'I eat toast for breakfast.', '음식', '{}', '곡물·빵·면', 2, 'classbank', null, 1073),
  ('cereal', 'cereal', 1, '명사', '시리얼', 'I eat cereal with milk.', '음식', '{}', '곡물·빵·면', 2, 'classbank', null, 1074),
  ('noodles', 'noodles', 1, '명사', '국수, 면', 'I like noodles.', '음식', '{}', '곡물·빵·면', 1, 'classbank', null, 1075),
  ('pasta', 'pasta', 1, '명사', '파스타', 'I like pasta.', '음식', '{}', '곡물·빵·면', 2, 'classbank', null, 1076),
  ('pizza', 'pizza', 1, '명사', '피자', 'I like pizza.', '음식', '{}', '요리', 1, 'classbank', null, 1077),
  ('sandwich', 'sandwich', 1, '명사', '샌드위치', 'I make a sandwich.', '음식', '{}', '요리', 1, 'classbank', null, 1078),
  ('hot-dog', 'hot dog', 1, '명사', '핫도그', 'I eat a hot dog.', '음식', '{}', '요리', 1, 'classbank', null, 1079),
  ('beef', 'beef', 1, '명사', '소고기', 'We eat beef.', '음식', '{}', '고기·생선·달걀', 2, 'classbank', null, 1080),
  ('pork', 'pork', 1, '명사', '돼지고기', 'This is pork.', '음식', '{}', '고기·생선·달걀', 2, 'classbank', null, 1081),
  ('curry', 'curry', 1, '명사', '카레', 'I like curry and rice.', '음식', '{}', '요리', 2, 'classbank', null, 1082),
  ('dumpling', 'dumpling', 1, '명사', '만두', 'I like dumplings.', '음식', '{}', '요리', 2, 'classbank', null, 1083),
  ('pancake', 'pancake', 1, '명사', '팬케이크', 'I eat pancakes on Sunday.', '음식', '{}', '요리', 2, 'classbank', null, 1084),
  ('waffle', 'waffle', 1, '명사', '와플', 'I like waffles.', '음식', '{}', '요리', 2, 'classbank', null, 1085),
  ('french-fries', 'French fries', 1, '명사', '감자튀김', 'I eat French fries.', '음식', '{}', '요리', 1, 'classbank', null, 1086),
  ('sweet-potato', 'sweet potato', 1, '명사', '고구마', 'The sweet potato is sweet.', '음식', '{}', '채소', 2, 'classbank', null, 1087),
  ('corn', 'corn', 1, '명사', '옥수수', 'I eat corn.', '음식', '{}', '채소', 1, 'classbank', null, 1088),
  ('carrot', 'carrot', 1, '명사', '당근', 'Rabbits like carrots.', '음식', '{}', '채소', 1, 'classbank', null, 1089),
  ('onion', 'onion', 1, '명사', '양파', 'I cut an onion.', '음식', '{}', '채소', 1, 'classbank', null, 1090),
  ('cucumber', 'cucumber', 1, '명사', '오이', 'The cucumber is green.', '음식', '{}', '채소', 2, 'classbank', null, 1091),
  ('lettuce', 'lettuce', 1, '명사', '상추', 'I put lettuce in the sandwich.', '음식', '{}', '채소', 2, 'classbank', null, 1092),
  ('cabbage', 'cabbage', 1, '명사', '양배추', 'The cabbage is green.', '음식', '{}', '채소', 2, 'classbank', null, 1093),
  ('mushroom', 'mushroom', 1, '명사', '버섯', 'I like mushrooms.', '음식', '{}', '채소', 2, 'classbank', null, 1094),
  ('broccoli', 'broccoli', 1, '명사', '브로콜리', 'I eat broccoli.', '음식', '{}', '채소', 2, 'classbank', null, 1095),
  ('spinach', 'spinach', 1, '명사', '시금치', 'Spinach is green.', '음식', '{}', '채소', 3, 'classbank', null, 1096),
  ('bean', 'bean', 1, '명사', '콩', 'I eat beans.', '음식', '{}', '채소', 2, 'classbank', null, 1097),
  ('pea', 'pea', 1, '명사', '완두콩', 'The peas are green.', '음식', '{}', '채소', 2, 'classbank', null, 1098),
  ('watermelon', 'watermelon', 1, '명사', '수박', 'The watermelon is big and sweet.', '음식', '{}', '과일', 1, 'classbank', null, 1099),
  ('peach', 'peach', 1, '명사', '복숭아', 'The peach is sweet.', '음식', '{}', '과일', 2, 'classbank', null, 1100),
  ('cherry', 'cherry', 1, '명사', '체리', 'I like cherries.', '음식', '{}', '과일', 2, 'classbank', null, 1101),
  ('pineapple', 'pineapple', 1, '명사', '파인애플', 'The pineapple is yellow.', '음식', '{}', '과일', 2, 'classbank', null, 1102),
  ('mango', 'mango', 1, '명사', '망고', 'I like mango.', '음식', '{}', '과일', 2, 'classbank', null, 1103),
  ('kiwi', 'kiwi', 1, '명사', '키위', 'The kiwi is green.', '음식', '{}', '과일', 2, 'classbank', null, 1104),
  ('lemon', 'lemon', 1, '명사', '레몬', 'The lemon is sour.', '음식', '{}', '과일', 1, 'classbank', null, 1105),
  ('blueberry', 'blueberry', 1, '명사', '블루베리', 'I put blueberries in my yogurt.', '음식', '{}', '과일', 2, 'classbank', null, 1106),
  ('raspberry', 'raspberry', 1, '명사', '라즈베리', 'The raspberry is red.', '음식', '{}', '과일', 3, 'classbank', null, 1107),
  ('coconut', 'coconut', 1, '명사', '코코넛', 'The coconut is hard.', '음식', '{}', '과일', 3, 'classbank', null, 1108),
  ('avocado', 'avocado', 1, '명사', '아보카도', 'I like avocado.', '음식', '{}', '과일', 3, 'classbank', null, 1109),
  ('cookie', 'cookie', 1, '명사', '쿠키', 'I eat a cookie.', '음식', '{}', '간식·디저트', 1, 'classbank', null, 1110),
  ('biscuit', 'biscuit', 1, '명사', '비스킷', 'I eat a biscuit.', '음식', '{}', '간식·디저트', 2, 'classbank', null, 1111),
  ('chocolate', 'chocolate', 1, '명사', '초콜릿', 'I like chocolate.', '음식', '{}', '간식·디저트', 1, 'classbank', null, 1112),
  ('ice-cream', 'ice cream', 1, '명사', '아이스크림', 'I want ice cream.', '음식', '{}', '간식·디저트', 1, 'classbank', null, 1113),
  ('donut', 'donut', 1, '명사', '도넛', 'I eat a donut.', '음식', '{}', '간식·디저트', 1, 'classbank', null, 1114),
  ('pie', 'pie', 1, '명사', '파이', 'I like apple pie.', '음식', '{}', '간식·디저트', 2, 'classbank', null, 1115),
  ('pudding', 'pudding', 1, '명사', '푸딩', 'The pudding is sweet.', '음식', '{}', '간식·디저트', 2, 'classbank', null, 1116),
  ('yogurt', 'yogurt', 1, '명사', '요거트', 'I eat yogurt.', '음식', '{}', '유제품', 2, 'classbank', null, 1117),
  ('soda', 'soda', 1, '명사', '탄산음료', 'I drink soda.', '음식', '{}', '음료', 2, 'classbank', null, 1118),
  ('lemonade', 'lemonade', 1, '명사', '레모네이드', 'I drink lemonade in summer.', '음식', '{}', '음료', 2, 'classbank', null, 1119),
  ('pepper', 'pepper', 1, '명사', '후추', 'Add salt and pepper.', '음식', '{}', '양념·재료', 2, 'classbank', null, 1120),
  ('jam', 'jam', 1, '명사', '잼', 'I put jam on my bread.', '음식', '{}', '양념·재료', 2, 'classbank', null, 1121),
  ('honey', 'honey', 1, '명사', '꿀', 'Honey is sweet.', '음식', '{}', '양념·재료', 2, 'classbank', null, 1122),
  ('flour', 'flour', 1, '명사', '밀가루', 'We use flour for cake.', '음식', '{}', '양념·재료', 3, 'classbank', null, 1123),
  ('chicken-2', 'chicken', 2, '명사', '닭고기', 'I like chicken for dinner.', '음식', '{}', '고기·생선·달걀', 2, 'classbank', null, 1124),
  ('fish-2', 'fish', 2, '명사', '생선', 'We eat fish for dinner.', '음식', '{}', '고기·생선·달걀', 2, 'classbank', null, 1125),
  ('hop', 'hop', 1, '동사', '깡충깡충 뛰다', 'The rabbit can hop.', '동작', '{}', '이동', 2, 'classbank', null, 1126),
  ('skip', 'skip', 1, '동사', '가볍게 뛰어가다', 'The girl can skip.', '동작', '{}', '이동', 2, 'classbank', null, 1127),
  ('enter', 'enter', 1, '동사', '들어가다', 'Please enter the room.', '동작', '{}', '이동', 2, 'classbank', null, 1128),
  ('yell', 'yell', 1, '동사', '소리치다', 'Don''t yell in class.', '동작', '{}', '말하기·표현', 3, 'classbank', null, 1129),
  ('whisper', 'whisper', 1, '동사', '속삭이다', 'Please whisper in the library.', '동작', '{}', '말하기·표현', 3, 'classbank', null, 1130),
  ('fold', 'fold', 1, '동사', '접다', 'Fold the paper.', '동작', '{}', '손으로 하는 동작', 2, 'classbank', null, 1131),
  ('glue', 'glue', 1, '동사', '풀로 붙이다', 'Glue the paper here.', '동작', '{}', '손으로 하는 동작', 2, 'classbank', null, 1132),
  ('lift', 'lift', 1, '동사', '들어 올리다', 'I can lift the box.', '동작', '{}', '손으로 하는 동작', 2, 'classbank', null, 1133),
  ('search', 'search', 1, '동사', '찾다, 뒤지다', 'I search for my pen.', '동작', '{}', '손으로 하는 동작', 3, 'classbank', null, 1134),
  ('bounce', 'bounce', 1, '동사', '튀다', 'The ball can bounce.', '동작', '{}', '이동', 3, 'classbank', null, 1135),
  ('crawl', 'crawl', 1, '동사', '기어가다', 'The baby can crawl.', '동작', '{}', '이동', 3, 'classbank', null, 1136),
  ('bake', 'bake', 1, '동사', '굽다', 'I bake a cake.', '동작', '{}', '생활', 2, 'classbank', null, 1137),
  ('guess', 'guess', 1, '동사', '추측하다', 'Guess the answer.', '동작', '{}', '생각·학습', 2, 'classbank', null, 1138),
  ('choose', 'choose', 1, '동사', '고르다', 'Choose one card.', '동작', '{}', '생각·학습', 2, 'classbank', null, 1139),
  ('decide', 'decide', 1, '동사', '결정하다', 'Let''s decide together.', '동작', '{}', '생각·학습', 3, 'classbank', null, 1140),
  ('wish', 'wish', 1, '동사', '바라다', 'I wish for a puppy.', '동작', '{}', '마음·관계', 2, 'classbank', null, 1141),
  ('share', 'share', 1, '동사', '나누다', 'Let''s share the snack.', '동작', '{}', '마음·관계', 2, 'classbank', null, 1142),
  ('add', 'add', 1, '동사', '더하다', 'Add two and three.', '동작', '{}', '생각·학습', 2, 'classbank', null, 1143),
  ('freeze', 'freeze', 1, '동사', '얼다', 'Water can freeze.', '동작', '{}', '변화·시작·끝', 3, 'classbank', null, 1144),
  ('melt', 'melt', 1, '동사', '녹다', 'The ice will melt.', '동작', '{}', '변화·시작·끝', 3, 'classbank', null, 1145),
  ('tear', 'tear', 1, '동사', '찢다', 'Don''t tear the paper.', '동작', '{}', '손으로 하는 동작', 3, 'classbank', null, 1146),
  ('pour', 'pour', 1, '동사', '붓다', 'Pour the milk.', '동작', '{}', '손으로 하는 동작', 3, 'classbank', null, 1147),
  ('mix', 'mix', 1, '동사', '섞다', 'Mix the eggs and milk.', '동작', '{}', '손으로 하는 동작', 2, 'classbank', null, 1148),
  ('shake', 'shake', 1, '동사', '흔들다', 'Shake the bottle.', '동작', '{}', '손으로 하는 동작', 2, 'classbank', null, 1149),
  ('press', 'press', 1, '동사', '누르다', 'Press the button.', '동작', '{}', '손으로 하는 동작', 3, 'classbank', null, 1150),
  ('clap', 'clap', 1, '동사', '박수 치다', 'Let''s clap our hands.', '동작', '{}', '말하기·표현', 1, 'classbank', null, 1151),
  ('wave', 'wave', 1, '동사', '손을 흔들다', 'I wave to my friend.', '동작', '{}', '말하기·표현', 2, 'classbank', null, 1152),
  ('nod', 'nod', 1, '동사', '고개를 끄덕이다', 'She nods her head.', '동작', '{}', '말하기·표현', 3, 'classbank', null, 1153),
  ('bow', 'bow', 1, '동사', '절하다', 'We bow to the teacher.', '동작', '{}', '말하기·표현', 3, 'classbank', null, 1154),
  ('hug', 'hug', 1, '동사', '껴안다', 'I hug my mom.', '동작', '{}', '말하기·표현', 1, 'classbank', null, 1155),
  ('kiss', 'kiss', 1, '동사', '입맞추다', 'I kiss my baby sister.', '동작', '{}', '말하기·표현', 1, 'classbank', null, 1156),
  ('cheer', 'cheer', 1, '동사', '응원하다', 'Let''s cheer for our team.', '동작', '{}', '말하기·표현', 2, 'classbank', null, 1157),
  ('color-2', 'color', 2, '동사', '색칠하다', 'I color the picture.', '동작', '{}', '생각·학습', 1, 'classbank', null, 1158),
  ('dress-2', 'dress', 2, '동사', '옷을 입다', 'I dress myself in the morning.', '동작', '{}', '생활', 2, 'classbank', null, 1159),
  ('brush-2', 'brush', 2, '동사', '솔질하다, 이를 닦다', 'I brush my teeth.', '동작', '{}', '생활', 2, 'classbank', null, 1160),
  ('point-2', 'point', 2, '동사', '가리키다', 'Point to the picture.', '동작', '{}', '말하기·표현', 2, 'classbank', null, 1161),
  ('plant-2', 'plant', 2, '동사', '심다', 'Let''s plant a tree.', '동작', '{}', '변화·시작·끝', 2, 'classbank', null, 1162),
  ('rest-2', 'rest', 2, '동사', '쉬다', 'I rest after lunch.', '동작', '{}', '생활', 2, 'classbank', null, 1163),
  ('practice-2', 'practice', 2, '동사', '연습하다', 'I practice English every day.', '동작', '{}', '생각·학습', 2, 'classbank', null, 1164),
  ('empty-2', 'empty', 2, '동사', '비우다', 'Empty the bag.', '동작', '{}', '손으로 하는 동작', 3, 'classbank', null, 1165)
on conflict (id) do nothing;

-- 3) 이미 있는 812단어 중 이 세 카테고리에 속한 것들에 소분류 붙이기
update public.word_bank set subcategory = '집·농장 동물'
where id in ('dog', 'cat', 'horse', 'cow', 'pig', 'sheep', 'chicken', 'duck', 'hen') and (category = '동물' or '동물' = any(extra_categories));
update public.word_bank set subcategory = '야생 동물'
where id in ('bear', 'monkey', 'lion', 'tiger') and (category = '동물' or '동물' = any(extra_categories));
update public.word_bank set subcategory = '새'
where id in ('bird') and (category = '동물' or '동물' = any(extra_categories));
update public.word_bank set subcategory = '물속 동물'
where id in ('dolphin', 'fish') and (category = '동물' or '동물' = any(extra_categories));
update public.word_bank set subcategory = '식사'
where id in ('food', 'breakfast', 'lunch', 'dinner', 'supper') and (category = '음식' or '음식' = any(extra_categories));
update public.word_bank set subcategory = '곡물·빵·면'
where id in ('rice', 'bread') and (category = '음식' or '음식' = any(extra_categories));
update public.word_bank set subcategory = '요리'
where id in ('hamburger', 'soup', 'salad') and (category = '음식' or '음식' = any(extra_categories));
update public.word_bank set subcategory = '고기·생선·달걀'
where id in ('egg', 'meat') and (category = '음식' or '음식' = any(extra_categories));
update public.word_bank set subcategory = '채소'
where id in ('potato', 'tomato', 'vegetable') and (category = '음식' or '음식' = any(extra_categories));
update public.word_bank set subcategory = '과일'
where id in ('apple', 'banana', 'orange', 'grape', 'strawberry', 'melon', 'pear', 'fruit') and (category = '음식' or '음식' = any(extra_categories));
update public.word_bank set subcategory = '간식·디저트'
where id in ('cake', 'candy') and (category = '음식' or '음식' = any(extra_categories));
update public.word_bank set subcategory = '유제품'
where id in ('cheese', 'butter', 'cream') and (category = '음식' or '음식' = any(extra_categories));
update public.word_bank set subcategory = '음료'
where id in ('milk', 'juice', 'tea', 'coffee', 'water') and (category = '음식' or '음식' = any(extra_categories));
update public.word_bank set subcategory = '양념·재료'
where id in ('salt', 'sugar', 'oil') and (category = '음식' or '음식' = any(extra_categories));
update public.word_bank set subcategory = '이동'
where id in ('go', 'come', 'run', 'walk', 'jump', 'move', 'stay', 'follow', 'lead', 'turn', 'cross', 'leave', 'arrive', 'return', 'travel', 'visit', 'climb', 'swim', 'fly', 'dance', 'march-1', 'march-2', 'ride', 'drive', 'slide', 'roll', 'step', 'hiking', 'skate', 'swing', 'stand', 'sit', 'hurry') and (category = '동작' or '동작' = any(extra_categories));
update public.word_bank set subcategory = '감각'
where id in ('see', 'look', 'watch', 'hear', 'listen', 'smell', 'taste', 'touch', 'feel') and (category = '동작' or '동작' = any(extra_categories));
update public.word_bank set subcategory = '말하기·표현'
where id in ('say', 'tell', 'speak', 'talk', 'ask', 'answer', 'call', 'shout', 'cry', 'laugh', 'smile', 'sing', 'introduce', 'repeat') and (category = '동작' or '동작' = any(extra_categories));
update public.word_bank set subcategory = '생각·학습'
where id in ('read', 'write', 'spell', 'draw', 'paint', 'count', 'study', 'learn', 'teach', 'remember', 'forget', 'know', 'think', 'understand', 'record', 'copy') and (category = '동작' or '동작' = any(extra_categories));
update public.word_bank set subcategory = '손으로 하는 동작'
where id in ('make', 'build', 'fix', 'cut', 'open', 'close', 'shut', 'push', 'pull', 'carry', 'hold', 'put', 'take', 'bring', 'give', 'get', 'send', 'show', 'find', 'hide', 'keep', 'throw', 'catch', 'kick', 'hit', 'knock', 'cover', 'fill', 'drop', 'pick', 'blow', 'pass', 'set', 'tie', 'shoot', 'strike', 'dial', 'print') and (category = '동작' or '동작' = any(extra_categories));
update public.word_bank set subcategory = '생활'
where id in ('eat', 'drink', 'cook', 'wash', 'clean', 'brush', 'dry', 'wear', 'dress', 'change', 'sleep', 'wake', 'rest', 'play', 'work', 'buy', 'sell', 'pay', 'live', 'exercise', 'spend', 'waste', 'act') and (category = '동작' or '동작' = any(extra_categories));
update public.word_bank set subcategory = '마음·관계'
where id in ('like', 'love', 'hate', 'hope', 'enjoy', 'want', 'need', 'join', 'meet', 'help', 'use', 'try', 'fight', 'kill', 'let') and (category = '동작' or '동작' = any(extra_categories));
update public.word_bank set subcategory = '변화·시작·끝'
where id in ('be', 'have', 'do', 'become', 'happen', 'grow', 'burn', 'break', 'start', 'begin', 'finish', 'stop', 'wait', 'win', 'lose') and (category = '동작' or '동작' = any(extra_categories));
