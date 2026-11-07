// 파닉스 퀴즈 자동 만들기 검증: 소리 규칙 표기(patternMarked)가 있는 낱말로 만든 문제가 맞는지.
// 사용: cd app && node scripts/games/check-phonics-quiz.mjs
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let pass = 0;
const ok = (n) => { pass += 1; console.log("PASS", n); };
const noBackend = { name: "no-backend", enforce: "pre", load(id) { if (id.replaceAll("\\", "/").endsWith("/src/lib/supabase.ts")) return "export const supabase={};"; } };
const server = await createServer({ root, logLevel: "error", plugins: [noBackend], server: { middlewareMode: true }, appType: "custom" });
try {
  const P = await server.ssrLoadModule("/src/lib/phonicsQuiz.ts");
  const G = await server.ssrLoadModule("/src/lib/gameFromWords.ts");
  const L = await server.ssrLoadModule("/src/lib/wordListLaunch.ts");

  const card = (id, word, pm, category, meaning = "") => ({ id, word, patternMarked: pm, category, meaning, imageUrl: null });
  const cards = [
    card("1", "rain", "r{ai}n", "ai", "비"), card("2", "train", "tr{ai}n", "ai", "기차"), card("3", "mail", "m{ai}l", "ai", "우편"),
    card("4", "boat", "b{oa}t", "oa", "배"), card("5", "coat", "c{oa}t", "oa", "외투"), card("6", "road", "r{oa}d", "oa", "길"),
    card("7", "ship", "{sh}ip", "sh", "배"), card("8", "shop", "{sh}op", "sh", "가게"), card("9", "fish", "fi{sh}", "sh", "물고기"),
    card("10", "cake", "c{a}k{e}", "a_e", "케이크"), card("11", "make", "m{a}k{e}", "a_e", "만들다"), card("12", "name", "n{a}m{e}", "a_e", "이름"),
  ];

  assert.equal(P.maskPattern("r{ai}n"), "r__n");
  assert.equal(P.maskPattern("c{a}k{e}"), "c__k__");
  assert.equal(P.maskPattern("{sh}ip"), "__ip");
  ok("규칙 글자 가리기: r{ai}n → r__n, 떨어진 규칙은 두 칸");

  assert.equal(P.isPhonicsCards(cards), true);
  assert.equal(P.isPhonicsCards(cards.slice(0, 3)), false, "4개 미만은 아니다");
  assert.equal(P.isPhonicsCards(cards.map((c) => ({ ...c, patternMarked: null }))), false);
  assert.equal(P.isPhonicsCards(cards.map((c, i) => (i < 4 ? c : { ...c, patternMarked: null }))), false, "표기가 있는 낱말이 60% 미만");
  assert.deepEqual(P.buildPhonicsQuestions(cards.map((c) => ({ ...c, patternMarked: null }))), []);
  ok("파닉스 목록 판별: 표기 있는 낱말 60% 이상·4개 이상일 때만");

  let seenKinds = new Set();
  for (let round = 0; round < 60; round++) {
    const qs = P.buildPhonicsQuestions(cards);
    assert.ok(qs.length >= 8, `문제 ${qs.length}개`);
    assert.ok(qs.length <= cards.length);
    const texts = new Set();
    for (const q of qs) {
      assert.equal(q.choices.length, 4, q.question);
      assert.equal(new Set(q.choices.map((c) => c.toLowerCase())).size, 4, "보기가 겹치지 않는다: " + q.choices);
      assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
      assert.ok(!texts.has(q.question + q.choices[q.correctIndex]), "같은 문제가 두 번 나오지 않는다");
      texts.add(q.question + q.choices[q.correctIndex]);
      const answer = q.choices[q.correctIndex];
      if (q.question.startsWith("빈칸")) {
        seenKinds.add("blank");
        const shown = q.question.split("\n")[1].split("  ")[0];
        const word = cards.find((c) => P.maskPattern(c.patternMarked) === shown);
        assert.ok(word, "가린 낱말을 찾을 수 있다: " + shown);
        assert.equal(answer, word.category === "a_e" ? "a … e" : word.category, `${word.word} 의 빈칸 정답`);
      } else if (q.question.includes("같은 소리 규칙")) {
        seenKinds.add("sameRule");
        const target = q.question.match(/'(.+)'/)[1];
        const t = cards.find((c) => c.word === target);
        assert.equal(cards.find((c) => c.word === answer).category, t.category);
        assert.notEqual(answer, target);
        for (const c of q.choices) if (c !== answer) assert.notEqual(cards.find((x) => x.word === c).category, t.category, "오답은 다른 규칙");
      } else if (q.question.includes("라임")) {
        seenKinds.add("rhyme");
        const target = q.question.match(/'(.+)'/)[1];
        const rime = (w) => w.slice(w.length >= 4 ? -3 : -2);
        assert.equal(rime(answer), rime(target));
        for (const c of q.choices) if (c !== answer) assert.notEqual(rime(c), rime(target));
      } else if (q.question.includes("다른 하나")) {
        seenKinds.add("odd");
        const cats = q.choices.map((w) => cards.find((c) => c.word === w).category);
        const oddCat = cats[q.correctIndex];
        assert.equal(cats.filter((c) => c === oddCat).length, 1, "다른 하나는 정확히 하나");
        assert.equal(new Set(cats.filter((_, i) => i !== q.correctIndex)).size, 1, "나머지 셋은 같은 규칙");
      } else assert.fail("알 수 없는 문제: " + q.question);
    }
  }
  assert.deepEqual([...seenKinds].sort(), ["blank", "odd", "rhyme", "sameRule"]);
  ok("문제 4종(빈칸·같은 규칙·라임·다른 하나) 모두 나오고 정답·오답이 규칙과 맞다");

  const blankQ = P.buildPhonicsQuestions(cards, Math.random, 40).find((q) => q.question.startsWith("빈칸"));
  assert.ok(blankQ.question.includes("("), "뜻 힌트가 붙는다");
  assert.equal(P.buildPhonicsQuestions(cards, Math.random, 5).length, 5);
  ok("빈칸 문제에 뜻 힌트·문제 수 상한");

  // 게임 만들기 경로: 파닉스 단어면 파닉스 문제, 아니면 뜻 문제
  for (const type of ["tugofwar", "quiz", "gameshowquiz", "winlosequiz"]) {
    const phon = G.buildGameContent(type, cards);
    assert.ok(phon.config.questions.length >= 8, type);
    assert.ok(phon.config.questions.some((q) => q.question.includes("소리") || q.question.includes("빈칸") || q.question.includes("라임")), type + " 파닉스 문제");
    assert.ok(phon.config.questions.every((q) => !q.question.includes("와 ")), "어색한 조사 없음");
    const plain = G.buildGameContent(type, cards.map((c) => ({ ...c, patternMarked: null, category: null })));
    assert.ok(plain.config.questions.every((q) => !q.question.includes("빈칸")), type + " 뜻 문제");
  }
  const launch = L.prepareWordListGame(cards.map((c) => ({ id: c.id, word: c.word, meaning: c.meaning, image_url: null, category: c.category, patternMarked: c.patternMarked })), "quiz");
  assert.ok(launch.ready && launch.config.questions.some((q) => q.question.includes("빈칸") || q.question.includes("소리")));
  ok("줄다리기·퀴즈·팀 대항 퀴즈·점수 걸기 퀴즈가 파닉스 단어 목록이면 파닉스 문제를 만든다(아니면 뜻 문제)");

  console.log(`\n${pass}개 통과`);
} finally {
  await server.close();
}
