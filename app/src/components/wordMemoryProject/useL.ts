import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/** 코치 화면과 같은 방식: l('한국어', 'English') — 현재 언어에 맞는 문구를 고른다 */
export function useL() {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  return { en, l: useCallback((ko: string, e: string) => (en ? e : ko), [en]) };
}
