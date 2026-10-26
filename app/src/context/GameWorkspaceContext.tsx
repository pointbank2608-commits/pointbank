import { createContext, useContext } from "react";
import type {
  ClassRow,
  FullCardItem,
  GameItem,
  GameTemplate,
  GameType,
  WordList,
} from "../lib/types";

export interface GameWorkspaceBridge {
  applyGuide: (content: { items: GameItem[]; config: GameTemplate['config'] }) => Promise<void>;
  sampleGuide: () => Promise<void>;
  renameActivity: () => Promise<void>;
  beginMaterial: (kind: 'word' | 'sentence') => Promise<void>;
  saveMaterial: (name: string) => Promise<void>;
  temporary: boolean;
  useSource: (source: { cards: FullCardItem[]; kind: 'word' | 'sentence'; name: string }) => Promise<void>;
  saveActivity: (name: string) => Promise<void>;
  saveSettings: (name?: string) => Promise<void>;
  settingsPending: boolean;
  sharedView: boolean;
  gameType: GameType;
  classId: string | null;
  academyId: string;
  classes: ClassRow[];
  roster: GameItem[];
  teamCount?: number;
  configureTeams: (count: number) => Promise<void>;
  lists: WordList[];
  templates: GameTemplate[];
  selected: GameTemplate | null;
  loading: boolean;
  selectClass: (id: string) => void;
  selectTemplate: (id: string) => void;
  useList: (list: WordList) => Promise<void>;
  switchGame: (type: GameType) => Promise<void>;
  sourceCards: FullCardItem[] | null;
}
export interface WorkspaceContextValue {
  fullscreen: boolean;
  setFullscreen: (value: boolean) => void;
  canStart: boolean;
  readiness: string;
  validation: string;
  playing: boolean;
  teacherToolsTarget: HTMLElement | null;
  exitPlay: () => void;
  turn: { current: string; next: string; index: number; total: number; advance: () => boolean } | null;
  hasSource: boolean;
  pause: () => void;
  openTeams: () => void;
  roster: GameItem[];
  stage: HTMLElement | null;
  running: boolean;
  panel: "settings" | "content" | "games" | "teacher" | "video" | "guide" | null;
  publish: (bridge: GameWorkspaceBridge) => void;
  open: (panel: "settings" | "content" | "games" | "teacher" | "video" | "guide" | null) => void;
  start: () => void;
}
export const GameWorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);
export const useGameWorkspace = () => useContext(GameWorkspaceContext);
