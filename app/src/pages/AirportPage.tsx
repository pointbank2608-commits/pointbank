import { useRecoverableField } from '../lib/useRecoverableField';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import EditOnly from '../components/EditOnly';
import ClassChipRow from '../components/ClassChipRow';
import AirportRoleplay from '../components/AirportRoleplay';
import GameInfoPanel from '../components/GameInfoPanel';
import GameThemeFrame from '../components/GameThemeFrame';
import ImportFromClass from '../components/ImportFromClass';
import OpenInOtherGame from '../components/OpenInOtherGame';
import WordListPicker from '../components/WordListPicker';
import DictionaryPicker from '../components/DictionaryPicker';
import { updateGameTemplate } from '../lib/api';
import { useGameTemplates } from '../lib/useGameTemplates';
import { AIRPORT_PLACES, type AirportPlaceId } from '../lib/airportRoleplay';
import type { FullCardItem, GameItem } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

const ALL_PLACES: AirportPlaceId[] = AIRPORT_PLACES.map((p) => p.id);

/** 공항 롤플레이 — 대본·그림은 내장이고, 낱말(그림 카드)·장소·해석 표시만 설정한다. */
export default function AirportPage() {
  const { t } = useTranslation();
  const g = useGameTemplates({
    gameType: 'airport',
    defaultItems: () => [],
    defaultConfig: () => ({ airportPlaces: ALL_PLACES, airportKo: false }),
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
  const [newItemLabel, setNewItemLabel] = useRecoverableField('game:airport:newItemLabel');
  const demoItems = useMemo<GameItem[]>(() => [], []);
  const places = ((selected?.config.airportPlaces as AirportPlaceId[] | undefined) ?? ALL_PLACES).filter((p) => ALL_PLACES.includes(p));
  const ko = selected?.config.airportKo ?? false;

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

  async function addLabels(labels: string[]) {
    if (!selected || labels.length === 0) return;
    if (await persistItems([...selected.items, ...labels.map((label) => ({ id: uid(), label }))])) {
      notify(t('gameAdmin.itemsAddedToast', { count: labels.length }));
    }
  }

  async function addCards(cards: FullCardItem[]) {
    await addLabels(cards.map((c) => (c.meaning.trim() ? `${c.word.trim()} | ${c.meaning.trim()}` : c.word.trim())).filter(Boolean));
  }

  async function addItem() {
    const label = newItemLabel.trim();
    if (!label) return;
    await addLabels([label]);
    setNewItemLabel('');
  }

  async function removeItem(itemId: string) {
    if (!selected) return;
    await persistItems(selected.items.filter((i) => i.id !== itemId));
  }

  async function clearAllItems() {
    if (!selected || selected.items.length === 0) return;
    if (!confirm(t('gameAirport.clearAllConfirm'))) return;
    await persistItems([]);
  }

  async function commitConfig(patch: { airportPlaces?: string[]; airportKo?: boolean }) {
    if (!selected) return;
    const nextConfig = { ...selected.config, ...patch };
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? { ...tpl, config: nextConfig } : tpl)));
    setRoundKey((k) => k + 1);
    try {
      await updateGameTemplate(selected.id, { config: nextConfig });
    } catch {
      await reload();
    }
  }

  function togglePlace(id: AirportPlaceId) {
    const has = places.includes(id);
    if (has && places.length === 1) return;
    const next = ALL_PLACES.filter((p) => (p === id ? !has : places.includes(p)));
    void commitConfig({ airportPlaces: next });
  }

  if (g.noClasses) {
    return <div className="text-center py-16 font-body-md text-on-surface-variant">{t('gameAdmin.noClasses')}</div>;
  }
  if (!isStaff && !classId) {
    return <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>;
  }

  const classPicker = isStaff ? (
    <ClassChipRow classes={classes} selectedId={staffClassId} onSelect={selectClass} onReorder={reorderClasses} />
  ) : (
    <h2 className="font-title-md text-title-md text-on-surface">{t('gameAirport.studentClassTitle', { className: studentClassName })}</h2>
  );

  const templateRow = (
    <div className="flex flex-wrap gap-2">
      {templates.map((tpl) => (
        <div
          key={tpl.id}
          className={`flex items-center rounded-full overflow-hidden ${
            tpl.id === selectedId ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40'
          }`}
        >
          <button onClick={() => setSelectedId(tpl.id)} className="pl-4 pr-2 py-2 font-label-md text-label-md flex items-center gap-1.5">
            {tpl.name}
            <span className="font-caption text-caption opacity-70">{scopeLabel(tpl)}</span>
          </button>
          {isStaff && (
            <button type="button" title={t('gameAdmin.delete')} onClick={() => void handleDeleteTemplate(tpl.id)} className="pr-3 pl-1 py-2 opacity-70 hover:opacity-100">
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
          {t('gameAirport.newButton')}
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
        <label htmlFor="apname" className="font-label-md text-label-md text-on-surface-variant block mb-1.5">
          {t('gameAdmin.nameFieldLabel')}
        </label>
        <input
          id="apname"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('gameAirport.namePlaceholder')}
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
            className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${newScope === 'class' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
          >
            {t('gameAdmin.scopeInClassOnly')}
          </button>
          <button
            type="button"
            onClick={() => setNewScope('academy')}
            className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${newScope === 'academy' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
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
        <Link to="/games" className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
          {t('gameAdmin.backToList')}
        </Link>
      </EditOnly>

      <GameInfoPanel description={t('gameAirport.infoDescription')} steps={t('gameAirport.infoSteps', { returnObjects: true }) as string[]} />

      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          <EditOnly>{classPicker}</EditOnly>
          <div>
            <GameThemeFrame gameType="airport" roster={roster} className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
              <AirportRoleplay items={demoItems} places={ALL_PLACES} showKo={false} />
            </GameThemeFrame>
            <div className="mt-3 text-center font-body-md text-body-md text-on-surface-variant">
              {isStaff ? t('gameAirport.emptyStaff') : t('gameAirport.emptyStudent')}
            </div>
          </div>
          <EditOnly>{templateRow}</EditOnly>
          {createForm}
        </div>
      ) : (
        <div className="space-y-6">
          {!isStaff && (
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">{selected.name}</h2>
          )}

          <GameThemeFrame
            gameType="airport"
            roster={roster}
            onRestart={() => setRoundKey((k) => k + 1)}
            className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
          >
            <AirportRoleplay key={roundKey} items={selected.items} places={places} showKo={ko} />
          </GameThemeFrame>

          <div className="space-y-4">
            <EditOnly>{classPicker}</EditOnly>
            <EditOnly>{templateRow}</EditOnly>
            {createForm}

            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-title-md text-title-md text-on-surface">{t('gameAirport.settingsTitle')}</h4>
                  <button onClick={() => setEditorOpen((v) => !v)} className="font-label-md text-label-md text-primary hover:underline">
                    {editorOpen ? t('gameAdmin.collapse') : t('gameAdmin.expand')}
                  </button>
                </div>

                {editorOpen && (
                  <div className="space-y-1 divide-y divide-surface-container">
                    <div className="pt-3 flex flex-wrap gap-6">
                      <div>
                        <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameAirport.placesLabel')}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {AIRPORT_PLACES.map((p) => {
                            const on = places.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => togglePlace(p.id)}
                                className={`rounded-full px-4 py-2 font-label-md text-label-md transition-colors ${
                                  on ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant'
                                }`}
                              >
                                {on ? '✓ ' : ''}
                                {t(`gameAirport.place_${p.id}`)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="font-caption text-caption text-on-surface-variant mb-2">{t('gameAirport.koLabel')}</div>
                        <div className="flex bg-surface-container-low rounded-lg p-1 w-fit">
                          {[false, true].map((v) => (
                            <button
                              key={String(v)}
                              type="button"
                              onClick={() => void commitConfig({ airportKo: v })}
                              className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${
                                ko === v ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
                              }`}
                            >
                              {v ? t('gameAirport.koOn') : t('gameAirport.koOff')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3">
                      <div className="font-title-md text-title-md text-on-surface">{t('gameAirport.wordsTitle')}</div>
                      <div className="mt-2 rounded-lg bg-tertiary-container/40 px-3 py-2 font-caption text-caption text-on-surface">{t('gameAirport.wordsHint')}</div>
                      <div className="flex flex-wrap items-start gap-2 my-3 [&>*]:min-w-[180px] [&>*]:flex-none">
                        <WordListPicker
                          variant="full"
                          wordLists={wordLists.filter((l) => l.kind !== 'sentence')}
                          loading={wordListsLoading}
                          onImportFull={(cards) => void addCards(cards)}
                        />
                        <DictionaryPicker variant="full" onImportFull={(cards) => void addCards(cards)} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.items.length === 0 ? (
                          <span className="font-caption text-caption text-on-surface-variant">{t('gameAirport.wordsBuiltin')}</span>
                        ) : (
                          selected.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-surface-container-low font-label-md text-label-md text-on-surface">
                              {item.label}
                              <button onClick={() => void removeItem(item.id)} className="text-on-surface-variant hover:text-error">
                                ✕
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      {selected.items.length > 0 && (
                        <button type="button" onClick={() => void clearAllItems()} className="mt-2 font-label-md text-label-md text-error hover:underline">
                          {t('gameAdmin.clearAll')}
                        </button>
                      )}
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          placeholder={t('gameAirport.itemPlaceholder')}
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

                    <div className="pt-3">
                      <OpenInOtherGame currentType="airport" itemCount={selected.items.length} onOpen={openInOtherGame} />
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
