import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createGameTemplate,
  deleteGameTemplate,
  fetchGameTemplates,
  fetchMyStudentRow,
  fetchStudentsOfAcademy,
  fetchStudentsOfClass,
  renameGameTemplate,
} from './api';
import { useClasses } from './useClasses';
import type { GameItem, GameTemplate, GameTemplateConfig, GameType } from './types';

export type RosterScope = 'class' | 'academy';

/**
 * 게임 템플릿(반/학원 공용 목록 + 만들기/이름변경/삭제) 공통 로직.
 * 돌림판·사다리·순서정하기 모두 이 훅으로 반 선택 + 템플릿 CRUD 를 처리하고,
 * 게임 종류별로 다른 부분(초기 항목, config)만 파라미터로 받는다.
 */
export function useGameTemplates(params: {
  gameType: GameType;
  defaultItems: () => GameItem[];
  defaultConfig?: () => GameTemplateConfig;
}) {
  const { gameType, defaultItems, defaultConfig } = params;
  const { academy, profile, isStaff, session } = useAuth();
  const { notify, run } = useToast();

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

  // 참가자를 매번 직접 입력하지 않도록, 이 반/학원 전체 학생 명단을 게임 항목 후보로 불러온다.
  const [rosterScope, setRosterScope] = useState<RosterScope>('class');
  const [roster, setRoster] = useState<GameItem[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  useEffect(() => {
    if (!academy?.id || !classId) {
      setRoster([]);
      return;
    }
    setRosterLoading(true);
    const fetcher = rosterScope === 'academy' ? fetchStudentsOfAcademy(academy.id) : fetchStudentsOfClass(classId);
    fetcher
      .then((students) => setRoster(students.map((s) => ({ id: s.id, label: s.name }))))
      .catch((err) => notify(err instanceof Error ? err.message : String(err), 'error'))
      .finally(() => setRosterLoading(false));
  }, [academy?.id, classId, rosterScope, notify]);

  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
      const rows = await fetchGameTemplates(academy.id, classId, gameType);
      setTemplates(rows);
      setSelectedId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : (rows[0]?.id ?? null)));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [academy?.id, classId, gameType, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  async function handleRename() {
    if (!selected) return;
    const next = prompt('이름을 입력하세요', selected.name);
    if (!next?.trim() || next.trim() === selected.name) return;
    const ok = await run(() => renameGameTemplate(selected.id, next.trim()), '이름을 변경했습니다.');
    if (ok) setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, name: next.trim() } : t)));
  }

  /** id 를 안 주면 현재 선택된 템플릿을 지운다 — 목록 칩의 개별 삭제 버튼은 id 를 직접 넘긴다. */
  async function handleDeleteTemplate(id?: string) {
    const target = id ? templates.find((t) => t.id === id) : selected;
    if (!target) return;
    if (!confirm(`"${target.name}"을(를) 삭제할까요?`)) return;
    const ok = await run(() => deleteGameTemplate(target.id), '삭제했습니다.');
    if (ok) {
      setSelectedId((prev) => (prev === target.id ? null : prev));
      await load();
    }
  }

  async function handleCreate() {
    if (!academy?.id || !profile || !classId) return false;
    const name = newName.trim();
    if (!name) {
      notify('이름을 입력해 주세요.', 'error');
      return false;
    }
    setSubmitting(true);
    const ok = await run(async () => {
      const t = await createGameTemplate({
        academyId: academy.id,
        classId: newScope === 'class' ? classId : null,
        gameType,
        name,
        items: defaultItems(),
        config: defaultConfig?.() ?? {},
        teacherId: profile.id,
      });
      setTemplates((prev) => [...prev, t]);
      setSelectedId(t.id);
    }, '만들었습니다.');
    setSubmitting(false);
    if (ok) {
      setNewName('');
      setNewScope('class');
      setShowCreateForm(false);
    }
    return ok;
  }

  const scopeLabel = (t: GameTemplate) => (t.class_id ? '이 반' : '학원 공용');

  return {
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
    reload: load,
  };
}
