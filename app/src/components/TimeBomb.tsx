import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import { useGamePlay } from './GameThemeFrame';
import { playMusic } from '../lib/gameMusic';
import { colorFor } from '../lib/wheel';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  participants: GameItem[];
  /** 폭탄이 넘어갈 때마다 무작위로 하나 보여주는 "읽을 단어·문장" 목록. 비어있으면 아예 안 보여준다. */
  words: GameItem[];
  minSec: number;
  maxSec: number;
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
  /** true면 상단 이름 수정 + 오른쪽 항목 개수 조절/이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
  onEditWord?: (id: string, label: string) => void;
  onAddWord?: () => void;
  onRemoveWord?: () => void;
  onRangeChange?: (min: number, max: number) => void;
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
}

type Phase = 'idle' | 'active' | 'exploded';
type Mode = 'pass' | 'timer';

const IDLE_SRC = '/skins/bomb-idle.png';
const EXPLODED_SRC = '/skins/bomb-exploded.png';
const BOARD_SRC = '/skins/bomb-word-board.png';

/**
 * 시한폭탄. min~maxSec 사이의 무작위 시각에 터지도록 숨겨진 타이머를 걸어둔다.
 * - "참가자 순서대로": 화면에서 "다음 사람에게 넘기기"를 누를 때마다 폭탄을 든 사람이 바뀌고,
 *   터지는 순간 그때 들고 있던 사람이 걸린다.
 * - "타이머만": 참가자 없이 카운트다운(숨김)과 폭발 연출만 — 실제 물건(인형/공 등)을 돌릴 때 씀.
 */
