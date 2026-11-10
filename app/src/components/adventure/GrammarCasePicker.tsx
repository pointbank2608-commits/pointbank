import { useMemo, useState } from 'react';
import { GRAMMAR_POINTS, grammarLevelTag } from '../../lib/grammar';
import { detectiveCases } from '../../lib/grammarGames';
import { MIN_ROUNDS } from '../../lib/grammarGamesB';
import { adventureId, type DetectiveCase } from '../../lib/adventureGames';

/** Prepares a deck from the selected grammar point for the settings Apply action. */
export default function GrammarCasePicker({ onSelect }: { onSelect: (cases: DetectiveCase[]) => void }) {
  const options = useMemo(() => GRAMMAR_POINTS.filter((p) => detectiveCases(p.id).length >= MIN_ROUNDS.detective), []);
  const [id, setId] = useState('');
  const [msg, setMsg] = useState('');
  function select(nextId: string) {
    const cases = detectiveCases(nextId).map((item) => ({
      ...item,
      id: adventureId(),
      errors: item.errors.map((error) => ({ ...error, id: adventureId() })),
    }));
    if (!cases.length) return;
    setId(nextId);
    onSelect(cases);
    setMsg(`이 문법의 문제 ${cases.length}개를 가져왔어요. ‘적용’을 눌러 게임에 반영하세요.`);
  }
  return (
    <div className="ad-edit-card">
      <strong>문법 항목에서 사건 가져오기</strong>
      <div className="ad-edit-row">
        <label>문법 항목
          <select aria-label="문법 항목" value={id} onChange={(e) => select(e.target.value)}>
            <option value="" disabled>선택하세요</option>
            {options.map((p) => <option key={p.id} value={p.id}>{grammarLevelTag(p)} · {p.name}</option>)}
          </select>
        </label>
      </div>
      <p>문법 항목을 고르면 이번 게임의 문제 목록을 해당 문법 문제로 바꿔요.</p>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
