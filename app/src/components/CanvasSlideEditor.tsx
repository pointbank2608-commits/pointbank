import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { uploadLessonSlideImage } from '../lib/api';
import { BOARD_THEMES, boardTheme, preloadBoardFonts, type BoardTheme } from '../lib/boardThemes';
import { isLineShape, MARK_SHAPES, newCoverElement, newMarkElement, newShapeElement, PAIRED_CHARS, SHAPE_KINDS, SPECIAL_CHAR_GROUPS } from '../lib/canvasMarks';
import { buildMotionPlan, DEFAULT_MOTION, effectIcon, effectsFor, type MotionPlan } from '../lib/canvasMotion';
import type { CanvasElement, CanvasImageElement, CanvasMarkElement, CanvasMotion, CanvasShapeElement, CanvasSlide, CanvasTextElement, FullCardItem } from '../lib/types';
import {
  CANVAS_FONTS,
  CanvasBackground,
  CanvasElementContent,
  CanvasMarkContent,
  CanvasStageBox,
  MotionLayer,
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
/** 특수 문자 패널 → 고치는 중인 글상자 */
const CANVAS_INSERT_EVENT = 'classbank-canvas-insert';
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

/** 복사본: 새 id, 묶음(group)은 복사본끼리 새 묶음으로 */
function freshCopies(els: CanvasElement[], d: number): CanvasElement[] {
  const groups = new Map<string, string>();
  return els.map((el) => {
    let group = el.group;
    if (group) {
      if (!groups.has(group)) groups.set(group, uid());
      group = groups.get(group);
    }
    return { ...el, id: uid(), group, x: clamp(el.x + d, -el.w + 4, 96), y: clamp(el.y + d, -el.h + 4, 96) };
  });
}

function cloneForPaste(els: CanvasElement[], existing: CanvasElement[]): CanvasElement[] {
  // 같은 자리에 이미 있으면(같은 슬라이드에 붙여넣기) 살짝 비켜 놓는다.
  const overlaps = els.some((el) => existing.some((ex) => Math.abs(ex.x - el.x) < 0.5 && Math.abs(ex.y - el.y) < 0.5));
  return freshCopies(els, overlaps ? 3 : 0);
}

type Snapshot = Pick<CanvasSlide, 'elements' | 'background' | 'backgroundImageUrl' | 'backgroundImagePath' | 'theme' | 'motionOrder'>;

interface DragState {
  id: string;
  mode: 'move' | 'rotate' | Handle;
  startX: number;
  startY: number;
  orig: CanvasElement;
  pushed: boolean;
  /** 여러 개를 골라 함께 옮길 때 각자의 시작 위치 */
  group?: { id: string; x: number; y: number }[];
}

type AlignKind = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom';

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
  // Shift·Ctrl 로 더 고른 요소들(정렬·함께 옮기기·함께 지우기). selectedId 는 서식 도구가 쓰는 "대표".
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(false);
  // 특수 문자 · 그려지는 표시 패널(2026-10-05)
  const [panel, setPanel] = useState<'chars' | 'shapes' | null>(null);
  // 효과 창 · 효과 미리 보기(숫자가 바뀌면 다시 재생)
  const [motionOpen, setMotionOpen] = useState(false);
  const [preview, setPreview] = useState<{ ids: string[]; n: number } | null>(null);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const drag = useRef<DragState | null>(null);
  const [historyLen, setHistoryLen] = useState(() => historyBySlide.get(slide.id)?.length ?? 0);
  const [hasClipboard, setHasClipboard] = useState(() => !!clipboardElements);
  // 드래그 중 onUpdate 가 부모를 다시 그리기 전에 다음 pointermove 가 와도 최신 슬라이드를 보도록.
  const slideRef = useRef(slide);
  slideRef.current = slide;

  useEffect(() => {
    void preloadBoardFonts();
  }, []);

  useEffect(() => {
    setHistoryLen(historyBySlide.get(slide.id)?.length ?? 0);
    setSelectedId(null);
    setMultiIds([]);
    setEditingId(null);
  }, [slide.id]);

  const selected = slide.elements.find((el) => el.id === selectedId) ?? null;
  const selectedIds = [selectedId, ...multiIds].filter((id): id is string => !!id && slide.elements.some((el) => el.id === id));
  const isMulti = selectedIds.length > 1;
  const primary = slide.elements.find((el) => el.id === selectedIds[0]) ?? null;
  const selectedEls = slide.elements.filter((el) => selectedIds.includes(el.id));
  const allLocked = selectedEls.length > 0 && selectedEls.every((el) => el.locked);
  const anyGrouped = selectedEls.some((el) => !!el.group);
  const plan = buildMotionPlan(slide);

  // 효과 미리 보기는 끝날 때쯤 지워서 요소가 원래 모습(사라지기 효과도 다시 보이게)으로 돌아온다
  useEffect(() => {
    if (!preview) return;
    const els = slideRef.current.elements.filter((el) => preview.ids.includes(el.id) && el.motion);
    const end = Math.max(0.4, ...els.map((el) => (el.motion?.duration ?? 0.6) + (el.motion?.delay ?? 0))) + 0.7;
    const id = window.setTimeout(() => setPreview(null), end * 1000);
    return () => window.clearTimeout(id);
  }, [preview]);

  function clearSelection() {
    setSelectedId(null);
    setMultiIds([]);
  }

  /** 일러스트레이터 정렬 — 하나만 골랐으면 슬라이드 기준, 여러 개면 고른 것들의 전체 영역 기준. */
  function alignSelected(kind: AlignKind) {
    const els = slideRef.current.elements.filter((el) => selectedIds.includes(el.id));
    if (els.length === 0) return;
    const b =
      els.length === 1
        ? { x: 0, y: 0, w: 100, h: 100 }
        : (() => {
            const x1 = Math.min(...els.map((e) => e.x));
            const y1 = Math.min(...els.map((e) => e.y));
            const x2 = Math.max(...els.map((e) => e.x + e.w));
            const y2 = Math.max(...els.map((e) => e.y + e.h));
            return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
          })();
    setElements(
      slideRef.current.elements.map((el) => {
        if (!selectedIds.includes(el.id)) return el;
        switch (kind) {
          case 'left': return { ...el, x: b.x };
          case 'hcenter': return { ...el, x: b.x + b.w / 2 - el.w / 2 };
          case 'right': return { ...el, x: b.x + b.w - el.w };
          case 'top': return { ...el, y: b.y };
          case 'vmiddle': return { ...el, y: b.y + b.h / 2 - el.h / 2 };
          case 'bottom': return { ...el, y: b.y + b.h - el.h };
        }
      }),
    );
  }

  /** 간격 똑같이 — 양 끝 요소는 그대로 두고 사이 간격을 같게(3개 이상). */
  function distributeSelected(axis: 'h' | 'v') {
    const els = slideRef.current.elements.filter((el) => selectedIds.includes(el.id));
    if (els.length < 3) return;
    const pos = (e: CanvasElement) => (axis === 'h' ? e.x : e.y);
    const size = (e: CanvasElement) => (axis === 'h' ? e.w : e.h);
    const sorted = [...els].sort((a, b) => pos(a) - pos(b));
    const start = pos(sorted[0]);
    const end = Math.max(...sorted.map((e) => pos(e) + size(e)));
    const gap = (end - start - sorted.reduce((sum, e) => sum + size(e), 0)) / (sorted.length - 1);
    const next = new Map<string, number>();
    let cursor = start;
    for (const e of sorted) {
      next.set(e.id, cursor);
      cursor += size(e) + gap;
    }
    setElements(
      slideRef.current.elements.map((el) =>
        next.has(el.id) ? { ...el, ...(axis === 'h' ? { x: next.get(el.id)! } : { y: next.get(el.id)! }) } : el,
      ),
    );
  }

  function snapshot(): Snapshot {
    const s = slideRef.current;
    return {
      elements: s.elements,
      background: s.background,
      backgroundImageUrl: s.backgroundImageUrl ?? null,
      backgroundImagePath: s.backgroundImagePath ?? null,
      theme: s.theme ?? null,
      motionOrder: s.motionOrder,
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

  /** 특수 문자 넣기: 고치는 중인 글상자면 커서 자리에, 고른 글상자면 글 끝에, 아니면 그 문자로 새 글상자 */
  function insertChar(ch: string) {
    if (editingId) {
      window.dispatchEvent(new CustomEvent(CANVAS_INSERT_EVENT, { detail: ch }));
      return;
    }
    if (selected?.type === 'text') {
      updateEl(selected.id, { text: selected.text + ch } as Partial<CanvasTextElement>);
      return;
    }
    addElement(newTextElement({ ...themeTextDefaults(slide.theme), text: ch, x: 44, y: 38, w: 12, h: 22, fontSize: 14 }));
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
    if (selectedIds.length === 0) return;
    const removable = slideRef.current.elements.filter((el) => selectedIds.includes(el.id) && !el.locked).map((el) => el.id);
    if (removable.length === 0) {
      notify(t('curriculum.canvas.lockedNote'), 'error');
      return;
    }
    setElements(slideRef.current.elements.filter((el) => !removable.includes(el.id)));
    clearSelection();
    setEditingId(null);
  }

  function duplicateSelected() {
    const src = slideRef.current.elements.filter((el) => selectedIds.includes(el.id));
    if (src.length === 0) return;
    const copies = freshCopies(src, 3);
    setElements([...slideRef.current.elements, ...copies]);
    setSelectedId(copies[0].id);
    setMultiIds(copies.slice(1).map((c) => c.id));
  }

  function reorder(dir: 'front' | 'back') {
    const sel = slideRef.current.elements.filter((el) => selectedIds.includes(el.id));
    if (sel.length === 0) return;
    const rest = slideRef.current.elements.filter((el) => !selectedIds.includes(el.id));
    setElements(dir === 'front' ? [...rest, ...sel] : [...sel, ...rest]);
  }

  /** 고른 요소 모두에 같은 값을(잠긴 것은 건드리지 않는다) */
  function patchSelected(patch: Partial<CanvasElement>, record = true) {
    setElements(
      slideRef.current.elements.map((el) => (selectedIds.includes(el.id) && !el.locked ? ({ ...el, ...patch } as CanvasElement) : el)),
      record,
    );
  }

  function toggleLock() {
    const els = slideRef.current.elements.filter((el) => selectedIds.includes(el.id));
    const lock = !els.every((el) => el.locked);
    setElements(slideRef.current.elements.map((el) => (selectedIds.includes(el.id) ? { ...el, locked: lock } : el)));
  }

  function groupSelected() {
    if (selectedIds.length < 2) return;
    const g = uid();
    setElements(slideRef.current.elements.map((el) => (selectedIds.includes(el.id) ? { ...el, group: g } : el)));
  }

  function ungroupSelected() {
    const groups = new Set(slideRef.current.elements.filter((el) => selectedIds.includes(el.id) && el.group).map((el) => el.group));
    setElements(slideRef.current.elements.map((el) => (el.group && groups.has(el.group) ? { ...el, group: undefined } : el)));
  }

  /** 효과 바꾸기 — 고른 요소 모두에. 여럿을 한꺼번에 고르면 첫 요소만 정한 시작 방식이고 나머지는 "함께"로 따라간다 */
  function applyMotion(patch: Partial<CanvasMotion>) {
    const ids = selectedIds;
    setElements(
      slideRef.current.elements.map((el) => {
        if (!ids.includes(el.id)) return el;
        const allowed = effectsFor(el);
        const draw = allowed[0] === 'draw';
        const base: CanvasMotion = el.motion ?? { ...DEFAULT_MOTION, effect: draw ? 'draw' : 'fade' };
        let next: CanvasMotion = { ...base, ...patch };
        if (patch.effect && !allowed.includes(patch.effect)) next = { ...next, effect: base.effect };
        if (next.out && next.effect === 'draw' && el.type === 'mark') next = { ...next, effect: 'fade' };
        // 새로 효과를 주는 요소는 첫 요소(대표)와 함께 나오게 — 묶음을 한 번 클릭에 같이 나타내려고
        if (ids.length > 1 && el.id !== ids[0] && (patch.trigger || !el.motion)) next = { ...next, trigger: 'with' };
        return { ...el, motion: next };
      }),
    );
  }

  function clearMotion() {
    setElements(slideRef.current.elements.map((el) => (selectedIds.includes(el.id) ? { ...el, motion: null } : el)));
  }

  function moveMotion(id: string, dir: -1 | 1) {
    const order = buildMotionPlan(slideRef.current).ordered.map((i) => i.id);
    const at = order.indexOf(id);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];
    commit({ motionOrder: order });
  }

  function playPreview() {
    const ids = slideRef.current.elements.filter((el) => selectedIds.includes(el.id) && el.motion).map((el) => el.id);
    if (ids.length === 0) return;
    setPreview((p) => ({ ids, n: (p?.n ?? 0) + 1 }));
  }

  function copySelected(cut = false) {
    if (!selected) return null;
    const els = slideRef.current.elements.filter((el) => selectedIds.includes(el.id));
    clipboardElements = els;
    clipboardTheme = slideRef.current.theme ?? null;
    setHasClipboard(true);
    const payload = CLIP_MARKER + JSON.stringify({ theme: clipboardTheme, elements: els });
    if (cut) removeSelected();
    return payload;
  }

  function pasteElements(els: CanvasElement[], fromTheme: string | null) {
    const from = boardTheme(fromTheme);
    const to = boardTheme(slideRef.current.theme);
    const copies = cloneForPaste(els.map((el) => rethemeElement(el, from, to)), slideRef.current.elements);
    setElements([...slideRef.current.elements, ...copies]);
    setSelectedId(copies[0]?.id ?? null);
    setMultiIds(copies.slice(1).map((c) => c.id));
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
    if (editingId) {
      // 글을 입력하다 다른 글상자·그림을 누르면, 입력칸이 화면에서 먼저 사라져 blur(=저장)가 불리지 않아
      // 쓴 글이 날아갔다(2026-09-27 버그). 입력칸의 초점을 먼저 빼서 저장(onDone)부터 하고 넘어간다.
      (document.activeElement as HTMLElement | null)?.blur?.();
      setEditingId(null);
    }
    // Shift·Ctrl+클릭: 선택에 넣고 빼기(일러스트레이터처럼)
    if (mode === 'move' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      if (!selectedId) setSelectedId(el.id);
      else if (el.id === selectedId) {
        setSelectedId(multiIds[0] ?? null);
        setMultiIds(multiIds.slice(1));
      } else setMultiIds((ids) => (ids.includes(el.id) ? ids.filter((id) => id !== el.id) : [...ids, el.id]));
      return;
    }
    const inSelection = selectedIds.includes(el.id);
    const members = el.group ? slideRef.current.elements.filter((x) => x.group === el.group).map((x) => x.id) : [];
    if (!inSelection) {
      // 묶음의 한 요소를 누르면 묶음 전체가 골라진다
      if (members.length > 1) {
        setSelectedId(members[0]);
        setMultiIds(members.slice(1));
      } else {
        setSelectedId(el.id);
        setMultiIds([]);
      }
    }
    if (el.locked) return; // 잠긴 요소는 고르기만 되고 옮겨지지 않는다
    const groupIds = mode === 'move' ? (inSelection ? (isMulti ? selectedIds : null) : members.length > 1 ? members : null) : null;
    drag.current = {
      id: el.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: el,
      pushed: false,
      group: groupIds
        ? slideRef.current.elements.filter((x) => groupIds.includes(x.id) && !x.locked).map((x) => ({ id: x.id, x: x.x, y: x.y }))
        : undefined,
    };
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
    if (d.group) {
      // 여러 개를 함께 옮기기(안내선 자석 없이)
      const g = new Map(d.group.map((it) => [it.id, it]));
      setElements(
        slideRef.current.elements.map((el) => {
          const start = g.get(el.id);
          return start ? { ...el, x: start.x + dx, y: start.y + dy } : el;
        }),
        false,
      );
      return;
    }
    const o = d.orig;
    let { x, y, w, h } = o;
    if (d.mode === 'rotate') {
      // 요소 가운데에서 포인터까지의 각도(위쪽이 0°). 45° 근처에서 달라붙고, Shift 는 15° 단위, Alt 는 자유
      const cx = rect.left + ((o.x + o.w / 2) / 100) * rect.width;
      const cy = rect.top + ((o.y + o.h / 2) / 100) * rect.height;
      let ang = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
      ang = ((((ang + 180) % 360) + 360) % 360) - 180;
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      else if (!e.altKey) {
        const near = Math.round(ang / 45) * 45;
        if (Math.abs(ang - near) < 4) ang = near;
      }
      updateEl(d.id, { rotate: Math.round(ang * 10) / 10 }, false);
      return;
    }
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
      // 크기 바꾸기: 돌아간 요소도 맞게, 반대쪽 모서리가 제자리에 있도록(화면 픽셀로 계산)
      const m = d.mode;
      const W = rect.width;
      const H = rect.height;
      const th = ((o.rotate ?? 0) * Math.PI) / 180;
      const cos = Math.cos(th);
      const sin = Math.sin(th);
      const dpx = e.clientX - d.startX;
      const dpy = e.clientY - d.startY;
      const lx = dpx * cos + dpy * sin;
      const ly = -dpx * sin + dpy * cos;
      const ow = (o.w / 100) * W;
      const oh = (o.h / 100) * H;
      const minW = (MIN_SIZE / 100) * W;
      const minH = (MIN_SIZE / 100) * H;
      let nw = ow;
      let nh = oh;
      if (m.includes('e')) nw = Math.max(minW, ow + lx);
      if (m.includes('w')) nw = Math.max(minW, ow - lx);
      if (m.includes('s')) nh = Math.max(minH, oh + ly);
      if (m.includes('n')) nh = Math.max(minH, oh - ly);
      // 그림을 모서리로 끌면 가로세로 비율 유지(Shift 누르면 자유롭게).
      if (o.type === 'image' && m.length === 2 && !e.shiftKey) nh = nw * (oh / ow);
      const sx = m.includes('e') ? (nw - ow) / 2 : m.includes('w') ? -(nw - ow) / 2 : 0;
      const sy = m.includes('s') ? (nh - oh) / 2 : m.includes('n') ? -(nh - oh) / 2 : 0;
      const ncx = ((o.x + o.w / 2) / 100) * W + sx * cos - sy * sin;
      const ncy = ((o.y + o.h / 2) / 100) * H + sx * sin + sy * cos;
      w = (nw / W) * 100;
      h = (nh / H) * 100;
      x = ((ncx - nw / 2) / W) * 100;
      y = ((ncy - nh / 2) / H) * 100;
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
    if (mod && e.key.toLowerCase() === 'a') {
      // 모두 선택
      e.preventDefault();
      const ids = slideRef.current.elements.map((el) => el.id);
      setSelectedId(ids[0] ?? null);
      setMultiIds(ids.slice(1));
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
      setElements(slideRef.current.elements.map((el) => (selectedIds.includes(el.id) && !el.locked ? { ...el, x: el.x + dx, y: el.y + dy } : el)));
    } else if (e.key === 'Escape') {
      clearSelection();
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
        <button
          type="button"
          className={`${btnIdle} ${panel === 'shapes' ? '!bg-secondary-container' : ''}`}
          aria-expanded={panel === 'shapes'}
          onClick={() => setPanel((p) => (p === 'shapes' ? null : 'shapes'))}
        >
          <span className="material-symbols-outlined text-[18px]">category</span>
          {t('curriculum.canvas.addShape')}
        </button>
        <button
          type="button"
          className={`${btnIdle} ${panel === 'chars' ? '!bg-secondary-container' : ''}`}
          aria-expanded={panel === 'chars'}
          onPointerDown={(e) => editingId && e.preventDefault()}
          onMouseDown={(e) => editingId && e.preventDefault()}
          onClick={() => setPanel((p) => (p === 'chars' ? null : 'chars'))}
        >
          <span className="material-symbols-outlined text-[18px]">special_character</span>
          {t('curriculum.canvas.addChar')}
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

      {panel === 'shapes' && (
        <div className="space-y-3 rounded-lg bg-surface-container-lowest p-2 shadow-sm">
          <div className="space-y-1">
            <div className="font-caption text-caption font-bold text-on-surface-variant">{t('curriculum.canvas.shapesTitle')}</div>
            <div className="flex flex-wrap gap-1.5">
              {SHAPE_KINDS.map(({ shape, icon }) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => {
                    addElement(newShapeElement(shape));
                    setPanel(null);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant/60 bg-surface-container-lowest px-3 font-label-md text-label-md text-on-surface hover:border-primary"
                >
                  <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
                  {t(`curriculum.canvas.shape_${shape}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <div className="font-caption text-caption font-bold text-on-surface-variant">{t('curriculum.canvas.marksTitle')}</div>
            <div className="flex flex-wrap gap-1.5">
              {MARK_SHAPES.map(({ shape, icon }) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => {
                    addElement(newMarkElement(shape));
                    setPanel(null);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant/60 bg-surface-container-lowest px-3 font-label-md text-label-md text-on-surface hover:border-primary"
                >
                  <span className="material-symbols-outlined text-[20px] text-[#e11d48]">{icon}</span>
                  {t(`curriculum.canvas.mark_${shape}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                addElement(newCoverElement());
                setPanel(null);
              }}
              className="flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 font-label-md text-label-md text-on-primary"
            >
              <span className="material-symbols-outlined text-[20px]">visibility_off</span>
              {t('curriculum.canvas.addCover')}
            </button>
            <span className="font-caption text-caption text-on-surface-variant">{t('curriculum.canvas.coverHint')}</span>
          </div>
        </div>
      )}

      {panel === 'chars' && (
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg bg-surface-container-lowest p-2 shadow-sm">
          {SPECIAL_CHAR_GROUPS.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-1">
              <span className="w-16 shrink-0 font-caption text-caption text-on-surface-variant">{t(`curriculum.canvas.chars_${g.id}`)}</span>
              {g.chars.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  title={ch}
                  aria-label={t('curriculum.canvas.insertChar', { ch })}
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertChar(ch)}
                  className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-1.5 text-xl text-on-surface hover:border-primary hover:bg-primary/5"
                >
                  {ch}
                </button>
              ))}
            </div>
          ))}
          <p className="font-caption text-caption text-on-surface-variant">{t('curriculum.canvas.charHint')}</p>
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
        ) : selected.type === 'shape' ? (
          <ShapeTools el={selected} iconBtn={iconBtn} onChange={(patch) => updateEl(selected.id, patch as Partial<CanvasElement>)} />
        ) : selected.type === 'mark' ? (
          <MarkTools el={selected} iconBtn={iconBtn} onChange={(patch) => updateEl(selected.id, patch as Partial<CanvasElement>)} />
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

      {selectedIds.length > 0 && primary && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-lowest px-2 py-1.5 shadow-sm">
          <label className="flex items-center gap-1 text-sm text-on-surface" title={t('curriculum.canvas.rotateTitle')}>
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">rotate_right</span>
            <input
              type="number"
              min={-180}
              max={180}
              step={5}
              value={Math.round(primary.rotate ?? 0)}
              aria-label={t('curriculum.canvas.rotateTitle')}
              onChange={(e) => patchSelected({ rotate: clamp(Number(e.target.value) || 0, -180, 180) })}
              className="h-9 w-16 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 text-sm tabular-nums"
            />
            °
            <button type="button" className={iconBtn()} onClick={() => patchSelected({ rotate: 0 })} title={t('curriculum.canvas.rotateReset')} disabled={!primary.rotate}>
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            </button>
          </label>
          <label className="flex items-center gap-1 text-sm text-on-surface" title={t('curriculum.canvas.opacity')}>
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">opacity</span>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round((primary.opacity ?? 1) * 100)}
              aria-label={t('curriculum.canvas.opacity')}
              onChange={(e) => patchSelected({ opacity: Number(e.target.value) / 100 })}
              className="w-24 accent-[#2765a8]"
            />
            <span className="w-9 tabular-nums">{Math.round((primary.opacity ?? 1) * 100)}%</span>
          </label>
          <span className="h-6 w-px bg-outline-variant/50" />
          <button
            type="button"
            className={`${btn} ${allLocked ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}
            aria-pressed={allLocked}
            onClick={toggleLock}
          >
            <span className="material-symbols-outlined text-[18px]">{allLocked ? 'lock' : 'lock_open'}</span>
            {allLocked ? t('curriculum.canvas.unlock') : t('curriculum.canvas.lock')}
          </button>
          {isMulti && (
            <button type="button" className={`${btn} bg-surface-container-low text-on-surface`} onClick={groupSelected}>
              <span className="material-symbols-outlined text-[18px]">join_full</span>
              {t('curriculum.canvas.group')}
            </button>
          )}
          {anyGrouped && (
            <button type="button" className={`${btn} bg-surface-container-low text-on-surface`} onClick={ungroupSelected}>
              <span className="material-symbols-outlined text-[18px]">join_inner</span>
              {t('curriculum.canvas.ungroup')}
            </button>
          )}
          <button type="button" className={`${btn} ${motionOpen ? 'bg-primary text-on-primary' : 'bg-secondary-container/60 text-on-surface'}`} aria-expanded={motionOpen} onClick={() => setMotionOpen((o) => !o)}>
            <span className="material-symbols-outlined text-[18px]">animation</span>
            {t('curriculum.canvas.motion')}
            {primary.motion && <span className="rounded-full bg-deep-navy px-1.5 text-[11px] text-white">{t(primary.motion.out ? 'curriculum.canvas.motionOut' : 'curriculum.canvas.motionIn')}</span>}
          </button>
          {(primary.type === 'shape' || primary.type === 'mark') && (
            <ElementActions onFront={() => reorder('front')} onBack={() => reorder('back')} onDuplicate={duplicateSelected} onDelete={removeSelected} iconBtn={iconBtn} />
          )}
        </div>
      )}

      {motionOpen && selectedIds.length > 0 && primary && (
        <MotionPanel
          primary={primary}
          plan={plan}
          elements={slide.elements}
          selectedIds={selectedIds}
          onApply={applyMotion}
          onClear={clearMotion}
          onMove={moveMotion}
          onPreview={playPreview}
        />
      )}

      {/* 정렬 (일러스트레이터처럼) */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-container-lowest px-2 py-1.5 shadow-sm">
          <span className="mr-1 font-caption text-caption font-bold text-on-surface-variant">{t('curriculum.canvas.alignTitle')}</span>
          {(
            [
              ['left', 'align_horizontal_left'],
              ['hcenter', 'align_horizontal_center'],
              ['right', 'align_horizontal_right'],
              ['top', 'align_vertical_top'],
              ['vmiddle', 'align_vertical_center'],
              ['bottom', 'align_vertical_bottom'],
            ] as const
          ).map(([kind, icon]) => (
            <button key={kind} type="button" className={iconBtn()} onClick={() => alignSelected(kind)} title={t(`curriculum.canvas.align_${kind}_obj`)}>
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-outline-variant/50" />
          <button type="button" className={iconBtn()} disabled={selectedIds.length < 3} onClick={() => distributeSelected('h')} title={t('curriculum.canvas.distributeH')}>
            <span className="material-symbols-outlined text-[20px]">horizontal_distribute</span>
          </button>
          <button type="button" className={iconBtn()} disabled={selectedIds.length < 3} onClick={() => distributeSelected('v')} title={t('curriculum.canvas.distributeV')}>
            <span className="material-symbols-outlined text-[20px]">vertical_distribute</span>
          </button>
          <span className="ml-auto font-caption text-caption text-on-surface-variant">
            {isMulti ? t('curriculum.canvas.alignToSelection', { count: selectedIds.length }) : t('curriculum.canvas.alignToSlide')}
          </span>
        </div>
      )}

      {/* 무대 */}
      <CanvasStageBox
        stageRef={stageRef}
        tabIndex={0}
        className="select-none rounded-lg shadow-md outline-none ring-primary/40 focus-visible:ring-2"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.stageBg) {
            clearSelection();
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
          const isSel = selectedIds.includes(el.id);
          const isEditing = el.id === editingId && el.type === 'text';
          const info = plan.byId.get(el.id);
          const previewing = !!preview && preview.ids.includes(el.id) && !!el.motion;
          return (
            <div
              key={el.id}
              data-el-id={el.id}
              style={canvasElementBoxStyle(el)}
              className={`${isEditing ? '' : el.locked ? 'cursor-not-allowed' : 'cursor-move'} ${isSel ? 'outline outline-2 outline-primary' : 'hover:outline hover:outline-1 hover:outline-primary/50'}`}
              onPointerDown={(e) => startDrag(e, el, 'move')}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onDoubleClick={() => el.type === 'text' && !el.locked && setEditingId(el.id)}
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
              ) : previewing && el.motion ? (
                el.type === 'mark' && el.motion.effect === 'draw' && !el.motion.out ? (
                  <CanvasMarkContent key={preview!.n} el={el} draw duration={el.motion.duration} delay={el.motion.delay} />
                ) : (
                  <MotionLayer key={preview!.n} motion={el.motion} el={el} animate delay={el.motion.delay}>
                    <CanvasElementContent el={el} />
                  </MotionLayer>
                )
              ) : (
                <CanvasElementContent el={el} placeholder={t('curriculum.canvas.placeholder')} />
              )}
              {info && (
                <span className="pointer-events-none absolute -left-1 -top-1 z-10 flex items-center gap-0.5 whitespace-nowrap rounded-full bg-deep-navy px-1.5 text-[10px] font-bold leading-4 text-white">
                  {info.motion.out && <span className="material-symbols-outlined text-[11px]">visibility_off</span>}
                  {info.motion.trigger === 'click'
                    ? t('curriculum.canvas.badgeClick', { n: info.step })
                    : info.motion.trigger === 'with'
                      ? t('curriculum.canvas.badgeWith')
                      : t('curriculum.canvas.badgeAuto')}
                </span>
              )}
              {el.locked && (
                <span className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-on-surface text-white">
                  <span className="material-symbols-outlined text-[11px]">lock</span>
                </span>
              )}
              {isSel && !isMulti && !isEditing && !el.locked && (
                <>
                  {HANDLES.map((hd) => (
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
                  <span
                    onPointerDown={(e) => startDrag(e, el, 'rotate')}
                    onPointerMove={onDragMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    title={t('curriculum.canvas.rotateTitle')}
                    className="absolute left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-primary bg-white text-primary"
                    style={{ top: '-30px' }}
                  >
                    <span className="material-symbols-outlined text-[13px]">rotate_right</span>
                  </span>
                </>
              )}
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
    if (!ta) return;
    // 보기 화면처럼 글을 세로 가운데에 — 입력을 마칠 때 글이 아래로 "뛰는" 것처럼 보이지 않게.
    ta.style.paddingTop = '';
    ta.style.paddingBottom = '';
    if (ta.scrollHeight > ta.clientHeight + 2) {
      onGrow(ta.scrollHeight);
      return;
    }
    const cs = getComputedStyle(ta);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    ta.style.height = '0px';
    const content = ta.scrollHeight - padTop - padBottom;
    ta.style.height = '';
    const extra = ta.clientHeight - padTop - padBottom - content;
    if (extra > 1) {
      ta.style.paddingTop = `${padTop + extra / 2}px`;
      ta.style.paddingBottom = `${padBottom + extra / 2}px`;
    }
  });
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, []);
  // 글꼴이 늦게 받아지면 입력칸이 대체 글꼴로 남아 있다가, 다른 곳을 누를 때 원래 글꼴로 "바뀌어" 보였다.
  // 글꼴을 다 받으면 입력칸을 한 번 다시 그려 처음부터 같은 글꼴로 보이게 한다.
  useEffect(() => {
    let alive = true;
    const repaint = () => {
      const ta = ref.current;
      if (!alive || !ta) return;
      const family = ta.style.fontFamily;
      ta.style.fontFamily = 'serif';
      void ta.offsetWidth;
      ta.style.fontFamily = family;
    };
    void preloadBoardFonts().then(repaint);
    document.fonts?.addEventListener?.('loadingdone', repaint);
    return () => {
      alive = false;
      document.fonts?.removeEventListener?.('loadingdone', repaint);
    };
  }, []);
  // 특수 문자 패널에서 누른 문자를 커서 자리에 넣는다(짝 문자는 가운데에 커서)
  useEffect(() => {
    function onInsert(e: Event) {
      const ch = (e as CustomEvent<string>).detail;
      const ta = ref.current;
      if (!ta || typeof ch !== 'string') return;
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? start;
      const next = ta.value.slice(0, start) + ch + ta.value.slice(end);
      const caret = start + (PAIRED_CHARS.has(ch) ? 1 : ch.length);
      setValue(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(caret, caret);
      });
    }
    window.addEventListener(CANVAS_INSERT_EVENT, onInsert);
    return () => window.removeEventListener(CANVAS_INSERT_EVENT, onInsert);
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

const MARK_COLORS = ['#e11d48', '#f97316', '#eab308', '#16a34a', '#2563eb', '#7c3aed', '#1f2937', '#ffffff'];
const SHAPE_COLORS = ['#e11d48', '#f97316', '#fbbf24', '#16a34a', '#2563eb', '#7c3aed', '#1f2937', '#ffffff', '#fde68a', '#dbeafe', '#dcfce7', '#fce7f3'];

/** 고른 표시의 도구: 모양·색·굵기. 돌리기·투명도·효과는 공통 줄에서 */
function MarkTools({ el, iconBtn, onChange }: { el: CanvasMarkElement; iconBtn: (active?: boolean) => string; onChange: (patch: Partial<CanvasMarkElement>) => void }) {
  const { t } = useTranslation();
  return (
    <>
      {MARK_SHAPES.map(({ shape, icon }) => (
        <button key={shape} type="button" className={iconBtn(el.shape === shape)} onClick={() => onChange({ shape })} title={t(`curriculum.canvas.mark_${shape}`)}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </button>
      ))}
      <span className="mx-1 h-6 w-px bg-outline-variant/50" />
      {MARK_COLORS.map((c) => (
        <ColorDot key={c} color={c} active={el.color === c} onClick={() => onChange({ color: c })} />
      ))}
      <CustomColor value={el.color} onChange={(c) => onChange({ color: c })} />
      <span className="mx-1 h-6 w-px bg-outline-variant/50" />
      <Stepper label={t('curriculum.canvas.lineWidth')} icon="line_weight" onLess={() => onChange({ stroke: Math.max(0.4, +(el.stroke / 1.25).toFixed(2)) })} onMore={() => onChange({ stroke: Math.min(6, +(el.stroke * 1.25).toFixed(2)) })} iconBtn={iconBtn} />
    </>
  );
}

function Stepper({ label, icon, onLess, onMore, iconBtn }: { label: string; icon: string; onLess: () => void; onMore: () => void; iconBtn: (active?: boolean) => string }) {
  return (
    <span className="flex items-center" title={label}>
      <button type="button" className={iconBtn()} onClick={onLess} aria-label={`${label} −`}>
        <span className="material-symbols-outlined text-[16px]">remove</span>
      </button>
      <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden="true">{icon}</span>
      <button type="button" className={iconBtn()} onClick={onMore} aria-label={`${label} +`}>
        <span className="material-symbols-outlined text-[16px]">add</span>
      </button>
    </span>
  );
}

/** 고른 도형의 도구: 채우기·테두리 색·굵기·선 모양·모서리 */
function ShapeTools({ el, iconBtn, onChange }: { el: CanvasShapeElement; iconBtn: (active?: boolean) => string; onChange: (patch: Partial<CanvasShapeElement>) => void }) {
  const { t } = useTranslation();
  const line = isLineShape(el.shape);
  return (
    <>
      {!line && (
        <>
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant" title={t('curriculum.canvas.fill')}>format_color_fill</span>
          <ColorDot color={null} active={el.fill === null} onClick={() => onChange({ fill: null })} />
          {SHAPE_COLORS.map((c) => (
            <ColorDot key={`f${c}`} color={c} active={el.fill === c} onClick={() => onChange({ fill: c })} />
          ))}
          <CustomColor value={el.fill ?? '#ffffff'} onChange={(c) => onChange({ fill: c })} />
          <span className="mx-1 h-6 w-px bg-outline-variant/50" />
        </>
      )}
      <span className="material-symbols-outlined text-[18px] text-on-surface-variant" title={t('curriculum.canvas.strokeColor')}>border_color</span>
      {!line && <ColorDot color={null} active={el.stroke === null} onClick={() => onChange({ stroke: null })} />}
      {SHAPE_COLORS.map((c) => (
        <ColorDot key={`s${c}`} color={c} active={el.stroke === c} onClick={() => onChange({ stroke: c })} />
      ))}
      <CustomColor value={el.stroke ?? '#1f2937'} onChange={(c) => onChange({ stroke: c })} />
      <span className="mx-1 h-6 w-px bg-outline-variant/50" />
      <Stepper label={t('curriculum.canvas.lineWidth')} icon="line_weight" onLess={() => onChange({ strokeWidth: Math.max(0.2, +(el.strokeWidth / 1.3).toFixed(2)) })} onMore={() => onChange({ strokeWidth: Math.min(6, +(el.strokeWidth * 1.3).toFixed(2)) })} iconBtn={iconBtn} />
      <select
        value={el.dash}
        onChange={(e) => onChange({ dash: e.target.value as CanvasShapeElement['dash'] })}
        aria-label={t('curriculum.canvas.dash')}
        className="h-8 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 text-sm text-on-surface"
      >
        {(['solid', 'dashed', 'dotted'] as const).map((d) => (
          <option key={d} value={d}>
            {t(`curriculum.canvas.dash_${d}`)}
          </option>
        ))}
      </select>
      {el.shape === 'roundrect' && (
        <Stepper label={t('curriculum.canvas.radius')} icon="rounded_corner" onLess={() => onChange({ radius: Math.max(0, (el.radius ?? 4) - 1) })} onMore={() => onChange({ radius: Math.min(30, (el.radius ?? 4) + 1) })} iconBtn={iconBtn} />
      )}
    </>
  );
}

/** 효과 창 — 파워포인트의 "애니메이션 창"처럼: 효과 고르기·나타나기/사라지기·시작 방식·속도·지연·미리 보기·순서 */
function MotionPanel({
  primary,
  plan,
  elements,
  selectedIds,
  onApply,
  onClear,
  onMove,
  onPreview,
}: {
  primary: CanvasElement;
  plan: MotionPlan;
  elements: CanvasElement[];
  selectedIds: string[];
  onApply: (patch: Partial<CanvasMotion>) => void;
  onClear: () => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation();
  const m = primary.motion ?? null;
  const effects = effectsFor(primary);
  const seg = (on: boolean) =>
    `min-h-10 flex-1 rounded-lg px-3 font-label-md text-label-md transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface hover:bg-secondary-container/50'}`;
  const label = (el: CanvasElement) =>
    el.type === 'text' ? el.text.trim().split(/\n/)[0].slice(0, 14) || t('curriculum.canvas.addText') : el.type === 'image' ? t('curriculum.canvas.imageLabel') : el.type === 'shape' ? t(`curriculum.canvas.shape_${el.shape}`) : t(`curriculum.canvas.mark_${el.shape}`);
  const byId = new Map(elements.map((e) => [e.id, e]));
  return (
    <div className="space-y-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-label-md text-label-md font-bold text-deep-navy">
          {t('curriculum.canvas.motionTitle')}
          {selectedIds.length > 1 && <span className="ml-2 font-caption text-caption font-normal text-on-surface-variant">{t('curriculum.canvas.motionMulti', { count: selectedIds.length })}</span>}
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={onPreview} disabled={!m} className="flex min-h-10 items-center gap-1 rounded-full bg-secondary-container px-4 font-label-md text-label-md text-on-secondary-container disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">play_circle</span>
            {t('curriculum.canvas.motionPreview')}
          </button>
          <button type="button" onClick={onClear} disabled={!m} className="flex min-h-10 items-center gap-1 rounded-full border border-outline-variant px-4 font-label-md text-label-md text-on-surface-variant disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">block</span>
            {t('curriculum.canvas.motionNone')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('curriculum.canvas.motionEffect')}>
        {effects.map((fx) => (
          <button
            key={fx}
            type="button"
            aria-pressed={m?.effect === fx}
            onClick={() => onApply({ effect: fx })}
            className={`flex min-h-10 items-center gap-1 rounded-full border px-3 font-label-md text-label-md ${
              m?.effect === fx ? 'border-primary bg-primary/10 text-deep-navy' : 'border-outline-variant/60 text-on-surface hover:border-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{effectIcon(fx)}</span>
            {t(`curriculum.canvas.fx_${fx}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="font-caption text-caption text-on-surface-variant">{t('curriculum.canvas.motionKind')}</div>
          <div className="flex gap-1.5">
            <button type="button" className={seg(!!m && !m.out)} onClick={() => onApply({ out: false })}>
              {t('curriculum.canvas.motionIn')}
            </button>
            <button type="button" className={seg(!!m?.out)} onClick={() => onApply({ out: true })}>
              {t('curriculum.canvas.motionOut')}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <div className="font-caption text-caption text-on-surface-variant">{t('curriculum.canvas.motionStart')}</div>
          <div className="flex gap-1.5">
            {(['click', 'with', 'auto'] as const).map((tr) => (
              <button key={tr} type="button" className={seg(m?.trigger === tr)} onClick={() => onApply({ trigger: tr })}>
                {t(`curriculum.canvas.trigger_${tr}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <span className="w-12 shrink-0 text-on-surface-variant">{t('curriculum.canvas.motionSpeed')}</span>
          <input type="range" min={0.2} max={2.5} step={0.1} value={m?.duration ?? 0.6} onChange={(e) => onApply({ duration: Number(e.target.value) })} className="flex-1 accent-[#2765a8]" />
          <span className="w-10 tabular-nums">{(m?.duration ?? 0.6).toFixed(1)}s</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <span className="w-12 shrink-0 text-on-surface-variant">{t('curriculum.canvas.motionDelay')}</span>
          <input type="range" min={0} max={3} step={0.1} value={m?.delay ?? 0} onChange={(e) => onApply({ delay: Number(e.target.value) })} className="flex-1 accent-[#2765a8]" />
          <span className="w-10 tabular-nums">{(m?.delay ?? 0).toFixed(1)}s</span>
        </label>
      </div>

      {plan.ordered.length > 0 && (
        <div className="space-y-1">
          <div className="font-caption text-caption font-bold text-on-surface-variant">{t('curriculum.canvas.motionOrder')}</div>
          <ol className="space-y-1">
            {plan.ordered.map((info, i) => {
              const el = byId.get(info.id);
              if (!el) return null;
              return (
                <li key={info.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${selectedIds.includes(info.id) ? 'bg-primary/10' : 'bg-surface-container-low'}`}>
                  <span className="w-20 shrink-0 text-xs font-bold text-primary">
                    {info.motion.trigger === 'click' ? t('curriculum.canvas.badgeClick', { n: info.step }) : info.motion.trigger === 'with' ? t('curriculum.canvas.badgeWith') : t('curriculum.canvas.badgeAuto')}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{effectIcon(info.motion.effect)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {label(el)} <span className="text-on-surface-variant">· {t(`curriculum.canvas.fx_${info.motion.effect}`)}{info.motion.out ? ` (${t('curriculum.canvas.motionOut')})` : ''}</span>
                  </span>
                  <button type="button" disabled={i === 0} onClick={() => onMove(info.id, -1)} aria-label={t('curriculum.canvas.moveUp')} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-container disabled:opacity-30">
                    <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                  </button>
                  <button type="button" disabled={i === plan.ordered.length - 1} onClick={() => onMove(info.id, 1)} aria-label={t('curriculum.canvas.moveDown')} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-container disabled:opacity-30">
                    <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
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
