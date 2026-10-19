import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchWordLists } from './api';
import { useClasses } from './useClasses';
import type { WordList } from './types';

/**
 * 인쇄 자료(메모리 카드·빙고판)에서 쓰는 반 선택 + 단어장 목록. game_templates CRUD가
 * 필요 없는 가벼운 페이지라 useGameTemplates 전체 대신 이 부분만 뗀 버전.
 */
export function useMaterialsWordLists() {
  const { academy, isStaff } = useAuth();
  const { classes, selectedId: staffClassId, select: selectClass, reorder: reorderClasses } = useClasses(academy?.id);
  const [wordLists, setWordLists] = useState<WordList[]>([]);
  const [wordListsLoading, setWordListsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setWordLists([]);
    if (!academy?.id) {
      setWordListsLoading(false);
      return;
    }
    setWordListsLoading(true);
    fetchWordLists(academy.id, staffClassId || '')
      .then(rows => { if (active) setWordLists(rows); })
      .catch(() => { if (active) setWordLists([]); })
      .finally(() => { if (active) setWordListsLoading(false); });
    return () => { active = false; };
  }, [academy?.id, staffClassId]);

  return { isStaff, classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading };
}
