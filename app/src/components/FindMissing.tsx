import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GameFitText from './GameFitText';
import { useGamePlay } from './GameThemeFrame';
import { colorFor } from '../lib/wheel';
import { playBuiltin, playShuffleSwish } from '../lib/gameMusic';
import type { GameItem } from '../lib/types';

interface Props {
  items: GameItem[];
  revealCount: number;
  shuffleCards: boolean;
  /** 카드를 외우는 시간(초). null이면 시간제한 없이 선생님이 "섞기" 버튼을 눌러야 다음으로
   * 넘어간다(수동 진행). */
  memorizeSeconds: number | null;
  /** true면 오른쪽에 항목 개수 조절 + 이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: () => void;
}

type Phase = 'idle' | 'showing' | 'shuffling' | 'hidden' | 'done';

interface CardOffset {
  dx: number;
  dy: number;
  rot: number;
}

const CARD_SRC = '/skins/miss-card.png';
const Q_SRC = '/skins/miss-q.png';
const HIDE_PAUSE_MS = 700;
const SHUFFLE_MS = 480;
const SHUFFLE_ROUNDS = 6;
const SETTLE_MS = 380;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 직전 배치와 최소 한 칸은 달라지게 섞는다. */
function shuffleDistinct(arr: GameItem[]): GameItem[] {
  if (arr.length < 2) return [...arr];
  for (let attempt = 0; attempt < 8; attempt++) {
    const next = shuffle(arr);
    if (next.some((item, i) => item.id !== arr[i].id)) return next;
  }
  const next = [...arr];
  [next[0], next[next.length - 1]] = [next[next.length - 1], next[0]];
  return next;
}

/** 카드가 너무 많으면(8개 초과) 무작위 8개만 골라 판을 구성한다. */
function pickBoard(items: GameItem[]): GameItem[] {
  return shuffle(items).slice(0, Math.min(items.length, 8));
}

function hideCountFor(boardLen: number, revealCount: number): number {
  return Math.min(Math.max(revealCount, 1), Math.max(boardLen - 1, 1));
}

/**
 * 사라진 항목 찾기. 카드를 잠깐 보여 준 뒤 몇 칸을 물음표로 숨기고, 무엇이 빠졌는지 맞힌다.
 * 난이도에서 카드 섞기를 켜면, 숨긴 뒤에 나무 카드(물음표 포함)가 자리를 바꾼다.
 */
export default function FindMissing({
  items,
  revealCount,
  shuffleCards,
  memorizeSeconds,
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const [phase, setPhase] = useState<Phase>('idle');
  const [board, setBoard] = useState<GameItem[]>([]);
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
  const [foundIds, setFoundIds] = useState<Set<string>>(new Set());
  const [offsets, setOffsets] = useState<Record<string, CardOffset>>({});
  const [instant, setInstant] = useState(false);
  const [countdown, setCountdown] = useState(memorizeSeconds ?? 0);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTickRef = useRef<(() => void) | null>(null);
  const runIdRef = useRef(0);
  const cardEls = useRef(new Map<string, HTMLElement>());
  const firstRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const shuffleRef = useRef(shuffleCards);
  shuffleRef.current = shuffleCards;

  function stopTicking() {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    if (stopTickRef.current) {
      stopTickRef.current();
      stopTickRef.current = null;
    }
  }

  const count = items.length;

  // 오른쪽 목록 입력창의 초안 텍스트를 실제 항목과 맞춰둔다 — 타이핑 중엔 이 draft를
  // 보여주다가(반응성), blur/Enter 시점에 onEditItem으로 실제 반영한다.
  useEffect(() => {
    setItemDrafts(Object.fromEntries(items.map((i) => [i.id, i.label])));
  }, [items]);

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

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearTimer();
      stopTicking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const first = firstRectsRef.current;
    if (!first || phase !== 'shuffling') return;

    const next: Record<string, CardOffset> = {};
    for (const [id, rect] of first) {
      const el = cardEls.current.get(id);
      if (!el) continue;
      const last = el.getBoundingClientRect();
      const dx = rect.left - last.left;
      const dy = rect.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      next[id] = { dx, dy, rot: Math.random() * 14 - 7 };
    }
    setInstant(true);
    setOffsets(next);
    let cancelled = false;
    const play = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        firstRectsRef.current = null;
        setInstant(false);
        setOffsets({});
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(play);
    };
  }, [board, phase]);

  function captureRects() {
    const m = new Map<string, DOMRect>();
    for (const [id, el] of cardEls.current) {
      m.set(id, el.getBoundingClientRect());
    }
    firstRectsRef.current = m;
  }

  function hideSome(boardNow: GameItem[]) {
    const n = hideCountFor(boardNow.length, revealCount);
    setMissingIds(new Set(shuffle(boardNow.map((item) => item.id)).slice(0, n)));
  }

  function shuffleRound(current: GameItem[], remaining: number, runId: number) {
    if (runId !== runIdRef.current) return;
    captureRects();
    const next = shuffleDistinct(current);
    setBoard(next);
    setPhase('shuffling');
    playShuffleSwish();
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (runId !== runIdRef.current) return;
      if (remaining > 1) {
        shuffleRound(next, remaining - 1, runId);
      } else {
        timerRef.current = setTimeout(() => {
          if (runId !== runIdRef.current) return;
          setOffsets({});
          setPhase('hidden');
        }, SETTLE_MS);
      }
    }, SHUFFLE_MS);
  }

  function afterShow(nextBoard: GameItem[], runId: number) {
    if (runId !== runIdRef.current) return;
    hideSome(nextBoard);
    if (shuffleRef.current && nextBoard.length >= 2) {
      setPhase('shuffling');
      timerRef.current = setTimeout(() => {
        if (runId !== runIdRef.current) return;
        shuffleRound(nextBoard, SHUFFLE_ROUNDS, runId);
      }, HIDE_PAUSE_MS);
    } else {
      setPhase('hidden');
    }
  }

  function start() {
    runIdRef.current += 1;
    const runId = runIdRef.current;
    const nextBoard = pickBoard(items);
    setBoard(nextBoard);
    setFoundIds(new Set());
    setMissingIds(new Set());
    setOffsets({});
    setPhase('showing');
    clearTimer();
    stopTicking();

    // memorizeSeconds가 null이면 시간제한 없이 선생님이 "섞기" 버튼을 직접 눌러야 다음으로
    // 넘어간다(카운트다운·초시계 소리 없음) — proceedManually()가 그 버튼에 연결된다.
    if (memorizeSeconds == null) {
      setCountdown(0);
      return;
    }

    setCountdown(memorizeSeconds);
    stopTickRef.current = playBuiltin('clock', { loop: true });

    // 카운트 로직은 순수 로컬 변수(secondsLeft)로 하고, countdown state는 화면 표시 전용으로만
    // 쓴다 — setState updater 안에서 다음 로직을 이어가면 React 배치 타이밍에 따라 ref/state가
    // 아직 안 갱신된 값을 참조하는 버그가 생길 수 있어서(과거에 겪은 패턴), 아예 분리해둔다.
    let secondsLeft = memorizeSeconds;
    tickIntervalRef.current = setInterval(() => {
      if (runId !== runIdRef.current) return;
      secondsLeft -= 1;
      setCountdown(Math.max(secondsLeft, 0));
      if (secondsLeft <= 0) {
        stopTicking();
        afterShow(nextBoard, runId);
      }
    }, 1000);
  }

  /** 시간제한 없음(수동) 모드에서 "섞기" 버튼을 누르면 바로 다음 단계로 넘어간다. */
  function proceedManually() {
    if (phase !== 'showing') return;
    stopTicking();
    afterShow(board, runIdRef.current);
  }

  function reveal(itemId: string) {
    if (!missingIds.has(itemId) || foundIds.has(itemId)) return;
    const nextFound = new Set(foundIds).add(itemId);
    setFoundIds(nextFound);
    if (nextFound.size === missingIds.size) {
      setPhase('done');
    }
  }

  const pill =
    'px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';

  if (items.length < 2) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <img src={CARD_SRC} alt="" className="mx-auto mb-3 h-14 w-auto" />
        <div className="font-body-md text-body-md">{t('gameFindMissing.needParticipants')}</div>
      </div>
    );
  }

  const nameBlock = editable && (
    editingTemplateName ? (
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
    )
  );

  const hintBlock = editable && !itemsHidden && (
    <div className="mb-3 max-w-[420px] text-center font-caption text-caption text-on-surface-variant">
      {t('gameAdmin.editHintItems')}
    </div>
  );

  const sidePanel = editable && !itemsHidden && (
    <div className="w-full md:w-[260px] md:shrink-0 space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
        <button
          type="button"
          onClick={onRemoveItem}
          disabled={count <= 2}
          aria-label={t('gameAdmin.removeItemQuick')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">remove</span>
        </button>
        <span className="font-label-md text-label-md text-on-surface-variant tabular-nums whitespace-nowrap">
          {t('gameAdmin.itemCountLabel', { count })}
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
        {items.map((item, i) => (
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
  );

  const boardBody = phase === 'idle' ? (
    <div className="flex flex-col items-center py-8">
      <img
        src={CARD_SRC}
        alt=""
        className="mb-5 w-[min(180px,55vw)]"
        style={{ filter: 'drop-shadow(0 8px 12px rgba(90, 50, 18, 0.22))' }}
      />
      <button onClick={start} className={pill}>
        {t('gameFindMissing.startButton')}
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-center pt-1.5 pb-2" data-shuffle={shuffleCards ? 'on' : 'off'}>
      {phase === 'showing' && (
        <div className="mb-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3 rounded-full bg-secondary px-6 py-2 font-label-md text-label-md text-on-secondary shadow-sm">
            <span>{t('gameFindMissing.memorizeHint')}</span>
            {memorizeSeconds != null && <span className="font-title-md text-title-md tabular-nums">{countdown}</span>}
          </div>
          {memorizeSeconds == null && (
            <button onClick={proceedManually} className={pill}>
              {t('gameFindMissing.shuffleNowButton')}
            </button>
          )}
        </div>
      )}
      {phase === 'shuffling' && (
        <div className="mb-4 rounded-full bg-secondary px-6 py-2 font-label-md text-label-md text-on-secondary shadow-sm">
          {t('gameFindMissing.shuffleHint')}
        </div>
      )}
      {phase === 'hidden' && (
        <div className="mb-4 rounded-full bg-secondary px-6 py-2 font-label-md text-label-md text-on-secondary shadow-sm">
          {t('gameFindMissing.missingPrompt')}
        </div>
      )}
      {phase === 'done' && (
        <div
          className="result-pop mb-4 rounded-2xl px-9 py-4 text-center"
          style={{
            backgroundColor: '#f28b73',
            border: '3px solid #f0d7a8',
            boxShadow: '0 3px 0 #c4925c, 0 8px 14px rgba(110,62,18,0.16)',
          }}
        >
          <div className="font-title-md text-[22px] font-bold text-white">{t('gameFindMissing.allFoundMessage')}</div>
        </div>
      )}

      <div
        data-skin-stage="board"
        className="grid w-full max-w-[520px] grid-cols-2 gap-3 overflow-visible sm:grid-cols-4"
      >
        {board.map((item) => {
          const isMissing = missingIds.has(item.id);
          const isFound = foundIds.has(item.id);
          const showQuestion = phase !== 'showing' && isMissing && !isFound;
          const clickable = phase === 'hidden' && isMissing && !isFound;
          const off = offsets[item.id];
          const transform = off
            ? `translate(${off.dx}px, ${off.dy}px) rotate(${off.rot}deg) scale(1.08)`
            : 'translate(0px, 0px) rotate(0deg) scale(1)';
          return (
            <button
              key={item.id}
              type="button"
              disabled={!clickable}
              onClick={() => reveal(item.id)}
              data-skin-object="card"
              ref={(el) => {
                if (el) cardEls.current.set(item.id, el);
                else cardEls.current.delete(item.id);
              }}
              className={`miss-card-fly relative bg-transparent p-0 ${instant ? 'is-instant' : ''} ${
                clickable ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-default'
              }`}
              aria-label={showQuestion ? '?' : item.label}
              style={{
                ...(off ? { transform, zIndex: 5 } : {}),
                filter: 'drop-shadow(0 6px 8px rgba(90, 50, 18, 0.18))',
              }}
            >
              <img src={CARD_SRC} alt="" draggable={false} className="pointer-events-none w-full select-none" />
              <div
                className="absolute flex items-center justify-center px-1"
                style={{ left: '10%', top: '13%', width: '81%', height: '75%' }}
              >
                {showQuestion ? (
                  <img src={Q_SRC} alt="" draggable={false} className="pointer-events-none h-[78%] w-auto select-none object-contain" />
                ) : (
                  <span className="block h-full w-full min-h-0">
                    <GameFitText text={item.label} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {phase === 'hidden' && (
        <div className="mt-4 font-caption text-caption text-on-surface-variant">{t('gameFindMissing.tapToRevealHint')}</div>
      )}

      {phase === 'done' && (
        <button onClick={start} className={`${pill} mt-6`}>
          {t('gameFindMissing.playAgainButton')}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex w-full flex-col items-center py-4 pb-2">
      <div
        className={`flex flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
      >
        <div className="flex flex-col items-center">
          {nameBlock}
          {hintBlock}
          {boardBody}
        </div>
        {sidePanel}
      </div>
    </div>
  );
}
