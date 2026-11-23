import {useTranslation} from 'react-i18next';
import {useGameHistoryView} from '../context/GameHistoryContext';
import {useGameWorkspace} from '../context/GameWorkspaceContext';
import {useToast} from '../context/ToastContext';

export default function GameHistoryButtons() {
  const {i18n}=useTranslation();const history=useGameHistoryView();const workspace=useGameWorkspace();const {notify}=useToast();
  const en=i18n.language.startsWith('en');
  return <div className="flex shrink-0 items-center gap-1.5" data-game-history-controls>
    {(['undo','redo'] as const).map(direction=>{
      const back=direction==='undo',label=en?(back?'Undo':'Redo'):(back?'뒤로가기':'앞으로가기');
      const enabled=!!history&&(!workspace||workspace.playing&&!workspace.panel&&!workspace.info?.sharedView)&&(back?history.canUndo:history.canRedo);
      return <button key={direction} type="button" aria-label={label} title={en?(back?'Undo the last game action':'Redo the game action'):(back?'뒤로가기 · 방금 한 조작 되돌리기':'앞으로가기 · 취소한 조작 다시 실행')}
        data-game-history={direction} disabled={!enabled} onClick={()=>void(back?history?.undo():history?.redo())?.catch(()=>notify(en?'Could not restore the game. Please try again.':'게임을 복원하지 못했어요. 다시 시도해 주세요.','error'))}
        className="flex h-10 w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-white text-deep-navy transition-colors enabled:hover:bg-surface-container-low disabled:cursor-default disabled:opacity-40 focus-visible:outline-4 focus-visible:outline-primary">
        <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden="true" style={back?undefined:{transform:'scaleX(-1)'}}>
          <path d="M14 7 5 16l9 9M5 16h23c9 0 15 5 15 13s-6 13-15 13H5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>;
    })}
  </div>;
}
