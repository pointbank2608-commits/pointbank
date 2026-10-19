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
  beginMaterial: (kind: 'word' | 'sentence') => Promise<void>;
  saveMaterial: (name: string) => Promise<void>;
  temporary: boolean;
  useSource: (source: { cards: FullCardItem[]; kind: 'word' | 'sentence'; name: string }) => Promise<void>;
  saveActivity: (name: string) => Promise<void>;
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
  playing: boolean;
  teacherToolsTarget: HTMLElement | null;
  exitPlay: () => void;
  turn: { current: string; next: string; advance: () => void } | null;
  hasSource: boolean;
  pause: () => void;
  openTeams: () => void;
  roster: GameItem[];
  stage: HTMLElement | null;
  running: boolean;
  panel: "settings" | "content" | "games" | "teacher" | null;
  publish: (bridge: GameWorkspaceBridge) => void;
  open: (panel: "settings" | "content" | "games" | "teacher") => void;
  start: () => void;
}
export const GameWorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);
export const useGameWorkspace = () => useContext(GameWorkspaceContext);
