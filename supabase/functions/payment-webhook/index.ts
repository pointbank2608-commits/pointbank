// Supabase Edge Function (Deno) — 포트원 V2 결제 웹훅 수신(2026-10-18, 관리자 개선 · 결제 대조용).
//
// **아직 배포되지 않았다.** 이 함수는 결제 상태를 바꾸지 않는다 — 서명을 확인하고 이벤트를 `payment_events`에 "기록"만 한다.
// 관리자 > 결제·구독의 "청구 기록 대조"가 이 기록과 billing_history 를 맞춰 본다.
//
// 배포(운영자가 직접, 086u 적용 후):
//   1. `npx supabase functions deploy payment-webhook --no-verify-jwt`
//      (포트원이 호출하므로 JWT 검증을 끄고, 대신 Standard Webhooks 서명으로 인증한다.)
//   2. `npx supabase secrets set PORTONE_WEBHOOK_SECRET=whsec_...`  (포트원 콘솔 > 웹훅 > 시크릿. 값은 이 저장소에 적지 않는다.)
//   3. 포트원 콘솔에 이 함수 주소를 웹훅 URL 로 등록한다.
//
// 동작: 같은 웹훅 id 는 한 번만 기록(duplicate), 같은 결제의 더 오래된 이벤트는 stale 로 표시한다. 본문 전체는 저장하되
// 카드번호·빌링키 같은 민감값은 포트원이 보내지 않는 필드라 따로 지우지 않는다(보내는 필드가 바뀌면 이 함수에서 걸러야 한다).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.109.0';
import { verify } from '../_shared/standardWebhook.mjs';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('PORTONE_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'not_configured' }, 503);

  const body = await req.text();
  const ok = await verify({
    secret,
    id: req.headers.get('webhook-id') ?? '',
    timestamp: req.headers.get('webhook-timestamp') ?? '',
    signature: req.headers.get('webhook-signature') ?? '',
    body,
  });
  if (!ok) return json({ error: 'invalid_signature' }, 401);

  let payload: { type?: string; timestamp?: string; data?: { paymentId?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.rpc('payment_event_record', {
    p_webhook_id: req.headers.get('webhook-id'),
    p_type: payload.type ?? 'unknown',
    p_payment_id: payload.data?.paymentId ?? null,
    p_event_ts: payload.timestamp ?? new Date().toISOString(),
    p_payload: payload,
  });
  if (error) return json({ error: 'record_failed' }, 500); // 포트원이 다시 보낸다
  return json({ ok: true, result: data });
});
