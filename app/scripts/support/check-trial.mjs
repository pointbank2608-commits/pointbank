// 체험 계산(lib/trial.ts) 가벼운 확인 — 실행: node app/scripts/support/check-trial.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let failed = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log('ok  ', name);
  } catch (e) {
    failed += 1;
    console.log('FAIL', name, '\n     ', e.message);
  }
};
const shift = (days) => new Date(Date.now() + 9 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);

try {
  const { trialInfo } = await server.ssrLoadModule('/src/lib/trial.ts');
  test('체험 마지막 날은 아직 활성(daysLeft 0)', () => {
    const t = trialInfo({ plan: 'free', trial_ends_at: shift(0) });
    assert.equal(t.active, true);
    assert.equal(t.daysLeft, 0);
  });
  test('5일 남음', () => assert.equal(trialInfo({ plan: 'free', trial_ends_at: shift(5) }).daysLeft, 5));
  test('어제 끝났으면 만료 1일 지남', () => {
    const t = trialInfo({ plan: 'free', trial_ends_at: shift(-1) });
    assert.equal(t.active, false);
    assert.equal(t.expired, true);
    assert.equal(t.daysSinceEnd, 1);
  });
  test('유료는 체험 상태가 아니다', () => {
    const t = trialInfo({ plan: 'paid', trial_ends_at: shift(5) });
    assert.equal(t.active, false);
    assert.equal(t.expired, false);
  });
  test('체험 정보가 없으면 아무것도 아님', () => {
    const t = trialInfo({ plan: 'free', trial_ends_at: null });
    assert.equal(t.active, false);
    assert.equal(t.expired, false);
  });
} finally {
  await server.close();
}
if (failed > 0) process.exit(1);
console.log('\n모두 통과');
