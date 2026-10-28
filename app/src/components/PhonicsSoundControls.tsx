import {usePhonicsSound} from '../lib/phonicsGameSound';

export function PhonicsSoundControls({en}:{en:boolean}){
 const sound=usePhonicsSound();
 return <div className="pg-sound-controls" data-sound-controls>
  <button className="pg-button" type="button" aria-label={en?'Sound effects':'효과음'} aria-pressed={sound.on} onClick={sound.toggle}><span className="material-symbols-outlined" aria-hidden="true">{sound.on?'volume_up':'volume_off'}</span>{en?'Effects':'효과음'} {sound.on?(en?'On':'켜짐'):(en?'Off':'꺼짐')}</button>
  <label>{en?'Volume':'음량'}<input aria-label={en?'Effects volume':'효과음 음량'} type="range" min="0" max="100" step="5" value={Math.round(sound.volume*100)} onChange={e=>sound.setVolume(Number(e.target.value)/100)}/><output>{Math.round(sound.volume*100)}%</output></label>
 </div>;
}
