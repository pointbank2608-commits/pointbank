import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PHONICS_STAGES } from '../data/phonicsCurriculum';
import { type CourseUnit } from '../data/phonicsLessons';
import { fetchPhonicsBank } from '../lib/api';
import { courseUnits } from '../data/phonicsLessons';
import { PHONICS_GAMES, alphabetGlyph, gameAvailability, gameName, gamePool, blankOf, makeRound, patternKey, patternLabel, phonicsGameUnits, pictureEligible, shuffled, targetText, type PhonicsGame } from '../lib/phonicsGames';
import type { PhonicsBankEntry } from '../lib/types';
import {ClaySprite,ClassroomVillage,LearningStage,PhonicsGameCover,PlayWorld} from '../components/PhonicsGameArt';
import {PHONICS_WORLDS,addVillageReward,gameVisual,readVillageRewards,type PhonicsWorld,type VillageReward} from '../lib/phonicsGameVisuals';
import {PhonicsSoundContext,usePhonicsGameSound,usePhonicsSound} from '../lib/phonicsGameSound';
import {PhonicsSoundControls} from '../components/PhonicsSoundControls';
import {DragBox,DragButton} from '../components/PhonicsDrag';
import {hasPhoneme,playPhoneme} from '../lib/phonicsPhonemes';
import {clockSeconds,formFor,twistOf,type PlayForm} from '../lib/phonicsTwists';
import '../styles/phonics-games.css';
import '../styles/phonics-games-v2.css';

export type PlayLevel='easy'|'normal'|'hard';
const TEAM_NAMES:[string[],string[]]=[['빨강팀','파랑팀','초록팀','노랑팀'],['Red','Blue','Green','Yellow']];
const TEAM_COLORS=['#d95f4b','#3f7fd0','#4c9a62','#d7a22b'];
const PRAISE:[string[],string[]]=[['잘했어요!','멋져요!','대단해요!','최고예요!'],['Great job!','Awesome!','Well done!','Super!']];
const RULE_FALLBACK:Record<string,[string,string]>={build:['글자를 순서대로 눌러서 단어를 만들어요.','Tap the letters in order to build the word.'],fill:['빠진 글자를 끌어서 빈칸에 놓아요.','Drag the missing letters into the blank.'],change:['첫 글자를 끌어서 빈칸에 놓아 새 단어를 만들어요.','Drag a first letter into the blank to make a new word.']};
const l=(en:boolean,ko:string,english:string)=>en?english:ko;
const icon=(name:string)=><span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
function MarkedWord({entry}:{entry:PhonicsBankEntry}){return <span className="pg-word" lang="en">{[...entry.word].map((c,i)=><span key={i} className={entry.targets?.includes(i)?'pg-mark':''}>{c}</span>)}</span>;}
/** 단어 속 빈칸(_)을 끌어다 놓을 수 있는 칸으로 보여 준다. 맞히면 칸에 정답이 들어간다. */
function BlankWord({text,filled,answer,label}:{text:string;filled:boolean;answer:string;label:string}){
 const m=text.match(/_+/);if(!m)return <>{text}</>;const i=m.index??0;
 return <>{text.slice(0,i)}<span className={'pg-blank '+(filled?'pg-blank-filled':'')} data-drop="blank" role="img" aria-label={label}>{filled?answer:'\u00a0'.repeat(Math.max(2,m[0].length))}</span>{text.slice(i+m[0].length)}</>;
}
/** 목표 소리(음가)를 들려 준다. 녹음 파일이 있는 규칙에만 보인다. */
function PhonemeButton({ruleId,label,en}:{ruleId:string;label:string;en:boolean}){
 const [failed,setFailed]=useState(false);
 if(!hasPhoneme(ruleId))return null;
 return <button className="pg-button pg-phoneme" type="button" data-learning-audio onClick={()=>{void playPhoneme(ruleId).then(ok=>setFailed(!ok));}}>{icon('graphic_eq')}{l(en,'소리 듣기','Hear the sound')} <b lang="en">{label}</b>{failed&&<small role="status">{l(en,'소리를 재생할 수 없어요.','Could not play the sound.')}</small>}</button>;
}
function WordPicture({entry,en}:{entry:PhonicsBankEntry;en:boolean}){
 const [broken,setBroken]=useState(false);
 return entry.image_url&&!broken?<img className="pg-picture" src={entry.image_url} alt="" onError={()=>setBroken(true)}/>:<span className="pg-picture-fallback">{l(en,'그림 대신 단어로 읽어요','Read the word instead')}<strong lang="en">{entry.word}</strong></span>;
}
function Audio({text,en,onHelp}:{text:string;en:boolean;onHelp?:()=>void}){
 const {player}=usePhonicsSound();
 const [failed,setFailed]=useState(false);
 return <><button className="pg-button" type="button" data-learning-audio onClick={()=>{onHelp?.();player.stop();if(!('speechSynthesis' in window)){setFailed(true);return;}setFailed(false);const end=player.speechStart(text);window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.rate=.85;const voice=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(voice)utterance.voice=voice;utterance.onend=end;utterance.onerror=e=>{end();if(!['canceled','interrupted'].includes(e.error))setFailed(true);};try{window.speechSynthesis.speak(utterance);}catch{end();setFailed(true);}}}>{icon('volume_up')}{l(en,'단어·문장 듣기','Hear word / sentence')}</button>{failed&&<p role="status">{l(en,'이 기기에서 음성을 재생할 수 없어요. 선생님이 읽어 주세요.','Speech is unavailable. Ask your teacher to read it.')}</p>}</>;
}

