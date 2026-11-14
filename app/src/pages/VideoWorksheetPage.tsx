import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVideoClips, type VideoClip } from '../lib/videoClips';
import { loadWordBank } from '../lib/wordBankCache';
import { animationCrossword, animationPrintActivities, type PaperItem } from '../lib/animationPrint';
import { chunk, makeRng, shuffled } from '../lib/worksheetGenerators';
import type { WordBankEntry } from '../lib/types';
import TracingRow from '../components/worksheets/TracingRow';
import '../styles/ready-class-workbook.css';
import '../styles/video-worksheet.css';

type Row = PaperItem & { group: string; groupTitle: string; type: string; title: string; instruction: string; number: number; matching?: PaperItem[]; bank?: string[] };
const defaults = ['study','questionChoice','grammarPractice'];
const minimumFive = new Set(['scene','questionChoice','trueFalse','questionHint','questionFull','infer','grammarPractice','substitute','create','wordContext','readCircle']);
const matchTypes = ['pictureMatch','meaningMatch'];
const printOptions = {letters:1,bank:true,chunks:true,pictureClues:false,choiceCount:3};

function paginate(rows: Row[], teacher: boolean) {
  const pages: Row[][] = [];
  let page: Row[] = [];
  let height = 0;
  for (const row of rows) {
    const text = teacher ? [row.answer ?? '', row.cue ?? ''] : [row.prompt ?? '',row.trace ?? '',row.definition??'',row.exampleSentence??'',row.situation??'',...(row.choices??[])];
    const textHeight = text.flatMap(line=>line.split('\n')).reduce((sum,line)=>sum+(line?8*Math.ceil(line.length/59):0),0);
    const matchHeight = (row.matching?.length??0) * (teacher?10:row.type==='pictureMatch'?31:17);
    const puzzleHeight = row.puzzle ? row.puzzle.grid.length * 7 + row.puzzle.entries.length * 7 + 8 : 0;
    const cost = 7 + textHeight + matchHeight + puzzleHeight + (teacher?0:
      (row.type==='wordTrace'?30:row.type==='study'?10:row.type==='letters'?14:(row.lines??0)*10) +
      (row.pictures?.length?30:0) + (row.bank?.length?12:0));
    const heading = 22 + (!teacher && row.context ? 8 + row.context.reduce((sum,line)=>sum+8*Math.ceil(line.length/59),0) : 0);
    if (page.length && (page[0].type!==row.type || height+cost > (pages.at(-1)?.[0].type===row.type?242:216))) {
      pages.push(page); page=[]; height=0;
    }
    height += cost+(page.length ? 0 : heading);
    page.push(row);
  }
  if (page.length) pages.push(page);
  return pages;
}

function Matching({items,pictures,teacher,start}:{items:PaperItem[];pictures:boolean;teacher:boolean;start:number}) {
  const mixed = shuffled(items,makeRng(31));
  const right=mixed.every((item,index)=>item.id===items[index].id)?[...items.slice(1),items[0]]:mixed;
  if (teacher) return <ol start={start} className="animation-match-key">{items.map(item=><li key={item.id}>{item.label} → {String.fromCharCode(65+right.indexOf(item))}{!pictures&&' · '+item.answer}</li>)}</ol>;
  return <div className="animation-match-grid">
    <div>{items.map((item,index)=><div key={item.id}>{start+index}. {item.label}<span className="animation-match-dot" aria-hidden="true"/></div>)}</div>
    <div>{right.map((item,index)=><div key={item.id}><span className="animation-match-dot" aria-hidden="true"/>{String.fromCharCode(65+index)}. {pictures?<div><img src={item.image} alt=""/><small>{item.meaning}</small></div>:item.answer}</div>)}</div>
  </div>;
}

