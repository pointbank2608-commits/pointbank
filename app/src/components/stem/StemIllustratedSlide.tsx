import type {FullCardItem} from '../../lib/types';
import type {StemFrame,StemMeta} from '../../lib/stemTypes';

/** Image-led layouts keep experiment art and editable speech in one scene. */
export default function StemIllustratedSlide({frame,meta,cards}:{frame:StemFrame;meta:StemMeta;cards:FullCardItem[]}){
 const composition=frame.mode==='vocabulary'?'words':frame.illustrations?.length?'compare':frame.backgroundUrl?'hero':frame.layout==='speaking'?'speaking':!frame.imageUrl?'text':frame.layout==='wrap-up'?'celebrate':frame.layout==='experiment-steps'?'steps':'spotlight';
 return <div className={`stem-stage stem-native stem-illustrated stem-composition-${composition}`} data-stem-theme="science-lab" lang="en">
  {frame.backgroundUrl&&<img className="stem-scene-background" src={frame.backgroundUrl} alt="" draggable={false}/>}
  <span className="stem-science-tag" aria-hidden="true">SCIENCE LAB</span>
  <h2 className="stem-discovery-title">{frame.title}</h2>
  <i className="stem-spark stem-spark-one" aria-hidden="true"/><i className="stem-spark stem-spark-two" aria-hidden="true"/>
  {frame.mode==='vocabulary'?<div className="stem-word-grid stem-discovery-words">{cards.map((word,i)=><div key={word.id}><span className="stem-word-number" aria-hidden="true">{i+1}</span>{word.imageUrl&&<img src={word.imageUrl} alt=""/>}<b>{word.word}</b><p>{word.example}</p></div>)}</div>:<>
   {frame.illustrations?.length?<div className="stem-illustrations stem-discovery-comparison">{frame.illustrations.map((image,i)=><figure key={i}><img src={image.imageUrl} alt=""/><figcaption>{image.caption}</figcaption></figure>)}</div>:!frame.backgroundUrl&&frame.imageUrl?<img className="stem-discovery-subject" src={frame.imageUrl} alt="" draggable={false}/>:null}
   <div className="stem-lines stem-discovery-speech">{frame.lines.map((line,i)=><p key={i}>{frame.layout==='experiment-steps'&&<span className="stem-discovery-step" aria-hidden="true">{i+1}</span>}<span>{line}</span></p>)}</div>
  </>}
  {meta.mascotUrl&&composition!=='hero'&&<img className="stem-discovery-mascot" src={meta.mascotUrl} alt="" draggable={false}/>}
 </div>;
}
