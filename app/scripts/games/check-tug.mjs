// 줄다리기 대결 검증: 순수 로직(설정 정규화·문제 묶음·보기 줄이기·승패·줄 위치·정답률·시간 표기).
// 사용: cd app && node scripts/games/check-tug.mjs
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let pass = 0;
const ok = (n) => { pass += 1; console.log("PASS", n); };
const server = await createServer({ root, logLevel: "error", server: { middlewareMode: true }, appType: "custom" });
try {
  const T = await server.ssrLoadModule("/src/lib/tugOfWar.ts");
  const q = (id, question, choices, correctIndex) => ({ id, question, choices, correctIndex });
  const questions = [
    q("a", "apple", ["사과", "바나나", "우유", "책", "해", "달"], 0),
    q("b", "The cat is ___ the box.", ["in", "on", "under", "behind"], 0),
    q("c", "sun", ["달", "별", "해"], 2),
    q("d", "dog", ["강아지", "고양이"], 0),
  ];

  assert.deepEqual(T.normalizeTugConfig(undefined), { pull: 5, freeze: 3, seconds: 180 });
  assert.deepEqual(T.normalizeTugConfig({ tugPull: 99, tugFreeze: 4, tugSeconds: 7 }), { pull: 5, freeze: 3, seconds: 180 });
  assert.deepEqual(T.normalizeTugConfig({ tugPull: 8, tugFreeze: 5, tugSeconds: 0 }), { pull: 8, freeze: 5, seconds: 0 });
  ok("설정 정규화(허용된 값만, 시간 0 = 제한 없음)");

  assert.equal(T.playableTugQuestions(questions).length, 4);
  assert.equal(T.playableTugQuestions([q("x", "", ["a", "b"], 0), q("y", "ok", ["a"], 0), q("z", "ok", ["a", "", "c"], 1), q("w", "ok", ["a", "b"], 0)]).length, 1);
  assert.deepEqual(T.playableTugQuestions(undefined), []);
  ok("풀 수 있는 문제만 쓴다(질문 없음·보기 1개·빈 정답 제외)");

  for (let i = 0; i < 200; i++) {
    const shown = T.presentTugQuestion(questions[0]);
    assert.equal(shown.choices.length, 4, "보기는 최대 4개");
    assert.equal(shown.choices[shown.correctIndex], "사과", "정답은 항상 포함");
    assert.equal(new Set(shown.choices).size, 4);
  }
  assert.equal(T.presentTugQuestion(questions[3]).choices.length, 2);
  const dup = T.presentTugQuestion(q("e", "big", ["큰", "큰", "작은", "작은", "큰 "], 0));
  assert.equal(new Set(dup.choices.map((c) => c.toLowerCase())).size, dup.choices.length, "같은 보기는 하나만");
  ok("보기를 최대 4개로 줄이되 정답은 포함, 같은 보기는 하나만");

  const deck = T.buildTugDeck(questions, 40);
  assert.equal(deck.length, 40);
  for (let i = 1; i < deck.length; i++) assert.notEqual(deck[i].id, deck[i - 1].id, "같은 문제가 바로 이어지지 않는다");
  for (let start = 0; start + 4 <= 40; start += 4) assert.equal(new Set(deck.slice(start, start + 4).map((d) => d.id)).size, 4, "한 바퀴 안에서는 겹치지 않는다");
  assert.deepEqual(T.buildTugDeck([], 10), []);
  assert.equal(T.buildTugDeck(questions.slice(0, 1), 5).length, 5);
  assert.equal(T.TUG_DECK, 200);
  ok("문제 묶음: 연속 중복 없음·한 바퀴 안 중복 없음·문제가 1개여도 채움");

  const a = T.buildTugDeck(questions, 12).map((d) => d.id).join();
  let different = false;
  for (let i = 0; i < 20 && !different; i++) different = T.buildTugDeck(questions, 12).map((d) => d.id).join() !== a;
  assert.ok(different, "팀마다 따로 만들면 순서가 달라질 수 있다");
  ok("팀마다 따로 만든 묶음은 순서·배치가 다르다");

  assert.equal(T.tugWinner(5, 5, false), 0);
  assert.equal(T.tugWinner(-5, 5, false), 1);
  assert.equal(T.tugWinner(4, 5, false), null);
  assert.equal(T.tugWinner(2, 5, true), 0);
  assert.equal(T.tugWinner(-1, 5, true), 1);
  assert.equal(T.tugWinner(0, 5, true), null);
  assert.equal(T.tugSuddenWinner(1), 0);
  assert.equal(T.tugSuddenWinner(-1), 1);
  assert.equal(T.tugSuddenWinner(0), null);
  ok("승패: 끝 선·제한 시간 때 앞선 팀·같으면 연장전");

  assert.equal(T.tugKnotPercent(0, 5), 50);
  assert.equal(T.tugKnotPercent(5, 5, 44), 28);
  assert.equal(T.tugKnotPercent(-5, 5, 44), 72);
  assert.equal(T.tugKnotPercent(99, 5, 44), 28);
  assert.ok(T.tugKnotPercent(2, 5, 44) < 50 && T.tugKnotPercent(-2, 5, 44) > 50);
  ok("줄 위치: 파랑이 이기면 왼쪽, 빨강이 이기면 오른쪽, 끝 선을 넘지 않는다");

  assert.equal(T.tugAccuracy({ correct: 0, wrong: 0 }), 0);
  assert.equal(T.tugAccuracy({ correct: 3, wrong: 1 }), 75);
  assert.deepEqual([61000, 59100, 0, -5].map(T.formatTugClock), ["1:01", "1:00", "0:00", "0:00"]);
  ok("정답률·남은 시간 표기");

  console.log(`\n${pass}개 통과`);
} finally {
  await server.close();
}
