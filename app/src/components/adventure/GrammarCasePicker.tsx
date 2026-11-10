import { useMemo, useState } from 'react';
import { GRAMMAR_POINTS, grammarLevelTag } from '../../lib/grammar';
import { detectiveCases } from '../../lib/grammarGames';
import { MIN_ROUNDS } from '../../lib/grammarGamesB';
import { adventureId, type DetectiveCase } from '../../lib/adventureGames';

/** Prepares a deck from the selected grammar point for the settings Apply action. */
export default function GrammarCasePicker({ onSelect, selectedForGame }: { onSelect: (cases: DetectiveCase[]) => void; selectedForGame: boolean }) {
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
    <details className="ad-detective-authoring">
      <summary>클래스뱅크 기본 문제로 바꾸기</summary>
      <div className="ad-detective-authoring-body">
        <p>주제를 고르면 클래스뱅크가 미리 만든 문제로 이번 게임의 문제 목록을 교체해요.</p>
        <label>기본 문제 주제
          <select aria-label="기본 문제 주제" value={selectedForGame?id:''} onChange={(e) => select(e.target.value)}>
            <option value="" disabled>선택하세요</option>
            {options.map((p) => <option key={p.id} value={p.id}>{grammarLevelTag(p)} · {p.name}</option>)}
          </select>
        </label>
        {msg && selectedForGame && <p role="status">{msg}</p>}
      </div>
    </details>
  );
}
