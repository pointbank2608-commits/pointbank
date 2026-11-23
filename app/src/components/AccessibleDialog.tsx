import { useEffect, useRef, type ReactNode } from 'react';
import {useGameHistory} from '../context/GameHistoryContext';

/** Native top layer keeps keyboard focus and remains visible over fullscreen games. */
export default function AccessibleDialog({ label, onClose, children, className = '', nativeDismiss, historyActions=false }: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  nativeDismiss?: 'enabled' | 'disabled';
  historyActions?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const history=useGameHistory();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className={`classroom-dialog ${className}`} aria-label={label} data-game-history-owned={historyActions?history?.owner:undefined}
      onCancel={(event) => {
        if (nativeDismiss === 'enabled') return;
        event.preventDefault();
        if (!nativeDismiss) onClose();
      }}
      onClose={nativeDismiss ? (event) => {
        if (!event.currentTarget.open) onClose();
      } : undefined}>
      {children}
    </dialog>
  );
}
