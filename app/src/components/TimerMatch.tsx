import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playMusic } from '../lib/gameMusic';
import { colorFor } from '../lib/wheel';
import { useGamePlay } from './GameThemeFrame';
import i18n from '../i18n';
import type { GameItem, MusicSelection } from '../lib/types';

interface Props {
  participants: GameItem[];
  targetMs: number;
  music?: MusicSelection | null;
  resultSound?: MusicSelection | null;
  /** true면 오른쪽에 참가자 개수 조절 + 이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  /** 상단 이름 표시/수정 + 참가자 개수 +/- 툴바. GameThemeFrame 안(전체화면 포함)에서도
   * 보이도록 TimerMatch 자체에 둔다. */
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
}

type Mode = 'ranked' | 'practice';
type Phase = 'idle' | 'running' | 'stopped';

interface Attempt {
  participantId: string;
  label: string;
  elapsedMs: number;
  diffMs: number;
}

const CLOCK_SRC = '/skins/timer-clock.png?v=6';
const START_SRC = '/skins/timer-start.png';
const STOP_SRC = '/skins/timer-stop.png';
/** 스킨 이미지에서 측정한 화면 구멍. 값은 이미지 너비/높이 대비 비율. */
const SCREEN = { left: 0.104, top: 0.274, width: 0.765, height: 0.485 };
/**
 * 나무 프레임 *뒤*에 깔리는 검정 화면.
 * 구멍보다 살짝 커서 안쪽 턱 아래로 들어가고, 바깥 투명 모서리에는 안 닿는다.
 */
const SCREEN_FILL = { left: 0.075, top: 0.215, width: 0.835, height: 0.575 };

