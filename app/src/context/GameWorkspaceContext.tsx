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
  hasSource: boolean;
  pause: () => void;
  openTeams: () => void;
  roster: GameItem[];
  stage: HTMLElement | null;
  running: boolean;
  panel: "settings" | "content" | "games" | null;
  publish: (bridge: GameWorkspaceBridge) => void;
  open: (panel: "settings" | "content" | "games") => void;
  start: () => void;
}
export const GameWorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);
export const useGameWorkspace = () => useContext(GameWorkspaceContext);
