import { useCallback, useEffect, useState } from 'react';
import { fetchClasses } from './api';
import type { ClassRow } from './types';

const STORAGE_KEY = 'classbank.selectedClassId';

/**
 * 학원의 반 목록과 "지금 보고 있는 반"을 관리한다.
 * 선택한 반은 localStorage 에 저장해서 페이지를 옮겨도 유지된다.
 */
export function useClasses(academyId: string | null | undefined) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!academyId) return;
    setLoading(true);
    try {
      const rows = await fetchClasses(academyId);
      setClasses(rows);
      setSelectedId((prev) => {
        const stillExists = prev && rows.some((c) => c.id === prev);
        return stillExists ? prev : (rows[0]?.id ?? null);
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return {
    classes,
    selectedId,
    selected: classes.find((c) => c.id === selectedId) ?? null,
    select,
    reload,
    loading,
    error,
  };
}
