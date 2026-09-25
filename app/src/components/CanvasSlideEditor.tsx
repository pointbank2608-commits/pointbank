import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { uploadLessonSlideImage } from '../lib/api';
import { BOARD_THEMES, boardTheme, type BoardTheme } from '../lib/boardThemes';
import type { CanvasElement, CanvasImageElement, CanvasSlide, CanvasTextElement, FullCardItem } from '../lib/types';
import {
  CANVAS_FONTS,
  CanvasBackground,
  CanvasElementContent,
  CanvasStageBox,
  canvasElementBoxStyle,
  canvasTextStyle,
} from './CanvasSlideView';

/**
 * "직접 만들기" 슬라이드 편집기 — PPT처럼 텍스트 상자·그림을 무대 위에 놓고 끌어서 옮기고,
 * 모서리를 끌어 크기를 바꾸고, 두 번 눌러 글자를 고친다. 좌표는 전부 무대 기준 %.
 * 되돌리기(Ctrl+Z)는 이 편집기 안에서만 기억하는 스냅샷 스택(슬라이드를 바꾸면 비워진다).
 */

const TEXT_COLORS = ['#1f2937', '#ffffff', '#0f3057', '#2563eb', '#16a34a', '#eab308', '#f97316', '#e11d48', '#db2777', '#7c3aed'];
const FILL_COLORS = [null, '#ffffff', '#fef9c3', '#dcfce7', '#dbeafe', '#fce7f3', '#ede9fe', '#1f2937'];
const BG_COLORS = ['#ffffff', '#fffbeb', '#fef9c3', '#dcfce7', '#dbeafe', '#fce7f3', '#ede9fe', '#0f3057', '#1f2937'];

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_POS: Record<Handle, React.CSSProperties> = {
  nw: { left: 0, top: 0, cursor: 'nwse-resize' },
  n: { left: '50%', top: 0, cursor: 'ns-resize' },
  ne: { left: '100%', top: 0, cursor: 'nesw-resize' },
  e: { left: '100%', top: '50%', cursor: 'ew-resize' },
  se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
  s: { left: '50%', top: '100%', cursor: 'ns-resize' },
  sw: { left: 0, top: '100%', cursor: 'nesw-resize' },
  w: { left: 0, top: '50%', cursor: 'ew-resize' },
};
const MIN_SIZE = 3;
const SNAP = 1.2;

