import type { ReactNode } from 'react';
import { usePresenting } from '../context/LessonRunnerContext';

/** 편집 UI(뒤로가기·게임 소개·반/템플릿 고르기·편집 패널 등)를 감싼다 — "발표하기" 중에는
 * 아무것도 그리지 않아 수업 화면에 재생 영역만 남는다. 새 게임·자료 페이지를 만들 때도 편집
 * 부분은 이걸로 감쌀 것. */
export default function EditOnly({ children }: { children: ReactNode }) {
  const presenting = usePresenting();
  return presenting ? null : <>{children}</>;
}
