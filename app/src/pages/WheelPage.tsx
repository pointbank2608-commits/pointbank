import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ClassChipRow from '../components/ClassChipRow';
import GameInfoPanel from '../components/GameInfoPanel';
import GameMusicPicker from '../components/GameMusicPicker';
import GameThemeFrame, { useGamePlay } from '../components/GameThemeFrame';
import ImportFromClass from '../components/ImportFromClass';
import OpenInOtherGame from '../components/OpenInOtherGame';
import SpinWheel from '../components/SpinWheel';
import StudentRosterPicker from '../components/StudentRosterPicker';
import WordListPicker from '../components/WordListPicker';
import DictionaryPicker from '../components/DictionaryPicker';
import { useToast } from '../context/ToastContext';
import { updateGameTemplate } from '../lib/api';
import { resolveResultSound } from '../lib/gameMusic';
import i18n from '../i18n';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { GameItem, MusicSelection } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  return [1, 2, 3].map((n) => ({ id: uid(), label: i18n.t('gameWheel.defaultItem', { n }) }));
}

/** 돌림판 회전음은 커스터마이즈 UI 없이 이 파일로 고정한다(선생님이 신경 쓸 일 없게).
 * path/name 은 업로드 삭제 UI용 필드라 여기선 의미 없음 — 표시용 값만 채워둔다.
 * ?v= 는 캐시 무력화용 — 같은 경로의 파일을 다시 바꿔치기했을 때 이미 방문했던
 * 브라우저가 예전 버전을 계속 캐시해서 트는 문제가 있어서, 내용을 바꿀 때마다 올린다. */
const WHEEL_SPIN_SOUND: MusicSelection = {
  kind: 'upload',
  path: '',
  name: '돌림판 회전음',
  url: '/sounds/wheel-spin.mp3?v=2',
};

/** 최근 결과 목록. 전체화면 중엔 안 보여준다 — 스핀 후 이게 새로 나타나면 GameThemeFrame의
 * 크기 계산에 들어가는 형제 요소 높이가 늘어나서, 정작 중요한 돌림판이 갑자기 작아져
 * 보였다(사용자 피드백으로 발견). useGamePlay()는 GameThemeFrame의 Provider 밑에서
 * 실제로 렌더되는 컴포넌트여야 값이 제대로 읽혀서, WheelPage 안에 인라인으로 두지 않고
 * 별도 컴포넌트로 뺐다. */