function uid() {
  return crypto.randomUUID();
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 배경 테마가 정한 새 글상자 기본값(글자색·글꼴·굵기·크기). 테마가 없으면 기존 기본값. */
export function themeTextDefaults(themeId: string | null | undefined, role: 'title' | 'body' = 'body'): Partial<CanvasTextElement> {
  const th = boardTheme(themeId);
  if (!th) return role === 'title' ? { fontSize: 14, bold: true, font: 'round' } : {};
  return {
    color: th.text,
    font: th.font,
    bold: role === 'title' ? true : th.bold,
    fontSize: role === 'title' ? th.titleSize : th.fontSize,
  };
}

export function newTextElement(patch: Partial<CanvasTextElement> = {}): CanvasTextElement {
  return {
    id: uid(),
    type: 'text',
    x: 20,
    y: 38,
    w: 60,
    h: 20,
    text: '',
    fontSize: 9,
    color: '#1f2937',
    bold: false,
    align: 'center',
    font: 'sans',
    fill: null,
    ...patch,
  };
}

export function newCanvasSlide(themeId: string | null = null): CanvasSlide {
  const th = boardTheme(themeId);
  return {
    id: uid(),
    kind: 'canvas',
    background: '#ffffff',
    theme: th?.id ?? null,
    elements: [
      newTextElement({ x: 8, y: 30, w: 84, h: 26, ...themeTextDefaults(themeId, 'title') }),
      newTextElement({
        x: 15,
        y: 60,
        w: 70,
        h: 14,
        ...themeTextDefaults(themeId),
        fontSize: th ? th.fontSize * 0.7 : 6,
        bold: false,
        color: th ? th.muted : '#4b5563',
      }),
    ],
  };
}

/* ---------- 슬라이드를 넘나드는 복사·붙여넣기, 슬라이드별 되돌리기 기록 ----------
 * 편집기는 슬라이드를 바꿀 때마다 다른 슬라이드를 보게 되므로 둘 다 모듈 변수에 둔다 — 편집
 * 화면을 떠나기 전까지 유지되고, 새로고침하면 사라진다. */
const CLIP_MARKER = 'classbank-canvas-elements:';
let clipboardElements: CanvasElement[] | null = null;
/** 복사한 슬라이드의 배경 테마 — 다른 배경 슬라이드에 붙일 때 기본 글자색을 그 배경에 맞춰 바꾼다
 * (칠판의 흰 글씨를 화이트보드에 붙이면 안 보이니까). */
let clipboardTheme: string | null = null;

/** 이전 배경의 기본 글자색·글꼴 그대로인 글상자를 새 배경 기본값으로. 직접 바꾼 색은 그대로. */
function rethemeElement(el: CanvasElement, prev: BoardTheme | null, next: BoardTheme | null): CanvasElement {
  if (el.type !== 'text' || prev?.id === next?.id) return el;
  const prevText = prev ? prev.text : '#1f2937';
  const prevMuted = prev ? prev.muted : '#4b5563';
  const patch: Partial<CanvasTextElement> = {};
  if (el.color === prevText) patch.color = next ? next.text : '#1f2937';
  else if (el.color === prevMuted) patch.color = next ? next.muted : '#4b5563';
  if (next && (!prev || el.font === prev.font)) patch.font = next.font;
  return { ...el, ...patch };
}
const historyBySlide = new Map<string, Snapshot[]>();

function cloneForPaste(els: CanvasElement[], existing: CanvasElement[]): CanvasElement[] {
  // 같은 자리에 이미 있으면(같은 슬라이드에 붙여넣기) 살짝 비켜 놓는다.
  const overlaps = els.some((el) => existing.some((ex) => Math.abs(ex.x - el.x) < 0.5 && Math.abs(ex.y - el.y) < 0.5));
  const d = overlaps ? 3 : 0;
  return els.map((el) => ({ ...el, id: uid(), x: clamp(el.x + d, -el.w + 4, 96), y: clamp(el.y + d, -el.h + 4, 96) }));
}

type Snapshot = Pick<CanvasSlide, 'elements' | 'background' | 'backgroundImageUrl' | 'backgroundImagePath' | 'theme'>;

interface DragState {
  id: string;
  mode: 'move' | Handle;
  startX: number;
  startY: number;
  orig: CanvasElement;
  pushed: boolean;
}

export default function CanvasSlideEditor({
  slide,
  academyId,
  cards,
  onUpdate,
}: {
  slide: CanvasSlide;
  academyId: string;
  cards: FullCardItem[];
  onUpdate: (patch: Partial<CanvasSlide>) => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<'new' | 'replace' | 'background'>('new');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(false);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const drag = useRef<DragState | null>(null);
  const [historyLen, setHistoryLen] = useState(() => historyBySlide.get(slide.id)?.length ?? 0);
  const [hasClipboard, setHasClipboard] = useState(() => !!clipboardElements);
  // 드래그 중 onUpdate 가 부모를 다시 그리기 전에 다음 pointermove 가 와도 최신 슬라이드를 보도록.
  const slideRef = useRef(slide);
  slideRef.current = slide;

  useEffect(() => {
    setHistoryLen(historyBySlide.get(slide.id)?.length ?? 0);
    setSelectedId(null);
    setEditingId(null);
  }, [slide.id]);

  const selected = slide.elements.find((el) => el.id === selectedId) ?? null;

  function snapshot(): Snapshot {
    const s = slideRef.current;
    return {
      elements: s.elements,
      background: s.background,
      backgroundImageUrl: s.backgroundImageUrl ?? null,
      backgroundImagePath: s.backgroundImagePath ?? null,
      theme: s.theme ?? null,
    };
  }

  function historyStack(): Snapshot[] {
    let stack = historyBySlide.get(slideRef.current.id);
    if (!stack) {
      stack = [];
      historyBySlide.set(slideRef.current.id, stack);
    }
    return stack;
  }

  /** 부모가 다시 그리기 전에 이어지는 호출(드래그 중 pointermove, 연속 추가)도 최신 값을 보게
   * slideRef 를 먼저 갱신한다. */
  function apply(patch: Partial<CanvasSlide>) {
    slideRef.current = { ...slideRef.current, ...patch };
    onUpdate(patch);
  }

  function pushHistory() {
    const stack = historyStack();
    stack.push(snapshot());
    if (stack.length > 50) stack.shift();
    setHistoryLen(stack.length);
  }

  function commit(patch: Partial<CanvasSlide>) {
    pushHistory();
    apply(patch);
  }

  function undo() {
    const stack = historyStack();
    const prev = stack.pop();
    setHistoryLen(stack.length);
    if (!prev) return;
    apply(prev);
    setEditingId(null);
    if (selectedId && !prev.elements.some((el) => el.id === selectedId)) setSelectedId(null);
  }

  function setElements(elements: CanvasElement[], record = true) {
    if (record) commit({ elements });
    else apply({ elements });
  }

  function updateEl(id: string, patch: Partial<CanvasElement>, record = true) {
    setElements(
      slideRef.current.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as CanvasElement) : el)),
      record,
    );
  }

  function addElement(el: CanvasElement) {
    // 같은 자리에 겹쳐 쌓이지 않게 기존 개수만큼 살짝 비켜 놓는다.
    const offset = (slideRef.current.elements.length % 5) * 2;
    const placed = { ...el, x: clamp(el.x + offset, 0, 100 - el.w), y: clamp(el.y + offset, 0, 100 - el.h) };
    setElements([...slideRef.current.elements, placed]);
    setSelectedId(placed.id);
    return placed;
  }

  function removeSelected() {
    if (!selectedId) return;
    setElements(slideRef.current.elements.filter((el) => el.id !== selectedId));
    setSelectedId(null);
    setEditingId(null);
  }

  function duplicateSelected() {
    if (!selected) return;
    const copy = { ...selected, id: uid(), x: clamp(selected.x + 3, 0, 100 - selected.w), y: clamp(selected.y + 3, 0, 100 - selected.h) };
    setElements([...slideRef.current.elements, copy]);
    setSelectedId(copy.id);
  }

  function reorder(dir: 'front' | 'back') {
    if (!selected) return;
    const rest = slideRef.current.elements.filter((el) => el.id !== selected.id);
    setElements(dir === 'front' ? [...rest, selected] : [selected, ...rest]);
  }

  function copySelected(cut = false) {
    if (!selected) return null;
    clipboardElements = [selected];
    clipboardTheme = slideRef.current.theme ?? null;
    setHasClipboard(true);
    if (cut) removeSelected();
    return CLIP_MARKER + JSON.stringify({ theme: clipboardTheme, elements: [selected] });
  }

  function pasteElements(els: CanvasElement[], fromTheme: string | null) {
    const from = boardTheme(fromTheme);
    const to = boardTheme(slideRef.current.theme);
    const copies = cloneForPaste(els.map((el) => rethemeElement(el, from, to)), slideRef.current.elements);
    setElements([...slideRef.current.elements, ...copies]);
    setSelectedId(copies[copies.length - 1]?.id ?? null);
  }

  /** 배경 테마를 바꾸면, 이전 테마 기본값 그대로인 글자는 새 테마 기본값(색·글꼴)으로 따라 바꾼다.
   * 선생님이 직접 바꾼 색은 건드리지 않는다. */
  function applyTheme(next: BoardTheme | null, background?: string) {
    const prev = boardTheme(slideRef.current.theme);
    const elements = slideRef.current.elements.map((el) => rethemeElement(el, prev, next));
    commit({ theme: next?.id ?? null, elements, ...(background ? { background } : {}) });
  }

  async function uploadFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setUploading(true);
    try {
      for (const file of images) {
        const img = await uploadLessonSlideImage(academyId, file);
        const target = uploadTarget.current;
        if (target === 'background') {
          commit({ backgroundImageUrl: img.url, backgroundImagePath: img.path });
        } else if (target === 'replace' && selectedId && slideRef.current.elements.find((el) => el.id === selectedId)?.type === 'image') {
          updateEl(selectedId, { url: img.url, path: img.path } as Partial<CanvasImageElement>);
        } else {
          addElement({ id: uid(), type: 'image', x: 30, y: 20, w: 40, h: 60, url: img.url, path: img.path, fit: 'contain' });
        }
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setUploading(false);
      uploadTarget.current = 'new';
    }
  }

  function pickFile(target: 'new' | 'replace' | 'background') {
    uploadTarget.current = target;
    fileRef.current?.click();
  }

  function addWordCard(card: FullCardItem) {
    if (card.imageUrl) {
      const img: CanvasImageElement = { id: uid(), type: 'image', x: 32, y: 8, w: 36, h: 62, url: card.imageUrl, fit: 'contain' };
      const text = newTextElement({ x: 15, y: 72, w: 70, h: 18, text: card.word, ...themeTextDefaults(slide.theme, 'title'), fontSize: 11 });
      setElements([...slideRef.current.elements, img, text]);
      setSelectedId(text.id);
    } else {
      addElement(newTextElement({ x: 15, y: 35, w: 70, h: 24, text: card.word, ...themeTextDefaults(slide.theme, 'title') }));
    }
  }

  /* ---------- 끌기(옮기기·크기 바꾸기) ---------- */

  function startDrag(e: React.PointerEvent, el: CanvasElement, mode: DragState['mode']) {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (editingId === el.id) return;
    setSelectedId(el.id);
    if (editingId) setEditingId(null);
    drag.current = { id: el.id, mode, startX: e.clientX, startY: e.clientY, orig: el, pushed: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDragMove(e: React.PointerEvent) {
    const d = drag.current;
    const stage = stageRef.current;
    if (!d || !stage) return;
    const rect = stage.getBoundingClientRect();
    const dx = ((e.clientX - d.startX) / rect.width) * 100;
    const dy = ((e.clientY - d.startY) / rect.height) * 100;
    if (!d.pushed) {
      if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) return;
      pushHistory();
      d.pushed = true;
    }
    const o = d.orig;
    let { x, y, w, h } = o;
    if (d.mode === 'move') {
      x = clamp(o.x + dx, -o.w + 4, 96);
      y = clamp(o.y + dy, -o.h + 4, 96);
      // 가운데 맞춤 자석: 요소 중심이 무대 중심 근처면 딱 붙이고 안내선을 보여준다.
      const cx = x + w / 2;
      const cy = y + h / 2;
      const snapV = !e.shiftKey && Math.abs(cx - 50) < SNAP;
      const snapH = !e.shiftKey && Math.abs(cy - 50) < SNAP;
      if (snapV) x = 50 - w / 2;
      if (snapH) y = 50 - h / 2;
      setGuides({ v: snapV, h: snapH });
    } else {
      const m = d.mode;
      if (m.includes('e')) w = Math.max(MIN_SIZE, o.w + dx);
      if (m.includes('s')) h = Math.max(MIN_SIZE, o.h + dy);
      if (m.includes('w')) {
        w = Math.max(MIN_SIZE, o.w - dx);
        x = o.x + o.w - w;
      }
      if (m.includes('n')) {
        h = Math.max(MIN_SIZE, o.h - dy);
        y = o.y + o.h - h;
      }
      // 그림을 모서리로 끌면 가로세로 비율 유지(Shift 누르면 자유롭게).
      if (o.type === 'image' && m.length === 2 && !e.shiftKey) {
        h = w * (o.h / o.w);
        if (m.includes('n')) y = o.y + o.h - h;
      }
    }
    updateEl(d.id, { x, y, w, h }, false);
  }

  function endDrag() {
    drag.current = null;
    setGuides({ v: false, h: false });
  }

  /* ---------- 키보드 ---------- */

  function onKeyDown(e: React.KeyboardEvent) {
    if (editingId) {
      if (e.key === 'Escape') setEditingId(null);
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'x' && selected) {
      e.preventDefault();
      copySelected(true);
      return;
    }
    if (!selected) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeSelected();
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      duplicateSelected();
    } else if (e.key === 'Enter' && selected.type === 'text') {
      e.preventDefault();
      setEditingId(selected.id);
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 2 : 0.5;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      updateEl(selected.id, { x: selected.x + dx, y: selected.y + dy });
    } else if (e.key === 'Escape') {
      setSelectedId(null);
    }
  }

  function onCopy(e: React.ClipboardEvent) {
    if (editingId || !selected) return;
    const payload = copySelected();
    if (payload) {
      e.preventDefault();
      e.clipboardData.setData('text/plain', payload);
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    if (editingId) return;
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      uploadTarget.current = 'new';
      void uploadFiles(files);
      return;
    }
    const text = e.clipboardData.getData('text/plain');
    if (text.startsWith(CLIP_MARKER)) {
      e.preventDefault();
      try {
        const data = JSON.parse(text.slice(CLIP_MARKER.length)) as { theme: string | null; elements: CanvasElement[] };
        pasteElements(data.elements, data.theme);
      } catch {
        if (clipboardElements) pasteElements(clipboardElements, clipboardTheme);
      }
    } else if (text.trim()) {
      // 다른 곳에서 복사한 글은 새 글상자로.
      e.preventDefault();
      addElement(newTextElement({ text: text.trim(), ...themeTextDefaults(slide.theme) }));
    } else if (clipboardElements) {
      e.preventDefault();
      pasteElements(clipboardElements, clipboardTheme);
    }
  }

  /* ---------- 글상자 자동 늘리기: 글이 상자보다 길어지면 상자 높이를 글에 맞춰 늘린다 ---------- */
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageH = stage.clientHeight;
    if (!stageH) return;
    for (const el of slide.elements) {
      if (el.type !== 'text') continue;
      const box = stage.querySelector<HTMLElement>(`[data-el-id="${el.id}"]`);
      const content = box?.firstElementChild as HTMLElement | null;
      if (!box || !content) continue;
      let needed: number;
      if (content instanceof HTMLTextAreaElement) {
        needed = content.scrollHeight;
      } else {
        const body = content.querySelector<HTMLElement>('[data-text-body]');
        if (!body) continue;
        const cs = getComputedStyle(content);
        needed = body.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      }
      if (needed > box.clientHeight + 2) {
        const h = (needed / stageH) * 100 + 0.5;
        updateEl(el.id, { h }, false);
        return; // 한 번에 하나씩 — 다음 렌더에서 나머지를 본다.
      }
    }
  });

  const btn =
    'flex items-center gap-1 rounded-full px-3 py-1.5 font-label-md text-label-md transition-colors disabled:opacity-40';
  const btnIdle = `${btn} bg-surface-container-lowest text-on-surface shadow-sm hover:bg-secondary-container/50`;
  const iconBtn = (active = false) =>
    `flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${active ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container'}`;

  return (
    <div className="space-y-3">
      {/* 넣기 도구 */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnIdle} onClick={() => addElement(newTextElement(themeTextDefaults(slide.theme)))}>
          <span className="material-symbols-outlined text-[18px]">title</span>
          {t('curriculum.canvas.addText')}
        </button>
        <button type="button" className={btnIdle} disabled={uploading} onClick={() => pickFile('new')}>
          <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
          {uploading ? t('curriculum.canvas.uploading') : t('curriculum.canvas.addImage')}
        </button>
        <button
          type="button"
          className={btnIdle}
          disabled={cards.length === 0}
          title={cards.length === 0 ? t('curriculum.canvas.noWords') : undefined}
          onClick={() => setWordsOpen((o) => !o)}
        >
          <span className="material-symbols-outlined text-[18px]">style</span>
          {t('curriculum.canvas.addWord')}
        </button>
        <button type="button" className={btnIdle} disabled={!selected} onClick={() => copySelected()} title="Ctrl+C">
          <span className="material-symbols-outlined text-[18px]">content_copy</span>
          {t('curriculum.canvas.copy')}
        </button>
        <button
          type="button"
          className={btnIdle}
          disabled={!hasClipboard}
          onClick={() => clipboardElements && pasteElements(clipboardElements, clipboardTheme)}
          title={t('curriculum.canvas.pasteHint')}
        >
          <span className="material-symbols-outlined text-[18px]">content_paste</span>
          {t('curriculum.canvas.paste')}
        </button>
        <button type="button" className={btnIdle} disabled={historyLen === 0} onClick={undo} title="Ctrl+Z">
          <span className="material-symbols-outlined text-[18px]">undo</span>
          {t('curriculum.canvas.undo')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void uploadFiles(files);
          }}
        />
      </div>

      {wordsOpen && cards.length > 0 && (
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg bg-surface-container-lowest p-2 shadow-sm">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => addWordCard(card)}
              className="flex items-center gap-1.5 rounded-full border border-outline-variant/60 bg-surface-container-lowest py-1 pl-1 pr-3 font-label-md text-label-md text-on-surface hover:border-primary"
            >
              {card.imageUrl ? (
                <img src={card.imageUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="material-symbols-outlined flex h-6 w-6 items-center justify-center text-[16px] text-on-surface-variant">text_fields</span>
              )}
              {card.word}
            </button>
          ))}
        </div>
      )}

      {/* 선택한 요소 서식 도구 */}
      <div className="flex min-h-[44px] flex-wrap items-center gap-1 rounded-lg bg-surface-container-lowest px-2 py-1.5 shadow-sm">
        {!selected ? (
          <>
            <span className="mr-1 font-caption text-caption text-on-surface-variant">{t('curriculum.canvas.background')}</span>
            <BoardThemeChips value={slide.theme ?? null} onChange={(th) => applyTheme(th)} />
            <span className="mx-1 h-6 w-px bg-outline-variant/50" />
            {BG_COLORS.map((c) => (
              <ColorDot key={c} color={c} active={!slide.theme && slide.background === c} onClick={() => applyTheme(null, c)} />
            ))}
            <CustomColor value={slide.background} onChange={(c) => applyTheme(null, c)} />
            <span className="mx-1 h-6 w-px bg-outline-variant/50" />
            <button type="button" className={iconBtn()} disabled={uploading} onClick={() => pickFile('background')} title={t('curriculum.canvas.bgImage')}>
              <span className="material-symbols-outlined text-[20px]">wallpaper</span>
            </button>
            {slide.backgroundImageUrl && (
              <button
                type="button"
                className={iconBtn()}
                onClick={() => commit({ backgroundImageUrl: null, backgroundImagePath: null })}
                title={t('curriculum.canvas.bgImageRemove')}
              >
                <span className="material-symbols-outlined text-[20px]">hide_image</span>
              </button>
            )}
            <span className="ml-auto hidden font-caption text-caption text-on-surface-variant lg:inline">{t('curriculum.canvas.hint')}</span>
          </>
        ) : selected.type === 'text' ? (
          <>
            <select
              value={selected.font}
              onChange={(e) => updateEl(selected.id, { font: e.target.value as CanvasTextElement['font'] })}
              className="h-8 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 text-sm text-on-surface"
              style={{ fontFamily: CANVAS_FONTS[selected.font] }}
            >
              {(['sans', 'round', 'kids', 'hand'] as const).map((f) => (
                <option key={f} value={f} style={{ fontFamily: CANVAS_FONTS[f] }}>
                  {t(`curriculum.canvas.font_${f}`)}
                </option>
              ))}
            </select>
            <div className="flex items-center">
              <button type="button" className={iconBtn()} onClick={() => updateEl(selected.id, { fontSize: Math.max(2, +(selected.fontSize / 1.15).toFixed(2)) })} title={t('curriculum.canvas.smaller')}>
                <span className="material-symbols-outlined text-[20px]">text_decrease</span>
              </button>
              <span className="w-8 text-center font-caption text-caption tabular-nums text-on-surface-variant">{Math.round(selected.fontSize * 4)}</span>
              <button type="button" className={iconBtn()} onClick={() => updateEl(selected.id, { fontSize: Math.min(60, +(selected.fontSize * 1.15).toFixed(2)) })} title={t('curriculum.canvas.bigger')}>
                <span className="material-symbols-outlined text-[20px]">text_increase</span>
              </button>
            </div>
            <button type="button" className={iconBtn(selected.bold)} onClick={() => updateEl(selected.id, { bold: !selected.bold })} title={t('curriculum.canvas.bold')}>
              <span className="material-symbols-outlined text-[20px]">format_bold</span>
            </button>
            <button type="button" className={iconBtn(!!selected.italic)} onClick={() => updateEl(selected.id, { italic: !selected.italic })} title={t('curriculum.canvas.italic')}>
              <span className="material-symbols-outlined text-[20px]">format_italic</span>
            </button>
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} type="button" className={iconBtn(selected.align === a)} onClick={() => updateEl(selected.id, { align: a })} title={t(`curriculum.canvas.align_${a}`)}>
                <span className="material-symbols-outlined text-[20px]">{`format_align_${a}`}</span>
              </button>
            ))}
            <span className="mx-1 h-6 w-px bg-outline-variant/50" />
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant" title={t('curriculum.canvas.textColor')}>format_color_text</span>
            {TEXT_COLORS.map((c) => (
              <ColorDot key={c} color={c} active={selected.color === c} onClick={() => updateEl(selected.id, { color: c })} />
            ))}
            <CustomColor value={selected.color} onChange={(c) => updateEl(selected.id, { color: c })} />
            <span className="mx-1 h-6 w-px bg-outline-variant/50" />
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant" title={t('curriculum.canvas.fill')}>format_color_fill</span>
            {FILL_COLORS.map((c) => (
              <ColorDot key={c ?? 'none'} color={c} active={(selected.fill ?? null) === c} onClick={() => updateEl(selected.id, { fill: c })} />
            ))}
            <ElementActions onFront={() => reorder('front')} onBack={() => reorder('back')} onDuplicate={duplicateSelected} onDelete={removeSelected} iconBtn={iconBtn} />
          </>
        ) : (
          <>
            <button type="button" className={btnIdle} disabled={uploading} onClick={() => pickFile('replace')}>
              <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
              {t('curriculum.canvas.replaceImage')}
            </button>
            <button type="button" className={iconBtn(selected.fit === 'contain')} onClick={() => updateEl(selected.id, { fit: 'contain' })} title={t('curriculum.canvas.fitContain')}>
              <span className="material-symbols-outlined text-[20px]">fit_screen</span>
            </button>
            <button type="button" className={iconBtn(selected.fit === 'cover')} onClick={() => updateEl(selected.id, { fit: 'cover' })} title={t('curriculum.canvas.fitCover')}>
              <span className="material-symbols-outlined text-[20px]">crop</span>
            </button>
            <ElementActions onFront={() => reorder('front')} onBack={() => reorder('back')} onDuplicate={duplicateSelected} onDelete={removeSelected} iconBtn={iconBtn} />
          </>
        )}
      </div>

      {/* 무대 */}
      <CanvasStageBox
        stageRef={stageRef}
        tabIndex={0}
        className="select-none rounded-lg shadow-md outline-none ring-primary/40 focus-visible:ring-2"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.stageBg) {
            setSelectedId(null);
            setEditingId(null);
          }
          stageRef.current?.focus({ preventScroll: true });
        }}
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onPaste={onPaste}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          uploadTarget.current = 'new';
          void uploadFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <div data-stage-bg="1" className="absolute inset-0">
          <CanvasBackground slide={slide} />
        </div>
        {slide.elements.map((el) => {
          const isSel = el.id === selectedId;
          const isEditing = el.id === editingId && el.type === 'text';
          return (
            <div
              key={el.id}
              data-el-id={el.id}
              style={canvasElementBoxStyle(el)}
              className={`${isEditing ? '' : 'cursor-move'} ${isSel ? 'outline outline-2 outline-primary' : 'hover:outline hover:outline-1 hover:outline-primary/50'}`}
              onPointerDown={(e) => startDrag(e, el, 'move')}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onDoubleClick={() => el.type === 'text' && setEditingId(el.id)}
            >
              {isEditing ? (
                <TextEditBox el={el as CanvasTextElement} onDone={(text) => {
                  if (text !== (el as CanvasTextElement).text) updateEl(el.id, { text } as Partial<CanvasTextElement>);
                  setEditingId(null);
                  stageRef.current?.focus({ preventScroll: true });
                }} onGrow={(px) => {
                  const stageH = stageRef.current?.clientHeight;
                  if (stageH) updateEl(el.id, { h: (px / stageH) * 100 + 0.5 }, false);
                }} />
              ) : (
                <CanvasElementContent el={el} placeholder={t('curriculum.canvas.placeholder')} />
              )}
              {isSel && !isEditing &&
                HANDLES.map((hd) => (
                  <span
                    key={hd}
                    onPointerDown={(e) => startDrag(e, el, hd)}
                    onPointerMove={onDragMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    className="absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-white"
                    style={HANDLE_POS[hd]}
                  />
                ))}
            </div>
          );
        })}
        {guides.v && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-pink-500" />}
        {guides.h && <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-pink-500" />}
      </CanvasStageBox>
    </div>
  );
}

function TextEditBox({
  el,
  onDone,
  onGrow,
}: {
  el: CanvasTextElement;
  onDone: (text: string) => void;
  /** 글이 상자보다 길어졌을 때 필요한 높이(px) — 편집기가 상자 높이를 늘린다. */
  onGrow: (px: number) => void;
}) {
  const [value, setValue] = useState(el.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const ta = ref.current;
    if (ta && ta.scrollHeight > ta.clientHeight + 2) onGrow(ta.scrollHeight);
  });
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, []);
  const style = canvasTextStyle(el);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onDone(value);
      }}
      className="h-full w-full resize-none overflow-hidden border-0 outline-none"
      style={{ ...style, background: el.fill ?? 'rgba(255,255,255,0.35)' }}
    />
  );
}

