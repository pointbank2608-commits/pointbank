import { useMemo, useState } from 'react';
import { GRAMMAR_POINTS, grammarLevelTag } from '../../lib/grammar';
import { detectiveCases } from '../../lib/grammarGames';
import { MIN_ROUNDS } from '../../lib/grammarGamesB';
import { adventureId, type DetectiveCase } from '../../lib/adventureGames';

/** 문법 탐정 편집: 문법 항목의 "틀리기 쉬운 것"·워크북 오류 고치기로 사건집을 한꺼번에 가져온다. */
export default function GrammarCasePicker({ existing, onAdd }: { existing: DetectiveCase[]; onAdd: (cases: DetectiveCase[]) => void }) {
  const options = useMemo(() => GRAMMAR_POINTS.filter((p) => detectiveCases(p.id).length >= MIN_ROUNDS.detective), []);
  const [id, setId] = useState('');
  const [msg, setMsg] = useState('');
  function add() {
    const have = new Set(existing.map((c) => c.incorrect.trim()));
    const fresh = detectiveCases(id).filter((c) => !have.has(c.incorrect.trim())).map((c) => ({ ...c, id: adventureId(), errors: c.errors.map((e) => ({ ...e, id: adventureId() })) }));
    onAdd(fresh);
    setMsg(fresh.length ? `사건 ${fresh.length}개를 담았어요. 오류 범위와 해설을 확인해 보세요.` : '이미 담긴 사건이에요.');
  }
  return (
    <div className="ad-edit-card">
      <strong>문법 항목에서 사건 가져오기</strong>
      <div className="ad-edit-row">
        <label>문법 항목
          <select value={id} onChange={(e) => { setId(e.target.value); setMsg(''); }}>
            <option value="">선택하세요</option>
            {options.map((p) => <option key={p.id} value={p.id}>{grammarLevelTag(p)} · {p.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={!id} onClick={add}>사건 담기</button>
      </div>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
