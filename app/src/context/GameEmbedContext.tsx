import { createContext, useContext, type ReactNode } from 'react';
import type { GameContent } from '../lib/gameFromWords';

/**
 * Supplies the lesson slot to the same game player and toolbar used at /games.
 * The lesson class is the initial roster. Applying settings saves content for the
 * slide, while choosing a saved template notifies the lesson through onSelect.
 * Activity-picker previews pass preview instead of an editable slideId.
 */
export interface GameEmbed {
  classId: string | null;
  templateId?: string;
  /** The editable lesson slot, separate from a read-only activity preview. */
  slideId?: string;
  initialContent?: GameContent | null;
  title?: string;
  inheritedGrammar?: boolean;
  sourceListId?: string;
  materialActions?: ReactNode;
  onSelect: (templateId: string | null, slideVersion?: { sourceListId?: string }) => void;
  preview?: { content: GameContent | null; title: string };
}

export const GameEmbedContext = createContext<GameEmbed | null>(null);

export function useGameEmbed(): GameEmbed | null {
  return useContext(GameEmbedContext);
}
