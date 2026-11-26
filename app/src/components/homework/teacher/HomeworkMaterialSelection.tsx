import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Material } from '../../../lib/homework/materialPlan';
import type { CatalogueMaterial } from '../../../lib/homework/materialSources';
import { dialogueKey, selectHomeworkMaterial, type ContentSelection } from '../../../lib/homework/materialSelection';
import EpisodeChapterPicker from '../../solo/EpisodeChapterPicker';
import './homework-material-selection.css';

export { selectHomeworkMaterial, type ContentSelection };
type Kind = Material['kind'];
const kinds: Kind[] = ['word','sentence','scene','frequent'];
const category = { word:'categoryWord', sentence:'categorySentence', scene:'categoryScene', frequent:'categoryFrequent' };
const sourceKey = (source: Material) => source.kind + '/' + source.id;
type Props = {
  catalogue: Partial<Record<Kind, CatalogueMaterial[]>>;
  categories: Kind[];
  selected: Record<string, ContentSelection>;
  failed: Kind[];
  onCategory: (kind: Kind) => void;
  onChoose: (source: Material) => void;
  onConfigure: (source: Material, change: ContentSelection) => void;
  onRetry: () => void;
  onExpandedChange: (expanded: boolean) => void;
};

function CategoryArt({kind}:{kind:Kind}) {
  return <span aria-hidden="true" className={'hw-category-art art-'+kind}>
    {kind==='word' && <><i>A</i><i>🍎</i></>}
    {kind==='sentence' && <i/>}
    {kind==='scene' && <i>▶</i>}
    {kind==='frequent' && <><i>the</i><i>and</i></>}
  </span>;
}

function Contents({source,settings,onConfigure,en}:{source:Material;settings:ContentSelection;onConfigure:Props['onConfigure'];en:boolean}) {
  const chosen = selectHomeworkMaterial(source,settings);
  const chosenCards = new Set(chosen.cards.map(c=>c.id));
  const chosenLines = new Set(chosen.scene?.lines.map(dialogueKey));
  const fullCount = source.cards.length + (source.scene?.lines.length ?? 0);
  const selectedCount = chosen.cards.length + (chosen.scene?.lines.length ?? 0);
  function toggleItem(keys:Set<string>,id:string,field:keyof ContentSelection) {
    const next = new Set(keys);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onConfigure(source,{[field]:Array.from(next)});
  }
  const row=(id:string,english:string,korean:string,keys:Set<string>,field:keyof ContentSelection) =>
    <label className="hw-source-entry" key={field+id}><input type="checkbox" checked={keys.has(id)}
      onChange={()=>toggleItem(keys,id,field)}/><span lang="en">{english}</span><span>{korean}</span></label>;
  return <div className="hw-source-contents">
    {fullCount>0 && <div className="hw-source-bulk"><button type="button" onClick={()=>onConfigure(source,{
      cardIds:source.cards.map(c=>c.id),lineIds:source.scene?.lines.map(dialogueKey),
    })} disabled={selectedCount===fullCount}>{en?'Select all':'전체 선택'}</button>
      <button type="button" onClick={()=>onConfigure(source,{cardIds:[],lineIds:[]})} disabled={!selectedCount}>{en?'Clear all':'전체 해제'}</button></div>}
    {source.scene && <p className="hw-source-section">{en?'Selected scene':'선택한 장면'} · {source.name}</p>}
    {source.cards.map(c=>row(c.id,c.word,c.meaning,chosenCards,'cardIds'))}
    {!!source.scene?.lines.length && <p className="hw-source-section">{en?'Dialogue':'대사'}</p>}
    {source.scene?.lines.map(line=>row(dialogueKey(line),line.speaker ? line.speaker+' · '+line.en : line.en,line.ko || '',chosenLines,'lineIds'))}
  </div>;
}

