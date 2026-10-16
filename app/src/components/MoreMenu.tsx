import { useEffect, useRef, useState } from 'react';

export interface MoreMenuItem {
  key: string;
  label: string; // 이미 번역된 글
  icon?: string; // Material Symbols 이름
  danger?: boolean; // 삭제처럼 위험한 항목(글자색 text-error, 위에 구분선)
  onSelect: () => void;
}

interface Props {
  triggerLabel: string; // 이미 번역된 글 — "더보기"
  items: MoreMenuItem[];
  className?: string; // 바깥 래퍼에 붙는 클래스(폭 조절용)
}

/** 카드의 "더보기" 메뉴. 글자 있는 버튼 + 바깥 클릭·Esc 로 닫히는 목록. */
export default function MoreMenu({ triggerLabel, items, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full border border-outline-variant px-4 font-label-md text-label-md text-on-surface-variant hover:border-primary hover:text-primary"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden>
          more_horiz
        </span>
        {triggerLabel}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg"
        >
          {items.map((item) => (
            <div key={item.key} className={item.danger ? 'mt-1 border-t border-outline-variant/50 pt-1' : ''}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left font-label-md text-label-md hover:bg-surface-container-low ${
                  item.danger ? 'text-error' : 'text-on-surface'
                }`}
              >
                {item.icon && (
                  <span className="material-symbols-outlined text-[18px]" aria-hidden>
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
