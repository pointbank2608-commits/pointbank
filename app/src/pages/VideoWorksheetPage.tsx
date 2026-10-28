import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useVideoClips} from '../lib/videoClips';
import {parseShadowText} from '../lib/shadowLines';
import '../styles/ready-class-workbook.css';
export default function VideoWorksheetPage(){
 const {t}=useTranslation();const [params]=useSearchParams();const {clips,error}=useVideoClips();const clip=clips?.find(c=>c.id===params.get('clip')&&!c.pack?.phonicsSong);const [teacher,setTeacher]=useState(false),[fonts,setFonts]=useState(false);
 useEffect(()=>{let live=true;void document.fonts.ready.then(()=>{if(live)setFonts(true);});return()=>{live=false;};},[]);
 const lines=clip?parseShadowText(clip.script):[];const questions=clip?.pack.questions??[];
 const tasks=[...(clip?.pack.words??[]).map(w=>({q:w.word,a:w.meaning})),...questions.map(q=>({q:q.q,a:q.a})),...lines.map(l=>({q:l.en.replace(/\*\*/g,''),a:l.ko??''}))];
 if(!clips)return <p>{t('common.loading')}</p>;if(!clip||error||!tasks.length)return <p role="alert">{t('readyMedia.noWorksheet')}</p>;
 return <section className="rc-workbook"><div className="rc-controls no-print"><Link to="/videos">{t('readyMedia.back')}</Link><label><input type="checkbox" checked={teacher} onChange={e=>setTeacher(e.target.checked)}/> {t('readyMedia.teacher')}</label><button data-print disabled={!fonts} onClick={()=>window.print()}>{t('readyMedia.printSheet')}</button></div><div className="rc-preview">{Array.from({length:Math.ceil(tasks.length/8)},(_,i)=><article className="rc-sheet" key={i}><header><strong>ClassBank</strong><span>{clip.channel}</span></header><h1 style={{fontSize:'7mm'}}>{clip.title}</h1><div className="rc-name">Name <span/> Date <span/></div><h2>{t('readyMedia.words')} · {t('readyMedia.questions')} · {t('readyMedia.shadow')}</h2>{tasks.slice(i*8,i*8+8).map((task,j)=><section key={j} style={{flex:1,display:'grid',gap:'2mm',alignContent:'center'}}><p>{i*8+j+1}. {task.q}</p>{teacher?<p>{task.a}</p>:<div className="rc-write-line"/>}</section>)}<footer><strong>Spring English Lab</strong><span>{i+1} · {teacher?t('readyMedia.teacher'):t('readyMedia.student')}</span></footer></article>)}</div></section>;
}
