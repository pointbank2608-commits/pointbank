import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createClass,
  createPreset,
  deleteClass,
  deletePreset,
  fetchPresets,
  fetchStudentsOfClass,
  renameClass,
  rotateInviteCode,
  updateAcademy,
} from '../lib/api';
import { signed } from '../lib/format';
import { useClasses } from '../lib/useClasses';
import type { Preset, Student } from '../lib/types';

export default function SettingsPage() {
  const { academy, profile, refresh } = useAuth();
  const { notify, run } = useToast();
  const { classes, selectedId, select, reload: reloadClasses } = useClasses(academy?.id);

  const [name, setName] = useState(academy?.name ?? '');
  const [unit, setUnit] = useState(academy?.point_unit ?? '');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetDelta, setNewPresetDelta] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [inviteCode, setInviteCode] = useState(academy?.invite_code ?? '');

  useEffect(() => {
    setName(academy?.name ?? '');
    setUnit(academy?.point_unit ?? '');
    setInviteCode(academy?.invite_code ?? '');
  }, [academy]);

  const loadPresets = useCallback(async () => {
    if (!academy?.id) return;
    try {
      setPresets(await fetchPresets(academy.id));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  }, [academy?.id, notify]);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  useEffect(() => {
    if (!selectedId) {
      setStudents([]);
      return;
    }
    fetchStudentsOfClass(selectedId)
      .then(setStudents)
      .catch((err) => notify(String(err.message ?? err), 'error'));
  }, [selectedId, notify]);

  const isOwner = profile?.role === 'owner';

  /* ---------- 핸들러 ---------- */

  async function saveAcademy() {
    if (!academy?.id) return;
    const ok = await run(
      () => updateAcademy(academy.id, { name: name.trim(), point_unit: unit.trim() }),
      '저장했습니다.',
    );
    if (ok) await refresh();
  }

  async function addPreset() {
    if (!academy?.id) return;
    const delta = parseInt(newPresetDelta, 10);
    if (!newPresetLabel.trim() || !delta) {
      notify('사유와 0이 아닌 점수를 입력해 주세요.', 'error');
      return;
    }
    const ok = await run(async () => {
      await createPreset(academy.id, newPresetLabel.trim(), delta, presets.length);
    }, '프리셋을 추가했습니다.');
    if (ok) {
      setNewPresetLabel('');
      setNewPresetDelta('');
      await loadPresets();
    }
  }

  async function removePreset(id: string) {
    const ok = await run(() => deletePreset(id), '프리셋을 삭제했습니다.');
    if (ok) setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  async function addClass() {
    if (!academy?.id || !newClassName.trim()) return;
    const ok = await run(async () => {
      await createClass(academy.id, newClassName.trim(), classes.length);
    }, '반을 추가했습니다.');
    if (ok) {
      setNewClassName('');
      await reloadClasses();
    }
  }

  async function handleRenameClass(id: string, current: string) {
    const next = prompt('반 이름을 입력하세요', current);
    if (!next?.trim() || next.trim() === current) return;
    const ok = await run(() => renameClass(id, next.trim()), '이름을 변경했습니다.');
    if (ok) await reloadClasses();
  }

  async function handleDeleteClass(id: string, className: string) {
    if (!confirm(`"${className}" 반과 소속 학생·거래 기록을 모두 삭제할까요?\n되돌릴 수 없습니다.`))
      return;
    const ok = await run(() => deleteClass(id), '반을 삭제했습니다.');
    if (ok) await reloadClasses();
  }

  async function handleRotate() {
    if (!confirm('초대 코드를 새로 발급하면 기존 코드는 사용할 수 없게 됩니다. 계속할까요?')) return;
    try {
      const code = await rotateInviteCode();
      setInviteCode(code);
      notify('새 초대 코드를 발급했습니다.');
      await refresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  function copy(text: string, what: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => notify(`${what}를 복사했습니다.`))
      .catch(() => notify('복사에 실패했습니다.', 'error'));
  }

  /* ---------- 렌더 ---------- */

  return (
    <>
      <div className="settings-block">
        <h4>학원 · 포인트 기본 설정</h4>
        <div className="field-row">
          <label htmlFor="aname">학원 이름</label>
          <input id="aname" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field-row">
          <label htmlFor="aunit">포인트 단위</label>
          <input
            id="aunit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="별, 달러, 포인트 …"
          />
        </div>
        <div className="field-row">
          <button onClick={() => void saveAcademy()}>저장</button>
        </div>
      </div>

      <div className="settings-block">
        <h4>지급 / 차감 사유 프리셋</h4>
        <p className="hint">통장 카드에 버튼으로 표시됩니다. 자주 쓰는 사유를 등록해 두세요.</p>
        <div className="tag-list">
          {presets.length === 0 ? (
            <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>등록된 사유가 없습니다.</span>
          ) : (
            presets.map((p) => (
              <div className="tag" key={p.id}>
                {p.label} ({signed(p.delta)})
                <button onClick={() => void removePreset(p.id)}>✕</button>
              </div>
            ))
          )}
        </div>
        <div className="preset-add-row">
          <input
            type="text"
            placeholder="사유 (예: 지각)"
            value={newPresetLabel}
            onChange={(e) => setNewPresetLabel(e.target.value)}
          />
          <input
            type="number"
            placeholder="±숫자"
            value={newPresetDelta}
            onChange={(e) => setNewPresetDelta(e.target.value)}
          />
          <button onClick={() => void addPreset()}>추가</button>
        </div>
      </div>

      <div className="settings-block">
        <h4>반 관리</h4>
        {classes.length === 0 ? (
          <div className="empty-hint">등록된 반이 없습니다.</div>
        ) : (
          classes.map((c) => (
            <div className="manage-row" key={c.id}>
              <span>{c.name}</span>
              <span style={{ display: 'flex', gap: 12 }}>
                <button className="danger" style={{ color: 'var(--navy-700)' }} onClick={() => void handleRenameClass(c.id, c.name)}>
                  이름 변경
                </button>
                <button className="danger" onClick={() => void handleDeleteClass(c.id, c.name)}>
                  삭제
                </button>
              </span>
            </div>
          ))
        )}
        <div className="field-row" style={{ marginTop: 12 }}>
          <input
            placeholder="새 반 이름 (예: 고등 2반)"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addClass();
            }}
          />
          <button onClick={() => void addClass()}>반 추가</button>
        </div>
      </div>

      <div className="settings-block">
        <h4>학생 로그인 코드</h4>
        <p className="hint">
          학생이 직접 자기 통장을 보려면 회원가입 후 아래 코드를 입력해야 합니다. 코드는 한 번만
          연결되며, 이미 연결된 학생은 ‘연결됨’으로 표시됩니다.
        </p>
        <div className="class-tabs">
          {classes.map((c) => (
            <button
              key={c.id}
              className={`class-tab ${c.id === selectedId ? 'active' : ''}`}
              onClick={() => select(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        {students.length === 0 ? (
          <div className="empty-hint">이 반에 학생이 없습니다.</div>
        ) : (
          students.map((s) => (
            <div className="manage-row" key={s.id}>
              <span>{s.name}</span>
              {s.user_id ? (
                <span style={{ fontSize: 12, color: 'var(--sage)', fontWeight: 700 }}>연결됨</span>
              ) : (
                <span
                  className="code-badge"
                  style={{ cursor: 'pointer' }}
                  title="클릭하면 복사됩니다"
                  onClick={() => copy(s.claim_code, '학생 코드')}
                >
                  {s.claim_code}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="settings-block">
        <h4>선생님 초대 코드</h4>
        <p className="hint">
          다른 선생님이 회원가입 후 이 코드를 입력하면 같은 학원에 합류합니다.
          {isOwner ? '' : ' (재발급은 원장만 가능합니다)'}
        </p>
        <div className="field-row">
          <span
            className="code-badge"
            style={{ cursor: 'pointer', fontSize: 16 }}
            title="클릭하면 복사됩니다"
            onClick={() => copy(inviteCode, '초대 코드')}
          >
            {inviteCode}
          </span>
          {isOwner && (
            <button className="ghost" onClick={() => void handleRotate()}>
              새 코드 발급
            </button>
          )}
        </div>
      </div>
    </>
  );
}
