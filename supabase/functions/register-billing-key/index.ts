// Supabase Edge Function (Deno) — 카드(빌링키) 등록.
//
// **아직 배포되지 않은 상태다.** extract-lesson-from-video/index.ts 와 같은 이유로
// 코드만 준비해뒀다. 배포하려면:
//   1. `npx supabase functions deploy register-billing-key`
//   2. `npx supabase secrets set PORTONE_API_SECRET=... BASE_FEE_KRW=9900 PER_STUDENT_FEE_KRW=5000`
//      (PORTONE_API_SECRET은 NHN KCP 채널키가 발급된 뒤에나 실제 값이 생긴다 — 그 전까지는
//      이 함수가 호출돼도 빌링키 저장까지는 되지만 최초 결제는 "준비 중" 실패로 기록된다.)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY는 Supabase가 모든 Edge
// Function에 자동으로 넣어주므로 별도 설정이 필요 없다.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.109.0';
import { chargeAcademy } from '../_shared/portoneCharge.ts';

interface RegisterRequest {
  billingKey: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { billingKey } = (await req.json()) as RegisterRequest;
    if (!billingKey) throw new Error('billingKey가 필요해요.');

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 호출자 본인 확인용 — RLS가 걸린 채로 자기 profiles 행만 읽는다. academyId를 요청
    // 바디로 받지 않는 이유: 클라이언트가 남의 academy_id를 보내는 걸 원천 차단하기 위함.
    const supabaseAsCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await supabaseAsCaller.auth.getUser();
    if (!user) throw new Error('로그인이 필요해요.');

    const { data: profile, error: profileError } = await supabaseAsCaller
      .from('profiles')
      .select('academy_id, role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile?.academy_id) throw new Error('소속된 학원이 없어요.');
    if (profile.role !== 'owner') throw new Error('결제 등록은 원장님만 할 수 있어요.');

    const academyId = profile.academy_id as string;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    await supabaseAdmin
      .from('academy_billing_keys')
      .upsert({ academy_id: academyId, billing_key: billingKey, customer_uid: academyId, updated_at: new Date().toISOString() });

    // 카드 등록 직후 첫 결제를 바로 시도한다 — 성공해야만 유료 플랜으로 전환한다.
    const result = await chargeAcademy(supabaseAdmin, academyId, billingKey, academyId);
    const today = new Date();
    const periodStart = today.toISOString().slice(0, 10);
    const nextBillingDate = new Date(today);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    await supabaseAdmin.from('billing_history').insert({
      academy_id: academyId,
      period_start: periodStart,
      period_end: nextBillingDate.toISOString().slice(0, 10),
      student_count: result.studentCount,
      amount_krw: result.amountKrw,
      status: result.success ? 'success' : 'failed',
      portone_payment_id: result.portonePaymentId ?? null,
      failure_reason: result.failureReason ?? null,
    });

    if (!result.success) {
      throw new Error(result.failureReason ?? '결제에 실패했어요.');
    }

    await supabaseAdmin
      .from('academies')
      .update({
        plan: 'paid',
        plan_status: 'active',
        plan_started_at: today.toISOString(),
        billing_cycle_day: today.getDate(),
        next_billing_at: nextBillingDate.toISOString().slice(0, 10),
        billing_failure_count: 0,
      })
      .eq('id', academyId);

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
