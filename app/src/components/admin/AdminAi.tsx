import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface AiJob {
  source_id: string;
  revision: string;
  state: 'pending' | 'running' | 'ready' | 'failed' | 'skipped';
  result: { summary?: string; possible_cause?: string; next_check?: string; draft?: string; review_note?: string } | null;
}

export function useAdminAiJobs(kind: 'error' | 'ticket', sourceId = '', enabled = true) {
  const [snapshot, setSnapshot] = useState<{ key: string; jobs: AiJob[]; unavailable: boolean } | null>(null);
  const key = `${kind}:${sourceId}`;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      const query = supabase.from('admin_ai_jobs').select('source_id,revision,state,result').eq('kind', kind);
      const result = await (sourceId ? query.eq('source_id', sourceId) : query.order('updated_at', { ascending: false }).limit(500));
      if (!active) return;
      setSnapshot({ key, jobs: (result.data ?? []) as AiJob[], unavailable: !!result.error });
      timer = setTimeout(() => void load(), 20_000);
    }
    void load();
    return () => { active = false; clearTimeout(timer); };
  }, [kind, sourceId, enabled, key]);

  return enabled && snapshot?.key === key ? snapshot : null;
}

function AiStatus({ job, ticket = false }: { job?: AiJob; ticket?: boolean }) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  if (!job || job.state === 'skipped') return null;
  if (job.state === 'failed') return <p className="text-sm text-error">{en ? 'AI generation failed.' : 'AI 생성에 실패했어요.'}</p>;
  if (job.state === 'ready') return null;
  return <p className="text-sm text-on-surface-variant">{ticket
    ? (en ? 'AI reply draft is queued.' : 'AI 답변 초안을 준비하고 있어요.')
    : (en ? 'AI error analysis is queued.' : 'AI 오류 분석을 준비하고 있어요.')}</p>;
}

export function AdminAiErrorAnalysis({ job }: { job?: AiJob }) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  if (job?.state !== 'ready' || !job.result) return <AiStatus job={job} />;
  return (
    <div className="mt-3 space-y-1 rounded-lg bg-surface-container-low p-3 text-sm text-on-surface">
      <p className="font-bold">{en ? 'AI analysis' : 'AI 분석'}</p>
      <p className="whitespace-pre-wrap break-words">{job.result.summary}</p>
      <p className="whitespace-pre-wrap break-words"><strong>{en ? 'Possible cause' : '원인 후보'}</strong> {job.result.possible_cause}</p>
      <p className="whitespace-pre-wrap break-words"><strong>{en ? 'What to check' : '다음 확인'}</strong> {job.result.next_check}</p>
    </div>
  );
}

export function AdminAiReplyDraft({ ticketId, latestUserMessageId, canApply, onApply }: {
  ticketId: string;
  latestUserMessageId: string;
  canApply: boolean;
  onApply: (text: string) => void;
}) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const snapshot = useAdminAiJobs('ticket', ticketId);
  const job = snapshot?.jobs.find((item) => item.revision === latestUserMessageId);
  if (snapshot?.unavailable) return <p className="text-sm text-on-surface-variant">{en ? 'AI draft is unavailable.' : 'AI 답변 초안을 불러올 수 없어요.'}</p>;
  if (job?.state !== 'ready' || !job.result?.draft) return <AiStatus job={job} ticket />;
  const { draft, review_note } = job.result;
  return (
    <details className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm">
      <summary className="cursor-pointer font-bold text-primary">{en ? 'Review AI reply draft' : 'AI 답변 초안 검토'}</summary>
      <p className="mt-2 whitespace-pre-wrap break-words">{draft}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-on-surface-variant"><strong>{en ? 'Review note' : '검토 메모'}</strong> {review_note}</p>
      <button type="button" onClick={() => onApply(draft)} disabled={!canApply} className="mt-3 rounded-full border border-primary px-3 py-1 font-bold text-primary disabled:opacity-40">
        {en ? 'Add to reply' : '답변 칸에 넣기'}
      </button>
      {!canApply && <p className="mt-1 text-on-surface-variant">{en ? 'The reply field already contains text.' : '답변 칸에 작성 중인 내용이 있어요.'}</p>}
    </details>
  );
}
