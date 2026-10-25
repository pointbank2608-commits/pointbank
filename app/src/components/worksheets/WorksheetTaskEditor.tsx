import { useTranslation } from 'react-i18next';
import { worksheetActivity } from '../../lib/worksheetActivityCatalog';
import { newTask, type WorksheetDocument } from '../../lib/worksheetStudio';

export default function WorksheetTaskEditor({doc,onChange}:{doc:WorksheetDocument;onChange:(doc:WorksheetDocument)=>void}) {
 const {t}=useTranslation(),activity=worksheetActivity(doc.activityId)!,layout=activity.layout;const tr=(k:string)=>t(`worksheetStudio.${k}`);
 const tasksVisible=['questions','reader','sequence','storyMap','mainIdea','venn','draw','table','dictation','dictogloss','survey','informationGap','roleplay','ranking','jigsaw','pictureWrite','expansion','paragraph','comic','recount','opinion','checklist','functional','form','poster','media','kwl','exit','rubric','walkDictation','listenColor'].includes(layout);
 const usePassage=['questions','reader','storyMap','mainIdea','dictogloss','checklist','media'].includes(layout);
 const useTopic=['ranking','roleplay','jigsaw','paragraph','comic','recount','opinion','form','poster','kwl','rubric','reader'].includes(layout);
 function field(key:'title'|'instruction'|'passage'|'topic'|'left'|'right'|'columns'|'route',large=false,max=300) {return <label>{tr(key==='title'?'titleLabel':key)}{large?<textarea aria-label={tr(key==='title'?'titleLabel':key)} rows={key==='passage'?7:3} value={doc[key]} maxLength={max} onChange={e=>onChange({...doc,[key]:e.target.value})}/>:<input aria-label={tr(key==='title'?'titleLabel':key)} value={doc[key]} maxLength={max} onChange={e=>onChange({...doc,[key]:e.target.value})}/>}</label>;}
 function patch(index:number,key:string,value:unknown){onChange({...doc,editedTasks:true,tasks:doc.tasks.map((r,i)=>i===index?{...r,[key]:value}:r)});}
 function move(index:number,d:number){const tasks=[...doc.tasks];[tasks[index],tasks[index+d]]=[tasks[index+d],tasks[index]];onChange({...doc,tasks,editedTasks:true});}
 return <div className="ws-task-editor"><div className="ws-input-grid">{field('title',false,100)}{field('instruction',true)}{useTopic&&field('topic',true,250)}{['venn','table','informationGap','functional'].includes(layout)&&<>{field('left',false,90)}{field('right',false,90)}</>}{layout==='substitution'&&field('columns',true,1200)}{layout==='map'&&field('route',false,200)}</div>
  {usePassage&&field('passage',true,6000)}
  {tasksVisible&&<details className="ws-task-details"><summary>{tr('questions')} · {doc.tasks.length}</summary><div className="ws-task-list">{doc.tasks.map((row,index)=><fieldset className="ws-task-row" key={row.id} data-task-editor={row.id}><legend>{index+1}</legend><div className="ws-input-grid">
   {layout!=='listenColor'&&<label>{tr('prompt')}<textarea aria-label={tr('prompt')} value={row.prompt} maxLength={260} rows={2} onChange={e=>patch(index,'prompt',e.target.value)}/></label>}
   {!['dictation','walkDictation','sequence'].includes(layout)&&<label>{tr('answer')}<textarea aria-label={tr('answer')} value={row.answer} maxLength={300} rows={2} onChange={e=>patch(index,'answer',e.target.value)}/></label>}
   {!['dictation','walkDictation','listenColor','sequence'].includes(layout)&&<label>{tr('detail')}<textarea aria-label={tr('detail')} value={row.detail} maxLength={350} rows={2} onChange={e=>patch(index,'detail',e.target.value)}/></label>}
   {['questions','reader'].includes(layout)&&<label>{tr('options')}<input value={row.options.join(' | ')} maxLength={350} onChange={e=>patch(index,'options',e.target.value.trim()?e.target.value.split('|').map(s=>s.trim()):[])}/></label>}
   {['sequence','jigsaw','functional'].includes(layout)&&<label>{tr('order')}<input type="number" min={0} max={60} value={row.order??''} onChange={e=>patch(index,'order',e.target.value===''?undefined:Number(e.target.value))}/></label>}
   {['questions','reader','sequence','pictureWrite','listenColor'].includes(layout)&&<label>{tr('wordLink')}<select value={row.wordId||''} onChange={e=>patch(index,'wordId',e.target.value||undefined)}><option value="">{tr('noPicture')}</option>{doc.words.map(w=><option key={w.id} value={w.id}>{w.word}</option>)}</select></label>}
  </div><div className="ws-actions"><button type="button" className="ws-button" disabled={index===0} onClick={()=>move(index,-1)}>{tr('moveUp')}</button><button type="button" className="ws-button" disabled={index===doc.tasks.length-1} onClick={()=>move(index,1)}>{tr('moveDown')}</button><button type="button" className="ws-button" onClick={()=>onChange({...doc,tasks:doc.tasks.filter((_,i)=>i!==index),editedTasks:true})}>{tr('remove')}</button></div></fieldset>)}</div><button type="button" className="ws-button" disabled={doc.tasks.length>=60||layout==='kwl'} onClick={()=>onChange({...doc,tasks:[...doc.tasks,newTask()],editedTasks:true})}>{tr('addRow')}</button></details>}
 </div>;
}