export default function PhonicsGamesPage(){
 const {i18n}=useTranslation();const en=i18n.resolvedLanguage?.startsWith('en')??false;
 const {gameId}=useParams();const [params,setParams]=useSearchParams();
 const [units,setUnits]=useState(phonicsGameUnits);
 useEffect(()=>{let active=true;void fetchPhonicsBank().then(rows=>{if(active)setUnits(courseUnits(rows));}).catch(()=>{});return()=>{active=false;};},[]);
 const rawUnit=params.get('unit');const requested=units.find(u=>u.id===rawUnit);
 const unit=requested??units[0];const game=PHONICS_GAMES.find(g=>g.id===gameId);
 const [query,setQuery]=useState('');const [rounds,setRounds]=useState(6);
 const [playing,setPlaying]=useState(false);const [seed,setSeed]=useState(1);
 const sound=usePhonicsGameSound(game??PHONICS_GAMES[0],playing);
 const [guide,setGuide]=useState(false);
 const [teams,setTeams]=useState(1);const [level,setLevel]=useState<PlayLevel>('normal');
 const [autoSpeak,setAutoSpeakState]=useState(()=>{try{return localStorage.getItem('classbank.phonics.autoSpeak')==='1';}catch{return false;}});
 const setAutoSpeak=(on:boolean)=>{setAutoSpeakState(on);try{localStorage.setItem('classbank.phonics.autoSpeak',on?'1':'0');}catch{/* The choice only lasts for this visit. */}};
 const [world,setWorld]=useState<PhonicsWorld|'all'>('all');
 const [rewards,setRewards]=useState(readVillageRewards);
 const pick=(id:string)=>{setPlaying(false);setParams({unit:id},{replace:true});};
 const invalid=Boolean(rawUnit&&!requested)||Boolean(gameId&&!game);
 const reason=game?gameAvailability(game,unit,en):null;
 const candidates=PHONICS_GAMES.filter(g=>(!query||`${g.ko} ${g.en} ${g.goal.join(' ')}`.toLowerCase().includes(query.toLowerCase()))&&g.stages.includes(unit.step)&&(world==='all'||gameVisual(g).world===world));
 const start=()=>{setSeed(crypto.getRandomValues(new Uint32Array(1))[0]);setPlaying(true);};
 return <PhonicsSoundContext.Provider value={sound}><main className={'phonics-games pg-v2 '+(playing?'pg-is-playing':'')} data-phonics-games>
  <nav className="pg-tabs" aria-label={l(en,'게임 카테고리','Game categories')}><Link to="/games">{l(en,'기존 게임','Classroom games')}</Link><Link to="/phonics-games" aria-current="page">{l(en,'파닉스 게임','Phonics Games')}</Link></nav>
  <header className="pg-hero"><div><p className="pg-eyebrow">CLASSBANK · CLAY PLAY</p><h1>{game?gameName(game,en):l(en,'파닉스 게임','Phonics Games')}</h1><p>{game?gameVisual(game)[en?'en':'ko']:l(en,'글자를 만지고, 소리를 잇고, 우리 마을을 만들어요.','Touch the letters. Connect the sounds. Build our village.')}</p></div><PhonicsGameCover game={game??PHONICS_GAMES[5]} large/></header>
  {invalid?<div className="pg-panel" role="alert"><p>{l(en,'찾을 수 없는 게임 또는 수업 유닛이에요.','This game or unit could not be found.')}</p><Link to="/phonics-games">{l(en,'파닉스 게임 목록','Phonics Games catalogue')}</Link></div>:<>
   {!playing&&<section className="pg-panel pg-setup" aria-label={l(en,'수업 선택','Choose lesson')}>
    <div className="pg-levels">{PHONICS_STAGES.map(s=><button key={s.number} type="button" aria-pressed={unit.step===s.number} onClick={()=>pick(units.find(u=>u.step===s.number)!.id)}>{l(en,`${s.number}단계`,`Level ${s.number}`)}</button>)}</div>
    <label>{l(en,'오늘 수업 유닛','Today’s unit')}<select value={unit.id} onChange={e=>pick(e.target.value)}>{units.filter(u=>u.step===unit.step).map(u=><option key={u.id} value={u.id}>Unit {u.number} · {u.groups.map(g=>g.label).join(' / ')}</option>)}</select></label>
    <p className="pg-unit-summary">{unit.entries.length}{l(en,'개 학습 항목',' learning entries')} · {unit.groups.map(g=>g.label).join(' / ')}</p>
    <details><summary>{l(en,'이번 유닛 단어 보기','View this unit’s words')}</summary><p lang="en">{unit.entries.map(e=>e.word).join(' · ')}</p></details>
   </section>}
   {!game?<><ClassroomVillage rewards={rewards} en={en} onClear={()=>{try{sessionStorage.removeItem('classbank.phonics.village.v2');}catch{/* The in-memory village can still be cleared. */}setRewards([]);}}/><div className="pg-world-filter" aria-label={l(en,'놀이 세계','Play worlds')}><button type="button" aria-pressed={world==='all'} onClick={()=>setWorld('all')}>{l(en,'모든 세계','All worlds')}</button>{(Object.keys(PHONICS_WORLDS) as PhonicsWorld[]).map(id=><button type="button" key={id} aria-pressed={world===id} onClick={()=>setWorld(id)}><ClaySprite kind={PHONICS_WORLDS[id].prop}/>{PHONICS_WORLDS[id][en?'en':'ko']}</button>)}</div><div className="pg-catalog-heading"><h2>{l(en,`${unit.step}단계에서 고르기`,`Choose a Level ${unit.step} game`)}</h2><label>{l(en,'게임 검색','Search games')}<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
    <div className="pg-grid">{candidates.map(g=>{const blocked=gameAvailability(g,unit,en);return <article className={'pg-game-card '+(blocked?'pg-unavailable':'')} key={g.id} data-game-card={g.id}><PhonicsGameCover game={g}/><div><p className="pg-eyebrow">{g.number>=36?l(en,'모험 게임','Adventure'):l(en,'학습 게임','Learning game')}</p><h3>{gameName(g,en)}</h3><p>{g.goal[en?1:0]}</p>{blocked?<p className="pg-reason">{blocked}</p>:<span className="pg-ready">{l(en,'이 유닛으로 바로 시작','Ready for this unit')}</span>}<Link className="pg-button" to={`/phonics-games/${g.id}?unit=${unit.id}`}>{blocked?l(en,'게임·유닛 안내','View requirements'):l(en,'게임 열기','Open game')}{icon('arrow_forward')}</Link></div></article>;})}</div>
    {!candidates.length&&<p role="status">{l(en,'검색 결과가 없어요. 다른 이름으로 찾아보세요.','No games found. Try another search.')}</p>}
    <p className="pg-footnote">{l(en,'전체 40종 중 선택한 단계의 게임을 보여 줍니다. 문장 게임은 검토가 끝난 수업에서 열립니다.','Showing this level’s games from the 40-game library. Sentence games use approved lessons only.')}</p>
   </>:playing?<GameSession key={`${game.id}:${unit.id}:${seed}`} game={game} unit={unit} en={en} rounds={rounds} seed={seed} teams={teams} level={level} autoSpeak={autoSpeak} onReward={reward=>setRewards(addVillageReward(reward))} rewards={rewards} onExit={()=>setPlaying(false)}/>:<section className="pg-panel pg-launch">
    <h2>{l(en,'이 유닛으로 놀아요','Play with this unit')}</h2><p>Level {unit.step} · Unit {unit.number} · {unit.groups.map(g=>g.label).join(' / ')}</p>
    {game.id==='ow-crossroads'&&<p className="pg-note">{l(en,'5단계 Unit 3의 ow /oʊ/와 Unit 6의 ow /aʊ/를 함께 복습합니다.','Reviews ow /oʊ/ from Level 5 Unit 3 and ow /aʊ/ from Unit 6.')}</p>}
    {reason?<p className="pg-reason" role="status">{reason}</p>:<><label>{l(en,'문제 수','Rounds')}<select aria-label={l(en,'문제 수','Rounds')} value={rounds} onChange={e=>setRounds(Number(e.target.value))}>{[3,6,10].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
     <fieldset className="pg-options-set"><legend>{l(en,'함께 하는 방법','How to play')}</legend>
      <label>{l(en,'팀','Teams')}<select aria-label={l(en,'팀','Teams')} value={teams} onChange={e=>setTeams(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n===1?l(en,'모두 함께 (1팀)','Everyone together'):l(en,`${n}팀 대결`,`${n} teams`)}</option>)}</select></label>
      <label>{l(en,'난이도','Difficulty')}<select aria-label={l(en,'난이도','Difficulty')} value={level} onChange={e=>setLevel(e.target.value as PlayLevel)}><option value="easy">{l(en,'쉬움 · 그림과 글자를 함께 보여 줘요','Easy · picture and word')}</option><option value="normal">{l(en,'보통','Normal')}</option><option value="hard">{l(en,'도전 · 그림 없이 소리로 풀어요','Challenge · listen, no picture')}</option></select></label>
      <label className="pg-check"><input type="checkbox" checked={autoSpeak} onChange={e=>setAutoSpeak(e.target.checked)}/>{l(en,'문제마다 설명을 소리로 읽어 줘요 (글을 못 읽는 친구용)','Read each instruction aloud (for pre-readers)')}</label>
     </fieldset>
     <button type="button" className="pg-primary" onClick={start}>{icon('play_arrow')}{l(en,'게임 시작','Start game')}</button></>}
    <button type="button" className="pg-button" aria-expanded={guide} onClick={()=>setGuide(v=>!v)}>{l(en,'선생님 안내','Teacher guide')}</button>
    {guide&&<aside className="pg-note"><p>{game.goal[en?1:0]}</p><p>{l(en,'전자칠판에서 함께 하세요. 시간 제한 없이 다시 시도할 수 있고, 정답 뒤에 선생님이 다음 문제로 넘깁니다.','Play together on your classroom display. There is no timer. Retry freely, then advance after checking the answer.')}</p><p>{l(en,'듣기 버튼은 전체 단어·문장 발음입니다. 개별 음가는 선생님이 들려주세요.','The audio button reads whole words or sentences. Model individual phonemes yourself.')}</p><p>{l(en,'이번 결과는 이 기기의 수업 요약이며 학생 숙련도나 숙제 기록에 반영하지 않습니다.','The session summary stays on this device and does not update student mastery or homework.')}</p></aside>}
    <Link className="pg-button" to={`/phonics-games?unit=${unit.id}`}>{l(en,'다른 파닉스 게임','Other phonics games')}</Link><Link className="pg-button" to={`/phonics/lesson?unit=${unit.id}&lesson=1`}>{l(en,'수업 슬라이드','Lesson slides')}</Link>
   </section>}
  </>}
 </main></PhonicsSoundContext.Provider>;
}

