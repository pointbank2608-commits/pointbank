// 확장 사전 원본 목록(ClassBank Elementary Vocabulary Bank) — 카테고리별 단어를 받은 그대로 적는다.
// 시범 대상은 Animals / Food / Action Words 세 카테고리(→ 동물 / 음식 / 동작). 나머지 카테고리는
// 같은 형식으로 여기에 이어 붙인다.
const w = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

export const RAW = {
  동작: w(`be, have, do, go, come, run, walk, jump, hop, skip, sit, stand, stop, start, begin, finish, move, stay, wait,
    follow, lead, turn, cross, enter, leave, arrive, return, travel, visit, see, look, watch, hear, listen, smell, taste,
    touch, feel, say, tell, speak, talk, ask, answer, call, shout, yell, whisper, cry, laugh, smile, sing, read, write,
    spell, draw, paint, color, make, build, fix, cut, fold, glue, open, close, push, pull, lift, carry, hold, put, take,
    bring, give, get, send, show, find, hide, search, lose, keep, throw, catch, kick, hit, bounce, roll, slide, climb,
    crawl, swim, fly, dance, march, ride, drive, eat, drink, cook, bake, wash, clean, brush, dry, wear, dress, change,
    sleep, wake, rest, play, study, learn, teach, practice, remember, forget, know, think, understand, guess, choose,
    decide, try, help, use, need, want, like, love, hate, hope, wish, enjoy, share, join, meet, work, buy, sell, pay,
    count, add, grow, plant, pick, blow, freeze, melt, burn, break, tear, cover, fill, empty, pour, mix, shake, press,
    knock, point, clap, wave, nod, bow, hug, kiss, cheer, win, lose, become, happen`),

  동물: w(`dog, puppy, cat, kitten, rabbit, hamster, mouse, rat, squirrel, hedgehog, fox, wolf, bear, deer, raccoon, monkey,
    gorilla, chimpanzee, lion, tiger, leopard, cheetah, elephant, giraffe, zebra, hippo, rhino, kangaroo, koala, panda,
    camel, horse, pony, cow, pig, sheep, goat, donkey, chicken, chick, rooster, duck, goose, turkey, bird, eagle, owl,
    parrot, penguin, flamingo, peacock, swan, crow, sparrow, frog, toad, snake, lizard, turtle, crocodile, alligator,
    dinosaur, fish, shark, whale, dolphin, octopus, squid, crab, lobster, shrimp, seal, starfish, jellyfish, seahorse,
    bee, butterfly, ant, spider, beetle, ladybug, mosquito, fly, grasshopper, snail, worm`),

  음식: w(`food, meal, breakfast, lunch, dinner, snack, rice, bread, toast, cereal, noodle, noodles, pasta, pizza, hamburger,
    sandwich, hot dog, chicken, beef, pork, fish, egg, cheese, soup, salad, curry, dumpling, pancake, waffle, French fries,
    potato, sweet potato, corn, carrot, onion, tomato, cucumber, lettuce, cabbage, mushroom, broccoli, spinach, bean, pea,
    apple, banana, orange, grape, strawberry, watermelon, melon, peach, pear, cherry, pineapple, mango, kiwi, lemon,
    blueberry, raspberry, coconut, avocado, cake, cookie, biscuit, chocolate, candy, ice cream, donut, pie, pudding,
    yogurt, milk, water, juice, soda, tea, coffee, lemonade, salt, sugar, pepper, butter, jam, honey, flour`),
};
