// Supabase Edge Function (Deno) — 주간 운영 리포트 메일(2026-10-16, 관리자 자동화 1단계).
//
// 매주 월요일 아침 관리자(ADMIN_EMAIL)에게 지난주 요약 한 통을 보낸다: 가입·활성·이탈 위험·문의 주제·오류 Top.
// 개인정보(학생 이름·학원 이름·이메일)는 담지 않고 숫자와 오류 문구만 보낸다.
//
// 준비(한 번만):
//   1. SQL: supabase/078d_admin_weekly_report.sql 실행 (admin_weekly_report 함수)
//   2. npx supabase functions deploy weekly-report --no-verify-jwt
//   3. npx supabase secrets set CRON_SECRET=... (charge-subscriptions 와 같은 값 가능)
//      RESEND_API_KEY / RESEND_FROM / ADMIN_EMAIL / SITE_URL 은 notify 함수와 같은 시크릿을 쓴다.
//   4. 078e_ops_health_tick.sql 맨 아래 주석의 cron.schedule('weekly-report', ...) 를 값 채워 실행
//      (월요일 09:00 KST = 월요일 00:00 UTC). 바로 확인하려면 x-cron-secret 헤더로 직접 호출.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.109.0';

interface Report {
  academies: number;
  signups_7d: number;
  signups_prev_7d: number;
  active_7d: number;
  paid: number;
  stuck_no_wordlist: number;
  dormant_paid: number;
  tickets_new_7d: number;
  tickets_open: number;
  oldest_open_hours: number;
  tickets_by_category: Record<string, number>;
  top_errors: Array<{ message: string; events: number; users: number }>;
}

const CATEGORY_LABEL: Record<string, string> = {
  howto: '사용법',
  bug: '오류',
  billing: '결제',
  idea: '아이디어',
  other: '기타',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function delta(now: number, prev: number): string {
  const d = now - prev;
  return d === 0 ? '(지난주와 같음)' : d > 0 ? `(지난주보다 +${d})` : `(지난주보다 ${d})`;
}

function buildText(r: Report, site: string): string {
  const cats = Object.entries(r.tickets_by_category)
    .map(([k, n]) => `${CATEGORY_LABEL[k] ?? k} ${n}`)
    .join(' · ');
  const errors = r.top_errors.length
    ? r.top_errors.map((e, i) => `  ${i + 1}. ${e.message} — ${e.events}회 / ${e.users}명`).join('\n')
    : '  없음';
  const todo: string[] = [];
  if (r.tickets_open > 0) todo.push(`답변 대기 문의 ${r.tickets_open}건 (가장 오래된 것 ${r.oldest_open_hours}시간 경과)`);
  if (r.stuck_no_wordlist > 0) todo.push(`가입했지만 단어장을 안 만든 학원 ${r.stuck_no_wordlist}곳`);
  if (r.dormant_paid > 0) todo.push(`14일 넘게 안 들어온 유료 학원 ${r.dormant_paid}곳`);
  if (r.top_errors.length > 0) todo.push('오류 Top 확인');

  return [
    '클래스뱅크 주간 운영 리포트',
    '',
    `■ 가입  ${r.signups_7d}곳 ${delta(r.signups_7d, r.signups_prev_7d)}  / 전체 ${r.academies}곳`,
    `■ 활성  최근 7일 접속 ${r.active_7d}곳 / 유료 ${r.paid}곳`,
    `■ 문의  새로 ${r.tickets_new_7d}건 ${cats ? `(${cats})` : ''}`,
    '',
    '■ 오류 Top 5 (지난 7일)',
    errors,
    '',
    '■ 이번 주 할 일',
    todo.length ? todo.map((t) => `  - ${t}`).join('\n') : '  특별히 없어요.',
    '',
    `관리자 화면: ${site}/admin`,
  ].join('\n');
}

Deno.serve(async (req: Request) => {
  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await admin.rpc('admin_weekly_report');
    if (error) throw new Error(error.message);

    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!adminEmail || !resendKey) throw new Error('ADMIN_EMAIL 또는 RESEND_API_KEY 가 없어요.');

    const site = Deno.env.get('SITE_URL') ?? 'https://pointbank-ten.vercel.app';
    const text = buildText(data as Report, site);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM') ?? '클래스뱅크 <onboarding@resend.dev>',
        to: [adminEmail],
        subject: '[클래스뱅크] 주간 운영 리포트',
        text,
      }),
    });
    if (!res.ok) throw new Error(`메일 보내기 실패: ${res.status} ${await res.text()}`);
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
