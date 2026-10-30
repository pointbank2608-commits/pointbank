import {Fragment} from 'react';
import {useTranslation} from 'react-i18next';
import {DndContext,PointerSensor,KeyboardSensor,closestCenter,useSensor,useSensors,type DragEndEvent} from '@dnd-kit/core';
import {SortableContext,useSortable,sortableKeyboardCoordinates,verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import type {StemFrame} from '../../lib/stemTypes';

interface Props{frames:StemFrame[];selectedId?:string;disabled:boolean;onSelect:(id:string)=>void;onMove:(id:string,target:number)=>void;onDuplicate:(id:string)=>void;onRemove:(id:string)=>void;onInsert:(position:number)=>void;onPreview:(id:string)=>void}
function Row({frame,index,count,selected,props}:{frame:StemFrame;index:number;count:number;selected:boolean;props:Props}){
 const {t}=useTranslation();const {attributes,listeners,setNodeRef,setActivatorNodeRef,transform,transition,isDragging}=useSortable({id:frame.id,disabled:props.disabled});
 const picture=frame.backgroundUrl||frame.imageUrl||frame.illustrations?.[0]?.imageUrl;
 const kind=t(`stem.${frame.mode==='video'?'videoMode':frame.mode==='game'?'gameMode':frame.mode==='report'?'reportMode':frame.mode==='missing'?'missing':frame.mode==='vocabulary'?'vocabulary':frame.mode==='image'?'image':'text'}`);
 return <article ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition,opacity:isDragging?.55:1}} className={`stem-block-row ${selected?'is-selected':''}`} data-stem-block={frame.id}>
  <button ref={setActivatorNodeRef} className="stem-block-drag" {...attributes} {...listeners} disabled={props.disabled} aria-label={t('stem.blockTools.drag',{n:index+1})}>⠿</button>
  <button className="stem-block-select" disabled={props.disabled} aria-label={`${index+1}. ${frame.title} · ${t(`stem.blockTools.stageNames.${frame.block}`)}`} aria-pressed={selected} onClick={()=>props.onSelect(frame.id)}>{picture?<img src={picture} alt="" loading="lazy"/>:<span className="stem-block-kind-icon" aria-hidden="true">{frame.mode==='video'?'▶':frame.mode==='game'?'★':frame.mode==='report'?'▤':'Aa'}</span>}<span><small>{t('stem.blockTools.number',{n:index+1})} · {kind}</small><b>{frame.title}</b><small>{t(`stem.blockTools.stageNames.${frame.block}`)}</small></span></button>
  <div className="stem-block-buttons"><button disabled={props.disabled} onClick={()=>props.onPreview(frame.id)} aria-label={t('stem.blockTools.previewNumber',{n:index+1})}>{t('stem.preview')}</button><button disabled={props.disabled} onClick={()=>props.onDuplicate(frame.id)} aria-label={t('stem.blockTools.copyNumber',{n:index+1})}>{t('stem.blockTools.copy')}</button><button disabled={!index||props.disabled} onClick={()=>props.onMove(frame.id,index-1)} aria-label={`${t('stem.moveUp')} ${index+1}`}>↑</button><button disabled={index===count-1||props.disabled} onClick={()=>props.onMove(frame.id,index+1)} aria-label={`${t('stem.moveDown')} ${index+1}`}>↓</button><button disabled={props.disabled} onClick={()=>props.onRemove(frame.id)} aria-label={`${t('stem.remove')} ${index+1}`}>{t('stem.remove')}</button></div>
 </article>;
}
export default function StemBlockList(props:Props){const {t}=useTranslation();const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));function drop(event:DragEndEvent){if(event.over&&event.active.id!==event.over.id){const target=props.frames.findIndex(f=>f.id===event.over!.id);props.onMove(String(event.active.id),target);}}
 const insert=(position:number)=><button className="stem-block-insert" disabled={props.disabled} onClick={()=>props.onInsert(position)} aria-label={t('stem.blockTools.insertAt',{n:position+1})}>＋ {t('stem.blockTools.addActivity')}</button>;
 return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drop}><SortableContext items={props.frames.map(f=>f.id)} strategy={verticalListSortingStrategy}><div className="stem-block-list" data-stem-block-list>{insert(0)}{props.frames.map((frame,index)=><Fragment key={frame.id}><Row frame={frame} index={index} count={props.frames.length} selected={props.selectedId===frame.id} props={props}/>{insert(index+1)}</Fragment>)}</div></SortableContext></DndContext>;
}
