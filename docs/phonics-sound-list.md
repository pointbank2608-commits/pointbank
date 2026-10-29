# 파닉스 음가 녹음 목록

규칙 76개 × 파일 1개. 파일 이름은 `app/public/phonics-sounds/<규칙 id>.mp3`, 길이 1초 안팎(소리만, "에스" 같은 글자 이름 말고 /s/ 소리), 앞뒤 무음 최소, 같은 목소리·같은 크기로.
녹음 뒤 `node app/scripts/phonics/sync-phonemes.mjs` 를 실행하면 이 표와 `src/data/phonics/phoneme-audio.json`이 갱신되고, 파일이 있는 규칙에만 게임에 "소리 듣기" 버튼이 나온다.
자음군(bl·cl 등)은 두 소리를 이어서 한 번에(/bl/) 녹음한다. 음원은 직접 녹음하거나 CC0·CC-BY 파일(출처 표시)만 쓴다 — 비상업(NC) 라이선스는 쓰지 않는다.

완료 76 / 76

| 완료 | 규칙 id | 단계 | 이름 | 소리 | 예시 낱말 |
|---|---|---|---|---|---|
| ✅ | `letter-a` | 알파벳 | A |  | apple, ant, axe |
| ✅ | `letter-b` | 알파벳 | B |  | bag, bat, bus |
| ✅ | `letter-c` | 알파벳 | C | /k/ (cat) | cap, cat, cup |
| ✅ | `letter-d` | 알파벳 | D |  | dog, duck, desk |
| ✅ | `letter-e` | 알파벳 | E |  | egg, elephant, elbow |
| ✅ | `letter-f` | 알파벳 | F |  | fish, fan, fox |
| ✅ | `letter-g` | 알파벳 | G | /g/ (go) | gorilla, gift, garden |
| ✅ | `letter-h` | 알파벳 | H |  | hat, hen, hand |
| ✅ | `letter-i` | 알파벳 | I |  | igloo, ink, insect |
| ✅ | `letter-j` | 알파벳 | J |  | jam, jet, jug |
| ✅ | `letter-k` | 알파벳 | K |  | king, kite, key |
| ✅ | `letter-l` | 알파벳 | L |  | lion, leg, lemon |
| ✅ | `letter-m` | 알파벳 | M |  | monkey, map, milk |
| ✅ | `letter-n` | 알파벳 | N |  | nest, net, nut |
| ✅ | `letter-o` | 알파벳 | O |  | octopus, ostrich, ox |
| ✅ | `letter-p` | 알파벳 | P |  | pig, pen, pin |
| ✅ | `letter-q` | 알파벳 | Q | /kw/ (queen) 또는 /k/ | queen, quilt, question |
| ✅ | `letter-r` | 알파벳 | R |  | rabbit, ring, rain |
| ✅ | `letter-s` | 알파벳 | S |  | sun, sock, snake |
| ✅ | `letter-t` | 알파벳 | T |  | tiger, top, turtle |
| ✅ | `letter-u` | 알파벳 | U |  | umbrella, up, under |
| ✅ | `letter-v` | 알파벳 | V |  | van, vest, violin |
| ✅ | `letter-w` | 알파벳 | W |  | web, window, watch |
| ✅ | `letter-x` | 알파벳 | X | /ks/ (box) | box, fox, six |
| ✅ | `letter-y` | 알파벳 | Y | /y/ (yes) | yo-yo, yellow, yam |
| ✅ | `letter-z` | 알파벳 | Z |  | zebra, zipper, zoo |
| ✅ | `short-a` | 단모음 | Short a | /æ/ apple | dad, bad, sad |
| ✅ | `short-e` | 단모음 | Short e | /e/ egg | red, bed, Ted |
| ✅ | `short-i` | 단모음 | Short i | /ɪ/ igloo | pig, big, wig |
| ✅ | `short-o` | 단모음 | Short o | /ɒ/ octopus | dog, log, jog |
| ✅ | `short-u` | 단모음 | Short u | /ʌ/ umbrella | bug, hug, rug |
| ✅ | `magic-a` | 매직 e | a_e | /eɪ/ cake | cake, lake, bake |
| ✅ | `magic-i` | 매직 e | i_e | /aɪ/ bike | bike, hike, like |
| ✅ | `magic-o` | 매직 e | o_e | /oʊ/ nose | bone, cone, zone |
| ✅ | `magic-u` | 매직 e | u_e | /juː/ cube | tune, June, dune |
| ✅ | `blend-bl` | 자음군·묶음 | bl |  | black, block, blank |
| ✅ | `blend-cl` | 자음군·묶음 | cl |  | clap, clip, club |
| ✅ | `blend-fl` | 자음군·묶음 | fl |  | flag, flat, flap |
| ✅ | `blend-gl` | 자음군·묶음 | gl |  | glad, glass, glob |
| ✅ | `blend-pl` | 자음군·묶음 | pl |  | plan, plant, plum |
| ✅ | `blend-br` | 자음군·묶음 | br |  | brush, brick, brim |
| ✅ | `blend-cr` | 자음군·묶음 | cr |  | crab, cross, crop |
| ✅ | `blend-dr` | 자음군·묶음 | dr |  | drum, drop, drip |
| ✅ | `blend-fr` | 자음군·묶음 | fr |  | frog, from, fresh |
| ✅ | `blend-gr` | 자음군·묶음 | gr |  | grass, grin, grab |
| ✅ | `blend-pr` | 자음군·묶음 | pr |  | print, press, prim |
| ✅ | `blend-tr` | 자음군·묶음 | tr |  | trap, trip, trim |
| ✅ | `blend-st_initial` | 자음군·묶음 | st (initial) |  | stop, stem, step |
| ✅ | `blend-sk_initial` | 자음군·묶음 | sk (initial) |  | skin, skip, skid |
| ✅ | `blend-sk_final` | 자음군·묶음 | sk (final) |  | desk, mask, task |
| ✅ | `blend-mp_final` | 자음군·묶음 | mp (final) |  | lamp, camp, jump |
| ✅ | `blend-nd_final` | 자음군·묶음 | nd (final) |  | hand, band, sand |
| ✅ | `blend-nk_final` | 자음군·묶음 | nk (final) |  | pink, ink, bank |
| ✅ | `blend-sh` | 자음군·묶음 | sh | /ʃ/ ship | ship, shop, shell |
| ✅ | `blend-ch` | 자음군·묶음 | ch | /tʃ/ chip | chip, chin, chat |
| ✅ | `th-voiceless` | 자음군·묶음 | th /θ/ | /θ/ thin (숨만) | thin, thick, three |
| ✅ | `th-voiced` | 자음군·묶음 | th /ð/ | /ð/ this (성대 울림) | this, that, them |
| ✅ | `blend-wh` | 자음군·묶음 | wh | /w/ whale | whip, white, wheel |
| ✅ | `blend-ng` | 자음군·묶음 | ng | /ŋ/ ring | king, ring, sing |
| ✅ | `vowel-ee` | 모음 조합 | ee | /iː/ bee | bee, tree, seed |
| ✅ | `vowel-ea` | 모음 조합 | ea | /iː/ eat | sea, tea, meat |
| ✅ | `vowel-ai` | 모음 조합 | ai | /eɪ/ rain | rain, train, tail |
| ✅ | `vowel-ay` | 모음 조합 | ay | /eɪ/ day | day, play, say |
| ✅ | `vowel-oa` | 모음 조합 | oa | /oʊ/ boat | boat, coat, road |
| ✅ | `ow-long-o` | 모음 조합 | ow /oʊ/ | /oʊ/ snow | snow, grow, show |
| ✅ | `oo-short` | 모음 조합 | oo /ʊ/ | /ʊ/ book | book, cook, foot |
| ✅ | `oo-long` | 모음 조합 | oo /uː/ | /uː/ moon | moon, spoon, zoo |
| ✅ | `vowel-oi` | 모음 조합 | oi | /ɔɪ/ coin | coin, point, oil |
| ✅ | `vowel-oy` | 모음 조합 | oy | /ɔɪ/ boy | boy, toy, joy |
| ✅ | `vowel-ou` | 모음 조합 | ou | /aʊ/ out | house, mouse, out |
| ✅ | `ow-diphthong` | 모음 조합 | ow /aʊ/ | /aʊ/ cow | cow, owl, down |
| ✅ | `vowel-ar` | 모음 조합 | ar | /ɑːr/ car | car, star, park |
| ✅ | `vowel-er` | 모음 조합 | er | /ɜːr/ her | her, fern, term |
| ✅ | `vowel-ir` | 모음 조합 | ir | /ɜːr/ bird | bird, girl, shirt |
| ✅ | `vowel-or` | 모음 조합 | or | /ɔːr/ fork | fork, corn, horse |
| ✅ | `vowel-ur` | 모음 조합 | ur | /ɜːr/ turn | burn, turn, hurt |
