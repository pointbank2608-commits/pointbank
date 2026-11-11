import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameWorkspace } from '../../context/GameWorkspaceContext';
import { gameClock } from '../../lib/gameClock';
import { shuffled } from '../../lib/storybook';
import { ADVENTURE_NAMES, adventureErrors, correctionAccepted, detectiveGaps, detectiveSentence, sentenceOrderCorrect, targetKey, targetPoint, wordKey, type AdventureConfig, type AdventureRound, type AdventureType } from '../../lib/adventureGames';
import { useAdventureEngine, type AdventureEngine } from '../../lib/useAdventureEngine';
import ArrangePieces from './ArrangePieces';
import { FishArt, FishingTackle, type FishingCast } from './FishingArt';
import './adventure.css';

const worlds:Record<AdventureType,string>={balloonpop:'balloon',wordtrain:'train',wordfishing:'fishing',sentencerocket:'rocket',grammardetective:'detective',treasurehunt:'island',wordclaw:'arcade'};
function englishSpeak(text:string,fallback?:()=>void){
 if(!('speechSynthesis' in window)){fallback?.();return;}
 const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(!voice){fallback?.();return;}
 const utter=new SpeechSynthesisUtterance(text);utter.lang='en-US';utter.voice=voice;utter.rate=.85;utter.onerror=()=>fallback?.();speechSynthesis.cancel();speechSynthesis.speak(utter);
}
function Voice({text,onFallback}:{text:string;onFallback?:()=>void}){return <button className="ad-voice" aria-label="영어 듣기" onClick={()=>{englishSpeak(text,onFallback);}}>🔊</button>;}
export default function AdventureGame({type,config:c,onRestart,preparedRounds,autoStart=false}:{type:AdventureType;config:AdventureConfig;onRestart:()=>void;preparedRounds?: AdventureRound[];autoStart?:boolean}){
  const workspace=useGameWorkspace();
  const e=useAdventureEngine(type,c,!!workspace&&(!workspace.running||!!workspace.panel),preparedRounds);
  const errors=preparedRounds ? (preparedRounds.length ? [] : ['그림 문제를 준비해 주세요.']) : adventureErrors(type,c);
  const {phase,start}=e;
  useEffect(()=>{if((workspace?.running||autoStart)&&phase==='ready'&&!errors.length)start();},[workspace?.running,autoStart,phase,start,errors.length]);
  return <section className={`ad-game ad-${type} ${e.paused?'ad-paused':''} ad-phase-${e.phase}`} aria-label={ADVENTURE_NAMES[type][0]}>
    <span className="ad-ambient ad-ambient-one" aria-hidden="true">✦</span><span className="ad-ambient ad-ambient-two" aria-hidden="true">✧</span>
    {(type==='balloonpop'||type==='wordclaw')&&<img className={`ad-buddy ${e.reaction}`} src={`/skins/adventure/${type==='balloonpop'?'bunny':'kitten'}.webp`} alt=""/>}
    <img className="ad-world" src={`/skins/adventure/${worlds[type]}.webp`} alt=""/>
    <header className="ad-header"><div><small>CLASSBANK · ENGLISH ADVENTURE</small><h1>{ADVENTURE_NAMES[type][0]}</h1></div><span>{Math.min(e.index+1,e.total)} / {e.total} {e.remaining>0&&c.seconds>0&&<b> · {Math.ceil(e.remaining)}초</b>}</span></header>
    <div className="ad-progress"><i style={{width:`${e.total?e.records.length/e.total*100:0}%`}}/></div>
    {errors.length?<div className="ad-overlay"><h2>게임을 준비해 주세요</h2>{errors.map(v=><p key={v}>{v}</p>)}</div>:<>
      {(e.phase==='playing'||e.phase==='review')&&<div className="ad-play" inert={e.paused||e.phase==='review'||e.expired}>
        <Round key={e.current.id} type={type} c={c} e={e} round={e.current}/>
      </div>}
      {e.phase==='ready'&&!workspace&&<div className="ad-overlay"><h2>{ADVENTURE_NAMES[type][1]}</h2><p>클릭·터치·키보드로 함께 배워요.</p><button className="ad-primary" onClick={e.start}>게임 시작</button></div>}
      {e.phase==='review'&&<div className="ad-overlay ad-review" role="status"><span className="ad-medal">★</span><h2>{type==='grammardetective'?'사건 해결!':'잘했어요!'}</h2><p className="ad-learned">{e.records.at(-1)?.answer}</p>{e.current.kind==='case'&&<p>{e.current.item.explanation}</p>}<Voice text={e.records.at(-1)?.answer||''}/><button className="ad-primary" onClick={e.next}>{e.index+1===e.total?(type==='sentencerocket'?'로켓 발사':'결과 보기'):'다음 문제 →'}</button></div>}
      {e.phase==='finale'&&<RocketFinale finish={e.finish} sound={e.sound}/>}
      {e.phase==='finished'&&<div className="ad-overlay ad-results"><span className="ad-medal">🏆</span><h2>모험 완료!</h2><p>{e.total}개 미션 완료 · 다시 도전한 횟수 {e.mistakes}회</p>{type==='grammardetective'&&<p>한 번에 오류를 찾은 문제 {e.records.filter(record=>record.detective?.foundOnFirstTry).length}개 · 한 번에 고친 문제 {e.records.filter(record=>record.detective?.repairedOnFirstTry).length}개</p>}<ol>{e.records.map((r,i)=><li key={i}>{r.answer}</li>)}</ol><button className="ad-primary" onClick={onRestart}>다시 플레이</button></div>}
      {e.expired&&<div className="ad-overlay"><h2>잠깐 쉬었다 다시 도전해요!</h2><p>아직 같은 문제예요. 단어를 다시 살펴봐요.</p><button className="ad-primary" onClick={e.retry}>같은 문제 다시 도전</button></div>}
      {e.phase==='playing'&&<p className={`ad-notice ${e.reaction}`} role="status" aria-live="polite">{e.notice||'천천히 살펴보고 도전해요.'}</p>}
    </>}
  </section>;
}
function Round({type,c,e,round:r}:{type:AdventureType;c:AdventureConfig;e:AdventureEngine;round:AdventureRound}){
  if(r.kind==='vocab')return <Vocabulary type={type} c={c} e={e} r={r}/>;
  if(r.kind==='sentence')return <Sentence type={type} e={e} r={r}/>;
  if(r.kind==='case')return <Detective c={c} e={e} r={r}/>;
  if(r.kind==='clue')return <Hunt c={c} e={e} r={r}/>;
  return <Claw c={c} e={e} r={r}/>;
}
function Vocabulary({type,c,e,r}:{type:AdventureType;c:AdventureConfig;e:AdventureEngine;r:Extract<AdventureRound,{kind:'vocab'}>}){
  const {t}=useTranslation();
  const fishing=type==='wordfishing';
  const streak=e.records.length>=2&&e.records.slice(-2).every(row=>row.mistakes===0)&&e.mistakes===e.records.reduce((sum,row)=>sum+row.mistakes,0);
  const [picked,setPicked]=useState('');
  const [cast,setCast]=useState<FishingCast | null>(null);
  const [fallback,setFallback]=useState(false);
  const listening=fishing&&c.listening&&!fallback&&!r.imageUrl;
  useEffect(()=>{if(!listening)return;const id=gameClock.setTimeout(()=>{englishSpeak(r.word.word,()=>setFallback(true));},300);return()=>{gameClock.clearTimeout(id);if('speechSynthesis' in window)speechSynthesis.cancel();};},[listening,r.word.word]);
  function choose(id:string,node:HTMLButtonElement) {
    const word=r.choices.find(w=>w.id===id)!;
    const correct=r.accepted.includes(wordKey(word.word));
    const reducedMotion=fishing&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=fishing?(reducedMotion?800:correct?1650:1280):1400;
    if(!e.judge(correct,r.word.meaning,`${word.word} · ${word.meaning}`,{duration}))return;
    setPicked(id);
    if(fishing)setCast({fish:node,correct,duration,reducedMotion});
  }
  return <><div className="ad-prompt">{r.imageUrl
    ? <img data-picture-word src={r.imageUrl} alt={t('gameWordHoops.askWord')} className="h-[min(14vh,132px)] object-contain" draggable={false}/>
    : <><span>{listening?'소리를 듣고 물고기를 찾아요':`${r.word.meaning} — 영어로 무엇일까요?`}</span>{fishing&&<Voice text={r.word.word} onFallback={()=>setFallback(true)}/>}</>}</div>{fallback&&c.listening&&<p className="ad-fallback">영어 음성을 사용할 수 없어 뜻을 보여드려요.</p>}
    <div className={`ad-vocab-board ${fishing?'ad-sea':'ad-sky'}`} style={{'--rise':`${c.seconds?(1-e.remaining/({slow:45,normal:30,fast:20}[c.speed]))*28:0}%`,'--speed':c.speed==='slow'?'6s':c.speed==='normal'?'4s':'2.5s',gridTemplateColumns:r.choices.length===4?'repeat(2,minmax(0,1fr))':undefined} as CSSProperties}>
      {fishing&&<FishingTackle cast={e.busy?cast:null}/>}
      {r.choices.map((w,i)=>{
        const reacting = picked === w.id && (e.busy || (fishing && e.phase === 'review'));
        const feedback = reacting ? (fishing ? `ad-fish-${e.reaction}` : e.reaction) : '';
        return <div className="ad-vocab-slot" key={w.id}><button data-word={w.word} disabled={e.busy} className={`ad-word ${fishing?'ad-fish':'ad-balloon'} ${feedback}`} style={{'--color':['#ff9abd','#ffdf70','#94dec8','#a4c9ff','#c4a3ef','#ffa981'][i],'--delay':`${i*-.8}s`} as CSSProperties} onClick={event=>choose(w.id,event.currentTarget)}>{fishing&&<FishArt index={i}/>}<span>{w.word}</span>{!fishing&&<i className="ad-string"/>}</button>{!fishing&&picked===w.id&&e.reaction==='correct'&&<span className="ad-sparkles">✦ ★ ✨</span>}</div>;
      })}
    </div>{streak&&<span className="ad-gold">{fishing?<><img src="/skins/adventure/goldfish.webp" alt=""/> 황금 물고기 보너스!</>:'★ 연속 정답! 반짝반짝 별 보너스!'}</span>}<p className="ad-control-help">정답을 누르세요. Tab으로 선택하고 Enter로도 답할 수 있어요.</p></>;
}
function Sentence({type,e,r}:{type:AdventureType;e:AdventureEngine;r:Extract<AdventureRound,{kind:'sentence'}>}){
  const [order,setOrder]=useState<string[]>([]);const train=type==='wordtrain';
  return <><div className="ad-prompt">{train?`🚉 STATION ${e.index+1} · 단어 객차를 연결해 문장을 완성해요.`:'문장 블록을 연결해 로켓 연료를 채워요.'}</div>{!train&&<div className="ad-fuel"><span>🚀 FUEL</span><meter min={0} max={e.total} value={e.records.length}/><b>{Math.round(e.records.length/e.total*100)}%</b></div>}
    <div className={`ad-assembly ${e.reaction==='correct'?'ad-depart':''}`}>{train&&<span className="ad-engine" aria-hidden="true"><img src="/skins/adventure/engine.webp" alt=""/><i className="ad-smoke">☁</i></span>}<ArrangePieces sentence={r.sentence} disabled={e.busy} train={train} onOrder={setOrder} sound={e.sound}/></div>
    <button className="ad-primary" disabled={e.busy} onClick={()=>e.judge(sentenceOrderCorrect(r.sentence,order),'문장 완성',r.sentence.text,{duration:1800})}>{train?'출발! 문장 확인':'연료 채우기 · 문장 확인'}</button></>;
}
function Detective({c,e,r}:{c:AdventureConfig;e:AdventureEngine;r:Extract<AdventureRound,{kind:'case'}>}){
  const item=r.item;
  const [selected,setSelected]=useState<string|null>(null);
  const [edits,setEdits]=useState<Record<string,string>>({});
  const [typed,setTyped]=useState('');
  const missedLocation=useRef(false);
  const missedRepair=useRef(false);
  const detectiveResult=()=>({foundOnFirstTry:!missedLocation.current,repairedOnFirstTry:!missedRepair.current});
  const ranges=[...item.errors].sort((a,b)=>a.start-b.start);
  const active=ranges.find(range=>range.id===selected);
  const tokens=[...item.incorrect.matchAll(/\S+/gu)];
  const gaps=new Set(detectiveGaps(item.incorrect));
  function chooseRange(id?:string){
    if(e.busy||e.paused||e.expired)return;
    if(!id){
      if(e.judge(false,'오류 찾기',item.correct))missedLocation.current=true;
      setSelected(null);
      return;
    }
    setSelected(id);
    e.sound('pick');
  }
  function repair(value:string){
    if(!active||Object.hasOwn(edits,active.id)||e.busy||e.paused||e.expired)return;
    const next={...edits,[active.id]:value};
    const sentence=detectiveSentence(item,next);
    if(value!==active.replacement && !(ranges.length===1&&correctionAccepted(sentence,item,c))){
      if(e.judge(false,item.incorrect,item.correct))missedRepair.current=true;
      return;
    }
    if(Object.keys(next).length===ranges.length){
      if(e.judge(true,item.incorrect,sentence,{duration:1700,detective:detectiveResult()}))setEdits(next);
    }else{setEdits(next);setSelected(null);e.sound('place');}
  }
  return <>
    <div className="ad-prompt">🔎 {item.context?'상황을 읽고 문장을 고쳐요.':'틀린 단어나 빠진 자리를 찾고 고쳐요.'}</div>
    <div className={`ad-case-file ${e.reaction==='correct'?'ad-solved':''}`}>
      <small>CASE #{e.index+1} · 오류 {ranges.length}개</small>
      {item.context&&<p className="ad-detective-context">상황 · {item.context}</p>}
      <div className="ad-evidence ad-detective-tokens" lang="en">
        {tokens.map((token,i)=>{
          const start=token.index!;
          const end=start+token[0].length;
          const word=token[0].replace(/[.,!?;:]+$/u,'')||token[0];
          const punctuation=token[0].slice(word.length);
          const range=ranges.find(error=>error.start<error.end&&error.start<end&&error.end>start);
          const insertion=gaps.has(start)?ranges.find(error=>error.start===start&&error.end===start):undefined;
          const fixed=range&&Object.hasOwn(edits,range.id);
          const inserted=insertion&&Object.hasOwn(edits,insertion.id);
          const firstFixed=fixed&&!tokens.slice(0,i).some(previous=>previous.index!+previous[0].length>range.start);
          const fixedWord=firstFixed?edits[range.id].trim():'';
          return <span className="ad-detective-token" key={start}>
            <button type="button" className={`ad-detective-gap ${inserted?'is-fixed':''} ${insertion&&selected===insertion.id?'is-selected':''}`}
              aria-label={`${word} 앞에 빠진 말 선택`} disabled={e.busy||inserted}
              onClick={()=>chooseRange(insertion?.id)}>{inserted?edits[insertion.id].trim():'·'}</button>
            {fixed?<span className="is-fixed">{fixedWord}{punctuation&&!fixedWord.endsWith(punctuation)?punctuation:''}</span>:
              <><button type="button" className={range&&selected===range.id?'is-selected':''} disabled={e.busy} onClick={()=>chooseRange(range?.id)}>{word}</button>{punctuation}</>}
          </span>;
        })}
      </div>
      {active&&!Object.hasOwn(edits,active.id)&&(c.detectiveMode==='choice'?
        <div className="ad-choices">{active.choices.map(value=><button type="button" key={value} disabled={e.busy} onClick={()=>repair(value)}>
          {value.trim()||(active.start===active.end?'그대로 두기':'빼기')}
        </button>)}</div>:
        <form onSubmit={event=>{
          event.preventDefault();
          const correct=correctionAccepted(typed,item,c);
          if(e.judge(correct,item.incorrect,correct?typed.trim():item.correct,{detective:detectiveResult()})&&!correct)missedRepair.current=true;
        }}>
          <label>수정한 전체 문장<input autoComplete="off" value={typed} onChange={event=>setTyped(event.target.value)} disabled={e.busy}/></label>
          <button className="ad-primary" disabled={e.busy||!typed.trim()}>사건 해결</button>
        </form>)}
      {e.reaction==='correct'&&<strong className="ad-stamp">SOLVED ✓</strong>}
    </div>
    <p className="ad-control-help">단어를 누르거나, 빠진 말이 있으면 단어 앞의 점을 누르세요.</p>
  </>;
}
const icons={tree:'🌳',palm:'🌴',house:'🏠',river:'💧',rock:'🪨',chest:'🧰',cave:'⛰️',bridge:'🌉'};
function Hunt({c,e,r}:{c:AdventureConfig;e:AdventureEngine;r:Extract<AdventureRound,{kind:'clue'}>}){
  const [targets]=useState(()=>shuffled([r.clue.answer,...r.clue.wrong]));
  const previous=e.rounds.slice(0,e.index).flatMap(row=>row.kind==='clue'?[targetPoint(row.clue.answer,c.places)]:[]);
  const [location,setLocation]=useState(previous.at(-1)||{x:8,y:88});const [opened,setOpened]=useState(false);
  return <><div className="ad-prompt">{r.clue.text}<Voice text={r.clue.text}/></div><div className="ad-island" aria-label="보물 지도">
    <svg className="ad-route" viewBox="0 0 100 100" preserveAspectRatio="none"><path d={`M 8 88 ${[...previous,location].map(p=>`L ${p.x} ${p.y}`).join(' ')}`} fill="none" stroke="#d48355" strokeWidth=".7" strokeDasharray="2 2"/></svg>
    {c.places.map(p=><span className="ad-place" key={p.id} style={{left:`${p.x}%`,top:`${p.y}%`}}><b>{icons[p.icon]}</b><small>{p.name}</small></span>)}
    {targets.map((t,i)=>{const point=targetPoint(t,c.places);const correct=targetKey(t)===targetKey(r.clue.answer);return <button key={targetKey(t)} className={`ad-map-target ${opened&&correct?'is-open':''}`} data-target={targetKey(t)} aria-label={`${c.places.find(p=>p.id===t.placeId)?.name} ${t.relation} 지점`} title={`지도 지점 ${i+1}`} disabled={e.busy} style={{left:`${point.x}%`,top:`${point.y}%`}} onClick={()=>{if(e.judge(correct,r.clue.text,r.clue.text,{duration:2100})&&correct){setLocation(point);setOpened(true);}}}>{opened&&correct?'🪙':'✦'}</button>;})}
    <span className="ad-pirate" style={{left:`${location.x}%`,top:`${location.y}%`}}><img src="/skins/adventure/pirate.webp" alt="해적 탐험가"/></span>{opened&&e.index+1===e.total&&<span className="ad-open-chest" style={{left:`${location.x}%`,top:`${location.y}%`}}><svg viewBox="0 0 100 90" aria-label="열린 보물 상자"><rect x="10" y="43" width="80" height="40" rx="7" fill="#b97b42" stroke="#f6d987" strokeWidth="5"/><path d="M25 45v35m50-35v35" stroke="#f6d987" strokeWidth="7"/><g className="ad-chest-lid"><path d="M10 43V25Q50-5 90 25v18Z" fill="#c68c51" stroke="#ffe4a0" strokeWidth="5"/></g><circle cx="50" cy="56" r="8" fill="#ffd664"/></svg></span>}{opened&&<span className="ad-coins">✦ 🪙 ✨</span>}
  </div><p className="ad-control-help">힌트를 읽고 장소의 앞·뒤·위·아래에 있는 빛나는 지점을 선택해요.</p></>;
}
function Claw({c,e,r}:{c:AdventureConfig;e:AdventureEngine;r:Extract<AdventureRound,{kind:'mission'}>}){
  const [words]=useState(()=>shuffled(r.picture?.words ?? c.words));const [selected,setSelected]=useState(0),[collected,setCollected]=useState<string[]>([]),[picked,setPicked]=useState('');const root=useRef<HTMLDivElement>(null);const [hook,setHook]=useState({x:50,y:20});
  const matches=words.filter(w=>r.picture ? w.word === r.picture.answer : w.tags.some(t=>wordKey(t)===wordKey(r.mission.tag)));const locked=e.busy;
  function drop(){const w=words[selected];if(!w||collected.includes(w.id))return;const correct=matches.some(m=>m.id===w.id);const done=correct&&collected.length+1===matches.length;const node=root.current?.querySelector<HTMLElement>(`[data-capsule="${w.id}"]`);if(node&&root.current){const a=root.current.getBoundingClientRect(),b=node.getBoundingClientRect();setHook({x:(b.x+b.width/2-a.x)/a.width*100,y:(b.y+b.height/2-a.y)/a.height*100});node.style.setProperty('--delivery-x',`${a.width*.85-(b.x-a.x)-b.width/2}px`);node.style.setProperty('--delivery-y',`${a.height*.96-(b.y-a.y)-b.height/2}px`);}if(e.judge(correct,r.mission.text,done?matches.map(x=>x.word).join(' · '):w.word,{complete:done,duration:2200})){setPicked(w.id);if(correct)setCollected(old=>[...old,w.id]);}}
  function move(delta:number){if(locked)return;setSelected(v=>(v+delta+words.length)%words.length);e.sound('move');}
  return <><div className="ad-prompt">{r.picture ? <img data-picture-word src={r.picture.imageUrl} alt={r.mission.text} className="mx-auto h-20 max-w-full object-contain" /> : r.mission.text}<span>{collected.length} / {matches.length}</span></div><div ref={root} className="ad-machine" tabIndex={0} aria-label="집게 조종: 방향키와 스페이스" onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter'].includes(event.key)){event.preventDefault();if(event.key==='ArrowLeft')move(-1);else if(event.key==='ArrowRight')move(1);else if(event.key==='ArrowUp')move(-3);else if(event.key==='ArrowDown')move(3);else drop();}}}>
    <span className={`ad-claw-head ${locked?'is-dropping':''}`} style={{left:`${locked?hook.x:((selected%3)+.5)/3*100}%`,top:`${locked?hook.y:8}%`}}><svg viewBox="0 0 80 85" aria-hidden="true"><path d="M40 0v22M27 33L11 53l8 22M53 33l16 20-8 22" fill="none" stroke="#8b75aa" strokeWidth="8" strokeLinecap="round"/><circle cx="40" cy="30" r="17" fill="#badcea" stroke="white" strokeWidth="4"/><circle cx="35" cy="28" r="2"/><circle cx="46" cy="28" r="2"/><path d="M36 35q5 5 9 0" fill="none" stroke="#41597c" strokeWidth="2"/></svg></span>
    <div className="ad-capsules">{words.map((w,i)=><button key={w.id} data-capsule={w.id} data-word={w.word} className={`ad-capsule ${selected===i?'is-selected':''} ${collected.includes(w.id)?picked===w.id&&locked?'is-lifting':'is-collected':''} ${picked===w.id&&e.reaction==='wrong'?'wrong':''}`} disabled={locked||collected.includes(w.id)} onClick={()=>{setSelected(i);if(!c.simpleClaw)e.sound('pick');if(c.simpleClaw){/* Direct choice still uses the same deterministic mission rule. */const correct=matches.some(m=>m.id===w.id),done=correct&&collected.length+1===matches.length;if(e.judge(correct,r.mission.text,done?matches.map(x=>x.word).join(' · '):w.word,{complete:done,duration:1600})){setPicked(w.id);if(correct)setCollected(v=>[...v,w.id]);}}}}><small>★</small>{w.word}</button>)}</div><span className="ad-outlet" aria-hidden="true">획득함</span>
  </div><div className="ad-claw-controls"><button disabled={locked} onClick={()=>move(-1)} aria-label="집게 왼쪽">←</button><button className="ad-primary" disabled={locked||collected.includes(words[selected].id)} onClick={drop}>집게 내리기</button><button disabled={locked} onClick={()=>move(1)} aria-label="집게 오른쪽">→</button></div><div className="ad-collected" aria-live="polite">모은 단어: {words.filter(w=>collected.includes(w.id)).map(w=>w.word).join(' · ')||'미션에 맞는 단어를 모두 모아요.'}</div><p className="ad-control-help">단어를 눌러 집게 위치 선택 → 내리기. 조종판에서는 방향키와 Space/Enter도 가능해요.</p></>;
}
function RocketFinale({finish,sound}:{finish:()=>void;sound:AdventureEngine['sound']}){
  const [count,setCount]=useState(3);
  useEffect(()=>{let value=3;sound('countdown');const id=gameClock.setInterval(()=>{value--;setCount(value);if(value>0)sound('countdown');else if(value===0)sound('launch');},1000),end=gameClock.setTimeout(finish,6500);return()=>{gameClock.clearInterval(id);gameClock.clearTimeout(end);};},[finish,sound]);
  return <div className={`ad-overlay ad-launch ${count<=0?'is-launching':''}`}><h2>{count>0?count:'새로운 행성으로 출발!'}</h2><span className="ad-launch-rocket"><img src="/skins/adventure/rocket-sprite.webp" alt="강아지 우주비행사 로켓"/><i className="ad-flame"/></span>{count<-2&&<p>🪐 영어 행성 도착!</p>}</div>;
}