export default function TimeBomb({
  participants,
  words,
  minSec,
  maxSec,
  music,
  resultSound,
  editable,
  onEditItem,
  onAddItem,
  onRemoveItem,
  onEditWord,
  onAddWord,
  onRemoveWord,
  onRangeChange,
  templateName,
  onRenameTemplate,
}: Props) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const n = participants.length;
  const [mode, setMode] = useState<Mode>('pass');
  const [phase, setPhase] = useState<Phase>('idle');
  const [holderIndex, setHolderIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState<GameItem | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [wordDrafts, setWordDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [minInput, setMinInput] = useState(String(minSec));
  const [maxInput, setMaxInput] = useState(String(maxSec));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopMusicRef = useRef<() => void>(() => {});

  useEffect(() => {
    setItemDrafts(Object.fromEntries(participants.map((i) => [i.id, i.label])));
  }, [participants]);

  useEffect(() => {
    setWordDrafts(Object.fromEntries(words.map((w) => [w.id, w.label])));
  }, [words]);

  useEffect(() => {
    setMinInput(String(minSec));
    setMaxInput(String(maxSec));
  }, [minSec, maxSec]);

  function handleItemDraftChange(id: string, value: string) {
    setItemDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function commitItemDraft(id: string) {
    const value = (itemDrafts[id] ?? '').trim();
    if (value) onEditItem?.(id, value);
  }

  function handleWordDraftChange(id: string, value: string) {
    setWordDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function commitWordDraft(id: string) {
    const value = (wordDrafts[id] ?? '').trim();
    if (value) onEditWord?.(id, value);
  }

  function commitRange() {
    const min = Number(minInput);
    const max = Number(maxInput);
    if (Number.isFinite(min) && Number.isFinite(max)) onRangeChange?.(min, max);
  }

  function startEditTemplateName() {
    setTemplateNameDraft(templateName ?? '');
    setEditingTemplateName(true);
  }

  function commitTemplateNameEdit() {
    const trimmed = templateNameDraft.trim();
    setEditingTemplateName(false);
    if (trimmed && trimmed !== templateName) onRenameTemplate?.(trimmed);
  }

  function pickWord() {
    if (words.length === 0) {
      setCurrentWord(null);
      return;
    }
    setCurrentWord(words[Math.floor(Math.random() * words.length)]);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopMusicRef.current();
    };
  }, []);

  function start() {
    if (phase === 'active') return;
    if (mode === 'pass' && n < 2) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMusicRef.current();

    setHolderIndex(0);
    setPhase('active');
    pickWord();
    stopMusicRef.current = playMusic(music, { loop: true });

    const span = Math.max(maxSec - minSec, 0);
    const delaySec = minSec + Math.random() * span;
    timerRef.current = setTimeout(() => {
      setPhase('exploded');
      stopMusicRef.current();
      playMusic(resultSound);
    }, delaySec * 1000);
  }

  function pass() {
    if (phase !== 'active' || n === 0) return;
    setHolderIndex((prev) => (prev + 1) % n);
    pickWord();
  }

  function reset() {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMusicRef.current();
    setPhase('idle');
    setCurrentWord(null);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    reset();
    setMode(next);
  }

  const blockedForPassMode = mode === 'pass' && n < 2;
  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  return (
    <div className="flex w-full flex-col items-center pt-3 pb-2">
      <div
        className={`flex w-full flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
      >
        <div className={`flex flex-col items-center ${editable && !itemsHidden ? '' : 'w-full'}`}>
          {editable &&
            (editingTemplateName ? (
              <input
                autoFocus
                value={templateNameDraft}
                onChange={(e) => setTemplateNameDraft(e.target.value)}
                onBlur={commitTemplateNameEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTemplateNameEdit();
                  if (e.key === 'Escape') setEditingTemplateName(false);
                }}
                className="mb-2 w-full max-w-[420px] font-headline-lg-mobile text-headline-lg-mobile text-deep-navy bg-surface-container-lowest border border-primary rounded-lg px-2 outline-none text-center"
              />
            ) : (
              <button
                type="button"
                onClick={startEditTemplateName}
                title={t('gameAdmin.renameInlineHint')}
                className="mb-2 max-w-[420px] truncate font-headline-lg-mobile text-headline-lg-mobile text-deep-navy hover:bg-surface-container-lowest rounded-lg px-2 transition-colors"
              >
                {templateName}
              </button>
            ))}
          {editable && !itemsHidden && (
            <div className="mb-3 max-w-[420px] text-center font-caption text-caption text-on-surface-variant">
              {t('gameAdmin.editHintItems')}
            </div>
          )}

          <div className="mb-5 flex rounded-full bg-[#f3eee4] p-1">
            <button
              type="button"
              onClick={() => switchMode('pass')}
              className={`rounded-full px-4 py-1.5 font-label-md text-label-md transition-all ${
                mode === 'pass' ? 'bg-white text-secondary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('gameBomb.modePass')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('timer')}
              className={`rounded-full px-4 py-1.5 font-label-md text-label-md transition-all ${
                mode === 'timer' ? 'bg-white text-secondary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('gameBomb.modeTimer')}
            </button>
          </div>

          {blockedForPassMode ? (
            <div className="border-2 border-dashed border-outline-variant rounded-xl py-12 px-5 text-center text-on-surface-variant">
              <img src={IDLE_SRC} alt="" className="mx-auto mb-3 h-24 w-auto" />
              <div className="font-body-md text-body-md">{t('gameBomb.needTwoParticipants')}</div>
            </div>
          ) : (
            <>
              <div className="mb-5 flex w-[min(560px,92vw)] flex-col items-center">
                <div className="flex h-[220px] items-center justify-center sm:h-[260px]">
                  <img
                    src={phase === 'exploded' ? EXPLODED_SRC : IDLE_SRC}
                    alt=""
                    draggable={false}
                    className={`pointer-events-none max-h-full max-w-[78%] select-none object-contain ${
                      phase === 'active' ? 'bomb-wobble' : phase === 'exploded' ? 'bomb-burst' : ''
                    }`}
                    style={
                      phase === 'active'
                        ? undefined
                        : { filter: 'drop-shadow(0 12px 16px rgba(110, 62, 18, 0.22))' }
                    }
                  />
                </div>
                {currentWord && (
                  <div
                    className="relative mt-1 w-full"
                    style={{
                      aspectRatio: '3.85 / 1',
                      filter: 'drop-shadow(0 10px 16px rgba(90, 50, 18, 0.24))',
                    }}
                  >
                    <img
                      src={BOARD_SRC}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
                    />
                    <div
                      className="absolute flex items-center justify-center"
                      style={{ left: '10.5%', top: '18%', width: '79%', height: '64%' }}
                    >
                      <GameFitText
                        text={currentWord.label}
                        maxSize={72}
                        className="font-bold text-[#2a241c]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {phase === 'idle' && (
                <button onClick={start} className={pill}>
                  {t('gameBomb.startButton')}
                </button>
              )}

              {phase === 'active' && mode === 'pass' && (
                <>
                  <div className="mb-4 text-center font-title-md text-[22px] text-deep-navy md:text-[24px]">
                    {t('gameBomb.holderTurn', { name: participants[holderIndex]?.label })}
                  </div>
                  <button onClick={pass} className={pill}>
                    {t('gameBomb.passButton')}
                  </button>
                </>
              )}

              {phase === 'active' && mode === 'timer' && (
                <div className="mb-1 text-center font-title-md text-[22px] text-deep-navy md:text-[24px]">
                  {t('gameBomb.timerModeHint')}
                </div>
              )}

              {phase === 'exploded' && (
                <>
                  <div
                    className="result-pop mb-5 rounded-2xl px-9 py-4 text-center"
                    style={{
                      backgroundColor: '#f28b73',
                      border: '3px solid #f0d7a8',
                      boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
                    }}
                  >
                    {mode === 'pass' ? (
                      <>
                        <div className="font-caption text-caption font-bold tracking-wider text-white/90 uppercase">
                          {t('gameBomb.explodedCaught')}
                        </div>
                        <div className="font-display-lg mt-0.5 text-[38px] text-[#1e3a5f]">
                          {participants[holderIndex]?.label}
                        </div>
                      </>
                    ) : (
                      <div className="font-display-lg text-[38px] text-[#1e3a5f]">{t('gameBomb.explodedTimerOnly')}</div>
                    )}
                  </div>
                  <button onClick={reset} className={pill}>
                    {t('gameBomb.resetButton')}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {editable && !itemsHidden && (
          <div className="w-full md:w-[260px] md:shrink-0 space-y-4">
            <div>
              <div className="mb-1.5 font-caption text-caption text-on-surface-variant">{t('gameBomb.rangeLabel')}</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={minInput}
                  onChange={(e) => setMinInput(e.target.value)}
                  onBlur={commitRange}
                  className="w-[64px] rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 font-body-md text-sm text-on-surface text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <span className="font-body-md text-body-md text-on-surface-variant">~</span>
                <input
                  type="number"
                  min={1}
                  value={maxInput}
                  onChange={(e) => setMaxInput(e.target.value)}
                  onBlur={commitRange}
                  className="w-[64px] rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 font-body-md text-sm text-on-surface text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <span className="font-body-md text-body-md text-on-surface-variant">{t('gameBomb.seconds')}</span>
              </div>
            </div>

            {mode === 'pass' && (
              <div>
                <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
                  <button
                    type="button"
                    onClick={onRemoveItem}
                    disabled={n <= 1}
                    aria-label={t('gameAdmin.removeItemQuick')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">remove</span>
                  </button>
                  <span className="font-label-md text-label-md text-on-surface-variant tabular-nums whitespace-nowrap">
                    {t('gameAdmin.itemCountLabel', { count: n })}
                  </span>
                  <button
                    type="button"
                    onClick={onAddItem}
                    aria-label={t('gameAdmin.addItemQuick')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                  </button>
                </div>
                <div className="mt-2 max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
                  {participants.map((item, i) => (
                    <input
                      key={item.id}
                      value={itemDrafts[item.id] ?? item.label}
                      onChange={(e) => handleItemDraftChange(item.id, e.target.value)}
                      onBlur={() => commitItemDraft(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      style={{ color: colorFor(i) }}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={onRemoveWord}
                  disabled={words.length === 0}
                  aria-label={t('gameAdmin.removeItemQuick')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">remove</span>
                </button>
                <span className="font-label-md text-label-md text-on-surface-variant tabular-nums whitespace-nowrap">
                  {t('gameBomb.wordsPanelLabel')} {words.length}
                </span>
                <button
                  type="button"
                  onClick={onAddWord}
                  aria-label={t('gameAdmin.addItemQuick')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </div>
              <div className="mt-2 max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
                {words.map((w, i) => (
                  <input
                    key={w.id}
                    value={wordDrafts[w.id] ?? w.label}
                    onChange={(e) => handleWordDraftChange(w.id, e.target.value)}
                    onBlur={() => commitWordDraft(w.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    style={{ color: colorFor(i) }}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
