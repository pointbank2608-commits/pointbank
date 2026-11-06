import { useState } from 'react';
import { grammarAdminSummary, grammarNotReady, type GrammarAggregate } from '../../lib/grammarServer';

export default function GrammarResultsPanel() {
  const [rows, setRows] = useState<GrammarAggregate[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setBusy(true); setError('');
    try { setRows(await grammarAdminSummary()); }
    catch (err) { setError(grammarNotReady(err) ? '문법 결과 서버를 준비 중이에요.' : '문법 결과를 불러오지 못했어요.'); }
    finally { setBusy(false); }
  }
  return <section lang="ko" className="space-y-3 rounded-xl border border-outline-variant p-4">
    <h3 className="font-bold">문법 학습 결과 · 최근 30일 배정</h3>
    <button type="button" disabled={busy} onClick={() => void load()} className="min-h-11 rounded-lg border px-4">
      {busy ? '조회 중…' : '문법 결과 조회'}
    </button>
    {error && <p role="alert">{error}</p>}
    {rows && (rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr>{['목표 · 버전','배정','첫 이유 확인 정답/응답','보충 후 정답/응답','직후 정답/응답','지연 확인'].map(title => <th className="p-2" key={title}>{title}</th>)}</tr></thead>
      <tbody>{rows.map(r => <tr key={`${r.goalId}:${r.version}:${r.mode}`}>
        <td className="p-2">{r.title} · v{r.version} · {r.mode === 'homework' ? '숙제' : '개별수업'}</td>
        <td className="p-2">{r.assigned}</td><td className="p-2">{r.reasoningCorrect}/{r.reasoningAnswered}</td>
        <td className="p-2">{r.practiceCorrect}/{r.practiceAnswered}</td><td className="p-2">{r.transferCorrect}/{r.transferAnswered}</td>
        <td className="p-2">정답 {r.reviewCorrect} · 오답 {r.reviewWrong} · 미응답 {r.reviewMissing} · 예정 전 {r.reviewWaiting} · 미예약 {r.reviewUnscheduled} · 제외 {r.excluded}</td>
      </tr>)}</tbody>
    </table></div> : <p>해당 기간 문법 배정이 없어요.</p>)}
  </section>;
}
