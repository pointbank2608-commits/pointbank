// 단어 농구 대결 검증: 순수 로직(문제 만들기·점수·승부·시간 표기·설정 정규화).
// 사용: cd app && node scripts/games/check-hoops.mjs
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let pass = 0;
const ok = (n) => { pass += 1; console.log("PASS", n); };
const server = await createServer({ root, logLevel: "error", server: { middlewareMode: true }, appType: "custom" });
try {
  const H = await server.ssrLoadModule("/src/lib/wordHoops.ts");
  const pairs = ["apple|사과", "banana|바나나", "cat|고양이", "dog|강아지", "book|책", "sun|해"].map((s, i) => {
    const [left, right] = s.split("|");
    return { id: `p${i}`, left, right };
  });

  assert.deepEqual(H.normalizeHoopsConfig(undefined), { teams: 2, shots: 10, mode: "meaning" });
  assert.deepEqual(H.normalizeHoopsConfig({ hoopsTeams: 9, hoopsShots: 1, hoopsMode: "x" }), { teams: 2, shots: 3, mode: "meaning" });
  assert.equal(H.normalizeHoopsConfig({ hoopsTeams: 1, hoopsShots: 99, hoopsMode: "mixed" }).shots, 30);
  ok("설정 정규화(팀 1~2·문제 수 3~30·방식 3종만)");

  for (const mode of ["meaning", "word", "mixed"]) {
    const qs = H.buildHoopsQuestions(pairs, 10, mode);
    assert.equal(qs.length, 10);
    for (const q of qs) {
      assert.equal(q.choices.length, 3);
      assert.equal(new Set(q.choices.map((c) => c.toLowerCase())).size, 3, "보기가 겹치지 않는다");
      const pair = pairs.find((p) => q.explain === `${p.left} = ${p.right}`);
      assert.ok(pair, "설명 줄이 낱말 짝과 같다");
      const answer = q.dir === "toMeaning" ? pair.right : pair.left;
      assert.equal(q.choices[q.correctIndex], answer);
      assert.equal(q.prompt, q.dir === "toMeaning" ? pair.left : pair.right);
      assert.equal(q.speak, pair.left);
      if (mode === "meaning") assert.equal(q.dir, "toMeaning");
      if (mode === "word") assert.equal(q.dir, "toWord");
    }
  }
  ok("문제 10개: 보기 3개 겹침 없음·정답 위치·읽어 줄 영어·방식별 방향");

  const mixed = H.buildHoopsQuestions(pairs, 30, "mixed");
  assert.ok(mixed.some((q) => q.dir === "toMeaning") && mixed.some((q) => q.dir === "toWord"));
  ok("섞어서: 두 방향이 모두 나온다");

  const tiny = H.buildHoopsQuestions(pairs.slice(0, 2), 6, "meaning");
  assert.equal(tiny.length, 6);
  assert.ok(tiny.every((q) => q.choices.length === 2));
  for (let i = 1; i < tiny.length; i++) assert.notEqual(tiny[i].explain, tiny[i - 1].explain, "같은 낱말이 바로 이어지지 않는다");
  assert.deepEqual(H.buildHoopsQuestions(pairs.slice(0, 1), 5, "meaning"), []);
  assert.deepEqual(H.buildHoopsQuestions([{ id: "a", left: "x", right: "" }, { id: "b", left: "", right: "y" }], 5, "meaning"), []);
  ok("낱말 2개: 보기 2개로 반복 출제(연속 중복 없음)·1개 이하·빈 칸 짝은 문제 없음");

  const dup = H.buildHoopsQuestions(
    [{ id: "a", left: "big", right: "큰" }, { id: "b", left: "large", right: "큰" }, { id: "c", left: "small", right: "작은" }, { id: "d", left: "tiny", right: "작은" }],
    12,
    "meaning",
  );
  for (const q of dup) assert.equal(new Set(q.choices).size, q.choices.length, "같은 뜻 낱말이 보기에 겹치지 않는다");
  ok("뜻이 같은 낱말끼리 보기에 같이 나오지 않는다");

  assert.deepEqual([1, 2, 3, 4].map(H.pointsForTry), [2, 1, 0, 0]);
  ok("점수: 첫 시도 2·두 번째 1·그 뒤 0");

  const r = (team, firstTry, points, ms) => ({ team, firstTry, points, shots: 10, ms });
  assert.deepEqual(H.rankHoops([r(0, 8, 18, 50000), r(1, 9, 18, 70000)]).map((x) => x.team), [1, 0]);
  assert.deepEqual(H.rankHoops([r(0, 9, 18, 70000), r(1, 9, 19, 90000)]).map((x) => x.team), [1, 0]);
  assert.deepEqual(H.rankHoops([r(0, 9, 19, 70000), r(1, 9, 19, 60000)]).map((x) => x.team), [1, 0]);
  assert.equal(H.isHoopsTie([r(0, 9, 19, 60000), r(1, 9, 19, 60000)]), true);
  assert.equal(H.isHoopsTie([r(0, 9, 19, 60000), r(1, 9, 19, 60100)]), false);
  assert.equal(H.isHoopsTie([r(0, 9, 19, 60000)]), false);
  ok("승부: 첫 시도 정답 → 점수 → 시간 순, 완전히 같을 때만 무승부");

  assert.equal(H.formatHoopsTime(0), "0:00.0");
  assert.equal(H.formatHoopsTime(70723), "1:10.7");
  assert.equal(H.formatHoopsTime(5400), "0:05.4");
  ok("시간 표기 m:ss.s");

  console.log(`\n${pass}개 통과`);
} finally {
  await server.close();
}
