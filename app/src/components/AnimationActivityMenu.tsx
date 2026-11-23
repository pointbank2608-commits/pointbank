import {useTranslation} from 'react-i18next';

const practice=[['follow','mic_none'],['cloze','headphones'],['scramble','format_list_numbered'],['expression','sync_alt'],['role','group']];
const review=[['scene','search'],['pass','fast_forward'],['gap','edit_note'],['missing','dashboard']];
export default function AnimationActivityMenu({kind,choose}:{kind:'practice'|'review';choose:(id:string)=>void}){
  const {t}=useTranslation();
  return <div className="episode-activity-menu">{(kind==='review'?review:practice).map(([id,icon])=><button key={id} onClick={()=>choose(id)}>
    <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
    <strong>{id==='pass'?'Pass the Word · ':id==='missing'?'What’s Missing? · ':''}{t('episodeActivities.'+id)}</strong>
    <span aria-hidden="true">›</span>
  </button>)}</div>;
}