function GameSession({game,unit,en,rounds,seed,teams,level,autoSpeak,onExit,onReward,rewards}:{game:PhonicsGame;unit:CourseUnit;en:boolean;rounds:number;seed:number;teams:number;level:PlayLevel;autoSpeak:boolean;onExit:()=>void;onReward:(reward:VillageReward)=>void;rewards:VillageReward[]}){
 const {player}=usePhonicsSound();
 const [index,setIndex]=useState(0),[done,setDone]=useState(false),[paused,setPaused]=useState(false),[large,setLarge]=useState(false);
 const [results,setResults]=useState<boolean[]>([]);const [leaving,setLeaving]=useState(false);
 const [stars,setStars]=useState(0),[combos,setCombos]=useState<number[]>(()=>Array(teams).fill(0)),[bestCombo,setBestCombo]=useState(0);
 const [teamStars,setTeamStars]=useState<number[]>(()=>Array(teams).fill(0));
 const [burst,setBurst]=useState<{key:number;gain:number;praise:string}|null>(null);
 const teamNow=teams>1?index%teams:0;
 const combo=combos[teamNow]??0;// 콤보는 팀마다 따로 센다.
 const gtwist=twistOf(game);
 const lives=teams>1?0:(gtwist.lives??0);
 const [hearts,setHearts]=useState(lives),[mercyAt,setMercyAt]=useState(-1),[heartNote,setHeartNote]=useState('');
 const hasBoss=Boolean(gtwist.boss)&&rounds>=3;
 const isBoss=hasBoss&&index===rounds-1;
 const roundLevel:PlayLevel=isBoss?'hard':mercyAt===index?'easy':level;
 const starGoal=rounds*3+(hasBoss?3:0);
 useEffect(()=>{if(!heartNote)return;const id=window.setTimeout(()=>setHeartNote(''),3200);return()=>window.clearTimeout(id);},[heartNote]);
 /** 한 문제의 별: 첫 시도 ★3, 한 번 다시 ★2, 그 밖 ★1. 도전 난이도 첫 시도 +1, 3연속 첫 시도부터 콤보 +1. */
 function finishRound(first:boolean,errors:number){
  const base=first?3:errors<=1?2:1;
  const nextCombo=first?combo+1:0;
  const gain=(base+(first&&level==='hard'?1:0)+(first&&nextCombo>=3?1:0))*(isBoss?2:1);
  if(lives>0&&errors>0){const left=hearts-1;if(left<=0){setHearts(2);setMercyAt(index+1);setHeartNote(l(en,'하트가 다 떨어졌어요. 친구가 하트 2개를 채워 주고 다음 문제는 쉽게 해 줄게요!','Out of hearts! Your friend refills 2 hearts and makes the next round easier.'));}else{setHearts(left);setHeartNote(l(en,'하트가 하나 줄었어요.','You lost a heart.'));}}
  setCombos(c=>c.map((v,i)=>i===teamNow?nextCombo:v));setBestCombo(b=>Math.max(b,nextCombo));setStars(v=>v+gain);
  setTeamStars(t=>t.map((v,i)=>i===teamNow?v+gain:v));
  const words=PRAISE[en?1:0];
  setBurst({key:Date.now(),gain,praise:nextCombo>=3?l(en,`콤보 ${nextCombo}!`,`Combo ×${nextCombo}!`):words[(index+gain)%words.length]});
  setResults(old=>[...old,first]);setDone(true);
 }
 const panel=useRef<HTMLDivElement>(null);
 const pseudoFull=useRef(false);
 async function toggleFullscreen(){
   if(large){if(document.fullscreenElement===panel.current)await document.exitFullscreen();pseudoFull.current=false;setLarge(false);return;}
   try{if(!panel.current?.requestFullscreen)throw Error('unsupported');await panel.current.requestFullscreen();setLarge(true);}catch{pseudoFull.current=true;setLarge(true);}
 }
 useEffect(()=>{const changed=()=>{if(!pseudoFull.current)setLarge(document.fullscreenElement===panel.current);};document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);

 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){pseudoFull.current=false;setLarge(false);setPaused(true);}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);window.speechSynthesis?.cancel();};},[]);
 useEffect(()=>{if(!large)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[large]);
 useEffect(()=>{if(paused||leaving)player.cancelSpeech();},[player,paused,leaving]);
 const finish=index>=rounds;
 const heartBonus=lives>0?hearts:0;
 const totalStars=stars+(finish?heartBonus:0);
 const rating=totalStars>=starGoal*.85?3:totalStars>=starGoal*.55?2:1;
 useEffect(()=>{player.pause(paused||leaving);return()=>player.pause(false);},[player,paused,leaving]);
 useEffect(()=>{player.stop();player.cancelSpeech();player.play(finish?'finish':index===0?'start':'next');return()=>player.stop();},[player,index,finish]);
 const rewardAdded=useRef(false);
 useEffect(()=>{if(!finish){rewardAdded.current=false;return;}if(rewardAdded.current)return;rewardAdded.current=true;onReward({world:gameVisual(game).world,gameId:game.id,unitId:unit.id,label:gameName(game,en)});},[finish,game,unit.id,en,onReward]);
 const activity=useMemo(()=>{
  if(game.mechanic!=='adventure')return game;
  const ids=game.theme==='book'?['read-and-move','sentence-bridge','read-and-move']:unit.step===1?['sound-balloons','sound-baskets','memory-cards']:['sound-fishing',unit.step===2?'sound-train':unit.step===3?'magic-builder':unit.step===4?'consonant-repair':'vowel-chef','word-treasure'];
  const candidate=PHONICS_GAMES.find(g=>g.id===ids[index%ids.length])!;
  return gameAvailability(candidate,unit)?PHONICS_GAMES.find(g=>g.id==='sound-fishing')!:candidate;
 },[game,index,unit]);
 const milestones:Record<string,[string[],string[]]>={farm:[['씨앗 심기','물 주기','수확'],['Plant','Water','Harvest']],dino:[['발자국 찾기','알 발견','공룡 만나기'],['Tracks','Egg','Dinosaur']],space:[['연료 모으기','우주선 수리','친구 구조'],['Fuel','Repair','Rescue']],island:[['해변','숲','보물'],['Beach','Forest','Treasure']],book:[['첫 장','다음 장','책 완성'],['First page','Next page','Book complete']]};
 return <PlayWorld world={gameVisual(game).world}><div ref={panel} className={'pg-session '+(large?'pg-fullscreen':'')} data-phonics-session={game.id} data-paused={paused}>
  <div className="pg-toolbar"><strong>{gameName(game,en)} · Unit {unit.number}</strong><button type="button" className="pg-button" onClick={()=>setPaused(v=>!v)}>{l(en,paused?'계속하기':'잠시 멈춤',paused?'Resume':'Pause')}</button><button type="button" className="pg-button" onClick={()=>void toggleFullscreen()}>{l(en,large?'전체화면 종료':'전체화면',large?'Exit fullscreen':'Fullscreen')}</button><button type="button" className="pg-button" onClick={()=>setLeaving(true)}>{l(en,'게임 나가기','Leave game')}</button></div>
  {leaving&&<div className="pg-note" role="alert"><p>{l(en,'게임을 나가면 이번 진행이 초기화돼요.','Leaving resets this session.')}</p><button className="pg-button" onClick={onExit}>{l(en,'나가기','Leave')}</button><button className="pg-button" onClick={()=>setLeaving(false)}>{l(en,'계속할게요','Keep playing')}</button></div>}
  <PhonicsSoundControls en={en}/>
  <div className="pg-progress"><span>{Math.min(index+1,rounds)} / {rounds}</span><progress value={index} max={rounds} aria-label={l(en,'게임 진행','Game progress')}/>{lives>0&&<span className="pg-hearts" aria-label={l(en,`하트 ${hearts}개`,`${hearts} hearts`)}>{Array.from({length:lives},(_,i)=><b key={i} className={i<hearts?'on':''}>{icon('favorite')}</b>)}</span>}<span className="pg-hud-stars" key={'s'+stars} aria-label={l(en,`모은 별 ${stars}개`,`${stars} stars`)}>{icon('star')}{stars} / {starGoal}</span>{combo>=2&&<span className="pg-hud-combo" key={'c'+combo}>{icon('local_fire_department')}{combo}</span>}<span className="pg-first">{l(en,'첫 시도 정답','First try')}: {results.filter(Boolean).length}</span></div>
  {teams>1&&<div className="pg-teams" aria-label={l(en,'팀 점수','Team scores')}>{teamStars.map((v,i)=><span key={i} className={i===teamNow&&!finish?'pg-team-on':''} style={{'--team':TEAM_COLORS[i]} as React.CSSProperties}>{TEAM_NAMES[en?1:0][i]} {icon('star')}{v}</span>)}{!finish&&<strong>{l(en,`${TEAM_NAMES[0][teamNow]} 차례예요!`,`${TEAM_NAMES[1][teamNow]} team's turn!`)}</strong>}</div>}
  {game.theme&&<ol className={'pg-journey pg-theme-'+game.theme}>{milestones[game.theme][en?1:0].map((s,i)=><li key={s} aria-current={!finish&&Math.min(2,Math.floor(index*3/rounds))===i?'step':undefined} className={index>=Math.ceil((i+1)*rounds/3)?'pg-milestone-done':''}>{icon(index>=Math.ceil((i+1)*rounds/3)?'check_circle':game.icon)}{s}</li>)}</ol>}
  {paused&&<section className="pg-panel pg-pause" role="status"><h2>{l(en,'잠깐 쉬어가요','Take a break')}</h2><button className="pg-primary" onClick={()=>setPaused(false)}>{l(en,'이어서 하기','Resume')}</button></section>}
  {finish?<section hidden={paused} className="pg-panel pg-results" aria-live="polite"><ClaySprite kind={gameVisual(game).prop} className="pg-result-friend"/><h2>{l(en,'오늘도 잘했어요!','Great work today!')}</h2><p>{rounds}{l(en,'문제를 끝냈어요.',' rounds completed.')}</p><p>{l(en,'첫 시도에 혼자 맞힘','Correct on the first try')}: {results.filter(Boolean).length} · {l(en,'다시 도전·도움 후 완성','Completed after retry / help')}: {results.filter(x=>!x).length}</p><div className="pg-rating" aria-label={l(en,'별 등급','Star rating')}>{[1,2,3].map(n=><span key={n} className={n<=rating?'pg-rating-on':''} style={{animationDelay:`${n*0.25}s`}}>{icon('star')}</span>)}</div><p className="pg-result-stars">{l(en,`모은 별 ${totalStars}개 · 가장 길게 이어 맞힌 콤보 ${bestCombo}`,`${totalStars} stars · best streak ${bestCombo}`)}{heartBonus>0&&<> · {l(en,`하트 보너스 +${heartBonus}`,`Heart bonus +${heartBonus}`)}</>}</p>
   {teams>1&&<ol className="pg-team-ranking">{teamStars.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v).map(({v,i},r)=><li key={i} style={{'--team':TEAM_COLORS[i]} as React.CSSProperties}>{r===0&&icon('emoji_events')}{TEAM_NAMES[en?1:0][i]} · {v}</li>)}</ol>}
   <p>{l(en,'수업 활동 결과예요. 장기 숙련도 평가가 아니에요.','This is a practice summary, not a long-term mastery assessment.')}</p><ClassroomVillage rewards={rewards} en={en}/><button className="pg-primary" onClick={()=>{setIndex(0);setResults([]);setDone(false);setStars(0);setHearts(lives);setMercyAt(-1);setHeartNote('');setCombos(Array(teams).fill(0));setBestCombo(0);setBurst(null);setTeamStars(Array(teams).fill(0));}}>{l(en,'다시 하기','Play again')}</button><button className="pg-button" onClick={onExit}>{l(en,'게임 선택으로','Back to setup')}</button></section>:<div hidden={paused} inert={paused}>
   {game.mechanic==='adventure'&&<p className="pg-mission">{l(en,'이번 미션','Mission')}: {gameName(activity,en)}</p>}
   {isBoss&&<p className="pg-boss" role="status">{icon('swords')}{l(en,'보스 문제! 그림 없이 풀어요. 첫 시도로 맞히면 별이 2배예요.','Boss round! No pictures. Win on the first try for double stars.')}</p>}
   {heartNote&&<p className="pg-heart-note" role="status">{icon('favorite')}{heartNote}</p>}
   <RoundActivity key={`${index}:${activity.id}`} game={activity} visualGame={game} unit={unit} en={en} index={index} seed={seed} level={roundLevel} autoSpeak={autoSpeak} last={index+1===rounds} paused={paused} onNext={()=>{window.speechSynthesis?.cancel();setDone(false);setBurst(null);setIndex(n=>n+1);}} onComplete={finishRound}/>
   {done&&burst&&<div className="pg-burst" key={burst.key} aria-hidden="true"><b className="pg-burst-praise">{burst.praise}</b><span className="pg-burst-gain">+{burst.gain}{icon('star')}</span>{Array.from({length:12},(_,i)=><span key={i} className="pg-burst-star" style={{'--a':`${i*30}deg`} as React.CSSProperties}>{icon('star')}</span>)}</div>}
  </div>}
 </div></PlayWorld>;
}