function fmt(ms: number): string {
  const totalCs = Math.round(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function resultMessage(diffMs: number): string {
  if (diffMs <= 50) return i18n.t('gameTimer.resultPerfect');
  if (diffMs <= 200) return i18n.t('gameTimer.resultAlmost');
  if (diffMs <= 500) return i18n.t('gameTimer.resultGreat');
  if (diffMs <= 1000) return i18n.t('gameTimer.resultClose');
  return i18n.t('gameTimer.resultTryAgain');
}

function DigitalReadout({ value, masked }: { value: string; masked: boolean }) {
  if (masked) {
    return <span className="text-[#5eead4]">{value}</span>;
  }
  const [main, frac] = value.split('.');
  return (
    <>
      <span className="text-[#e8fbf6]">{main}</span>
      <span className="text-[#5eead4]">.{frac}</span>
    </>
  );
}

/**
 * 타이머 맞추기. 목표 시간을 정해두고 "시작"→"멈춤"으로 최대한 가깝게 맞히는 게임.
 * showTimer 를 끄면 숫자를 숨겨서(실제 게임에서 흔히 하는 방식) 감으로만 맞혀야 한다.
 * ranked 모드에서는 참가자가 한 명씩 돌아가며 도전하고, 끝나면 오차 순으로 순위를 보여준다.
 */
export default function TimerMatch({
  participants,
  targetMs,
  music,
  resultSound,
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const n = participants.length;
  const [mode, setMode] = useState<Mode>('practice');
  const [showTimer, setShowTimer] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const startTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const stopMusicRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopMusicRef.current();
    };
  }, []);

  // 오른쪽 목록 입력창의 초안 텍스트를 실제 참가자와 맞춰둔다 — 타이핑 중엔 이 draft를
  // 보여주다가(반응성), blur/Enter 시점에 onEditItem으로 실제 반영한다.
  useEffect(() => {
    setItemDrafts(Object.fromEntries(participants.map((p) => [p.id, p.label])));
  }, [participants]);

  function handleItemDraftChange(id: string, value: string) {
    setItemDrafts((prev) => ({ ...prev, [id]: value }));
  }

  function commitItemDraft(id: string) {
    const value = (itemDrafts[id] ?? '').trim();
    if (value) onEditItem?.(id, value);
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

  function start() {
    if (phase === 'running') return;
    stopMusicRef.current();
    setPhase('running');
    setElapsedMs(0);
    startTimeRef.current = performance.now();
    stopMusicRef.current = playMusic(music, { loop: true });

    const tick = () => {
      setElapsedMs(performance.now() - startTimeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function stop() {
    if (phase !== 'running') return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const finalElapsed = performance.now() - startTimeRef.current;
    setElapsedMs(finalElapsed);
    setPhase('stopped');
    stopMusicRef.current();
    playMusic(resultSound);

    if (mode === 'ranked' && participants[turnIndex]) {
      const diffMs = Math.abs(finalElapsed - targetMs);
      const p = participants[turnIndex];
      setAttempts((prev) => [...prev, { participantId: p.id, label: p.label, elapsedMs: finalElapsed, diffMs }]);
    }
  }

  function tryAgain() {
    setPhase('idle');
    setElapsedMs(0);
  }

  function nextTurn() {
    setTurnIndex((prev) => prev + 1);
    setPhase('idle');
    setElapsedMs(0);
  }

  function restartAll() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stopMusicRef.current();
    setTurnIndex(0);
    setAttempts([]);
    setPhase('idle');
    setElapsedMs(0);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    restartAll();
    setMode(next);
  }

  const allDone = mode === 'ranked' && n > 0 && turnIndex >= n;
  const blockedForRanked = mode === 'ranked' && n === 0;
  const diffMs = phase === 'stopped' ? Math.abs(elapsedMs - targetMs) : null;
  const leaderboard = [...attempts].sort((a, b) => a.diffMs - b.diffMs);
  const masked = !showTimer && phase !== 'stopped';
  const readout = masked ? (phase === 'running' ? '??:??.??' : fmt(0)) : fmt(elapsedMs);
  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';
  const tabOn = 'rounded-full bg-white px-4 py-1.5 font-label-md text-label-md text-secondary shadow-sm';
  const tabOff = 'rounded-full px-4 py-1.5 font-label-md text-label-md text-on-surface-variant';

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
      <div className="mb-4 flex flex-wrap justify-center gap-2.5">
        <div className="flex rounded-full bg-[#f3eee4] p-1">
          <button type="button" onClick={() => switchMode('practice')} className={mode === 'practice' ? tabOn : tabOff}>
            {t('gameTimer.modePractice')}
          </button>
          <button type="button" onClick={() => switchMode('ranked')} className={mode === 'ranked' ? tabOn : tabOff}>
            {t('gameTimer.modeRanked')}
          </button>
        </div>
        <div className="flex rounded-full bg-[#f3eee4] p-1">
          <button type="button" onClick={() => setShowTimer(true)} className={showTimer ? tabOn : tabOff}>
            {t('gameTimer.showTimerOn')}
          </button>
          <button type="button" onClick={() => setShowTimer(false)} className={!showTimer ? tabOn : tabOff}>
            {t('gameTimer.showTimerOff')}
          </button>
        </div>
      </div>

      <div className="mb-3.5 font-label-md text-label-md font-bold text-on-surface-variant">
        {t('gameTimer.targetPrefix', { time: fmt(targetMs) })}
      </div>

      {blockedForRanked ? (
        <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
          <img src={CLOCK_SRC} alt="" className="mx-auto mb-3 h-16 w-auto" />
          <div className="font-body-md text-body-md">{t('gameTimer.needOneParticipant')}</div>
        </div>
      ) : allDone ? (
        <div className="flex w-full max-w-[420px] flex-col items-center">
          <div className="mb-3.5 font-title-md text-title-md text-deep-navy">{t('gameTimer.leaderboardTitle')}</div>
          {leaderboard.map((a, i) => (
            <div
              key={a.participantId + i}
              className="mb-2 grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-3 rounded-xl px-4 py-2.5"
              style={{
                backgroundColor: i === 0 ? '#f28b73' : '#fffdf8',
                border: '3px solid #f0d7a8',
                boxShadow: '0 3px 0 #c4925c, 0 6px 12px rgba(110,62,18,0.12)',
              }}
            >
              <span className={`font-title-md text-title-md ${i === 0 ? 'text-white' : 'text-secondary'}`}>{i + 1}</span>
              <span className={`font-label-md text-label-md font-semibold ${i === 0 ? 'text-white' : 'text-on-surface'}`}>
                {a.label}
              </span>
              <span className={`font-body-md text-sm ${i === 0 ? 'text-white/90' : 'text-on-surface-variant'}`}>
                {fmt(a.elapsedMs)}
              </span>
              <span className={`font-body-md text-sm font-bold ${i === 0 ? 'text-white' : 'text-secondary'}`}>
                ±{fmt(a.diffMs)}
              </span>
            </div>
          ))}
          <button onClick={restartAll} className={`${pill} mt-3`}>
            {t('gameTimer.restartAll')}
          </button>
        </div>
      ) : (
        <>
          {mode === 'ranked' && phase !== 'stopped' && (
            <div className="mb-4 text-center font-display-lg text-[34px] text-deep-navy">
              {t('gameTimer.holderTurn', { name: participants[turnIndex]?.label })}
            </div>
          )}

          <div
            className={`relative mb-6 w-[min(340px,92vw)] ${phase === 'running' ? 'timer-clock-pulse' : ''}`}
            style={{ filter: 'drop-shadow(0 10px 14px rgba(90, 50, 18, 0.35))' }}
          >
            <div
              className="absolute z-0 bg-[#1a2430]"
              style={{
                left: `${SCREEN_FILL.left * 100}%`,
                top: `${SCREEN_FILL.top * 100}%`,
                width: `${SCREEN_FILL.width * 100}%`,
                height: `${SCREEN_FILL.height * 100}%`,
              }}
            />
            <img src={CLOCK_SRC} alt="" draggable={false} className="pointer-events-none relative z-10 w-full select-none" />
            <div
              className="absolute z-20 flex items-center justify-center"
              style={{
                left: `${SCREEN.left * 100}%`,
                top: `${SCREEN.top * 100}%`,
                width: `${SCREEN.width * 100}%`,
                height: `${SCREEN.height * 100}%`,
              }}
            >
              <span className="font-mono text-[clamp(22px,7.2vw,44px)] font-bold tabular-nums tracking-[0.06em]">
                <DigitalReadout value={readout} masked={masked && phase === 'running'} />
              </span>
            </div>
          </div>

          {(phase === 'idle' || phase === 'running') && (
            <button
              type="button"
              onClick={phase === 'running' ? stop : start}
              aria-label={phase === 'running' ? 'STOP' : 'START'}
              className={`h-[110px] w-[110px] rounded-full bg-transparent p-0 transition-[filter] hover:not-disabled:brightness-105 active:not-disabled:brightness-95 ${
                phase === 'running' ? 'timer-btn-pulse' : ''
              }`}
              style={phase === 'running' ? undefined : { filter: 'drop-shadow(0 8px 12px rgba(90, 40, 10, 0.28))' }}
            >
              <img
                src={phase === 'running' ? STOP_SRC : START_SRC}
                alt=""
                draggable={false}
                className="pointer-events-none h-full w-full select-none object-contain"
              />
            </button>
          )}

          {phase === 'stopped' && diffMs != null && (
            <>
              <div
                className="result-pop mb-5 rounded-2xl px-9 py-4 text-center"
                style={{
                  backgroundColor: '#f28b73',
                  border: '3px solid #f0d7a8',
                  boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
                }}
              >
                <div className="font-title-md text-[22px] font-bold text-white">{t('gameTimer.diffPrefix', { diff: fmt(diffMs) })}</div>
                <div className="mt-1 font-body-md text-body-md text-white/90">{resultMessage(diffMs)}</div>
              </div>
              {mode === 'practice' ? (
                <button onClick={tryAgain} className={pill}>
                  {t('gameTimer.tryAgainButton')}
                </button>
              ) : (
                <button onClick={nextTurn} className={pill}>
                  {turnIndex + 1 >= n ? t('gameTimer.seeResultsButton') : t('gameTimer.nextPersonButton')}
                </button>
              )}
            </>
          )}
        </>
      )}
        </div>

        {editable && !itemsHidden && (
          <div className="w-full md:w-[260px] md:shrink-0 space-y-3">
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
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
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
      </div>
    </div>
  );
}
