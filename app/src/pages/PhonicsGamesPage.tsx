import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PHONICS_STAGES } from '../data/phonicsCurriculum';
import { type CourseUnit } from '../data/phonicsLessons';
import { fetchPhonicsBank } from '../lib/api';
import { courseUnits } from '../data/phonicsLessons';
import { PHONICS_GAMES, alphabetGlyph, gameAvailability, gameName, gamePool, makeRound, patternKey, patternLabel, phonicsGameUnits, pictureEligible, shuffled, targetText, type PhonicsGame } from '../lib/phonicsGames';
import type { PhonicsBankEntry } from '../lib/types';
import {ClaySprite,ClassroomVillage,LearningStage,PhonicsGameCover,PlayWorld} from '../components/PhonicsGameArt';
import {PHONICS_WORLDS,addVillageReward,gameVisual,readVillageRewards,type PhonicsWorld,type VillageReward} from '../lib/phonicsGameVisuals';
import '../styles/phonics-games.css';
import '../styles/phonics-games-v2.css';

const l=(en:boolean,ko:string,english:string)=>en?english:ko;
const icon=(name:string)=><span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
function MarkedWord({entry}:{entry:PhonicsBankEntry}){return <span className="pg-word" lang="en">{[...entry.word].map((c,i)=><span key={i} className={entry.targets?.includes(i)?'pg-mark':''}>{c}</span>)}</span>;}
function WordPicture({entry,en}:{entry:PhonicsBankEntry;en:boolean}){
 const [broken,setBroken]=useState(false);
 return entry.image_url&&!broken?<img className="pg-picture" src={entry.image_url} alt="" onError={()=>setBroken(true)}/>:<span className="pg-picture-fallback">{l(en,'그림 대신 단어로 읽어요','Read the word instead')}<strong lang="en">{entry.word}</strong></span>;
}
function Audio({text,en,onHelp}:{text:string;en:boolean;onHelp?:()=>void}){
 const [failed,setFailed]=useState(false);
 return <><button className="pg-button" type="button" onClick={()=>{onHelp?.();if(!('speechSynthesis' in window)){setFailed(true);return;}setFailed(false);window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.rate=.85;const voice=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(voice)utterance.voice=voice;utterance.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))setFailed(true);};try{window.speechSynthesis.speak(utterance);}catch{setFailed(true);}}}>{icon('volume_up')}{l(en,'단어·문장 듣기','Hear word / sentence')}</button>{failed&&<p role="status">{l(en,'이 기기에서 음성을 재생할 수 없어요. 선생님이 읽어 주세요.','Speech is unavailable. Ask your teacher to read it.')}</p>}</>;
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
 const [guide,setGuide]=useState(false);
 const [world,setWorld]=useState<PhonicsWorld|'all'>('all');
 const [rewards,setRewards]=useState(readVillageRewards);
 const pick=(id:string)=>{setPlaying(false);setParams({unit:id},{replace:true});};
 const invalid=Boolean(rawUnit&&!requested)||Boolean(gameId&&!game);
 const reason=game?gameAvailability(game,unit,en):null;
 const candidates=PHONICS_GAMES.filter(g=>(!query||`${g.ko} ${g.en} ${g.goal.join(' ')}`.toLowerCase().includes(query.toLowerCase()))&&g.stages.includes(unit.step)&&(world==='all'||gameVisual(g).world===world));
 const start=()=>{setSeed(crypto.getRandomValues(new Uint32Array(1))[0]);setPlaying(true);};
 return <main className={'phonics-games pg-v2 '+(playing?'pg-is-playing':'')} data-phonics-games>
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
   </>:playing?<GameSession key={`${game.id}:${unit.id}:${seed}`} game={game} unit={unit} en={en} rounds={rounds} seed={seed} onReward={reward=>setRewards(addVillageReward(reward))} rewards={rewards} onExit={()=>setPlaying(false)}/>:<section className="pg-panel pg-launch">
    <h2>{l(en,'이 유닛으로 놀아요','Play with this unit')}</h2><p>Level {unit.step} · Unit {unit.number} · {unit.groups.map(g=>g.label).join(' / ')}</p>
    {game.id==='ow-crossroads'&&<p className="pg-note">{l(en,'5단계 Unit 3의 ow /oʊ/와 Unit 6의 ow /aʊ/를 함께 복습합니다.','Reviews ow /oʊ/ from Level 5 Unit 3 and ow /aʊ/ from Unit 6.')}</p>}
    {reason?<p className="pg-reason" role="status">{reason}</p>:<><label>{l(en,'문제 수','Rounds')}<select aria-label={l(en,'문제 수','Rounds')} value={rounds} onChange={e=>setRounds(Number(e.target.value))}>{[3,6,10].map(n=><option key={n} value={n}>{n}</option>)}</select></label><button type="button" className="pg-primary" onClick={start}>{icon('play_arrow')}{l(en,'게임 시작','Start game')}</button></>}
    <button type="button" className="pg-button" aria-expanded={guide} onClick={()=>setGuide(v=>!v)}>{l(en,'선생님 안내','Teacher guide')}</button>
    {guide&&<aside className="pg-note"><p>{game.goal[en?1:0]}</p><p>{l(en,'전자칠판에서 함께 하세요. 시간 제한 없이 다시 시도할 수 있고, 정답 뒤에 선생님이 다음 문제로 넘깁니다.','Play together on your classroom display. There is no timer. Retry freely, then advance after checking the answer.')}</p><p>{l(en,'듣기 버튼은 전체 단어·문장 발음입니다. 개별 음가는 선생님이 들려주세요.','The audio button reads whole words or sentences. Model individual phonemes yourself.')}</p><p>{l(en,'이번 결과는 이 기기의 수업 요약이며 학생 숙련도나 숙제 기록에 반영하지 않습니다.','The session summary stays on this device and does not update student mastery or homework.')}</p></aside>}
    <Link className="pg-button" to={`/phonics-games?unit=${unit.id}`}>{l(en,'다른 파닉스 게임','Other phonics games')}</Link><Link className="pg-button" to={`/phonics/lesson?unit=${unit.id}&lesson=1`}>{l(en,'수업 슬라이드','Lesson slides')}</Link>
   </section>}
  </>}
 </main>;
}

