import { useTranslation } from 'react-i18next';
import { stage1Entry, stage1Sentence, type Stage1Page, type Stage1Unit } from '../../data/phonicsStage1';
import { Stage1Lines, Stage1Picture, Stage1Scene, Stage1Word } from './Stage1Art';

import { stage1WorkbookOrder as turn, stage1TargetLetters as target, stage1ListeningWords, stage1SoundWriteWords, stage1PageAnswers } from '../../data/phonicsStage1Workbook';

function PageSection({label,title,children}:{label:string;title:string;children:React.ReactNode}){return <section className="s1-book-section"><h3><b>{label}</b>{title}</h3>{children}</section>;}
export function Stage1WorkbookPage({unit,page}:{unit:Stage1Unit;page:Stage1Page}) {
  const {t}=useTranslation();const n=unit.pages.findIndex(p=>p.id===page.id)+1;
  const entries=unit.groups.flatMap(g=>g.entries);
  const group=unit.groups.find(g=>g.id===page.groupId);
  const labels=[...new Set(entries.map(e=>target(unit,e.wordId!)))];
  for(const other of ['a','b','c'])if(labels.length<3&&!labels.includes(other))labels.push(other);
  const initial=entries.every(e=>e.targets?.length===1&&e.targets[0]===0);
  let body;
  switch(page.kind){
    case 'letters':body=<>
      <PageSection label="A" title="Match the big and small letters."><div className="s1-book-letter-match"><div>{unit.groups.map(g=><div key={g.id}>{g.letter}<span>○</span></div>)}</div><div>{turn(unit.groups,unit.groups.length-1).map(g=><div key={g.id}><span>○</span>{g.letter.toLowerCase()}</div>)}</div></div></PageSection>
      <PageSection label="B" title="Trace. Then write."><div className="s1-book-tracing">{unit.groups.map((g,i)=><div key={g.id}><b className={'s1-tone-'+i}>{g.letter}{g.letter.toLowerCase()}</b><Stage1Lines trace text={g.letter+g.letter.toLowerCase()}/><Stage1Lines/></div>)}</div></PageSection><p className="s1-book-note">Say each letter sound as you write.</p>
    </>;break;
    case 'sound':body=<>
      <PageSection label="A" title={initial?'Listen. Circle the first letter.':'Listen. Circle the target letters.'}><div className="s1-book-sound-choices">{stage1ListeningWords(unit).map((e,i)=><div key={e.id+'-'+i}><b>{i+1}</b>{turn(labels,Math.floor(i/2)%labels.length).map(c=><span key={c}>{c}</span>)}</div>)}</div></PageSection>
      <PageSection label="B" title={initial?'Look. Write the first letter.':'Look. Write the target letters.'}><div className="s1-book-small-cards">{stage1SoundWriteWords(unit).map((e,i)=><div key={e.wordId}><b>{i+7}</b><Stage1Picture entry={e}/><Stage1Word entry={e} blank/></div>)}</div></PageSection>
    </>;break;
    case 'match':body=<><p className="s1-book-instruction">Read the words. Match them to the pictures.</p>{unit.groups.map((g,i)=><section className="s1-book-match-group" key={g.id}><b className={'s1-tone-'+i}>{g.letter}{g.letter.toLowerCase()}</b><div className="s1-book-match-columns"><div>{turn(g.entries).map(e=><div key={e.wordId}><Stage1Word entry={e}/><span>○</span></div>)}</div><div>{g.entries.map(e=><div key={e.wordId}><span>○</span><Stage1Picture entry={e}/></div>)}</div></div></section>)}</>;break;
    case 'write':{
      const g=group!;const i=unit.groups.indexOf(g);
      body=<><p className="s1-book-instruction">Read. Trace. Write.</p><div className="s1-book-word-write">{g.entries.map(e=><div className="s1-book-write-row" key={e.wordId}><Stage1Picture entry={e}/><Stage1Word entry={e}/><div><small>Trace</small><Stage1Lines trace text={e.word}/></div><div><small>Write</small><Stage1Lines/></div></div>)}</div>
      {i===0?<PageSection label="B" title="Write the missing target letters."><div className="s1-book-small-cards">{turn(g.entries).map(e=><div key={e.wordId}><Stage1Word entry={e} blank/></div>)}</div></PageSection>
      :i===1?<PageSection label="B" title="Listen. Circle the picture."><div className="s1-book-choice-pictures">{g.entries.map((e,row)=><div key={e.wordId}><b>{row+1}</b>{turn(g.entries).map(pic=><Stage1Picture key={pic.wordId} entry={pic}/>)}</div>)}</div></PageSection>
      :<PageSection label="B" title="Look. Circle the word."><div className="s1-book-read-choices">{g.entries.map(e=><div key={e.wordId}><Stage1Picture entry={e}/>{g.entries.map(choice=><Stage1Word key={choice.wordId} entry={choice}/>)}</div>)}</div></PageSection>}
      </>;break;
    }
    case 'reader':body=<><p className="s1-book-instruction">Look. Point. Read with your teacher.</p><Stage1Scene unit={unit}/><div className="s1-book-reader-lines">{unit.reader!.wordIds.map(id=><p key={id}>I see a <Stage1Word entry={stage1Entry(unit,id)}/>.</p>)}</div><p className="s1-book-note">Find and circle <b>a</b> in each sentence.</p></>;break;
    case 'sentences':{
      const rw=unit.reader!.wordIds, questions=[rw[2],rw[3]];
      body=<><PageSection label="A" title="Read. Circle the picture."><div className="s1-book-sentence-choice">{questions.map((id,i)=><div key={id}><p>{i+1}. {stage1Sentence(unit,id)}</p><div>{[rw[i],id].map(w=><Stage1Picture key={w} entry={stage1Entry(unit,w)}/>)}</div></div>)}</div></PageSection>
      <PageSection label="B" title="Look. Complete the sentence."><div className="s1-book-complete">{rw.slice(0,2).map(id=><div key={id}><Stage1Picture entry={stage1Entry(unit,id)}/><p>I see a <span className="s1-answer-line"/>.</p></div>)}</div><div className="s1-book-word-bank">{rw.map(id=><Stage1Word key={id} entry={stage1Entry(unit,id)}/>)}</div></PageSection>
      <PageSection label="C" title="Choose a picture on page 7. Write and say."><p className="s1-book-final-sentence">I see a <span className="s1-answer-line"/>.</p><Stage1Lines/></PageSection></>;break;
    }
  }
  return <article className="s1-book-page print-board" data-stage1-page={page.id} data-audience="student">
    <header><div><b>ClassBank</b><b>{unit.number?'UNIT '+unit.number+' · ':''}{unit.groups.map(g=>g.letter+g.letter.toLowerCase()).join(' ')}</b></div><h2>{page.title}</h2></header>
    <div className="s1-book-name"><span>{t('phonicsStage1.name')}: ________________________</span><span>Lesson {page.lesson}</span></div>
    <div className="s1-book-page-body">{body}</div>
    <footer><span>ClassBank · {unit.number?'Unit '+unit.number:unit.groups[0].letter+unit.groups[0].letter.toLowerCase()}</span><span>{n} / {unit.pages.length}</span></footer>
  </article>;
}

export function Stage1TeacherGuide({unit}:{unit:Stage1Unit}) {
  const {t}=useTranslation();return <article className="s1-teacher-guide" data-audience="teacher"><h2>{t('phonicsStage1.teacher')} · {unit.number?'Unit '+unit.number:unit.groups[0].letter}</h2><p>{t('phonicsStage1.audioInfo')}</p>{!unit.reader&&<p>{t('phonicsStage1.pendingReader')}</p>}{unit.pages.map((page,i)=><section key={page.id}><h3>p.{i+1} · {page.title}</h3><p>{t('phonicsStage1.linkedSlides')}: {page.slideIds.map(id=>unit.slides.findIndex(s=>s.id===id)+1).join(', ')}</p><table><tbody>{stage1PageAnswers(unit,page).map((a,j)=><tr key={j}><td>{a.prompt}</td><td>{a.answer}</td></tr>)}</tbody></table></section>)}</article>;
}
