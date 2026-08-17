import { useCallback, useEffect, useMemo, useState } from 'react';
import SpinWheel from '../components/SpinWheel';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createGameTemplate,
  deleteGameTemplate,
  fetchGameTemplates,
  fetchMyStudentRow,
  renameGameTemplate,
  updateGameTemplateItems,
} from '../lib/api';
import { useClasses } from '../lib/useClasses';
import type { GameItem, GameTemplate } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

export default function WheelPage() {
  const { academy, profile, isStaff, session } = useAuth();
  const { notify, run } = useToast();

  // 선생님: 반 탭으로 직접 선택. 학생: 자기 반 고정(아래에서 studentClassId 로 찾음).
  // classes 목록 자체는 반 이름 표시에 학생도 필요해서 역할 상관없이 불러온다.
  const { classes, selectedId: staffClassId, select: selectClass } = useClasses(academy?.id);
  const [studentClassId, setStudentClassId] = useState<string | null>(null);
  const [studentClassName, setStudentClassName] = useState('');

  useEffect(() => {
    if (isStaff || !session?.user.id) return;
    fetchMyStudentRow(session.user.id)
      .then((s) => setStudentClassId(s?.class_id ?? null))
      .catch((err) => notify(err instanceof Error ? err.message : String(err), 'error'));
  }, [isStaff, session?.user.id, notify]);

  useEffect(() => {
    if (isStaff) return;
    const cls = classes.find((c) => c.id === studentClassId);
    setStudentClassName(cls?.name ?? '');
  }, [isStaff, classes, studentClassId]);

  const classId = isStaff ? staffClassId : studentClassId;

  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playItems, setPlayItems] = useState<GameItem[]>([]);
  const [eliminateMode, setEliminateMode] = useState(false);
  const [recent, setRecent] = useState<{ id: string; label: string; at: number }[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<'class' | 'academy'>('class');

  const load = useCallback(async () => {
    if (!academy?.id || !classId) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchGameTemplates(academy.id, classId, 'wheel');
      setTemplates(rows);
      setSelectedId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : (rows[0]?.id ?? null)));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [academy?.id, classId, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

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
    const ok = await run(() => updateGameTemplateItems(selected.id, next));
    if (!ok) await load();
  }

  async function addItem() {
    const label = newItemLabel.trim();
    if (!label || !selected) return;
    await persistItems([...selected.items, { id: uid(), label }]);
    setNewItemLabel('');
  }

  async function removeItem(itemId: string) {
    if (!selected) return;
    await persistItems(selected.items.filter((i) => i.id !== itemId));
  }

  async function handleRename() {
    if (!selected) return;
    const next = prompt('돌림판 이름을 입력하세요', selected.name);
    if (!next?.trim() || next.trim() === selected.name) return;
    const ok = await run(() => renameGameTemplate(selected.id, next.trim()), '이름을 변경했습니다.');
    if (ok) setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, name: next.trim() } : t)));
  }

  async function handleDeleteTemplate() {
    if (!selected) return;
    if (!confirm(`"${selected.name}" 돌림판을 삭제할까요?`)) return;
    const ok = await run(() => deleteGameTemplate(selected.id), '삭제했습니다.');
    if (ok) {
      setSelectedId(null);
      await load();
    }
  }

  async function handleCreate() {
    if (!academy?.id || !profile || !classId) return;
    const name = newName.trim();
    if (!name) {
      notify('돌림판 이름을 입력해 주세요.', 'error');
      return;
    }
    setCreating(true);
    const ok = await run(async () => {
      const t = await createGameTemplate({
        academyId: academy.id,
        classId: newScope === 'class' ? classId : null,
        gameType: 'wheel',
        name,
        items: ['항목 1', '항목 2', '항목 3'].map((label) => ({ id: uid(), label })),
        teacherId: profile.id,
      });
      setTemplates((prev) => [...prev, t]);
      setSelectedId(t.id);
      setEditorOpen(true);
    }, '돌림판을 만들었습니다.');
    setCreating(false);
    if (ok) {
      setNewName('');
      setNewScope('class');
    }
  }

  const scopeLabel = useMemo(
    () => (t: GameTemplate) => (t.class_id ? '이 반' : '학원 공용'),
    [],
  );

  /* ---------------- 렌더 ---------------- */

  if (isStaff && classes.length === 0) {
    return <div className="empty-hint">등록된 반이 없습니다. 설정에서 반을 추가해 주세요.</div>;
  }
  if (!isStaff && !classId) {
    return <div className="empty-hint">불러오는 중…</div>;
  }

  return (
    <>
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
        <div className="section-title">{studentClassName} 돌림판</div>
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
              <button
                className="wheel-chip add"
                onClick={() => setCreating((v) => !v)}
              >
                + 새 돌림판
              </button>
            )}
          </div>

          {isStaff && creating && (
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
                  <button
                    type="button"
                    className={newScope === 'class' ? 'active' : ''}
                    onClick={() => setNewScope('class')}
                  >
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
                <button onClick={() => void handleCreate()} disabled={creating}>
                  만들기
                </button>
                <button className="ghost" onClick={() => setCreating(false)}>
                  취소
                </button>
              </div>
            </div>
          )}

          {!selected ? (
            <div className="empty-hint">
              {isStaff
                ? '아직 돌림판이 없습니다. "+ 새 돌림판"으로 만들어 주세요.'
                : '아직 선생님이 만든 돌림판이 없습니다.'}
            </div>
          ) : (
            <>
              <SpinWheel items={playItems} onResult={handleResult} />

              <div className="wheel-controls">
                <label className="wheel-eliminate">
                  <input
                    type="checkbox"
                    checked={eliminateMode}
                    onChange={(e) => setEliminateMode(e.target.checked)}
                  />
                  당첨된 항목 제거하며 진행
                </label>
                {playItems.length !== (selected.items.length) && (
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

              {isStaff && (
                <div className="settings-block" style={{ marginTop: 22 }}>
                  <div className="wheel-editor-head">
                    <h4 style={{ margin: 0 }}>돌림판 항목 편집</h4>
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
                    <>
                      <div className="tag-list">
                        {selected.items.length === 0 ? (
                          <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>
                            등록된 항목이 없습니다.
                          </span>
                        ) : (
                          selected.items.map((item) => (
                            <div className="tag" key={item.id}>
                              {item.label}
                              <button onClick={() => void removeItem(item.id)}>✕</button>
                            </div>
                          ))
                        )}
                      </div>
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
            </>
          )}
        </>
      )}
    </>
  );
}
