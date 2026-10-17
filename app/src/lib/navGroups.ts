/** 선생님 사이드바의 5개 묶음(오늘 · 수업 · 자료 · 우리 반 · 더보기). 주소는 그대로이고 묶음과 이름만 바꾼 것이다. */
export type NavFeature = 'group' | 'homework';

export interface NavChild {
  to: string;
  labelKey: string; // i18n 키
  icon: string; // Material Symbols 이름
  feature?: NavFeature; // 학원별 기능 스위치가 닫히면 숨긴다
}

export interface NavGroup {
  id: 'today' | 'lesson' | 'library' | 'class' | 'more';
  labelKey: string;
  icon: string;
  children: NavChild[];
  /** 묶음 행을 눌렀을 때 가는 홈 화면(없으면 첫 항목). 이 주소에서는 묶음만 펼치고 항목은 선택하지 않는다 */
  home?: string;
}

export const STAFF_NAV_GROUPS: NavGroup[] = [
  {
    id: 'today',
    labelKey: 'nav.group_today',
    icon: 'home',
    children: [{ to: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard' }],
  },
  {
    id: 'lesson',
    labelKey: 'nav.group_lesson',
    icon: 'play_circle',
    children: [{ to: '/curriculum', labelKey: 'nav.curriculum', icon: 'auto_stories', feature: 'group' }],
  },
  {
    id: 'library',
    labelKey: 'nav.group_library',
    icon: 'folder',
    home: '/resources',
    children: [
      { to: '/games', labelKey: 'nav.gameCenter', icon: 'sports_esports' },
      { to: '/materials', labelKey: 'nav.classroomMaterials', icon: 'print' },
      { to: '/wordlists', labelKey: 'nav.wordLists', icon: 'library_books' },
      { to: '/dictionary', labelKey: 'nav.dictionary', icon: 'menu_book' },
      { to: '/phonics', labelKey: 'nav.phonics', icon: 'spellcheck' },
      { to: '/grammar', labelKey: 'nav.grammar', icon: 'rule' },
      { to: '/videos', labelKey: 'nav.videoLibrary', icon: 'video_library', feature: 'group' },
    ],
  },
  {
    id: 'class',
    labelKey: 'nav.group_class',
    icon: 'groups',
    children: [
      { to: '/attendance', labelKey: 'nav.attendance', icon: 'calendar_today' },
      { to: '/board', labelKey: 'nav.board', icon: 'payments' },
      { to: '/homework', labelKey: 'nav.homework', icon: 'assignment', feature: 'homework' },
      { to: '/results', labelKey: 'nav.reports', icon: 'assessment' },
    ],
  },
  {
    id: 'more',
    labelKey: 'nav.group_more',
    icon: 'pending',
    children: [
      { to: '/settings', labelKey: 'nav.settings', icon: 'settings' },
      { to: '/help', labelKey: 'nav.help', icon: 'support_agent' },
      { to: '/settings/billing', labelKey: 'nav.billing', icon: 'credit_card' },
    ],
  },
];

/** pathname 이 to 자체이거나 to 아래 경로인가 */
export function pathMatches(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** 기능 스위치가 닫힌 항목을 빼고, 항목이 하나도 안 남은 묶음은 뺀다 */
export function visibleGroups(groups: NavGroup[], open: Record<NavFeature, boolean>): NavGroup[] {
  return groups
    .map((g) => ({ ...g, children: g.children.filter((c) => !c.feature || open[c.feature]) }))
    .filter((g) => g.children.length > 0);
}

/** 지금 주소가 속한 묶음과 항목. 가장 긴 주소가 맞는 항목을 고른다(`/settings/billing` 은 요금제). 없으면 null */
export function findActive(groups: NavGroup[], pathname: string): { group: NavGroup; child: NavChild } | null {
  let best: { group: NavGroup; child: NavChild } | null = null;
  for (const group of groups) {
    for (const child of group.children) {
      if (pathMatches(pathname, child.to) && (!best || child.to.length > best.child.to.length)) {
        best = { group, child };
      }
    }
  }
  if (!best) {
    const home = groups.find((g) => g.home && pathMatches(pathname, g.home));
    if (home) best = { group: home, child: { to: home.home as string, labelKey: home.labelKey, icon: home.icon } };
  }
  return best;
}
