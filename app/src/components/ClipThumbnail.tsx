import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {clipThumb} from '../lib/videoClips';
/** mqdefault can be a placeholder/404 for unavailable videos. Never leave a broken img icon. */
export default function ClipThumbnail({id,className=''}:{id:string;className?:string}){
 const {t}=useTranslation();const [failed,setFailed]=useState(false);
 return failed?<span className={'flex items-center justify-center bg-slate-100 text-slate-600 '+className} role="img" aria-label={t('readyMedia.fallback')}>▶</span>:<img src={clipThumb(id)} alt="" loading="lazy" className={className} onError={()=>setFailed(true)} onLoad={e=>{if(e.currentTarget.naturalWidth<=120&&e.currentTarget.naturalHeight<=90)setFailed(true);}}/>;
}
