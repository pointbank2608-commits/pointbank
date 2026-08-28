import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GameMusicPicker from '../components/GameMusicPicker';
import SpinWheel from '../components/SpinWheel';
import StudentRosterPicker from '../components/StudentRosterPicker';
import { useToast } from '../context/ToastContext';
import { updateGameTemplate } from '../lib/api';
import { resolveResultSound } from '../lib/gameMusic';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, MusicSelection } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  return ['항목 1', '항목 2', '항목 3'].map((label) => ({ id: uid(), label }));
}

export default function WheelPage() {
  const g = useGameTemplates({ gameType: 'wheel', defaultItems });
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
  const { notify } = useToast();

  const [playItems, setPlayItems] = useState<GameItem[]>([]);
  const [eliminateMode, setEliminateMode] = useState(false);
  const [recent, setRecent] = useState<{ id: string; label: string; at: number }[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');

  // 선택된 돌림판이 바뀌면 플레이용 사본을 새로 받고, 결과 기록을 비운다.
  useEffect(() => {
    setPlayItems(selected?.items ?? []);
    setRecent([]);
  }, [selected]);

  function resetPlayItems() {
    setPlayItems(selected?.items ?? []);
  }

  function handleResult(item: GameItem) {
    setRecent((prev) => [{ id: item.id, label: item.label, at: Date.now() }, ...prev].slice(0, 8));
    if (eliminateMode) {
      setPlayItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  }

  /* ---------------- 항목 편집 (선생님/원장) ---------------- */

  async function persistItems(next: GameItem[]) {
    if (!selected) return;
    setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, items: next } : t)));
    try {
      await updateGameTemplate(selected.id, { items: next });
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
      await reload();
    }
  }

  async function addItem() {
    const label = newItemLabel.trim();
    if (!label || !selected) return;
    await persistItems([...selected.items, { id: uid(), label }]);
    setNewItemLabel('');
  }

  async function addItemsBulk(labels: string[]) {
    if (!selected || labels.length === 0) return;
    await persistItems([...selected.items, ...labels.map((label) => ({ id: uid(), label }))]);
  }

  async function removeItem(itemId: string) {
    if (!selected) return;
    await persistItems(selected.items.filter((i) => i.id !== itemId));
  }

  async function clearAllItems() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm('등록된 항목을 전부 삭제할까요?')) return;
    await persistItems([]);
  }

  async function handleMusicChange(music: MusicSelection | null) {
    if (!selected) return;
    const nextConfig = { ...selected.config, music };
    setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, config: nextConfig } : t)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
      await reload();
    }
  }

  async function handleResultSoundChange(resultSound: MusicSelection | null) {
    if (!selected) return;
    const nextConfig = { ...selected.config, resultSound };
    setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, config: nextConfig } : t)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
      await reload();
    }
  }

  /* ---------------- 렌더 ---------------- */

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
    <div className="section-title">{studentClassName} 돌림판</div>
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
          + 새 돌림판
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="settings-block wheel-create-form">
      <div className="field-row">
        <label htmlFor="wname">이름</label>
        <input
          id="wname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="예: 발표 순서 뽑기"
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
          <div className="empty-hint">
            {isStaff ? '아직 돌림판이 없습니다. "+ 새 돌림판"으로 만들어 주세요.' : '아직 선생님이 만든 돌림판이 없습니다.'}
          </div>
          {templateRow}
          {createForm}
        </>
      ) : (
        <>
          <div className="game-title-big">{selected.name}</div>
          <SpinWheel
            items={playItems}
            music={selected.config.music}
            resultSound={resolveResultSound(selected.config.resultSound)}
            onResult={handleResult}
          />

          <div className="wheel-controls">
            <label className="wheel-eliminate">
              <input type="checkbox" checked={eliminateMode} onChange={(e) => setEliminateMode(e.target.checked)} />
              당첨된 항목 제거하며 진행
            </label>
            {playItems.length !== selected.items.length && (
              <button className="linkish dark" onClick={resetPlayItems}>
                항목 초기화
              </button>
            )}
          </div>

          {recent.length > 0 && (
            <div className="wheel-recent">
              <div className="wheel-recent-title">최근 결과</div>
              <div className="wheel-recent-list">
                {recent.map((r, i) => (
                  <span key={r.at} className="wheel-recent-tag">
                    {i === 0 && '🎉 '}
                    {r.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="game-admin-area">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="settings-block" style={{ marginTop: 22 }}>
                <div className="wheel-editor-head">
                  <h4 style={{ margin: 0 }}>돌림판 설정</h4>
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

                    <StudentRosterPicker
                      roster={roster}
                      existingLabels={selected.items.map((i) => i.label)}
                      scope={rosterScope}
                      onScopeChange={setRosterScope}
                      loading={rosterLoading}
                      onAdd={(labels) => void addItemsBulk(labels)}
                    />

                    <div className="tag-list">
                      {selected.items.length === 0 ? (
                        <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>등록된 항목이 없습니다.</span>
                      ) : (
                        selected.items.map((item) => (
                          <div className="tag" key={item.id}>
                            {item.label}
                            <button onClick={() => void removeItem(item.id)}>✕</button>
                          </div>
                        ))
                      )}
                    </div>
                    {selected.items.length > 0 && (
                      <button type="button" className="link-danger" onClick={() => void clearAllItems()}>
                        전체 삭제
                      </button>
                    )}
                    <div className="preset-add-row">
                      <input
                        type="text"
                        placeholder="새 항목 (예: 1모둠)"
                        value={newItemLabel}
                        onChange={(e) => setNewItemLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void addItem();
                        }}
                      />
                      <button onClick={() => void addItem()}>추가</button>
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
