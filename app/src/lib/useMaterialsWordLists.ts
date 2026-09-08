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
    if (!academy?.id || !staffClassId) {
      setWordLists([]);
      return;
    }
    setWordListsLoading(true);
    fetchWordLists(academy.id, staffClassId)
      .then(setWordLists)
      .catch(() => setWordLists([]))
      .finally(() => setWordListsLoading(false));
  }, [academy?.id, staffClassId]);

  return { isStaff, classes, staffClassId, selectClass, reorderClasses, wordLists, wordListsLoading };
}
