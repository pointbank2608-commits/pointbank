import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const readFunction = (path) => readFileSync(new URL(`../../../supabase/functions/${path}`, import.meta.url), 'utf8');
const source = readFunction('_shared/portoneCharge.ts').replace(/^export /gm, '') + '\n' +
  readFunction('register-billing-key/index.ts').replace(/^import .*;\r?$/gm, '');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
const today = '2026-11-16';
class TestDate extends Date {
  static now() { return Date.parse(`${today}T05:00:00Z`); }
}

function fixture({ plan = 'free', trialEnds = today, nextBilling = null, role = 'owner', issuedChannel = 'expected-channel' } = {}) {
  const writes = [];
  const charges = [];
  let handler;
  const tables = {
    profiles: { academy_id: 'academy-1', role },
    academies: { plan, trial_ends_at: trialEnds, next_billing_at: nextBilling },
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
    from: (name) => ({
      select: () => ({ eq: () => ({
        single: async () => ({ data: tables[name] }),
        maybeSingle: async () => ({ data: tables[name] }),
        count: 0,
      }) }),
      upsert: async (values) => { writes.push([name, values]); return {}; },
      insert: async (values) => { writes.push([name, values]); return {}; },
    }),
    rpc: async (name, values) => { writes.push([name, values]); return { data: true }; },
  };

  runInNewContext(outputText, {
    createClient: () => client,
    Date: TestDate, Response, TextEncoder, crypto,
    Deno: {
      env: { get: (name) => name === 'PORTONE_CHANNEL_KEY' ? 'expected-channel' : 'test' },
      serve: (fn) => { handler = fn; },
    },
    fetch: async (url, options) => {
      if (url.includes('/billing-keys/')) {
        return Response.json({ status: 'ISSUED', channels: [{ key: issuedChannel }] });
      }
      assert.match(url, /\/sub_[a-f0-9]{36}\/billing-key$/);
      charges.push(JSON.parse(options.body));
      return Response.json({ payment: {} });
    },
  });
  const call = async (body, status = 200) => {
    const response = await handler(new Request('http://local/register-billing-key', { method: 'POST', body: JSON.stringify(body) }));
    assert.equal(response.status, status);
    return response.json();
  };
  return { call, writes, charges };
}

const activeTrial = fixture();
const duringTrial = await activeTrial.call({ action: 'quote' });
assert.equal(duringTrial.firstChargeOn, '2026-11-17');
assert.equal(duringTrial.amountKrw, 9900);
assert.equal(duringTrial.chargeNow, false);
await activeTrial.call({ billingKey: 'old-client' }, 400);
await activeTrial.call({ action: 'change-card', billingKey: 'old-client' }, 400);
await activeTrial.call({ ...duringTrial, action: 'start-subscription', billingKey: 'test', amountKrw: 10890 }, 409);
await activeTrial.call({ ...duringTrial, action: 'start-subscription', billingKey: 'test', firstChargeOn: today }, 409);
assert.equal(activeTrial.writes.length, 0);
assert.equal(activeTrial.charges.length, 0);
const scheduled = await activeTrial.call({ ...duringTrial, action: 'start-subscription', billingKey: 'test' });
assert.equal(scheduled.scheduled, '2026-11-17');
assert.equal(activeTrial.charges.length, 0);
assert.equal(activeTrial.writes[0][1].p_paid_payment_id, null);

const wrongChannel = fixture({ issuedChannel: 'other-channel' });
await wrongChannel.call({ ...duringTrial, action: 'start-subscription', billingKey: 'test' }, 400);
assert.equal(wrongChannel.writes.length, 0);
assert.equal(wrongChannel.charges.length, 0);

const expired = fixture({ trialEnds: '2026-11-15' });
const immediate = await expired.call({ action: 'quote' });
assert.equal(immediate.firstChargeOn, today);
assert.equal(immediate.chargeNow, true);
const started = await expired.call({ ...immediate, action: 'start-subscription', billingKey: 'test' });
assert.equal(started.scheduled, null);
assert.equal(expired.charges[0].amount.total, 9900);
assert.equal(expired.charges[0].channelKey, 'expected-channel');
assert.equal(expired.writes[0][1].p_next_charge_on, '2026-12-16');

const paid = fixture({ plan: 'paid', nextBilling: '2026-12-16' });
await paid.call({ action: 'change-card', billingKey: 'test' });
assert.equal(paid.writes[0][0], 'academy_billing_keys');
assert.equal(paid.charges.length, 0);
await fixture({ role: 'teacher' }).call({ action: 'quote' }, 400);
console.log('PASS: trial quote, missing/changed consent, scheduled and immediate subscriptions, card-only change, owner authorization');