function GameSession({game,unit,en,rounds,seed,onExit,onReward,rewards}:{game:PhonicsGame;unit:CourseUnit;en:boolean;rounds:number;seed:number;onExit:()=>void;onReward:(reward:VillageReward)=>void;rewards:VillageReward[]}){
 const [index,setIndex]=useState(0),[done,setDone]=useState(false),[paused,setPaused]=useState(false),[large,setLarge]=useState(false);
 const [results,setResults]=useState<boolean[]>([]);const [leaving,setLeaving]=useState(false);
 const panel=useRef<HTMLDivElement>(null);
 const pseudoFull=useRef(false);
 async function toggleFullscreen(){
   if(large){if(document.fullscreenElement===panel.current)await document.exitFullscreen();pseudoFull.current=false;setLarge(false);return;}
   try{if(!panel.current?.requestFullscreen)throw Error('unsupported');await panel.current.requestFullscreen();setLarge(true);}catch{pseudoFull.current=true;setLarge(true);}
 }
 useEffect(()=>{const changed=()=>{if(!pseudoFull.current)setLarge(document.fullscreenElement===panel.current);};document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);

 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){pseudoFull.current=false;setLarge(false);setPaused(true);}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);window.speechSynthesis?.cancel();};},[]);
 useEffect(()=>{if(!large)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[large]);
 useEffect(()=>{if(paused)window.speechSynthesis?.cancel();},[paused]);
 const finish=index>=rounds;
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
  <div className="pg-progress"><span>{Math.min(index+1,rounds)} / {rounds}</span><progress value={index} max={rounds} aria-label={l(en,'게임 진행','Game progress')}/><span>{l(en,'첫 시도 정답','First try')}: {results.filter(Boolean).length}</span></div>
  {game.theme&&<ol className={'pg-journey pg-theme-'+game.theme}>{milestones[game.theme][en?1:0].map((s,i)=><li key={s} aria-current={!finish&&Math.min(2,Math.floor(index*3/rounds))===i?'step':undefined} className={index>=Math.ceil((i+1)*rounds/3)?'pg-milestone-done':''}>{icon(index>=Math.ceil((i+1)*rounds/3)?'check_circle':game.icon)}{s}</li>)}</ol>}
  {paused&&<section className="pg-panel pg-pause" role="status"><h2>{l(en,'잠깐 쉬어가요','Take a break')}</h2><button className="pg-primary" onClick={()=>setPaused(false)}>{l(en,'이어서 하기','Resume')}</button></section>}
  {finish?<section hidden={paused} className="pg-panel pg-results" aria-live="polite"><ClaySprite kind={gameVisual(game).prop} className="pg-result-friend"/><h2>{l(en,'오늘도 잘했어요!','Great work today!')}</h2><p>{rounds}{l(en,'문제를 끝냈어요.',' rounds completed.')}</p><p>{l(en,'첫 시도에 혼자 맞힘','Correct on the first try')}: {results.filter(Boolean).length} · {l(en,'다시 도전·도움 후 완성','Completed after retry / help')}: {results.filter(x=>!x).length}</p><p>{l(en,'수업 활동 결과예요. 장기 숙련도 평가가 아니에요.','This is a practice summary, not a long-term mastery assessment.')}</p><ClassroomVillage rewards={rewards} en={en}/><button className="pg-primary" onClick={()=>{setIndex(0);setResults([]);setDone(false);}}>{l(en,'다시 하기','Play again')}</button><button className="pg-button" onClick={onExit}>{l(en,'게임 선택으로','Back to setup')}</button></section>:<div hidden={paused} inert={paused}>
   {game.mechanic==='adventure'&&<p className="pg-mission">{l(en,'이번 미션','Mission')}: {gameName(activity,en)}</p>}
   <RoundActivity key={`${index}:${activity.id}`} game={activity} visualGame={game} unit={unit} en={en} index={index} seed={seed} onComplete={first=>{setResults(old=>[...old,first]);setDone(true);}}/>
   {done&&<button className="pg-primary pg-next" onClick={()=>{window.speechSynthesis?.cancel();setDone(false);setIndex(n=>n+1);}}>{l(en,index+1===rounds?'결과 보기':'다음 문제',index+1===rounds?'See results':'Next round')}{icon('arrow_forward')}</button>}
  </div>}
 </div></PlayWorld>;
}

