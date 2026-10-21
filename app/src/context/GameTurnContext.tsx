import { createContext, useContext, useEffect, useRef } from 'react';
export interface GameTurn {
  current: string; next: string; index: number; total: number;
  enabled?: boolean; canAdvance?: boolean; advance?: () => void;
  title?: string;
}
export const GameTurnContext = createContext<{turn:GameTurn|null;report:(owner:object,turn:GameTurn|null)=>void}|null>(null);
/** Publishes native state for display only. Never creates a second turn engine. */
export function useNativeGameTurn(turn:GameTurn) {
  const context=useContext(GameTurnContext), report=context?.report;
  const owner=useRef({}); const action=useRef(turn.advance); action.current=turn.advance;
  const advance=useRef(()=>action.current?.()).current;
  const {current,next,index,total,enabled=true,canAdvance=false,title}=turn;
  useEffect(()=>{report?.(owner.current,{current,next,index,total,enabled,canAdvance,title,advance});},[report,current,next,index,total,enabled,canAdvance,title,advance]);
  useEffect(()=>{const token=owner.current;return ()=>report?.(token,null);},[report]);
  return !!context;
}
