import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colorFor } from '../lib/wheel';
import { useGamePlay } from './GameThemeFrame';
import type { GameItem } from '../lib/types';

export type SpellWordStyle = 'slate' | 'stamps';

interface Props {
  items: GameItem[];
  previewSeconds: number;
  boardStyle?: SpellWordStyle;
  /** true면 오른쪽에 항목 개수 조절 + 이름 수정 목록 패널을 보여준다(선생님용 실제 플레이 화면에서만). */
  editable?: boolean;
  onEditItem?: (id: string, label: string) => void;
  /** 상단 이름 표시/수정 + 항목 개수 +/- 툴바. GameThemeFrame 안(전체화면 포함)에서도
   * 보이도록 SpellTheWord 자체에 둔다. */
  templateName?: string;
  onRenameTemplate?: (name: string) => void;
  onAddItem?: () => void;
  onRemoveItem?: (itemId?: string) => void;
}

type Phase = 'preview' | 'input';
type Status = 'playing' | 'correct' | 'wrong';

const woodShadow = 'var(--game-wood-shadow, 0 4px 0 #c6a982)';
const pill =
  'game-clay-action px-10 py-3 rounded-full bg-secondary hover:bg-on-secondary-container text-on-secondary font-title-md text-title-md shadow-sm transition-colors';
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isEditorTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export default function SpellTheWord({
  items,
  previewSeconds,
  boardStyle = 'slate',
  editable,
  onEditItem,
  templateName,
  onRenameTemplate,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation();
  const { itemsHidden } = useGamePlay();
  const stamps = boardStyle === 'stamps';
  const [order, setOrder] = useState<number[]>(() => shuffle(items.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('preview');
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<Status>('playing');
  const [score, setScore] = useState(0);
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const timerRef = useRef<number | null>(null);
  const previewMs = Math.max(500, previewSeconds * 1000);
  const itemKey = items.map((it) => it.id).join(',');
  // 항목을 지운 직후 한 프레임은 order[pos] 가 줄어든 items 범위를 벗어날 수 있다(itemKey 가
  // 바뀌어야 도는 useEffect 는 렌더 다음에 돎) — items[order[pos]] 가 undefined 라 .label 에서
  // 그대로 터지던 걸 막는다.
  const currentLabel =
    items.length > 0 && order.length > 0 && pos < order.length ? (items[order[pos]]?.label ?? '') : '';
  const playRef = useRef({ phase, status, inputValue, target: currentLabel });
  playRef.current = { phase, status, inputValue, target: currentLabel };

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
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function startPreview() {
    clearTimer();
    setPhase('preview');
    timerRef.current = window.setTimeout(() => setPhase('input'), previewMs);
  }

  function typeChar(ch: string) {
    if (playRef.current.phase !== 'input' || playRef.current.status !== 'playing') return;
    setInputValue((v) => v + ch);
  }

  function typeBackspace() {
    if (playRef.current.phase !== 'input' || playRef.current.status !== 'playing') return;
    setInputValue((v) => v.slice(0, -1));
  }

  function submit() {
    const snap = playRef.current;
    if (snap.phase !== 'input' || snap.status !== 'playing') return;
    const ok = normalize(snap.inputValue) === normalize(snap.target);
    setStatus(ok ? 'correct' : 'wrong');
    if (ok) setScore((s) => s + 1);
  }

  useEffect(() => {
    const nextOrder = shuffle(items.map((_, i) => i));
    setOrder(nextOrder);
    setPos(0);
    setInputValue('');
    setStatus('playing');
    setScore(0);
    if (items.length > 0) startPreview();
    else clearTimer();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, previewSeconds]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditorTarget(e.target)) return;
      const snap = playRef.current;
      if (snap.phase !== 'input' || snap.status !== 'playing') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        typeBackspace();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        typeChar(' ');
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        typeChar(e.key);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-outline-variant px-5 py-12 text-center text-on-surface-variant">
        <div className="mx-auto mb-3 flex justify-center">
          <div className="sw-slate pointer-events-none w-[160px] p-2">
            <div className="sw-face min-h-[72px] py-4 text-[18px]">Aa</div>
          </div>
        </div>
        <div className="font-body-md text-body-md">{t('gameSpellWord.needParticipants')}</div>
      </div>
    );
  }

  if (order.length === 0) {
    return null;
  }

  const finished = pos >= order.length;

  function restart() {
    setOrder(shuffle(items.map((_, i) => i)));
    setPos(0);
    setScore(0);
    setInputValue('');
    setStatus('playing');
    startPreview();
  }

  function next() {
    const nextPos = pos + 1;
    setPos(nextPos);
    setInputValue('');
    setStatus('playing');
    if (nextPos < order.length) startPreview();
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center pt-3 pb-2">
        <div
          className="mb-6 w-[min(360px,92%)] px-2 py-2 text-center"
          style={{
            borderRadius: 22,
            background: 'var(--game-wood, linear-gradient(115deg, #f3e3c8, #e9d0ac))',
            boxShadow: woodShadow,
          }}
        >
          <div
            className="px-4 py-5"
            style={{
              borderRadius: 16,
              background: 'var(--game-paper, #fffdf6)',
              boxShadow: 'var(--game-paper-shadow, inset 0 1px 0 #fff)',
            }}
          >
            <div className="mb-2 font-title-md text-title-md text-deep-navy">{t('gameSpellWord.finishedTitle')}</div>
            <div className="font-display-lg text-[32px] tabular-nums text-deep-navy">
              {t('gameSpellWord.scoreLabel', { score, total: order.length })}
            </div>
          </div>
        </div>
        <button onClick={restart} className={pill}>
          {t('gameSpellWord.restartButton')}
        </button>
      </div>
    );
  }

  const current = items[order[pos]];
  if (!current) return null;

  const target = current.label;
  const revealed = status !== 'playing';
  const mark = status === 'correct' ? 'is-ok' : status === 'wrong' ? 'is-no' : '';
  const empty = inputValue.length === 0;

  const answerField = (
    <div
      data-skin-object="answer-input"
      className={`sw-input ${mark} ${empty && !revealed ? 'is-empty' : ''}`}
      style={{ width: `${Math.max(8, inputValue.length + 2)}ch` }}
    >
      {empty && !revealed ? t('gameSpellWord.answerPlaceholder') : inputValue || '\u00a0'}
    </div>
  );

  const stampLetters = [...target].map((char, i) =>
    char === ' ' ? (
      <span key={`${i}-gap`} className="sw-gap" aria-hidden />
    ) : (
      <span key={`${i}-${char}`} className={`sw-stamp ag-clay-${i % 4}`}>
        {char}
      </span>
    ),
  );

  return (
    <div className="flex w-full flex-col items-center pt-1.5 pb-2">
      <div
        className={`flex w-full flex-col items-center gap-6 ${editable ? 'md:flex-row md:items-start md:justify-center' : ''}`}
      >
        <div className="flex w-full max-w-[640px] flex-col items-center">
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

      <div className="mb-3 rounded-full bg-secondary px-4 py-1 font-title-md text-[14px] font-bold tabular-nums text-on-secondary">
        {pos + 1} / {order.length}
      </div>

      {phase === 'preview' && (
        <div className="mb-3 font-caption text-caption text-on-surface-variant">{t('gameSpellWord.previewHint')}</div>
      )}

      {stamps ? (
        <div data-skin-stage="prompt" className="sw-tray mb-5">
          {phase === 'preview' ? stampLetters : answerField}
        </div>
      ) : (
        <div data-skin-stage="prompt" className="sw-slate mb-5">
          <div className="sw-face">{phase === 'preview' ? target : answerField}</div>
        </div>
      )}

      {phase === 'input' && !revealed && (
        <div className="hm-kb mb-5" role="group" aria-label={t('gameSpellWord.keyboardLabel')}>
          {KEY_ROWS.map((row) => (
            <div key={row} className="hm-kb-row">
              {[...row].map((letter) => (
                <button
                  key={letter}
                  type="button"
                  aria-label={letter}
                  className="hm-key"
                  onClick={() => typeChar(letter.toLowerCase())}
                >
                  {letter}
                </button>
              ))}
            </div>
          ))}
          <div className="sw-kb-util">
            <button
              type="button"
              aria-label={t('gameSpellWord.backspaceLabel')}
              className="hm-key sw-key-back"
              onClick={typeBackspace}
            >
              {t('gameSpellWord.backspaceLabel')}
            </button>
            <button
              type="button"
              aria-label={t('gameSpellWord.spaceLabel')}
              className="hm-key sw-key-space"
              onClick={() => typeChar(' ')}
            >
              {t('gameSpellWord.spaceLabel')}
            </button>
          </div>
        </div>
      )}

      {!revealed ? (
        phase === 'input' ? (
          <button onClick={submit} className={pill}>
            {t('gameSpellWord.submitButton')}
          </button>
        ) : (
          <div className="h-[48px]" />
        )
      ) : (
        <div className="result-pop flex flex-col items-center gap-3">
          <div
            className={`rounded-full px-5 py-1.5 font-title-md text-[14px] font-bold ${
              status === 'correct' ? 'bg-secondary text-on-secondary' : 'bg-[#f28b73] text-white'
            }`}
          >
            {status === 'correct'
              ? t('gameSpellWord.correctFeedback')
              : t('gameSpellWord.wrongFeedback', { word: target })}
          </div>
          <button onClick={next} className={pill}>
            {t('gameSpellWord.nextButton')}
          </button>
        </div>
      )}
        </div>

        {editable && !itemsHidden && (
          <div className="w-full md:w-[260px] md:shrink-0 space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container-lowest px-2 py-1.5 shadow-sm">
              <span className="font-label-md text-label-md text-on-surface-variant tabular-nums whitespace-nowrap">
                {t('gameAdmin.itemCountLabel', { count: items.length })}
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
                <div key={item.id} className="flex items-center gap-1">
                  <input
                  value={itemDrafts[item.id] ?? item.label}
                  onChange={(e) => handleItemDraftChange(item.id, e.target.value)}
                  onBlur={() => commitItemDraft(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  style={{ color: colorFor(i) }}
                  className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                  <button
                    type="button"
                    onClick={() => onRemoveItem?.(item.id)}
                    disabled={items.length <= 1}
                    title={t('gameAdmin.removeThisItem')}
                    aria-label={t('gameAdmin.removeThisItem')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-[18px]">remove_circle</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
