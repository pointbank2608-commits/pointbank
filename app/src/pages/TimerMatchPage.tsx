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
    return (
      <div className="text-center py-16 font-body-md text-on-surface-variant">
        등록된 반이 없습니다. 설정에서 반을 추가해 주세요.
      </div>
    );
  }
  if (!isStaff && !classId) {
    return <div className="text-center py-16 font-body-md text-on-surface-variant">불러오는 중…</div>;
  }

  const classPicker = isStaff ? (
    <div className="flex flex-wrap gap-2">
      {classes.map((c) => (
        <button
          key={c.id}
          onClick={() => selectClass(c.id)}
          className={`px-4 py-2 rounded-full font-label-md text-label-md transition-all ${
            c.id === staffClassId
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low'
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  ) : (
    <h2 className="font-title-md text-title-md text-on-surface">{studentClassName} 타이머 맞추기</h2>
  );

  const templateRow = (
    <div className="flex flex-wrap gap-2">
      {templates.map((t) => (
        <div
          key={t.id}
          className={`flex items-center rounded-full overflow-hidden ${
            t.id === selectedId
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40'
          }`}
        >
          <button
            onClick={() => setSelectedId(t.id)}
            className="pl-4 pr-2 py-2 font-label-md text-label-md flex items-center gap-1.5"
          >
            {t.name}
            <span className="font-caption text-caption opacity-70">{scopeLabel(t)}</span>
          </button>
          {isStaff && (
            <button
              type="button"
              title="삭제"
              onClick={() => void handleDeleteTemplate(t.id)}
              className="pr-3 pl-1 py-2 opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {isStaff && (
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="px-4 py-2 rounded-full font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-dashed border-outline-variant transition-colors"
        >
          + 새 목록
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
      <div>
        <label htmlFor="tname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          이름
        </label>
        <input
          id="tname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="예: 10초 맞추기 챌린지"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreate();
          }}
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
      </div>
      <div>
        <label className="font-label-md text-label-md text-on-surface-variant block mb-1.5">공개 범위</label>
        <div className="flex bg-surface-container-low rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setNewScope('class')}
            className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              newScope === 'class' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            이 반에서만
          </button>
          <button
            type="button"
            onClick={() => setNewScope('academy')}
            className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              newScope === 'academy' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            학원 전체 공용
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => void handleCreate()}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 hover:bg-primary-container transition-colors"
        >
          {submitting ? '만드는 중…' : '만들기'}
        </button>
        <button
          onClick={() => setShowCreateForm(false)}
          className="px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Link
        to="/games"
        className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        ← 게임 목록
      </Link>

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">불러오는 중…</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div className="text-center py-16 bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
            <div className="text-5xl mb-3">⏱️</div>
            <div className="font-body-md text-body-md text-on-surface-variant">
              {isStaff
                ? '아직 목록이 없어요. 아래 "+ 새 목록"으로 첫 챌린지를 만들어보세요!'
                : '아직 선생님이 만든 목록이 없어요.'}
            </div>
          </div>
          {templateRow}
          {createForm}
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
            {selected.name}
          </h2>

          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
            <TimerMatch
              participants={selected.items}
              targetMs={targetMs}
              music={selected.config.music}
              resultSound={resolveResultSound(selected.config.resultSound)}
            />
          </div>

          <div className="space-y-4">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">타이머 맞추기 설정</h4>
                  <div className="flex gap-3">
                    <button
                      onClick={() => void handleRename()}
                      className="font-label-md text-label-md text-primary hover:underline"
                    >
                      이름 변경
                    </button>
                    <button
                      onClick={() => setEditorOpen((v) => !v)}
                      className="font-label-md text-label-md text-primary hover:underline"
                    >
                      {editorOpen ? '접기' : '펼치기'}
                    </button>
                  </div>
                </div>

                {editorOpen && (
                  <div className="space-y-4">
                    {academy && (
                      <div className="divide-y divide-surface-container">
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
                      </div>
                    )}

                    <div>
                      <div className="font-caption text-caption text-on-surface-variant mb-2">목표 시간(초)</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={targetInput}
                          onChange={(e) => setTargetInput(e.target.value)}
                          onBlur={() => void commitTarget()}
                          className="w-[90px] bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 font-body-md text-sm text-on-surface text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <span className="font-body-md text-body-md text-on-surface-variant">초</span>
                      </div>
                    </div>

                    <div>
                      <StudentRosterPicker
                        roster={roster}
                        existingLabels={selected.items.map((i) => i.label)}
                        scope={rosterScope}
                        onScopeChange={setRosterScope}
                        loading={rosterLoading}
                        onAdd={(labels) => void addParticipantsBulk(labels)}
                      />
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {selected.items.length === 0 ? (
                          <span className="font-caption text-caption text-on-surface-variant">
                            등록된 참가자가 없습니다.
                          </span>
                        ) : (
                          selected.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface"
                            >
                              {item.label}
                              <button
                                onClick={() => void removeParticipant(item.id)}
                                className="text-on-surface-variant hover:text-error"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      {selected.items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void clearAllParticipants()}
                          className="mt-2 font-label-md text-label-md text-error hover:underline"
                        >
                          전체 삭제
                        </button>
                      )}
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          placeholder="새 참가자"
                          value={newParticipant}
                          onChange={(e) => setNewParticipant(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void addParticipant();
                          }}
                          className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <button
                          onClick={() => void addParticipant()}
                          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors whitespace-nowrap"
                        >
                          추가
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
