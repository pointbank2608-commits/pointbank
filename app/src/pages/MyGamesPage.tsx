import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../context/AuthContext';
import {useFeature} from '../lib/features';
import {fetchSavedGames,fetchClasses} from '../lib/api';
import {GAME_CATALOG} from '../lib/gameCatalog';
import {isActivityDraft} from '../lib/quickActivity';
import type {GameTemplate,ClassRow} from '../lib/types';
import AddActivityToLesson from '../components/AddActivityToLesson';
const button='inline-flex min-h-11 items-center rounded-xl border px-4 py-2 font-bold';
export default function MyGamesPage(){
 const {t}=useTranslation(),{academy}=useAuth(),group=useFeature('group');
 const [rows,setRows]=useState<GameTemplate[]>([]),[classes,setClasses]=useState<ClassRow[]>([]),[search,setSearch]=useState(''),[scope,setScope]=useState('all'),[status,setStatus]=useState('loading'),[retry,setRetry]=useState(0),[add,setAdd]=useState<GameTemplate|null>(null);
 useEffect(()=>{let alive=true;setRows([]);setClasses([]);setStatus('loading');if(!academy?.id)return;void Promise.all([fetchSavedGames(academy.id),fetchClasses(academy.id)]).then(([games,list])=>{if(alive){setRows(games.filter(g=>g.academy_id===academy.id&&!isActivityDraft(g.id)&&!g.config?.lessonSnapshot));setClasses(list);setStatus('ready');}}).catch(()=>{if(alive)setStatus('error');});return()=>{alive=false;};},[academy?.id,retry]);
 const visible=rows.filter(row=>row.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())&&(scope==='all'||(row.class_id||'academy')===scope));
 return <section className="mx-auto max-w-6xl space-y-5" data-my-games><h1 className="text-3xl font-black">{t('launchUx.myGames')}</h1><p>{t('launchUx.myGamesHint')}</p>
 <div className="flex flex-wrap gap-3"><label>{t('launchUx.search')}<input className="ml-2 min-h-11 rounded-xl border p-3" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>{t('launchUx.scope')}<select className="ml-2 min-h-11 rounded-xl border p-3" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">{t('gameCategory.all')}</option><option value="academy">{t('launchUx.academy')}</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
 {status==='loading'&&<p role="status">{t('common.loading')}</p>}{status==='error'&&<button className={button} onClick={()=>setRetry(n=>n+1)}>{t('guide.retry')}</button>}{status==='ready'&&!visible.length&&<p>{t('launchUx.empty')}</p>}
 <div className="grid gap-4 md:grid-cols-2">{visible.map(row=>{const game=GAME_CATALOG.find(g=>g.type===row.game_type);return <article key={row.id} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold">{row.name}</h2><p>{game?t(game.nameKey):row.game_type} · {row.class_id?classes.find(c=>c.id===row.class_id)?.name||t('gameAdmin.scopeClass'):t('launchUx.academy')}</p><div className="flex flex-wrap gap-2">{game&&<><Link className={button+' bg-primary !text-white'} to={game.path} state={{openTemplateId:row.id,openClassId:row.class_id}}>{t('flow.start')}</Link><Link className={button} to={game.path} state={{openTemplateId:row.id,openClassId:row.class_id,editGame:true}}>{t('launchUx.editContent')}</Link></>}{group&&<button className={button} onClick={()=>setAdd(row)}>{t('quick.addLesson')}</button>}</div></article>;})}</div>
 {add&&<AddActivityToLesson activity={add} onClose={()=>setAdd(null)}/>}</section>;
}