function RecentResults({ recent }: { recent: { id: string; label: string; at: number }[] }) {
  const { t } = useTranslation();
  const { fullscreen } = useGamePlay();
  if (fullscreen || recent.length === 0) return null;
  return (
    <div className="mt-5 pt-5 border-t border-surface-container">
      <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameWheel.recentResults')}</div>
      <div className="flex flex-wrap gap-1.5">
        {recent.map((r, i) => (
          <span key={r.at} className="px-3 py-1 rounded-full font-label-md text-label-md bg-surface-container-low text-on-surface">
            {i === 0 && '🎉 '}
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function WheelPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({ gameType: 'wheel', defaultItems });
  const {
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
    newScope,
    setNewScope,
    handleCreate,
    handleRename,
    handleDeleteTemplate,
    scopeLabel,
    openInOtherGame,
    importCandidates,
    importFromClass,
    reload,
  } = g;
  const { notify } = useToast();

  const [playItems, setPlayItems] = useState<GameItem[]>([]);
  const [eliminateMode, setEliminateMode] = useState(false);
  const [recent, setRecent] = useState<{ id: string; label: string; at: number }[]>([]);
  const [editorOpen, setEditorOpen] = useState(true);
  const [roundKey, setRoundKey] = useState(0);
  const demoItems = useMemo(defaultItems, []);
  const [newItemLabel, setNewItemLabel] = useState('');

  // 선택된 돌림판이 바뀌면 플레이용 사본을 새로 받고, 결과 기록을 비운다.
  useEffect(() => {
    setPlayItems(selected?.items ?? []);
    setRecent([]);
  }, [selected]);

  // 이 반에 돌림판이 하나도 없으면, "+ 새 돌림판" 클릭 없이 바로 기본 돌림판을 하나
  // 만들어준다 — 이름 입력·만들기 클릭 같은 절차 없이 처음부터 이름 수정·항목 +/- 를
  // 바로 쓸 수 있게 하기 위함(이름은 나중에 화면에서 탭해서 바꾸면 됨).
  // sessionStorage 가드: 짧은 시간에 페이지를 여러 번 열거나 리렌더가 겹치면(네트워크
  // 지연 중 재방문 등) templates 상태가 아직 갱신되기 전에 두 번 만들어버릴 수 있어서,
  // 이 반은 이번 브라우저 세션에서 한 번만 시도하도록 탭 단위로 기억해둔다.
  const autoCreatingRef = useRef(false);
  useEffect(() => {
    if (!isStaff || loading || !classId || templates.length > 0 || autoCreatingRef.current) return;
    const guardKey = `wheel-autocreate-${classId}`;
    try {
      if (sessionStorage.getItem(guardKey)) return;
      sessionStorage.setItem(guardKey, '1');
    } catch {
      // sessionStorage 접근이 막혀 있어도(프라이빗 모드 등) 자동 생성 자체는 계속 진행한다.
    }
    autoCreatingRef.current = true;
    void handleCreate(t('gameWheel.defaultTemplateName')).finally(() => {
      autoCreatingRef.current = false;
    });
  }, [isStaff, loading, classId, templates.length, handleCreate, t]);

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

  async function persistItems(next: GameItem[]): Promise<boolean> {
    if (!selected) return false;
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, items: next } : tpl)));
    try {
      await updateGameTemplate(selected.id, { items: next });
      return true;
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
      await reload();
      return false;
    }
  }

  async function addItem() {
    const label = newItemLabel.trim();
    if (!label || !selected) return;
    if (await persistItems([...selected.items, { id: uid(), label }])) notify(t('gameAdmin.itemAddedToast'));
    setNewItemLabel('');
  }

  async function addItemsBulk(labels: string[]) {
    if (!selected || labels.length === 0) return;
    if (await persistItems([...selected.items, ...labels.map((label) => ({ id: uid(), label }))])) {
      notify(t('gameAdmin.itemsAddedToast', { count: labels.length }));
    }
  }

  async function removeItem(itemId: string) {
    if (!selected) return;
    await persistItems(selected.items.filter((i) => i.id !== itemId));
  }

  /** 돌림판에서 조각을 탭해서 바로 이름을 바꿀 때 쓴다. */
  async function renameItemLabel(itemId: string, label: string) {
    if (!selected) return;
    await persistItems(selected.items.map((i) => (i.id === itemId ? { ...i, label } : i)));
  }

  async function clearAllItems() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm(t('gameWheel.clearAllConfirm'))) return;
    await persistItems([]);
  }

  async function addQuickItem() {
    if (!selected) return;
    const n = selected.items.length + 1;
    if (await persistItems([...selected.items, { id: uid(), label: i18n.t('gameWheel.defaultItem', { n }) }])) {
      notify(t('gameAdmin.itemAddedToast'));
    }
  }

  async function removeLastItem() {
    if (!selected || selected.items.length <= 1) return;
    await persistItems(selected.items.slice(0, -1));
  }

  async function handleResultSoundChange(resultSound: MusicSelection | null) {
    if (!selected) return;
    const nextConfig = { ...selected.config, resultSound };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
      await reload();
    }
  }

  /* ---------------- 렌더 ---------------- */

  if (isStaff && classes.length === 0) {
    return (
      <div className="text-center py-16 font-body-md text-on-surface-variant">
        {t('gameAdmin.noClasses')}
      </div>
    );
  }
  if (!isStaff && !classId) {
    return <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>;
  }

  const classPicker = isStaff ? (
    <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />
  ) : (
    <h2 className="font-title-md text-title-md text-on-surface">
      {t('gameWheel.studentClassTitle', { className: studentClassName })}
    </h2>
  );

  const templateRow = (
    <div className="flex flex-wrap gap-2">
      {templates.map((tpl) => (
        <div
          key={tpl.id}
          className={`flex items-center rounded-full overflow-hidden ${
            tpl.id === selectedId
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40'
          }`}
        >
          <button
            onClick={() => setSelectedId(tpl.id)}
            className="pl-4 pr-2 py-2 font-label-md text-label-md flex items-center gap-1.5"
          >
            {tpl.name}
            <span className="font-caption text-caption opacity-70">{scopeLabel(tpl)}</span>
          </button>
          {isStaff && (
            <button
              type="button"
              title={t('gameAdmin.delete')}
              onClick={() => void handleDeleteTemplate(tpl.id)}
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
          className="px-6 py-3 rounded-full font-label-md text-label-md bg-primary text-on-primary hover:bg-primary-container shadow-sm transition-colors"
        >
          {t('gameWheel.newButton')}
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)] space-y-4">
      <div>
        <label className="font-label-md text-label-md text-on-surface-variant block mb-1.5">{t('gameAdmin.visibilityLabel')}</label>
        <div className="flex bg-surface-container-low rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setNewScope('class')}
            className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              newScope === 'class' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            {t('gameAdmin.scopeInClassOnly')}
          </button>
          <button
            type="button"
            onClick={() => setNewScope('academy')}
            className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
              newScope === 'academy' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            {t('gameAdmin.scopeAcademyWide')}
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => void handleCreate(t('gameWheel.defaultTemplateName'))}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 hover:bg-primary-container transition-colors"
        >
          {submitting ? t('gameAdmin.creating') : t('gameAdmin.create')}
        </button>
        <button
          onClick={() => setShowCreateForm(false)}
          className="px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          {t('gameAdmin.cancel')}
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
        {t('gameAdmin.backToList')}
      </Link>

      <GameInfoPanel
        description={t('gameWheel.infoDescription')}
        steps={t('gameWheel.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          {classPicker}
          <div>
            <GameThemeFrame roster={roster} className="bg-[#fffdf8] rounded-[28px] p-6 md:p-8 shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
              <SpinWheel items={demoItems} />
            </GameThemeFrame>
            <div className="mt-3 text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameWheel.emptyStaff') : t('gameWheel.emptyStudent')}
            </div>
          </div>
          {templateRow}
          {createForm}
        </div>
      ) : (
        <div className="space-y-6">
          {!isStaff && (
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
              {selected.name}
            </h2>
          )}

          <GameThemeFrame
            roster={roster}
            onRestart={() => setRoundKey((k) => k + 1)}
            className="bg-[#fffdf8] rounded-[28px] p-6 md:p-8 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
          >
            <SpinWheel key={roundKey}
              items={playItems}
              music={WHEEL_SPIN_SOUND}
              resultSound={resolveResultSound(selected.config.resultSound)}
              onResult={handleResult}
              editable={isStaff}
              onEditItem={(id, label) => void renameItemLabel(id, label)}
              templateName={selected.name}
              onRenameTemplate={(name) => void handleRename(name)}
              onAddItem={() => void addQuickItem()}
              onRemoveItem={() => void removeLastItem()}
            />

            <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
              <label className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  checked={eliminateMode}
                  onChange={(e) => setEliminateMode(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                {t('gameWheel.eliminateMode')}
              </label>
              {playItems.length !== selected.items.length && (
                <button onClick={resetPlayItems} className="font-label-md text-label-md text-primary hover:underline">
                  {t('gameWheel.resetItems')}
                </button>
              )}
            </div>

            <RecentResults recent={recent} />
          </GameThemeFrame>

          <div className="space-y-4">
            {classPicker}
            {templateRow}
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_4px_20px_rgba(39,101,168,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameWheel.settingsTitle')}</h4>
                  <button
                    onClick={() => setEditorOpen((v) => !v)}
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    {editorOpen ? t('gameAdmin.collapse') : t('gameAdmin.expand')}
                  </button>
                </div>

                {editorOpen && (
                  <div className="space-y-1 divide-y divide-surface-container">
                    <OpenInOtherGame currentType="wheel" itemCount={selected.items.length} onOpen={openInOtherGame} />
                    <ImportFromClass candidates={importCandidates} offerRosterSwap onImport={importFromClass} />
                    {academy && (
                      <GameMusicPicker
                        academyId={academy.id}
                        isStaff={isStaff}
                        label={t('gameWheel.resultSoundLabel')}
                        value={resolveResultSound(selected.config.resultSound)}
                        onChange={(m) => void handleResultSoundChange(m)}
                      />
                    )}

                    <div className="pt-3">
                      <StudentRosterPicker
                        roster={roster}
                        existingLabels={selected.items.map((i) => i.label)}
                        scope={rosterScope}
                        onScopeChange={setRosterScope}
                        loading={rosterLoading}
                        onAdd={(labels) => void addItemsBulk(labels)}
                      />
                    <div className="flex flex-wrap items-start gap-3 my-3">
                    <WordListPicker
                      variant="label"
                      wordLists={wordLists}
                      loading={wordListsLoading}
                      onImportLabels={(labels) => void addItemsBulk(labels)}
                    />
                    <DictionaryPicker
                      variant="label"
                      onImportLabels={(labels) => void addItemsBulk(labels)}
                    />
                    </div>

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {selected.items.length === 0 ? (
                          <span className="font-caption text-caption text-on-surface-variant">
                            {t('gameAdmin.noParticipants')}
                          </span>
                        ) : (
                          selected.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface"
                            >
                              {item.label}
                              <button
                                onClick={() => void removeItem(item.id)}
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
                          onClick={() => void clearAllItems()}
                          className="mt-2 font-label-md text-label-md text-error hover:underline"
                        >
                          {t('gameAdmin.clearAll')}
                        </button>
                      )}
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          placeholder={t('gameWheel.newItemPlaceholder')}
                          value={newItemLabel}
                          onChange={(e) => setNewItemLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void addItem();
                          }}
                          className="flex-1 min-w-0 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <button
                          onClick={() => void addItem()}
                          className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors whitespace-nowrap"
                        >
                          {t('gameAdmin.addParticipant')}
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
