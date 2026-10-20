import { activityName } from './activityNames';
import { GAME_CATALOG } from './gameCatalog';
import { gamePreparation } from './gamePreparation';
import { guideSample } from './gameGuide';
import { DRAFT_EVENT, draftId, isActivityDraft, readActivityDraft, writeActivityDraft, sampleActivityCards, readComposition, legacyActivityInput, rememberSourceUse, ownedQuickSource, type QuickActivitySource } from './quickActivity';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGameEmbed } from '../context/GameEmbedContext';
import { useGameWorkspace } from '../context/GameWorkspaceContext';
import { prepareClassroomGame } from './gameWorkspace';
import { wordListToCards } from './gameFromWords';
import { useLessonRunner, usePresenting } from '../context/LessonRunnerContext';
import { useToast } from '../context/ToastContext';
import {
  createGameTemplate,
  createWordList,
  deleteGameTemplate,
  fetchGameTemplateById,
  fetchGameTemplates,
  fetchImportCandidates,
  fetchMyStudentRow,
  fetchStudentsOfAcademy,
  fetchStudentsOfClass,
  fetchWordLists,
  fetchAllWordLists,
  renameGameTemplate,
  type ImportCandidate,
} from './api';
import { useClasses } from './useClasses';
import type { FullCardItem, GameItem, GameTemplate, GameTemplateConfig, GameType, WordList } from './types';

export type RosterScope = 'class' | 'academy';

interface OpenState {
  materialsWords?: FullCardItem[];
  openTemplateId?: string;
  openClassId?: string;
  quickSource?: QuickActivitySource;
}

/**
 * 게임 템플릿(반/학원 공용 목록 + 만들기/이름변경/삭제) 공통 로직.
 * 돌림판·사다리·순서정하기 모두 이 훅으로 반 선택 + 템플릿 CRUD 를 처리하고,
 * 게임 종류별로 다른 부분(초기 항목, config)만 파라미터로 받는다.
 */
