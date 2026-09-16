// Supabase Edge Function (Deno) — 구독 해지/해지 취소.
// 배포 방법은 register-billing-key/index.ts 상단 주석과 동일(`npx supabase functions deploy
// cancel-billing`). 이 함수는 결제를 직접 하지 않고 plan_status만 바꾼다 — 실제 무료
// 전환·해지는 charge-subscriptions가 다음 결제일에 처리한다(이미 낸 달은 그대로 이용).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.109.0';

interface CancelRequest {
  action: 'cancel' | 'resume';
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
    const { action } = (await req.json()) as CancelRequest;
    if (action !== 'cancel' && action !== 'resume') throw new Error('action은 cancel 또는 resume이어야 해요.');

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    if (profile.role !== 'owner') throw new Error('구독 해지는 원장님만 할 수 있어요.');

    const { data: academy, error: academyError } = await supabaseAsCaller
      .from('academies')
      .select('plan')
      .eq('id', profile.academy_id)
      .maybeSingle();
    if (academyError) throw new Error(academyError.message);
    if (academy?.plan !== 'paid') throw new Error('유료 플랜이 아니에요.');

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    await supabaseAdmin
      .from('academies')
      .update({ plan_status: action === 'cancel' ? 'pending_cancel' : 'active' })
      .eq('id', profile.academy_id);

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
