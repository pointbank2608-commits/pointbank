import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../context/AuthContext';
import {useClasses} from '../lib/useClasses';
import ClassChipRow from './ClassChipRow';
import AnimationEpisodeLibrary from './AnimationEpisodeLibrary';
import EpisodeLessonPanel from './solo/EpisodeLessonPanel';
import AnimationEpisodeClassroom from './AnimationEpisodeClassroom';
import {lazy,Suspense,useState} from 'react';
import {episodeGroupLesson} from '../lib/animationEpisodeGroup';
const EpisodeGroupPreview=lazy(()=>import('./EpisodeGroupPreview'));

export default function AnimationGroupLibrary(){
  const {t}=useTranslation();const navigate=useNavigate();const {academy,profile}=useAuth();const classes=useClasses(academy?.id);
  const [preview,setPreview]=useState<ReturnType<typeof episodeGroupLesson>|null>(null);
  return <div className="space-y-4"><ClassChipRow classes={classes.classes} selectedId={classes.selectedId} onSelect={classes.select} onReorder={classes.reorder}/><AnimationEpisodeLibrary title={t('animationSolo.groupTitle')} renderDetail={(material,onBack)=><AnimationEpisodeClassroom material={material} classId={classes.selectedId??null} onBack={onBack} legacy={<EpisodeLessonPanel key={material.episode.id} material={material} academyId={academy?.id??''} classId={classes.selectedId??null} teacherId={profile?.id} onBack={onBack} onGroupPreview={selection=>setPreview(episodeGroupLesson(material,selection))} onGroupLesson={selection=>navigate('/curriculum?mode=group',{state:{createFromEpisode:selection}})}/>} />}/>{preview&&<Suspense fallback={<p role="status">미리보기를 불러오고 있어요.</p>}><EpisodeGroupPreview {...preview} onClose={()=>setPreview(null)}/></Suspense>}</div>;
}