export function useGameTemplates(params: {
  gameType: GameType;
  defaultItems: () => GameItem[];
  defaultConfig?: () => GameTemplateConfig;
  /** Optional game-specific demo source; never writes a saved game by itself. */
  sampleCards?: () => FullCardItem[];
  /** 불러올 목록 종류 — 문장 게임은 'sentence'(문장 목록, 066), 나머지는 단어장 */
  listKind?: 'word' | 'sentence' | 'all';
}) {
  const { gameType, defaultItems, defaultConfig, listKind = 'word' } = params;
  const { academy, profile, isStaff, session } = useAuth();
  const { notify, run } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const presenting = usePresenting();
  const lessonRunner = useLessonRunner();
  /** 커리큘럼 편집 화면 안에 띄워진 경우(게임 슬라이드 상세) — 반·처음 템플릿이 슬라이드에서 온다. */
  const embed = useGameEmbed();
  const workspace = useGameWorkspace();
  const embedRef = useRef(embed);
  embedRef.current = embed;
  /** "다른 게임으로 열기"·워크시트 다리·커리큘럼 발표에서 넘어온 템플릿 — 이게 있으면 이전 선택보다
   * 우선해서 연다. */
  const openTemplateIdRef = useRef(embed ? embed.templateId : (location.state as OpenState | null)?.openTemplateId);

  const {
    classes,
    selectedId: staffClassId,
    select: selectClass,
    reorder: reorderClasses,
    loading: classesLoading,
    error: classesError,
    reload: reloadClasses,
  } = useClasses(academy?.id);
  // 반 목록을 못 불러왔으면(잠깐 끊김) 한 번 더 — 그대로 두면 "등록된 반이 없습니다"로 잘못 보인다.
  const classesRetried = useRef(false);
  useEffect(() => {
    if (classesError && !classesRetried.current) {
      classesRetried.current = true;
      const id = window.setTimeout(() => void reloadClasses(), 1500);
      return () => window.clearTimeout(id);
    }
  }, [classesError, reloadClasses]);
  /** 정말로 반이 하나도 없을 때만 true — 불러오는 중이거나, 수업 편집 화면(반이 레슨 반으로 정해짐)에선 false. */
  const noClasses = !workspace && isStaff && !classesLoading && !classesError && classes.length === 0 && !embed?.classId;
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

  const [withoutClass, setWithoutClass] = useState(true);
  const chooseClass = (id: string) => { setWithoutClass(!id); if (id) selectClass(id); };
  const classId = !embed && !presenting && workspace && isStaff && withoutClass ? null : embed ? (embed.classId ?? staffClassId) : isStaff ? staffClassId : studentClassId;

  // 참가자를 매번 직접 입력하지 않도록, 이 반/학원 전체 학생 명단을 게임 항목 후보로 불러온다.
  const [rosterScope, setRosterScope] = useState<RosterScope>('class');
  const [roster, setRoster] = useState<GameItem[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setRoster([]);
    if (!academy?.id || !classId) {
      setRoster([]);
      return;
    }
    setRosterLoading(true);
    const fetcher = rosterScope === 'academy' ? fetchStudentsOfAcademy(academy.id) : fetchStudentsOfClass(classId);
    fetcher
      .then((students) => { if (active) setRoster(students.map((s) => ({ id: s.id, label: s.name }))); })
      .catch((err) => notify(err instanceof Error ? err.message : String(err), 'error'))
      .finally(() => { if (active) setRosterLoading(false); });
    return () => { active = false; };
  }, [academy?.id, classId, rosterScope, notify]);

  // 선생님이 이 반/학원에 만들어둔 단어장 목록 — WordListPicker 가 그대로 보여준다.
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [allWordLists, setAllWordLists] = useState<WordList[]>([]);
  const [wordListsLoading, setWordListsLoading] = useState(false);
  const listSequence = useRef(0);

  const standalone = !!workspace && !embed && !presenting;
  const reloadWordLists = useCallback(async () => {
    const sequence = ++listSequence.current;
    setAllWordLists([]); setWordLists([]);
    if (!academy?.id) {
      setWordLists([]);
      return;
    }
    setWordListsLoading(true);
    try {
      const lists = standalone ? await fetchAllWordLists(academy.id, 'all') : await fetchWordLists(academy.id, classId || '', 'all');
      if (sequence !== listSequence.current) return;
      setAllWordLists(lists);
      setWordLists(listKind === 'all' ? lists : lists.filter((list) => (list.kind || 'word') === listKind));
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      if (sequence === listSequence.current) setWordListsLoading(false);
    }
  }, [academy?.id, classId, notify, listKind, standalone]);

  useEffect(() => {
    void reloadWordLists();
  }, [reloadWordLists]);

  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedWorkspaceKey, setLoadedWorkspaceKey] = useState('');
  const loadSequence = useRef(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<'class' | 'academy'>('class');

  const temporary = isStaff && !!workspace && !embed && !presenting;
  const temporaryId = session?.user.id && academy?.id ? draftId(session.user.id, academy.id, gameType) : '';
  function makeDraft(source?: OpenState['quickSource']): GameTemplate {
    const kind = source?.kind || (listKind === 'sentence' ? 'sentence' : 'word');
    const cards = source?.cards || params.sampleCards?.() || sampleActivityCards(kind);
    const content = !source && gamePreparation(gameType).dedicated ? null : prepareClassroomGame(gameType, cards, kind);
    if (source && !content) throw new Error('incompatible_content');
    if (source?.id && session?.user.id && academy?.id) rememberSourceUse(session.user.id, academy.id, source.id);
    const now = new Date().toISOString();
    return { id: `${temporaryId}:${crypto.randomUUID()}`, academy_id: academy!.id, class_id: null, game_type: gameType,
      name: source?.name || t('quick.sampleTitle'), created_by: profile?.id || null, created_at: now, updated_at: now,
      items: content?.items || defaultItems(), config: { ...defaultConfig?.(), ...content?.config,
        ...(content ? { classroomSource: { id: source?.id || 'temporary', name: source?.name || t('quick.sampleTitle'), kind, version: '', cards: structuredClone(cards) } } : {}) } };
  }
  function chooseDraft(draft: GameTemplate) {
    writeActivityDraft(draft);
    setTemplates(old => [draft, ...old.filter(row => !isActivityDraft(row.id))]);
    setSelectedId(draft.id);
  }
  useEffect(() => {
    const sync = (event: Event) => {
      if ((event as CustomEvent).detail !== temporaryId) return;
      const draft = readActivityDraft(temporaryId);
      if (draft) setTemplates(old => old.map(row => row.id === draft.id ? draft : row));
    };
    window.addEventListener(DRAFT_EVENT, sync);
    return () => window.removeEventListener(DRAFT_EVENT, sync);
  }, [temporaryId]);

  // Factories passed by game pages are often inline. Read their latest values
  // without restarting the network load on every game edit.
  const draftFactory = useRef(makeDraft); draftFactory.current = makeDraft;
  const routeState = useRef(location.state); routeState.current = location.state;
  const consumedSource = useRef('');
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!academy?.id || (!classId && !temporary)) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchGameTemplates(academy.id, classId || '', gameType);
      if (sequence !== loadSequence.current) return;
      const source = ownedQuickSource((routeState.current as OpenState | null)?.quickSource, session?.user.id, academy?.id);
      const hasNewSource = !!source && consumedSource.current !== location.key;
      const draft = temporary && temporaryId ? (hasNewSource ? draftFactory.current(source) : readActivityDraft(temporaryId) || draftFactory.current()) : null;
      consumedSource.current = location.key;
      if (draft) writeActivityDraft(draft);
      setTemplates(draft ? [draft, ...rows] : rows);
      // 한 번 반영한 openTemplateId 는 비워서, 나중에 선생님이 다른 템플릿을 고른 뒤 목록을 다시
      // 불러와도 선택이 도로 튀지 않게 한다.
      const openId = openTemplateIdRef.current;
      const openFound = !!openId && rows.some((r) => r.id === openId);
      if (openFound) openTemplateIdRef.current = undefined;
      setSelectedId((prev) => {
        if (openFound) return openId as string;
        if (hasNewSource && draft) return draft.id;
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return draft?.id ?? rows[0]?.id ?? null;
      });
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      if (temporary && temporaryId) chooseDraft(readActivityDraft(temporaryId) || draftFactory.current());
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      if (sequence === loadSequence.current) { setLoadedWorkspaceKey(`${classId}:${gameType}`); setLoading(false); }
    }
  }, [academy?.id, session?.user.id, classId, gameType, notify, temporary, temporaryId, location.key]);

  useEffect(() => {
    void load();
  }, [load]);

  // 같은 게임이 연속 슬라이드면 페이지가 다시 마운트되지 않아 위 ref 가 첫 값에 머문다 — 이동할
  // 때마다(location.key) 다시 읽고, 그 템플릿이 이미 불러온 목록에 있으면 바로 고른다. 레슨의 반이
  // 지금 보고 있는 반과 다르면 반부터 맞춘다(그러면 load 가 그 반 목록으로 다시 돈다).
  useEffect(() => {
    if (embedRef.current) return; // 편집 화면 안에서는 주소가 커리큘럼 페이지라 읽을 게 없다.
    const state = location.state as OpenState | null;
    openTemplateIdRef.current = state?.openTemplateId;
    if (isStaff && state?.openClassId) chooseClass(state.openClassId);
    const openId = state?.openTemplateId;
    if (openId && templates.some((r) => r.id === openId)) {
      openTemplateIdRef.current = undefined;
      setSelectedId(openId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // 편집 화면 안: 선생님이 고른(또는 새로 만든) 템플릿을 슬라이드의 "발표 때 열 내용"으로 되돌려 준다.
  const reportedRef = useRef<string | null | undefined>(embed?.templateId);
  useEffect(() => {
    if (!embedRef.current || loading) return;
    if (selectedId === (reportedRef.current ?? null)) return;
    reportedRef.current = selectedId;
    embedRef.current.onSelect(selectedId);
  }, [loading, selectedId]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  /** explicitName을 주면(인라인 편집 등) prompt() 없이 그 값으로 바로 바꾼다. 안 주면 기존처럼 prompt로 물어본다. */
  async function handleRename(explicitName?: string) {
    if (!selected) return;
    const next = explicitName ?? prompt(t('gameAdmin.renamePrompt'), selected.name);
    if (!next?.trim() || next.trim() === selected.name) return;
    const ok = await run(() => renameGameTemplate(selected.id, next.trim()), t('gameAdmin.renamedToast'));
    if (ok) setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, name: next.trim() } : tpl)));
  }

  /** id 를 안 주면 현재 선택된 템플릿을 지운다 — 목록 칩의 개별 삭제 버튼은 id 를 직접 넘긴다. */
  async function handleDeleteTemplate(id?: string) {
    const target = id ? templates.find((tpl) => tpl.id === id) : selected;
    if (!target) return;
    if (isActivityDraft(target.id)) { chooseDraft(makeDraft()); return; }
    if (!confirm(t('gameAdmin.deleteConfirm', { name: target.name }))) return;
    const ok = await run(() => deleteGameTemplate(target.id), t('gameAdmin.deletedToast'));
    if (ok) {
      setSelectedId((prev) => (prev === target.id ? null : prev));
      await load();
    }
  }

  /** explicitName을 주면(이름 입력 없이 바로 만들기 등) newName 상태와 무관하게 그 이름으로 만든다. */
  const createLock = useRef(false);
  async function handleCreate(explicitName?: string) {
    if (!academy?.id || !profile || createLock.current) return false;
    createLock.current = true;
    const name = activityName(explicitName ?? newName, t(GAME_CATALOG.find(game => game.type === gameType)?.nameKey || 'flow.defaultActivity'), templates.filter(row=>!isActivityDraft(row.id)).map(row=>row.name));
    setSubmitting(true);
    const ok = await run(async () => {
      const tpl = await createGameTemplate({
        academyId: academy.id,
        classId: newScope === 'class' ? classId : null,
        gameType,
        name,
        items: selected && isActivityDraft(selected.id) ? structuredClone(selected.items) : defaultItems(),
        config: selected && isActivityDraft(selected.id) ? structuredClone(selected.config) : defaultConfig?.() ?? {},
        teacherId: profile.id,
      });
      setTemplates((prev) => [...prev, tpl]);
      setSelectedId(tpl.id);
    }, t('gameAdmin.createdToast'));
    createLock.current = false;
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
    if (temporary && classroomSource) { await switchClassroomGame(targetType); return; }
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

  async function useClassroomList(list: WordList) {
    if (presenting && lessonRunner.runner?.view) throw new Error('stop_shared_view_first');
    if (temporary) { chooseDraft(makeDraft({ cards: wordListToCards(list), kind: list.kind || 'word', name: list.name, id: list.id })); return; }
    if (!academy?.id || !profile || !classId) throw new Error('no_class');
    const content = prepareClassroomGame(gameType, list);
    if (!content) throw new Error('incompatible_content');
    const existing = templates.find((tpl) => tpl.class_id === classId && tpl.config.classroomSource?.id === list.id && tpl.config.classroomSource.version === list.updated_at);
    if (existing) { setSelectedId(existing.id); return; }
    const tpl = await createGameTemplate({ academyId: academy.id, classId, gameType, name: list.name, teacherId: profile.id,
      items: content.items, config: { ...defaultConfig?.(), ...content.config, classroomSource: { id: list.id, name: list.name, kind: list.kind || 'word', version: list.updated_at, cards: wordListToCards(list) } } });
    // A late response from a previously selected class must not replace the current class's screen.
    if (workspaceClass.current !== classId) return;
    setTemplates((prev) => [...prev, tpl]); setSelectedId(tpl.id);
  }
  const workspaceClass = useRef(classId); workspaceClass.current = classId;
  const lessonCards = (location.state as OpenState | null)?.materialsWords;
  const inferredSource = useMemo(() => {
    if (!selected || selected.config.classroomSource) return undefined;
    const pairs = selected.config.pairs || selected.config.flashcards;
    const cards: FullCardItem[] = pairs ? pairs.map(pair => ({ id: pair.id, word: pair.left, meaning: pair.right, imageUrl: null }))
      : selected.items.filter(item => item.label.trim()).map(item => ({ id: item.id, word: item.label, meaning: '', imageUrl: null }));
    return cards.length ? { id: `activity:${selected.id}`, name: selected.name, kind: (gameType === 'unscramble' || gameType === 'sentencesplash' ? 'sentence' : 'word') as 'word' | 'sentence', version: selected.updated_at, cards } : undefined;
  }, [selected, gameType]);
  const classroomSource = selected?.config.classroomSource || (lessonCards?.length ? { id: `lesson:${lessonRunner.runner?.lessonId}`, name: lessonRunner.runner?.lessonName || '수업 자료', kind: (lessonCards.every((c) => c.word.trim().split(/\s+/).length >= 2) ? 'sentence' : 'word') as 'word'|'sentence', version: '', cards: lessonCards } : undefined) || inferredSource;
  const teamKey = ({ fourclues: 'clueTeams', catchsentence: 'catchTeams', lastbox: 'boxTeams', mysterybox: 'boxTeams', treasuredig: 'digTeams', shufflefind:'shuffleTeams',telepathy:'telepathyTeams',saveorgive:'saveOrGiveTeamCount' } as Partial<Record<GameType, 'clueTeams'|'catchTeams'|'boxTeams'|'digTeams'|'shuffleTeams'|'telepathyTeams'|'saveOrGiveTeamCount'>>)[gameType];
  async function configureTeams(count: number) {
    if (presenting && lessonRunner.runner?.view) throw new Error('stop_shared_view_first');
    if (!teamKey || !academy?.id || !profile) return;
    if (temporary && selected && isActivityDraft(selected.id)) { chooseDraft({ ...selected, config: { ...selected.config, [teamKey]: count } }); return; }
    if (!classId) return;
    const config = { ...(selected?.config || defaultConfig?.() || {}), [teamKey]: count };
    if (selected) {
      const { updateGameTemplate } = await import('./api');
      await updateGameTemplate(selected.id, { config });
      setTemplates((old) => old.map((tpl) => tpl.id === selected.id ? { ...tpl, config } : tpl));
    } else {
      const tpl = await createGameTemplate({ academyId:academy.id,classId,gameType,name:'이번 수업',items:defaultItems(),config,teacherId:profile.id });
      setTemplates((old) => [...old,tpl]); setSelectedId(tpl.id);
    }
  }
  async function switchClassroomGame(targetType: GameType) {
    if (presenting && lessonRunner.runner?.view) throw new Error('stop_shared_view_first');
    if (temporary && classroomSource) {
      if (!prepareClassroomGame(targetType, classroomSource.cards, classroomSource.kind)) throw new Error('incompatible_content');
      navigate(`/games/${targetType}`, { state: { quickSource: { ownerId: session?.user.id, academyId: academy?.id, cards: classroomSource.cards, kind: classroomSource.kind, name: classroomSource.name, id: classroomSource.id } } }); return;
    }
    if (!academy?.id || !profile || !classroomSource || !classId) throw new Error('no_source');
    const source = classroomSource;
    const content = prepareClassroomGame(targetType, source.cards, source.kind);
    if (!content) throw new Error('incompatible_content');
    const tpl = await createGameTemplate({ academyId: academy.id, classId, gameType: targetType, name: source.name, teacherId: profile.id, items: content.items, config: { ...content.config, classroomSource: structuredClone(source) } });
    if (workspaceClass.current === classId) {
      const state = { openTemplateId: tpl.id, openClassId: classId, materialsWords: source.cards };
      if (presenting) lessonRunner.replaceGame(targetType, tpl.id, state);
      else navigate(`/games/${targetType}`, { state });
    }
  }
  async function beginMaterial(kind: 'word' | 'sentence') {
    if (!temporary || !temporaryId) return;
    const recovered = readComposition(temporaryId, kind);
    if (recovered) { chooseDraft(recovered); return; }
    const draft = makeDraft();
    const legacy = session?.user.id && academy?.id ? legacyActivityInput(session.user.id, academy.id, kind) : null;
    const restored = legacy && prepareClassroomGame(gameType, legacy, kind);
    if (legacy && restored) { chooseDraft({ ...draft, items: restored.items, config: { ...defaultConfig?.(), ...restored.config, classroomSource:{ id:'composition', name:t(kind==='sentence'?'flow.newSentences':'flow.newWords'), kind, version:'',cards:legacy } } }); return; }
    chooseDraft({ ...draft, name: t(kind === 'sentence' ? 'flow.newSentences' : 'flow.newWords'), items: [],
      config: { ...defaultConfig?.(), pairs: [], flashcards: [], questions: [], statements: [], groups: [], typeAnswerEntries: [], imageQuizItems: [], liveQuestions: [],
        classroomSource: { id: 'composition', name: t(kind === 'sentence' ? 'flow.newSentences' : 'flow.newWords'), kind, version: '', cards: [] } } });
  }
  const materialSaveLock = useRef(false);
  const activeOwner = useRef(''); activeOwner.current = `${session?.user.id}:${academy?.id}`;
  async function saveMaterial(name: string) {
    if (materialSaveLock.current || !academy || !profile || !selected) throw new Error('invalid_material');
    materialSaveLock.current = true;
    const ownerAtStart = activeOwner.current;
    try {
      const current = isActivityDraft(selected.id) ? readActivityDraft(selected.id) || selected : selected;
      const source = current.config.classroomSource || classroomSource;
      if (!source?.cards.length || !prepareClassroomGame(gameType, source.cards, source.kind)) throw new Error('invalid_content');
      const list = await createWordList({ academyId: academy.id, teacherId: profile.id, classId: null, name: activityName(name,t(source.kind==='sentence'?'flow.defaultSentences':'flow.defaultWords'),allWordLists.map(list=>list.name)), kind: source.kind,
        items: source.cards.map(card => ({ id: card.id, word: card.word, meaning: card.meaning, image_url: card.imageUrl, category: card.category || null, partOfSpeech: card.partOfSpeech, patternMarked: card.patternMarked })) });
      if (activeOwner.current !== ownerAtStart) throw new Error('owner_changed');
      rememberSourceUse(session!.user.id, academy.id, list.id);
      setAllWordLists(old => [list, ...old.filter(row => row.id !== list.id)]);
      if (isActivityDraft(current.id)) chooseDraft({ ...current, config: { ...current.config, classroomSource: { ...source, id: list.id, name: list.name, version: list.updated_at } } });
    } finally { materialSaveLock.current = false; }
  }
  // Refresh action closures each render. publish compares data identities before updating its state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!workspace || !isStaff) return;
    workspace.publish({ gameType, classId, sharedView:!!lessonRunner.runner?.view, academyId: academy?.id || '', classes, roster, lists: allWordLists, templates, selected, loading,
      applyGuide: async (content) => {
        if (!temporary || !selected || lessonRunner.runner?.view) throw new Error('guide_not_available');
        const draft = isActivityDraft(selected.id) ? selected : makeDraft();
        // Native editors synchronize their local question state on selection changes.
        // A fresh revision ID applies guided content without remounting the workspace.
        chooseDraft({ ...draft, id:`${temporaryId}:${crypto.randomUUID()}`, items: structuredClone(content.items), config: structuredClone(content.config) });
      },
      sampleGuide: async () => {
        if (!temporary || lessonRunner.runner?.view) throw new Error('guide_not_available');
        const draft=makeDraft();const content=guideSample(gameType,draft);chooseDraft({...draft,...content});
      },
      selectClass: chooseClass, selectTemplate: setSelectedId, useList: useClassroomList, switchGame: switchClassroomGame, sourceCards: classroomSource?.cards || null,
      renameActivity: () => handleRename(), beginMaterial, saveMaterial, temporary, useSource: async (source) => { chooseDraft(makeDraft(source)); },
      saveActivity: async (name) => { if (!await handleCreate(name)) throw new Error('save_failed'); },
      teamCount: teamKey ? (selected?.config[teamKey] || defaultConfig?.()[teamKey] || 2) : undefined, configureTeams });
  });

  return {
    /** 커리큘럼 "발표하기" 중 — 페이지는 편집 UI(EditOnly)를 숨기고 재생 영역만 보여준다. */
    presenting,
    // 게임 페이지에서 isStaff 는 전부 "편집 UI를 보여줄지"(편집 패널·새로 만들기·삭제·게임판 안
    // 편집·퀴즈 편집 모드·돌림판 자동 생성)에만 쓰인다 — 발표 중엔 false 로 돌려줘서 35개 페이지를
    // 하나하나 고치지 않고도 편집이 전부 사라지게 한다. 데이터 로딩(classId 등)은 위에서 진짜
    // isStaff 로 이미 계산했으니 영향 없다.
    isStaff: isStaff && (!presenting || !!workspace),
    academy,
    classes,
    noClasses,
    staffClassId,
    selectClass: chooseClass,
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
    loading: loading || classesLoading || (!!classId && loadedWorkspaceKey !== `${classId}:${gameType}`),
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
