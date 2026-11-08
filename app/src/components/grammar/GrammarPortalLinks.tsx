import { Link } from 'react-router-dom';
import type { GrammarAssignment } from '../../lib/grammarServer';

export default function GrammarPortalLinks({ rows }: { rows: GrammarAssignment[] }) {
  return <>{rows.map(row => <li key={row.assignmentId}>
    <Link to={`/s/grammar/${row.assignmentId}`} className="block rounded-2xl border border-[#d9d3c3] px-4 py-3">
      <strong className="block break-words">{row.title}</strong>
      <span className="block text-sm text-[#5b6580]">
        {row.status === 'waiting' && row.reviewDueAt ? `다음 확인 · ${new Date(row.reviewDueAt).toLocaleString()}`
          : row.status === 'finished' ? '복습까지 완료' : row.status === 'review_ready' ? '복습하기'
          : row.status === 'in_progress' ? '이어서 하기' : '문법 학습 시작'}
      </span>
      {row.status === 'assigned' && row.initialDueAt && <span className="block text-sm text-[#5b6580]">첫 학습 기한 · {new Date(row.initialDueAt).toLocaleString()}</span>}
    </Link>
  </li>)}</>;
}
