import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GameMusicPicker from '../components/GameMusicPicker';
import StudentRosterPicker from '../components/StudentRosterPicker';
import TimerMatch from '../components/TimerMatch';
import { updateGameTemplate } from '../lib/api';
import { resolveResultSound } from '../lib/gameMusic';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, MusicSelection } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultParticipants(): GameItem[] {
  return ['참가자 1', '참가자 2', '참가자 3'].map((label) => ({ id: uid(), label }));
}

const DEFAULT_TARGET_MS = 10000;

export default function TimerMatchPage() {
  const g = useGameTemplates({
    gameType: 'timer',
    defaultItems: defaultParticipants,
    defaultConfig: () => ({ targetMs: DEFAULT_TARGET_MS }),
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
  const targetMs = selected?.config.targetMs ?? DEFAULT_TARGET_MS;
  const [targetInput, setTargetInput] = useState((targetMs / 1000).toFixed(2));

  useEffect(() => {
    setTargetInput((targetMs / 1000).toFixed(2));
  }, [targetMs]);

  async function persistItems(nextItems: GameItem[]) {
    if (!selected) return;
    setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, items: nextItems } : t)));
    try {
      await updateGameTemplate(selected.id, { items: nextItems });
    } catch {
      await reload();
    }
  }

  async function addParticipant() {
    const label = newParticipant.trim();
    if (!label || !selected) return;
    await persistItems([...selected.items, { id: uid(), label }]);
    setNewParticipant('');
  }

  async function addParticipantsBulk(labels: string[]) {
    if (!selected || labels.length === 0) return;
    await persistItems([...selected.items, ...labels.map((label) => ({ id: uid(), label }))]);
  }

  async function removeParticipant(itemId: string) {
    if (!selected) return;
    await persistItems(selected.items.filter((i) => i.id !== itemId));
  }

  async function clearAllParticipants() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm('등록된 참가자를 전부 삭제할까요?')) return;
    await persistItems([]);
  }

  async function commitTarget() {
    if (!selected) return;
    const seconds = Math.max(0.1, Number(targetInput) || 0.1);
    const nextConfig = { ...selected.config, targetMs: Math.round(seconds * 1000) };
    setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, config: nextConfig } : t)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
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

  async function handleResultSoundChange(resultSound: MusicSelection | null) {
    if (!selected) return;
    const nextConfig = { ...selected.config, resultSound };
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

  const classPicker = isStaff ? (
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
    <div className="section-title">{studentClassName} 타이머 맞추기</div>
  );

  const templateRow = (
    <div className="wheel-template-row">
      {templates.map((t) => (
        <div key={t.id} className={`wheel-chip-wrap ${t.id === selectedId ? 'active' : ''}`}>
          <button className="wheel-chip-select" onClick={() => setSelectedId(t.id)}>
            {t.name}
            <span className="wheel-chip-scope">{scopeLabel(t)}</span>
          </button>
          {isStaff && (
            <button
              type="button"
              className="wheel-chip-delete"
              title="삭제"
              onClick={() => void handleDeleteTemplate(t.id)}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {isStaff && (
        <button className="wheel-chip add" onClick={() => setShowCreateForm((v) => !v)}>
          + 새 목록
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="settings-block wheel-create-form">
      <div className="field-row">
        <label htmlFor="tname">이름</label>
        <input
          id="tname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="예: 10초 맞추기 챌린지"
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
          <button type="button" className={newScope === 'academy' ? 'active' : ''} onClick={() => setNewScope('academy')}>
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
  );

  return (
    <>
      <Link to="/games" className="back-link">
        ← 게임 목록
      </Link>

      {loading ? (
        <div className="empty-hint">불러오는 중…</div>
      ) : !selected ? (
        <>
          {classPicker}
          <div className="game-empty-hero">
            <div className="game-empty-hero-icon">⏱️</div>
            <div className="game-empty-hero-text">
              {isStaff ? '아직 목록이 없어요. 아래 "+ 새 목록"으로 첫 챌린지를 만들어보세요!' : '아직 선생님이 만든 목록이 없어요.'}
            </div>
          </div>
          {templateRow}
          {createForm}
        </>
      ) : (
        <>
          <div className="game-title-big">{selected.name}</div>
          <TimerMatch
            participants={selected.items}
            targetMs={targetMs}
            music={selected.config.music}
            resultSound={resolveResultSound(selected.config.resultSound)}
          />

          <div className="game-admin-area">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="settings-block" style={{ marginTop: 22 }}>
                <div className="wheel-editor-head">
                  <h4 style={{ margin: 0 }}>타이머 맞추기 설정</h4>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="linkish dark" onClick={() => void handleRename()}>
                      이름 변경
                    </button>
                    <button className="linkish dark" onClick={() => setEditorOpen((v) => !v)}>
                      {editorOpen ? '접기' : '펼치기'}
                    </button>
                  </div>
                </div>

                {editorOpen && (
                  <>
                    {academy && (
                      <>
                        <GameMusicPicker
                          academyId={academy.id}
                          isStaff={isStaff}
                          value={selected.config.music}
                          onChange={(m) => void handleMusicChange(m)}
                        />
                        <GameMusicPicker
                          academyId={academy.id}
                          isStaff={isStaff}
                          label="결과 사운드"
                          value={resolveResultSound(selected.config.resultSound)}
                          onChange={(m) => void handleResultSoundChange(m)}
                        />
                      </>
                    )}

                    <div className="hint">목표 시간(초)</div>
                    <div className="bomb-range-row">
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        onBlur={() => void commitTarget()}
                      />
                      <span>초</span>
                    </div>

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
                        selected.items.map((item) => (
                          <div className="tag" key={item.id}>
                            {item.label}
                            <button onClick={() => void removeParticipant(item.id)}>✕</button>
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
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
