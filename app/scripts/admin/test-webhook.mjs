// 웹훅 서명 검증 단위 테스트 — 실제 시크릿 없이 만든 임시 시크릿으로 확인한다.
import { sign, verify } from '../../../supabase/functions/_shared/standardWebhook.mjs';

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };

const secret = 'whsec_' + Buffer.from('test-secret-not-real-0123456789').toString('base64');
const id = 'msg_test_1';
const now = 1_800_000_000;
const ts = String(now);
const body = JSON.stringify({ type: 'Transaction.Paid', data: { paymentId: 'sub_x_2026-10-18_1' } });
const good = await sign(secret, id, ts, body);

check('올바른 서명 통과', await verify({ secret, id, timestamp: ts, signature: `v1,${good}`, body, nowSeconds: now }));
check('서명 여러 개 중 하나만 맞아도 통과', await verify({ secret, id, timestamp: ts, signature: `v1,AAAA v1,${good}`, body, nowSeconds: now }));
check('본문이 바뀌면 거부', !(await verify({ secret, id, timestamp: ts, signature: `v1,${good}`, body: body + ' ', nowSeconds: now })));
check('id 가 다르면 거부', !(await verify({ secret, id: 'msg_other', timestamp: ts, signature: `v1,${good}`, body, nowSeconds: now })));
check('다른 시크릿이면 거부', !(await verify({ secret: 'whsec_' + Buffer.from('another').toString('base64'), id, timestamp: ts, signature: `v1,${good}`, body, nowSeconds: now })));
check('5분 넘게 오래된 요청 거부', !(await verify({ secret, id, timestamp: ts, signature: `v1,${good}`, body, nowSeconds: now + 301 })));
check('5분 안이면 통과', await verify({ secret, id, timestamp: ts, signature: `v1,${good}`, body, nowSeconds: now + 299 }));
check('헤더 없음 거부', !(await verify({ secret, id: '', timestamp: ts, signature: `v1,${good}`, body, nowSeconds: now })));
check('시크릿 없음 거부', !(await verify({ secret: '', id, timestamp: ts, signature: `v1,${good}`, body, nowSeconds: now })));
check('v2 접두사는 무시', !(await verify({ secret, id, timestamp: ts, signature: `v2,${good}`, body, nowSeconds: now })));
check('망가진 시크릿은 예외 없이 거부', !(await verify({ secret: 'whsec_!!!', id, timestamp: ts, signature: `v1,${good}`, body, nowSeconds: now })));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
