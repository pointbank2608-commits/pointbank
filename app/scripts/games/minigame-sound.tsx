import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MINI_GAME_SOUNDS,useMiniGameSfx,type MiniGame,type MiniGameCue} from '../../src/lib/miniGameSfx';
import {setGameSoundOn} from '../../src/lib/gameSfx';
function Preview(){
  const [game,setGame]=useState<MiniGame>('balloonpop'),[paused,setPaused]=useState(false),[enabled,setEnabled]=useState(true);
  const sfx=useMiniGameSfx(game,enabled,paused);
  return <main><h1>Game sound QA</h1><select aria-label="game" value={game} onChange={e=>setGame(e.target.value as MiniGame)}>{Object.keys(MINI_GAME_SOUNDS).map(g=><option key={g}>{g}</option>)}</select><label><input type="checkbox" checked={paused} onChange={e=>setPaused(e.target.checked)}/>pause</label><label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>template sound</label><button onClick={()=>setGameSoundOn(false)}>global mute</button><button onClick={()=>setGameSoundOn(true)}>global unmute</button><button onClick={()=>{sfx.play('action');sfx.after('correct',700);}}>delayed catch</button>{Object.keys(MINI_GAME_SOUNDS[game]).map(cue=><button key={cue} onClick={()=>sfx.play(cue as MiniGameCue)}>{cue}</button>)}</main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
