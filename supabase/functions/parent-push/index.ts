import { createClient } from 'npm:@supabase/supabase-js@2.109.0';
import webPush from 'npm:web-push@3.6.7';
import { timingSafeEqual } from 'node:crypto';
import { parentPushBody, type ParentPushEvent } from '../_shared/parentPushNotice.ts';

type Job = {
  id: string; session_id: string; tries: number; endpoint: string; p256dh: string; auth_key: string;
  thread_id?: string; class_id?: string; lang: 'ko' | 'en'; event: ParentPushEvent;
};
const allowed = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']);
const encode = (value: string) => new TextEncoder().encode(value);

Deno.serve(async (req) => {
  const hook = encode(Deno.env.get('PARENT_PUSH_CRON_SECRET') ?? '');
  const provided = encode(req.headers.get('x-cron-secret') ?? '');
  if (req.method !== 'POST' || hook.length < 32 || hook.length !== provided.length || !timingSafeEqual(hook, provided)) {
    return new Response(null, { status: 403 });
  }
  const publicKey = Deno.env.get('PARENT_PUSH_PUBLIC_KEY');
  const privateKey = Deno.env.get('PARENT_PUSH_PRIVATE_KEY');
  const subject = Deno.env.get('PARENT_PUSH_SUBJECT');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!publicKey || !privateKey || !subject || !url || !serviceKey) {
    return new Response('Push configuration is incomplete', { status: 503 });
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc('inquiry_claim_push');
  if (error) return new Response('Queue unavailable', { status: 503 });
  const jobs = data as Job[];
  let failed = 0;
  for (let i = 0; i < jobs.length; i += 10) {
    await Promise.all(jobs.slice(i, i + 10).map(async (job) => {
      let result = 'retry';
      try {
        const endpoint = new URL(job.endpoint);
        if (endpoint.protocol !== 'https:' || endpoint.port || endpoint.username || endpoint.password || !allowed.has(endpoint.hostname)) {
          result = 'discard';
        } else {
          const body = parentPushBody(job.event, job.lang);
          if (!body) throw new Error('Unknown parent notification event');
          const payload = JSON.stringify({
            title: job.event === 'inquiry' ? (job.lang === 'en' ? 'ClassBank' : '수업뚝딱 교사용')
              : job.lang === 'en' ? 'ClassBank for parents' : '수업뚝딱 학부모',
            thread: job.thread_id, classId: job.class_id,
            body,
            tag: job.id,
            child: job.session_id,
          });
          const request = webPush.generateRequestDetails({
            endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth_key },
          }, payload, { vapidDetails: { subject, publicKey, privateKey }, TTL: 3600, urgency: 'normal' });
          // Do not allow a push service to redirect the request to another host.
          const response = await fetch(request.endpoint, {
            method: 'POST', headers: new Headers(request.headers as Record<string, string>),
            body: new Uint8Array(request.body), redirect: 'error', signal: AbortSignal.timeout(7000),
          });
          await response.body?.cancel();
          if (response.ok) result = 'sent';
          else if (response.status === 404 || response.status === 410) result = 'gone';
          else if (response.status === 400 || response.status === 413) result = 'discard';
        }
      } catch {
        // No endpoint, subscription key or payload belongs in logs.
      }
      if (result === 'retry') failed++;
      else {
        const { error: finishError } = await db.rpc(job.event === 'inquiry' ? 'teacher_finish_inquiry_push' : 'parent_finish_push', { p_id: job.id, p_try: job.tries, p_result: result });
        if (finishError) failed++;
      }
    }));
  }
  return Response.json({ claimed: jobs.length, retrying: failed });
});
