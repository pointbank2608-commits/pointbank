import { useRecoverableField } from '../lib/useRecoverableField';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import EditOnly from '../components/EditOnly';
import ClassChipRow from '../components/ClassChipRow';
import Telepathy from '../components/Telepathy';
import { normalizeTelepathyConfig, TELEPATHY_DEFAULTS, TELEPATHY_SECONDS } from '../lib/telepathy';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import SentenceBankPicker from '../components/SentenceBankPicker';
import ImportFromClass from '../components/ImportFromClass';
import OpenInOtherGame from '../components/OpenInOtherGame';
import WordListPicker from '../components/WordListPicker';
import DictionaryPicker from '../components/DictionaryPicker';
import { updateGameTemplate } from '../lib/api';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { FullCardItem, GameItem } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  return ['cat | 고양이', 'dog | 강아지', 'mouse | 쥐', 'bird | 새', 'fish | 물고기', 'rabbit | 토끼'].map((label) => ({ id: uid(), label }));
}

export default function TelepathyPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'telepathy',
    defaultItems,
    defaultConfig: () => ({ telepathyTeams: TELEPATHY_DEFAULTS.teams, telepathyChoices: TELEPATHY_DEFAULTS.choices, telepathyRounds: TELEPATHY_DEFAULTS.rounds, telepathySeconds: TELEPATHY_DEFAULTS.seconds }),
    // 단어장과 문장 목록을 둘 다 불러온다 — 낱말도 문장도 컵 아래에 붙는다
    listKind: 'all',
  });
  const {
    isStaff,
    classes,
    staffClassId,
    selectClass,
    reorderClasses,
    studentClassName,
    classId,
    roster,
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
    handleDeleteTemplate,
    scopeLabel,
    openInOtherGame,
    importCandidates,
    importFromClass,
    reload,
  } = g;
  const { notify } = useToast();

  const [editorOpen, setEditorOpen] = useState(true);
  const [roundKey, setRoundKey] = useState(0);
  const demoItems = useMemo(defaultItems, []);
  const [newItemLabel, setNewItemLabel] = useRecoverableField('game:telepathy:newItemLabel');
  const cfg = normalizeTelepathyConfig(selected?.config);

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

  /** 문장 목록의 문장(+해석)을 "영어 | 해석" 한 줄로 담는다 */
  async function addSentences(cards: FullCardItem[]) {
    const labels = cards.map((c) => (c.meaning.trim() ? `${c.word.trim()} | ${c.meaning.trim()}` : c.word.trim())).filter(Boolean);
    await addItemsBulk(labels);
  }

  async function removeItem(itemId: string) {
    if (!selected) return;
    await persistItems(selected.items.filter((i) => i.id !== itemId));
  }

  async function clearAllItems() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm(t('gameTelepathy.clearAllConfirm'))) return;
    await persistItems([]);
  }

  async function commitConfig(patch: { telepathyTeams?: number; telepathyChoices?: number; telepathyRounds?: number; telepathySeconds?: number }) {
    if (!selected) return;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const nextConfig = { ...selected.config, ...clean };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  if (g.noClasses) {
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
      {t('gameTelepathy.studentClassTitle', { className: studentClassName })}
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
          {t('gameTelepathy.newButton')}
        </button>
      )}
    </div>
  );

  const createForm = isStaff && showCreateForm && (
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-card space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-tertiary-container/40 px-3 py-2.5 font-caption text-caption text-on-surface">
        <span aria-hidden="true">💬</span>
        <span>{t('gameAdmin.createHelp')}</span>
      </div>
      <div>
        <label htmlFor="hmname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="hmname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameTelepathy.namePlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreate();
          }}
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
      </div>
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
          onClick={() => void handleCreate()}
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
      <EditOnly>
      <Link
        to="/games"
        className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
      >
        {t('gameAdmin.backToList')}
      </Link>
      </EditOnly>

      <GameInfoPanel
        description={t('gameTelepathy.infoDescription')}
        steps={t('gameTelepathy.infoSteps', { returnObjects: true }) as string[]}
      />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          <EditOnly>{classPicker}</EditOnly>
          <div>
            <GameThemeFrame gameType="telepathy" roster={roster} className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
              <Telepathy items={demoItems} teams={cfg.teams} choices={cfg.choices} rounds={cfg.rounds} seconds={cfg.seconds} />
            </GameThemeFrame>
            <div className="mt-3 text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameTelepathy.emptyStaff') : t('gameTelepathy.emptyStudent')}
            </div>
          </div>
          <EditOnly>{templateRow}</EditOnly>
          {createForm}
        </div>
      ) : (
        <div className="space-y-6">
          {!isStaff && (
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
              {selected.name}
            </h2>
          )}

          <GameThemeFrame gameType="telepathy"
            roster={roster}
            onRestart={() => setRoundKey((k) => k + 1)}
            className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
          >
            <Telepathy key={roundKey} items={selected.items} teams={cfg.teams} choices={cfg.choices} rounds={cfg.rounds} seconds={cfg.seconds} />
          </GameThemeFrame>

          <div className="space-y-4">
            <EditOnly>{classPicker}</EditOnly>
            <EditOnly>{templateRow}</EditOnly>
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameTelepathy.settingsTitle')}</h4>
                  <button
                    onClick={() => setEditorOpen((v) => !v)}
                    className="font-label-md text-label-md text-primary hover:underline"
                  >
                    {editorOpen ? t('gameAdmin.collapse') : t('gameAdmin.expand')}
                  </button>
                </div>

                {editorOpen && (
                  <div className="space-y-1 divide-y divide-surface-container">
                    <div className="pt-3">
                    <div className="flex flex-wrap items-start gap-2 my-3 [&>*]:min-w-[180px] [&>*]:flex-none">
                    <WordListPicker
                      variant="label"
                      wordLists={wordLists.filter((l) => l.kind !== 'sentence')}
                      loading={wordListsLoading}
                      onImportLabels={(labels) => void addItemsBulk(labels)}
                    />
                    <WordListPicker
                      variant="full"
                      kind="sentence"
                      wordLists={wordLists.filter((l) => l.kind === 'sentence')}
                      loading={wordListsLoading}
                      onImportFull={(cards) => void addSentences(cards)}
                    />
                    <SentenceBankPicker classId={staffClassId} onImportLabels={(labels) => void addItemsBulk(labels)} />
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
                      <div className="mt-3 rounded-lg bg-tertiary-container/40 px-3 py-2 font-caption text-caption text-on-surface">
                        {t('gameTelepathy.sentenceHint')}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          placeholder={t('gameTelepathy.itemPlaceholder')}
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

                    <div className="pt-3 flex flex-wrap gap-6">
                      <div>
                        <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameTelepathy.teamsLabel')}</div>
                        <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-1 w-fit">
                          <button type="button" disabled={cfg.teams <= 2} onClick={() => void commitConfig({ telepathyTeams: Math.max(2, cfg.teams - 1) })} className="h-9 w-9 rounded-md bg-surface-container-lowest font-bold text-primary shadow-sm disabled:opacity-40" aria-label="-">−</button>
                          <span className="min-w-[4.5em] text-center font-label-md text-label-md text-on-surface">{t('gameTelepathy.teamsCount', { n: cfg.teams })}</span>
                          <button type="button" disabled={cfg.teams >= 6} onClick={() => void commitConfig({ telepathyTeams: Math.min(6, cfg.teams + 1) })} className="h-9 w-9 rounded-md bg-surface-container-lowest font-bold text-primary shadow-sm disabled:opacity-40" aria-label="+">＋</button>
                        </div>
                      </div>
                      <div>
                        <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameTelepathy.choicesLabel')}</div>
                        <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-1 w-fit">
                          <button type="button" disabled={cfg.choices <= 3} onClick={() => void commitConfig({ telepathyChoices: Math.max(3, cfg.choices - 1) })} className="h-9 w-9 rounded-md bg-surface-container-lowest font-bold text-primary shadow-sm disabled:opacity-40" aria-label="-">−</button>
                          <span className="min-w-[4.5em] text-center font-label-md text-label-md text-on-surface">{t('gameTelepathy.choicesCount', { n: cfg.choices })}</span>
                          <button type="button" disabled={cfg.choices >= 4} onClick={() => void commitConfig({ telepathyChoices: Math.min(4, cfg.choices + 1) })} className="h-9 w-9 rounded-md bg-surface-container-lowest font-bold text-primary shadow-sm disabled:opacity-40" aria-label="+">＋</button>
                        </div>
                      </div>
                      <div>
                        <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameTelepathy.roundsLabel')}</div>
                        <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-1 w-fit">
                          <button type="button" disabled={cfg.rounds <= 1} onClick={() => void commitConfig({ telepathyRounds: Math.max(1, cfg.rounds - 1) })} className="h-9 w-9 rounded-md bg-surface-container-lowest font-bold text-primary shadow-sm disabled:opacity-40" aria-label="-">−</button>
                          <span className="min-w-[4.5em] text-center font-label-md text-label-md text-on-surface">{t('gameTelepathy.roundsCount', { n: cfg.rounds })}</span>
                          <button type="button" disabled={cfg.rounds >= 30} onClick={() => void commitConfig({ telepathyRounds: Math.min(30, cfg.rounds + 1) })} className="h-9 w-9 rounded-md bg-surface-container-lowest font-bold text-primary shadow-sm disabled:opacity-40" aria-label="+">＋</button>
                        </div>
                      </div>
                      <div>
                        <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameTelepathy.secondsLabel')}</div>
                        <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-1 w-fit">
                          {TELEPATHY_SECONDS.map((sec) => (
                            <button
                              key={sec}
                              type="button"
                              aria-pressed={cfg.seconds === sec}
                              onClick={() => void commitConfig({ telepathySeconds: sec })}
                              className={`h-9 rounded-md px-3 font-label-md text-label-md shadow-sm ${cfg.seconds === sec ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-primary'}`}
                            >
                              {sec === 0 ? t('gameTelepathy.noLimit') : t('gameTelepathy.secondsShort', { n: sec })}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3">
                      <OpenInOtherGame currentType="telepathy" itemCount={selected.items.length} onOpen={openInOtherGame} />
                      <ImportFromClass candidates={importCandidates} offerRosterSwap onImport={importFromClass} />
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
