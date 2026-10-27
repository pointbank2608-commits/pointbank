import i18n from '../../src/i18n';
void i18n.changeLanguage('ko');
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AdventureGame from '../../src/components/adventure/AdventureGame';
import GameThemeFrame from '../../src/components/GameThemeFrame';
import { BrowserRouter } from 'react-router-dom';
import { LessonRunnerProvider } from '../../src/context/LessonRunnerContext';
import { sampleAdventure,type AdventureType } from '../../src/lib/adventureGames';
const q=new URLSearchParams(location.search),type=(q.get('game')||'balloonpop') as AdventureType;
function Fixture(){const [key,setKey]=useState(0);const [c]=useState(()=>{const x=sampleAdventure(type);x.sound=q.has('sound');if(q.has('timed'))x.seconds=20;if(q.has('listening'))x.listening=true;if(q.has('typed'))x.detectiveMode='type';if(q.has('simple'))x.simpleClaw=true;if(q.has('longwords')){x.words=x.words.map((w,i)=>({...w,word:i===0?'apple':i===1?'extraordinary':'supercalifragilisticexpialidocious'+i}));}if(q.has('long')){x.sentences[0]={id:'long',text:"I'd like to play with my friends in the beautiful garden after school.",tokens:["I'd","like","to","play","with","my","friends","in","the","beautiful","garden","after","school."]};}return x;});return <GameThemeFrame gameType={type} onRestart={()=>setKey(k=>k+1)}><AdventureGame key={key} type={type} config={c} onRestart={()=>setKey(k=>k+1)}/></GameThemeFrame>;}
createRoot(document.getElementById('root')!).render(<BrowserRouter><LessonRunnerProvider><Fixture/></LessonRunnerProvider></BrowserRouter>);