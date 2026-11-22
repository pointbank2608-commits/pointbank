import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { wordKey, type AdventureConfig, type AdventureRound } from '../../lib/adventureGames';
import type { AdventureEngine } from '../../lib/useAdventureEngine';
import { shuffled } from '../../lib/storybook';

const COLUMNS = 3;
const DROP_DURATION = 2400;
const capsuleColors = ['#f7a9cf', '#9becd6', '#ffd875', '#b9a5fa'];
type Draw = Extract<AdventureRound, { kind: 'draw' }>;
type Pick = { index: number; fromColumn: number; correct: boolean; x: number; y: number; width: number };

const controls = [
  { key: 'ArrowUp', delta: -COLUMNS, icon: '↑', label: '집게 위쪽' },
  { key: 'ArrowLeft', delta: -1, icon: '←', label: '집게 왼쪽' },
  { key: 'ArrowRight', delta: 1, icon: '→', label: '집게 오른쪽' },
  { key: 'ArrowDown', delta: COLUMNS, icon: '↓', label: '집게 아래쪽' },
];

function Grabber() {
  return <span className="claw-grabber" aria-hidden="true">
    <svg viewBox="0 0 80 76">
      <rect x="34" y="2" width="12" height="17" rx="4" fill="#b8c5da" stroke="#324963" strokeWidth="3" />
      <path className="claw-jaw claw-jaw-left" d="M29 31 16 47l6 15 8 5" />
      <path className="claw-jaw claw-jaw-right" d="m51 31 13 16-6 15-8 5" />
      <rect x="22" y="16" width="36" height="24" rx="8" fill="#e1ebf8" stroke="#324963" strokeWidth="3" />
      <circle cx="40" cy="28" r="5" fill="#60e8e3" stroke="#324963" strokeWidth="2" />
    </svg>
  </span>;
}

export default function ClawMachine({c,e,r}:{c:AdventureConfig;e:AdventureEngine;r:Draw}) {
  const [words] = useState(()=>shuffled(r.picture ? r.picture.words : r.choices));
  const [selected,setSelected] = useState(0);
  const [collected,setCollected] = useState<string[]>([]);
  const [pick,setPick] = useState<Pick>();
  const glass = useRef<HTMLDivElement>(null);
  const capsules = useRef<(HTMLButtonElement | null)[]>([]);
  const matches = words.filter(word=>r.picture
    ? wordKey(word.word) === wordKey(r.picture.answer)
    : wordKey(word.meaning) === wordKey(r.word.meaning));
  const active = e.busy ? pick : undefined;
  const collectedNow = active?.correct ? collected.filter(id=>id!==words[active.index].id) : collected;
  const complete = collected.length >= 1;
  const style = {
    '--claw-column': selected % COLUMNS,
    '--claw-from-column': active?.fromColumn ?? selected % COLUMNS,
    '--prize-x': `${active?.x ?? 0}%`,
    '--prize-y': `${active?.y ?? 0}%`,
    '--prize-width': `${active?.width ?? 0}%`,
    '--prize-color': capsuleColors[(active?.index ?? 0) % capsuleColors.length],
    '--cycle': `${DROP_DURATION}ms`,
  } as CSSProperties;

  function drop(index: number) {
    const word = words[index];
    const bounds = glass.current?.getBoundingClientRect();
    const capsule = capsules.current[index]?.getBoundingClientRect();
    if (e.busy || !word || collected.includes(word.id) || !bounds?.width || !bounds.height || !capsule) return;
    const correct = matches.some(match=>match.id===word.id);
    const done = correct;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 650 : DROP_DURATION;
    if (!e.judge(correct,r.picture?'Which word matches the picture?':r.word.meaning,r.picture?word.word:`${word.word} · ${r.word.meaning}`,{complete:done,duration})) return;
    setSelected(index);
    setPick({
      index,fromColumn:selected % COLUMNS,correct,
      x: (capsule.left+capsule.width/2-bounds.left)/bounds.width*100,
      y: (capsule.top+capsule.height/2-bounds.top)/bounds.height*100,
      width: capsule.width/bounds.width*100,
    });
    if (correct) setCollected(old=>[...old,word.id]);
  }

  function select(index: number) {
    if (e.busy) return;
    setSelected(index);
    e.sound('move');
  }

  function move(delta: number) {
    select((selected+delta+words.length)%words.length);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target!==event.currentTarget) return;
    const control = controls.find(control=>control.key===event.key);
    if (control) {
      event.preventDefault();
      move(control.delta);
    } else if (event.key===' ' || event.key==='Enter') {
      event.preventDefault();
      drop(selected);
    }
  }

  return <>
    <div className="ad-prompt">
      {r.picture?<img data-picture-word src={r.picture.imageUrl} alt="그림에 맞는 단어를 뽑으세요"/>:<div className="claw-meaning-prompt"><strong>{r.word.meaning}</strong><small>뜻에 맞는 영어 단어를 뽑으세요.</small></div>}
      <span>{e.index + 1} / {e.total}</span>
    </div>
    <div className="claw-cabinet" data-pick={active ? active.correct?'catch':'miss':'idle'} style={style}>
      <div className="claw-marquee" aria-hidden="true">
        <i aria-hidden="true"/><strong>WORD CLAW</strong><i aria-hidden="true"/>
      </div>
      <div ref={glass} className="claw-glass" tabIndex={0} aria-label="집게 조종: 방향키로 이동하고 스페이스로 집게를 내려요." onKeyDown={onKeyDown}>
        <div className="claw-rail" aria-hidden="true"/>
        <Grabber />
        <div className="claw-prizes">
          {words.map((word,index)=><button type="button" key={word.id}
            ref={node=>{capsules.current[index]=node;}} data-word={word.word}
            className={`claw-capsule ${collected.includes(word.id)||active?.index===index?'claw-capsule-hidden':''}`}
            style={{'--prize-color':capsuleColors[index%capsuleColors.length]} as CSSProperties}
            aria-pressed={selected===index} disabled={e.busy||collected.includes(word.id)}
            onClick={()=>c.simpleClaw?drop(index):select(index)}>{word.word}</button>)}
        </div>
        <div className="claw-chute" aria-hidden="true"/>
        {active&&<div className="claw-carried claw-capsule" aria-hidden="true">{words[active.index].word}</div>}
      </div>
      <div className="claw-console">
        <div className="claw-direction" role="group" aria-label="집게 이동">
          {controls.map(control=><button type="button" key={control.key} disabled={e.busy} aria-label={control.label}
            onClick={()=>move(control.delta)}>{control.icon}</button>)}
        </div>
        <button type="button" className="claw-drop" disabled={e.busy||complete||collected.includes(words[selected]?.id)} onClick={()=>drop(selected)}>집게 내리기</button>
      </div>
      <div className="claw-outlet" aria-live="polite">
        <strong>획득함</strong>
        <span>{collectedNow.length ? words.filter(word=>collectedNow.includes(word.id)).map(word=>word.word).join(' · ') : r.picture?'그림에 맞는 단어를 뽑아요.':'뜻에 맞는 영어 단어를 뽑아요.'}</span>
      </div>
    </div>
    <p className="ad-control-help">{c.simpleClaw?'단어를 누르면 집게가 바로 내려가요.':'단어를 누르거나 방향키로 집게를 옮긴 뒤, 집게 내리기를 누르세요.'}</p>
  </>;
}
