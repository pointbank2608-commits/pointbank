import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../context/AuthContext';
import {useClasses} from '../lib/useClasses';
import ClassChipRow from './ClassChipRow';
import AnimationEpisodeLibrary from './AnimationEpisodeLibrary';
import EpisodeLessonPanel from './solo/EpisodeLessonPanel';
import {lazy,Suspense,useState} from 'react';
import {episodeGroupLesson} from '../lib/animationEpisodeGroup';
import {fetchAllCurriculumLessons} from '../lib/api';
import {findVideoQuestionLesson} from '../lib/videoQuestionLessons';
const EpisodeGroupPreview=lazy(()=>import('./EpisodeGroupPreview'));

export default function AnimationGroupLibrary(){
  const {t}=useTranslation();const navigate=useNavigate();const {academy,profile}=useAuth();const classes=useClasses(academy?.id);
  const [preview,setPreview]=useState<ReturnType<typeof episodeGroupLesson>|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return <div className="space-y-4">{busy&&<p role="status">저장한 질문을 불러오고 있어요.</p>}{error&&<p role="alert">{error}</p>}<ClassChipRow classes={classes.classes} selectedId={classes.selectedId} onSelect={classes.select} onReorder={classes.reorder}/><AnimationEpisodeLibrary title={t('animationSolo.groupTitle')} renderDetail={(material,onBack)=><EpisodeLessonPanel key={material.episode.id} material={material} academyId={academy?.id??''} classId={classes.selectedId??null} teacherId={profile?.id} onBack={onBack} onGroupPreview={async selection=>{if(busy)return;setBusy(true);setError('');try{const found=academy&&profile?findVideoQuestionLesson(await fetchAllCurriculumLessons(academy.id),material.source.rows[0].id,profile.id,material.episode.id):null;setPreview(episodeGroupLesson(material,{...selection,timedQuestions:found?.slide.timedQuestions}));}catch{setError('저장한 질문을 불러오지 못했어요. 다시 시도해 주세요.');}finally{setBusy(false);}}} onGroupLesson={async selection=>{if(busy)return;setBusy(true);setError('');try{const found=academy&&profile?findVideoQuestionLesson(await fetchAllCurriculumLessons(academy.id),material.source.rows[0].id,profile.id,material.episode.id):null;navigate('/curriculum?mode=group',{state:{createFromEpisode:{...selection,timedQuestions:found?.slide.timedQuestions}}});}catch{setError('저장한 질문을 불러오지 못했어요. 다시 시도해 주세요.');}finally{setBusy(false);}}}/>}/>{preview&&<Suspense fallback={<p role="status">미리보기를 불러오고 있어요.</p>}><EpisodeGroupPreview {...preview} onClose={()=>setPreview(null)}/></Suspense>}</div>;
}
