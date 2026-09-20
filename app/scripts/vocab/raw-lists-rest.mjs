// 확장 사전 원본 목록 중 시범(동물·음식·동작) 이후 나머지 카테고리. 카테고리 이름은 한국어로 옮겼다.
// 원본의 영어 카테고리 → 한국어 매핑은 각 항목 위 주석. 같은 한국어 이름이 여러 원본 카테고리에서 나오면
// (예: 자연/날씨) 아래 mergeInto로 이어 붙인다.
// 숙어·표현 성격인 것(일상생활 루틴, 교실영어, 스피킹)은 IDIOM_LISTS에 따로 둔다.
const w = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

export const RAW_REST = {
  // 2. Appearance
  외모: w(`tall, short, big, small, thin, heavy, strong, weak, young, old, cute, pretty, beautiful, handsome, lovely, nice, cool, funny,
    clean, dirty, neat, messy, long, straight, curly, wavy, blond, blonde, brown-haired, black-haired, bald, beard, mustache, face, hair, eye,
    nose, mouth, ear, cheek, chin, skin, glasses, freckles`),
  // 4. Annual Activity
  '행사/활동': w(`birthday, party, festival, celebration, ceremony, wedding, picnic, field trip, vacation, holiday, concert, parade, contest,
    competition, sports day, school festival, graduation, entrance ceremony, summer camp, winter camp, talent show, flea market, bazaar,
    family day, parents' day, children's day, teacher's day`),
  // 5. Body
  몸: w(`body, head, face, hair, forehead, eye, eyebrow, eyelash, ear, nose, cheek, mouth, lip, tooth, teeth, tongue, chin, neck, shoulder,
    arm, elbow, wrist, hand, finger, thumb, chest, back, stomach, waist, hip, leg, knee, ankle, foot, feet, toe, skin, bone, heart, brain, blood`),
  // 6. Clothing
  옷: w(`clothes, shirt, T-shirt, blouse, sweater, sweatshirt, hoodie, jacket, coat, vest, dress, skirt, pants, trousers, jeans, shorts,
    pajamas, uniform, swimsuit, underwear, socks, shoes, sneakers, boots, sandals, slippers, hat, cap, helmet, scarf, gloves, mittens, belt,
    tie, pocket, button, zipper, glasses, sunglasses, umbrella, backpack, handbag`),
  // 7. Colors
  색깔: w(`red, orange, yellow, green, blue, purple, violet, pink, brown, black, white, gray, grey, gold, golden, silver, beige, navy,
    sky blue, light blue, dark blue, light green, dark green, turquoise, mint, peach, coral, cream, colorful`),
  // 8. Community
  장소: w(`city, town, village, neighborhood, street, road, park, playground, school, library, hospital, clinic, pharmacy, bank, post office,
    police station, fire station, supermarket, grocery store, bakery, restaurant, cafe, bookstore, toy store, clothing store, department store,
    shopping mall, market, movie theater, museum, zoo, aquarium, hotel, airport, station, bus stop, subway station, church, temple, bridge,
    building, apartment, office, factory, farm`),
  // 9. Countries
  '나라/세계': w(`Korea, South Korea, China, Japan, India, Thailand, Vietnam, Philippines, Indonesia, Singapore, Malaysia, Australia,
    New Zealand, Canada, United States, America, Mexico, Brazil, Argentina, United Kingdom, England, France, Germany, Italy, Spain, Greece,
    Egypt, South Africa, Turkey, country, world, flag, capital, language, Korean, Chinese, Japanese, English, American, Canadian,
    Australian, French, German, Italian, Spanish`),
  // 10. Days & Months
  '요일/달력': w(`Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, weekday, weekend, January, February, March, April, May,
    June, July, August, September, October, November, December, day, week, month, year, today, yesterday, tomorrow, morning, afternoon,
    evening, night, date, calendar`),
  // 11. Entertainment
  '취미/오락': w(`game, movie, film, cartoon, animation, music, song, dance, book, comic, story, show, TV, television, video, YouTube,
    theater, concert, party, puzzle, board game, card game, computer game, video game, karaoke, magic, photograph, photo, picture, camera,
    hobby, camping, fishing, drawing, painting, reading, singing, dancing, cooking, collecting`),
  // 12. Feelings & Emotions
  감정: w(`happy, sad, angry, mad, excited, surprised, scared, afraid, frightened, worried, nervous, tired, sleepy, bored, hungry,
    thirsty, sick, lonely, shy, embarrassed, proud, brave, calm, relaxed, comfortable, uncomfortable, upset, disappointed, confused,
    interested, curious, thankful, grateful, jealous, kind, friendly, cheerful, joyful, silly, serious`),
  // 14. Holidays
  '휴일/기념일': w(`New Year's Day, Lunar New Year, Seollal, Valentine's Day, Easter, Children's Day, Parents' Day, Teacher's Day,
    Halloween, Thanksgiving, Chuseok, Christmas, Christmas Eve, holiday, vacation, gift, present, card, candle, cake, costume, pumpkin,
    turkey, Santa Claus, reindeer, snowman, Christmas tree, stocking, lucky bag, rice cake`),
  // 15. House
  '집/가구': w(`house, home, apartment, room, living room, bedroom, bathroom, kitchen, dining room, balcony, garden, yard, garage, door,
    window, wall, floor, ceiling, stairs, roof, gate, table, desk, chair, sofa, couch, bed, pillow, blanket, lamp, light, clock, mirror,
    picture, shelf, bookshelf, closet, wardrobe, drawer, refrigerator, fridge, freezer, oven, microwave, stove, sink, dishwasher,
    washing machine, television, computer, fan, air conditioner, shower, bathtub, toilet, towel, soap, toothbrush, toothpaste, cup, glass,
    plate, bowl, spoon, fork, knife, chopsticks`),
  // 16. Illnesses & Health
  '건강/질병': w(`sick, ill, healthy, hurt, pain, cold, flu, fever, cough, headache, stomachache, toothache, earache, sore throat,
    runny nose, sneeze, cut, burn, bruise, broken, medicine, doctor, nurse, hospital, clinic, pharmacy, bandage, rest, sleep, exercise,
    health, unhealthy`),
  // 17. Market
  쇼핑: w(`market, store, shop, supermarket, mall, customer, clerk, cashier, seller, buyer, cart, basket, shelf, counter, bag, price,
    sale, discount, cheap, expensive, buy, sell, pay, choose, cost, need, want, receipt, change, cash, card, open, closed, size, small,
    medium, large`),
  // 18. Money
  돈: w(`money, coin, bill, cash, card, credit card, wallet, purse, won, dollar, cent, penny, price, cost, change, pay, spend, save,
    buy, sell, cheap, expensive, free, bank, account, allowance`),
  // 19. Musical Instruments
  음악: w(`music, instrument, piano, keyboard, guitar, electric guitar, bass, violin, cello, drum, drums, flute, recorder, trumpet,
    trombone, saxophone, clarinet, harmonica, tambourine, triangle, xylophone, bell, cymbal, microphone, song, melody, rhythm, beat,
    note, band, orchestra`),
  // 20. Nature (+ 24. Seasons & Weather를 mergeInto로 합침)
  '자연/날씨': w(`nature, sky, sun, moon, star, cloud, rain, snow, wind, rainbow, mountain, hill, valley, river, lake, pond, sea, ocean,
    beach, island, waterfall, forest, woods, jungle, desert, field, farm, tree, flower, grass, leaf, leaves, branch, root, seed, plant,
    rock, stone, sand, soil, mud, fire, water, air, earth, world`),
  // 21. Numbers
  '숫자/시간': w(`zero, one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen,
    seventeen, eighteen, nineteen, twenty, thirty, forty, fifty, sixty, seventy, eighty, ninety, hundred, thousand, first, second, third,
    fourth, fifth, sixth, seventh, eighth, ninth, tenth, number, plus, minus, equal, more, less, many, few`),
  // 22. People + 39. Family
  '사람/가족': w(`person, people, man, woman, boy, girl, baby, child, children, kid, adult, family, parent, mother, mom, father, dad,
    brother, sister, grandmother, grandma, grandfather, grandpa, aunt, uncle, cousin, friend, classmate, neighbor, teacher, student,
    parents, older sister, younger sister, older brother, younger brother, grandparents, son, daughter`),
  // 23. School
  '학교/문구': w(`school, classroom, teacher, student, class, lesson, subject, English, Korean, math, science, social studies, art, music,
    P.E., book, textbook, workbook, notebook, paper, pencil, pen, eraser, ruler, scissors, glue, crayon, marker, colored pencil,
    pencil case, desk, chair, board, whiteboard, computer, tablet, backpack, homework, test, quiz, question, answer, word, sentence,
    story, page, library, playground, gym, cafeteria, lunch, recess`),
  // 24. Seasons & Weather → 자연/날씨에 합침
  __날씨: w(`spring, summer, fall, autumn, winter, season, weather, sunny, cloudy, rainy, snowy, windy, foggy, stormy, hot, warm, cool,
    cold, dry, wet, humid, freezing, temperature, degree, sunshine, fog, storm, thunder, lightning, umbrella, snowflake, ice`),
  // 25. Shapes
  모양: w(`shape, circle, square, triangle, rectangle, oval, diamond, heart, star, pentagon, hexagon, octagon, line, dot, point, curve,
    straight, round, flat, thick, thin, long, short, wide, narrow, corner, side, center, top, bottom`),
  // 26. Sports
  스포츠: w(`sport, game, soccer, football, baseball, basketball, volleyball, tennis, badminton, table tennis, golf, swimming, running,
    jogging, cycling, skating, skiing, snowboarding, surfing, bowling, boxing, wrestling, gymnastics, taekwondo, karate, yoga, hiking,
    fishing, player, team, coach, ball, bat, racket, glove, helmet, goal, score, point, race, match, win, lose, throw, catch, kick, hit,
    run, jump`),
  // 27. Size
  크기: w(`big, small, large, little, huge, giant, tiny, tall, short, long, wide, narrow, thick, thin, heavy, light, deep, shallow, high,
    low, same, different, bigger, smaller, taller, shorter, longer, heavier, lighter, size, height, length, weight`),
  // 28. Telling Time → 숫자/시간에 합침
  __시간: w(`time, clock, watch, hour, minute, second, o'clock, half, quarter, morning, noon, afternoon, evening, night, midnight, early,
    late, now, soon, before, after, today, yesterday, tomorrow, daily, every day, always, usually, often, sometimes, never`),
  // 29. The Universe
  우주: w(`universe, space, sun, moon, Earth, planet, star, sky, galaxy, solar system, Mercury, Venus, Mars, Jupiter, Saturn, Uranus,
    Neptune, rocket, spaceship, astronaut, alien, satellite, telescope, comet, asteroid, meteor, gravity`),
  // 30. Toys
  장난감: w(`toy, doll, teddy bear, stuffed animal, robot, car, toy car, train, airplane, helicopter, block, blocks, LEGO, puzzle, ball,
    balloon, kite, yo-yo, marble, spinning top, jump rope, hula hoop, scooter, bicycle, bike, skateboard, board game, card, dice, puppet`),
  // 31. Transportation
  교통: w(`transportation, car, bus, taxi, truck, van, train, subway, bicycle, bike, motorcycle, scooter, airplane, plane, helicopter, ship,
    boat, ferry, rocket, ambulance, police car, fire engine, school bus, station, bus stop, airport, road, street, bridge, traffic light,
    crosswalk, ticket, passenger, driver, pilot, ride, drive, fly, sail`),
  // 32. Technology
  과학기술: w(`technology, computer, laptop, tablet, smartphone, phone, television, TV, camera, robot, machine, screen, keyboard, mouse,
    printer, speaker, microphone, headphone, earphone, charger, battery, internet, website, app, game, video, photo, message, email,
    password, button, click, touch, type, download, upload, search, save, delete, print, turn on, turn off`),
  // 33. Adjectives + 41. Describing Things
  상태: w(`good, bad, new, old, young, pretty, beautiful, ugly, cute, nice, kind, funny, smart, clever, strong, weak, fast, slow, easy,
    difficult, hard, soft, hot, cold, warm, cool, clean, dirty, wet, dry, full, empty, open, closed, loud, quiet, bright, dark, sweet,
    sour, salty, bitter, spicy, delicious, hungry, thirsty, busy, free, safe, dangerous, right, wrong, same, different, special,
    important, ready, careful, big, small, long, short, round, square, smooth, rough, heavy, light, thick, thin, colorful, shiny,
    broken, useful`),
  // 34. Position & Direction
  '위치/방향': w(`in, on, under, over, above, below, next to, beside, between, behind, in front of, near, far, inside, outside, around,
    through, across, up, down, left, right, straight, forward, backward, here, there`),
  // 35. Question Words
  의문사: w(`what, who, whose, where, when, why, which, how, how many, how much, how old, how long, how often, what time, what color,
    what kind`),
  // 40. Personality
  성격: w(`kind, nice, friendly, helpful, funny, cheerful, brave, shy, quiet, active, smart, clever, honest, polite, careful, patient,
    lazy, hardworking, curious, creative, silly, serious, generous, selfish`),
  // 42. Taste & Texture
  '맛/질감': w(`sweet, sour, salty, bitter, spicy, delicious, yummy, tasty, fresh, hot, cold, warm, soft, hard, crunchy, crispy, chewy,
    smooth, rough, sticky, juicy`),
  // 43. Jobs
  직업: w(`teacher, doctor, nurse, dentist, veterinarian, scientist, engineer, programmer, police officer, firefighter, farmer, chef,
    cook, baker, driver, pilot, flight attendant, artist, singer, dancer, actor, writer, photographer, designer, athlete, soccer player,
    baseball player, office worker`),
  // 44. Materials
  재료: w(`wood, metal, plastic, glass, paper, fabric, cloth, rubber, stone, rock, clay, cotton, wool, leather, gold, silver, water,
    ice, air, soil, sand`),
  // 45. Science
  과학: w(`solid, liquid, gas, matter, material, heat, light, sound, force, energy, magnet, electricity, temperature, melt, freeze,
    boil, burn, float, sink, mix, dissolve, grow, change, move, push, pull, living thing, plant, animal, habitat`),
  // 46. Environment
  환경: w(`Earth, environment, nature, air, water, land, ocean, forest, trash, garbage, plastic, paper, bottle, can, recycle, reuse,
    reduce, save, protect, clean, dirty, pollution, energy`),
  // 47. Reading & Story Words
  '독해/이야기': w(`story, title, author, illustrator, character, setting, beginning, middle, end, problem, solution, event, picture,
    page, chapter, idea, question, answer, guess, predict, remember, imagine, happen, first, next, then, finally, because`),
};

// 숙어·표현: 사전에서 "숙어·표현" 탭에 들어간다(part_of_speech = 숙어 / 표현).
export const IDIOM_LISTS = {
  // 37. Daily Routine
  숙어: w(`wake up, get up, wash my face, brush my teeth, take a shower, get dressed, eat breakfast, go to school, eat lunch, come home,
    do homework, eat dinner, watch TV, read a book, take a bath, go to bed`),
  // 38. Classroom English
  표현: w(`open your book, close your book, raise your hand, sit down, stand up, be quiet, work together, make a group, take turns,
    try again, good job, well done, are you ready?, let's start,
    hello, hi, goodbye, please, thank you, sorry, excuse me, yes, no, maybe, really, sure, okay, great, wow, I think, I know,
    I don't know, I agree, I don't agree, me too, not me, of course, you're welcome, that's okay, let's go, come on`),
};

export const MERGE_INTO = { __날씨: '자연/날씨', __시간: '숫자/시간' };
