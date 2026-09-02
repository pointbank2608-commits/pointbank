import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ClassRow } from '../lib/types';

interface Props {
  classes: ClassRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (orderedIds: string[]) => void | Promise<void>;
}

const DRAG_THRESHOLD_PX = 6;

/** 반 선택 칩 목록. 마우스/터치로 눌러서 순서를 그대로 드래그해 바꿀 수 있다(Pointer Events 하나로
 * 마우스·터치 둘 다 처리). 살짝만 움직이면(DRAG_THRESHOLD_PX 미만) 드래그가 아니라 클릭(선택)으로
 * 본다. */
export default function ClassChipRow({ classes, selectedId, onSelect, onReorder }: Props) {
  const [order, setOrder] = useState<string[]>(() => classes.map((c) => c.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const orderRef = useRef(order);

  const idsKey = classes.map((c) => c.id).join('|');
  useEffect(() => {
    const next = classes.map((c) => c.id);
    setOrder(next);
    orderRef.current = next;
  }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = new Map(classes.map((c) => [c.id, c]));
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragState = useRef<{ id: string; startX: number; startY: number; dragging: boolean } | null>(null);

  /** orderRef 를 먼저 동기적으로 갱신하고 setOrder 는 화면 반영만 맡긴다 — setState의 함수형
   * updater 안에서 ref를 갱신하면, React가 그 updater를 실제로 호출하는 시점(배치 처리 후)이
   * pointerup 핸들러 실행보다 늦어서 orderRef가 아직 옛 값인 채로 커밋되는 문제가 있었다. */
  function setChipOrder(next: string[]) {
    orderRef.current = next;
    setOrder(next);
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragState.current = { id, startX: e.clientX, startY: e.clientY, dragging: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const st = dragState.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      st.dragging = true;
      setDraggingId(st.id);
    }
    let hoveredId: string | null = null;
    for (const [id, el] of chipRefs.current) {
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        hoveredId = id;
        break;
      }
    }
    if (!hoveredId || hoveredId === st.id) return;
    const prev = orderRef.current;
    const next = prev.filter((x) => x !== st.id);
    next.splice(next.indexOf(hoveredId), 0, st.id);
    setChipOrder(next);
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const st = dragState.current;
    dragState.current = null;
    setDraggingId(null);
    if (!st) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (st.dragging) {
      void onReorder(orderRef.current);
    } else {
      onSelect(st.id);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {order.map((id) => {
        const c = byId.get(id);
        if (!c) return null;
        return (
          <button
            key={c.id}
            ref={(el) => {
              if (el) chipRefs.current.set(c.id, el);
              else chipRefs.current.delete(c.id);
            }}
            type="button"
            onPointerDown={(e) => handlePointerDown(e, c.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
            className={`select-none px-4 py-2 rounded-full font-label-md text-label-md transition-all cursor-grab active:cursor-grabbing ${
              draggingId === c.id ? 'opacity-60 shadow-md scale-105' : ''
            } ${
              c.id === selectedId
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low'
            }`}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
