// 원장만 구독 조건 조회, 구독 시작, 기존 구독의 카드 변경을 할 수 있다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.109.0';
import { chargeAcademy, MONTHLY_SUBSCRIPTION_KRW, requireIssuedBillingKey } from '../_shared/portoneCharge.ts';

type SubscriptionRequest =
  | { action: 'quote' }
  | { action: 'start-subscription'; billingKey: string; firstChargeOn: string; amountKrw: number }
  | { action: 'change-card'; billingKey: string };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });
}

function nextMonth(date: string): string {
  const result = new Date(`${date}T00:00:00Z`);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'POST 요청이 필요해요.' }, 405);

  try {
    const request = (await req.json()) as SubscriptionRequest | null;
    if (request?.action !== 'quote' && request?.action !== 'start-subscription' && request?.action !== 'change-card') {
      throw new Error('구독 시작 또는 카드 변경을 선택해 주세요.');
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAsCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseAsCaller.auth.getUser();
    if (!user) throw new Error('로그인이 필요해요.');

    const { data: profile, error: profileError } = await supabaseAsCaller
      .from('profiles').select('academy_id, role').eq('id', user.id).maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile?.academy_id || profile.role !== 'owner') throw new Error('결제 관리는 원장님만 할 수 있어요.');

    const academyId = profile.academy_id as string;
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: academy, error: academyError } = await admin.from('academies')
      .select('plan, next_billing_at, trial_ends_at').eq('id', academyId).single();
    if (academyError) throw new Error(academyError.message);

    // 수동 부여된 유료 권한에는 다음 청구일이 없다. 기존 구독은 플랜 출처가 없는 오래된 기록도 지원한다.
    const subscribed = academy.plan === 'paid' && !!academy.next_billing_at;
    if (request.action === 'change-card') {
      if (!subscribed) throw new Error('먼저 구독을 시작해 주세요.');
      if (typeof request.billingKey !== 'string' || !request.billingKey.trim()) throw new Error('카드 등록 정보가 필요해요.');
      await requireIssuedBillingKey(request.billingKey);
      const { error } = await admin.from('academy_billing_keys').upsert({
        academy_id: academyId, billing_key: request.billingKey, customer_uid: academyId, updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }
    if (subscribed) throw new Error('이미 구독 중이에요.');

    const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
    let firstChargeOn = today;
    if (academy.plan === 'free' && academy.trial_ends_at && academy.trial_ends_at >= today) {
      const end = new Date(`${academy.trial_ends_at}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      firstChargeOn = end.toISOString().slice(0, 10);
    }
    const chargeNow = firstChargeOn === today;
    if (request.action === 'quote') return json({ ok: true, firstChargeOn, amountKrw: MONTHLY_SUBSCRIPTION_KRW, chargeNow });

    if (request.firstChargeOn !== firstChargeOn || request.amountKrw !== MONTHLY_SUBSCRIPTION_KRW) {
      return json({ error: '첫 결제 조건이 바뀌었어요. 금액과 날짜를 다시 확인해 주세요.' }, 409);
    }
    const { billingKey } = request;
    if (typeof billingKey !== 'string' || !billingKey.trim()) throw new Error('카드 등록 정보가 필요해요.');
    await requireIssuedBillingKey(billingKey);

    const nextChargeOn = chargeNow ? nextMonth(firstChargeOn) : firstChargeOn;
    const result = chargeNow ? await chargeAcademy(admin, academyId, billingKey, academyId, { dueDate: firstChargeOn, attempt: 1 }) : null;
    if (result && !result.success) {
      const { error } = await admin.from('billing_history').insert({
        academy_id: academyId,
        period_start: firstChargeOn,
        period_end: nextChargeOn,
        student_count: result.studentCount,
        amount_krw: MONTHLY_SUBSCRIPTION_KRW,
        status: 'failed',
        failure_reason: result.failureReason,
      });
      if (error) throw new Error(error.message);
      throw new Error(result.failureReason || '결제에 실패했어요.');
    }

    const { data: activated, error } = await admin.rpc('activate_monthly_subscription', {
      p_academy_id: academyId,
      p_billing_key: billingKey,
      p_first_charge_on: firstChargeOn,
      p_next_charge_on: nextChargeOn,
      p_student_count: result?.studentCount ?? 0,
      p_amount_krw: MONTHLY_SUBSCRIPTION_KRW,
      p_paid_payment_id: result?.portonePaymentId ?? null,
    });
    if (error) throw new Error(error.message);
    if (!activated) throw new Error('이미 구독 중이에요.');

    return json({ ok: true, scheduled: chargeNow ? null : firstChargeOn });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
