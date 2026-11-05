import { useState } from 'react';
import LearningRunCoverage from './LearningRunCoverage';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { sensorsEnabled, sensorHealth } from '../../lib/learningSensors/api';

interface Summary {
  days: number;
  sources: { source: string; events: number; students: number; shown: number; visible_ms: number; input_recent_ms: number; last_received_at: string }[];
  evidence: { source: string; responses: number; first_responses: number; first_correct: number; help_unknown: number }[];
}
export default function LearningSensorsPanel() {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const l = (ko: string, english: string) => en ? english : ko;
  const [data, setData] = useState<Summary | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'missing' | 'error'>('idle');
  const local = sensorHealth();
  async function load() {
    setStatus('loading');
    try {
      const { data: result, error } = await supabase.rpc('admin_learning_sensor_summary', { p_days: 7 });
      if (error) { setStatus(error.code === 'PGRST202' || error.code === '42883' ? 'missing' : 'error'); return; }
      setData(result as Summary); setStatus('idle');
    } catch { setStatus('error'); }
  }
  return <section className="space-y-3" aria-labelledby="learning-sensors-title">
    <h2 id="learning-sensors-title" className="text-[22px] font-bold">{l('학습 센서 수집 상태', 'Learning sensor coverage')}</h2>
    <p className="text-sm text-on-surface-variant">{l('이 앱 빌드의 신규 수집', 'Collection in this build')}: {sensorsEnabled() ? l('켜짐', 'enabled') : l('꺼짐', 'disabled')} · {l('최근 7일 · 운영자 전용', 'Last 7 days · platform admin only')}</p>
    <p className="text-sm text-on-surface-variant">{l('화면 노출 시간은 집중 시간이나 학습 효과가 아닙니다. 첫 답 집계는 난도를 보정한 능력·기억률이 아닙니다. 도움 미상은 도움 없음으로 계산하지 않습니다.', 'Visible time is not attention or effectiveness. First-response counts are not difficulty-adjusted ability or retention. Unknown help is not no help.')}</p>
    <button type="button" disabled={status === 'loading'} onClick={() => void load()} className="min-h-11 rounded-lg border border-outline-variant px-4 font-bold disabled:opacity-50">{l('수집 상태 조회', 'Load coverage')}</button>
    <div role="status" className="text-sm">
      {status === 'loading' && l('조회 중…', 'Loading…')}
      {status === 'missing' && l('학습 센서 DB가 아직 준비되지 않았습니다. 097 적용 여부를 확인하세요.', 'Sensor database is not ready. Check migration 097.')}
      {status === 'error' && l('조회하지 못했습니다. 권한 또는 연결 상태를 확인하세요. 이전 결과는 갱신되지 않았습니다.', 'Unable to load. Check permissions or connection. Previous results have not been refreshed.')}
    </div>
    {data && <div className="space-y-3 overflow-x-auto rounded-xl border border-outline-variant p-4">
      {!data.sources.length && <p>{l('해당 기간에 수집된 활동 센서가 없습니다. 학습하지 않았다는 의미는 아닙니다.', 'No activity telemetry in this period. This does not mean students did not learn.')}</p>}
      <table className="w-full text-left text-sm"><caption className="mb-2 text-left font-bold">{l('활동 센서 · 클라이언트 관찰', 'Activity telemetry · client-reported')}</caption><thead><tr>
        {[l('경로','Source'),l('이벤트','Events'),l('학생','Students'),l('노출 분','Visible minutes')].map(x => <th key={x} className="p-2">{x}</th>)}
      </tr></thead><tbody>{data.sources.map(s => <tr key={s.source}><td className="p-2">{s.source}</td><td className="p-2">{s.events}</td><td className="p-2">{s.source === 'group' ? '—' : s.students}</td><td className="p-2">{Math.round(s.visible_ms / 6000) / 10}</td></tr>)}</tbody></table>
      <table className="w-full text-left text-sm"><caption className="mb-2 text-left font-bold">{l('기존 서버 채점 근거 · 전체 대상의 평가 참여율은 아직 계산하지 않음', 'Existing server-graded evidence · assessment participation denominator not yet available')}</caption><thead><tr>
        {[l('경로','Source'),l('첫 답','First responses'),l('첫 답 정답','First correct'),l('도움 미상 응답','Responses with unknown help')].map(x => <th key={x} className="p-2">{x}</th>)}
      </tr></thead><tbody>{data.evidence.map(s => <tr key={s.source}><td className="p-2">{s.source}</td><td className="p-2">{s.first_responses}</td><td className="p-2">{s.first_correct}</td><td className="p-2">{s.help_unknown}</td></tr>)}</tbody></table>
    </div>}
    <LearningRunCoverage/>
    {!!local.length && <p className="text-sm">{l('이 브라우저의 수집기', 'Collectors in this browser')}: {local.map((h,i) => `${i+1}: ${h.state}, pending=${h.pending}, dropped=${h.dropped}`).join(' / ')}</p>}
  </section>;
}
