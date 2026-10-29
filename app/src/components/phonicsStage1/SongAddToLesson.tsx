import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../../context/AuthContext';
import {useToast} from '../../context/ToastContext';
import {fetchAllCurriculumLessons} from '../../lib/api';
import {appendSongToLesson,type SongMedia} from '../../lib/personalPhonicsSongs';
import type {CurriculumLesson} from '../../lib/types';
import {announceLessonChange} from '../../lib/lessonChanges';
import AccessibleDialog from '../AccessibleDialog';
export default function SongAddToLesson({song,onClose}:{song:SongMedia;onClose:()=>void}){
 const {t}=useTranslation();const {academy,profile}=useAuth();const academyId=academy?.id,profileId=profile?.id;const {notify}=useToast();const [lessons,setLessons]=useState<CurriculumLesson[]|null>(null),[id,setId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false);const adding=useRef(false);
 useEffect(()=>{let live=true;if(academyId&&profileId)void fetchAllCurriculumLessons(academyId).then(rows=>{if(live)setLessons(rows.filter(l=>l.created_by===profileId));}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[academyId,profileId]);
 return <AccessibleDialog label={t('mediaV2.addLesson')} onClose={()=>{if(!busy)onClose();}}><div className="song-editor"><h2>{t('mediaV2.addLesson')}</h2><p>{song.title}</p><label>{t('mediaV2.chooseLesson')}<select aria-label={t('mediaV2.chooseLesson')} value={id} disabled={busy||!lessons} onChange={e=>setId(e.target.value)}><option value="">{t('mediaV2.choose')}</option>{lessons?.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>{error&&<p role="alert">{t('mediaV2.failed')}</p>}<footer><button disabled={busy} onClick={onClose}>{t('mediaV2.cancel')}</button><button className="song-primary" disabled={busy||!id} onClick={async()=>{if(adding.current||!academy)return;const l=lessons?.find(l=>l.id===id);if(!l)return;adding.current=true;setBusy(true);setError(false);try{await appendSongToLesson(l.id,song,l.updated_at);announceLessonChange(academy.id,l.id);notify(t('mediaV2.lessonAdded'));onClose();}catch{setError(true);}finally{adding.current=false;setBusy(false);}}}>{t(busy?'common.loading':'mediaV2.addLesson')}</button></footer></div></AccessibleDialog>;
}
