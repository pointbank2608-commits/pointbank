import type { CSSProperties, ReactNode } from 'react';
import { getGameTheme } from '../lib/gameThemes';

interface Props {
  themeId?: string | null;
  className?: string;
  children: ReactNode;
}

/**
 * 게임 플레이 영역을 감싸서 선택된 테마를 입힌다. 지금은 색상 변수만 인라인 style로
 * 얹지만, gameThemes.ts 의 GameTheme 에 배경 이미지·장식 요소가 추가되면 이 컴포넌트
 * 안에서만 렌더링을 확장하면 된다 — 이 컴포넌트를 쓰는 8개 게임 페이지는 그대로 둬도 됨.
 */
export default function GameThemeFrame({ themeId, className, children }: Props) {
  const theme = getGameTheme(themeId);

  return (
    <div className={className} style={theme?.colors as CSSProperties | undefined}>
      {children}
    </div>
  );
}
