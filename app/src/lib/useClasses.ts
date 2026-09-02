import { useCallback, useEffect, useState } from 'react';
import { fetchClasses, reorderClasses } from './api';
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

  /** 드래그로 새 순서가 나오면 화면부터 바로 반영하고, DB 저장은 뒤에서 따라간다. */
  const reorder = useCallback(async (orderedIds: string[]) => {
    setClasses((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]));
      return orderedIds.map((id) => byId.get(id)).filter((c): c is ClassRow => !!c);
    });
    try {
      await reorderClasses(orderedIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await reload();
    }
  }, [reload]);

  return {
    classes,
    selectedId,
    selected: classes.find((c) => c.id === selectedId) ?? null,
    select,
    reload,
    reorder,
    loading,
    error,
  };
}
