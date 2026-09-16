// Supabase Edge Function (Deno) — 매일 실행되는 정기결제 배치.
//
// **아직 배포·스케줄되지 않은 상태다.** 배포하려면:
//   1. `npx supabase functions deploy charge-subscriptions --no-verify-jwt`
//      (로그인한 사용자가 아니라 pg_cron/pg_net이 호출하므로 JWT 검증을 끈다 — 대신
//      x-cron-secret 헤더로 자체 인증한다.)
//   2. `npx supabase secrets set CRON_SECRET=...`
//   3. Supabase 대시보드에서 pg_cron/pg_net 확장 활성화 후 019_billing.sql 맨 아래
//      주석 처리된 cron.schedule(...) 블록을 실제 project-ref/CRON_SECRET 값으로 채워
//      SQL Editor에서 실행 — 매일 1회 이 함수를 호출하도록 등록한다.
//
// "매달"이 아니라 "매일 체크"인 이유: 학원마다 next_billing_at이 제각각이라 이렇게 해야
// 자연스럽게 각자의 청구일에 맞춰 청구되고, 결제 실패 시에도 다음날 자동 재시도된다.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.109.0';
import { chargeAcademy } from '../_shared/portoneCharge.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const MAX_BILLING_FAILURES = 7;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });
}

function addOneMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
      throw new Error('unauthorized');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().slice(0, 10);
    const results: Array<{ academyId: string; outcome: string }> = [];

    // 관리자가 이벤트용으로 기한부 유료 전환한 학원(admin_set_academy_plan의 p_until) —
    // 카드도 청구도 없이 기한이 지나면 그냥 무료로 되돌린다.
    const { data: expiredComps, error: compError } = await supabaseAdmin
      .from('academies')
      .select('id')
      .eq('plan', 'paid')
      .not('plan_expires_at', 'is', null)
      .lte('plan_expires_at', today);
    if (compError) throw new Error(compError.message);

    for (const academy of expiredComps ?? []) {
      await supabaseAdmin
        .from('academies')
        .update({ plan: 'free', plan_status: 'active', plan_expires_at: null, next_billing_at: null, billing_failure_count: 0 })
        .eq('id', academy.id);
      results.push({ academyId: academy.id, outcome: 'admin_comp_expired' });
    }

    const { data: dueAcademies, error: dueError } = await supabaseAdmin
      .from('academies')
      .select('id, plan_status, billing_failure_count')
      .eq('plan', 'paid')
      .lte('next_billing_at', today);
    if (dueError) throw new Error(dueError.message);

    for (const academy of dueAcademies ?? []) {
      try {
        if (academy.plan_status === 'pending_cancel') {
          await supabaseAdmin
            .from('academies')
            .update({ plan: 'free', plan_status: 'active', next_billing_at: null, billing_failure_count: 0 })
            .eq('id', academy.id);
          results.push({ academyId: academy.id, outcome: 'downgraded_to_free' });
          continue;
        }

        const { data: keyRow, error: keyError } = await supabaseAdmin
          .from('academy_billing_keys')
          .select('billing_key, customer_uid')
          .eq('academy_id', academy.id)
          .maybeSingle();
        if (keyError) throw new Error(keyError.message);
        if (!keyRow) {
          results.push({ academyId: academy.id, outcome: 'no_billing_key' });
          continue;
        }

        const result = await chargeAcademy(supabaseAdmin, academy.id, keyRow.billing_key, keyRow.customer_uid);
        const nextBillingDate = addOneMonth(today);

        await supabaseAdmin.from('billing_history').insert({
          academy_id: academy.id,
          period_start: today,
          period_end: nextBillingDate,
          student_count: result.studentCount,
          amount_krw: result.amountKrw,
          status: result.success ? 'success' : 'failed',
          portone_payment_id: result.portonePaymentId ?? null,
          failure_reason: result.failureReason ?? null,
        });

        if (result.success) {
          await supabaseAdmin
            .from('academies')
            .update({ next_billing_at: nextBillingDate, billing_failure_count: 0 })
            .eq('id', academy.id);
          results.push({ academyId: academy.id, outcome: 'charged' });
        } else {
          const failureCount = (academy.billing_failure_count ?? 0) + 1;
          const forceFree = failureCount >= MAX_BILLING_FAILURES;
          await supabaseAdmin
            .from('academies')
            .update({
              billing_failure_count: failureCount,
              ...(forceFree ? { plan: 'free', plan_status: 'active', next_billing_at: null } : {}),
            })
            .eq('id', academy.id);
          results.push({ academyId: academy.id, outcome: forceFree ? 'failed_forced_free' : 'failed_will_retry' });
        }
      } catch (err) {
        results.push({ academyId: academy.id, outcome: `error: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