function Puzzle({row,teacher}:{row:Row;teacher:boolean}) {
  const puzzle=row.puzzle!;
  const starts = new Map(puzzle.entries.map(entry=>[entry.row+','+entry.col,entry.number]));
  return <>
    <div className="animation-crossword" style={{gridTemplateColumns:'repeat('+puzzle.grid[0].length+', 7mm)'}}>
      {puzzle.grid.flatMap((line,r)=>line.map((cell,c)=><div key={r+','+c} data-cell={!!cell}>
        {starts.has(r+','+c)&&<small>{starts.get(r+','+c)}</small>}{teacher&&cell}
      </div>))}
    </div>
    <div className="animation-crossword-clues">{(['across','down'] as const).map(dir=><div key={dir}><b>{dir==='across'?'Across':'Down'}</b>{puzzle.entries.filter(entry=>entry.dir===dir).map(entry=><p key={entry.word.id}>{entry.number}. {entry.word.meaning}{teacher?' — '+entry.word.word:entry.word.imageUrl&&<img src={entry.word.imageUrl} alt=""/>}</p>)}</div>)}</div>
  </>;
}

function Worksheet({ clip }: { clip: VideoClip }) {
  const {t, i18n} = useTranslation();
  const en = i18n.resolvedLanguage?.startsWith('en');
  const [bank,setBank] = useState<WordBankEntry[]>([]);
  const [enabled,setEnabled] = useState(new Set(defaults));
  const [options,setOptions] = useState(printOptions);
  const [teacher,setTeacher] = useState(false);
  const [fontReady,setFontReady] = useState(false);
  useEffect(() => {
    let live = true;
    void loadWordBank().then(entries=>{if(live)setBank(entries);});
    void Promise.all([document.fonts.load('400 15pt "Atkinson Hyperlegible Next"'),document.fonts.load('700 24pt "Atkinson Hyperlegible Next"'),document.fonts.ready]).catch(()=>{}).then(()=>{if(live)setFontReady(true);});
    return () => { live = false; };
  }, []);
  const groups=useMemo(()=>animationPrintActivities(clip,bank,options),[clip,bank,options]);
  const pictureSelected=groups[0].types.find(type=>type.id==='pictureMatch')!.items;
  const pictureMissing=pictureSelected.filter(item=>!item.image);
  const crosswordType=groups[0].types.find(type=>type.id==='crossword')!;
  const crosswordSelected=crosswordType.items;
  const {puzzle,included}=useMemo(()=>animationCrossword(crosswordSelected),[crosswordSelected]);
  const crosswordMissing=crosswordSelected.filter(item=>!included.has(item.id));

  const available = (type: (typeof groups)[number]['types'][number]) => type.items.length >= (minimumFive.has(type.id) ? 5 : 1) && (type.id !== 'pictureMatch' || pictureSelected.some(item=>item.image)) && (type.id !== 'crossword' || included.size >= 2);
  const missing = groups.flatMap(group=>group.types.filter(type=>!available(type)));
  const rows = groups.flatMap(group=>group.types.flatMap<Row>(type=>{
    if (!enabled.has(type.id) || !available(type)) return [];
    let items=type.items;
    const base={group:group.id,groupTitle:group.en,type:type.id,title:type.title,instruction:type.instruction};
    if (type.id==='pictureMatch') items=items.filter(item=>item.image);
    if (matchTypes.includes(type.id)) return chunk(items,type.id==='pictureMatch'?5:7).map((matching,index)=>({...base,id:String(index),label:type.title,number:index*(type.id==='pictureMatch'?5:7)+1,matching}));
    if (type.id==='crossword') return included.size?[{...base,id:'puzzle',label:type.title,number:1,puzzle,bank:options.bank?shuffled(puzzle.entries.map(entry=>entry.word.word),makeRng(67)):undefined}]:[];
    return items.map((item,index)=>({...base,...item,number:index+1,
      ...(type.id==='fromMeaning'&&options.bank&&index===0?{bank:shuffled(items.map(word=>word.answer!),makeRng(67))}:{}),
    }));
  }));
  const pages = [
    ...paginate(rows,false).map(content => ({content,teacher:false})),
    ...(teacher ? paginate(rows.filter(row=>row.type!=='study'),true).map(content => ({content,teacher:true})) : []),
  ];
  const toggleType = (id:string,on:boolean) => setEnabled(current=>{const next=new Set(current);if(on)next.add(id);else next.delete(id);return next;});

  if (!groups.some(group=>group.types.some(type=>type.items.length))) return <p role="alert">{t('readyMedia.noWorksheet')}</p>;
  return <section className="rc-workbook animation-worksheet">
    <div className="rc-controls no-print">
      <Link to="/videos">{t('readyMedia.back')}</Link>
      <h1 className="flex-1 text-xl font-bold">{clip.title}</h1>
      <button type="button" data-print disabled={!fontReady || !pages.length} onClick={() => window.print()}>{en?'Print':'인쇄하기'}</button>
    </div>
    <div className="animation-worksheet-layout">
      <aside className="no-print">
        <h2>{en?'Choose activities to print':'인쇄할 활동 선택'}</h2>
        {groups.filter(group=>group.types.some(available)).map(group=><details key={group.id} open={group.id==='words'}>
          <summary><strong>{en?group.en:group.title}</strong></summary>
          {group.types.filter(available).map(type=>{ return <section key={type.id} data-print-activity={type.id}>
              <label className="animation-group-toggle"><input type="checkbox" checked={enabled.has(type.id)}
                onChange={event=>toggleType(type.id,event.target.checked)}/> {en?type.title:type.label}</label>
              {type.id==="pictureMatch"&&pictureMissing.length>0&&<p className="animation-activity-note">그림 없는 단어 · {pictureMissing.map(item=>item.label).join(", ")}</p>}
              {type.id==='crossword'&&enabled.has(type.id)&&<p className="animation-activity-note">{en?`Used ${included.size} of ${crosswordSelected.length} words`:`선택한 ${crosswordSelected.length}개 중 ${included.size}개 사용`}{crosswordMissing.length>0&&' · '+crosswordMissing.map(item=>item.label).join(', ')}{!included.size&&' · 교차할 단어를 다시 고르거나 단어 스크램블을 선택하세요.'}</p>}
            </section>;
          })}
        </details>)}
        {missing.length>0&&<details><summary>자료 준비 현황</summary><ul>{missing.map(type=><li key={type.id}>{type.label} · {minimumFive.has(type.id)?type.items.length+'/5문항':type.id==='crossword'?'서로 교차할 낱말이 2개 이상 필요해요.':type.reason}</li>)}</ul></details>}
        <details><summary><strong>{en?'Print options':'인쇄 옵션'}</strong></summary>
          <label className="animation-group-toggle">내용 질문 보기 수 <select value={options.choiceCount} onChange={event=>setOptions({...options,choiceCount:Number(event.target.value)})}><option>3</option><option>2</option></select></label>
          <label className="animation-group-toggle">{en?'Missing letters':'비울 글자 수'} <select value={options.letters} onChange={event=>setOptions({...options,letters:Number(event.target.value)})}><option>1</option><option>2</option><option>3</option></select></label>
          <label className="animation-group-toggle"><input type="checkbox" checked={options.bank} onChange={event=>setOptions({...options,bank:event.target.checked})}/> {en?'Include word banks':'단어 상자 넣기'}</label>
          <label className="animation-group-toggle"><input type="checkbox" checked={options.chunks} onChange={event=>setOptions({...options,chunks:event.target.checked})}/> {en?'Group sentence chunks':'문장 배열에 어구 묶기'}</label>
          <label className="animation-group-toggle"><input type="checkbox" checked={options.pictureClues} onChange={event=>setOptions({...options,pictureClues:event.target.checked})}/> {en?'Picture clues for word puzzles':'낱말 퍼즐에 그림 힌트 넣기'}</label>
        </details>
        <label className="animation-group-toggle"><input type="checkbox" checked={teacher} onChange={event=>setTeacher(event.target.checked)}/> {en?'Teacher notes and answers':'교사용 설명·정답'}</label>
      </aside>
      <div className="min-w-0">
        <h2 className="no-print mb-2 font-bold">{en?'A4 print preview':'A4 인쇄 미리보기'} · {pages.length}{en?' pages':'쪽'}</h2>
        {!pages.length&&<p className="no-print">{en?'Choose an activity and at least one item.':'인쇄할 활동을 선택하세요.'}</p>}
        <div className="rc-preview">{pages.map((page,index) => <article className="rc-sheet animation-sheet" key={index} data-teacher={page.teacher}>
          {(index === 0 || page.teacher!==pages[index-1]?.teacher || page.content[0].type!==pages[index-1]?.content[0].type) && <>
            <header className="animation-workbook-title"><h1 lang="en">{clip.title}</h1><strong>{page.content[0].groupTitle}</strong></header>
            {page.teacher ? <h2>{en?'Teacher notes and answers':'교사용 설명·정답'}</h2> : <div className="rc-name">Name <span /> Date <span /></div>}
          </>}
          {page.content.map((row,i)=><section key={row.type+':'+row.id} lang="en" className="animation-task">
            {i===0&&<><h2>{row.title}</h2>{!page.teacher&&<><p className="animation-instruction">{row.instruction}</p>{row.context&&<div className="animation-pattern-context">{row.context.map(line=><p key={line}>{line}</p>)}</div>}</>}</>}
            <div className="animation-print-row">
              {row.bank&&!page.teacher&&<p className="animation-word-bank">Word Bank · {row.bank.join('  ·  ')}</p>}
              {row.matching?<Matching items={row.matching} pictures={row.type==='pictureMatch'} teacher={page.teacher} start={row.number}/>:row.puzzle?<Puzzle row={row} teacher={page.teacher}/>:page.teacher?
                <p className="animation-answer">{row.number}. {row.example?'Example: ':''}{row.answer||'Answers may vary.'}{row.cue&&' · '+row.cue}{row.example&&' · Accept other suitable answers.'}</p>:
                <>
                  {row.type==='study'?<div className="animation-study-card"><div>{row.number}. <strong>{row.label}</strong><small lang="ko">{row.meaning}</small></div><div>{row.definition&&<p>{row.definition}</p>}{row.exampleSentence&&<p>{row.exampleSentence}</p>}</div></div>:
                  row.type==='letters'?<div className="animation-missing"><p>{row.number}. {row.prompt}</p><span lang="ko">{row.meaning}</span></div>:
                  row.type==='wordTrace'?<div className="animation-word-trace"><div>{row.number}. <strong>{row.label}</strong>{row.image&&<img src={row.image} alt=""/>}</div><div><TracingRow word={row.label} trace last={false} gapMm={2} rowMm={10} emMm={Math.min(10,110/row.label.length)}/><TracingRow word="" trace={false} last rowMm={10}/></div></div>:
                  row.situation?<><p className="animation-pattern-situation">{row.number}. {row.situation}</p><p>{row.prompt}</p></>:<p>{row.number}. {row.prompt}</p>}
                  {row.choices&&<ol className="animation-choices">{row.choices.map((choice,i)=><li key={choice}>{String.fromCharCode(65+i)}. {choice}</li>)}</ol>}
                  {row.pictures&&<div className="animation-picture-choices">{row.pictures.map((src,j)=><div key={src+':'+j}>{String.fromCharCode(65+j)}. <img src={src} alt=""/></div>)}</div>}
                  {row.trace&&row.type!=='wordTrace'&&<p className="animation-trace">{row.trace}</p>}
                  {row.type!=='wordTrace'&&Array.from({length:row.lines??0},(_,line)=><span className="animation-write-line" key={line}/>)}
                </>}
            </div>
          </section>)}
          <footer><strong>ClassBank</strong><span>{index+1} / {pages.length}</span></footer>
        </article>)}</div>
      </div>
    </div>
  </section>;
}
export default function VideoWorksheetPage() {
  const {t} = useTranslation();
  const [params] = useSearchParams();
  const {clips,error} = useVideoClips();
  const clip = clips?.find(item => item.id === params.get('clip') && !item.pack?.phonicsSong);
  if (error) return <p role="alert">{t('readyMedia.noWorksheet')}</p>;
  if (!clips) return <p>{t('common.loading')}</p>;
  return clip ? <Worksheet key={clip.id} clip={clip} /> : <p role="alert">{t('readyMedia.noWorksheet')}</p>;
}
