import { useState } from 'react';
import { PLACE_ICONS, adventureId, type IslandPlace } from '../../lib/adventureGames';

/** Shared map placement controls; the common question editor owns the clues. */
export default function AdventureMapEditor({value,onChange}:{value:IslandPlace[];onChange:(places:IslandPlace[])=>void}) {
  const [selected,setSelected]=useState(value[0]?.id??'');
  return <section className="ad-editor !p-0">
    <h3>지도 장소 배치</h3><p>장소를 선택하고 지도 영역을 누르면 위치가 바뀝니다.</p>
    <div className="ad-map-editor" onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();onChange(value.map(p=>p.id===selected?{...p,x:Math.round(Math.max(14,Math.min(86,(e.clientX-rect.left)/rect.width*100))),y:Math.round(Math.max(18,Math.min(78,(e.clientY-rect.top)/rect.height*100)))}:p));}}>
      {value.map(place=><button type="button" key={place.id} className={selected===place.id?'is-selected':''} style={{left:`${place.x}%`,top:`${place.y}%`}} onClick={e=>{e.stopPropagation();setSelected(place.id);}}>{place.name}</button>)}
    </div>
    {value.map(place=><div className="ad-edit-row" key={place.id}>
      <input aria-label="장소 이름" value={place.name} onFocus={()=>setSelected(place.id)} onChange={e=>onChange(value.map(p=>p.id===place.id?{...p,name:e.target.value}:p))}/>
      <select aria-label="장소 모양" value={place.icon} onChange={e=>onChange(value.map(p=>p.id===place.id?{...p,icon:e.target.value as IslandPlace['icon']}:p))}>{PLACE_ICONS.map(icon=><option key={icon}>{icon}</option>)}</select>
      <span>{place.x}%, {place.y}%</span><button type="button" onClick={()=>onChange(value.filter(p=>p.id!==place.id))}>삭제</button>
    </div>)}
    <button type="button" onClick={()=>{const id=adventureId();onChange([...value,{id,name:'new place',icon:'tree',x:50,y:50}]);setSelected(id);}}>+ 장소 추가</button>
  </section>;
}
