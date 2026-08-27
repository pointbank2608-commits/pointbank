import { useState } from 'react';
import type { GameItem } from '../lib/types';
import type { RosterScope } from '../lib/useGameTemplates';

interface Props {
  roster: GameItem[];
  existingLabels: string[];
  scope: RosterScope;
  onScopeChange: (s: RosterScope) => void;
  loading: boolean;
  onAdd: (labels: string[]) => void;
}

/**
 * 게임 참가자를 매번 직접 입력하지 않도록, 이 반/학원 전체 학생 명단에서 클릭 한 번으로
 * 추가할 수 있게 해주는 공통 패널. 돌림판·사다리·순서정하기가 모두 같이 쓴다.
 */
export default function StudentRosterPicker({ roster, existingLabels, scope, onScopeChange, loading, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const existingSet = new Set(existingLabels);
  const remaining = roster.filter((s) => !existingSet.has(s.label));

  return (
    <div className="roster-picker">
      <button
        type="button"
        className={`roster-toggle-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="roster-toggle-emoji">👦👧</span>
        {open ? '학생 명단 닫기' : '학생 명단에서 추가'}
      </button>

      {open && (
        <div className="roster-picker-panel">
          <div className="scope-toggle">
            <button type="button" className={scope === 'class' ? 'active' : ''} onClick={() => onScopeChange('class')}>
              이 반
            </button>
            <button type="button" className={scope === 'academy' ? 'active' : ''} onClick={() => onScopeChange('academy')}>
              학원 전체
            </button>
          </div>

          {loading ? (
            <div className="roster-empty">불러오는 중…</div>
          ) : remaining.length === 0 ? (
            <div className="roster-empty">
              {roster.length === 0 ? '등록된 학생이 없습니다.' : '학생을 모두 추가했습니다.'}
            </div>
          ) : (
            <>
              <div className="roster-chip-list">
                {remaining.map((s) => (
                  <button key={s.id} type="button" className="roster-chip" onClick={() => onAdd([s.label])}>
                    + {s.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="roster-addall-btn"
                onClick={() => onAdd(remaining.map((s) => s.label))}
              >
                + 전체 추가 ({remaining.length}명)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
