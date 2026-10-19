import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import { useAuth } from '../context/AuthContext';

const memory = new Map<string, string>();
/** Protect the existing editor's unsubmitted text. This never writes a saved resource. */
export function useRecoverableField(field: string, initial = ''): [string, (value: SetStateAction<string>) => void] {
  const { session, academy } = useAuth();
  const key = `classbank:editor-field:${session?.user.id}:${academy?.id}:${field}`;
  const read = () => { try { return sessionStorage.getItem(key) ?? memory.get(key) ?? initial; } catch { return memory.get(key) ?? initial; } };
  const [entry, setEntry] = useState(() => ({ key, value: read() }));
  useEffect(() => { setEntry({ key, value: read() }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const setValue = useCallback((next: SetStateAction<string>) => {
    setEntry(current => {
      const previous = current.key === key ? current.value : read();
      const value = typeof next === 'function' ? next(previous) : next;
      memory.set(key, value);
      try { sessionStorage.setItem(key, value); } catch { /* memory recovery remains */ }
      return { key, value };
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [entry.key === key ? entry.value : read(), setValue];
}