interface ActivityProps {game:PhonicsGame;visualGame?:PhonicsGame;unit:CourseUnit;en:boolean;index:number;seed:number;level?:PlayLevel;autoSpeak?:boolean;last?:boolean;paused?:boolean;onNext:()=>void;onComplete:(first:boolean,errors:number)=>void}
function RoundActivity({game,visualGame,unit,en,index,seed,level='normal',autoSpeak=false,last=false,paused=false,onNext,onComplete}:ActivityProps){
 const {player}=usePhonicsSound();
 const round=useMemo(()=>makeRound(game,unit,index,seed),[game,unit,index,seed]);
 const [errors,setErrors]=useState(0),[help,setHelp]=useState(false),[solved,setSolved]=useState(false),[wrong,setWrong]=useState(false);
 const [selected,setSelected]=useState<number[]>([]),[opened,setOpened]=useState<number[]>([]),[matched,setMatched]=useState<number[]>([]);
 const [preview,setPreview]=useState(true),[tiles,setTiles]=useState<number[]>([]),[covered,setCovered]=useState<number[]>([]);
 const [connected,setConnected]=useState<number[]>([]),[tracePoints,setTracePoints]=useState<string[]>([]);
 const [drawn,setDrawn]=useState(false);const drawing=useRef(false);
 const [toast,setToast]=useState(false),[ready,setReady]=useState(false);
 const [hintLevel,setHintLevel]=useState(0),[hintShow,setHintShow]=useState(false);
 useEffect(()=>{if(!hintShow)return;const id=window.setTimeout(()=>setHintShow(false),9000);return()=>window.clearTimeout(id);},[hintShow,hintLevel]);
 useEffect(()=>{if(!wrong)return;setToast(true);const id=window.setTimeout(()=>setToast(false),2600);return()=>window.clearTimeout(id);},[wrong,errors]);
 const nextRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(ready)nextRef.current?.focus({preventScroll:true});},[ready]);// 켜지면 바로 엔터·스페이스로 넘길 수 있게
 useEffect(()=>{if(!solved){setReady(false);return;}const id=window.setTimeout(()=>setReady(true),650);return()=>window.clearTimeout(id);},[solved]);
 const good=(isCorrect:boolean)=>{if(solved)return;if(!isCorrect){player.play('retry');setWrong(true);setErrors(n=>n+1);return;}player.answer();setWrong(false);setSolved(true);onComplete(errors===0&&!help,errors);};
 const uniquePool=useMemo(()=>[...new Map(gamePool(game,unit).map(e=>[e.word,e])).values()],[game,unit]);
 const twist=twistOf(game);
 const batchN=game.mechanic==='sort'||game.mechanic==='fill'?(twist.batch??1):1;
 const [step,setStep]=useState(0);
 const cards=useMemo(()=>batchN>1?[round.entry,...shuffled(uniquePool.filter(e=>e.id!==round.entry.id&&e.word!==round.entry.word),seed+index+5)].slice(0,batchN):[round.entry],[batchN,round.entry,uniquePool,seed,index]);
 const cur=cards[Math.min(step,cards.length-1)];
 const speakTarget=round.sentence??cur.word;
 const form:PlayForm|undefined=formFor(twist,index,level,pictureEligible(round.entry));
 const secs=clockSeconds(twist,level);
 const [left,setLeft]=useState(secs),[timedOut,setTimedOut]=useState(false);
 useEffect(()=>{if(!secs||solved||paused||timedOut)return;const id=window.setInterval(()=>setLeft(v=>v-1),1000);return()=>window.clearInterval(id);},[secs,solved,paused,timedOut]);
 useEffect(()=>{if(secs&&left<=0&&!solved&&!timedOut){setTimedOut(true);setHelp(true);setHintLevel(2);setErrors(n=>n+1);player.play('retry');setWrong(true);}},[secs,left,solved,timedOut,player]);
 const cardPool=useMemo(()=>{const pictures=uniquePool.filter(pictureEligible);return pictures.length>=2?pictures:uniquePool;},[uniquePool]);
 const memoryEntries=useMemo(()=>shuffled(cardPool,seed+index).slice(0,3),[cardPool,seed,index]);
 const pairCards=useMemo(()=>{
  if(game.mechanic==='pairs'){const letters=[...new Set(unit.groups.map(g=>g.label[0]))].slice(0,3);return shuffled(letters.flatMap((letter,p)=>[{id:p,kind:0,text:letter},{id:p,kind:1,text:letter.toLowerCase()}]),seed+index);}
  return shuffled(memoryEntries.flatMap((entry,p)=>[{id:p,kind:0,text:entry.word},{id:p,kind:1,text:entry.word}]),seed+index);
 },[game.mechanic,unit,memoryEntries,seed,index]);
 const groupEntries=[...new Map(gamePool(game,unit).map(e=>[patternKey(unit,e),e])).values()];
 /** 분류 게임에서 서로 다른 소리 규칙의 대표 낱말(소리 비교 줄). 같은 규칙의 워드패밀리(-at/-an)는 소리가 같아 한 번만. */
 const soundGroups=useMemo(()=>game.mechanic==='sort'?[...new Map(groupEntries.filter(e=>e.ruleId&&hasPhoneme(e.ruleId)).map(e=>[e.ruleId,e])).values()]:[],[game,groupEntries]);
 const buildTokens=round.tokens;
 const tokenChoices=useMemo(()=>shuffled(buildTokens.map((text,id)=>({text,id})),seed+index+24),[buildTokens,seed,index]);
 const huntTarget=alphabetGlyph(round.entry).toLowerCase();
 const huntLetters=useMemo(()=>shuffled([...unit.groups.map(g=>g.label[0]),...unit.groups.map(g=>g.label[0].toLowerCase()),...unit.groups.map(g=>g.label[0])],seed+index),[unit,seed,index]);
 const bingoEntries=useMemo(()=>shuffled(uniquePool,seed+index).slice(0,uniquePool.length>=9?9:4),[uniquePool,seed,index]);
 const bingoOrder=useMemo(()=>shuffled(bingoEntries.map((_,i)=>i),seed+index+77),[bingoEntries,seed,index]);
 const bingoTarget=bingoOrder.find(i=>!covered.includes(i));
 const blank=useMemo(()=>blankOf(game,cur),[game,cur]);
 const fillChoices=useMemo(()=>{
  const correct=blank.answer;
  const all=game.id==='vowel-repair'?['a','e','i','o','u']:game.id==='rescue-e'?['e','a','i']:gamePool(game,unit).map(targetText);
  const decoys=twist.decoys?[...new Set([...correct])].filter(c=>c!==correct):[];
  return shuffled([...new Set([correct,...decoys,...all.filter(s=>s&&s!==correct)])].slice(0,5),seed+index+8+step);
 },[blank.answer,game,unit,seed,index,twist.decoys,step]);
 const oddOptions=useMemo(()=>{
  const a=uniquePool.find(e=>uniquePool.filter(x=>patternKey(unit,x)===patternKey(unit,e)).length>=2)!;
  if(!a)return [];
  const same=uniquePool.filter(e=>patternKey(unit,e)===patternKey(unit,a)).slice(0,2),other=uniquePool.find(e=>patternKey(unit,e)!==patternKey(unit,a))!;
  return shuffled([...same,other],seed+index);
 },[unit,uniquePool,seed,index]);
 const pairClick=(i:number)=>{if(solved||matched.includes(i)||opened.includes(i))return;if(opened.length===2){setOpened([i]);return;}const next=[...opened,i];setOpened(next);if(next.length===2){if(pairCards[next[0]].id===pairCards[i].id&&pairCards[next[0]].kind!==pairCards[i].kind){const ids=[...matched,...next];setMatched(ids);setOpened([]);if(ids.length===pairCards.length)good(true);}else{player.play('retry');setErrors(n=>n+1);setWrong(true);}}};
 const partialWork=tiles.length+matched.length+selected.length+covered.length+connected.length;
 const previousWork=useRef(0);
 useEffect(()=>{if(partialWork>previousWork.current&&!solved)player.play('place');previousWork.current=partialWork;},[partialWork,solved,player]);
 const hintWord=game.mechanic==='missing'?shuffled(uniquePool,seed+index).slice(0,4)[index%Math.min(4,uniquePool.length)].word:speakTarget;
 const hintText=game.mechanic==='odd'?oddOptions.map(e=>`${e.word}: ${patternLabel(unit,e)}`).join(' / '):game.mechanic==='pairs'?l(en,'같은 글자의 대문자와 소문자를 연결하세요.','Match the two cases of the same letter.'):game.mechanic==='bingo'&&bingoTarget!==undefined?bingoEntries[bingoTarget].word:hintWord;
 /** 1단계: 친구가 귓속말(말풍선에 힌트 + 단어 읽어 주기). 2단계: 정답이 반짝인다. 힌트를 쓴 문제는 도움 후 완성(별 최대 ★2)으로 기록한다. */
 const pressHint=()=>{if(solved)return;setHelp(true);setHintLevel(v=>Math.min(2,v+1));setHintShow(true);if(!['odd','pairs'].includes(game.mechanic))speakText(hintText,'en-US');};
 const glow=(ok:boolean):object=>hintLevel>=2&&!solved&&ok?{'data-hint':'true'}:{};
 const markedWord=game.mechanic==='bridge'||game.mechanic==='lab';
 const showsWord=!['pairs','memory','trace','hunt','bingo','sort','odd'].includes(game.mechanic);
 const dock=<div className="pg-dock" aria-live="polite">
  {solved&&<div className="pg-dock-card" data-state="solved" role="status">
   <div className="pg-dock-text"><strong>{l(en,'완성했어요! 함께 읽어요.','You did it! Read it together.')}</strong>{showsWord&&(markedWord?<MarkedWord entry={round.entry}/>:<span className="pg-dock-word" lang="en">{round.sentence??round.entry.word}</span>)}</div>
   {markedWord&&<Audio text={round.entry.word} en={en}/>}
   <button type="button" className="pg-primary pg-next" disabled={!ready} ref={nextRef} onClick={onNext}>{l(en,last?'결과 보기':'다음 문제',last?'See results':'Next round')}{icon('arrow_forward')}</button>
  </div>}
  {!solved&&toast&&<div className="pg-dock-card pg-dock-wrong" data-state="wrong" role="status"><strong>{timedOut?l(en,'시간이 다 됐어요! 정답이 반짝여요.','Time is up! The answer is glowing.'):l(en,'다시 살펴볼까요?','Take another look. You can retry.')}</strong></div>}
 </div>;
 const cue=(showWord=false,e=round.entry)=><div className="pg-cue">{level==='hard'||twist.blind?<p className="pg-note pg-listen-only">{icon('hearing')}{l(en,'그림 없이 소리를 듣고 풀어요.','No picture — listen and solve.')}</p>:pictureEligible(e)?<WordPicture entry={e} en={en}/>:<p className="pg-note">{l(en,'선생님이 단어를 읽고 뜻을 설명해 주세요.','Ask your teacher to read and explain this word.')}</p>}{(showWord||level==='easy')&&<MarkedWord entry={e}/>}<Audio text={e.word} en={en}/>{e.ruleId&&<PhonemeButton ruleId={e.ruleId} label={targetText(e)} en={en}/>}</div>;
 const contentRef=useRef<HTMLDivElement>(null);
 /** 글을 못 읽는 친구를 위해 이번 문제의 설명을 소리로 읽어 준다(첫 설명 문단, 없으면 게임 종류별 기본 문장). */
 const speakText=(text:string,lang:string)=>{
  if(!('speechSynthesis' in window))return;
  player.stop();const end=player.speechStart(text);window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang=lang;utterance.rate=lang.startsWith('en')?.85:.9;
  const voice=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith(lang.slice(0,2)));if(voice)utterance.voice=voice;
  utterance.onend=end;utterance.onerror=()=>end();
  try{window.speechSynthesis.speak(utterance);}catch{end();}
 };
 const speakRule=()=>{
  const found=contentRef.current?.querySelector('p:not(.pg-note):not(.pg-display)')?.textContent?.trim();
  speakText(found||RULE_FALLBACK[game.mechanic]?.[en?1:0]||l(en,'문제를 풀어 봐요.','Give it a try.'),en?'en-US':'ko-KR');
 };
 useEffect(()=>{if(!autoSpeak)return;const id=window.setTimeout(speakRule,450);return()=>window.clearTimeout(id);},[]);// eslint-disable-line react-hooks/exhaustive-deps -- 문제가 바뀔 때마다 새로 만들어지므로 한 번만 읽는다.
 let content;
 if(game.mechanic==='pairs'||game.mechanic==='memory')content=<><p>{l(en,game.mechanic==='pairs'?'대문자와 소문자를 연결하세요.':'카드 두 장을 열어 그림과 단어를 연결하세요.',game.mechanic==='pairs'?'Match uppercase and lowercase letters.':'Turn two cards to pair a picture and a word.')}</p><div className="pg-memory-grid">{pairCards.map((c,i)=>{const revealed=game.mechanic==='pairs'||opened.includes(i)||matched.includes(i)||hintLevel>=2;return <button type="button" className={'pg-memory-card '+(matched.includes(i)?'pg-matched':'')} key={i} disabled={solved||matched.includes(i)} aria-label={revealed?c.text:l(en,`${i+1}번 카드`, `Card ${i+1}`)} aria-pressed={opened.includes(i)} onClick={()=>pairClick(i)}>{revealed?game.mechanic==='memory'&&c.kind===0?<WordPicture entry={memoryEntries[c.id]} en={en}/>:<span lang="en">{c.text}</span>:'?'}</button>;})}</div></>;
 else if(game.mechanic==='sort'){
  const sortGo=(key:string)=>{if(solved)return;if(key!==patternKey(unit,cur)){good(false);return;}if(step+1<cards.length){player.answer();setWrong(false);setStep(step+1);return;}good(true);};
  content=<><DragBox className="pg-drag-card" key={step} disabled={solved} onDropOn={sortGo}>{twist.listenOnly?<div className="pg-cue"><p className="pg-note pg-listen-only">{icon('hearing')}{l(en,'글자 없이 소리만 듣고 골라요.','No letters — listen and choose.')}</p><Audio text={cur.word} en={en}/></div>:cue(true,cur)}</DragBox><p>{l(en,twist.listenOnly?'소리를 듣고 카드를 알맞은 길에 놓아요.':'단어 카드를 끌어서 알맞은 곳에 놓아요.',twist.listenOnly?'Listen, then drag the card to its road.':'Drag the word card to its group.')}</p><p className="pg-note pg-drag-tip">{l(en,'눌러서 고를 수도 있어요.','You can also tap a group.')}</p>{soundGroups.length>=2&&<div className="pg-compare" role="group" aria-label={l(en,'소리 비교','Compare the sounds')}>{soundGroups.map(e=><PhonemeButton key={e.ruleId} ruleId={e.ruleId!} label={patternLabel(unit,e)} en={en}/>)}</div>}<div className="pg-options pg-baskets">{groupEntries.map(e=><button type="button" key={e.id} data-drop={patternKey(unit,e)} {...glow(patternKey(unit,e)===patternKey(unit,cur))} disabled={solved} onClick={()=>sortGo(patternKey(unit,e))}>{icon(game.icon)}<span lang="en">{patternLabel(unit,e)}</span></button>)}</div></>;
 }
 else if(game.mechanic==='hunt')content=<><p>{l(en,'같은 대소문자를 모두 찾아요.','Find every matching uppercase and lowercase letter.')}</p><strong className="pg-display" lang="en">{huntTarget.toUpperCase()} {huntTarget}</strong>{round.entry.ruleId&&<PhonemeButton ruleId={round.entry.ruleId} label={huntTarget} en={en}/>}<div className="pg-letter-field">{huntLetters.map((letter,i)=><button type="button" key={i} {...glow(letter.toLowerCase()===huntTarget&&!selected.includes(i))} disabled={solved||selected.includes(i)} className={selected.includes(i)?'pg-picked':''} onClick={()=>{if(letter.toLowerCase()!==huntTarget){good(false);return;}const next=[...selected,i];setSelected(next);if(next.length===huntLetters.filter(x=>x.toLowerCase()===huntTarget).length)good(true);}}>{letter}</button>)}</div></>;
 else if(game.mechanic==='trace')content=<><p>{l(en,'글자를 따라 쓰세요. 쓰기 평가는 선생님이 확인해요.','Trace the letter. Your teacher checks the writing.')}</p>{round.entry.ruleId&&<PhonemeButton ruleId={round.entry.ruleId} label={huntTarget} en={en}/>}<svg className="pg-trace" viewBox="0 0 600 300" aria-label={l(en,'글자 따라 쓰기 판','Letter tracing board')} onPointerDown={e=>{if(solved)return;player.play('pick');drawing.current=true;e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.getBoundingClientRect();setTracePoints(a=>[...a,`M ${(e.clientX-r.left)*600/r.width} ${(e.clientY-r.top)*300/r.height}`]);}} onPointerMove={e=>{if(!drawing.current||solved)return;const r=e.currentTarget.getBoundingClientRect();setDrawn(true);setTracePoints(a=>[...a,`L ${(e.clientX-r.left)*600/r.width} ${(e.clientY-r.top)*300/r.height}`]);}} onPointerUp={()=>{drawing.current=false;}} onPointerCancel={()=>{drawing.current=false;}}><text x="300" y="225" textAnchor="middle">{huntTarget.toUpperCase()} {huntTarget}</text><path d={tracePoints.join(' ')} fill="none" stroke="#136bce" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/></svg><div className="pg-actions"><button className="pg-button" disabled={solved} onClick={()=>{setTracePoints([]);setDrawn(false);}}>{l(en,'지우기','Clear')}</button><button className="pg-primary" disabled={solved||!drawn} onClick={()=>{player.answer();setHelp(true);setSolved(true);onComplete(false,0);}}>{l(en,'선생님 확인 · 완료','Teacher checked · Done')}</button></div></>;
 else if(game.mechanic==='build'||game.mechanic==='sentence')content=<>{game.mechanic==='sentence'?<><p>{l(en,'읽은 문장을 기억하고 단어를 순서대로 놓아요.','Remember the sentence and arrange its words.')}</p>{preview?<><p className="pg-display pg-sentence" lang="en">{round.sentence}</p><button className="pg-button" onClick={()=>setPreview(false)}>{l(en,'문장 가리고 시작','Hide sentence and begin')}</button></>:<WordPicture entry={round.entry} en={en}/>}</>:cue()}{(game.mechanic!=='sentence'||!preview)&&<><div className={'pg-build-track '+(game.id==='sound-steps'?'pg-steps':'')} aria-label={l(en,'조립한 단어','Built word')} lang="en">{buildTokens.map((_,i)=><span key={i} className={tiles[i]!==undefined?'pg-filled':''}>{tiles[i]!==undefined?tokenChoices.find(x=>x.id===tiles[i])?.text:'·'}</span>)}</div><div className="pg-options pg-token-bank">{tokenChoices.map(c=><button type="button" key={c.id} {...glow(tokenChoices.find(x=>!tiles.includes(x.id)&&x.text===buildTokens[tiles.length])?.id===c.id)} disabled={solved||tiles.includes(c.id)} onClick={()=>{const built=[...tiles,c.id];if(c.text!==buildTokens[tiles.length]){good(false);return;}setTiles(built);if(built.length===buildTokens.length)good(true);}}>{c.text}</button>)}</div><button type="button" className="pg-button" disabled={solved||!tiles.length} onClick={()=>setTiles(a=>a.slice(0,-1))}>{l(en,'한 칸 되돌리기','Undo one tile')}</button>{game.id==='blend-launch'&&<p>{l(en,'자음군의 두 소리를 각각 말한 뒤 연결하세요.','Say both consonant sounds, then blend.')}</p>}</>}</>;
 else if(game.mechanic==='fill'||game.mechanic==='change'){
  const onset=round.source?round.entry.word.slice(0,round.entry.word.length-(unit.groups.find(g=>g.entries.some(e=>e.id===round.entry.id))!.label.length-1)):'';
  const opts=game.mechanic==='change'?[...new Set(gamePool(game,unit).map(e=>e.word[0]))]:fillChoices;
  const blankAnswer=game.mechanic==='change'?onset:blank.answer;
  const fillGo=(ok:boolean)=>{if(solved)return;if(!ok){good(false);return;}if(step+1<cards.length){player.answer();setWrong(false);setStep(step+1);return;}good(true);};
  content=<>{cue(false,cur)}<p className="pg-display" lang="en" key={step}>{game.mechanic==='change'?<>{round.source?.word} → <BlankWord text={'_'+round.entry.word.slice(1)} filled={solved} answer={blankAnswer} label={l(en,'빈칸','blank')}/></>:<BlankWord text={blank.masked} filled={solved||false} answer={blankAnswer} label={l(en,'빈칸','blank')}/>}</p><p className="pg-note pg-drag-tip">{l(en,'글자 조각을 끌어서 빈칸에 놓아요. 눌러서 고를 수도 있어요.','Drag a letter piece into the blank, or tap one.')}</p><div className="pg-options pg-token-bank">{shuffled(opts,seed+index).map(c=><DragButton type="button" key={c} {...glow(c===blankAnswer)} disabled={solved} onDropOn={zone=>{if(zone==='blank')fillGo(c===blankAnswer);}} onClick={()=>fillGo(c===blankAnswer)}>{c}</DragButton>)}</div></>;
 }
 else if(game.mechanic==='bridge'||game.mechanic==='lab')content=<><p>{l(en,game.mechanic==='bridge'?'모음과 끝 e를 차례로 선택해 다리를 연결하세요.':'끝 e를 누르고 모음과 함께 확인하세요.',game.mechanic==='bridge'?'Connect the vowel and final e, in order.':'Tap final e and notice its vowel partner.')}</p>{round.entry.ruleId&&<PhonemeButton ruleId={round.entry.ruleId} label={targetText(round.entry)} en={en}/>}<div className="pg-magic-word" lang="en">{[...round.entry.word].map((c,i)=><button type="button" className={connected.includes(i)?'pg-connected':''} key={i} {...glow(i===(game.mechanic==='lab'?[round.entry.word.length-1]:round.entry.targets??[])[connected.length])} disabled={solved} onClick={()=>{const targets=game.mechanic==='lab'?[round.entry.word.length-1]:round.entry.targets??[];if(i!==targets[connected.length]){good(false);return;}const next=[...connected,i];setConnected(next);if(next.length===targets.length)good(true);}}>{c}</button>)}</div></>;
 else if(game.mechanic==='position')content=<><MarkedWord entry={round.entry}/>{round.entry.ruleId&&<PhonemeButton ruleId={round.entry.ruleId} label={targetText(round.entry)} en={en}/>}<p>{l(en,'강조된 철자의 위치는 어디인가요?','Where is the highlighted spelling?')}</p><div className="pg-options">{['start','end','middle'].map((pos,i)=><button type="button" key={pos} {...glow(pos===((round.entry.targets??[])[0]===0?'start':(round.entry.targets??[]).at(-1)===round.entry.word.length-1?'end':'middle'))} disabled={solved} onClick={()=>{const t=round.entry.targets??[];good(pos===(t[0]===0?'start':t[t.length-1]===round.entry.word.length-1?'end':'middle'));}}>{[l(en,'앞','Start'),l(en,'뒤','End'),l(en,'가운데','Middle')][i]}</button>)}</div></>;
 else if(game.mechanic==='odd')content=<><p>{l(en,'목표 철자 규칙이 다른 단어 하나를 찾아요.','Find the word with a different target spelling pattern.')}</p><div className="pg-options">{oddOptions.map(e=><button type="button" key={e.id} {...glow(oddOptions.filter(x=>patternKey(unit,x)===patternKey(unit,e)).length===1)} disabled={solved} onClick={()=>good(oddOptions.filter(x=>patternKey(unit,x)===patternKey(unit,e)).length===1)}><MarkedWord entry={e}/><small>{patternLabel(unit,e)}</small></button>)}</div></>;
 else if(game.mechanic==='missing'){
  const list=shuffled(uniquePool,seed+index).slice(0,4);const missing=index%list.length;
  content=<><p>{l(en,preview?'단어를 기억하세요. 준비되면 가려 보세요.':'사라진 단어는 무엇인가요?',preview?'Remember the words, then hide one.':'Which word disappeared?')}</p><div className="pg-remember-strip">{list.map((e,i)=><span lang="en" key={e.id}>{preview||i!==missing?e.word:'?'}</span>)}</div>{preview?<button type="button" className="pg-primary" onClick={()=>setPreview(false)}>{l(en,'카드 가리기','Hide a card')}</button>:<div className="pg-options">{shuffled(list,seed+index+7).map(e=><button key={e.id} {...glow(e.id===list[missing].id)} disabled={solved} onClick={()=>good(e.id===list[missing].id)}>{e.word}</button>)}</div>}</>;
 }
 else if(game.mechanic==='bingo'){
  const side=bingoEntries.length===9?3:2;
  content=<><p>{l(en,'단어를 듣고 칸을 골라 한 줄을 완성하세요.','Hear a word and complete a row, column or diagonal.')}</p>{bingoTarget!==undefined&&<Audio text={bingoEntries[bingoTarget].word} en={en}/>}<div className="pg-bingo" style={{gridTemplateColumns:`repeat(${side},1fr)`}}>{bingoEntries.map((e,i)=><button key={e.id} {...glow(i===bingoTarget)} disabled={solved||covered.includes(i)} className={covered.includes(i)?'pg-picked':''} onClick={()=>{if(i!==bingoTarget){good(false);return;}const next=[...covered,i];setCovered(next);const lines=[...Array.from({length:side},(_,r)=>Array.from({length:side},(_,c)=>r*side+c)),...Array.from({length:side},(_,c)=>Array.from({length:side},(_,r)=>r*side+c)),Array.from({length:side},(_,j)=>j*side+j),Array.from({length:side},(_,j)=>j*side+side-1-j)];if(lines.some(line=>line.every(n=>next.includes(n)))||next.length===bingoEntries.length)good(true);}}>{e.word}{covered.includes(i)&&icon('check_circle')}</button>)}</div></>;
 }
 else {
  const balloons=game.id==='sound-balloons';const read=game.mechanic==='read';
  const formText:Record<PlayForm,[string,string]>={'hear-picture':['단어를 듣고 알맞은 그림을 찾아요.','Listen and find the picture.'],'picture-word':['그림을 보고 알맞은 단어를 찾아요.','Look at the picture and find the word.'],'word-picture':['단어를 읽고 알맞은 그림을 찾아요.','Read the word and find the picture.'],'hear-word':['단어를 듣고 알맞은 단어를 찾아요.','Listen and find the word.']};
  content=<>{form?<><p>{l(en,formText[form][0],formText[form][1])}</p>{form.startsWith('picture')&&<WordPicture entry={round.entry} en={en}/>}{form.startsWith('word')&&<p className="pg-display pg-sentence" lang="en">{round.entry.word}</p>}{form.startsWith('hear')&&<Audio text={round.entry.word} en={en}/>}{game.id==='r-journey'&&round.entry.ruleId&&<PhonemeButton ruleId={round.entry.ruleId} label={targetText(round.entry)} en={en}/>}</>:balloons?<><p>{l(en,'선생님이 대표 단어를 들려준 뒤 목표 글자를 고르세요.','Listen to the sample word and choose its target letter.')}</p><Audio text={round.entry.word} en={en}/>{round.entry.ruleId&&<PhonemeButton ruleId={round.entry.ruleId} label={alphabetGlyph(round.entry)} en={en}/>}<p className="pg-note">{hasPhoneme(round.entry.ruleId)?l(en,'소리 듣기 버튼으로 목표 글자의 소리를 들어요. X는 단어 끝의 소리예요.','Use the sound button to hear the target letter. X occurs at the end of these words.'):l(en,'개별 소리는 선생님이 들려주세요. X는 단어 끝의 소리예요.','Ask your teacher to model the individual sound. X occurs at the end of these words.')}</p></>:game.mechanic==='puzzle'?<><p>{l(en,'그림 조각을 눌러 열고 단어를 찾아요.','Uncover picture pieces, then choose the word.')}</p><div className="pg-puzzle"><WordPicture entry={round.entry} en={en}/><div className="pg-puzzle-covers">{[0,1,2,3].map(i=><button type="button" disabled={solved} style={{visibility:opened.includes(i)?'hidden':'visible'}} key={i} aria-label={l(en,`${i+1}번 조각 열기`,`Uncover piece ${i+1}`)} onClick={()=>setOpened(a=>[...a,i])}>{i+1}</button>)}</div></div></>:read?<><p className="pg-display pg-sentence" lang="en">{round.sentence??round.entry.word}</p>{!preview||game.id!=='word-treasure'?null:<button className="pg-primary" onClick={()=>setPreview(false)}>{l(en,'읽었어요 · 상자 열기','I read it · Open chests')}</button>}</>:<><p>{l(en,'단어를 듣고 알맞은 그림을 친구에게 끌어다 줘요.','Listen, then drag the matching picture to your friend.')}</p><p className="pg-note pg-drag-tip">{l(en,'눌러서 고를 수도 있어요.','You can also tap a picture.')}</p><Audio text={round.entry.word} en={en}/>{game.id==='r-journey'&&round.entry.ruleId&&<PhonemeButton ruleId={round.entry.ruleId} label={targetText(round.entry)} en={en}/>}</>}
   {balloons?<div className="pg-options pg-balloons">{shuffled([...new Map(gamePool(game,unit).map(e=>[targetText(e).toLowerCase(),e])).values()],seed+index).map(e=><button type="button" key={e.id} {...glow(targetText(e).toLowerCase()===targetText(round.entry).toLowerCase())} disabled={solved} onClick={()=>good(targetText(e).toLowerCase()===targetText(round.entry).toLowerCase())}>{alphabetGlyph(e).toUpperCase()} {alphabetGlyph(e).toLowerCase()}</button>)}</div>:read&&preview&&game.id==='word-treasure'&&!form?null:<div className={'pg-options '+(game.id==='sound-fishing'?'pg-fish':'')}>{round.options.map(e=><DragButton type="button" key={e.id} {...glow(e.id===round.entry.id)} disabled={solved} onDropOn={zone=>{if(zone==='stage')good(e.id===round.entry.id);}} onClick={()=>good(e.id===round.entry.id)}>{(form?form.endsWith('picture'):read||game.mechanic==='choice')?pictureEligible(e)?<WordPicture entry={e} en={en}/>:<span lang="en">{e.word}</span>:<span lang="en">{e.word}</span>}</DragButton>)}</div>}
  </>;
 }
 return <section className={'pg-playground pg-mode-'+game.id} data-activity={game.id} data-solved={solved} data-retry={wrong} data-carriages={game.id==='sound-train'&&gameVisual(visualGame??game).world==='train'} onClickCapture={e=>{const target=e.target as Element;const button=target.closest('button,summary');if(button&&!button.hasAttribute('disabled')&&!button.hasAttribute('data-learning-audio'))player.play('pick');}}>
  <div className="pg-round-head"><h2>{gameName(game,en)}</h2><button type="button" className="pg-button pg-hear-rule" data-learning-audio onClick={speakRule}>{icon('record_voice_over')}{l(en,'설명 듣기','Hear the instructions')}</button><button type="button" className="pg-button pg-hint-button" data-learning-audio disabled={solved} title={l(en,'힌트를 쓴 문제는 별이 줄어요','A hint lowers the stars')} aria-label={l(en,'힌트 보기','Show a hint')} onClick={pressHint}>{icon('lightbulb')}{l(en,'힌트','Hint')}<span className="pg-hint-dots" aria-hidden="true">{[0,1].map(i=><i key={i} className={hintLevel>i?'on':''}/>)}</span></button></div>
  {(secs>0||batchN>1||twist.listenOnly||twist.blind||form)&&<div className="pg-twist" role="note">
   {secs>0&&<span className="pg-clock" role="timer" aria-label={l(en,`남은 시간 ${Math.max(0,left)}초`,`${Math.max(0,left)} seconds left`)} data-low={left<=3&&!solved}><i style={{transform:`scaleX(${solved?0:Math.max(0,left)/secs})`}}/>{icon('timer')}{Math.max(0,left)}</span>}
   {batchN>1&&<span>{icon('factory')}{l(en,`카드 ${Math.min(step+1,batchN)} / ${batchN}`,`Card ${Math.min(step+1,batchN)} / ${batchN}`)}</span>}
   {twist.blind&&level!=='hard'&&<span>{icon('hearing')}{l(en,'듣고 채워요','Listen, then fill')}</span>}{twist.listenOnly&&<span>{icon('hearing')}{l(en,'소리만 듣고 골라요','Listen only')}</span>}
   {form&&<span>{icon('autorenew')}{l(en,'이번엔 이렇게 해요','New way this time')}</span>}
  </div>}
  <div className="pg-stage-drop" data-drop="stage"><LearningStage game={visualGame??game} en={en} solved={solved} wrong={wrong} word={solved?speakTarget:''} pieces={tiles.map(id=>tokenChoices.find(t=>t.id===id)?.text??'')} slots={buildTokens.length} hint={hintShow&&!solved?hintText:null} progress={Math.max(tiles.length/Math.max(1,buildTokens.length),matched.length/Math.max(1,pairCards.length),selected.length/Math.max(1,huntLetters.filter(x=>x.toLowerCase()===huntTarget).length),covered.length/Math.max(1,bingoEntries.length),connected.length/Math.max(1,round.entry.targets?.length??0),game.mechanic==='puzzle'?opened.length/4:0,batchN>1?step/batchN:0,drawn ? .5 : 0)}/></div>
  <div className="pg-learning-content" ref={contentRef}>{content}</div>

  {dock}
 </section>;
}