function SourceGroup({kind,rows,en,expanded,setExpanded,...props}:Pick<Props,'selected'|'onChoose'|'onConfigure'> & {
  kind:Kind;rows:CatalogueMaterial[];en:boolean;expanded:string[];setExpanded:(keys:string[])=>void;
}) {
  const parentField=kind==='scene'?'episode':'school';
  const selectedRow=rows.find(row=>props.selected[sourceKey(row)]);
  const [parent,setParent]=useState(selectedRow?.[parentField]?.id ?? '');
  const [band,setBand]=useState(selectedRow?.band?.id ?? '');
  const parents=new Map(rows.flatMap(row=>row[parentField]?[[row[parentField].id,row[parentField].name] as const]:[]));
  const withinParent=parents.size?rows.filter(row=>row[parentField]?.id===parent):rows;
  const bands=new Map(withinParent.flatMap(row=>row.band?[[row.band.id,row.band.name] as const]:[]));
  const matches=bands.size?withinParent.filter(row=>row.band?.id===band):withinParent;
  const chapterRows = kind==='scene' ? matches.flatMap(source=>source.chapter ? [{source,chapter:source.chapter}] : []) : [];
  const episodeStart = chapterRows[0]?.source.episode?.start;
  const visible=rows.filter(row=>props.selected[sourceKey(row)] || (matches.includes(row) && !row.chapter));
  function toggleSource(source:Material) {
    const key = sourceKey(source);
    const otherExpanded = expanded.filter(value=>value!==key);
    setExpanded(props.selected[key] ? otherExpanded : [...otherExpanded,key]);
    props.onChoose(source);
  }
  const label=en?{word:'Word list',sentence:'Sentence list',scene:'Scene',frequent:'Vocabulary range'}[kind]:
    {word:'단어장',sentence:'문장 모음',scene:'장면',frequent:'빈출 단어'}[kind];
  return <div className="hw-source-group">
    {parents.size>0 && <label className="hw-source-filter">{kind==='scene'?(en?'Episode':'에피소드'):(en?'School level':'학교급')}
      <select value={parent} onChange={e=>{setParent(e.target.value);setBand('');}}><option value="">{en?'Choose':'선택해 주세요'}</option>
        {Array.from(parents,([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
    {episodeStart!==undefined && <EpisodeChapterPicker chapters={chapterRows.map(row=>row.chapter)} episodeStart={episodeStart}
      selected={chapterRows.flatMap(({source},index)=>props.selected[sourceKey(source)] ? [index] : [])}
      onToggle={index=>toggleSource(chapterRows[index].source)} legend={en?'Chapters for this homework':'숙제에 넣을 챕터'}/>}
    {bands.size>0 && <label className="hw-source-filter">{en?'Level':'단계'}
      <select value={band} onChange={e=>setBand(e.target.value)}><option value="">{en?'Choose':'선택해 주세요'}</option>
        {Array.from(bands,([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
    {visible.map(source=>{
      const key=sourceKey(source);
      const settings=props.selected[key];
      const open=!!settings && expanded.includes(key);
      const sourceTotal=source.cards.length+(source.scene?.lines.length ?? 0);
      const chosen=settings && selectHomeworkMaterial(source,settings);
      const count=chosen ? chosen.cards.length+(chosen.scene?.lines.length ?? 0):0;
      const name=label+' · '+source.name;
      function toggleOpen() {
        if(!settings) props.onChoose(source);
        setExpanded(open?expanded.filter(k=>k!==key):[...expanded.filter(k=>k!==key),key]);
      }
      return <div className="hw-source-accordion" key={key}>
        <div className={'hw-source-head'+(open?' is-open':'')}>
          <button type="button" disabled={!sourceTotal && !source.scene} aria-expanded={open} onClick={toggleOpen}>
            <span className="material-symbols-outlined" aria-hidden>{open?'expand_less':'expand_more'}</span>
            <strong>{name}</strong>{chosen && <small>{count}/{sourceTotal}{en?' selected':'개 선택'}</small>}</button>
          {(!source.chapter || source.episode?.id!==parent) && <input aria-label={name+(en?' selected':' 선택')} type="checkbox" checked={!!settings} disabled={!sourceTotal && !source.scene}
            onChange={()=>toggleSource(source)}/>}
        </div>
        {open && <Contents source={source} settings={settings} en={en} onConfigure={props.onConfigure}/>}
      </div>;
    })}
  </div>;
}

export default function HomeworkMaterialSelection(props: Props) {
  const {t,i18n}=useTranslation('materialHomework');
  const en=i18n.language.startsWith('en');
  const [expanded,setExpanded]=useState<string[]>(()=>Object.keys(props.selected));
  const editing=expanded.some(key=>!!props.selected[key]);
  useEffect(()=>{props.onExpandedChange(editing);},[props.onExpandedChange,editing]);
  return <div className="hw-source-studio">
    {editing ? <button type="button" className="hw-small-action" onClick={()=>setExpanded([])}>{en?'Choose material types':'자료 유형 선택'}</button> :
    <div className="hw-category-grid">{kinds.map(kind=><label key={kind} className={'hw-category'+(props.categories.includes(kind)?' is-selected':'')}>
      <input type="checkbox" checked={props.categories.includes(kind)} onChange={()=>props.onCategory(kind)}/>
      <CategoryArt kind={kind}/><strong>{t(category[kind])}</strong></label>)}</div>}
    {kinds.filter(kind=>props.categories.includes(kind)).map(kind=>{
      const content = props.failed.includes(kind) ? <p role="alert">{t('loadFailed')} <button type="button" onClick={props.onRetry}>{t('reload')}</button></p> :
        !props.catalogue[kind] ? <p role="status">{t('loading')}</p> : !props.catalogue[kind].length ? <p>{t('noMaterials')}</p> :
        <SourceGroup kind={kind} rows={props.catalogue[kind]} en={en} expanded={expanded} setExpanded={setExpanded}
          selected={props.selected} onChoose={props.onChoose} onConfigure={props.onConfigure}/>;
      if (kind === 'word' || kind === 'sentence') {
        return <details key={kind} open className="hw-source-list">
          <summary>{kind === 'word' ? t('wordLists') : t('sentenceLists')}</summary>
          {content}
        </details>;
      }
      return <div key={kind}>{content}</div>;
    })}
  </div>;
}
