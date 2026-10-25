import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const server = await createServer({ root, logLevel: "error", server: { middlewareMode: true } });
try {
  const { buildNumberRange, NUMBER_RANGE_MAX } = await server.ssrLoadModule("/src/lib/numberRange.ts");
  const nums = (r) => ("numbers" in r ? r.numbers : r.error);
  assert.deepEqual(nums(buildNumberRange("1", "5", "1")), [1, 2, 3, 4, 5]);
  assert.deepEqual(nums(buildNumberRange("2", "10", "2")), [2, 4, 6, 8, 10]);
  assert.deepEqual(nums(buildNumberRange("1", "10", "3")), [1, 4, 7, 10], "끝 숫자 포함");
  assert.deepEqual(nums(buildNumberRange("1", "10", "4")), [1, 5, 9], "간격이 안 맞으면 끝 숫자 미만까지");
  assert.deepEqual(nums(buildNumberRange("7", "7", "")), [7], "간격 비우면 1, 시작=끝");
  assert.deepEqual(nums(buildNumberRange("-2", "2", "2")), [-2, 0, 2]);
  assert.equal(nums(buildNumberRange("10", "1", "1")), "order");
  assert.equal(nums(buildNumberRange("", "5", "1")), "invalid");
  assert.equal(nums(buildNumberRange("1.5", "5", "1")), "invalid");
  assert.equal(nums(buildNumberRange("1", "5", "0")), "step");
  assert.equal(nums(buildNumberRange("1", "5", "-1")), "step");
  assert.equal(nums(buildNumberRange("1", "5", "1.5")), "step");
  assert.equal(buildNumberRange("1", String(NUMBER_RANGE_MAX), "1").numbers.length, NUMBER_RANGE_MAX);
  assert.equal(nums(buildNumberRange("1", String(NUMBER_RANGE_MAX + 1), "1")), "tooMany");
  assert.equal(buildNumberRange("1", "1000", "10").numbers.length, 100, "간격으로 100개 이내면 허용");
  console.log("PASS 숫자 범위: 간격·끝 숫자 포함·음수·오류(순서·간격·형식·100개 초과)");
} finally {
  await server.close();
}
