import type {CSSProperties,ReactNode} from 'react';
import type {PhonicsGame} from '../lib/phonicsGames';
import {CLAY_PROPS,PHONICS_WORLDS,gameVisual,worldBackground,type ClayProp,type PhonicsWorld,type VillageReward} from '../lib/phonicsGameVisuals';

export function ClaySprite({kind,className='',style}:{kind:ClayProp;className?:string;style?:CSSProperties}){
 const n=CLAY_PROPS.indexOf(kind);
 return <span aria-hidden="true" className={'pg-clay-sprite '+className} data-prop={kind} style={{backgroundPosition:`${n%4*100/3}% ${Math.floor(n/4)*50}%`,...style}}/>;
}

/** The catalogue and the player use the same art, rather than an unrelated cover. */
export function PhonicsGameCover({game,large=false}:{game:PhonicsGame;large?:boolean}){
 const visual=gameVisual(game);
 return <div className={'pg-scene-cover '+(large?'pg-cover-large':'')} data-cover-world={visual.world} style={{backgroundImage:`url("${worldBackground(visual.world)}")`}} aria-hidden="true">
  <ClaySprite kind={visual.prop} className="pg-cover-prop"/>
  {visual.action==='connect'&&<ClaySprite kind={visual.world==='train'?'carriage':'robot'} className="pg-cover-companion"/>}
  <span className="pg-cover-tile">{game.number<=5?'Aa':game.number<=10?'c + at':game.number<=15?'a…e':game.number<=20?'sh':game.number<=25?'oo':'abc'}</span>
 </div>;
}

export function PlayWorld({world,children}:{world:PhonicsWorld;children:ReactNode}){
 return <div className="pg-play-world" data-play-world={world} style={{'--pg-world-image':`url("${worldBackground(world)}")`,'--pg-world-color':PHONICS_WORLDS[world].color} as CSSProperties}>{children}</div>;
}

/** Reactions are driven only by real clicks, partial work and checked answers. */
export function LearningStage({game,en,solved,wrong,progress,word,pieces=[],slots=3}:{game:PhonicsGame;en:boolean;solved:boolean;wrong:boolean;progress:number;word:string;pieces?:string[];slots?:number}){
 const visual=gameVisual(game);
 const growth=Math.min(1,progress);
 const status=solved?'success':wrong?'retry':progress>0?'working':'waiting';
 return <div className={'pg-learning-stage pg-action-'+visual.action} data-learning-action={visual.action} data-reaction={status} style={{'--pg-work':growth} as CSSProperties}>
  <span className="pg-stage-caption">{en?visual.en:visual.ko}</span>
  <div className="pg-stage-track" aria-hidden="true">
   {visual.world==='train'?<div className="pg-stage-train"><ClaySprite kind="engine"/>{Array.from({length:game.id==='sound-train'?Math.min(slots,6):3},(_,i)=><span className={'pg-word-carriage '+(pieces[i]||solved?'pg-carriage-ready':'')} key={i}><ClaySprite kind="carriage"/><b lang="en">{game.id==='sound-train'?pieces[i]??'·':solved&&i===0?word:''}</b></span>)}</div>:
    visual.action==='connect'&&visual.prop==='bridge'?<><ClaySprite kind="bridge" className="pg-stage-bridge"/><ClaySprite kind="robot" className="pg-stage-crosser"/></>:
    visual.action==='feed'?<><span className="pg-clay-plate"/><ClaySprite kind="monster" className="pg-stage-monster"/><span className="pg-food-gift">{solved?word:'?'}</span></>:
    visual.action==='fish'?<><span className="pg-stage-water"/><ClaySprite kind="boat" className="pg-stage-boat"/><span className="pg-caught-fish">{solved?word:'?'}</span></>:
    visual.action==='grow'?<div className="pg-growing-bed">{[0,1,2].map(i=><ClaySprite key={i} kind="sprout" className={solved||growth>i/3?'pg-sprout-grown':'pg-sprout-small'}/>)}</div>:
    <><ClaySprite kind={visual.prop} className={'pg-stage-friend pg-friend-'+visual.prop}/>{[0,1,2].map(i=><span key={i} className={'pg-stage-pebble '+(solved||growth>i/3?'pg-pebble-on':'')}/>)}</>}
   {solved&&<span className="pg-clay-sparkles"><i/><i/><i/><i/><i/></span>}
  </div>
  <span className="pg-stage-response" role="status">{solved?(en?'We did it!':'친구가 기뻐해요!'):wrong?(en?'Let’s look together.':'친구와 함께 다시 살펴봐요.'):en?'Ready when you are':'준비되면 천천히 시작해요'}</span>
 </div>;
}

export function ClassroomVillage({rewards,en,onClear}:{rewards:VillageReward[];en:boolean;onClear?:()=>void}){
 return <section className="pg-village" aria-label={en?'Our classroom village':'우리 반 파닉스 마을'}>
  <div className="pg-village-heading"><div><p className="pg-eyebrow">OUR PHONICS VILLAGE</p><h2>{en?'A little village we build together':'함께 만드는 우리 반 마을'}</h2><p>{en?'Finish a game to add a clay friend. Saved in this tab only.':'게임을 마치면 점토 친구가 생겨요. 이 탭에서 함께 모아요.'}</p></div>{onClear&&rewards.length>0&&<button type="button" className="pg-button" onClick={onClear}>{en?'Start a new village':'새 마을 시작'}</button>}</div>
  <div className="pg-village-street">{(Object.keys(PHONICS_WORLDS) as PhonicsWorld[]).map(world=>{const data=PHONICS_WORLDS[world],found=rewards.filter(r=>r.world===world);return <div key={world} className={'pg-village-place '+(found.length?'pg-village-built':'')}><ClaySprite kind={data.prop}/><strong>{en?data.en:data.ko}</strong><span>{found.length?en?`${found.length} gifts`:`선물 ${found.length}개`:en?'Your next discovery':'다음 발견을 기다려요'}</span></div>;})}</div>
 </section>;
}
