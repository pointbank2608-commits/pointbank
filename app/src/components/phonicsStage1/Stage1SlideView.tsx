import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { stage1Entry, stage1Sentence, type Stage1Slide, type Stage1Unit } from '../../data/phonicsStage1';
import { Stage1Lines, Stage1Picture, Stage1Scene, Stage1Speaker, Stage1Word } from './Stage1Art';

export default function Stage1SlideView({unit,slide,position,total}:{unit:Stage1Unit;slide:Stage1Slide;position:number;total:number}) {
  const {t}=useTranslation();const [selected,setSelected]=useState('');
  const words=slide.wordIds.map(id=>stage1Entry(unit,id));
  const groups=slide.letterUnitIds?.map(id=>unit.groups.find(g=>g.id===id)!)??unit.groups;
  const answer=slide.phase==='answer';
  const wordTiles=(labels=true)=> <div className="s1-word-tiles">{words.map(e=><div key={e.wordId} className={'s1-word-tile '+(answer&&slide.answerIds?.includes(e.wordId!)?'s1-answer-ring':'')}><Stage1Picture entry={e}/>{labels&&<Stage1Word entry={e}/>}</div>)}</div>;
  const letters=(large=false)=><div className={'s1-letter-blocks '+(large?'s1-letter-large':'')}>{groups.map((g,i)=><div key={g.id} className={'s1-letter-block s1-tone-'+i}>{g.letter}{g.letter.toLowerCase()}</div>)}</div>;
  const writeRows=()=><div className="s1-write-slide">{words.map(e=><div className="s1-write-slide-row" key={e.wordId}><Stage1Picture entry={e}/><Stage1Word entry={e}/><Stage1Lines/></div>)}</div>;
  let body;
  switch(slide.kind){
    case 'cover':body=<><div className="s1-center-title">{slide.title}</div>{letters()}<div className="s1-mini-pictures">{wordTiles(false)}</div></>;break;
    case 'lesson':body=<><strong className="s1-center-title">{t('phonicsStage1.lesson',{n:slide.lesson})}</strong><p className="s1-subtitle">{slide.title}</p>{letters()}</>;break;
    case 'meet':body=letters(true);break;
    case 'air':case 'writeLetter':body=<div className="s1-air-rows">{groups.map((g,i)=><div key={g.id}><div className={'s1-letter-block s1-tone-'+i}>{g.letter}{g.letter.toLowerCase()}</div><Stage1Lines text={g.letter+'   '+g.letter.toLowerCase()} trace/></div>)}</div>;break;
    case 'matchLetters':case 'representativeMatch':body=<div className="s1-match-layout"><div>{unit.groups.map((g,i)=><div className={'s1-letter-block s1-tone-'+i} key={g.id}>{slide.kind==='matchLetters'?g.letter:g.letter+g.letter.toLowerCase()}</div>)}</div><div>{slide.kind==='matchLetters'?[...groups.slice(-1),...groups.slice(0,-1)].map((g,i)=><div className={'s1-letter-block s1-tone-'+(i+1)} key={g.id}>{g.letter.toLowerCase()}</div>):words.map(e=><div className="s1-match-picture" key={e.wordId}><Stage1Picture entry={e}/></div>)}</div></div>;break;
    case 'introduce':body=<div className="s1-introduce">{letters(true)}<div><Stage1Picture entry={words[0]}/><Stage1Word entry={words[0]}/><Stage1Speaker entry={words[0]}/></div></div>;break;
    case 'word':body=<div className="s1-single-picture"><Stage1Picture entry={words[0]}/><Stage1Word entry={words[0]}/><Stage1Speaker entry={words[0]}/></div>;break;
    case 'group':body=<div className="s1-group-intro">{letters()}{wordTiles()}</div>;break;
    case 'quiz':body=<div className="s1-single-picture" data-question-pair={slide.pairId}><Stage1Picture entry={words[0]} shadow={slide.lesson===2&&!answer}/>{answer&&<Stage1Word entry={words[0]}/>}</div>;break;
    case 'find':body=<><Stage1Speaker entry={stage1Entry(unit,slide.answerIds![0])}/>{wordTiles(false)}{answer&&<Stage1Word entry={stage1Entry(unit,slide.answerIds![0])}/>}</>;break;
    case 'matchWords':body=<div className="s1-match-words">{words.map(e=><div className="s1-match-word-row" key={e.wordId}><Stage1Word entry={e}/><span>{answer?'→':'○'}</span><Stage1Picture entry={answer?e:words[(words.indexOf(e)+1)%words.length]}/></div>)}</div>;break;
    case 'firstLetters':body=<><Stage1Speaker entry={words[0]}/><div className="s1-word-tiles">{words.map(e=><div className="s1-word-tile" key={e.wordId}><Stage1Picture entry={e}/><Stage1Word entry={e} blank={!answer}/></div>)}</div></>;break;
    case 'sort':body=<>{wordTiles(false)}<div className="s1-word-tiles">{unit.groups.map((g,i)=><div className={'s1-sort-slot s1-tone-'+i} key={g.id}><strong>{g.letter}{g.letter.toLowerCase()}</strong>{answer&&<Stage1Picture entry={words.find(e=>g.entries.some(w=>w.wordId===e.wordId))!}/>}</div>)}</div></>;break;
    case 'lookWrite':body=writeRows();break;
    case 'missingIntro':case 'extraIntro':case 'level':case 'readIntro':body=<><strong className="s1-center-title">{slide.title}</strong><p className="s1-subtitle">{slide.kind==='readIntro'?'Sight Words & Sentences':slide.kind==='level'?'Find two.':'Look. Remember. Say.'}</p>{wordTiles(false)}</>;break;
    case 'missing':{
      const round=unit.rounds.find(r=>r.id===slide.roundId)!;
      body=<div className="s1-memory-grid" data-round={round.id} data-phase={slide.phase}>{slide.wordIds.map(id=><div key={id} data-memory-word={id} className={'s1-memory-card '+(answer&&round.missing.includes(id)?'s1-answer-ring':'')}>{slide.phase==='question'&&round.missing.includes(id)?<span className="s1-question-mark">?</span>:<Stage1Picture entry={stage1Entry(unit,id)}/>}</div>)}</div>;break;
    }
    case 'sight':body=<div className="s1-group-intro"><div className="s1-letter-block s1-sight-word">a</div><div className="s1-word-tiles">{words.map(e=><div className="s1-word-tile" key={e.wordId}><Stage1Picture entry={e}/><p>a <Stage1Word entry={e}/></p></div>)}</div></div>;break;
    case 'findA':body=<div className="s1-word-tiles">{words.map(e=><div className="s1-word-tile" key={e.wordId}><Stage1Picture entry={e}/><p><span className={answer?'s1-sight-ring':''}>a</span> <Stage1Word entry={e}/></p></div>)}</div>;break;
    case 'scene':case 'read':case 'together':case 'yourTurn':body=<div className="s1-reading"><Stage1Scene unit={unit} arrow={slide.readerWordId} onChoose={slide.kind==='yourTurn'?setSelected:undefined}/>{slide.kind==='read'&&<div className="s1-sentence">{stage1Sentence(unit,slide.readerWordId!)}<Stage1Speaker text={stage1Sentence(unit,slide.readerWordId!)}/></div>}{slide.kind==='together'&&<div className="s1-read-all">{unit.reader!.wordIds.map(id=><div key={id}>{stage1Sentence(unit,id)}</div>)}</div>}{slide.kind==='yourTurn'&&<p className="s1-subtitle" data-your-turn>{selected?'I see a _____.':'Choose one. Say your sentence.'}</p>}</div>;break;
    case 'readChoose':body=<><p className="s1-sentence">{stage1Sentence(unit,slide.readerWordId!)}</p>{wordTiles(false)}</>;break;
    case 'complete':body=<><div className="s1-single-picture"><Stage1Picture entry={words[0]}/></div><p className="s1-sentence">I see a {answer?<Stage1Word entry={words[0]}/>:<span className="s1-answer-line"/>}.</p>{!answer&&<p className="s1-word-bank">{unit.reader!.wordIds.slice(0,3).map(id=>stage1Entry(unit,id).word).join(' · ')}</p>}</>;break;
    case 'finish':case 'speaking':body=<>{wordTiles(slide.kind==='finish')}{slide.kind==='speaking'&&<p className="s1-sentence">I see a _____.</p>}<p className="s1-subtitle">Great work!</p></>;break;
  }
  return <article className="s1-slide" data-stage1-slide={slide.id} data-slide-kind={slide.kind}>
    <header className="s1-slide-brand"><strong>ClassBank</strong><span>{unit.number?'UNIT '+unit.number+' · ':''}{unit.groups.map(g=>g.letter+g.letter.toLowerCase()).join(' ')}</span></header>
    <h2 className="s1-slide-title">{slide.title}</h2>
    <div className="s1-slide-body">{slide.questionNumber&&<small className="s1-quiz-label">Quiz {slide.questionNumber}</small>}{body}</div>
    <footer className="s1-slide-footer"><span>{slide.optional?t('phonicsStage1.extra'):t('phonicsStage1.lesson',{n:slide.lesson})}</span><progress value={position} max={total}/><span>{position} / {total}</span></footer>
  </article>;
}
