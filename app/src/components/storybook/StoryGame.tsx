import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useGameWorkspace } from '../../context/GameWorkspaceContext';
import { useStoryRound } from '../../lib/useStoryRound';
import { STORY_KO, STORY_NAMES, storyErrors, normalizeStory, type StorybookConfig, type StoryGame as StoryType } from '../../lib/storybook';
import { Explorer, FoodArt, Monster, StoryWorld } from './StoryArt';
import './storybook.css';

export default function StoryGame({ type, config, onRestart }: { type: StoryType; config: StorybookConfig; onRestart: () => void }) {
  const workspace = useGameWorkspace();
  const paused = !!workspace?.playing && (!workspace.running || !!workspace.panel);
  const r = useStoryRound(type, config, paused);
  const { phase, start } = r;
  const root = useRef<HTMLDivElement>(null);
  const drop = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState('');
  const [hover, setHover] = useState(false);
  const [drag, setDrag] = useState<{word: string; x: number; y: number} | null>(null);
  const origin = useRef<{x: number; y: number; word: string; moved: boolean} | null>(null);
  const [full, setFull] = useState(false);
  const [pseudoFull, setPseudoFull] = useState(false);
  const errors = storyErrors(type, config);
  useEffect(() => { const change = () => setFull(document.fullscreenElement === root.current); document.addEventListener('fullscreenchange', change); return () => document.removeEventListener('fullscreenchange', change); }, []);
  useEffect(() => { if (workspace?.running && phase === 'ready' && !errors.length) start(); }, [workspace?.running, phase, start, errors.length]);
  useEffect(() => { if (!pseudoFull) return; const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPseudoFull(false); }; window.addEventListener('keydown', esc); return () => { document.body.style.overflow = old; window.removeEventListener('keydown', esc); }; }, [pseudoFull]);
  const previous = type === 'sentencetower' ? r.index === 0 ? config.start : config.steps[r.index - 1]?.sentence || config.start : '';
  const step = config.steps[r.index];
  const prefix = step ? normalizeStory(previous.slice(0,step.position)) : '';
  const phraseStart = prefix.length + (prefix ? 1 : 0);
  const expanded = step ? normalizeStory(step.sentence) : '';
  const phraseText = step ? normalizeStory(step.phrase) : '';
  const q = r.deck[r.index];
  const correctNow = r.reaction === 'correct';
  const progress = r.phase === 'finished' ? r.total : r.index + (correctNow ? 1 : 0);
  const inert = r.phase !== 'playing' || r.reaction !== 'idle' || paused || r.expired;
  function submit(word: string) { r.submit(word); setSelected(''); setHover(false); }
  function pointerDown(e: PointerEvent<HTMLButtonElement>, word: string) {
    if (inert || type === 'sentencebridge' || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId); origin.current = {x: e.clientX, y: e.clientY, word, moved: false};
  }
  function pointerMove(e: PointerEvent<HTMLButtonElement>) {
    const o = origin.current; if (!o) return;
    if (Math.hypot(e.clientX - o.x, e.clientY - o.y) > 8) o.moved = true;
    if (!o.moved) return;
    setDrag({word:o.word,x:e.clientX,y:e.clientY});
    const bounds = drop.current?.getBoundingClientRect();
    setHover(!!bounds && e.clientX >= bounds.left && e.clientX <= bounds.right && e.clientY >= bounds.top && e.clientY <= bounds.bottom);
  }
  function pointerUp(e: PointerEvent<HTMLButtonElement>) {
    const o = origin.current;
    if (!o) return;
    const bounds = drop.current?.getBoundingClientRect();
    const inside = bounds && e.clientX >= bounds.left && e.clientX <= bounds.right && e.clientY >= bounds.top && e.clientY <= bounds.bottom;
    if (o.moved && inside) submit(o.word);
    // Suppress the synthetic click after a drag, including drops outside the target.
    if (o.moved) e.currentTarget.dataset.dragged = 'true';
    origin.current = null; setDrag(null); setHover(false);
  }
  async function fullscreen() {
    if (pseudoFull) { setPseudoFull(false); return; }
    if (full) { await document.exitFullscreen(); return; }
    try { if (!root.current?.requestFullscreen) { setPseudoFull(true); return; } await root.current.requestFullscreen(); }
    catch { setPseudoFull(true); }
  }
  function exit() { setPseudoFull(false); if (full) void document.exitFullscreen(); workspace?.exitPlay(); onRestart(); }
  const instruction = type === 'feedmonster' ? '카드를 입으로 옮겨 주세요! 카드 → 몬스터 터치도 가능해요.' : type === 'sentencebridge' ? '빈칸에 알맞은 말을 골라 강을 건너요!' : '빈자리에 들어갈 표현을 골라 성을 지어요!';
  const board = <div ref={root} data-story-game={type} className={`sb-game sb-${type} ${pseudoFull ? 'sb-pseudo-full' : ''} ${paused ? 'sb-paused' : ''}`}>
    <StoryWorld type={type}/>
    <header className="sb-top"><div className="sb-brand"><span className="sb-mini-star">✦</span><span>ClassBank <small>PLAY & GROW</small></span></div><div className="sb-tools"><button onClick={exit} aria-label="게임 준비로 돌아가기">← <span>준비 화면</span></button><button onClick={() => void fullscreen()} aria-label={full || pseudoFull ? '전체 화면 종료' : '전체 화면'}>{full || pseudoFull ? '⊡' : '⛶'}</button></div></header>
    <div className="sb-game-name"><span>{STORY_KO[type]}</span><h2>{STORY_NAMES[type]}</h2></div>
    <div className="sb-progress" aria-label={`진행 ${progress} / ${r.total}`}><span>✦ {progress} / {r.total}</span><div><i style={{width:`${progress / Math.max(1,r.total) * 100}%`}}/></div>{!!config.seconds && <span aria-label="남은 시간">◷ {r.remaining}s</span>}</div>
    {type !== 'sentencetower' && <div className="sb-prompt"><span className="sb-eyebrow">{type === 'feedmonster' ? config.mode === 'vocabulary' ? '이 뜻의 단어를 찾아요' : '우리 친구가 원하는 것은?' : '한 걸음씩, 다리를 완성해요'}</span><p>{q && 'prompt' in q ? q.prompt.split(/(_{3,})/).map((part,i) => /_{3,}/.test(part) ? <span className="sb-blank" key={i}>{correctNow && 'answer' in q ? q.answer : '　'}</span> : <span key={i}>{part}</span>) : ''}</p></div>}
    {type === 'feedmonster' && <div className="sb-monster-stage"><Monster happy={correctNow || r.phase === 'finished'} wrong={r.reaction === 'wrong'} hungry={hover}/><button ref={drop} className={`sb-mouth-target ${hover ? 'sb-drop-hover' : ''}`} disabled={inert} aria-label="몬스터에게 먹이 주기" onClick={() => selected && submit(selected)}>{selected && !correctNow && <span>{selected} 먹이 주기 ↓</span>}</button><div className="sb-monster-shadow"/></div>}
    {type === 'sentencebridge' && <div className="sb-river-play"><svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="55" cy="225" rx="70" ry="26" fill="#f5e8b9"/><ellipse cx="945" cy="110" rx="70" ry="26" fill="#f5e8b9"/>{r.deck.map((_, i) => { const x=140+(i*720/Math.max(1,r.total-1)), y=218-i*95/Math.max(1,r.total-1); return <g key={i} opacity={i < progress ? 1 : .36} className={correctNow && i === r.index ? 'sb-stone-lit' : ''}><ellipse cx={x} cy={y+11} rx={Math.min(49,330/r.total)} ry="24" fill={['#d995b3','#c4ae6a','#819ec2','#9f8ac7'][i%4]}/><ellipse cx={x} cy={y} rx={Math.min(49,330/r.total)} ry="24" fill={['#ffc2d6','#ffe6a7','#b8e7f5','#d8c8fa'][i%4]} stroke="#fffcf4" strokeWidth="3"/></g>})}<path d="M940 96V10m0 0 38 12-38 12" fill="#f8a6c6" stroke="#ba83aa" strokeWidth="4"/></svg><div className={`sb-explorer ${correctNow ? 'sb-jumping' : ''}`} style={{left:`${progress === r.total && r.phase === 'finished' ? 94 : progress ? 14+(progress-1)*72/Math.max(1,r.total-1) : 5.5}%`,top:`${progress ? 72.6-(progress-1)*31.6/Math.max(1,r.total-1) : 75}%`}}><Explorer/></div>{r.reaction === 'wrong' && <div className="sb-splash">◦ ˚ ◦ ˚</div>}</div>}
    {type === 'sentencetower' && <><div className="sb-tower-task"><span className="sb-eyebrow">지금 문장에 어떤 표현을 더할까요?</span><p>{r.phase === 'finished' ? config.steps.at(-1)?.sentence : correctNow ? <>{expanded.slice(0,phraseStart)}<mark>{phraseText}</mark>{expanded.slice(phraseStart+phraseText.length)}</> : <>{previous.slice(0,step?.position)}<button ref={drop} disabled={inert} className={`sb-insert-slot ${hover ? 'sb-drop-hover' : ''}`} onClick={() => selected && submit(selected)} aria-label="선택한 표현을 빈자리에 넣기">{selected || '＋'}</button>{previous.slice(step?.position)}</>}</p><small className="sb-tower-goal">목표 문장 · {step?.sentence}</small></div><div className="sb-tower" style={{'--floors':config.steps.length + 1} as CSSProperties}>{[config.start,...config.steps.slice(0,progress).map(s=>s.sentence)].map((s,i)=><div className={`sb-floor ${i === progress && correctNow ? 'sb-floor-fall' : ''}`} key={i} style={{'--floor':i} as CSSProperties}><span>{s}</span><i/><i/></div>)}{r.phase === 'finished' && <div className="sb-roof"><span>⚑</span></div>}<div className="sb-foundation"/></div></>}
    <div className="sb-bottom"><div className={`sb-feedback ${r.reaction}`} role="status" aria-live="polite">{r.reaction === 'correct' ? type === 'feedmonster' ? '♥ 냠냠! 정말 맛있어!' : type === 'sentencebridge' ? '✦ 멋져요! 한 걸음 더 가까이!' : '✦ 새로운 층이 완성됐어요!' : r.reaction === 'wrong' ? '괜찮아요! 다른 카드를 골라 볼까요?' : instruction}</div>
      <div className="sb-cards">{r.choices.map((word,i)=><button key={`${r.index}:${word}`} disabled={inert} data-choice={word} className={`sb-card ${selected === word ? 'is-selected' : ''} ${r.picked === word ? `is-${r.reaction}` : ''}`} style={{'--card-color':['#ffe6a7','#ffc2d6','#b9ead5','#d8c8fa','#b8e7f5'][i%5]} as CSSProperties} onPointerDown={e=>pointerDown(e,word)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{ origin.current=null;setDrag(null);setHover(false); }} onClick={e=>{ if(e.currentTarget.dataset.dragged){delete e.currentTarget.dataset.dragged;return;} if(type==='feedmonster') setSelected(word); else submit(word); }}>
        {type === 'feedmonster' && <FoodArt word={word}/>}<span>{word}</span>{type === 'feedmonster' && <small>먹이 카드</small>}
      </button>)}</div>
      {config.hints && q && 'hint' in q && q.hint && <details className="sb-hint"><summary>✧ 힌트 보기</summary>{q.hint}</details>}
      <span className="sb-footer-note">작은 도전이 모여, 커다란 배움이 돼요.</span>
    </div>
    {drag && createPortal(<div className="sb-drag-ghost" style={{left:drag.x,top:drag.y}}>{drag.word}</div>, document.fullscreenElement || document.body)}
    {(correctNow || r.phase === 'finished') && <div className="sb-sparkles" aria-hidden="true">{Array.from({length:12},(_,i)=><span key={i} style={{left:`${8+i*7.5}%`,animationDelay:`${i%4*.13}s`}}> {i%2 ? '✧' : '♥'} </span>)}</div>}
    {r.phase === 'ready' && !workspace && <div className="sb-overlay"><div className="sb-welcome"><span className="sb-kicker">A LITTLE ENGLISH ADVENTURE</span><div className="sb-welcome-icon">{type === 'feedmonster' ? '♥' : type === 'sentencebridge' ? '⚑' : '♜'}</div><h3>{STORY_NAMES[type]}</h3><p>{instruction}</p>{errors.length ? <p className="sb-error">콘텐츠를 확인해 주세요.<br/>{errors[0]}</p> : <button className="sb-primary" onClick={r.start}>게임 시작 <span>→</span></button>}<small>{type === 'sentencetower' ? `${config.steps.length}단계 문장 쌓기` : `${r.total}개의 작은 도전`} · 틀려도 다시 할 수 있어요</small></div></div>}
    {r.phase === 'finished' && <div className="sb-overlay sb-result-overlay"><div className="sb-welcome"><span className="sb-kicker">WONDERFULLY DONE!</span><div className="sb-medal">✦</div><h3>{type === 'feedmonster' ? '행복한 몬스터 친구!' : type === 'sentencebridge' ? '강 건너 도착했어요!' : '우리의 성이 완성됐어요!'}</h3><p>{type === 'sentencetower' ? config.steps.at(-1)?.sentence : `${r.total}문제를 모두 해결했어요.`}</p><div className="sb-result-stats"><span>완성 <b>{r.total} / {r.total}</b></span><span>다시 도전한 횟수 <b>{r.mistakes}</b></span></div><button className="sb-primary" onClick={onRestart}>다시 놀기 ↻</button><button className="sb-text-button" onClick={exit}>준비 화면으로</button></div></div>}
    {r.expired && r.phase === 'playing' && <div className="sb-overlay"><div className="sb-welcome"><h3>조금 더 생각해 볼까요?</h3><p>시간이 다 됐어요. 같은 문제에 다시 도전할 수 있어요.</p><button className="sb-primary" onClick={r.retry}>계속 도전하기</button></div></div>}
  </div>;
  return pseudoFull ? createPortal(board, document.body) : board;
}
