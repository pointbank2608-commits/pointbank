import { useState } from 'react';
import { Link } from 'react-router-dom';
import GameMusicPicker from '../components/GameMusicPicker';
import OrderPicker from '../components/OrderPicker';
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

function rankLabels(count: number, style: '등' | '번'): GameItem[] {
  return Array.from({ length: count }, (_, i) => ({ id: uid(), label: `${i + 1}${style}` }));
}

/** 저장된 순위 이름이 없거나(예전 템플릿) 참가자 수와 안 맞으면 "N등"으로 새로 채운다. */
function ranksFor(items: GameItem[], stored?: GameItem[]): GameItem[] {
  if (stored && stored.length === items.length) return stored;
  return rankLabels(items.length, '등');
}

export default function OrderPage() {
  const g = useGameTemplates({
    gameType: 'order',
    defaultItems: defaultParticipants,
    defaultConfig: () => ({ ranks: rankLabels(3, '등') }),
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

  const ranks = selected ? ranksFor(selected.items, selected.config.ranks) : [];

  async function persist(nextItems: GameItem[], nextRanks: GameItem[]) {
    if (!selected) return;
    const nextConfig = { ...selected.config, ranks: nextRanks };
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
      [...ranks, { id: uid(), label: `${ranks.length + 1}등` }],
    );
    setNewParticipant('');
  }

  async function addParticipantsBulk(labels: string[]) {
    if (!selected || labels.length === 0) return;
    await persist(
      [...selected.items, ...labels.map((label) => ({ id: uid(), label }))],
      [...ranks, ...labels.map((_, i) => ({ id: uid(), label: `${ranks.length + i + 1}등` }))],
    );
  }

  async function removeParticipant(index: number) {
    if (!selected) return;
    await persist(
      selected.items.filter((_, i) => i !== index),
      ranks.filter((_, i) => i !== index),
    );
  }

  async function clearAllParticipants() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm('등록된 참가자를 전부 삭제할까요?')) return;
    await persist([], []);
  }

  async function renameRank(index: number) {
    if (!selected) return;
    const next = prompt('순위 이름을 입력하세요', ranks[index]?.label ?? '');
    if (next == null || !next.trim()) return;
    await persist(
      selected.items,
      ranks.map((r, i) => (i === index ? { ...r, label: next.trim() } : r)),
    );
  }

  async function applyRankStyle(style: '등' | '번') {
    if (!selected) return;
    await persist(selected.items, rankLabels(ranks.length, style));
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
        <div className="section-title">{studentClassName} 순서정하기</div>
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
                + 새 목록
              </button>
            )}
          </div>

          {isStaff && showCreateForm && (
            <div className="settings-block wheel-create-form">
              <div className="field-row">
                <label htmlFor="oname">이름</label>
                <input
                  id="oname"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 발표 순서 정하기"
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
              {isStaff ? '아직 목록이 없습니다. "+ 새 목록"으로 만들어 주세요.' : '아직 선생님이 만든 목록이 없습니다.'}
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

              <div className="game-title-big">{selected.name}</div>
              <OrderPicker participants={selected.items} ranks={ranks} music={selected.config.music} />

              {isStaff && (
                <div className="settings-block" style={{ marginTop: 22 }}>
                  <div className="wheel-editor-head">
                    <h4 style={{ margin: 0 }}>참가자 · 순위 이름 편집</h4>
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
                        <div className="hint">참가자</div>
                        <StudentRosterPicker
                          roster={roster}
                          existingLabels={selected.items.map((i) => i.label)}
                          scope={rosterScope}
                          onScopeChange={setRosterScope}
                          loading={rosterLoading}
                          onAdd={(labels) => void addParticipantsBulk(labels)}
                        />
                        <div className="tag-list">
                          {selected.items.length === 0 ? (
                            <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>등록된 참가자가 없습니다.</span>
                          ) : (
                            selected.items.map((item, i) => (
                              <div className="tag" key={item.id}>
                                {item.label}
                                <button onClick={() => void removeParticipant(i)}>✕</button>
                              </div>
                            ))
                          )}
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
                        <div className="hint">순위 이름 — 눌러서 수정</div>
                        <div className="tag-list">
                          {ranks.map((r, i) => (
                            <button key={r.id} type="button" className="tag tag-editable" onClick={() => void renameRank(i)}>
                              {r.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="linkish dark" onClick={() => void applyRankStyle('등')}>
                            1등 스타일로
                          </button>
                          <button className="linkish dark" onClick={() => void applyRankStyle('번')}>
                            1번 스타일로
                          </button>
                        </div>
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
