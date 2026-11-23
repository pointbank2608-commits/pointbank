import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import '../styles/animation-word-scene.css';

type Props = {
  words: {word:string; meaning:string}[];
  pronounce: (word:string)=>void;
  onReveal: ()=>void;
  onClose: ()=>void;
};

export default function AnimationWordCards({words,pronounce,onReveal,onClose}:Props) {
  const {t}=useTranslation();
  const [index,setIndex]=useState(0);
  const [back,setBack]=useState(false);
  const word=words[index];
  function move(next:number) {
    if (!words[next]) return;
    setIndex(next);
    setBack(false);
    pronounce(words[next].word);
  }
  function flip() {
    if (!back) onReveal();
    setBack(!back);
  }
  return <section className="episode-word-overlay" aria-label={t('episodeActivities.words')}>
    <button className="episode-overlay-close" onClick={onClose}>× {t('episodeActivities.close')}</button>
    <div className="episode-word-card">
      <header><strong>{t('episodeActivities.words')}</strong>{word&&<span aria-live="polite">{index+1} / {words.length}</span>}</header>
      {word ? <div className="episode-word-deck" key={index}>
        <div className="episode-word-turn" data-back={back}>
          <div className="episode-word-face" inert={back}>
            <button lang="en" onClick={flip}>{word.word}</button>
            <button className="episode-word-audio" aria-label={t('episodeActivities.sound')} onClick={()=>pronounce(word.word)}>
              <span className="material-symbols-outlined" aria-hidden="true">volume_up</span>
            </button>
          </div>
          <div className="episode-word-face episode-word-back" inert={!back}>
            <button lang="ko" onClick={flip}>{word.meaning}</button>
          </div>
        </div>
      </div> : <p role="status">{t('animationPass.empty')}</p>}
    </div>
    {word&&<nav className="episode-word-pager" aria-label={t('episodeActivities.words')}>
      <button disabled={index===0} onClick={()=>move(index-1)}>← {t('episodeActivities.previous')}</button>
      <button disabled={index+1===words.length} onClick={()=>move(index+1)}>{t('episodeActivities.next')} →</button>
    </nav>}
  </section>;
}
