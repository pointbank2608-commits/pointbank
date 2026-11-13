import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVideoClips, type VideoClip } from '../lib/videoClips';
import { loadWordBank } from '../lib/wordBankCache';
import { animationCrossword, animationPrintActivities, type PaperItem } from '../lib/animationPrint';
import { chunk, makeRng, shuffled } from '../lib/worksheetGenerators';
import type { WordBankEntry } from '../lib/types';
import '../styles/ready-class-workbook.css';
import '../styles/video-worksheet.css';

type Row = PaperItem & { type: string; title: string; instruction: string; number: number; matching?: PaperItem[]; bank?: string[] };
const defaults = ['meaning','questionFull','sentenceTrace'];
const matchTypes = ['pictureMatch','meaningMatch'];
const printOptions = {letters:1,bank:true,chunks:true,pictureClues:false};

function paginate(rows: Row[], teacher: boolean) {
  const pages: Row[][] = [];
  let page: Row[] = [];
  let height = 0;
  for (const row of rows) {
    const text = teacher ? [row.answer ?? '', row.cue ?? ''] : [row.prompt ?? '',row.trace ?? ''];
    const textHeight = text.flatMap(line=>line.split('\n')).reduce((sum,line)=>sum+(line?8*Math.ceil(line.length/59):0),0);
    const matchHeight = (row.matching?.length??0) * (teacher?10:row.type==='pictureMatch'?24:17);
    const puzzleHeight = row.puzzle ? row.puzzle.grid.length * 7 + row.puzzle.entries.length * 7 + 8 : 0;
    const cost = 5 + textHeight + matchHeight + puzzleHeight + (teacher?0:(row.lines??0)*10 + (row.pictures?.length?30:0) + (row.bank?.length?12:0));
    const heading = page.at(-1)?.type === row.type ? 0 : 22;
    if (page.length && height+cost+heading > (pages.length?238:225)) {
      pages.push(page); page=[]; height=0;
    }
    height += cost+(page.at(-1)?.type===row.type?0:22);
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
    <div>{items.map((item,index)=><div key={item.id}>{start+index}. {item.label}<span aria-hidden>●</span></div>)}</div>
    <div>{right.map((item,index)=><div key={item.id}><span aria-hidden>●</span>{String.fromCharCode(65+index)}. {pictures?<img src={item.image} alt=""/>:item.answer}</div>)}</div>
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
  const [selections,setSelections] = useState<Record<string,Set<string>>>({});
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
  const selected = (type: string,items: PaperItem[]) => items.filter(item=>!selections[type]||selections[type].has(item.id));
  const pictureSelected=selected('pictureMatch',groups[0].types[0].items);
  const pictureMissing=pictureSelected.filter(item=>!item.image);
  const crosswordType=groups[0].types.find(type=>type.id==='crossword')!;
  const crosswordSelected=selected(crosswordType.id,crosswordType.items);
  const {puzzle,included}=useMemo(()=>animationCrossword(crosswordSelected),[crosswordSelected]);
  const crosswordMissing=crosswordSelected.filter(item=>!included.has(item.id));

  const rows = groups.flatMap(group=>group.types.flatMap<Row>(type=>{
    if (!enabled.has(type.id)) return [];
    let items=selected(type.id,type.items);
    const base={type:type.id,title:type.title,instruction:type.instruction};
    if (type.id==='pictureMatch') items=items.filter(item=>item.image);
    if (matchTypes.includes(type.id)) return chunk(items,type.id==='pictureMatch'?5:7).map((matching,index)=>({...base,id:String(index),label:type.title,number:index*(type.id==='pictureMatch'?5:7)+1,matching}));
    if (type.id==='crossword') return included.size?[{...base,id:'puzzle',label:type.title,number:1,puzzle,bank:options.bank?shuffled(puzzle.entries.map(entry=>entry.word.word),makeRng(67)):undefined}]:[];
    return items.map((item,index)=>({...base,...item,number:index+1,
      ...(type.id==='fromMeaning'&&options.bank&&index===0?{bank:shuffled(items.map(word=>word.answer!),makeRng(67))}:{}),
    }));
  }));
  const pages = [
    ...paginate(rows,false).map(content => ({content,teacher:false})),
    ...(teacher ? paginate(rows,true).map(content => ({content,teacher:true})) : []),
  ];
  const toggleType = (id:string,on:boolean) => setEnabled(current=>{const next=new Set(current);if(on)next.add(id);else next.delete(id);return next;});
  const changeSelection=(id:string,items:PaperItem[],itemId:string,on:boolean)=>{
    const next=new Set(selected(id,items).map(item=>item.id));
    if(on)next.add(itemId);else next.delete(itemId);
    setSelections(current=>({...current,[id]:next}));
    if(on)toggleType(id,true);
  };

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
        {groups.map(group=><details key={group.id} open={group.id==='words'}>
          <summary><strong>{en?group.en:group.title}</strong></summary>
          {group.types.map(type=>{
            const count=selected(type.id,type.items).length;
            const available=type.id==='pictureMatch'?type.items.some(item=>item.image):type.items.length>0;
            return <section key={type.id} data-print-activity={type.id}>
              <label className="animation-group-toggle"><input type="checkbox" checked={available&&enabled.has(type.id)} disabled={!available}
                onChange={event=>toggleType(type.id,event.target.checked)}/> {en?type.title:type.label}</label>
              {!available&&<p className="animation-activity-note">{en?'This video has no suitable material for this activity.':type.reason}</p>}
              {!!type.items.length&&<details>
                <summary>{count} / {type.items.length} {en?'selected':'선택'}</summary>
                <div className="animation-select-actions">
                  <button type="button" onClick={()=>{setSelections(current=>({...current,[type.id]:new Set(type.items.map(item=>item.id))}));if(available)toggleType(type.id,true);}}>{en?'Select all':'전체 선택'}</button>
                  <button type="button" onClick={()=>setSelections(current=>({...current,[type.id]:new Set()}))}>{en?'Clear':'선택 해제'}</button>
                </div>
                {type.items.map(item=><label className="animation-item-toggle" key={item.id}><input type="checkbox" checked={!selections[type.id]||selections[type.id].has(item.id)}
                  onChange={event=>changeSelection(type.id,type.items,item.id,event.target.checked)}/> <span lang="en">{item.label}</span></label>)}
              </details>}
              {type.id==='pictureMatch'&&pictureSelected.length>0&&<div className="animation-activity-note">
                <p>{en?'Pictures available':'그림 사용 가능'} · {pictureSelected.length-pictureMissing.length}/{pictureSelected.length}{en?'':'개'}</p>
                {pictureMissing.length>0&&<>
                  <p>{en?'Missing pictures':'그림 없는 단어'} · {pictureMissing.map(item=>item.label).join(', ')}</p>
                  <button type="button" className="underline" onClick={()=>{
                    const meanings=group.types.find(type=>type.id==='meaningMatch')!.items;
                    const ids=pictureMissing.filter(item=>meanings.some(meaning=>meaning.id===item.id)).map(item=>item.id);
                    setSelections(current=>({...current,meaningMatch:new Set([...(enabled.has('meaningMatch')?selected('meaningMatch',meanings).map(item=>item.id):[]),...ids])}));
                    toggleType('meaningMatch',true);
                  }}>{en?'Match meanings for words without pictures':'그림 없는 단어로 뜻 연결 추가'}</button>
                </>}
              </div>}
              {type.id==='crossword'&&enabled.has(type.id)&&crosswordMissing.length>0&&<p className="animation-activity-note">{en?`Used ${included.size} of ${count} words`:`선택한 ${count}개 중 ${included.size}개로 퍼즐을 만들었어요.`} {crosswordMissing.map(item=>item.label).join(', ')}</p>}
            </section>;
          })}
        </details>)}
        <details><summary><strong>{en?'Print options':'인쇄 옵션'}</strong></summary>
          <label className="animation-group-toggle">{en?'Missing letters':'비울 글자 수'} <select value={options.letters} onChange={event=>setOptions({...options,letters:Number(event.target.value)})}><option>1</option><option>2</option><option>3</option></select></label>
          <label className="animation-group-toggle"><input type="checkbox" checked={options.bank} onChange={event=>setOptions({...options,bank:event.target.checked})}/> {en?'Include word banks':'단어 상자 넣기'}</label>
          <label className="animation-group-toggle"><input type="checkbox" checked={options.chunks} onChange={event=>setOptions({...options,chunks:event.target.checked})}/> {en?'Group sentence chunks':'문장 배열에 어구 묶기'}</label>
          <label className="animation-group-toggle"><input type="checkbox" checked={options.pictureClues} onChange={event=>setOptions({...options,pictureClues:event.target.checked})}/> {en?'Picture clues for word puzzles':'낱말 퍼즐에 그림 힌트 넣기'}</label>
        </details>
        <label className="animation-group-toggle"><input type="checkbox" checked={teacher} onChange={event=>setTeacher(event.target.checked)}/> {en?'Teacher notes and answers':'교사용 설명·정답'}</label>
      </aside>
      <div className="min-w-0">
        <h2 className="no-print mb-2 font-bold">{en?'A4 print preview':'A4 인쇄 미리보기'} · {pages.length}{en?' pages':'쪽'}</h2>
        {!pages.length&&<p className="no-print">{en?'Choose an activity and at least one item.':'인쇄할 활동과 문항을 선택하세요.'}</p>}
        <div className="rc-preview">{pages.map((page,index) => <article className="rc-sheet animation-sheet" key={index} data-teacher={page.teacher}>
          {(index === 0 || (page.teacher && !pages[index-1]?.teacher)) && <>
            <h1 lang="en">{clip.title}</h1>
            {page.teacher ? <h2>{en?'Teacher notes and answers':'교사용 설명·정답'}</h2> : <div className="rc-name">Name <span /> Date <span /></div>}
          </>}
          {page.content.map((row,i)=><section key={row.type+':'+row.id} lang="en">
            {page.content[i-1]?.type!==row.type&&<><h2>{row.title}</h2>{!page.teacher&&<p className="animation-instruction">{row.instruction}</p>}</>}
            <div className="animation-print-row">
              {row.bank&&!page.teacher&&<p className="animation-word-bank">Word Bank · {row.bank.join('  ·  ')}</p>}
              {row.matching?<Matching items={row.matching} pictures={row.type==='pictureMatch'} teacher={page.teacher} start={row.number}/>:row.puzzle?<Puzzle row={row} teacher={page.teacher}/>:page.teacher?
                <p className="animation-answer">{row.number}. {row.example?'Example: ':''}{row.answer||'Answers may vary.'}{row.cue&&' · '+row.cue}{row.example&&' · Accept other suitable answers.'}</p>:
                <>
                  <p>{row.number}. {row.prompt}</p>
                  {row.pictures&&<div className="animation-picture-choices">{row.pictures.map((src,j)=><div key={src+':'+j}>{String.fromCharCode(65+j)}. <img src={src} alt=""/></div>)}</div>}
                  {row.trace&&<p className="animation-trace">{row.trace}</p>}
                  {Array.from({length:row.lines??0},(_,line)=><span className="animation-write-line" key={line}/>)}
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
