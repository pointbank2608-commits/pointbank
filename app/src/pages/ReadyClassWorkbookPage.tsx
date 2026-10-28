import {useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {courseUnits} from '../data/phonicsLessons';
import {curriculumEntries} from '../data/phonicsCurriculum';
import {readyClassPages} from '../data/readyClassWorkbook';
import {fetchPhonicsBank} from '../lib/api';
import {useWorkbookImageChecks} from '../lib/useWorkbookImageChecks';
import {ReadyClassPage,ReadyClassTeacherPage} from '../components/phonicsStage1/ReadyClassWorkbook';
export default function ReadyClassWorkbookPage(){
 const {t}=useTranslation();const [params]=useSearchParams();const [bank,setBank]=useState(()=>curriculumEntries(false));
 const [bankLoaded,setBankLoaded]=useState(false);
 useEffect(()=>{let live=true;void fetchPhonicsBank().then(rows=>{if(live)setBank(rows);}).catch(()=>{}).finally(()=>{if(live)setBankLoaded(true);});return()=>{live=false;};},[]);
 const unit=useMemo(()=>courseUnits(bank).find(u=>u.id===params.get('unit')),[bank,params]);const pages=useMemo(()=>unit?readyClassPages(unit):[],[unit]);
 const [selected,setSelected]=useState<string[]|null>(null),[teacher,setTeacher]=useState(false),[fonts,setFonts]=useState(false);
 useEffect(()=>{let live=true;void document.fonts.ready.then(()=>{if(live)setFonts(true);});return()=>{live=false;};},[]);
 const shown=pages.filter(p=>selected===null||selected.includes(p.id));
 const paths=useMemo(()=>[...new Set(pages.flatMap(p=>p.entries.flatMap(e=>e.image_url?[e.image_url]:[])))],[pages]);const checks=useWorkbookImageChecks(paths);
 const missing=pages.flatMap(p=>p.entries).filter(e=>!e.image_url||checks[e.image_url]===false);const ready=bankLoaded&&!!shown.length&&fonts&&!missing.length&&paths.every(p=>checks[p]);
 if(!unit)return <p role="alert">{t('phonicsLesson.invalid')} <Link to="/phonics?tab=course">{t('readyMedia.back')}</Link></p>;
 return <div className="rc-workbook"><div className="no-print"><Link to={`/phonics?tab=course&level=${unit.step}&unit=${unit.id}`}>{t('readyMedia.back')}</Link><h1 className="my-4 text-2xl font-bold">{t('readyMedia.bookTitle')} · Level {unit.step} / Unit {unit.number}</h1><p>{unit.groups.map(g=>g.label).join(' · ')} · {unit.entries.map(e=>e.word).join(' · ')}</p>{unit.reading.status==='draft'&&<p>{t('readyMedia.draft')}</p>}<div className="rc-controls"><button onClick={()=>setSelected(null)}>{t('readyMedia.allPages')}</button><button onClick={()=>setSelected([])}>{t('readyMedia.clearPages')}</button><label><input type="checkbox" checked={teacher} onChange={e=>setTeacher(e.target.checked)}/> {t('readyMedia.teacher')}</label><button data-print disabled={!ready} onClick={()=>window.print()}>{t('readyMedia.print')}</button><span>{t('readyMedia.pages',{count:shown.length+(teacher?Math.ceil(shown.length/5):0)})}</span></div><div className="rc-page-list">{pages.map((p,i)=><label key={p.id}><input type="checkbox" checked={selected===null||selected.includes(p.id)} onChange={e=>setSelected(prev=>e.target.checked?[...(prev??pages.map(x=>x.id)),p.id]:(prev??pages.map(x=>x.id)).filter(id=>id!==p.id))}/> {i+1}. {p.title}</label>)}</div>{!ready&&<p role="status">{t(missing.length?'readyMedia.missing':'readyMedia.loading')} {missing.length>0&&[...new Set(missing.map(e=>e.word))].join(', ')}</p>}</div><div className="rc-preview">{shown.map(p=><ReadyClassPage key={p.id} unit={unit} page={p} number={pages.indexOf(p)+1}/>)}{teacher&&Array.from({length:Math.ceil(shown.length/5)},(_,i)=><ReadyClassTeacherPage key={i} unit={unit} pages={shown.slice(i*5,i*5+5)} offset={i*5} numbers={shown.slice(i*5,i*5+5).map(p=>pages.indexOf(p)+1)} answers/>)}</div></div>;
}
