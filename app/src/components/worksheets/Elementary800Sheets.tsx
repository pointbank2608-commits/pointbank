import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { chunkWorkbook, type VocabularyBooklet, type WorkbookWord } from '../../lib/elementary800Workbook';

function WordPicture({word}:{word:WorkbookWord}) {
 const {t}=useTranslation();
 return word.image_url ? <img src={word.image_url} alt="" onError={e=>{e.currentTarget.hidden=true;e.currentTarget.parentElement?.setAttribute('data-image-failed','true');}} /> : <span className="e800-clue"><small>{t('elementary800.meaningClue')}</small>{word.meaning}</span>;
}
export default function Elementary800Sheets({books,kind,copies,cover,guide,mono}:{books:VocabularyBooklet[];kind:string;copies:number;cover:boolean;guide:boolean;mono:boolean}) {
 const {t}=useTranslation();let page=0;
 return <div className={`e800-pages ${mono?'e800-mono':''}`}>
 {books.map(book=>{
 const title=`${t(`elementary800.pos.${book.pos}`)} · Level ${book.level}`;
 const tone=['#168a45','#bd860b','#d86813','#db384b','#187f81','#8551b6','#2864a7'][(book.level-1)%7];
 const sheet=(key:string,subtitle:string,body:ReactNode)=> <article className="e800-sheet" key={`${book.id}-${key}`} style={{'--e800-tone':tone} as CSSProperties} data-booklet={book.id} data-sheet-kind={key.split('-')[0]}>
 <header><div><strong>{title}</strong><p>{subtitle}</p></div><span>{t('elementary800.name')} __________________</span></header>{body}<footer>{t('elementary800.brand')} · {t('elementary800.title')} <span>{++page}</span></footer></article>;
 const sheets:ReactNode[]=[];
 if(cover)sheets.push(sheet('cover',t('elementary800.coverTag'),<div className="e800-cover"><span>Read · Speak · Write</span><h1>{t('elementary800.title')}</h1><h2>{title}</h2><img src="/worksheet-cute/ollie-read.webp" alt=""/><p>{t('elementary800.count',{count:book.entries.length})}</p><div>{book.entries.map(w=>w.word).join(' · ')}</div></div>));
 if(guide)sheets.push(sheet('guide',t('elementary800.guideTitle'),<div className="e800-guide"><h2>Go Fish!</h2><p>{t('elementary800.guideText')}</p><blockquote>{t('elementary800.dialogue')}</blockquote><h2>Matching Pairs</h2><p>{t('elementary800.pairText')}</p><p className="e800-guide-note">{t('elementary800.sequence')}</p></div>));
 if(kind!=='writing')for(let copy=0;copy<copies;copy++)chunkWorkbook(book.entries,16).forEach((words,index)=>sheets.push(sheet(`cards-${copy}-${index}`,`${t('elementary800.wordsTitle')} · ${copy+1}/${copies}`,<div className="e800-cards">{words.map(w=><div className="e800-card" key={w.id}><span className="e800-card-brand">CLASSBANK</span><div className="e800-picture"><WordPicture word={w}/></div><strong>{w.word}</strong><p className="e800-meaning">{w.meaning}</p><p className="e800-example">{w.example_sentence||t('elementary800.customSentence')}</p></div>)}</div>)));
 if(kind!=='cards')chunkWorkbook(book.entries,4).forEach((words,index)=>sheets.push(sheet(`writing-${index}`,t('elementary800.writeTitle'),<div className="e800-writing">{words.map((w,n)=><div className="e800-write-row" key={w.id}><div className="e800-write-card"><small>{index*4+n+1}.</small><div className="e800-picture"><WordPicture word={w}/></div><strong>{w.word}</strong><p>{w.meaning}</p></div><div className="e800-lines"><div className="e800-handwriting"><strong>{w.word}</strong></div><div className="e800-handwriting"><span className={!w.example_sentence?'e800-prompt':''}>{w.example_sentence||t('elementary800.customSentence')}</span></div><div className="e800-handwriting"/><div className="e800-handwriting"/></div></div>)}</div>)));
 return sheets;
 })}
 </div>;
}
