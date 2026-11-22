import AnimationEpisodeLibrary from '../AnimationEpisodeLibrary';
import EpisodeLessonPanel from './EpisodeLessonPanel';
export default function AnimationSoloLibrary({academyId,classId,teacherId,onSaved}:{academyId:string;classId:string|null;teacherId?:string;onSaved?:()=>void}){
 return <AnimationEpisodeLibrary renderDetail={(material,onBack)=><EpisodeLessonPanel key={material.episode.id} material={material} academyId={academyId} classId={classId} teacherId={teacherId} onBack={onBack} onSaved={onSaved}/>}/>;
}