interface ActivityProps {game:PhonicsGame;visualGame?:PhonicsGame;unit:CourseUnit;en:boolean;index:number;seed:number;onComplete:(first:boolean)=>void}
function RoundActivity({game,visualGame,unit,en,index,seed,onComplete}:ActivityProps){
 const round=useMemo(()=>makeRound(game,unit,index,seed),[game,unit,index,seed]);
 const [errors,setErrors]=useState(0),[help,setHelp]=useState(false),[solved,setSolved]=useState(false),[wrong,setWrong]=useState(false);
 const [selected,setSelected]=useState<number[]>([]),[opened,setOpened]=useState<number[]>([]),[matched,setMatched]=useState<number[]>([]);
 const [preview,setPreview]=useState(true),[tiles,setTiles]=useState<number[]>([]),[covered,setCovered]=useState<number[]>([]);
 const [connected,setConnected]=useState<number[]>([]),[tracePoints,setTracePoints]=useState<string[]>([]);
 const [drawn,setDrawn]=useState(false);const drawing=useRef(false);
 const speakTarget=round.sentence??round.entry.word;
 const good=(isCorrect:boolean)=>{if(solved)return;if(!isCorrect){setWrong(true);setErrors(n=>n+1);return;}setWrong(false);setSolved(true);onComplete(errors===0&&!help);};
 const uniquePool=useMemo(()=>[...new Map(gamePool(game,unit).map(e=>[e.word,e])).values()],[game,unit]);
 const cardPool=useMemo(()=>{const pictures=uniquePool.filter(pictureEligible);return pictures.length>=2?pictures:uniquePool;},[uniquePool]);
 const memoryEntries=useMemo(()=>shuffled(cardPool,seed+index).slice(0,3),[cardPool,seed,index]);
 const pairCards=useMemo(()=>{
  if(game.mechanic==='pairs'){const letters=[...new Set(unit.groups.map(g=>g.label[0]))].slice(0,3);return shuffled(letters.flatMap((letter,p)=>[{id:p,kind:0,text:letter},{id:p,kind:1,text:letter.toLowerCase()}]),seed+index);}
  return shuffled(memoryEntries.flatMap((entry,p)=>[{id:p,kind:0,text:entry.word},{id:p,kind:1,text:entry.word}]),seed+index);
 },[game.mechanic,unit,memoryEntries,seed,index]);
 const groupEntries=[...new Map(gamePool(game,unit).map(e=>[patternKey(unit,e),e])).values()];
 const buildTokens=round.tokens;
 const tokenChoices=useMemo(()=>shuffled(buildTokens.map((text,id)=>({text,id})),seed+index+24),[buildTokens,seed,index]);
 const huntTarget=alphabetGlyph(round.entry).toLowerCase();
 const huntLetters=useMemo(()=>shuffled([...unit.groups.map(g=>g.label[0]),...unit.groups.map(g=>g.label[0].toLowerCase()),...unit.groups.map(g=>g.label[0])],seed+index),[unit,seed,index]);
 const bingoEntries=useMemo(()=>shuffled(uniquePool,seed+index).slice(0,uniquePool.length>=9?9:4),[uniquePool,seed,index]);
 const bingoOrder=useMemo(()=>shuffled(bingoEntries.map((_,i)=>i),seed+index+77),[bingoEntries,seed,index]);
 const bingoTarget=bingoOrder.find(i=>!covered.includes(i));
 const fillChoices=useMemo(()=>{
  const correct=round.answer;
  const all=game.id==='vowel-repair'?['a','e','i','o','u']:game.id==='rescue-e'?['e','a','i']:gamePool(game,unit).map(targetText);
  return shuffled([...new Set([correct,...all.filter(s=>s&&s!==correct)])].slice(0,5),seed+index+8);
 },[round.answer,game,unit,seed,index]);
 const oddOptions=useMemo(()=>{
  const a=uniquePool.find(e=>uniquePool.filter(x=>patternKey(unit,x)===patternKey(unit,e)).length>=2)!;
  if(!a)return [];
  const same=uniquePool.filter(e=>patternKey(unit,e)===patternKey(unit,a)).slice(0,2),other=uniquePool.find(e=>patternKey(unit,e)!==patternKey(unit,a))!;
  return shuffled([...same,other],seed+index);
 },[unit,uniquePool,seed,index]);
 const pairClick=(i:number)=>{if(solved||matched.includes(i)||opened.includes(i))return;if(opened.length===2){setOpened([i]);return;}const next=[...opened,i];setOpened(next);if(next.length===2){if(pairCards[next[0]].id===pairCards[i].id&&pairCards[next[0]].kind!==pairCards[i].kind){const ids=[...matched,...next];setMatched(ids);setOpened([]);if(ids.length===pairCards.length)good(true);}else{setErrors(n=>n+1);setWrong(true);}}};
 const speechHint=()=>setHelp(true);
 const hintWord=game.mechanic==='missing'?shuffled(uniquePool,seed+index).slice(0,4)[index%Math.min(4,uniquePool.length)].word:speakTarget;
 const feedback=<div className="pg-feedback" aria-live="polite">{solved?<><strong>{l(en,'완성했어요! 함께 읽어요.','You did it! Read it together.')}</strong>{!['pairs','memory','trace','hunt','bingo','sort','odd'].includes(game.mechanic)&&<p lang="en">{round.sentence??round.entry.word}</p>}</>:wrong?<strong>{l(en,'다시 살펴볼까요?','Take another look. You can retry.')}</strong>:null}</div>;
 const cue=(showWord=false)=><div className="pg-cue">{pictureEligible(round.entry)?<WordPicture entry={round.entry} en={en}/>:<p className="pg-note">{l(en,'선생님이 단어를 읽고 뜻을 설명해 주세요.','Ask your teacher to read and explain this word.')}</p>}{showWord&&<MarkedWord entry={round.entry}/>}<Audio text={speakTarget} en={en}/></div>;
 let content;
 if(game.mechanic==='pairs'||game.mechanic==='memory')content=<><p>{l(en,game.mechanic==='pairs'?'대문자와 소문자를 연결하세요.':'카드 두 장을 열어 그림과 단어를 연결하세요.',game.mechanic==='pairs'?'Match uppercase and lowercase letters.':'Turn two cards to pair a picture and a word.')}</p><div className="pg-memory-grid">{pairCards.map((c,i)=>{const revealed=game.mechanic==='pairs'||opened.includes(i)||matched.includes(i)||help;return <button type="button" className={'pg-memory-card '+(matched.includes(i)?'pg-matched':'')} key={i} disabled={solved||matched.includes(i)} aria-label={revealed?c.text:l(en,`${i+1}번 카드`, `Card ${i+1}`)} aria-pressed={opened.includes(i)} onClick={()=>pairClick(i)}>{revealed?game.mechanic==='memory'&&c.kind===0?<WordPicture entry={memoryEntries[c.id]} en={en}/>:<span lang="en">{c.text}</span>:'?'}</button>;})}</div></>;
 else if(game.mechanic==='sort')content=<>{cue(true)}<p>{l(en,'단어의 목표 철자를 보고 알맞은 곳으로 보내세요.','Read the target spelling and choose its group.')}</p><div className="pg-options pg-baskets">{groupEntries.map(e=><button type="button" key={e.id} disabled={solved} onClick={()=>good(patternKey(unit,e)===patternKey(unit,round.entry))}>{icon(game.icon)}<span lang="en">{patternLabel(unit,e)}</span></button>)}</div></>;
 else if(game.mechanic==='hunt')content=<><p>{l(en,'같은 대소문자를 모두 찾아요.','Find every matching uppercase and lowercase letter.')}</p><strong className="pg-display" lang="en">{huntTarget.toUpperCase()} {huntTarget}</strong><div className="pg-letter-field">{huntLetters.map((letter,i)=><button type="button" key={i} disabled={solved||selected.includes(i)} className={selected.includes(i)?'pg-picked':''} onClick={()=>{if(letter.toLowerCase()!==huntTarget){good(false);return;}const next=[...selected,i];setSelected(next);if(next.length===huntLetters.filter(x=>x.toLowerCase()===huntTarget).length)good(true);}}>{letter}</button>)}</div></>;
 else if(game.mechanic==='trace')content=<><p>{l(en,'글자를 따라 쓰세요. 쓰기 평가는 선생님이 확인해요.','Trace the letter. Your teacher checks the writing.')}</p><svg className="pg-trace" viewBox="0 0 600 300" aria-label={l(en,'글자 따라 쓰기 판','Letter tracing board')} onPointerDown={e=>{if(solved)return;drawing.current=true;e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.getBoundingClientRect();setTracePoints(a=>[...a,`M ${(e.clientX-r.left)*600/r.width} ${(e.clientY-r.top)*300/r.height}`]);}} onPointerMove={e=>{if(!drawing.current||solved)return;const r=e.currentTarget.getBoundingClientRect();setDrawn(true);setTracePoints(a=>[...a,`L ${(e.clientX-r.left)*600/r.width} ${(e.clientY-r.top)*300/r.height}`]);}} onPointerUp={()=>{drawing.current=false;}} onPointerCancel={()=>{drawing.current=false;}}><text x="300" y="225" textAnchor="middle">{huntTarget.toUpperCase()} {huntTarget}</text><path d={tracePoints.join(' ')} fill="none" stroke="#136bce" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/></svg><div className="pg-actions"><button className="pg-button" disabled={solved} onClick={()=>{setTracePoints([]);setDrawn(false);}}>{l(en,'지우기','Clear')}</button><button className="pg-primary" disabled={solved||!drawn} onClick={()=>{setHelp(true);setSolved(true);onComplete(false);}}>{l(en,'선생님 확인 · 완료','Teacher checked · Done')}</button></div></>;
 else if(game.mechanic==='build'||game.mechanic==='sentence')content=<>{game.mechanic==='sentence'?<><p>{l(en,'읽은 문장을 기억하고 단어를 순서대로 놓아요.','Remember the sentence and arrange its words.')}</p>{preview?<><p className="pg-display pg-sentence" lang="en">{round.sentence}</p><button className="pg-button" onClick={()=>setPreview(false)}>{l(en,'문장 가리고 시작','Hide sentence and begin')}</button></>:<WordPicture entry={round.entry} en={en}/>}</>:cue()}{(game.mechanic!=='sentence'||!preview)&&<><div className={'pg-build-track '+(game.id==='sound-steps'?'pg-steps':'')} aria-label={l(en,'조립한 단어','Built word')} lang="en">{buildTokens.map((_,i)=><span key={i} className={tiles[i]!==undefined?'pg-filled':''}>{tiles[i]!==undefined?tokenChoices.find(x=>x.id===tiles[i])?.text:'·'}</span>)}</div><div className="pg-options pg-token-bank">{tokenChoices.map(c=><button type="button" key={c.id} disabled={solved||tiles.includes(c.id)} onClick={()=>{const built=[...tiles,c.id];if(c.text!==buildTokens[tiles.length]){good(false);return;}setTiles(built);if(built.length===buildTokens.length)good(true);}}>{c.text}</button>)}</div><button type="button" className="pg-button" disabled={solved||!tiles.length} onClick={()=>setTiles(a=>a.slice(0,-1))}>{l(en,'한 칸 되돌리기','Undo one tile')}</button>{game.id==='blend-launch'&&<p>{l(en,'자음군의 두 소리를 각각 말한 뒤 연결하세요.','Say both consonant sounds, then blend.')}</p>}</>}</>;
 else if(game.mechanic==='fill'||game.mechanic==='change'){
  const onset=round.source?round.entry.word.slice(0,round.entry.word.length-(unit.groups.find(g=>g.entries.some(e=>e.id===round.entry.id))!.label.length-1)):'';
  const opts=game.mechanic==='change'?[...new Set(gamePool(game,unit).map(e=>e.word[0]))]:fillChoices;
  content=<>{cue()}<p className="pg-display" lang="en">{game.mechanic==='change'?<>{round.source?.word} → _{round.entry.word.slice(1)}</>:round.masked}</p><div className="pg-options pg-token-bank">{shuffled(opts,seed+index).map(c=><button type="button" key={c} disabled={solved} onClick={()=>good(c===(game.mechanic==='change'?onset:round.answer))}>{c}</button>)}</div></>;
 }
 else if(game.mechanic==='bridge'||game.mechanic==='lab')content=<><p>{l(en,game.mechanic==='bridge'?'모음과 끝 e를 차례로 선택해 다리를 연결하세요.':'끝 e를 누르고 모음과 함께 확인하세요.',game.mechanic==='bridge'?'Connect the vowel and final e, in order.':'Tap final e and notice its vowel partner.')}</p><div className="pg-magic-word" lang="en">{[...round.entry.word].map((c,i)=><button type="button" className={connected.includes(i)?'pg-connected':''} key={i} disabled={solved} onClick={()=>{const targets=game.mechanic==='lab'?[round.entry.word.length-1]:round.entry.targets??[];if(i!==targets[connected.length]){good(false);return;}const next=[...connected,i];setConnected(next);if(next.length===targets.length)good(true);}}>{c}</button>)}</div>{solved&&<><MarkedWord entry={round.entry}/><p>{l(en,'모음과 끝 e의 자리를 확인하고 전체 단어를 읽어요.','Notice the vowel and final e, then read the whole word.')}</p><Audio text={round.entry.word} en={en}/></>}</>;
 else if(game.mechanic==='position')content=<><MarkedWord entry={round.entry}/><p>{l(en,'강조된 철자의 위치는 어디인가요?','Where is the highlighted spelling?')}</p><div className="pg-options">{['start','end','middle'].map((pos,i)=><button type="button" key={pos} disabled={solved} onClick={()=>{const t=round.entry.targets??[];good(pos===(t[0]===0?'start':t[t.length-1]===round.entry.word.length-1?'end':'middle'));}}>{[l(en,'앞','Start'),l(en,'뒤','End'),l(en,'가운데','Middle')][i]}</button>)}</div></>;
 else if(game.mechanic==='odd')content=<><p>{l(en,'목표 철자 규칙이 다른 단어 하나를 찾아요.','Find the word with a different target spelling pattern.')}</p><div className="pg-options">{oddOptions.map(e=><button type="button" key={e.id} disabled={solved} onClick={()=>good(oddOptions.filter(x=>patternKey(unit,x)===patternKey(unit,e)).length===1)}><MarkedWord entry={e}/><small>{patternLabel(unit,e)}</small></button>)}</div></>;
 else if(game.mechanic==='missing'){
  const list=shuffled(uniquePool,seed+index).slice(0,4);const missing=index%list.length;
  content=<><p>{l(en,preview?'단어를 기억하세요. 준비되면 가려 보세요.':'사라진 단어는 무엇인가요?',preview?'Remember the words, then hide one.':'Which word disappeared?')}</p><div className="pg-remember-strip">{list.map((e,i)=><span lang="en" key={e.id}>{preview||i!==missing?e.word:'?'}</span>)}</div>{preview?<button type="button" className="pg-primary" onClick={()=>setPreview(false)}>{l(en,'카드 가리기','Hide a card')}</button>:<div className="pg-options">{shuffled(list,seed+index+7).map(e=><button key={e.id} disabled={solved} onClick={()=>good(e.id===list[missing].id)}>{e.word}</button>)}</div>}</>;
 }
 else if(game.mechanic==='bingo'){
  const side=bingoEntries.length===9?3:2;
  content=<><p>{l(en,'단어를 듣고 칸을 골라 한 줄을 완성하세요.','Hear a word and complete a row, column or diagonal.')}</p>{bingoTarget!==undefined&&<Audio text={bingoEntries[bingoTarget].word} en={en}/>}<div className="pg-bingo" style={{gridTemplateColumns:`repeat(${side},1fr)`}}>{bingoEntries.map((e,i)=><button key={e.id} disabled={solved||covered.includes(i)} className={covered.includes(i)?'pg-picked':''} onClick={()=>{if(i!==bingoTarget){good(false);return;}const next=[...covered,i];setCovered(next);const lines=[...Array.from({length:side},(_,r)=>Array.from({length:side},(_,c)=>r*side+c)),...Array.from({length:side},(_,c)=>Array.from({length:side},(_,r)=>r*side+c)),Array.from({length:side},(_,j)=>j*side+j),Array.from({length:side},(_,j)=>j*side+side-1-j)];if(lines.some(line=>line.every(n=>next.includes(n)))||next.length===bingoEntries.length)good(true);}}>{e.word}{covered.includes(i)&&icon('check_circle')}</button>)}</div></>;
 }
 else {
  const balloons=game.id==='sound-balloons';const read=game.mechanic==='read';
  content=<>{balloons?<><p>{l(en,'선생님이 대표 단어를 들려준 뒤 목표 글자를 고르세요.','Listen to the sample word and choose its target letter.')}</p><Audio text={round.entry.word} en={en}/><p className="pg-note">{l(en,'개별 소리는 선생님이 들려주세요. X는 단어 끝의 소리예요.','Ask your teacher to model the individual sound. X occurs at the end of these words.')}</p></>:game.mechanic==='puzzle'?<><p>{l(en,'그림 조각을 눌러 열고 단어를 찾아요.','Uncover picture pieces, then choose the word.')}</p><div className="pg-puzzle"><WordPicture entry={round.entry} en={en}/><div className="pg-puzzle-covers">{[0,1,2,3].map(i=><button type="button" disabled={solved} style={{visibility:opened.includes(i)?'hidden':'visible'}} key={i} aria-label={l(en,`${i+1}번 조각 열기`,`Uncover piece ${i+1}`)} onClick={()=>setOpened(a=>[...a,i])}>{i+1}</button>)}</div></div></>:read?<><p className="pg-display pg-sentence" lang="en">{round.sentence??round.entry.word}</p>{!preview||game.id!=='word-treasure'?null:<button className="pg-primary" onClick={()=>setPreview(false)}>{l(en,'읽었어요 · 상자 열기','I read it · Open chests')}</button>}</>:<><p>{l(en,'단어를 듣고 알맞은 그림을 골라요.','Listen and choose the matching picture.')}</p><Audio text={round.entry.word} en={en}/></>}
   {balloons?<div className="pg-options pg-balloons">{shuffled([...new Map(gamePool(game,unit).map(e=>[targetText(e).toLowerCase(),e])).values()],seed+index).map(e=><button type="button" key={e.id} disabled={solved} onClick={()=>good(targetText(e).toLowerCase()===targetText(round.entry).toLowerCase())}>{alphabetGlyph(e).toUpperCase()} {alphabetGlyph(e).toLowerCase()}</button>)}</div>:read&&preview&&game.id==='word-treasure'?null:<div className={'pg-options '+(game.id==='sound-fishing'?'pg-fish':'')}>{round.options.map(e=><button type="button" key={e.id} disabled={solved} onClick={()=>good(e.id===round.entry.id)}>{read||game.mechanic==='choice'?pictureEligible(e)?<WordPicture entry={e} en={en}/>:<span lang="en">{e.word}</span>:<span lang="en">{e.word}</span>}</button>)}</div>}
  </>;
 }
 return <section className={'pg-playground pg-mode-'+game.id} data-activity={game.id} data-solved={solved} data-retry={wrong} data-carriages={game.id==='sound-train'&&gameVisual(visualGame??game).world==='train'}>
  <h2>{gameName(game,en)}</h2>
  <LearningStage game={visualGame??game} en={en} solved={solved} wrong={wrong} word={solved?speakTarget:''} pieces={tiles.map(id=>tokenChoices.find(t=>t.id===id)?.text??'')} slots={buildTokens.length} progress={Math.max(tiles.length/Math.max(1,buildTokens.length),matched.length/Math.max(1,pairCards.length),selected.length/Math.max(1,huntLetters.filter(x=>x.toLowerCase()===huntTarget).length),covered.length/Math.max(1,bingoEntries.length),connected.length/Math.max(1,round.entry.targets?.length??0),game.mechanic==='puzzle'?opened.length/4:0,drawn ? .5 : 0)}/>
  <div className="pg-learning-content">{content}</div>{feedback}
  {!solved&&<details className="pg-hint" onToggle={e=>{if(e.currentTarget.open)setHelp(true);}}><summary>{l(en,'선생님 힌트','Teacher hint')}</summary><p>{game.mechanic==='odd'?oddOptions.map(e=>`${e.word}: ${patternLabel(unit,e)}`).join(' / '):game.mechanic==='pairs'?l(en,'같은 글자의 대문자와 소문자를 연결하세요.','Match the two cases of the same letter.'):game.mechanic==='bingo'&&bingoTarget!==undefined?bingoEntries[bingoTarget].word:hintWord}</p><p>{l(en,'힌트를 본 문제는 도움 후 완성으로 기록해요.','A round with a hint is recorded as completed with help.')}</p>{!['pairs','memory','bingo'].includes(game.mechanic)&&<Audio text={hintWord} en={en} onHelp={speechHint}/>}</details>}
 </section>;
}
