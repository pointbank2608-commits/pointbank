import {useCallback,useContext,useMemo,useState,type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {GameTurnContext,type GameTurn} from '../context/GameTurnContext';
import {useGameWorkspace} from '../context/GameWorkspaceContext';
import '../styles/game-turn.css';
export function GameTurnProvider({children}:{children:ReactNode}) {
 const [entry,setEntry]=useState<{owner:object;turn:GameTurn}|null>(null);
 const report=useCallback((owner:object,turn:GameTurn|null)=>setEntry(old=>turn?{owner,turn}:old?.owner===owner?null:old),[]);
 const value=useMemo(()=>({turn:entry?.turn??null,report}),[entry,report]);
 return <GameTurnContext.Provider value={value}>{children}</GameTurnContext.Provider>;
}
export function GameTurnDisplay() {
 const context=useContext(GameTurnContext),workspace=useGameWorkspace();const {t}=useTranslation();
 // 공통 차례(반 설정에서 정한 순서)는 도구줄 아래 차례 바가 이미 보여 주므로 게임 안에는 따로 그리지 않는다.
 // 게임이 자기 차례 표시를 직접 알린 경우(native)에만 그린다.
 const native=context?.turn;
 const turn:GameTurn|null=native??null;
 if(!turn||turn.enabled===false||(workspace&&!workspace.playing))return null;
 const blocked=!!workspace&&(!workspace.running||!!workspace.panel);
 return <section className="game-turn-display" data-turn-display data-current-next={!native?true:undefined} aria-label={t('turnDisplay.region')}>
   <div className="game-turn-person" role="status" aria-live="polite" aria-atomic="true" key={`${turn.current}:${turn.index}`}>
     <span className="game-turn-caption">{turn.title||t('turnDisplay.current')}</span><strong data-turn-current>{turn.current}</strong>
   </div>
   <div className="game-turn-upcoming"><span>{t('turnDisplay.next')}</span><strong data-turn-next>{turn.next||t('turnDisplay.complete')}</strong><small>{t('turnDisplay.position',{index:turn.index+1,total:turn.total})}</small></div>
   {turn.advance&&turn.canAdvance&&<button type="button" data-turn-advance disabled={blocked} onClick={turn.advance}>{t('turnDisplay.pass',{name:turn.next})} <span aria-hidden="true">→</span></button>}
 </section>;
}
