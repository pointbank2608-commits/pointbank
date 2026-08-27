import { useState } from 'react';
import { Link } from 'react-router-dom';
import GameMusicPicker from '../components/GameMusicPicker';
import LadderBoard from '../components/LadderBoard';
import StudentRosterPicker from '../components/StudentRosterPicker';
import { updateGameTemplate } from '../lib/api';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, MusicSelection } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultParticipants(): GameItem[] {
  return ['참가자 1', '참가자 2', '참가자 3'].map((label) => ({ id: uid(), label }));
}

export default function LadderPage() {
  const g = useGameTemplates({
    gameType: 'ladder',
    defaultItems: defaultParticipants,
    defaultConfig: () => ({
      results: ['결과 1', '결과 2', '결과 3'].map((label) => ({ id: uid(), label })),
    }),
  });
  const {
    isStaff,
    academy,
    classes,
    staffClassId,
    selectClass,
    studentClassName,
    classId,
    roster,
    rosterScope,
    setRosterScope,
    rosterLoading,
    templates,
    setTemplates,
    selected,
    selectedId,
    setSelectedId,
    loading,
    showCreateForm,
    setShowCreateForm,
    submitting,
    newName,
    setNewName,
    newScope,
    setNewScope,
    handleCreate,
    handleRename,
    handleDeleteTemplate,
    scopeLabel,
    reload,
  } = g;

  const [editorOpen, setEditorOpen] = useState(false);
  const [newParticipant, setNewParticipant] = useState('');

  const results = selected?.config.results ?? selected?.items ?? [];

  async function persist(nextItems: GameItem[], nextResults: GameItem[]) {
    if (!selected) return;
    const nextConfig = { ...selected.config, results: nextResults };
    setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, items: nextItems, config: nextConfig } : t)));
    try {
      await updateGameTemplate(selected.id, { items: nextItems, config: nextConfig });
    } catch {
      await reload();
    }
  }

  async function addParticipant() {
    const label = newParticipant.trim();
    if (!label || !selected) return;
    await persist(
      [...selected.items, { id: uid(), label }],
      [...results, { id: uid(), label: `결과 ${results.length + 1}` }],
    );
    setNewParticipant('');
  }

  async function addParticipantsBulk(labels: string[]) {
    if (!selected || labels.length === 0) return;
    const newItems = labels.map((label) => ({ id: uid(), label }));
    const newResults = labels.map((_, i) => ({ id: uid(), label: `결과 ${results.length + i + 1}` }));
    await persist([...selected.items, ...newItems], [...results, ...newResults]);
  }

  async function removeParticipant(index: number) {
    if (!selected) return;
    await persist(
      selected.items.filter((_, i) => i !== index),
      results.filter((_, i) => i !== index),
    );
  }

  async function clearAllParticipants() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm('참가자와 결과를 전부 삭제할까요?')) return;
    await persist([], []);
  }

  async function renameResult(index: number) {
    if (!selected) return;
    const next = prompt('결과 라벨을 입력하세요', results[index]?.label ?? '');
    if (next == null || !next.trim()) return;
    await persist(
      selected.items,
      results.map((r, i) => (i === index ? { ...r, label: next.trim() } : r)),
    );
  }

  async function resetResultsToParticipants() {
    if (!selected) return;
    await persist(
      selected.items,
      selected.items.map((it) => ({ id: uid(), label: it.label })),
    );
  }

  async function handleMusicChange(music: MusicSelection | null) {
    if (!selected) return;
    const nextConfig = { ...selected.config, music };
    setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, config: nextConfig } : t)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  if (isStaff && classes.length === 0) {
    return <div className="empty-hint">등록된 반이 없습니다. 설정에서 반을 추가해 주세요.</div>;
  }
  if (!isStaff && !classId) {
    return <div className="empty-hint">불러오는 중…</div>;
  }

  return (
    <>
      <Link to="/games" className="back-link">
        ← 게임 목록
      </Link>

      {isStaff ? (
        <div className="class-tabs">
          {classes.map((c) => (
            <button
              key={c.id}
              className={`class-tab ${c.id === staffClassId ? 'active' : ''}`}
              onClick={() => selectClass(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="section-title">{studentClassName} 사다리타기</div>
      )}

      {loading ? (
        <div className="empty-hint">불러오는 중…</div>
      ) : (
        <>
          <div className="wheel-template-row">
            {templates.map((t) => (
              <button
                key={t.id}
                className={`wheel-chip ${t.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(t.id)}
              >
                {t.name}
                <span className="wheel-chip-scope">{scopeLabel(t)}</span>
              </button>
            ))}
            {isStaff && (
              <button className="wheel-chip add" onClick={() => setShowCreateForm((v) => !v)}>
                + 새 사다리
              </button>
            )}
          </div>

          {isStaff && showCreateForm && (
            <div className="settings-block wheel-create-form">
              <div className="field-row">
                <label htmlFor="lname">이름</label>
                <input
                  id="lname"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 청소 당번 뽑기"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreate();
                  }}
                />
              </div>
              <div className="field-row">
                <label>공개 범위</label>
                <div className="scope-toggle">
                  <button type="button" className={newScope === 'class' ? 'active' : ''} onClick={() => setNewScope('class')}>
                    이 반에서만
                  </button>
                  <button
                    type="button"
                    className={newScope === 'academy' ? 'active' : ''}
                    onClick={() => setNewScope('academy')}
                  >
                    학원 전체 공용
                  </button>
                </div>
              </div>
              <div className="field-row">
                <button onClick={() => void handleCreate()} disabled={submitting}>
                  {submitting ? '만드는 중…' : '만들기'}
                </button>
                <button className="ghost" onClick={() => setShowCreateForm(false)}>
                  취소
                </button>
              </div>
            </div>
          )}

          {!selected ? (
            <div className="empty-hint">
              {isStaff ? '아직 사다리가 없습니다. "+ 새 사다리"로 만들어 주세요.' : '아직 선생님이 만든 사다리가 없습니다.'}
            </div>
          ) : (
            <>
              {academy && (
                <GameMusicPicker
                  academyId={academy.id}
                  isStaff={isStaff}
                  value={selected.config.music}
                  onChange={(m) => void handleMusicChange(m)}
                />
              )}

              <LadderBoard participants={selected.items} results={results} music={selected.config.music} />

              {isStaff && (
                <div className="settings-block" style={{ marginTop: 22 }}>
                  <div className="wheel-editor-head">
                    <h4 style={{ margin: 0 }}>참가자 · 결과 편집</h4>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="linkish dark" onClick={() => void handleRename()}>
                        이름 변경
                      </button>
                      <button className="linkish dark" onClick={() => void handleDeleteTemplate()}>
                        삭제
                      </button>
                      <button className="linkish dark" onClick={() => setEditorOpen((v) => !v)}>
                        {editorOpen ? '접기' : '펼치기'}
                      </button>
                    </div>
                  </div>

                  {editorOpen && (
                    <div className="ladder-editor-cols">
                      <div>
                        <div className="hint">참가자 (위)</div>
                        <StudentRosterPicker
                          roster={roster}
                          existingLabels={selected.items.map((i) => i.label)}
                          scope={rosterScope}
                          onScopeChange={setRosterScope}
                          loading={rosterLoading}
                          onAdd={(labels) => void addParticipantsBulk(labels)}
                        />
                        <div className="tag-list">
                          {selected.items.map((item, i) => (
                            <div className="tag" key={item.id}>
                              {item.label}
                              <button onClick={() => void removeParticipant(i)}>✕</button>
                            </div>
                          ))}
                        </div>
                        {selected.items.length > 0 && (
                          <button type="button" className="link-danger" onClick={() => void clearAllParticipants()}>
                            전체 삭제
                          </button>
                        )}
                        <div className="preset-add-row">
                          <input
                            type="text"
                            placeholder="새 참가자"
                            value={newParticipant}
                            onChange={(e) => setNewParticipant(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void addParticipant();
                            }}
                          />
                          <button onClick={() => void addParticipant()}>추가</button>
                        </div>
                      </div>
                      <div>
                        <div className="hint">결과 (아래) — 눌러서 수정</div>
                        <div className="tag-list">
                          {results.map((r, i) => (
                            <button key={r.id} type="button" className="tag tag-editable" onClick={() => void renameResult(i)}>
                              {r.label}
                            </button>
                          ))}
                        </div>
                        <button className="linkish dark" onClick={() => void resetResultsToParticipants()}>
                          결과를 참가자 이름과 동일하게
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
