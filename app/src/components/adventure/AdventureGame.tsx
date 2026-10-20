import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useGameWorkspace } from '../../context/GameWorkspaceContext';
import { gameClock } from '../../lib/gameClock';
import { shuffled } from '../../lib/storybook';
import { ADVENTURE_NAMES, adventureErrors, correctionAccepted, detectiveSentence, sentenceOrderCorrect, targetKey, targetPoint, wordKey, type AdventureConfig, type AdventureRound, type AdventureType } from '../../lib/adventureGames';
import { useAdventureEngine, type AdventureEngine } from '../../lib/useAdventureEngine';
import ArrangePieces from './ArrangePieces';
import './adventure.css';

const worlds:Record<AdventureType,string>={balloonpop:'balloon',wordtrain:'train',wordfishing:'fishing',sentencerocket:'rocket',grammardetective:'detective',treasurehunt:'island',wordclaw:'arcade'};
function englishSpeak(text:string,fallback?:()=>void){
 if(!('speechSynthesis' in window)){fallback?.();return;}
 const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(!voice){fallback?.();return;}
 const utter=new SpeechSynthesisUtterance(text);utter.lang='en-US';utter.voice=voice;utter.rate=.85;utter.onerror=()=>fallback?.();speechSynthesis.cancel();speechSynthesis.speak(utter);
}
function Voice({text,onFallback}:{text:string;onFallback?:()=>void}){return <button className="ad-voice" aria-label="영어 듣기" onClick={()=>{englishSpeak(text,onFallback);}}>🔊</button>;}
export default function AdventureGame({type,config:c,onRestart}:{type:AdventureType;config:AdventureConfig;onRestart:()=>void}){
  const workspace=useGameWorkspace();
  const e=useAdventureEngine(type,c,!!workspace&&(!workspace.running||!!workspace.panel));
  const errors=adventureErrors(type,c);
  const {phase,start}=e;
  useEffect(()=>{if(workspace?.running&&phase==='ready'&&!errors.length)start();},[workspace?.running,phase,start,errors.length]);
  return <section className={`ad-game ad-${type} ${e.paused?'ad-paused':''} ad-phase-${e.phase}`} aria-label={ADVENTURE_NAMES[type][0]}>
    <span className="ad-ambient ad-ambient-one" aria-hidden="true">✦</span><span className="ad-ambient ad-ambient-two" aria-hidden="true">✧</span>
    {(['balloonpop','wordfishing','wordclaw'] as string[]).includes(type)&&<img className={`ad-buddy ${e.reaction}`} src={`/skins/adventure/${type==='balloonpop'?'bunny':type==='wordfishing'?'fisher':'kitten'}.webp`} alt=""/>}
    <img className="ad-world" src={`/skins/adventure/${worlds[type]}.webp`} alt=""/>
    <header className="ad-header"><div><small>CLASSBANK · ENGLISH ADVENTURE</small><h1>{ADVENTURE_NAMES[type][0]}</h1></div><span>{Math.min(e.index+1,e.total)} / {e.total} {e.remaining>0&&c.seconds>0&&<b> · {Math.ceil(e.remaining)}초</b>}</span></header>
    <div className="ad-progress"><i style={{width:`${e.total?e.records.length/e.total*100:0}%`}}/></div>
    {errors.length?<div className="ad-overlay"><h2>게임을 준비해 주세요</h2>{errors.map(v=><p key={v}>{v}</p>)}</div>:<>
      {(e.phase==='playing'||e.phase==='review')&&<div className="ad-play" inert={e.paused||e.phase==='review'||e.expired}>
        <Round key={e.current.id} type={type} c={c} e={e} round={e.current}/>
      </div>}
      {e.phase==='ready'&&!workspace&&<div className="ad-overlay"><h2>{ADVENTURE_NAMES[type][1]}</h2><p>클릭·터치·키보드로 함께 배워요.</p><button className="ad-primary" onClick={e.start}>게임 시작</button></div>}
      {e.phase==='review'&&<div className="ad-overlay ad-review" role="status"><span className="ad-medal">★</span><h2>{type==='grammardetective'?'사건 해결!':'잘했어요!'}</h2><p className="ad-learned">{e.records.at(-1)?.answer}</p>{e.current.kind==='case'&&<p>{e.current.item.explanation}</p>}<Voice text={e.records.at(-1)?.answer||''}/><button className="ad-primary" onClick={e.next}>{e.index+1===e.total?(type==='sentencerocket'?'로켓 발사':'결과 보기'):'다음 문제 →'}</button></div>}
      {e.phase==='finale'&&<RocketFinale finish={e.finish}/>}
      {e.phase==='finished'&&<div className="ad-overlay ad-results"><span className="ad-medal">🏆</span><h2>모험 완료!</h2><p>{e.total}개 미션 완료 · 다시 도전한 횟수 {e.mistakes}회</p><ol>{e.records.map((r,i)=><li key={i}>{r.answer}</li>)}</ol><button className="ad-primary" onClick={onRestart}>다시 시작</button></div>}
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
  const fishing=type==='wordfishing';
  const streak=e.records.length>=2&&e.records.slice(-2).every(row=>row.mistakes===0)&&e.mistakes===e.records.reduce((sum,row)=>sum+row.mistakes,0);
  const [picked,setPicked]=useState('');const [hook,setHook]=useState({x:50,y:50});
  const [fallback,setFallback]=useState(false);const board=useRef<HTMLDivElement>(null);
  const listening=fishing&&c.listening&&!fallback;
  useEffect(()=>{if(!listening)return;const id=gameClock.setTimeout(()=>{englishSpeak(r.word.word,()=>setFallback(true));},300);return()=>{gameClock.clearTimeout(id);if('speechSynthesis' in window)speechSynthesis.cancel();};},[listening,r.word.word]);
  function choose(id:string,node:HTMLButtonElement){const word=r.choices.find(w=>w.id===id)!;const correct=r.accepted.includes(wordKey(word.word));if(!e.judge(correct,r.word.meaning,`${word.word} · ${word.meaning}`,{duration:fishing?2100:1400}))return;setPicked(id);if(board.current){const b=board.current.getBoundingClientRect(),p=node.getBoundingClientRect();setHook({x:(p.x+p.width/2-b.x)/b.width*100,y:(p.y+p.height/2-b.y)/b.height*100});}}
  return <><div className="ad-prompt"><span>{listening?'소리를 듣고 물고기를 찾아요':`${r.word.meaning} — 영어로 무엇일까요?`}</span>{fishing&&<Voice text={r.word.word} onFallback={()=>setFallback(true)}/>}</div>{fallback&&c.listening&&<p className="ad-fallback">영어 음성을 사용할 수 없어 뜻을 보여드려요.</p>}
    <div ref={board} className={`ad-vocab-board ${fishing?'ad-sea':'ad-sky'}`} style={{'--rise':`${c.seconds?(1-e.remaining/({slow:45,normal:30,fast:20}[c.speed]))*28:0}%`,'--speed':c.speed==='slow'?'6s':c.speed==='normal'?'4s':'2.5s',gridTemplateColumns:r.choices.length===4?'repeat(2,minmax(0,1fr))':undefined} as CSSProperties}>
      {fishing&&<svg className={`ad-hook ${e.busy?'is-dropping':''}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={`M 8 0 Q ${hook.x} 0 ${hook.x} ${e.busy?hook.y:12}`} fill="none" stroke="#f9f6df" strokeWidth=".4"/><text x={hook.x} y={e.busy?hook.y:12} fontSize="5">♧</text></svg>}
      {r.choices.map((w,i)=><div className="ad-vocab-slot" key={w.id}><button data-word={w.word} disabled={e.busy} className={`ad-word ${fishing?'ad-fish':'ad-balloon'} ${picked===w.id&&e.busy?e.reaction:''}`} style={{'--color':['#ff9abd','#ffdf70','#94dec8','#a4c9ff','#c4a3ef','#ffa981'][i],'--delay':`${i*-.8}s`} as CSSProperties} onClick={event=>choose(w.id,event.currentTarget)}>{fishing&&<><span className="ad-fish-tail"/><span className="ad-fish-eye"/></>}<span>{w.word}</span>{!fishing&&<i className="ad-string"/>}</button>{picked===w.id&&e.reaction==='correct'&&<span className="ad-sparkles">✦ ★ ✨</span>}</div>)}
    </div>{streak&&<span className="ad-gold">{fishing?<><img src="/skins/adventure/goldfish.webp" alt=""/> 황금 물고기 보너스!</>:'★ 연속 정답! 반짝반짝 별 보너스!'}</span>}<p className="ad-control-help">정답을 누르세요. Tab으로 선택하고 Enter로도 답할 수 있어요.</p></>;
}
function Sentence({type,e,r}:{type:AdventureType;e:AdventureEngine;r:Extract<AdventureRound,{kind:'sentence'}>}){
  const [order,setOrder]=useState<string[]>([]);const train=type==='wordtrain';
  return <><div className="ad-prompt">{train?`🚉 STATION ${e.index+1} · 단어 객차를 연결해 문장을 완성해요.`:'문장 블록을 연결해 로켓 연료를 채워요.'}</div>{!train&&<div className="ad-fuel"><span>🚀 FUEL</span><meter min={0} max={e.total} value={e.records.length}/><b>{Math.round(e.records.length/e.total*100)}%</b></div>}
    <div className={`ad-assembly ${e.reaction==='correct'?'ad-depart':''}`}>{train&&<span className="ad-engine" aria-hidden="true"><img src="/skins/adventure/engine.webp" alt=""/><i className="ad-smoke">☁</i></span>}<ArrangePieces sentence={r.sentence} disabled={e.busy} train={train} onOrder={setOrder}/></div>
    <button className="ad-primary" disabled={e.busy} onClick={()=>e.judge(sentenceOrderCorrect(r.sentence,order),'문장 완성',r.sentence.text,{duration:1800})}>{train?'출발! 문장 확인':'연료 채우기 · 문장 확인'}</button></>;
}
function Detective({c,e,r}:{c:AdventureConfig;e:AdventureEngine;r:Extract<AdventureRound,{kind:'case'}>}){
  const item=r.item;const [selected,setSelected]=useState<string|null>(null),[edits,setEdits]=useState<Record<string,string>>({}),[typed,setTyped]=useState('');
  const ranges=[...item.errors].sort((a,b)=>a.start-b.start);const active=ranges.find(x=>x.id===selected);const nodes=[];let last=0;
  function chooseRange(id:string|null){if(e.busy)return;if(!id){e.judge(false,'오류 찾기',item.correct);return;}setSelected(id);}
  for(const range of ranges){if(range.start>last)nodes.push(<button key={`plain${last}`} onClick={()=>chooseRange(null)}>{item.incorrect.slice(last,range.start)}</button>);nodes.push(<button key={range.id} className={`${selected===range.id?'is-selected':''} ${edits[range.id]?'is-fixed':''}`} onClick={()=>chooseRange(range.id)} disabled={e.busy||!!edits[range.id]}>{edits[range.id]||item.incorrect.slice(range.start,range.end)}</button>);last=range.end;}
  if(last<item.incorrect.length)nodes.push(<button key="tail" onClick={()=>chooseRange(null)}>{item.incorrect.slice(last)}</button>);
  function repair(value:string){if(!active)return;const correct=value===active.replacement;if(!correct){e.judge(false,item.incorrect,item.correct);return;}const next={...edits,[active.id]:value};if(Object.keys(next).length===ranges.length){if(e.judge(true,item.incorrect,detectiveSentence(item,next),{duration:1700}))setEdits(next);}else{setEdits(next);setSelected(null);}}
  return <><div className="ad-prompt">🔎 {c.detectiveMode==='choice'?'틀린 부분을 찾고, 올바른 표현을 골라요.':'틀린 부분을 살펴보고, 바른 문장 전체를 써요.'}</div><img className={`ad-detective-character ${e.reaction}`} src="/skins/adventure/detective-sprite.webp" alt="강아지 탐정"/><div className={`ad-case-file ${e.reaction==='correct'?'ad-solved':''}`}><small>CASE #{e.index+1} · 오류 {ranges.length}개</small><div className="ad-evidence">{nodes}</div>{c.detectiveMode==='choice'?active&&!edits[active.id]&&<div className="ad-choices">{active.choices.map(v=><button key={v} disabled={e.busy} onClick={()=>repair(v)}>{v}</button>)}</div>:<form onSubmit={event=>{event.preventDefault();e.judge(correctionAccepted(typed,item,c),item.incorrect,item.correct);}}><label>수정한 전체 문장<input autoComplete="off" value={typed} onChange={ev=>setTyped(ev.target.value)} disabled={e.busy}/></label><button className="ad-primary" disabled={e.busy||!typed.trim()}>사건 해결</button></form>}{e.reaction==='correct'&&<strong className="ad-stamp">SOLVED ✓</strong>}</div><p className="ad-control-help">같은 단어가 여러 번 나오면 각각의 위치를 확인해요.</p></>;
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
  const [words]=useState(()=>shuffled(c.words));const [selected,setSelected]=useState(0),[collected,setCollected]=useState<string[]>([]),[picked,setPicked]=useState('');const root=useRef<HTMLDivElement>(null);const [hook,setHook]=useState({x:50,y:20});
  const matches=words.filter(w=>w.tags.some(t=>wordKey(t)===wordKey(r.mission.tag)));const locked=e.busy;
  function drop(){const w=words[selected];if(!w||collected.includes(w.id))return;const correct=matches.some(m=>m.id===w.id);const done=correct&&collected.length+1===matches.length;const node=root.current?.querySelector<HTMLElement>(`[data-capsule="${w.id}"]`);if(node&&root.current){const a=root.current.getBoundingClientRect(),b=node.getBoundingClientRect();setHook({x:(b.x+b.width/2-a.x)/a.width*100,y:(b.y+b.height/2-a.y)/a.height*100});node.style.setProperty('--delivery-x',`${a.width*.85-(b.x-a.x)-b.width/2}px`);node.style.setProperty('--delivery-y',`${a.height*.96-(b.y-a.y)-b.height/2}px`);}if(e.judge(correct,r.mission.text,done?matches.map(x=>x.word).join(' · '):w.word,{complete:done,duration:2200})){setPicked(w.id);if(correct)setCollected(old=>[...old,w.id]);}}
  function move(delta:number){if(locked)return;setSelected(v=>(v+delta+words.length)%words.length);}
  return <><div className="ad-prompt">{r.mission.text}<span>{collected.length} / {matches.length}</span></div><div ref={root} className="ad-machine" tabIndex={0} aria-label="집게 조종: 방향키와 스페이스" onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter'].includes(event.key)){event.preventDefault();if(event.key==='ArrowLeft')move(-1);else if(event.key==='ArrowRight')move(1);else if(event.key==='ArrowUp')move(-3);else if(event.key==='ArrowDown')move(3);else drop();}}}>
    <span className={`ad-claw-head ${locked?'is-dropping':''}`} style={{left:`${locked?hook.x:((selected%3)+.5)/3*100}%`,top:`${locked?hook.y:8}%`}}><svg viewBox="0 0 80 85" aria-hidden="true"><path d="M40 0v22M27 33L11 53l8 22M53 33l16 20-8 22" fill="none" stroke="#8b75aa" strokeWidth="8" strokeLinecap="round"/><circle cx="40" cy="30" r="17" fill="#badcea" stroke="white" strokeWidth="4"/><circle cx="35" cy="28" r="2"/><circle cx="46" cy="28" r="2"/><path d="M36 35q5 5 9 0" fill="none" stroke="#41597c" strokeWidth="2"/></svg></span>
    <div className="ad-capsules">{words.map((w,i)=><button key={w.id} data-capsule={w.id} data-word={w.word} className={`ad-capsule ${selected===i?'is-selected':''} ${collected.includes(w.id)?picked===w.id&&locked?'is-lifting':'is-collected':''} ${picked===w.id&&e.reaction==='wrong'?'wrong':''}`} disabled={locked||collected.includes(w.id)} onClick={()=>{setSelected(i);if(c.simpleClaw){/* Direct choice still uses the same deterministic mission rule. */const correct=matches.some(m=>m.id===w.id),done=correct&&collected.length+1===matches.length;if(e.judge(correct,r.mission.text,done?matches.map(x=>x.word).join(' · '):w.word,{complete:done,duration:1600})){setPicked(w.id);if(correct)setCollected(v=>[...v,w.id]);}}}}><small>★</small>{w.word}</button>)}</div><span className="ad-outlet" aria-hidden="true">획득함</span>
  </div><div className="ad-claw-controls"><button disabled={locked} onClick={()=>move(-1)} aria-label="집게 왼쪽">←</button><button className="ad-primary" disabled={locked||collected.includes(words[selected].id)} onClick={drop}>집게 내리기</button><button disabled={locked} onClick={()=>move(1)} aria-label="집게 오른쪽">→</button></div><div className="ad-collected" aria-live="polite">모은 단어: {words.filter(w=>collected.includes(w.id)).map(w=>w.word).join(' · ')||'미션에 맞는 단어를 모두 모아요.'}</div><p className="ad-control-help">단어를 눌러 집게 위치 선택 → 내리기. 조종판에서는 방향키와 Space/Enter도 가능해요.</p></>;
}
function RocketFinale({finish}:{finish:()=>void}){const [count,setCount]=useState(3);useEffect(()=>{const id=gameClock.setInterval(()=>setCount(n=>n-1),1000),end=gameClock.setTimeout(finish,6500);return()=>{gameClock.clearInterval(id);gameClock.clearTimeout(end);};},[finish]);return <div className={`ad-overlay ad-launch ${count<=0?'is-launching':''}`}><h2>{count>0?count:'새로운 행성으로 출발!'}</h2><span className="ad-launch-rocket"><img src="/skins/adventure/rocket-sprite.webp" alt="강아지 우주비행사 로켓"/><i className="ad-flame"/></span>{count<-2&&<p>🪐 영어 행성 도착!</p>}</div>;}
