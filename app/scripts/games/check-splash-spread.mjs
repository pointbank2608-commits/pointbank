// Sentence Splash 벽돌이 넓은 화면에서 왼쪽에만 몰리지 않고 가로 전체에 고르게 펼쳐지는지 확인한다.
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const server = await createServer({ root, logLevel: "error", server: { middlewareMode: true } });
try {
  const L = await server.ssrLoadModule("/src/lib/sentenceSplash.ts");
  const words = ["These", "monkeys", "love", "to", "eat", "fruits."];
  const measure = (s) => s.length * 12;
  const mk = (sentence) => L.makeSplashBricks({ id: "s", label: sentence });
  for (const width of [390, 768, 1440, 1900]) {
    const { positions } = L.layoutSplashBricks(mk(words.join(" ")), width, measure);
    const xs = positions.map((p) => p.x);
    const left = Math.min(...xs);
    const right = Math.max(...positions.map((p) => p.x + p.width));
    // 겹침 없음·화면 안
    for (const p of positions) assert.ok(p.x >= 0 && p.x + p.width <= width, `${width}px: 화면 안`);
    for (let i = 0; i < positions.length; i++)
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        const sameRow = a.y === b.y;
        if (sameRow) assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x, `${width}px: 같은 줄 벽돌이 겹치지 않는다`);
      }
    if (width >= 1440) {
      // 한 줄로 들어가는 넓은 화면: 양 끝 가까이까지 펼쳐져야 한다
      assert.ok(left < width * 0.2, `${width}px: 왼쪽 가까이에서 시작 (${left})`);
      assert.ok(right > width * 0.8, `${width}px: 오른쪽 가까이까지 펼쳐짐 (${right})`);
      const rowsOf = new Set(positions.map((p) => p.y)).size;
      assert.equal(rowsOf, 1);
    }
    console.log(`PASS ${width}px 가로 ${Math.round(left)}~${Math.round(right)} (${new Set(positions.map((p) => p.y)).size}줄)`);
  }
  const one = L.layoutSplashBricks(mk("Hello"), 1500, measure).positions[0];
  assert.ok(Math.abs(one.x + one.width / 2 - 750) < 2, "벽돌이 하나면 가운데");
  console.log("PASS 벽돌 하나는 가운데");
} finally {
  await server.close();
}
