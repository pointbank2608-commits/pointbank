/**
 * 게임 비주얼 테마 레지스트리. 지금은 색상만 있지만, 나중에 배경 이미지·장식 요소·폰트 같은
 * "분위기"를 더할 때도 여기 GameTheme 인터페이스에 필드만 추가하면 된다 — 8개 게임 페이지나
 * tailwind.css는 다시 건드릴 필요 없이 GameThemeFrame.tsx 렌더링 로직만 손보면 끝난다.
 */

export interface GameTheme {
  id: string;
  /** 선택기(GameThemePicker)에 보여줄 이름의 i18n 키. */
  nameKey: string;
  /** CSS 커스텀 프로퍼티 재정의. Tailwind 유틸리티(bg-primary 등)가 이미 var(--color-*)를
   *  참조하므로, 이 값을 플레이 영역에 인라인 style로 얹기만 하면 게임 컴포넌트 코드를
   *  하나도 안 고치고 색이 바뀐다. */
  colors: Record<string, string>;
  /** 나중에 채울 자리 — 배경 이미지, 장식 이모지, 전용 폰트 등. 지금은 전부 비워둠. */
  backgroundImageUrl?: string;
  decorativeEmoji?: string;
  fontFamily?: string;
}

export const GAME_THEMES: GameTheme[] = [
  {
    id: 'space',
    nameKey: 'gameTheme.space',
    colors: {
      '--color-primary': '#4c3fd6',
      '--color-on-primary': '#ffffff',
      '--color-primary-container': '#e3e0ff',
      '--color-on-primary-container': '#241a66',
      '--color-secondary': '#7c4dff',
      '--color-secondary-container': '#ede7ff',
      '--color-on-secondary-container': '#4527a0',
      '--color-tertiary-container': '#2a2065',
      '--color-on-tertiary-container': '#d6cfff',
      '--color-deep-navy': '#14103a',
      '--color-warm-yellow': '#ffd54f',
      '--color-surface-container-lowest': '#ffffff',
      '--color-surface-container-low': '#f1eeff',
      '--color-surface-container-high': '#dad2ff',
      '--color-on-surface': '#1c1840',
      '--color-on-surface-variant': '#4a4570',
      '--color-outline-variant': '#c7c0ec',
      '--color-background': '#f4f2ff',
    },
  },
  {
    id: 'jungle',
    nameKey: 'gameTheme.jungle',
    colors: {
      '--color-primary': '#2e7d32',
      '--color-on-primary': '#ffffff',
      '--color-primary-container': '#dcf0dc',
      '--color-on-primary-container': '#0d3a11',
      '--color-secondary': '#ef6c00',
      '--color-secondary-container': '#ffe4cc',
      '--color-on-secondary-container': '#8a4200',
      '--color-tertiary-container': '#7a5b00',
      '--color-on-tertiary-container': '#ffe9a6',
      '--color-deep-navy': '#14301a',
      '--color-warm-yellow': '#f4d35e',
      '--color-surface-container-lowest': '#ffffff',
      '--color-surface-container-low': '#eaf4e7',
      '--color-surface-container-high': '#c9e2c3',
      '--color-on-surface': '#17281a',
      '--color-on-surface-variant': '#3f5241',
      '--color-outline-variant': '#bbd3b5',
      '--color-background': '#f0f8ee',
    },
  },
  {
    id: 'candy',
    nameKey: 'gameTheme.candy',
    colors: {
      '--color-primary': '#e91e8c',
      '--color-on-primary': '#ffffff',
      '--color-primary-container': '#ffe1f0',
      '--color-on-primary-container': '#6b0d42',
      '--color-secondary': '#7c4dff',
      '--color-secondary-container': '#ede3ff',
      '--color-on-secondary-container': '#4527a0',
      '--color-tertiary-container': '#7e2f5f',
      '--color-on-tertiary-container': '#ffd3ec',
      '--color-deep-navy': '#4a1942',
      '--color-warm-yellow': '#ffd54f',
      '--color-surface-container-lowest': '#ffffff',
      '--color-surface-container-low': '#ffecf5',
      '--color-surface-container-high': '#ffc9e4',
      '--color-on-surface': '#3a0f2c',
      '--color-on-surface-variant': '#6b4059',
      '--color-outline-variant': '#f2b9d9',
      '--color-background': '#fff3fa',
    },
  },
];

export function getGameTheme(id?: string | null): GameTheme | undefined {
  if (!id) return undefined;
  return GAME_THEMES.find((theme) => theme.id === id);
}
