import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createGameTemplate,
  deleteGameTemplate,
  fetchGameTemplateById,
  fetchGameTemplates,
  fetchImportCandidates,
  fetchMyStudentRow,
  fetchStudentsOfAcademy,
  fetchStudentsOfClass,
  fetchWordLists,
  renameGameTemplate,
  type ImportCandidate,
} from './api';
import { useClasses } from './useClasses';
import type { GameItem, GameTemplate, GameTemplateConfig, GameType, WordList } from './types';

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  /** "다른 게임으로 열기"로 넘어온 경우, 그 새 템플릿을 최초 1회만 자동 선택하기 위한 값. */
  const openTemplateIdRef = useRef((location.state as { openTemplateId?: string } | null)?.openTemplateId);

  const { classes, selectedId: staffClassId, select: selectClass, reorder: reorderClasses } = useClasses(academy?.id);
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

  // 선생님이 이 반/학원에 만들어둔 단어장 목록 — WordListPicker 가 그대로 보여준다.
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [wordListsLoading, setWordListsLoading] = useState(false);

  const reloadWordLists = useCallback(async () => {
    if (!academy?.id || !classId) {
      setWordLists([]);
      return;
    }
    setWordListsLoading(true);
    try {
      setWordLists(await fetchWordLists(academy.id, classId));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setWordListsLoading(false);
    }
  }, [academy?.id, classId, notify]);

  useEffect(() => {
    void reloadWordLists();
  }, [reloadWordLists]);

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
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        const openId = openTemplateIdRef.current;
        if (openId && rows.some((r) => r.id === openId)) return openId;
        return rows[0]?.id ?? null;
      });
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
    const next = prompt(t('gameAdmin.renamePrompt'), selected.name);
    if (!next?.trim() || next.trim() === selected.name) return;
    const ok = await run(() => renameGameTemplate(selected.id, next.trim()), t('gameAdmin.renamedToast'));
    if (ok) setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, name: next.trim() } : tpl)));
  }

  /** id 를 안 주면 현재 선택된 템플릿을 지운다 — 목록 칩의 개별 삭제 버튼은 id 를 직접 넘긴다. */
  async function handleDeleteTemplate(id?: string) {
    const target = id ? templates.find((tpl) => tpl.id === id) : selected;
    if (!target) return;
    if (!confirm(t('gameAdmin.deleteConfirm', { name: target.name }))) return;
    const ok = await run(() => deleteGameTemplate(target.id), t('gameAdmin.deletedToast'));
    if (ok) {
      setSelectedId((prev) => (prev === target.id ? null : prev));
      await load();
    }
  }

  async function handleCreate() {
    if (!academy?.id || !profile || !classId) return false;
    const name = newName.trim();
    if (!name) {
      notify(t('gameAdmin.nameRequiredError'), 'error');
      return false;
    }
    setSubmitting(true);
    const ok = await run(async () => {
      const tpl = await createGameTemplate({
        academyId: academy.id,
        classId: newScope === 'class' ? classId : null,
        gameType,
        name,
        items: defaultItems(),
        config: defaultConfig?.() ?? {},
        teacherId: profile.id,
      });
      setTemplates((prev) => [...prev, tpl]);
      setSelectedId(tpl.id);
    }, t('gameAdmin.createdToast'));
    setSubmitting(false);
    if (ok) {
      setNewName('');
      setNewScope('class');
      setShowCreateForm(false);
    }
    return ok;
  }

  const scopeLabel = (tpl: GameTemplate) => (tpl.class_id ? t('gameAdmin.scopeClass') : t('gameAdmin.scopeAcademy'));

  // "다른 반에서 가져오기" 후보 — 같은 게임 종류를 쓰는 다른 반의 템플릿 목록.
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);

  useEffect(() => {
    if (!academy?.id || !classId) {
      setImportCandidates([]);
      return;
    }
    fetchImportCandidates(academy.id, gameType, classId)
      .then(setImportCandidates)
      .catch((err) => notify(err instanceof Error ? err.message : String(err), 'error'));
  }, [academy?.id, classId, gameType, notify]);

  /**
   * 다른 반의 템플릿을 지금 반으로 복사해서 새 템플릿을 만든다.
   * mode: 'keep' 이면 항목을 그대로, 'roster' 면 지금 반의 실제 학생 명단으로 바꿔치기한다.
   */
  async function importFromClass(sourceTemplateId: string, mode: 'keep' | 'roster') {
    if (!academy?.id || !profile || !classId) return;
    try {
      const source = await fetchGameTemplateById(sourceTemplateId);
      let items = source.items;
      if (mode === 'roster') {
        const students = await fetchStudentsOfClass(classId);
        items = students.map((s) => ({ id: crypto.randomUUID(), label: s.name }));
      }
      const tpl = await createGameTemplate({
        academyId: academy.id,
        classId,
        gameType,
        name: source.name,
        items,
        config: source.config,
        teacherId: profile.id,
      });
      setTemplates((prev) => [...prev, tpl]);
      setSelectedId(tpl.id);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  /** 지금 선택된 템플릿의 항목 리스트를 그대로, 다른 게임 종류의 새 템플릿으로 만들고 그 페이지로 이동한다. */
  async function openInOtherGame(targetType: GameType) {
    if (!academy?.id || !profile || !selected) return;
    const carried: GameTemplateConfig = {};
    if (selected.config.music) carried.music = selected.config.music;
    if (selected.config.resultSound) carried.resultSound = selected.config.resultSound;
    try {
      const tpl = await createGameTemplate({
        academyId: academy.id,
        classId: selected.class_id,
        gameType: targetType,
        name: selected.name,
        items: selected.items,
        config: carried,
        teacherId: profile.id,
      });
      navigate(`/games/${targetType}`, { state: { openTemplateId: tpl.id } });
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  return {
    isStaff,
    academy,
    classes,
    staffClassId,
    selectClass,
    reorderClasses,
    studentClassName,
    classId,
    roster,
    rosterScope,
    setRosterScope,
    rosterLoading,
    wordLists,
    wordListsLoading,
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
    openInOtherGame,
    importCandidates,
    importFromClass,
    reload: load,
  };
}
