import type {MusicSelection} from './types';
export type BombSound = 'clock' | 'music';
const SOUNDS:Record<BombSound,MusicSelection>={
 clock:{kind:'upload',path:'',name:'Bomb clock',url:'/sounds/bomb-tick.m4a?v=2'},
 music:{kind:'upload',path:'',name:'PassTheBallBGM',url:'/sounds/pass-the-ball-bgm.mp3'},
};
/** Missing/unknown values keep the original clock sound. */
export function bombSound(value?:BombSound):MusicSelection{return SOUNDS[value==='music'?'music':'clock'];}
