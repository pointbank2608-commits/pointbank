// Supabase Edge Function (Deno) — 자동 메일 알림(2026-09-27).
//
// Supabase "Database Webhooks"(대시보드 → Database → Webhooks)가 표에 행이 생기거나 바뀔 때 이 함수를 부른다:
//   - support_messages INSERT
//       · 선생님이 문의·추가 메시지를 보내면 → 관리자(ADMIN_EMAIL)에게 "새 문의" 메일
//       · 관리자가 답하면 → 그 선생님에게 "답변이 도착했어요" 메일
//   - academies UPDATE
//       · 결제 실패 횟수(billing_failure_count)가 늘면 → 관리자에게 "결제 실패" 메일
//
// 준비(한 번만):
//   1. https://resend.com 가입 → API Key 만들기(보내는 주소 도메인을 인증하면 RESEND_FROM 에 그 주소를,
//      아니면 테스트용 onboarding@resend.dev 는 내 메일로만 보낼 수 있다).
//   2. npx supabase secrets set RESEND_API_KEY=re_xxx NOTIFY_SECRET=아무_긴_문자열 ADMIN_EMAIL=likesea85@gmail.com \
//        RESEND_FROM="클래스뱅크 <noreply@내도메인>" SITE_URL=https://pointbank-ten.vercel.app
//   3. npx supabase functions deploy notify --no-verify-jwt
//   4. 대시보드 → Database → Webhooks → Create: 표 support_messages(Insert), academies(Update) 각각,
//      Type = HTTP Request, URL = https://<project-ref>.supabase.co/functions/v1/notify,
//      HTTP Headers 에 x-notify-secret: (2번의 NOTIFY_SECRET 값) 추가.
// 메일 내용에는 학생 개인정보를 넣지 않는다(문의 내용 앞부분과 링크만).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.109.0';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

function ok(body: unknown = { ok: true }, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function sendMail(to: string, subject: string, text: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY 가 없어요.');
  const from = Deno.env.get('RESEND_FROM') ?? '클래스뱅크 <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`메일 보내기 실패: ${res.status} ${await res.text()}`);
}

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('NOTIFY_SECRET');
  if (!secret || req.headers.get('x-notify-secret') !== secret) return ok({ error: 'unauthorized' }, 401);

  try {
    const payload = (await req.json()) as WebhookPayload;
    const rec = payload.record ?? {};
    const site = Deno.env.get('SITE_URL') ?? 'https://pointbank-ten.vercel.app';
    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 1) 문의 메시지
    if (payload.table === 'support_messages' && payload.type === 'INSERT') {
      const { data: ticket } = await admin
        .from('support_tickets')
        .select('id, subject, category, user_id, academy_id, academies(name)')
        .eq('id', rec.ticket_id as string)
        .single();
      if (!ticket) return ok({ skipped: 'no ticket' });
      const preview = String(rec.body ?? '').slice(0, 500);
      const academyName = (ticket as unknown as { academies?: { name?: string } }).academies?.name ?? '';

      if (rec.sender === 'user' && adminEmail) {
        await sendMail(
          adminEmail,
          `[클래스뱅크 문의] ${academyName} · ${ticket.subject}`,
          `${academyName}에서 문의가 왔어요.\n\n유형: ${ticket.category}\n제목: ${ticket.subject}\n\n${preview}\n\n답변하기: ${site}/admin/support?ticket=${ticket.id}`,
        );
        return ok({ sent: 'admin' });
      }
      if (rec.sender === 'admin') {
        const { data: u } = await admin.auth.admin.getUserById(ticket.user_id as string);
        const to = u.user?.email;
        if (!to) return ok({ skipped: 'no email' });
        await sendMail(
          to,
          `[클래스뱅크] 문의에 답변이 도착했어요 · ${ticket.subject}`,
          `안녕하세요, 클래스뱅크입니다.\n\n남겨 주신 문의 "${ticket.subject}"에 답변을 드렸어요.\n\n${preview}\n\n답변 전체 보기·이어서 문의하기: ${site}/help?ticket=${ticket.id}`,
        );
        return ok({ sent: 'user' });
      }
      return ok({ skipped: 'sender' });
    }

    // 2) 결제 실패
    if (payload.table === 'academies' && payload.type === 'UPDATE' && adminEmail) {
      const now = Number(rec.billing_failure_count ?? 0);
      const before = Number(payload.old_record?.billing_failure_count ?? 0);
      if (now > before) {
        await sendMail(
          adminEmail,
          `[클래스뱅크 결제 실패] ${rec.name} (${now}회)`,
          `${rec.name} 학원의 정기 결제가 실패했어요(누적 ${now}회).\n\n학원 보기: ${site}/admin/academies/${rec.id}`,
        );
        return ok({ sent: 'billing' });
      }
    }
    return ok({ skipped: true });
  } catch (err) {
    return ok({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
