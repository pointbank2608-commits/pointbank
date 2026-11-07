import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameImagePicker from '../components/GameImagePicker';
import GameThemeFrame from '../components/GameThemeFrame';
import LabeledDiagram, { SAMPLE_DIAGRAM_IMAGE, SAMPLE_DIAGRAM_PINS } from '../components/LabeledDiagram';
import { useToast } from '../context/ToastContext';
import { useGameTemplates } from '../lib/useGameTemplates';
import type { DiagramPin, GameItem, GameTemplateConfig } from '../lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function defaultItems(): GameItem[] {
  return [];
}

export default function LabeledDiagramPage() {
  const { t } = useTranslation();
  const { run } = useToast();
  const g = useGameTemplates({
    gameType: 'labeleddiagram',
    defaultItems,
    defaultConfig: () => ({ diagramPins: [] }),
  });
  const {
    isStaff,
    academy,
    classId,
    selected,
    loading,
    roster,
  } = g;

  const [roundKey, setRoundKey] = useState(0);
  const [draftPins, setDraftPins] = useState<DiagramPin[]>(selected?.config.diagramPins ?? []);
  // 사진을 누르면 핀 자리를 먼저 찍고, 화면 안 입력칸에서 정답 이름을 받는다(브라우저 prompt 창은 막히는 경우가 있다).
  const hasSetup = !!selected?.config.diagramImageUrl && (selected.config.diagramPins?.length ?? 0) > 0;
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');

  useEffect(() => {
    setDraftPins(selected?.config.diagramPins ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  async function persistConfig(nextConfig: GameTemplateConfig) {
    if (!selected) return;
    await run(async () => { await g.persistConfig(nextConfig); });
  }

  function handleImageChange(url: string | null) {
    if (!selected) return;
    void persistConfig({ ...selected.config, diagramImageUrl: url ?? undefined });
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!selected) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setPending({ x, y });
    setPendingLabel('');
  }

  function confirmPendingPin() {
    if (!selected || !pending) return;
    const label = pendingLabel.trim();
    if (!label) return;
    const next = [...draftPins, { id: uid(), label, x: pending.x, y: pending.y }];
    setDraftPins(next);
    setPending(null);
    setPendingLabel('');
    void persistConfig({ ...selected.config, diagramPins: next });
  }

  function cancelPendingPin() {
    setPending(null);
    setPendingLabel('');
  }

  function removePin(pinId: string) {
    if (!selected) return;
    const next = draftPins.filter((p) => p.id !== pinId);
    setDraftPins(next);
    void persistConfig({ ...selected.config, diagramPins: next });
  }

  function renamePin(pinId: string, label: string) {
    setDraftPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, label } : p)));
  }

  function commitPinsOnBlur() {
    if (!selected) return;
    if (draftPins.every((pin, index) => pin.label === selected.config.diagramPins?.[index]?.label)) return;
    void persistConfig({ ...selected.config, diagramPins: draftPins });
  }

  async function handleStyleChange(style: 'wood' | 'clay') {
    if (!selected) return;
    void persistConfig({ ...selected.config, labeledDiagramStyle: style });
  }

  if (g.noClasses) {
    return <div className="text-center py-16 font-body-md text-on-surface-variant">{t('gameAdmin.noClasses')}</div>;
  }
  if (!isStaff && !classId) {
    return <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="text-center py-16 font-body-md text-on-surface-variant">{t('common.loading')}</div>
      ) : !selected ? (
        <div className="space-y-6">
          <GameThemeFrame gameType="labeleddiagram" roster={roster} className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]">
            <LabeledDiagram imageUrl={SAMPLE_DIAGRAM_IMAGE} pins={SAMPLE_DIAGRAM_PINS} />
          </GameThemeFrame>
        </div>
      ) : (
        <div className="space-y-6">
          {!isStaff && (
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">
              {selected.name}
            </h2>
          )}

          <GameThemeFrame gameType="labeleddiagram"
            roster={roster}
            onRestart={() => setRoundKey((k) => k + 1)}
            className="bg-[#fffdf8] rounded-[28px] p-4 md:p-6 shadow-[0_8px_28px_rgba(0,107,93,0.08)]"
          >
            <LabeledDiagram
              key={roundKey}
              imageUrl={hasSetup ? selected.config.diagramImageUrl ?? null : SAMPLE_DIAGRAM_IMAGE}
              pins={hasSetup ? selected.config.diagramPins ?? [] : SAMPLE_DIAGRAM_PINS}
              boardStyle={selected.config.labeledDiagramStyle === 'clay' ? 'clay' : 'wood'}
            />
          </GameThemeFrame>

          <div className="space-y-4">
            {isStaff && (
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-card">
                {!hasSetup && (
                  <p className="mb-2 rounded-lg bg-primary-fixed px-3 py-2 font-body-md text-sm text-on-surface">{t('gameLabeledDiagram.sampleHint')}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-label-md text-label-md text-on-surface-variant shrink-0">
                    {t('gameLabeledDiagram.styleLabel')}
                  </span>
                  {(['wood', 'clay'] as const).map((style) => {
                    const on = (selected.config.labeledDiagramStyle ?? 'wood') === style;
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => void handleStyleChange(style)}
                        className={`px-3 py-1.5 rounded-full font-label-md text-label-md transition-all ${
                          on
                            ? 'bg-secondary text-on-secondary shadow-sm'
                            : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container'
                        }`}
                      >
                        {style === 'wood' ? t('gameLabeledDiagram.styleWood') : t('gameLabeledDiagram.styleClay')}
                      </button>
                    );
                  })}
                </div>

                {academy && (
                  <div className="space-y-4">
                    <div>
                      <div className="font-label-md text-label-md text-on-surface-variant mb-1.5">
                        {t('gameLabeledDiagram.backgroundImageLabel')}
                      </div>
                      <GameImagePicker
                        library
                        academyId={academy.id}
                        value={selected.config.diagramImageUrl ?? null}
                        onChange={handleImageChange}
                      />
                    </div>

                    {selected.config.diagramImageUrl && (
                      <div>
                        <div className="font-label-md text-label-md text-on-surface-variant mb-1.5">
                          {t('gameLabeledDiagram.pinEditorHint')}
                        </div>
                        <div className="ld-frame inline-block max-w-full p-2">
                          <div className="ld-photo relative">
                          <img
                            src={selected.config.diagramImageUrl}
                            alt=""
                            onClick={handleImageClick}
                            className="max-w-full cursor-crosshair"
                          />
                          {draftPins.map((pin, i) => (
                            <span
                              key={pin.id}
                              className="ld-pin"
                              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                            >
                              {i + 1}
                            </span>
                          ))}
                          {pending && (
                            <span
                              className="ld-pin animate-pulse"
                              style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%`, opacity: 0.85 }}
                            >
                              {draftPins.length + 1}
                            </span>
                          )}
                          </div>
                        </div>
                        {pending && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-primary bg-primary-fixed p-2">
                            <span className="font-label-md text-label-md text-on-surface">
                              {draftPins.length + 1}{t('gameLabeledDiagram.newPinPromptShort')}
                            </span>
                            <input
                              autoFocus
                              value={pendingLabel}
                              onChange={(e) => setPendingLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmPendingPin();
                                if (e.key === 'Escape') cancelPendingPin();
                              }}
                              placeholder={t('gameLabeledDiagram.newPinPrompt')}
                              className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-white px-3 py-2 font-body-md text-sm outline-none focus:border-primary"
                            />
                            <button type="button" onClick={confirmPendingPin} disabled={!pendingLabel.trim()} className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary disabled:opacity-50">
                              {t('gameLabeledDiagram.addPinButton')}
                            </button>
                            <button type="button" onClick={cancelPendingPin} className="rounded-lg px-3 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low">
                              {t('gameAdmin.cancel')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {draftPins.length > 0 && (
                      <div className="space-y-1.5">
                        {draftPins.map((pin, i) => (
                          <div key={pin.id} className="flex items-center gap-2">
                            <span className="w-6 h-6 shrink-0 rounded-full bg-primary/15 text-primary font-caption text-caption font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <input
                              value={pin.label}
                              onChange={(e) => renamePin(pin.id, e.target.value)}
                              onBlur={commitPinsOnBlur}
                              className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            />
                            <button type="button" onClick={() => removePin(pin.id)} className="text-on-surface-variant hover:text-error shrink-0">
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
