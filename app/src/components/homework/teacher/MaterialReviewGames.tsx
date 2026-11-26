import { useEffect, useMemo, useState } from 'react';
import { reviewGameNames, reviewGames, reviewGameSource, type ReviewGame } from '../../../lib/homework/materialReviewGames';
import type { Material } from '../../../lib/homework/materialPlan';
import './material-review-games.css';

export default function MaterialReviewGames({materials,enabled,games,onEnabled,onGames,en}:{
  materials:Material[]; enabled:boolean; games:ReviewGame[]; onEnabled:(value:boolean)=>void; onGames:(value:ReviewGame[])=>void; en:boolean;
}) {
  const options=useMemo(()=>reviewGames.map(game=>({game,...reviewGameSource(materials,game,en)})),[materials,en]);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    const invalid=options.filter(o=>o.reason && games.includes(o.game));
    if (!invalid.length) return;
    setNotice(invalid.map(o=>reviewGameNames[o.game][en?1:0]+' · '+o.reason).join(' '));
    onGames(games.filter(game=>!invalid.some(o=>o.game===game)));
  },[options,games,onGames,en]);
  return <section className="material-review-games">
    <label className="material-review-heading">
      <input type="checkbox" checked={enabled} onChange={e=>{setNotice('');onEnabled(e.target.checked);}}/>
      <strong>{en?'Review with games':'게임으로 복습하기'}</strong><span>{en?'(optional)':'(선택)'}</span>
    </label>
    {enabled && <div className="material-review-grid">{options.map(({game,cards,hasSentences,reason})=>{
      const selected=games.includes(game) && !reason;
      return <button key={game} type="button" disabled={!!reason} aria-pressed={selected} className="material-review-option"
        onClick={()=>{setNotice('');onGames(selected?games.filter(g=>g!==game):[...games,game]);}}>
        {selected && <i className="material-review-check" aria-hidden="true">✓</i>}
        <span aria-hidden="true" className={'material-review-art art-'+game}>
          {game==='memory' && <><i>★</i><i>★</i></>}
          {game==='flip' && <><i/><i/><i/><i/></>}
          {game==='guess' && <><i>A</i><i>B</i><i>C</i></>}
          {game==='shoot' && <i>↙</i>}
        </span>
        <strong>{reviewGameNames[game][en?1:0]}</strong>
        <small>{reason || (selected ? (en?`Uses ${cards.length} selected ${hasSentences?'entries':'words'}`:`이번 숙제 ${hasSentences?'자료':'단어'} ${cards.length}개 사용`) : '')}</small>
      </button>;
    })}</div>}
    {notice && <small role="status">{notice}</small>}
  </section>;
}