function ColorDot({ color, active, onClick }: { color: string | null; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-6 w-6 shrink-0 overflow-hidden rounded-full border ${active ? 'border-primary ring-2 ring-primary/50' : 'border-outline-variant'}`}
      style={{ background: color ?? '#ffffff' }}
      aria-label={color ?? 'none'}
    >
      {color === null && <span className="absolute left-1/2 top-1/2 h-px w-7 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-error" />}
    </button>
  );
}

function CustomColor({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <label className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]">
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

function ElementActions({
  onFront,
  onBack,
  onDuplicate,
  onDelete,
  iconBtn,
}: {
  onFront: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  iconBtn: (active?: boolean) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className="ml-auto flex items-center">
      <button type="button" className={iconBtn()} onClick={onFront} title={t('curriculum.canvas.toFront')}>
        <span className="material-symbols-outlined text-[20px]">flip_to_front</span>
      </button>
      <button type="button" className={iconBtn()} onClick={onBack} title={t('curriculum.canvas.toBack')}>
        <span className="material-symbols-outlined text-[20px]">flip_to_back</span>
      </button>
      <button type="button" className={iconBtn()} onClick={onDuplicate} title={t('curriculum.canvas.duplicate')}>
        <span className="material-symbols-outlined text-[20px]">content_copy</span>
      </button>
      <button type="button" className={`${iconBtn()} hover:!bg-error/10 hover:text-error`} onClick={onDelete} title={t('curriculum.canvas.delete')}>
        <span className="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </div>
  );
}

/** 배경 테마 고르기 칩 — 편집기 배경 도구, 슬라이드 추가 패널, 워크시트 슬라이드가 같이 쓴다. */
export function BoardThemeChips({
  value,
  onChange,
  noneLabel,
}: {
  value: string | null;
  onChange: (theme: BoardTheme | null) => void;
  /** 주면 맨 앞에 "없음" 칩을 둔다(워크시트: 앱 기본 바탕). */
  noneLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {noneLabel && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-full border px-2.5 py-1 font-caption text-caption ${!value ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary'}`}
        >
          {noneLabel}
        </button>
      )}
      {BOARD_THEMES.map((th) => (
        <button
          key={th.id}
          type="button"
          onClick={() => onChange(th)}
          title={t(th.labelKey)}
          className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 font-caption text-caption transition-colors ${
            value === th.id ? 'border-primary text-on-surface ring-2 ring-primary/40' : 'border-outline-variant text-on-surface-variant hover:border-primary'
          }`}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-[11px] font-bold"
            style={{ background: th.swatch, color: th.text, boxShadow: th.frame ? `inset 0 0 0 2px ${th.frame}` : undefined }}
          >
            A
          </span>
          {t(th.labelKey)}
        </button>
      ))}
    </div>
  );
}
